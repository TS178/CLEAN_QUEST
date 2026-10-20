// 画面の通し確認（headless Edge + CDP）
//   1. python -m http.server 8000   （このフォルダの親＝アプリのフォルダで）
//   2. node tests/e2e/run.mjs        （BCT_URL / CDP_PORT / OUT で変更可）
// カメラは Edge の「仮のカメラ」を使う。実機のカメラ・保存は ここでは確かめられない。
import { launch, sleep } from "./cdp.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BCT_URL || "http://127.0.0.1:8000/";
const PORT = Number(process.env.CDP_PORT || 9500 + Math.floor(Math.random() * 400)); // 毎回ちがう番号
const OUT = process.env.OUT || path.join(DIR, "out");
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, info = "") => {
  const line = `${ok ? "OK " : "NG "} ${name}${info ? "  " + info : ""}`;
  results.push(line);
  console.log(line);
};

const b = await launch({
  port: PORT,
  args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
});
const reqs = [];
await b.send("Network.enable");
b.on((d) => { if (d.method === "Network.requestWillBeSent") reqs.push(d.params.request.url); });

const ev = b.ev;
const st = (expr) => ev(`(()=>{const s=BCT.store.get(),g=BCT.game;return ${expr}})()`);
const modalOpen = () => ev(`document.getElementById('modal').classList.contains('show')`);
const modalText = () => ev(`document.getElementById('modalBox').textContent`);
const clickModal = (text) => ev(`(()=>{const el=[...document.querySelectorAll('#modalBox button')].find(e=>e.textContent.includes(${JSON.stringify(text)}));if(!el)return false;el.click();return true})()`);
const shot = (name) => b.shot(path.join(OUT, name + ".png"));
async function waitFor(expr, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await ev(expr)) return true;
    await sleep(120);
  }
  return false;
}
// おしらせ（モーダル・レベルアップ）を 順に とじる
async function drain(prefer = ["やったね", "あとで", "とじる"]) {
  for (let i = 0; i < 12; i++) {
    await sleep(250);
    if (await ev(`document.getElementById('evo').classList.contains('show')`)) {
      await waitFor(`document.getElementById('evo').classList.contains('done')`, 9000);
      await ev(`document.getElementById('evoOk').click()`);
      continue;
    }
    if (!(await modalOpen())) return;
    let done = false;
    for (const p of prefer) if (!done && (await clickModal(p))) done = true;
    if (!done) await ev(`[...document.querySelectorAll('#modalBox button')].pop().click()`);
  }
}

try {
  await b.send("Browser.grantPermissions", { origin: new URL(BASE).origin, permissions: ["geolocation"] }).catch(() => {});
  await b.send("Emulation.setGeolocationOverride", { latitude: 37.0441, longitude: 136.7563, accuracy: 10 });
  await b.goto(BASE + "index.html");
  await ev("localStorage.clear()");
  await b.goto(BASE + "index.html");

  // ---------- 1. ようせいを えらぶ（名前は 入れなくても よい） ----------
  check("初回は たまご3つ", await waitFor(`document.querySelectorAll('.egg').length===3`));
  await ev(`document.querySelector('.egg[data-type=turtle]').click()`);
  await sleep(300);
  await clickModal("これに する");
  await sleep(300);
  await b.send("Emulation.setDeviceMetricsOverride", { width: 360, height: 640, deviceScaleFactor: 2, mobile: true });
  await sleep(200);
  check("名前の 画面：「たんけん スタート！」は 1行（360px でも）", await ev(`(()=>{const b=document.querySelector('#nameForm .btn.mint');const r=document.createRange();r.selectNodeContents(b);const t=[...r.getClientRects()].filter(x=>x.width>0).map(x=>x.top);return t.length>0&&Math.max(...t)-Math.min(...t)<4})()`));
  await b.send("Emulation.setDeviceMetricsOverride", { width: 412, height: 900, deviceScaleFactor: 2, mobile: true });
  await sleep(200);
  await ev(`document.getElementById('inTeam').value='テストたい';document.getElementById('nameForm').requestSubmit()`);
  await sleep(3000);
  check("名前を入れないと 初期名", await st(`s.pet.name==='ウミガメのようせい'`));
  check("赤いリボンを 無料で もらい 装着", await st(`s.owned.accessory_ribbon.via==='gift' && s.equip.acc==='accessory_ribbon' && g.coins(s)===0`));
  await shot("01-hatched");
  await ev(`document.getElementById('hatchGo').click()`);
  await sleep(600);

  // ---------- 2. なでる（カメラを つかわない いつもの あそびかた。AR は tests/e2e/ar.mjs）。演出中の 連打は 1回 ----------
  // ビーチが よごれていると こまりがお なので、ここでは きれいな 状態に してから 確かめる（ポイントは ふやさない）
  await ev(`BCT.store.transact((s)=>{s.beach.dirt=[];s.beach.last=Date.now();}); BCT.home.render(); BCT.beach.render(); true`);
  await ev(`void BCT.home.petLegacy();void BCT.home.petLegacy();document.getElementById('pet').click()`);
  await sleep(200);
  check("連打しても なでるは 1回", await st(`s.affection===1`), String(await st(`s.affection`)));
  for (let i = 0; i < 4; i++) {
    await sleep(1450);
    await ev(`void BCT.home.petLegacy()`);
  }
  await sleep(400);
  check("5回で なつきど1 → えがお", await st(`g.affection(s).stage===1`) && (await ev(`!!document.querySelector('#petBody svg[data-face="happy"]')`)));
  check("なでても けいけんち・コインは 出ない", await st(`g.xp(s)===0 && g.coins(s)===0`));
  await shot("02-home-pet");
  await sleep(1500);

  // ---------- 3. クイズ（まちがえても へらない・再挑戦・二重に もらえない） ----------
  await ev(`BCT.ui.show('mission')`);
  await sleep(300);
  await shot("03-mission");
  check("ミッション画面に 英語の かざり・見出し・番号ボタンは ない", await ev(`(()=>{const m=document.getElementById('missionBody');return !/SMALL STEPS/i.test(m.textContent)&&!m.querySelector('h2')&&!m.querySelector('.qchip')&&!/エサ/.test(m.textContent)})()`));
  check("ミッション：「← ホーム」の よこに「ミッションを クリアしよう！」（まえの 説明文は ない）", await ev(`(()=>{const h=document.querySelector('#scr-mission .home-back').getBoundingClientRect(),t=document.getElementById('msTitle');const r=t.getBoundingClientRect();return t.textContent==='ミッションを クリアしよう！'&&r.left>h.right&&Math.abs((r.top+r.height/2)-(h.top+h.height/2))<=6&&!document.querySelector('.mission-lead')&&!document.getElementById('missionBody').textContent.includes('かえるよ')})()`));
  const oneLine = (sel, i = 0) => `(()=>{const e=document.querySelectorAll('${sel}')[${i}];if(!e)return false;const r=document.createRange();r.selectNodeContents(e);const t=[...r.getClientRects()].filter(x=>x.width>0).map(x=>Math.round(x.top+x.height/2));return Math.max(...t)-Math.min(...t)<=6&&e.scrollWidth<=e.clientWidth+1&&!/ /.test(e.textContent.replace(/[+＋]/g,''))})()`;
  for (const [w, h] of [[412, 900], [390, 844], [360, 640]]) {
    await b.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 2, mobile: true });
    await sleep(200);
    check(`ミッション：クイズの 説明は スペース なしで 1行（${w}px）`, (await ev(`document.querySelectorAll("#missionBody .note.one-line").length===1`)) && (await ev(oneLine("#missionBody .note.one-line", 0))));
  }
  await b.send("Emulation.setDeviceMetricsOverride", { width: 412, height: 900, deviceScaleFactor: 2, mobile: true });
  await sleep(200);
  check("イベントの 日 いがいは イベント しゅうりょう QR を 出さない", await ev(`!BCT.eventMode.isOpen() && !document.getElementById('msQr')`));
  check("あぶない ものの 注意は「はりが ついている もの」（ビーチクリーンの やくそくとして のこす）", await ev(`document.getElementById('missionBody').textContent.includes('はりが ついている もの')`));
  check("ミッションは ゴミシュート・プラごみバスターズ・うみクイズ の 3つ（そうじミッションは ない）", await ev(`!!document.getElementById('msTruck') && !!document.getElementById('msPb') && !!document.getElementById('msNext') && !/そうじミッション/.test(document.getElementById('missionBody').textContent) && !document.querySelector('[data-go-cap]')`));
  check("「もんだいに ちょうせん する！」→ まだ クリアしていない もんだい", (await ev(`document.getElementById('msNext').textContent.trim()==='もんだいに ちょうせん する！'`)) &&
    (await ev(`(()=>{document.getElementById('msNext').click();const q=document.querySelector('.quiz-q').textContent;const s=BCT.store.get();return BCT.QUIZ.some(x=>x.q===q&&!BCT.game.isClaimed(s,'quiz',x.id))})()`)));
  await ev(`BCT.mission.openQuiz('q01')`);
  await ev(`(()=>{const q=BCT.QUIZ[0];document.querySelector('.choice:not([data-idx="'+q.a+'"])').click()})()`);
  await sleep(200);
  check("まちがえると 解説と もういちど", await ev(`document.getElementById('answer').textContent.includes('ざんねん') && !!document.querySelector('[data-retry]')`));
  check("まちがえても へらない", await st(`g.xp(s)===0 && g.coins(s)===0`));
  await shot("04-quiz-wrong");
  await ev(`document.querySelector('[data-retry]').click()`);
  await ev(`window.__coinSeen=false;window.__coinObs=new MutationObserver(()=>{if(document.querySelector('.coinfly .coinfly__coin'))window.__coinSeen=true});window.__coinObs.observe(document.body,{childList:true,subtree:true});true`);
  await ev(`(()=>{const q=BCT.QUIZ[0];const c=document.querySelector('.choice[data-idx="'+q.a+'"]');c.click();c.click();document.querySelector('.choice:not([data-idx="'+q.a+'"])').click()})()`);
  await sleep(300);
  check("せいかいで ポイント20（けいけんちは エサだけ・連打でも1回）", await st(`g.xp(s)===0 && g.coins(s)===20`), await st(`[g.xp(s),g.coins(s)]+''`));
  check("せいかいで メダルが 右上へ とんで、とどくと 20 に なる", await waitFor(`window.__coinSeen`, 2000) && (await waitFor(`!document.querySelector('.coinfly') && document.querySelector('#tbCoin .medal-amount b').textContent==='20'`, 5000)));
  await ev(`window.__coinObs.disconnect();true`);
  await shot("05-quiz-right");
  await drain();
  await ev(`BCT.mission.openQuiz('q01')`);
  await ev(`(()=>{const q=BCT.QUIZ[0];document.querySelector('.choice[data-idx="'+q.a+'"]').click()})()`);
  await sleep(200);
  check("ふくしゅうは ごほうび なし", await st(`g.coins(s)===20`) && (await ev(`document.getElementById('answer').textContent.includes('ふくしゅう')`)));
  await ev(`BCT.mission.renderList()`);
  check("ミッションに 見かえしの 欄は 出さない（「ふくしゅう する」ボタン）", await ev(`!document.querySelector('#missionBody #qReview') && document.getElementById('msReview').textContent.includes('ふくしゅう する')`));
  await ev(`document.getElementById('msReview').click()`);
  await sleep(200);
  check("「ふくしゅう する」→ クリアした もんだいを ◀ ▶ で 見かえせる（こたえと かいせつ）", await ev(`(()=>{const r=document.querySelector('#modalBox #qReview');const q=BCT.QUIZ[0];
    return !!r&&r.querySelector('.qr-pos').textContent.replace(/ /g,'')==='クリアしたもんだい1/1'&&r.textContent.includes(q.q)&&r.textContent.includes(q.c[q.a])&&r.querySelector('[data-qr="-1"]').disabled&&r.querySelector('[data-qr="1"]').disabled})()`));
  await clickModal("とじる");

  // ---------- 4a. 下の タブ：ようせい・すみか・ホーム・ミッション・ショップ（「ひろう」は ない） ----------
  check("下の タブは 左から ようせい・すみか・ホーム・ミッション・ショップ", await ev(`[...document.querySelectorAll('.tabs button')].map(b=>b.dataset.go+':'+b.textContent.trim()).join()==='me:ようせい,habitat:すみか,home:ホーム,mission:ミッション,shop:ショップ'`));
  check("「ひろう」（カメラで ゴミを きろく・ちず）は ない", await ev(`!document.getElementById('scr-capture') && !BCT.screens.capture && !BCT.screens.map && typeof L==='undefined' && !document.querySelector('[data-go=capture]')`));
  check("ようせい・すみか の タブは 相棒の 丸い 絵（ホームの 池には もう ない）", await ev(`!!document.querySelector('#actFairy #fairyPortrait svg') && !!document.querySelector('#actHabitat #habitatPortrait svg') && !document.getElementById('pondShortcuts')`));
  await ev(`document.getElementById('actFairy').click();true`);
  await sleep(400);
  check("「ようせい」タブ → ようせい画面（タブが えらばれる）", await ev(`BCT.ui.current()==='me' && document.getElementById('actFairy').classList.contains('active')`));
  await ev(`document.getElementById('actHabitat').click();true`);
  await sleep(400);
  check("「すみか」タブ → すみか画面", await ev(`BCT.ui.current()==='habitat' && document.getElementById('actHabitat').classList.contains('active')`));
  // 相棒が 2ひき いても「どの相棒にする？」は 出さずに そのまま 画面へ（えらびなおしは 画面の 中で）
  await ev(`BCT.ui.show('home');BCT.store.transact(s=>{s.companions={dolphin:{pet:{type:'dolphin',name:'いるか'},petXp:0,seenLv:1,equip:{},affection:0,toys:{},habitat:{}}};s.companionOrder=[s.pet.type,'dolphin']});BCT.ui.show('home');true`);
  await sleep(400);
  for (const [id, scr] of [["actFairy", "me"], ["actHabitat", "habitat"]]) {
    await ev(`BCT.ui.show('home');true`);
    await sleep(200);
    await ev(`document.querySelector('#${id} .ico').click();true`);
    await sleep(400);
    check(`相棒が 2ひきでも ${scr === "me" ? "ようせい" : "すみか"}タブは えらぶ おしらせ なしで そのまま 画面へ`, await ev(`BCT.ui.current()==='${scr}' && !document.getElementById('modal').classList.contains('show') && BCT.store.get().pet.type==='turtle'`));
  }
  check("ようせい画面で 相棒を えらびなおせる", await ev(`BCT.ui.show('me'), document.querySelectorAll('#meTop [data-select-companion]').length===2`));
  await ev(`BCT.store.transact(s=>{s.companions={};s.companionOrder=[]});BCT.ui.show('home');true`);
  await sleep(300);
  await shot("05a-tab-habitat");
  // イベントの 日（受付の QR）：ふだんは 出さない
  await ev(`BCT.ui.show('settings');true`);
  await sleep(300);
  check("設定：ふだんは「イベントの 日だけ」の 説明と 受付の QR を よむ ボタン", await ev(`!BCT.eventMode.isOpen() && document.getElementById('setEvent').textContent.includes('イベントの 日だけ') && !document.getElementById('setEventScan').hidden`));
  check("ちがう QR では ひらかない", await ev(`BCT.eventMode.openWith('https://example.com/index.html?event=wrong')===false && !BCT.eventMode.isOpen()`));
  await ev(`BCT.ui.show('home');true`);
  // 受付の QR（アプリの URL?event=あいことば）で ひらく
  await b.goto(BASE + "index.html?event=" + encodeURIComponent(await ev(`BCT.CONFIG.event.openKey`)));
  check("受付の QR で ひらくと きょうは イベントの 日・URL から あいことばを けす", await ev(`BCT.eventMode.source()==='qr' && location.search===''`));
  check("受付の QR の URL は アプリの index.html?event=あいことば", await ev(`BCT.eventMode.receptionUrl('https://ts178.github.io/CLEAN_QUEST/operator.html')==='https://ts178.github.io/CLEAN_QUEST/index.html?event='+encodeURIComponent(BCT.CONFIG.event.openKey)`));

  // ---------- 4. ミニゲームの ごほうび：おそうじたいの ぼうし（もと そうじミッション） ----------
  // ミニゲームの けっか（★1 → メダル 20）を 入れて、ミッションに もどった ときに わたす
  await ev(`BCT.store.transact(s=>{s.claims[BCT.CONFIG.event.id+':plabusters:e2e-run1']={xp:0,coins:20,t:Date.now()}});true`);
  await ev(`BCT.ui.show('mission');true`);
  check("ミニゲームを ★1いじょうで クリア → おそうじたいの ぼうし（達成報酬）", await waitFor(`document.getElementById('modal').classList.contains('show') && document.getElementById('modalBox').textContent.includes('おそうじたいの ぼうし')`, 4000) &&
    (await modalText()).includes("ゴミシュートか プラごみバスターズ"));
  await shot("08-reward-hat");
  await clickModal("つける");
  await drain();
  check("ぼうしを つけた", await st(`s.equip.head==='reward_clean_hat'`));
  check("はじめのいっぽ賞（クイズ 1もん せいかいで もらった）", await st(`s.badges.some(b=>b.id==='first')`));
  check("とくべつな ごほうびの もらいかたは ミニゲーム", await ev(`BCT.ui.current()==='mission' && /ゴミシュートか プラごみバスターズを ★1いじょうで クリア/.test(document.getElementById('missionBody').textContent)`));
  check("ポイントは 40（クイズ 1もん＋ゲーム）", await st(`g.coins(s)===40`), String(await st(`g.coins(s)`)));
  await ev(`BCT.ui.show('home');true`);

  // ---------- 5. 成長（見た目が かわる しんか・複数レベルを 一気に） ----------
  for (const q of ["q02", "q03"]) {
    await ev(`BCT.ui.show('mission');BCT.mission.openQuiz('${q}')`);
    await ev(`(()=>{const q=BCT.QUIZ.find(x=>x.id==='${q}');document.querySelector('.choice[data-idx="'+q.a+'"]').click()})()`);
    await sleep(300);
  }
  check("クイズだけでは そだたない", await st(`g.xp(s)===0 && g.level(s)===1`));
  await ev(`BCT.mission.renderList(); document.getElementById('msReview').click()`);
  await sleep(200);
  check("▶ で つぎの クリアした もんだいへ、◀ で もどる", await ev(`(()=>{const r=()=>document.querySelector('#modalBox #qReview');const pos=()=>r().querySelector('.qr-pos').textContent.replace(/\\s+/g,'');
    const a=pos();r().querySelector('[data-qr="1"]').click();const b=pos();const q2=r().textContent.includes(BCT.QUIZ[1].q);r().querySelector('[data-qr="-1"]').click();const c=pos();
    return a==='クリアしたもんだい1/3'&&b==='クリアしたもんだい2/3'&&q2&&c===a})()`));
  await clickModal("とじる");
  // けいけんちは エサで ふえる（ここでは 演出の 確認のため 直接 あたえる。エサの 確認は tests/e2e/beach.mjs）
  await ev(`BCT.game.claim('quiz','zz-e2e-lv2',{xp:60,coins:0}); void BCT.afterGain(); true`);
  await waitFor(`document.getElementById('evo').classList.contains('show')`);
  check("Lv2 は みじかい おいわい", await ev(`document.getElementById('evo').classList.contains('quick')`));
  await waitFor(`document.getElementById('evo').classList.contains('done')`);
  await shot("07-levelup-quick");
  await ev(`document.getElementById('evoOk').click()`);
  await drain();
  await ev(`BCT.game.claim('quiz','zz-e2e-lv3',{xp:90,coins:0}); void BCT.afterGain(); true`);
  check("150で Lv3（見た目 段階2）", await st(`g.level(s)===3 && g.stage(s)===2`));
  await waitFor(`document.getElementById('evo').dataset.phase==='1'`, 3000);
  check("しんか ① うかんで 回る", await ev(`document.getElementById('evo').dataset.phase==='1'`));
  await shot("09-evo-1");
  await waitFor(`document.getElementById('evo').dataset.phase==='2'`, 4000);
  check("しんか ② はやく 回る", await ev(`document.getElementById('evo').dataset.phase==='2'`));
  await waitFor(`document.getElementById('evo').classList.contains('done')`, 5000);
  check("しんか ③ 新しい すがた（着せ替え そのまま）", (await ev(`document.getElementById('evoMsg').textContent`)).includes("せいちょう") &&
    (await ev(`!!document.querySelector('#evoPet svg[data-stage="2"] [data-item="reward_clean_hat"]')`)));
  await shot("10-evo-done");
  await ev(`document.getElementById('evoOk').click()`);
  await drain();
  // けいけんち 150 → 450 を 一気に（Lv3 → Lv5）
  await ev(`BCT.game.claim('quiz','zz-e2e-jump',{xp:300,coins:0}); void BCT.afterGain(); true`);
  await waitFor(`document.getElementById('evo').classList.contains('done')`, 9000);
  check("Lv3→Lv5 を 1回の しんかで", (await ev(`document.getElementById('evoMsg').textContent`)).includes("Lv5") && (await st(`s.seenLv===5`)));
  await shot("11-evo-lv5");
  await ev(`document.getElementById('evoOk').click()`);
  await waitFor(`document.getElementById('modal').classList.contains('show')`);
  check("Lv5 で まもりて メダル", (await modalText()).includes("まもりて メダル"));
  await drain(["あとで", "やったね"]);

  // ---------- 6. ショップ ----------
  // ポイント: クイズ3もん(60)＋ミニゲーム(20)＝80
  check("ポイントは 80", await st(`g.coins(s)===80`), String(await st(`g.coins(s)`)));
  await ev(`BCT.ui.show('shop','head')`);
  await sleep(300);
  await shot("12-shop");
  await ev(`document.querySelector('[data-item=head_crown]').click()`);
  await sleep(300);
  check("たりないと かえない（理由を 表示）", (await modalText()).includes("たりない") && (await ev(`[...document.querySelectorAll('#modalBox button')].find(b=>b.textContent.includes('かう')).disabled`)));
  await shot("13-shop-short");
  await clickModal("とじる");
  await ev(`document.querySelector('[data-item=head_flower]').click()`);
  await sleep(300);
  check("買うまえに 見本（じぶんの ようせい＋はなかざり）", await ev(`!!document.querySelector('#modalBox .detail-prev [data-item="head_flower"]')`));
  await clickModal("かう");
  await sleep(300);
  check("買うと ポイントが1回だけ へる（はなかざり 50枚）", await st(`g.coins(s)===30 && s.owned.head_flower.via==='shop'`));
  await clickModal("あとで");
  await ev(`BCT.ui.show('shop','look')`);
  await sleep(200);
  check("専用みためは ウミガメ用だけ", await ev(`[...document.querySelectorAll('#shopBody [data-item]')].every(e=>e.dataset.item.startsWith('turtle_'))`));
  await ev(`BCT.game.claim('quiz','zz-e2e-coins',{xp:0,coins:120}); BCT.ui.refreshHeader(); BCT.ui.show('shop','toy')`);
  await sleep(200);
  check("おもちゃは 150枚（値段は 2〜3ばい）", await ev(`document.querySelector('[data-item=toy_ball] .pr').textContent.includes('150')`));
  await ev(`document.querySelector('[data-item=toy_ball]').click()`);
  await sleep(200);
  await clickModal("かう");
  await sleep(300);
  check("おもちゃを 買った", await st(`g.coins(s)===0 && g.owns(s,'toy_ball')`));
  await drain(["あとで", "とじる"]);
  await ev(`BCT.ui.show('shop','head')`);
  await sleep(200);
  await ev(`document.querySelector('#shopBody [data-item]:not(.have)').click()`);
  await sleep(200);
  check("メダルが たりない ときは「あと ○ たりないよ。」で 改行・中央ぞろえ（いまの 枚数は 出さない）", await ev(`(()=>{const m=document.getElementById('modalBox');const n=m.querySelector('.short-note');
    return !!n&&n.innerHTML.includes('たりないよ。<br>')&&getComputedStyle(n).textAlign==='center'&&!m.textContent.includes('いま')})()`));
  await clickModal("とじる");

  // ---------- 7. きせかえ ----------
  await ev(`BCT.ui.show('dress',{slot:'head',equip:'head_flower'})`);
  await sleep(400);
  check("はなかざりに つけかえ", await st(`s.equip.head==='head_flower'`) && (await ev(`!!document.querySelector('#dressPreview [data-item="head_flower"]')`)));
  await shot("14-dress");

  // ---------- 8. おもちゃ（とちゅうで やめたら かぞえない・3回で ポーズ） ----------
  async function playOnce(interrupt) {
    await ev(`BCT.ui.show('home')`);
    await sleep(1600);
    await ev(`void BCT.home.playLegacy()`);
    await sleep(300);
    await ev(`document.querySelector('#modalBox [data-toy=toy_ball]').click()`);
    if (interrupt) {
      await sleep(600);
      await ev(`BCT.ui.show('mission')`);
      await sleep(2600);
      return;
    }
    await sleep(1200);
    await shot("15-play");
    await sleep(1800);
  }
  await playOnce(true);
  check("とちゅうで やめたら かぞえない", await st(`g.toyPlays(s,'toy_ball')===0`));
  await playOnce(false);
  await playOnce(false);
  check("2回では まだ ポーズなし", await st(`!g.poses(s).includes('toy_ball')`));
  await playOnce(false);
  await sleep(300);
  check("3回で ポーズを おぼえる", await st(`g.poses(s).includes('toy_ball')`) && (await modalText()).includes("あたらしい ポーズ"));
  await shot("16-pose-unlocked");
  await drain();

  // ---------- 9. さつえい（仮のカメラ） ----------
  await ev(`BCT.game.claim('quiz','zz-e2e-coins',{xp:0,coins:40}); BCT.game.buy('frame_rainbow'); BCT.game.equip('frame','frame_rainbow')`);
  await ev(`BCT.ui.show('photo')`);
  await sleep(400);
  await ev(`document.getElementById('phCam').click()`);
  const camOk = await waitFor(`BCT.photo.state.source==='camera' && document.getElementById('phVideo').videoWidth>0`, 8000);
  check("カメラ（ボタンを 押してから 起動）", camOk);
  check("おぼえた ポーズだけ 選べる", await ev(`!document.querySelector('[data-pose=toy_ball]').disabled && document.querySelector('[data-pose=toy_bubbles]').disabled`));
  await ev(`document.querySelector('[data-pose=toy_ball]').click()`);
  // ドラッグで うごかす
  const r0 = await ev(`(()=>{const r=document.getElementById('phPet').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);
  const x0 = await ev(`BCT.photo.state.place.x`);
  await b.send("Input.dispatchMouseEvent", { type: "mousePressed", x: r0.x, y: r0.y, button: "left", clickCount: 1 });
  await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: r0.x - 60, y: r0.y - 40, button: "left" });
  await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: r0.x - 60, y: r0.y - 40, button: "left", clickCount: 1 });
  check("ドラッグで うごく", (await ev(`BCT.photo.state.place.x`)) < x0);
  await sleep(500);
  await shot("17-photo-camera");
  await ev(`window.__track = document.getElementById('phVideo').srcObject.getVideoTracks()[0]`);
  await ev(`document.getElementById('phShutter').click()`);
  await waitFor(`!document.getElementById('phResult').hidden`);
  check("シャッターで 1まいに（1080×1440）", await waitFor(`document.getElementById('phResultImg').naturalWidth===1080 && document.getElementById('phResultImg').naturalHeight===1440`));
  await shot("18-photo-result");
  await ev(`document.getElementById('phBack').click()`);
  await sleep(300);
  check("画面を はなれたら カメラ停止", await ev(`window.__track.readyState==='ended' && !document.getElementById('phVideo').srcObject`));

  // ---------- 10. 見え方と 保存画像が 一致する（しゃしんを えらぶ で 比べる。「うみの はいけい」は なくした） ----------
  const pickPhoto = async () => {
    const doc = await b.send("DOM.getDocument");
    const { nodeId } = await b.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: "#phFile" });
    await b.send("DOM.setFileInputFiles", { nodeId, files: [path.join(DIR, "..", "..", "assets", "ui", "beach.webp")] });
  };
  await ev(`BCT.ui.show('photo')`);
  await sleep(300);
  check("さつえい：「うみの はいけい」は ない（カメラ・しゃしんを えらぶ だけ）", await ev(`!document.getElementById('phSea') && !document.getElementById('phSource').textContent.includes('うみの はいけい') && !!document.getElementById('phCam') && !!document.getElementById('phPick')`));
  await pickPhoto();
  await sleep(1000);
  await ev(`Object.assign(BCT.photo.place,{x:0.3,y:0.55,size:0.5}); document.getElementById('phSize').dispatchEvent(new Event('input'))`);
  await ev(`(()=>{const p=BCT.photo.place;const e=document.getElementById('phPet');e.style.left=p.x*100+'%';e.style.top=p.y*100+'%';e.style.width=p.size*100+'%'})()`);
  await sleep(500);
  const rect = await ev(`(()=>{const r=document.getElementById('phStage').getBoundingClientRect();return {x:r.left,y:r.top+window.scrollY,width:r.width,height:r.height}})()`);
  const cap = await b.send("Page.captureScreenshot", { format: "png", clip: Object.assign({ scale: 1 }, rect) });
  const diff = await ev(`(async()=>{
    // 細かな絵を異なる解像度から縮めるため、点の拾い方による差を抑えて比較する。
    const small=(src)=>{const c=document.createElement('canvas');c.width=90;c.height=120;const g=c.getContext('2d');g.imageSmoothingQuality='high';g.drawImage(src,0,0,90,120);return g.getImageData(0,0,90,120).data};
    const img=new Image();img.src='data:image/png;base64,${cap.data}';await img.decode();
    const a=small(img), bb=small(await BCT.photo.compose());
    let d=0;for(let i=0;i<a.length;i+=4){d+=Math.abs(a[i]-bb[i])+Math.abs(a[i+1]-bb[i+1])+Math.abs(a[i+2]-bb[i+2])}
    // ずらした場合（くらべるための めやす）
    const keep=BCT.photo.place.x;BCT.photo.place.x=0.75;const cc=small(await BCT.photo.compose());BCT.photo.place.x=keep;
    let d2=0;for(let i=0;i<a.length;i+=4){d2+=Math.abs(a[i]-cc[i])+Math.abs(a[i+1]-cc[i+1])+Math.abs(a[i+2]-cc[i+2])}
    return {same:d/(90*120*3), moved:d2/(90*120*3)}})()`);
  check("プレビューと 保存画像が 一致（ようせい・フレーム・文字の位置）", diff.same < 10 && diff.moved > diff.same * 2, JSON.stringify(diff));
  await shot("19-photo-picked");

  // ---------- 11. カメラが つかえないとき ----------
  await ev(`navigator.mediaDevices.getUserMedia=()=>Promise.reject(new DOMException('no','NotAllowedError'))`);
  await ev(`BCT.ui.show('home');BCT.ui.show('photo')`);
  await sleep(300);
  await ev(`document.getElementById('phCam').click()`);
  await sleep(500);
  check("カメラ拒否 → 理由と かわりの方法", await ev(`document.getElementById('phMsg').textContent.includes('きょか') && !document.getElementById('phSource').hidden`));
  check("カメラの きょかが ない → きょかの しかたの おしらせ", await waitFor(`document.getElementById('modal').classList.contains('show') && document.getElementById('modalBox').textContent.includes('カメラを つかわせてね') && !!document.querySelector('#modalBox .perm-steps')`, 3000));
  await clickModal("もういちど ためす");
  await sleep(300);
  check("もういちど ためしても だめなら また おしらせ（きょかが 出るまで）", await waitFor(`document.getElementById('modal').classList.contains('show') && document.getElementById('modalBox').textContent.includes('カメラを つかわせてね')`, 3000));
  await clickModal("あとで");
  await sleep(300);
  await shot("20-photo-denied");
  check("カメラが つかえない ときの 案内は「しゃしんを えらぶ」だけ", await ev(`document.getElementById('phMsg').textContent.includes('しゃしんを えらぶ') && !document.getElementById('phMsg').textContent.includes('うみの はいけい')`));
  await pickPhoto();
  await sleep(1000);
  await ev(`document.getElementById('phShutter').click()`);
  check("拒否しても えらんだ しゃしんで 記念画像", await waitFor(`!document.getElementById('phResult').hidden && document.getElementById('phResultImg').naturalWidth===1080`));
  await ev(`BCT.ui.show('home')`);

  // ---------- 11b. 設定（はぐるま）・管理者モード・ようせい画面・しょうごう・ショップの ならび ----------
  await ev(`BCT.ui.show('home')`);
  await sleep(200);
  check("ヘッダーに Lv は 出さない・メダルは はぐるまと おなじ くらいの 高さ", await ev(`(()=>{const lv=document.getElementById('tbLv');const c=document.getElementById('tbCoin').getBoundingClientRect(),g=document.getElementById('tbGear').getBoundingClientRect();
    return (!lv||getComputedStyle(lv).display==='none')&&c.height<=g.height+6})()`));
  check("ホームの 池は 波の 動画（絵と おなじ 位置・タップは うけない）", await waitFor(`BCT.pondVideo.playing() && document.getElementById('pondVideo').videoWidth===1200`, 8000) &&
    (await ev(`(()=>{const v=document.getElementById('pondVideo'),c=getComputedStyle(v),p=getComputedStyle(document.getElementById('pond'));return c.objectFit==='cover'&&c.objectPosition==='50% 50%'&&p.backgroundSize==='cover'&&p.backgroundPosition==='50% 50%'&&c.pointerEvents==='none'&&v.muted&&v.loop})()`)));
  await ev(`BCT.ui.show('shop');true`);
  await sleep(300);
  check("ホームから はなれると 動画を 止める", await ev(`document.getElementById('pondVideo').paused`));
  await ev(`BCT.ui.show('home');true`);
  await sleep(300);
  check("ホームの いちばん したに とくべつ しょうごう（上の段に なまえと 数、下の段に 4つの 絵。Codex 2026-10-16・2026-10-20 に 4つ）", await ev(`(()=>{const e=document.getElementById('homeBadges');const r=e.getBoundingClientRect(),bar=document.querySelector('#scr-home .beach-bar').getBoundingClientRect();
    const l=e.querySelector('.hbg-lbl').getBoundingClientRect(),c=e.querySelector('.hbg-count').getBoundingClientRect(),m=[...e.querySelectorAll('.hbg-medal')].map(x=>x.getBoundingClientRect());
    return m.length===4&&e.textContent.includes('とくべつ しょうごう')&&Math.abs(l.top-c.top)<4&&m.every(x=>x.top>l.bottom-1&&Math.abs(x.top-m[0].top)<2)&&r.top>=bar.bottom&&e.scrollWidth<=e.clientWidth+1&&document.scrollingElement.scrollHeight<=innerHeight+1})()`));
  check("ホームに「ごはん」と いう ことばは ない（ドロップ）", await ev(`!document.getElementById('scr-home').textContent.includes('ごはん') && document.getElementById('foodTray').textContent.includes('ドロップ')`));
  check("ヤドカリの 帽子は 目の 上（はな・かいがらの かざりは かいがらの 上の まま）", await ev(`[1,2,3].every(st=>{const f=BCT.art.anchorFor,A=BCT.art.ANCHOR.hermit[st].head,h=f('hermit',st,'head','head_straw'),fl=f('hermit',st,'head','head_flower'),sh=f('hermit',st,'head','head_shell');
    const svg=BCT.art.render({type:'hermit',stage:st,equip:{head:'head_straw'}});return fl===A&&sh===A&&h!==A&&h.x>A.x+40&&svg.includes('translate('+h.x+' '+h.y+')')})`));
  check("こもの は 段階が かわっても 首（あごの した）：イルカ・ウミガメ は 顔の 近く", await ev(`['dolphin','turtle'].every(t=>[1,2,3].every(st=>{const a=BCT.art.ANCHOR[t][st].acc;return a.x>110&&a.y<126}))`));
  check("下の タブの ようせい・すみか の 丸い 絵は おなじ 大きさ", await ev(`(()=>{const c=[...document.querySelectorAll('.tabs .tab-portrait')].map(e=>{const r=e.getBoundingClientRect();return Math.round(r.width)+'x'+Math.round(r.height)});return c.length===2&&c[0]===c[1]})()`));
  check("ホームの 下に あそぶ・きせかえ・さつえい は ない（ようせい画面へ）", await ev(`!document.querySelector('#scr-home #actPlay') && !!document.querySelector('#scr-me .me-actions #actPlay') && !!document.querySelector('#scr-me .me-actions [data-go=dress]') && !!document.querySelector('#scr-me .me-actions [data-go=photo]')`));
  await ev(`document.getElementById('actFairy').click()`);
  await sleep(300);
  check("「ようせい」タブ → ようせい画面", await ev(`BCT.ui.current()==='me'`));
  check("ようせい画面：名前の したに あそぶ・きせかえ・さつえい、その したに レベル", await ev(`(()=>{const n=document.querySelector('#meTop .fairy-card').getBoundingClientRect(),a=document.querySelector('#scr-me .me-actions').getBoundingClientRect(),l=document.querySelector('#meBody .me-progress').getBoundingClientRect();return n.bottom<=a.top+1&&a.bottom<=l.top+1})()`));
  check("ようせい画面：メダル・けいけんち・あげた ごはん の 数は 出さない", await ev(`(()=>{const t=document.querySelector('#meBody .me-mini').textContent;return !/メダル|けいけんち|ごはん/.test(t)})()`));
  check("ようせい画面：みつけた ゴミ・きろくした ゴミ・そうじミッション は ない（「ひろう」を なくした）", await ev(`!document.querySelector('#meBody .found4') && !/みつけた ゴミ|きろくした ゴミ|そうじミッション/.test(document.getElementById('meBody').textContent)`));
  check("すべての メニューの 左上に「← ホーム」（すみかの も おなじ 大きさ）", await ev(`(()=>{const ids=['scr-mission','scr-shop','scr-me','scr-dress','scr-habitat'];const bs=ids.map(id=>document.querySelector('#'+id+' .home-back'));if(bs.some(b=>!b))return false;
    BCT.ui.show('habitat');const h=bs[4].getBoundingClientRect();BCT.ui.show('me');const m=bs[2].getBoundingClientRect();return Math.abs(h.width-m.width)<1&&Math.abs(h.height-m.height)<1})()`));
  await ev(`BCT.ui.show('home')`);
  await ev(`document.getElementById('tbGear').click()`);
  await sleep(300);
  check("右上の はぐるま → 設定（おうちの かたへ）", await ev(`BCT.ui.current()==='settings' && !!document.getElementById('setReduce') && !!document.getElementById('setAbout') && !!document.getElementById('setReset')`));
  const saved = await ev(`localStorage.getItem('bct-state')`);
  for (let i = 0; i < 7; i++) await ev(`document.getElementById('setVer').click()`);
  await sleep(200);
  check("バージョンを 7かい タップ → 管理者モードの 確認", await ev(`document.getElementById('modal').classList.contains('show') && document.getElementById('modalBox').textContent.includes('管理者モード')`));
  await clickModal("入る");
  await sleep(600);
  await ev(`(()=>{document.querySelector('#adminBody [data-type=hermit]').click();document.querySelector('#adminBody [data-stage="3"]').click();
    document.querySelector('#adminBody [data-view=front]').click();document.querySelector('#adminBody [data-eq=head][data-id=head_crown]').click();return true})()`);
  await sleep(300);
  check("管理者モード：ヤドカリの 段階3 に かんむりを つけて 見られる", await ev(`(()=>{const v=document.querySelector('#admFace svg[data-pet]');return !!v&&v.dataset.pet==='hermit'&&v.dataset.stage==='3'&&!!v.querySelector('[data-item=head_crown]')})()`));
  check("管理者モードでは ほぞんデータが かわらない", (await ev(`localStorage.getItem('bct-state')`)) === saved);
  await shot("21a-admin");
  await ev(`document.getElementById('admQr').click();true`);
  check("管理者モード：イベント しゅうりょう QR を 見られる（イベントの 日 いがいでも）", await waitFor(`document.getElementById('modal').classList.contains('show') && !!document.querySelector('#qrWrap canvas') && document.getElementById('modalBox').textContent.includes('うんえいの ひと')`, 3000));
  await ev(`(()=>{const b=[...document.querySelectorAll('#modalBox button')].pop();b&&b.click();return true})()`);
  await sleep(300);
  await ev(`BCT.ui.show('me')`);
  await sleep(300);
  check("ようせい画面：すすみぐあいは 線（ゲージ）。しょうごう・おうちの かたへ は ない", await ev(`document.querySelectorAll('#meBody .pbar .progress').length>=4 && !document.querySelector('#meBody .badges') && !document.querySelector('#meBody .parent')`));
  await shot("21b-yousei");
  await ev(`BCT.ui.show('mission')`);
  await sleep(300);
  check("イベントの 日は イベント しゅうりょう QR を 出す（うみクイズの うえ）", await ev(`(()=>{const q=document.getElementById('msQr'),c=document.getElementById('msNext')||document.getElementById('msReview');return BCT.eventMode.isOpen()&&!!q&&q.getBoundingClientRect().bottom<=c.closest('.card').getBoundingClientRect().top+1})()`));
  check("イベント しゅうりょう QR の ボタンは クイズの ボタンと ちがう いろ", await ev(`(()=>{const q=getComputedStyle(document.getElementById('msQr')).backgroundColor,c=getComputedStyle(document.getElementById('msNext')||document.querySelector('#missionBody .btn.peach')).backgroundColor;return q!==c&&q==='rgb(45, 111, 143)'})()`));
  check("しょうごうの なまえは 1行・おなじ 大きさ", await ev(`(()=>{const n=[...document.querySelectorAll('#missionBody .badge-name')];const hs=new Set(n.map(e=>Math.round(e.getBoundingClientRect().height)));const fs=new Set(n.map(e=>getComputedStyle(e).fontSize));return n.length===BCT.BADGES.length&&hs.size===1&&fs.size===1&&n.every(e=>e.scrollWidth<=e.parentElement.clientWidth+1)})()`));
  check("しょうごうは ミッションの いちばん した・3れつ", await ev(`(()=>{const c=document.querySelector('#missionBody .badges-card');return !!c&&c===document.getElementById('missionBody').lastElementChild&&getComputedStyle(c.querySelector('.badges3')).gridTemplateColumns.split(' ').length===3})()`));
  await ev(`document.querySelector('#missionBody [data-badge]:not(.locked)').click()`);
  await sleep(200);
  check("もらった しょうごうを タップすると 大きく 見られる", await ev(`(()=>{const m=document.querySelector('#modalBox .badge-big .painted-medal');return !!m&&m.getBoundingClientRect().width>=150})()`));
  await clickModal("とじる");
  check("とくべつな ごほうびの「クイズ・ゲーム」は 2行", await ev(`[...document.querySelectorAll('#missionBody .mlist .st')].some(e=>e.innerHTML.includes('<br>')&&e.textContent.includes('クイズ')&&e.textContent.includes('ゲーム'))`));
  await ev(`BCT.ui.show('shop','all')`);
  await sleep(300);
  check("ショップ：カテゴリは「すべて」つきで 8つ・1行", await ev(`(()=>{const c=[...document.querySelectorAll('#shopBody [data-cat]')];const t=new Set(c.map(e=>Math.round(e.getBoundingClientRect().top)));return c.length===8&&c[0].dataset.cat==='all'&&t.size===1})()`));
  check("ショップ：英語の かざり・見出し・メダルの 説明文は ない", await ev(`(()=>{const b=document.getElementById('shopBody');return !/SEASIDE/i.test(b.textContent)&&!b.querySelector('h2')&&!b.textContent.includes('ビーチの おそうじ や')})()`));
  check("ショップ：メダルの 表示は ひくめ", await ev(`document.querySelector('#shopBody .medal-wallet').getBoundingClientRect().height<=100`), String(await ev(`Math.round(document.querySelector('#shopBody .medal-wallet').getBoundingClientRect().height)`)));
  check("ショップ：アイテムは 3れつ", await ev(`getComputedStyle(document.querySelector('#shopBody .shop-grid')).gridTemplateColumns.split(' ').length===3`));
  check("ショップ：長い なまえは 区切りの ところで おりかえす（「シェルター｜クッション」）", await ev(`(()=>{const e=[...document.querySelectorAll('#shopBody [data-item] .nm')].find(n=>n.textContent.includes('シェルター'));if(!e)return true;
    const r=document.createRange();const t=e.firstChild;const i=t.textContent.indexOf('クッション');r.setStart(t,i);r.setEnd(t,i+5);return r.getClientRects().length===1})()`));
  check("ショップ：すべて には ごはん も ほかの アイテム も ならぶ", await ev(`!!document.querySelector('#shopBody [data-food-item]') && !!document.querySelector('#shopBody [data-item]')`));
  check("ショップ：「← ホーム」の よこに メダル（よこに ちぢめる）", await ev(`(()=>{const h=document.querySelector('#shopBody .home-back').getBoundingClientRect(),w=document.querySelector('#shopBody .medal-wallet').getBoundingClientRect();return w.left>h.right&&w.top<h.bottom&&w.bottom>h.top&&w.height<=80})()`));
  await ev(`window.scrollTo(0,700);true`);
  await sleep(300);
  check("ショップ：すべて の ときは スクロールしても ← ホーム・メダル・カテゴリが 上に のこる", await ev(`(()=>{const tb=document.querySelector('.topbar').getBoundingClientRect().bottom;const st=document.querySelector('#shopBody .shop-sticky').getBoundingClientRect();const c=document.querySelector('#shopBody [data-cat=all]').getBoundingClientRect();return scrollY>300&&Math.abs(st.top-tb)<=2&&c.top>=tb&&c.bottom<=st.bottom})()`));
  await shot("21d-shop-sticky");
  await ev(`window.scrollTo(0,0);true`);
  // きせかえ・さつえいは スクロール なし（いちばん アイテムの おおい あたま）
  await ev(`BCT.ui.show('dress',{slot:'head'})`);
  await sleep(400);
  check("きせかえ：アイテムは 3れつ・英語の 見出し なし・スクロール なし", await ev(`getComputedStyle(document.querySelector('#dressBody .shop-grid')).gridTemplateColumns.split(' ').length===3 && !/YOUR LITTLE/i.test(document.getElementById('scr-dress').textContent) && document.scrollingElement.scrollHeight<=innerHeight+1`));
  await ev(`BCT.ui.show('photo')`);
  await sleep(800);
  check("いっしょに さつえい：スクロール なし", await ev(`document.scrollingElement.scrollHeight<=innerHeight+1`));
  // もどる：ブラウザ・スマホの「もどる」と はしからの スワイプ
  await ev(`BCT.ui.show('home');BCT.ui.show('shop');true`);
  await sleep(300);
  await ev(`history.back();true`);
  check("スマホの「もどる」で ひとつ まえの 画面へ", await waitFor(`BCT.ui.current()==='home'`, 2000));
  await ev(`BCT.ui.show('mission');true`);
  await sleep(300);
  const swipe = (x0, x1) => ev(`(()=>{const mk=(x)=>new Touch({identifier:1,target:document.body,clientX:x,clientY:400});const t0=mk(${x0}),t1=mk(${x1});document.body.dispatchEvent(new TouchEvent('touchstart',{touches:[t0],changedTouches:[t0],bubbles:true}));document.body.dispatchEvent(new TouchEvent('touchmove',{touches:[t1],changedTouches:[t1],bubbles:true}));document.body.dispatchEvent(new TouchEvent('touchend',{touches:[],changedTouches:[t1],bubbles:true}));return true})()`);
  await swipe(4, 150);
  check("左の はしから スワイプで ひとつ まえの 画面へ", await waitFor(`BCT.ui.current()==='home'`, 2000));
  await ev(`BCT.ui.show('me');true`);
  await sleep(300);
  await swipe(408, 250);
  check("右の はしから スワイプでも もどる", await waitFor(`BCT.ui.current()==='home'`, 2000));
  await ev(`BCT.ui.show('shop');true`);
  await sleep(300);
  await swipe(200, 360);
  check("まんなかからの スワイプでは もどらない", await ev(`BCT.ui.current()==='shop'`));
  await shot("21c-shop");

  // ---------- 12. 再読み込み・外部通信 ----------
  await ev(`BCT.ui.show('home');true`);
  const before = await st(`JSON.stringify({o:s.owned,e:s.equip,c:s.claims,a:s.affection,t:s.toys})`);
  await b.goto(BASE + "index.html");
  check("再読み込みしても 育成・購入・装着が のこる", (await st(`JSON.stringify({o:s.owned,e:s.equip,c:s.claims,a:s.affection,t:s.toys})`)) === before && (await ev(`BCT.ui.current()==='home'`)));
  await shot("21-home-after-reload");
  const ext = [...new Set(reqs.map((u) => new URL(u)).filter((u) => /^https?:$/.test(u.protocol) && u.origin !== new URL(BASE).origin).map((u) => u.hostname))];
  check("外への通信は ない（地図も つかわない。写真・映像は 送らない）", ext.length === 0, JSON.stringify(ext));

  // ---------- 13. 運営画面（v2・順位なし） ----------
  const qr = await ev(`JSON.stringify(BCT.profile.payload())`);
  check("QRに 位置情報・ゴミの きろく なし。ミニゲームの さいこう てん あり", !/lat|lng|"rc"|"tr"|"cm"/.test(qr) && /"sh":\d+/.test(qr) && /"pbs":\d+/.test(qr), qr);
  await b.send("Emulation.setDeviceMetricsOverride", { width: 1200, height: 900, deviceScaleFactor: 1, mobile: false });
  await b.goto(BASE + "operator.html");
  check("運営: 受付用 QR（アプリの URL?event=あいことば）", await ev(`!!document.querySelector('#recvQr svg') && document.getElementById('recvUrl').textContent===BCT.eventMode.receptionUrl(location.href) && document.getElementById('recvUrl').textContent.includes('index.html?event=')`));
  check("運営: 受付用 QR は 読みとれる（jsQR）", await ev(`(async()=>{const svg=document.querySelector('#recvQr svg');const xml=new XMLSerializer().serializeToString(svg);const im=new Image();im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(xml);await im.decode();
    const c=document.createElement('canvas');c.width=c.height=400;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,400,400);g.drawImage(im,0,0,400,400);const code=jsQR(g.getImageData(0,0,400,400).data,400,400);
    return !!code&&code.data===document.getElementById('recvUrl').textContent})()`));
  check("運営: v2 を 読める", await ev(`BCT.operator.add(${JSON.stringify(qr)})`));
  check("運営: 古い版 v1 は 案内つきで ことわる", await ev(`BCT.operator.add('{"v":1,"app":"bct","id":"x"}')===false && document.getElementById('last').textContent.includes('版')`));
  check("運営: 順位の 列が ない", await ev(`!document.getElementById('tbl').textContent.includes('順位') && ![...document.querySelectorAll('#sort option')].some(o=>/Pt|ゴミの数|正解/.test(o.textContent))`));
  check("運営: CSV に けいけんち・ミニゲーム（ゴミの数・そうじミッションは ない）", await ev(`(()=>{const h=BCT.operator.buildCsv().split('\\r\\n')[0];return h.includes('けいけんち')&&h.includes('ゴミシュート最高点')&&h.includes('バスターズ最高点')&&!h.includes('そうじミッション')&&!h.includes('ゴミの数')})()`));
  check("運営: 表に ゴミの しゅるいの 列・種類別の グラフは ない", await ev(`!document.getElementById('bars') && !/ペットボトル|ゴミ<\\/th>/.test(document.getElementById('tbl').innerHTML) && document.getElementById('tbl').textContent.includes('バスターズ')`));
  check("運営: 古い QR（ゴミの きろく つき）も 読める", await ev(`BCT.operator.add(JSON.stringify(Object.assign(JSON.parse(${JSON.stringify(qr)}),{id:'old-device',rc:3,tr:{pet:2},cm:1})))`));
  await shot("22-operator");
} catch (e) {
  results.push("EXCEPTION " + e.stack);
} finally {
  const errs = b.consoleLogs.filter((l) => /^(error|EXCEPTION)/.test(l));
  check("コンソールに エラーなし", errs.length === 0, errs.join(" | "));
  const ng = results.filter((r) => !r.startsWith("OK")).length;
  console.log(`\n${results.length - ng} / ${results.length} OK   （スクリーンショット: ${OUT}）`);
  b.close();
  process.exitCode = ng ? 1 : 0;
}
