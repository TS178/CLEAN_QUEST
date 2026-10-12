// AR で なでる・あそぶ の 通し確認（headless Edge ＋ 仮のカメラ ＋ 仮の傾きセンサー）
//   python -m http.server 8000 → node tests/e2e/ar.mjs   （BCT_URL / CDP_PORT / OUT で変更可）
// 「ゆかに おく AR（WebXR）」は この環境では うごかせないので、ボタンの出しわけと 呼び出しの設定だけ 確かめる。
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

const b = await launch({
  port: PORT,
  args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const reqs = [];
await b.send("Network.enable");
b.on((d) => { if (d.method === "Network.requestWillBeSent") reqs.push(d.params.request.url); });
const ev = b.ev;
const st = (expr) => ev(`(()=>{const s=BCT.store.get(),g=BCT.game;return ${expr}})()`);
const dbg = () => ev(`BCT.ar.debug()`);
const shot = (n) => b.shot(path.join(OUT, n + ".png"));
const orient = (alpha, beta, gamma = 0) => b.send("DeviceOrientation.setDeviceOrientationOverride", { alpha, beta, gamma });
async function waitFor(expr, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await ev(expr)) return true;
    await sleep(120);
  }
  return false;
}
// ようせいの 画面上の 位置（CSS px）
async function petXY() {
  return ev(`(()=>{const p=BCT.ar.debug().screen;const r=document.getElementById('scr-ar').getBoundingClientRect();
    return {x:(p.x+1)/2*r.width+r.left, y:(1-p.y)/2*r.height+r.top, r:p.radius}})()`);
}
async function mouse(type, x, y) {
  await b.send("Input.dispatchMouseEvent", { type, x, y, button: "left", buttons: type === "mouseReleased" ? 0 : 1, clickCount: 1 });
}
async function tapAt(x, y) { await mouse("mousePressed", x, y); await mouse("mouseReleased", x, y); }
async function drag(x0, y0, x1, y1, steps = 8) {
  await mouse("mousePressed", x0, y0);
  for (let i = 1; i <= steps; i++) await mouse("mouseMoved", x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps);
  await mouse("mouseReleased", x1, y1);
}
async function toyXY(id) {
  return ev(`(()=>{const r=document.querySelector('#arTray [data-toy=${id}]').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);
}
async function startAR(intent) {
  await ev(`BCT.ui.show('home')`);
  await sleep(300);
  await ev(`document.getElementById('actPlay').click()`); // ホームの ボタンは「あそぶ」だけ（なでる・おもちゃ りょうほう）
  await waitFor(`!document.getElementById('arCam').disabled`);
  await ev(`document.getElementById('arCam').click()`);
  return waitFor(`BCT.ar.debug().placed`, 8000);
}

try {
  await b.goto(BASE + "index.html");
  await ev("localStorage.clear()");
  await b.goto(BASE + "index.html");
  await ev(`document.querySelector('.egg[data-type=turtle]').click()`);
  await sleep(300);
  await ev(`[...document.querySelectorAll('#modalBox button')].pop().click()`);
  await sleep(300);
  await ev(`document.getElementById('nameForm').requestSubmit()`);
  await sleep(3000);
  await ev(`document.getElementById('hatchGo').click()`);
  await sleep(400);
  await orient(0, 70);

  // ---------- 1. ホームの「あそぶ」→ AR（安全の やくそく → カメラで AR） ----------
  check("ホームの ボタンは「あそぶ」だけ（なでる は ない）", await ev(`!document.getElementById('actPet') && document.getElementById('actPlay').textContent.includes('あそぶ')`));
  await ev(`document.getElementById('actPlay').click()`);
  await sleep(500);
  check("あそぶ → AR画面（安全の やくそく）", await ev(`BCT.ui.current()==='ar' && !document.getElementById('arStart').hidden && document.querySelector('.ar-safety').textContent.includes('あるきながら')`));
  check("AR では なでなで も おもちゃ も できると 案内", await ev(`/なでなで/.test(document.getElementById('arIntent').textContent) && /おもちゃ/.test(document.getElementById('arIntent').textContent)`));
  check("WebXR が ない端末では『ゆかに おく AR』を 出さない", await ev(`document.getElementById('arXr').hidden`));
  await shot("ar01-start");
  await waitFor(`!document.getElementById('arCam').disabled`);
  await ev(`document.getElementById('arCam').click()`);
  check("カメラで AR → ジャイロ式で ようせいを 前に おく", await waitFor(`BCT.ar.debug().placed && BCT.ar.debug().mode==='gyro'`), JSON.stringify(await dbg()));
  await sleep(600);
  await shot("ar02-gyro");

  // ---------- 2. スマホを まわすと ようせいは その場に とどまる ----------
  const x0 = (await dbg()).screen.x;
  await orient(12, 70);
  await sleep(700);
  const x1 = (await dbg()).screen.x;
  await orient(348, 70);
  await sleep(700);
  const x2 = (await dbg()).screen.x;
  check("左に まわすと 右に、右に まわすと 左に 見える（その場に とどまる）", x1 > x0 + 0.3 && x2 < x0 - 0.3, `${x0.toFixed(2)} / ${x1.toFixed(2)} / ${x2.toFixed(2)}`);
  await orient(0, 50);
  await sleep(700);
  const y1 = (await dbg()).screen.y;
  await orient(0, 80);
  await sleep(700);
  const y2 = (await dbg()).screen.y;
  check("下を むくと 上に、上を むくと 下に 見える", y2 < y1, `${y1.toFixed(2)} / ${y2.toFixed(2)}`);
  await orient(0, 70);
  await sleep(700);

  // ---------- 3. なでる（タップ・連打・こする・はずれ） ----------
  let p = await petXY();
  await tapAt(p.x, p.y);
  await tapAt(p.x, p.y);
  await tapAt(p.x, p.y);
  await sleep(300);
  check("ようせいを タップで なでる（連打は 1かい）", await st(`s.affection===1`), String(await st(`s.affection`)));
  await shot("ar03-pet");
  await sleep(1500);
  await tapAt(30, 450);
  await sleep(300);
  check("ようせい いがいを タップしても かぞえない", await st(`s.affection===1`));
  p = await petXY();
  await drag(p.x - 50, p.y, p.x + 50, p.y + 10, 10);
  await sleep(300);
  check("ゆびで こすると なでる", await st(`s.affection===2`), String(await st(`s.affection`)));
  await sleep(1500);
  check("なでても けいけんち・コインは 出ない", await st(`g.xp(s)===0 && g.coins(s)===0`));

  // ---------- 4. おもちゃ ----------
  await ev(`window.__track1 = document.getElementById('arVideo').srcObject.getVideoTracks()[0]`);
  await ev(`BCT.ui.show('home')`);
  check("AR を とじると カメラ停止", await ev(`!BCT.ar.debug().camera && !document.getElementById('arVideo').srcObject && window.__track1.readyState==='ended'`));
  // Edge の「仮のカメラ」は 一度とめると 消えることがある（アプリと 関係なく 起きる。2026-10-11 確認）。
  // 2回目からは テストの中で つくった 映像を カメラの かわりに わたす（アプリの 処理は そのまま）
  await ev(`navigator.mediaDevices.getUserMedia = async () => {
    const c = document.createElement('canvas'); c.width = 640; c.height = 480;
    const g = c.getContext('2d'); let n = 0;
    setInterval(() => { g.fillStyle = n++ % 2 ? '#7fb8c8' : '#86c0cf'; g.fillRect(0, 0, 640, 480); g.fillStyle = '#e9d8a6'; g.fillRect(0, 300, 640, 180); }, 100);
    return c.captureStream(15);
  }; true`);
  await ev(`BCT.game.claim('quiz','zz-ar-coins',{xp:0,coins:180}); ['toy_ball','toy_bubbles','toy_music'].forEach(id=>BCT.game.buy(id))`);
  const started = await startAR("play");
  check("あそぶ → AR（おもちゃが ならぶ）", started && (await ev(`document.querySelectorAll('#arTray [data-toy]').length===3`)),
    JSON.stringify({ started, dbg: await dbg(), owned: await st(`Object.keys(s.owned)`), tray: await ev(`document.getElementById('arTray').textContent.trim()`), msg: await ev(`document.getElementById('arStartMsg').textContent + ' / start hidden=' + document.getElementById('arStart').hidden + ' / cam disabled=' + document.getElementById('arCam').disabled`) }));
  await sleep(500);
  let t = await toyXY("toy_ball");
  await tapAt(t.x, t.y);
  await sleep(350);
  check("ボールを タップで なげる（とんでいる）", (await dbg()).parts >= 1 && (await dbg()).busy);
  await shot("ar04-ball-flying");
  await sleep(1200);
  await shot("ar05-ball-caught");
  await waitFor(`!BCT.ar.debug().busy`, 5000);
  check("ボール 1かい（演出が おわってから かぞえる）", await st(`g.toyPlays(s,'toy_ball')===1`));
  // よこに はじく → はずれて おいかける
  const before = (await dbg()).petPos;
  t = await toyXY("toy_ball");
  await drag(t.x, t.y, t.x + 260, t.y - 220, 6);
  await sleep(1300);
  const after = (await dbg()).petPos;
  check("よこに はじくと はずれて ようせいが おいかける", Math.hypot(after[0] - before[0], after[2] - before[2]) > 0.2, JSON.stringify([before, after]));
  await waitFor(`!BCT.ar.debug().busy`, 6000);
  check("おいかけても 1かいに かぞえる", await st(`g.toyPlays(s,'toy_ball')===2`));
  const back = (await dbg()).petPos;
  check("おいかけたあと もとの 場所に もどる", Math.hypot(back[0] - before[0], back[2] - before[2]) < 0.05, JSON.stringify(back));
  // とちゅうで やめると かぞえない
  t = await toyXY("toy_bubbles");
  await tapAt(t.x, t.y);
  await sleep(400);
  await shot("ar06-bubbles");
  await ev(`document.getElementById('arBack').click()`);
  await sleep(2600);
  check("とちゅうで やめたら かぞえない", await st(`g.toyPlays(s,'toy_bubbles')===0`));
  check("AR を とじて ホームへ", await ev(`BCT.ui.current()==='home'`));
  // 3かいめで ポーズ
  await startAR("play");
  await sleep(500);
  t = await toyXY("toy_music");
  await tapAt(t.x, t.y);
  await sleep(1200);
  await shot("ar07-music");
  await waitFor(`!BCT.ar.debug().busy`, 5000);
  check("おんがくで あそぶ", await st(`g.toyPlays(s,'toy_music')===1`));
  t = await toyXY("toy_ball");
  await tapAt(t.x, t.y);
  await waitFor(`!document.getElementById('arNotice').hidden`, 6000);
  check("ボール 3かいで ポーズを おぼえる（AR画面の中に おしらせ）", await st(`g.poses(s).includes('toy_ball')`) &&
    (await ev(`document.getElementById('arNotice').textContent.includes('あたらしい ポーズ')`)));
  await shot("ar08-pose");
  await ev(`document.querySelector('[data-ar-close]').click()`);
  check("ほかの おもちゃを 演出中に おしても 1かいずつ", await (async () => {
    const t2 = await toyXY("toy_bubbles");
    await tapAt(t2.x, t2.y);
    await sleep(100);
    await tapAt(t2.x, t2.y);
    await waitFor(`!BCT.ar.debug().busy`, 5000);
    await sleep(300);
    return st(`g.toyPlays(s,'toy_bubbles')===1`);
  })());

  // ---------- 5. ここに よぶ ----------
  await orient(90, 70);
  await sleep(700);
  await ev(`document.getElementById('arRecall').click()`);
  await sleep(400);
  const rp = (await dbg()).petPos;
  check("ここに よぶ → いま 見ている方向（左）に おく", rp[0] < -1 && Math.abs(rp[2]) < 0.3, JSON.stringify(rp));
  await orient(0, 70);
  await ev(`document.getElementById('arBack').click()`);
  await sleep(300);

  // ---------- 6. 傾きが とれない端末：画面に 固定 ----------
  await b.send("DeviceOrientation.clearDeviceOrientationOverride").catch(() => {});
  await ev(`window.__noOrient = (e)=>e.stopImmediatePropagation(); window.addEventListener('deviceorientation', window.__noOrient, true)`);
  check("傾きが とれなくても AR（画面に 固定）", (await startAR("pet")) && (await dbg()).mode === "static");
  await shot("ar09-static");
  await ev(`document.getElementById('arBack').click()`);
  await ev(`window.removeEventListener('deviceorientation', window.__noOrient, true)`);

  // ---------- 7. ゆかに おく AR（WebXR）：ボタンの 出しわけ と 呼び出しの 設定 ----------
  await ev(`window.__xrOpts=null; Object.defineProperty(navigator,'xr',{configurable:true,value:{
    isSessionSupported: async (m)=>m==='immersive-ar',
    requestSession: async (m,o)=>{ window.__xrOpts={m,req:o.requiredFeatures,opt:o.optionalFeatures,root:o.domOverlay&&o.domOverlay.root&&o.domOverlay.root.id}; throw new DOMException('test','NotSupportedError'); } }})`);
  await ev(`BCT.ui.show('home'); document.getElementById('actPlay').click()`);
  await sleep(600);
  check("WebXR 対応端末では『ゆかに おく AR』を 出す", await ev(`!document.getElementById('arXr').hidden`));
  await waitFor(`!document.getElementById('arXr').disabled`);
  await ev(`document.getElementById('arXr').click()`);
  await sleep(500);
  const xo = await ev(`window.__xrOpts`);
  check("immersive-ar ＋ hit-test ＋ dom-overlay（AR画面を 重ねる）で たのむ",
    xo && xo.m === "immersive-ar" && xo.req.includes("hit-test") && xo.opt.includes("dom-overlay") && xo.root === "scr-ar", JSON.stringify(xo));
  check("はじめられなかったら 理由と ほかの方法", await ev(`!document.getElementById('arStartMsg').hidden && document.getElementById('arStartMsg').textContent.includes('カメラで AR')`));
  await shot("ar10-xr-button");
  await ev(`document.getElementById('arStartBack').click()`);

  // ---------- 8. カメラが つかえない → いつもの あそびかた ----------
  await ev(`navigator.mediaDevices.getUserMedia=()=>Promise.reject(new DOMException('no','NotAllowedError'))`);
  await ev(`BCT.ui.show('home'); document.getElementById('actPlay').click()`);
  await waitFor(`!document.getElementById('arCam').disabled`);
  await ev(`document.getElementById('arCam').click()`);
  await sleep(500);
  check("カメラ拒否 → 理由と『カメラを つかわない』", await ev(`document.getElementById('arStartMsg').textContent.includes('きょか')`));
  check("カメラの きょかが ない → きょかの しかたの おしらせ", await waitFor(`document.getElementById('modal').classList.contains('show') && !!document.querySelector('#modalBox .perm-steps')`, 3000));
  await shot("ar11-denied");
  await ev(`[...document.querySelectorAll('#modalBox button')].find(b=>b.textContent.includes('あとで')).click()`);
  await sleep(300);
  await ev(`document.getElementById('arNoCam').click()`);
  await sleep(400);
  check("カメラを つかわない → ホームで いつもの あそびかた（おもちゃを えらぶ）", (await ev(`BCT.ui.current()==='home'`)) &&
    (await ev(`document.getElementById('modal').classList.contains('show') && /あそぶ|おもちゃ/.test(document.getElementById('modalBox').textContent)`)));
  await ev(`(()=>{const c=document.querySelector('#modalBox [data-close]')||[...document.querySelectorAll('#modalBox button')].pop();c&&c.click();return true})()`);

  // ---------- 9. 通信 ----------
  const ext = [...new Set(reqs.map((u) => new URL(u)).filter((u) => /^https?:$/.test(u.protocol) && u.origin !== new URL(BASE).origin).map((u) => u.hostname))];
  check("外への通信なし（カメラ映像は 送らない）", ext.length === 0, JSON.stringify(ext));
} catch (e) {
  results.push("EXCEPTION " + e.stack);
  console.log("EXCEPTION " + e.stack);
} finally {
  console.log(b.consoleLogs.filter((l) => l.startsWith("warning")).join("\n"));
  const errs = b.consoleLogs.filter((l) => /^(error|EXCEPTION)/.test(l));
  check("コンソールに エラーなし", errs.length === 0, errs.join(" | "));
  const ng = results.filter((r) => !r.startsWith("OK")).length;
  console.log(`\n${results.length - ng} / ${results.length} OK   （スクリーンショット: ${OUT}）`);
  b.close();
  process.exitCode = ng ? 1 : 0;
}
