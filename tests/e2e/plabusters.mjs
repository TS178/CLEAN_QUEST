// プラごみバスターズの 画面の 通し確認（headless Edge）
//   python -m http.server 8000 ＋ node tests/e2e/plabusters.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "./cdp.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(DIR, "out");
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BCT_URL || "http://127.0.0.1:8000/";
const results = [];
const check = (name, ok, info = "") => { results.push(!!ok); console.log(`${ok ? "OK" : "NG"}  ${name}${info ? "  " + info : ""}`); };

const b = await launch({ port: 9500 + Math.floor(Math.random() * 400), width: 390, height: 844 });
const ev = b.ev;
const shot = (n) => b.shot(path.join(OUT, `pb-${n}.png`));
async function waitFor(expr, ms = 6000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await ev(expr)) return true; await sleep(100); }
  return false;
}
const R = () => ev(`(()=>{const r=BCT.plaBusters.debug();return r?{phase:r.phase,time:r.time,m:r.monster&&{id:r.monster.id,type:r.monster.type,bin:r.monster.bin},score:r.score,combo:r.combo,cut:r.cutin,mist:r.stats.mistakes}:null})()`);
const press = (c) => ev(`(()=>{const b=document.querySelector('#pbPad [data-choice="${c}"]');const r=b.getBoundingClientRect();b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:r.left+5,clientY:r.top+5}));return true})()`);
const tapStage = () => ev(`(()=>{const s=document.getElementById('pbStage');const r=s.getBoundingClientRect();s.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2}));return true})()`);
const claims = () => ev(`Object.keys(BCT.store.get().claims).filter(k=>k.includes(':plabusters:')).length`);

try {
  await b.goto(BASE + "index.html");
  await ev(`localStorage.clear(); BCT.game.choosePet('turtle','テスト','テストたい',1); true`);
  await b.goto(BASE + "index.html");
  await sleep(800);

  // ---- ミッションの 入口 ----
  await ev(`BCT.ui.show('mission'); true`);
  await sleep(400);
  check("ミッションに「プラごみバスターズ」の カード（かいじゅうの 絵・ボタン）", await ev(`!!document.querySelector('#missionBody .pb-entry .pb-monster') && document.getElementById('msPb').textContent.includes('しゅつどう')`));
  await ev(`document.getElementById('msPb').click(); true`);
  await sleep(500);
  check("ひらくと ルールの せつめい（ゴミばこ 3つ・おおがた・われた びん・ひっさつわざ）", await ev(`BCT.ui.current()==='plabusters' && /TAP! TAP!/.test(document.getElementById('pbOverlay').textContent) && /われた びん/.test(document.getElementById('pbOverlay').textContent) && document.querySelectorAll('.pb-rule-bin').length===3`));
  check("ゲーム中は 下の タブを かくす（右上の メダルは 見える）", await ev(`getComputedStyle(document.querySelector('.tabs')).display==='none' && getComputedStyle(document.getElementById('tbCoin')).display!=='none'`));
  check("そうさ ボタンは ゴミばこ 3つ ＋「おとなを よぶ」", await ev(`[...document.querySelectorAll('#pbPad [data-choice]')].map(b=>b.dataset.choice).join()==='plastic,canbin,burn,adult'`));
  check("はじめは はまべが よごれている（ゴミが ちらばる）", await ev(`getComputedStyle(document.getElementById('pbStage')).getPropertyValue('--dirt').trim()==='1' && document.querySelectorAll('.pb-litter:not(.off)').length===6`));
  await shot("1-ready");

  // ---- スタート ----
  await ev(`document.getElementById('pbStart').click(); true`);
  check("3・2・1 の あとに はじまる", await waitFor(`BCT.plaBusters.debug().phase==='playing'`, 4500));
  check("かいじゅうが でる（ゴミの なまえの ふだ・かお）", await waitFor(`!!document.querySelector('#pbArena .pb-monster .pb-face') && !!document.querySelector('#pbArena .pb-tag')`, 3000));
  await shot("2-play");

  // ---- まちがい → ただしい ----
  let r = await R();
  for (let i = 0; i < 10 && r.m.type !== "normal"; i++) { if (r.m.type === "boss") await tapStage(); else await press("adult"); await sleep(400); r = await R(); }
  const wrong = ["plastic", "canbin", "burn"].find((k) => k !== r.m.bin);
  await press(wrong);
  await sleep(100);
  r = await R();
  check("ちがう ゴミばこ → まちがい（ボタンが すこし うごけない）", r.mist === 1 && r.combo === 0 && (await ev(`document.getElementById('pbPad').classList.contains('stun')`)));
  await sleep(700);
  const before = (await R()).score;
  await press(r.m.bin);
  await sleep(80);
  r = await R();
  check("ただしい ゴミばこ → じょうか（てんすう・コンボ）", r.score > before && r.combo === 1);
  check("ようせいが こうげき（ひかりの たま）", await ev(`document.getElementById('pbFairy').dataset.mood==='attack'`));

  // ---- しばらく ただしく あそぶ（おおがた・あぶない・ビームを ふくむ） ----
  const seen = { boss: false, danger: false, beam: false, aura: false, tapBanner: false, dangerBanner: false, cutin: false };
  const t0 = Date.now();
  while (Date.now() - t0 < 26000) {
    r = await R();
    if (!r || r.phase !== "playing") break;
    if (r.cut > 0) { seen.beam = true; seen.cutin = seen.cutin || (await ev(`!document.getElementById('pbCutin').hidden && /クリーンビーム/.test(document.getElementById('pbCutin').textContent)`)); await sleep(150); continue; }
    seen.aura = seen.aura || (await ev(`document.getElementById('pbFairy').classList.contains('aura')`));
    if (r.m) {
      if (r.m.type === "boss") { seen.boss = true; seen.tapBanner = seen.tapBanner || (await ev(`document.getElementById('pbBanner').classList.contains('tap') && document.getElementById('pbStage').classList.contains('boss-mode')`)); await tapStage(); }
      else if (r.m.type === "danger") { seen.danger = true; seen.dangerBanner = seen.dangerBanner || (await ev(`document.getElementById('pbBanner').classList.contains('danger')`)); await press("adult"); }
      else await press(r.m.bin);
    }
    await sleep(110);
    if (!seen.danger && seen.boss && r.m && r.m.type === "normal") await ev(`BCT.plaBusters.debug().forceNext='danger';true`); // あぶない かいじゅうを かならず 1かい だす
    if (seen.boss && seen.danger && seen.beam && seen.aura) break;
  }
  check("おおがた かいじゅう：「TAP! TAP!」で れんだ", seen.boss && seen.tapBanner);
  check("あぶない かいじゅう：「あぶない！」の けいこく・「おとなを よぶ」で ボーナス", seen.danger && seen.dangerBanner && (await ev(`BCT.plaBusters.debug().stats.dangersAvoided>=1`)));
  check("ひっさつ クリーンビーム：カットイン", seen.beam && seen.cutin);
  check("10コンボで ようせいに ひかりの オーラ", seen.aura);
  check("あそぶ ほど はまべが きれいに なる", await ev(`Number(getComputedStyle(document.getElementById('pbStage')).getPropertyValue('--dirt'))<1`));

  // ---- ひとやすみ ----
  await ev(`document.getElementById('pbPause').click(); true`);
  await sleep(200);
  const tp = (await R()).time;
  await sleep(600);
  check("ひとやすみ：とけいが とまる", (await R()).phase === "paused" && (await R()).time === tp && (await ev(`/ひとやすみ/.test(document.getElementById('pbOverlay').textContent)`)));
  await ev(`document.getElementById('pbResume').click(); true`);
  await sleep(300);
  check("つづきから あそぶ", (await R()).phase === "playing");
  await ev(`BCT.ui.show('home'); true`);
  await sleep(200);
  check("ほかの 画面へ いくと ひとやすみ（タブも もどる）", (await R()).phase === "paused" && (await ev(`getComputedStyle(document.querySelector('.tabs')).display!=='none'`)));
  await ev(`BCT.ui.show('plabusters'); true`);
  await sleep(300);
  await ev(`document.getElementById('pbResume').click(); true`);

  // ---- おわり・けっか ----
  const coinsBefore = await ev(`BCT.game.coins(BCT.store.get())`);
  await ev(`(()=>{const r=BCT.plaBusters.debug();r.time=${59.6};return true})()`);
  check("60びょうで おわる → けっか", await waitFor(`BCT.plaBusters.debug().phase==='result' && !document.getElementById('pbResult').hidden`, 4000));
  await sleep(300);
  check("けっか：ほし・てんすう・はまべの きれいど・じょうかの かず", await ev(`document.querySelectorAll('.pb-star').length===3 && !!document.getElementById('pbCleanBar') && /じょうか/.test(document.getElementById('pbResult').textContent)`));
  check("けっかでは リサイクルボックス", await ev(`!!document.querySelector('#pbArena .pb-box')`));
  check("ごほうびが ほぞん される（右上の メダルも ふえる）", await waitFor(`document.getElementById('pbSave').textContent.includes('ほぞんずみ')`, 6000) &&
    (await ev(`BCT.game.coins(BCT.store.get())`)) > coinsBefore && (await claims()) === 1);
  const fin = await ev(`(()=>{const r=BCT.plaBusters.debug();return {res:BCT.plaBustersEngine.result(r),saved:BCT.store.get().plaBusters}})()`);
  check("メダルは ★と PERFECT の けいさんどおり", (await ev(`BCT.game.coins(BCT.store.get())`)) - coinsBefore === fin.res.coins, JSON.stringify(fin.res));
  check("はまべの きれいどが ゲージと ステージに でる", await waitFor(`document.getElementById('pbCleanPct').textContent==='${fin.res.clean}%'`, 3000));
  check("さいこう てん・コンボ・あそんだ かいすうを ほぞん", fin.saved.plays === 1 && fin.saved.bestScore === fin.res.score && fin.saved.bestCombo === fin.res.maxCombo);
  await shot("3-result");
  // 二重に もらえない
  await ev(`BCT.ui.show('mission'); BCT.ui.show('plabusters'); true`);
  await sleep(500);
  check("おなじ あそびの ごほうびは 1かいだけ", (await claims()) === 1);
  check("ミッションの カードに さいこう てん", await ev(`BCT.ui.show('mission'), /さいこう/.test(document.querySelector('#missionBody .pb-entry').textContent)`));

  // ---- PERFECT（いちども まちがえない） ----
  await ev(`BCT.ui.show('plabusters'); true`);
  await sleep(400);
  await ev(`document.getElementById('pbStart').click(); true`);
  await waitFor(`BCT.plaBusters.debug().phase==='playing'`, 4500);
  await ev(`(()=>{const r=BCT.plaBusters.debug();r.score=BCT.plaBustersEngine.C.stars[2];r.time=59.8;return true})()`);
  check("PERFECT BONUS！（まちがい 0・★3 は ×2）", await waitFor(`/PERFECT BONUS/.test(document.getElementById('pbArena').textContent)`, 4000) &&
    (await ev(`BCT.plaBustersEngine.result(BCT.plaBusters.debug()).coins===BCT.plaBustersEngine.C.coins[3]*BCT.plaBustersEngine.C.perfect.multStar3`)));
  check("100% の ときは エメラルドの うみ（きらきら）", await waitFor(`document.getElementById('pbStage').classList.contains('sparkling') && getComputedStyle(document.getElementById('pbStage')).getPropertyValue('--emerald').trim()==='1'`, 4000));
  await waitFor(`document.getElementById('pbSave').textContent.includes('ほぞんずみ')`, 6000);
  check("2かい あそぶと ごほうびも 2かい", (await claims()) === 2);

  // ---- せまい スマホ・うごきを へらす ----
  for (const [w, h] of [[360, 640], [320, 568]]) {
    await b.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 2, mobile: true });
    await ev(`document.getElementById('pbAgain').click(); true`);
    await sleep(500);
    check(`${w}×${h}：よこに はみ出さない・ボタンが 1れつ`, await ev(`document.scrollingElement.scrollWidth<=innerWidth && new Set([...document.querySelectorAll('#pbPad .pb-btn')].map(b=>Math.round(b.getBoundingClientRect().top))).size===1`));
    await ev(`document.getElementById('pbStart').click(); true`);
    await waitFor(`BCT.plaBusters.debug().phase==='playing'`, 4500);
    check(`${w}×${h}：ツールバーも よこに はみ出さない`, await ev(`(()=>{const t=document.querySelector('.pb-toolbar').getBoundingClientRect();return [...document.querySelectorAll('.pb-toolbar > *')].every(e=>e.getBoundingClientRect().right<=innerWidth+1)})()`));
    check(`${w}×${h}：あそぶ ときは スクロール なしで ステージと ボタンが 見える`, await ev(`(()=>{const p=document.getElementById('pbPad').getBoundingClientRect();return p.bottom<=innerHeight+1 && document.getElementById('pbStage').getBoundingClientRect().height>=200})()`));
    await ev(`(()=>{const r=BCT.plaBusters.debug();r.time=59.9;return true})()`);
    await waitFor(`document.getElementById('pbSave') && document.getElementById('pbSave').textContent.includes('ほぞんずみ')`, 7000);
  }
  await shot("4-small-result");
  await ev(`BCT.prefs.set('reduceMotion', true); document.getElementById('pbAgain').click(); true`);
  await sleep(400);
  await ev(`document.getElementById('pbStart').click(); true`);
  check("うごきを へらす 設定でも あそべる（カウントダウン なし）", await waitFor(`BCT.plaBusters.debug().phase==='playing'`, 1500));
  await waitFor(`!!BCT.plaBusters.debug().monster`, 3000);
  r = await R();
  for (let i = 0; i < 5 && r.m && r.m.type !== "normal"; i++) { if (r.m.type === "boss") await tapStage(); else await press("adult"); await sleep(200); r = await R(); }
  if (r.m) { await press(r.m.bin); await sleep(100); }
  check("うごきを へらす 設定でも じょうか できる", (await R()).score > 0);
  await ev(`BCT.prefs.set('reduceMotion', false); BCT.ui.show('mission'); true`);

  const errs = b.consoleLogs.filter((l) => /EXCEPTION|error/i.test(l));
  check("コンソールに エラーなし", errs.length === 0, errs.join(" | "));
} finally { b.close(); }
const ok = results.filter(Boolean).length;
console.log(`\n${ok} / ${results.length} OK   （スクリーンショット: ${OUT}）`);
process.exitCode = ok === results.length ? 0 : 1;
