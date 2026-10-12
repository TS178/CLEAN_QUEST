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
  check("「たんけんたいメダル を あつめよう！」の 高さが そろう", await ev(`(()=>{const l=document.querySelector('.mission-lead .medal-label').getBoundingClientRect(),t=document.querySelector('.mission-lead .medal-line > span').getBoundingClientRect();return Math.abs((l.top+l.height/2)-(t.top+t.height/2))<=2})()`));
  check("あぶない ものの 注意は「はりが ついている もの」", await ev(`document.getElementById('missionBody').textContent.includes('はりが ついている もの')`));
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

  // ---------- 4. そうじミッション（しゅるいごとに 1回・びんは 対象外） ----------
  async function record(type, withPhoto) {
    await ev(`BCT.ui.show('capture')`);
    await sleep(500);
    if (withPhoto) {
      const doc = await b.send("DOM.getDocument");
      const { nodeId } = await b.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: "#shotInput" });
      await b.send("DOM.setFileInputFiles", { nodeId, files: [path.join(DIR, "..", "..", "icons", "icon-512.png")] });
    }
    await ev(`document.querySelector('.type-btn[data-type=${type}]').click()`);
    await waitFor(`!document.getElementById('recBtn').disabled`);
    await ev(`document.getElementById('recBtn').click()`);
    await waitFor(`document.getElementById('modal').classList.contains('show')`);
    return modalText();
  }
  let t = await record("pet", true);
  check("ペットボトル はじめて → ミッションクリア（ポイント）", t.includes("ミッション クリア") && (await st(`g.xp(s)===0 && g.coins(s)===40`)));
  check("位置と写真も 記録", await st(`s.records[0].lat===37.0441 && s.records[0].photo===true`));
  await shot("06-clean-clear");
  await clickModal("もっと");
  await waitFor(`document.getElementById('modal').classList.contains('show')`);
  check("おそうじたいの ぼうし（達成報酬）", (await modalText()).includes("おそうじたいの ぼうし"));
  await shot("08-reward-hat");
  await clickModal("つける");
  await drain();
  check("ぼうしを つけた", await st(`s.equip.head==='reward_clean_hat'`));
  t = await record("pet", false);
  check("同じ しゅるいの 2回目は ごほうび なし", t.includes("クリアずみ") && (await st(`g.coins(s)===40 && s.records.length===2`)));
  await clickModal("もっと");
  await drain();
  t = await record("bin", false);
  check("びんは ごほうび なし（記録は のこる）", t.includes("ごほうびは ないよ") && (await st(`g.coins(s)===40 && s.records.length===3`)));
  await clickModal("ホームへ");
  await drain();

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
  // ポイント: クイズ3もん(60)＋そうじ1(20)＝80
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
  check("買うと ポイントが1回だけ へる", await st(`g.coins(s)===60 && s.owned.head_flower.via==='shop'`));
  await clickModal("あとで");
  await ev(`BCT.ui.show('shop','look')`);
  await sleep(200);
  check("専用みためは ウミガメ用だけ", await ev(`[...document.querySelectorAll('#shopBody [data-item]')].every(e=>e.dataset.item.startsWith('turtle_'))`));
  await ev(`BCT.ui.show('shop','toy')`);
  await sleep(200);
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

  // ---------- 10. 見え方と 保存画像が 一致する（うみの はいけい で 比べる） ----------
  await ev(`BCT.ui.show('photo')`);
  await sleep(300);
  await ev(`document.getElementById('phSea').click()`);
  await sleep(800);
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
  await shot("19-photo-sea");

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
  await ev(`document.getElementById('phSea').click()`);
  await sleep(600);
  await ev(`document.getElementById('phShutter').click()`);
  check("拒否しても うみの はいけいで 記念画像", await waitFor(`!document.getElementById('phResult').hidden && document.getElementById('phResultImg').naturalWidth===1080`));
  await ev(`BCT.ui.show('home')`);

  // ---------- 11b. 設定（はぐるま）・管理者モード・ようせい画面・しょうごう・ショップの ならび ----------
  await ev(`BCT.ui.show('home')`);
  await sleep(200);
  check("ヘッダーに Lv は 出さない・メダルは はぐるまと おなじ くらいの 高さ", await ev(`(()=>{const lv=document.getElementById('tbLv');const c=document.getElementById('tbCoin').getBoundingClientRect(),g=document.getElementById('tbGear').getBoundingClientRect();
    return (!lv||getComputedStyle(lv).display==='none')&&c.height<=g.height+6})()`));
  check("池の 丸い ボタン「ようせい」「すみか」は おなじ 大きさ", await ev(`(()=>{const c=[...document.querySelectorAll('.pond-shortcut .shortcut-circle')].map(e=>{const r=e.getBoundingClientRect();return Math.round(r.width)+'x'+Math.round(r.height)});return c.length===2&&c[0]===c[1]})()`));
  check("ホームの 下に あそぶ・きせかえ・さつえい は ない（ようせい画面へ）", await ev(`!document.querySelector('#scr-home #actPlay') && !!document.querySelector('#scr-me .me-actions #actPlay') && !!document.querySelector('#scr-me .me-actions [data-go=dress]') && !!document.querySelector('#scr-me .me-actions [data-go=photo]')`));
  await ev(`document.getElementById('actFairy').click()`);
  await sleep(300);
  check("池の「ようせい」ボタン → ようせい画面", await ev(`BCT.ui.current()==='me'`));
  check("ようせい画面：名前の したに あそぶ・きせかえ・さつえい、その したに レベル", await ev(`(()=>{const n=document.querySelector('#meTop .fairy-card').getBoundingClientRect(),a=document.querySelector('#scr-me .me-actions').getBoundingClientRect(),l=document.querySelector('#meBody .me-progress').getBoundingClientRect();return n.bottom<=a.top+1&&a.bottom<=l.top+1})()`));
  check("ようせい画面：メダル・けいけんち・あげた ごはん の 数は 出さない", await ev(`(()=>{const t=document.querySelector('#meBody .me-mini').textContent;return !/メダル|けいけんち|ごはん/.test(t)})()`));
  check("ようせい画面：みつけた ゴミの なまえは 1行・おなじ 大きさ", await ev(`(()=>{const n=[...document.querySelectorAll('#meBody .found-name')];const hs=new Set(n.map(e=>Math.round(e.getBoundingClientRect().height)));const fs=new Set(n.map(e=>getComputedStyle(e).fontSize));return n.length>=8&&hs.size===1&&fs.size===1&&n.every(e=>e.scrollWidth<=e.parentElement.clientWidth+1)})()`));
  check("すべての メニューの 左上に「← ホーム」（すみかの も おなじ 大きさ）", await ev(`(()=>{const ids=['scr-mission','scr-capture','scr-shop','scr-me','scr-dress','scr-habitat'];const bs=ids.map(id=>document.querySelector('#'+id+' .home-back'));if(bs.some(b=>!b))return false;
    BCT.ui.show('habitat');const h=bs[5].getBoundingClientRect();BCT.ui.show('me');const m=bs[3].getBoundingClientRect();return Math.abs(h.width-m.width)<1&&Math.abs(h.height-m.height)<1})()`));
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
  await ev(`BCT.ui.show('me')`);
  await sleep(300);
  check("ようせい画面：すすみぐあいは 線（ゲージ）。しょうごう・おうちの かたへ は ない", await ev(`document.querySelectorAll('#meBody .pbar .progress').length>=5 && !document.querySelector('#meBody .badges') && !document.querySelector('#meBody .parent')`));
  check("ようせい画面：みつけた ゴミは 4れつ", await ev(`getComputedStyle(document.querySelector('#meBody .found4')).gridTemplateColumns.split(' ').length===4`));
  await shot("21b-yousei");
  await ev(`BCT.ui.show('mission')`);
  await sleep(300);
  check("イベント しゅうりょう QR は ミッションの うみクイズの うえ", await ev(`(()=>{const q=document.getElementById('msQr'),c=document.getElementById('msNext')||document.getElementById('msReview');return !!q&&q.getBoundingClientRect().bottom<=c.closest('.card').getBoundingClientRect().top+1})()`));
  check("しょうごうの なまえは 1行・おなじ 大きさ", await ev(`(()=>{const n=[...document.querySelectorAll('#missionBody .badge-name')];const hs=new Set(n.map(e=>Math.round(e.getBoundingClientRect().height)));const fs=new Set(n.map(e=>getComputedStyle(e).fontSize));return n.length===7&&hs.size===1&&fs.size===1&&n.every(e=>e.scrollWidth<=e.parentElement.clientWidth+1)})()`));
  check("しょうごうは ミッションの いちばん した・3れつ", await ev(`(()=>{const c=document.querySelector('#missionBody .badges-card');return !!c&&c===document.getElementById('missionBody').lastElementChild&&getComputedStyle(c.querySelector('.badges3')).gridTemplateColumns.split(' ').length===3})()`));
  await ev(`document.querySelector('#missionBody [data-badge]:not(.locked)').click()`);
  await sleep(200);
  check("もらった しょうごうを タップすると 大きく 見られる", await ev(`(()=>{const m=document.querySelector('#modalBox .badge-big .painted-medal');return !!m&&m.getBoundingClientRect().width>=150})()`));
  await clickModal("とじる");
  check("とくべつな ごほうびの「クイズ・そうじ」は 2行", await ev(`[...document.querySelectorAll('#missionBody .mlist .st')].some(e=>e.innerHTML.includes('<br>')&&e.textContent.includes('クイズ')&&e.textContent.includes('そうじ'))`));
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
  await ev(`BCT.ui.show('capture');true`);
  await sleep(300);
  await swipe(408, 250);
  check("右の はしから スワイプでも もどる", await waitFor(`BCT.ui.current()==='home'`, 2000));
  await ev(`BCT.ui.show('shop');true`);
  await sleep(300);
  await swipe(200, 360);
  check("まんなかからの スワイプでは もどらない", await ev(`BCT.ui.current()==='shop'`));
  await shot("21c-shop");

  // ---------- 12. ちず・再読み込み・外部通信 ----------
  await ev(`BCT.ui.show('capture','map')`);
  await sleep(3500);
  check("ちずに ピン", await ev(`BCT.mapDebug().pins>=1`));
  check("ちずは いつも 志賀町の あたりから（縮尺 10）", await ev(`(()=>{const m=BCT.mapDebug().map,c=m.getCenter();return m.getZoom()===10&&Math.abs(c.lat-37.01)<0.01&&Math.abs(c.lng-136.77)<0.01})()`));
  check("ひろう：「← ホーム」の よこに「クリーンマップ」", await ev(`(()=>{const h=document.querySelector('#scr-capture .home-back').getBoundingClientRect(),t=document.getElementById('capTitle');const r=t.getBoundingClientRect();return t.textContent==='クリーンマップ'&&r.left>h.right&&Math.abs((r.top+r.height/2)-(h.top+h.height/2))<=6&&!document.querySelector('#scr-capture h2')})()`));
  await ev(`document.querySelector('#scr-capture [data-sub=rec]').click();true`);
  await sleep(200);
  check("ひろう：きろく する では「ゴミを みつけたら きろくしよう」", await ev(`document.getElementById('capTitle').textContent==='ゴミを みつけたら きろくしよう'`));
  await ev(`document.querySelector('#scr-capture [data-sub=map]').click();true`);
  await sleep(300);
  const before = await st(`JSON.stringify({o:s.owned,e:s.equip,c:s.claims,a:s.affection,t:s.toys})`);
  await b.goto(BASE + "index.html");
  check("再読み込みしても 育成・購入・装着が のこる", (await st(`JSON.stringify({o:s.owned,e:s.equip,c:s.claims,a:s.affection,t:s.toys})`)) === before && (await ev(`BCT.ui.current()==='home'`)));
  await shot("21-home-after-reload");
  const ext = [...new Set(reqs.map((u) => new URL(u)).filter((u) => /^https?:$/.test(u.protocol) && u.origin !== new URL(BASE).origin).map((u) => u.hostname))];
  check("外への通信は 地図タイルだけ（写真・映像は 送らない）", ext.every((h) => h === "tile.openstreetmap.org"), JSON.stringify(ext));

  // ---------- 13. 運営画面（v2・順位なし） ----------
  const qr = await ev(`JSON.stringify(BCT.profile.payload())`);
  check("QRに 位置情報なし", !/lat|lng/.test(qr));
  await b.send("Emulation.setDeviceMetricsOverride", { width: 1200, height: 900, deviceScaleFactor: 1, mobile: false });
  await b.goto(BASE + "operator.html");
  check("運営: v2 を 読める", await ev(`BCT.operator.add(${JSON.stringify(qr)})`));
  check("運営: 古い版 v1 は 案内つきで ことわる", await ev(`BCT.operator.add('{"v":1,"app":"bct","id":"x"}')===false && document.getElementById('last').textContent.includes('版')`));
  check("運営: 順位の 列が ない", await ev(`!document.getElementById('tbl').textContent.includes('順位') && ![...document.querySelectorAll('#sort option')].some(o=>/Pt|ゴミの数|正解/.test(o.textContent))`));
  check("運営: CSV に けいけんち・そうじミッション", (await ev(`BCT.operator.buildCsv().split('\\r\\n')[0]`)).includes("そうじミッション"));
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
