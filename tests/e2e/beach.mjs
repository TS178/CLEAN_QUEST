// ビーチの お掃除（分別）・エサ・すみか の 通し確認（headless Edge）
//   python -m http.server 8000 → node tests/e2e/beach.mjs   （BCT_URL / CDP_PORT / OUT で変更可）
import { launch, sleep } from "./cdp.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BCT_URL || "http://127.0.0.1:8000/";
const PORT = Number(process.env.CDP_PORT || 9500 + Math.floor(Math.random() * 400));
const OUT = process.env.OUT || path.join(DIR, "out");
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, info = "") => {
  const line = `${ok ? "OK " : "NG "} ${name}${info ? "  " + info : ""}`;
  results.push(line);
  console.log(line);
};
const b = await launch({ port: PORT });
const ev = b.ev;
const st = (expr) => ev(`(()=>{const s=BCT.store.get(),g=BCT.game;return ${expr}})()`);
const shot = (n) => b.shot(path.join(OUT, n + ".png"));
const modalText = () => ev(`document.getElementById('modal').classList.contains('show') ? document.getElementById('modalBox').textContent : ''`);
const clickModal = (text) => ev(`(()=>{const el=[...document.querySelectorAll('#modalBox button')].find(e=>e.textContent.includes(${JSON.stringify(text)}));if(!el)return false;el.click();return true})()`);
async function waitFor(expr, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await ev(expr)) return true;
    await sleep(120);
  }
  return false;
}
// 位置を とる（スクロールは しない。ドラッグの とちゅうで ずれないように）
const center = (sel) => ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);
async function mouse(type, x, y) {
  await b.send("Input.dispatchMouseEvent", { type, x, y, button: "left", buttons: type === "mouseReleased" ? 0 : 1, clickCount: 1 });
}
async function drag(from, to, steps = 8) {
  await mouse("mousePressed", from.x, from.y);
  for (let i = 1; i <= steps; i++) await mouse("mouseMoved", from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
  await mouse("mouseReleased", to.x, to.y);
}
async function tap(p) { await mouse("mousePressed", p.x, p.y); await mouse("mouseReleased", p.x, p.y); }
// ゴミの 正しい ゴミばこ・まちがった ゴミばこ
const binFor = (id, right) => ev(`(()=>{const d=BCT.store.get().beach.dirt.find(x=>x.id===${JSON.stringify(id)});const k=BCT.beachTrashOf(d.kind).bin;
  return ${right} ? k : BCT.BINS.find(b=>b.key!==k).key})()`);
const firstTrash = () => ev(`(document.querySelector('#beachTrash [data-trash]')||{}).dataset?.trash || null`);

try {
  await b.goto(BASE + "index.html");
  await ev("localStorage.clear()");
  await b.goto(BASE + "index.html");
  await ev(`document.querySelector('.egg[data-type=dolphin]').click()`);
  await sleep(300);
  await ev(`[...document.querySelectorAll('#modalBox button')].pop().click()`);
  await sleep(300);
  await ev(`document.getElementById('nameForm').requestSubmit()`);
  await sleep(3000);
  await ev(`document.getElementById('hatchGo').click()`);
  await sleep(800);

  // ---------- 1. はじめは よごれ度1 → こまりがお ----------
  check("はじめは ゴミが 3こ（よごれ度1）", await ev(`document.querySelectorAll('#beachTrash [data-trash]').length===3`) && (await st(`g.dirtLevel(s)===1`)));
  check("よごれていると こまりがお", await ev(`document.getElementById('pet').classList.contains('worried')`));
  check("ゴミばこは 3つ（色と マーク）", await ev(`document.querySelectorAll('#bins [data-bin]').length===3`));
  check("よごれている あいだは ゴミばこを 出す", await ev(`(()=>{const w=document.getElementById('binsWrap');return !w.classList.contains('gone')&&w.getBoundingClientRect().height>=document.getElementById('bins').getBoundingClientRect().height})()`));
  await shot("b01-dirty");

  // ---------- 2. まちがった ゴミばこ → もどる・へらない ----------
  let id = await firstTrash();
  await drag(await center(`[data-trash="${id}"]`), await center(`[data-bin="${await binFor(id, false)}"]`));
  await sleep(400);
  check("まちがえると もどる（へらない）", await st(`s.beach.dirt.length===3 && g.coins(s)===0`));
  check("正しい ゴミばこを ひからせて おしえる", await ev(`!!document.querySelector('#bins .bin.hint')`));
  await shot("b02-wrong");

  // ---------- 3. ドラッグで 正しく すてる ----------
  await drag(await center(`[data-trash="${id}"]`), await center(`[data-bin="${await binFor(id, true)}"]`));
  await sleep(500);
  check("ドラッグで 正しく すてると +5ポイント", await st(`s.beach.dirt.length===2 && g.coins(s)===5`));
  await shot("b03-sorted");

  // ---------- 4. タップで えらんで → ゴミばこを タップ ----------
  id = await firstTrash();
  await tap(await center(`[data-trash="${id}"]`));
  await sleep(200);
  check("タップで えらぶと ゴミばこが まつ", await ev(`document.querySelectorAll('#bins .bin.ready').length===3`));
  await ev(`document.querySelector('[data-bin="${await binFor(id, true)}"]').click()`);
  await sleep(400);
  check("タップ → ゴミばこ でも すてられる", await st(`s.beach.dirt.length===1 && g.coins(s)===10`));

  // ---------- 5. はじく（スワイプ）→ きれい → クイズへ さそう ----------
  id = await firstTrash();
  const from = await center(`[data-trash="${id}"]`);
  const to = await center(`[data-bin="${await binFor(id, true)}"]`);
  // ゴミばこの 段の 高さを 2.5秒 記録（しまう ときに カクッと 消えず、なめらかに しぼむか）
  await ev(`void (async()=>{const w=document.getElementById('binsWrap'),hs=[],t=performance.now();
    while(performance.now()-t<2500){await new Promise(r=>requestAnimationFrame(r));hs.push(Math.round(w.getBoundingClientRect().height));}window.__binsH=hs;})(); true`);
  // ゴミばこの 手前 4割で はなす（はやく はじく）
  await drag(from, { x: from.x + (to.x - from.x) * 0.4, y: from.y + (to.y - from.y) * 0.4 }, 3);
  await sleep(500);
  check("かたづけた 直後は ゴミばこを すぐには しまわない（のみこむ 演出の あと）", await ev(`!document.getElementById('binsWrap').classList.contains('gone')`));
  check("ゴミばこの ほうへ はじいても すてられる", await st(`s.beach.dirt.length===0 && g.coins(s)===15`));
  check("きれいに なると えがおに もどる", await ev(`!document.getElementById('pet').classList.contains('worried')`));
  await waitFor(`!!window.__binsH`, 4000);
  const hs = await ev(`window.__binsH`);
  const full = Math.max(...hs);
  check("きれいに なったら ゴミばこを なめらかに しまう", hs[hs.length - 1] === 0 && hs.filter((v) => v > 5 && v < full - 5).length >= 3 &&
    (await ev(`(()=>{const w=document.getElementById('binsWrap');return w.classList.contains('gone')&&w.inert})()`)), `${full}px → 0（とちゅう ${hs.filter((v) => v > 5 && v < full - 5).length}コマ）`);
  await waitFor(`document.getElementById('modal').classList.contains('show')`, 4000);
  check("はじめて きれいに → ようせいが クイズへ さそう", (await modalText()).includes("クイズ"));
  await shot("b04-invite");
  await clickModal("クイズへ");
  await sleep(400);
  check("さそいから ミッション画面へ", await ev(`BCT.ui.current()==='mission'`));

  // ---------- 5b. ホームの 表示（ピカピカ の 行・ドロップ の 段・けした もの） ----------
  await ev(`BCT.ui.show('home')`);
  await sleep(400);
  const fun = await ev(`[1,2,3,4,5,6,7,8,9,10,12,15,20].map(n=>BCT.beach.funPun(n)).join(' ')`);
  check("〜ふん／〜ぷん を ただしく", fun === "1ぷん 2ふん 3ぷん 4ぷん 5ふん 6ぷん 7ふん 8ぷん 9ふん 10ぷん 12ふん 15ふん 20ぷん", fun);
  check("ピカピカの 行に「つぎの ゴミまで あと ○ふん／ぷん」", /つぎの ゴミまで あと \d+(ふん|ぷん)/.test(await ev(`document.getElementById('beachStatus').textContent`)));
  check("ピカピカの 印と 文字の 高さが そろう", await ev(`(()=>{const a=document.querySelector('#beachStatus .dirt').getBoundingClientRect(),b=document.querySelector('#beachStatus .next').getBoundingClientRect();return Math.abs((a.top+a.height/2)-(b.top+b.height/2))<=2})()`));
  check("「ドロップ」と「ショップでかう」が 同じ 行（「ごはん」とは いわない）", await ev(`(()=>{const t=document.getElementById('foodTray'),l=t.querySelector('.lbl'),s=t.querySelector('[data-food-shop]');if(!l||!s)return false;const a=l.getBoundingClientRect(),b=s.getBoundingClientRect();
    return l.textContent==='ドロップ'&&s.textContent==='ショップでかう'&&Math.abs((a.top+a.height/2)-(b.top+b.height/2))<=6})()`));
  check("ホームに 名前・レベル・けいけんち・なつきど・すすみぐあい・なでる は 出さない",
    await ev(`['homeName','homeStage','homeBar','homeHearts','homeQuiz','homeClean','homeBadge','actPet'].every(id=>!document.getElementById(id)) && !!document.getElementById('actPlay')`));

  // ---------- 6. 時間で よごれる（アプリを とじていた 分も）・3で とまる ----------
  const every = await ev(`BCT.CONFIG.beach.dirtEveryMin*60000`);
  await ev(`(()=>{const s=JSON.parse(localStorage.getItem('bct-state'));s.beach.last-= ${every};localStorage.setItem('bct-state',JSON.stringify(s))})()`);
  await b.goto(BASE + "index.html");
  await sleep(600);
  check("時間が たつと よごれる（よごれ度1）", await st(`s.beach.dirt.length===3`) && (await ev(`document.querySelectorAll('#beachTrash [data-trash]').length===3`)));
  check("よごれた 状態で ひらくと ゴミばこは はじめから 出ている", await ev(`(()=>{const w=document.getElementById('binsWrap');return !w.classList.contains('gone')&&!w.inert&&w.getBoundingClientRect().height>100})()`));
  await ev(`(()=>{const s=JSON.parse(localStorage.getItem('bct-state'));s.beach.last-= ${every * 10};localStorage.setItem('bct-state',JSON.stringify(s))})()`);
  await b.goto(BASE + "index.html");
  await sleep(600);
  check("ながく あけても よごれ度3（9こ）で とまる", await st(`s.beach.dirt.length===9 && g.dirtLevel(s)===3`));
  await shot("b05-level3");

  // ---------- 7. エサを かう（ショップの エサ タブ） ----------
  await ev(`BCT.game.claim('quiz','zz-beach-pts',{xp:0,coins:300})`);
  await ev(`BCT.ui.show('shop','food')`);
  await sleep(300);
  check("ショップに『すべて』『ドロップ』『すみか』の タブ（「ごはん」と いわない）", await ev(`!!document.querySelector('#shopBody [data-cat=all]') && document.querySelector('#shopBody [data-cat=food]').textContent.includes('ドロップ') && !document.getElementById('shopBody').textContent.includes('ごはん') && !!document.querySelector('#shopBody [data-cat=home]')`));
  await shot("b06-shop-food");
  // ドロップも ほかの アイテムと おなじ：タップ → 説明と「とじる」「かう」
  await ev(`document.querySelector('[data-food-item=drop_blue]').click()`);
  await sleep(200);
  check("ドロップを タップ → 説明と「とじる」「かう」", (await modalText()).includes("けいけんち") &&
    (await ev(`[...document.querySelectorAll('#modalBox button')].map(b=>b.textContent.trim()).some(t=>t==='とじる') && [...document.querySelectorAll('#modalBox button')].some(b=>b.textContent.includes('かう'))`)));
  await clickModal("かう");
  await sleep(300);
  // かった あとは ほかの アイテムと おなじ「かったよ！」（絵・なまえ・もってる数・のこり）
  check("ドロップを かうと ほかの アイテムと おなじ「かったよ！」", (await modalText()).includes("かったよ") &&
    (await ev(`!!document.querySelector('#modalBox .detail-prev svg') && document.getElementById('modalBox').textContent.includes('もってる 1こ') && [...document.querySelectorAll('#modalBox button')].some(b=>b.textContent.includes('ホームで あげる'))`)));
  await clickModal("あとで");
  await sleep(300);
  await ev(`document.querySelector('[data-food-item=drop_rainbow]').click()`);
  await sleep(200);
  await clickModal("かう");
  await sleep(300);
  await clickModal("あとで");
  await sleep(300);
  check("エサを かうと ポイントが へる", await st(`g.foodStock(s,'drop_blue')===1 && g.foodStock(s,'drop_rainbow')===1 && g.coins(s)===315-150`), String(await st(`g.coins(s)`)));

  // ---------- 8. エサを あげる（ドラッグ・タップ）→ 進化 ----------
  await ev(`BCT.ui.show('home')`);
  await sleep(600);
  await drag(await center(`[data-food=drop_blue]`), await center(`#pet`));
  await sleep(400);
  check("エサを ようせいへ ドラッグ → けいけんち +10", await st(`g.xp(s)===10 && g.foodStock(s,'drop_blue')===0`));
  check("たべる よろこびの うごき", await ev(`document.getElementById('pet').classList.contains('eat')`));
  await shot("b07-eat");
  await sleep(1500);
  await tap(await center(`[data-food=drop_rainbow]`));
  await sleep(200);
  await ev(`document.getElementById('pet').click()`);
  await sleep(300);
  check("タップで えらんで ようせいを タップ → けいけんち +200", await st(`g.xp(s)===210 && s.affection===0`), "なでるには ならない");
  check("しんかの えんしゅつ（Lv1→Lv3：こども→進化1）", await waitFor(`document.getElementById('evo').classList.contains('show')`, 4000));
  await waitFor(`document.getElementById('evo').classList.contains('done')`, 9000);
  await shot("b08-evolve");
  check("進化1に なった", await st(`g.stage(s)===2`) && (await ev(`document.getElementById('evoMsg').textContent.includes('Lv3')`)));
  await ev(`document.getElementById('evoOk').click()`);
  await sleep(500);
  for (let i = 0; i < 4 && (await ev(`document.getElementById('modal').classList.contains('show')`)); i++) {
    await ev(`[...document.querySelectorAll('#modalBox button')].pop().click()`);
    await sleep(300);
  }

  // ---------- 9. すみか ----------
  await ev(`BCT.ui.show('shop','home')`);
  await sleep(300);
  check("すみかは じぶんの ようせい用 3つ", await ev(`[...document.querySelectorAll('#shopBody [data-item]')].map(e=>e.dataset.item).join(',')`) === "home_dolphin_ring,home_dolphin_boat,home_dolphin_tower");
  await ev(`document.querySelector('[data-item=home_dolphin_ring]').click()`);
  await sleep(300);
  await clickModal("かう");
  await sleep(300);
  await clickModal("すみかに おく");
  await sleep(800);
  check("かって すみかに おく → すみか画面", await ev(`BCT.ui.current()==='habitat' && !!document.querySelector('#hbItems [data-hb=home_dolphin_ring]')`) && (await st(`!!s.habitat.home_dolphin_ring`)));
  await shot("b09-habitat");
  const before = await st(`JSON.stringify(s.habitat.home_dolphin_ring)`);
  const it = await center(`#hbItems [data-hb=home_dolphin_ring]`);
  await drag(it, { x: it.x - 60, y: it.y + 30 });
  await sleep(300);
  const after = await st(`JSON.stringify(s.habitat.home_dolphin_ring)`);
  check("アイテムを ドラッグで うごかせる（保存）", before !== after, `${before} → ${after}`);
  const it2 = await center(`#hbItems [data-hb=home_dolphin_ring]`);
  await tap(it2);
  check("アイテムを タップ → ようせいが あそびに いく（ジャンプで くぐる）", await waitFor(`document.getElementById('hbPet').classList.contains('act-through')`, 3000));
  await shot("b10-habitat-act");
  await ev(`document.querySelector('[data-hb-toggle=home_dolphin_ring]').click()`);
  await sleep(300);
  check("しまう", await st(`!s.habitat.home_dolphin_ring`) && (await ev(`!document.querySelector('#hbItems [data-hb]')`)));

  // ---------- 10. 表示 ----------
  await ev(`BCT.ui.show('home')`);
  await sleep(300);
  check("すみかから もどっても ゴミばこが 点滅しない（演出の 目印が のこらない）",
    await ev(`[...document.querySelectorAll('#bins .bin')].every(e=>!e.classList.contains('hint')&&!e.classList.contains('gulp')&&!e.getAnimations({subtree:true}).some(a=>a.playState==='running'))`));
  check("通貨の表示名は『たんけんたいメダル』", await ev(`!document.body.innerText.includes('ポイント') && document.getElementById('tbCoin').title==='たんけんたいメダル'`));
  await shot("b11-home");
} catch (e) {
  results.push("EXCEPTION " + e.stack);
  console.log("EXCEPTION " + e.stack);
} finally {
  const errs = b.consoleLogs.filter((l) => /^(error|EXCEPTION)/.test(l));
  check("コンソールに エラーなし", errs.length === 0, errs.join(" | "));
  const ng = results.filter((r) => !r.startsWith("OK")).length;
  console.log(`\n${results.length - ng} / ${results.length} OK   （スクリーンショット: ${OUT}）`);
  b.close();
  process.exitCode = ng ? 1 : 0;
}
