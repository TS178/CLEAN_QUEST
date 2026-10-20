// 更新の おしらせ（新しい 版 → こうしん する）と バックアップ・ふくげん の 通し確認（headless Edge）
// アプリを 一時フォルダへ 写して 専用の サーバーで 配り、とちゅうで service-worker.js の 版を 書きかえて 新しい 版を つくる。
//   node tests/e2e/update-backup.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "./cdp.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, "../..");
const OUT = path.join(HERE, "out");
fs.mkdirSync(OUT, { recursive: true });
const PORT = 8000 + Math.floor(Math.random() * 900) + 50;
const CDP = 9300 + Math.floor(Math.random() * 500);
const BASE = `http://127.0.0.1:${PORT}/`;

// アプリを 写す
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "bct-update-"));
for (const f of ["index.html", "operator.html", "manifest.json", "service-worker.js", "css", "js", "assets", "vendor", "icons"]) {
  fs.cpSync(path.join(APP, f), path.join(TMP, f), { recursive: true });
}
const swPath = path.join(TMP, "service-worker.js");
const NOW = /const APP_VERSION = "([^"]+)"/.exec(fs.readFileSync(swPath, "utf8"))[1];
const NEXT = "9.99";
const server = spawn("python", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1", "--directory", TMP], { stdio: "ignore" });

const results = [];
const check = (name, ok, info = "") => { results.push(ok); console.log(`${ok ? "OK" : "NG"}  ${name}${info ? "  " + info : ""}`); };
async function waitFor(expr, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { if (await ev(expr)) return true; } catch (e) { /* 読みこみ中 */ }
    await sleep(200);
  }
  return false;
}
const DL = path.join(TMP, "_downloads");
fs.mkdirSync(DL);

const b = await launch({ port: CDP, width: 390, height: 844 });
const ev = b.ev;
const modalText = () => ev(`document.getElementById('modal').classList.contains('show') ? document.getElementById('modalBox').textContent : ''`);
const clickModal = (text) => ev(`(()=>{const el=[...document.querySelectorAll('#modalBox button')].find(e=>e.textContent.includes(${JSON.stringify(text)}));if(!el)return false;el.click();return true})()`);

try {
  for (let i = 0; i < 40; i++) { try { await (await fetch(BASE + "index.html")).text(); break; } catch (e) { await sleep(150); } }
  await b.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: DL }).catch(() => b.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: DL }));

  // ---------- 1. ホーム画面に 追加した ときの なまえ・アイコン ----------
  const man = JSON.parse(fs.readFileSync(path.join(TMP, "manifest.json"), "utf8"));
  check("ホーム画面の なまえは「クリーンクエスト」（manifest と iPhone）", man.name === "クリーンクエスト" && man.short_name === "クリーンクエスト" &&
    /apple-mobile-web-app-title" content="クリーンクエスト"/.test(fs.readFileSync(path.join(TMP, "index.html"), "utf8")));
  check("アイコン（192・512・maskable）と ファビコンが そろう", man.icons.some((i) => i.sizes === "192x192") && man.icons.some((i) => i.purpose === "maskable") &&
    ["favicon-16.png", "favicon-32.png", "apple-touch-icon.png", "icon-192.png", "icon-512.png", "icon-maskable-512.png"].every((f) => fs.existsSync(path.join(TMP, "icons", f))));

  // ---------- 2. はじめて ひらく → Service Worker が 入る（おしらせは 出ない） ----------
  await b.goto(BASE + "index.html");
  await ev(`localStorage.clear(); BCT.game.choosePet('turtle','テスト','テストたい',2); BCT.game.claim('quiz','zz',{xp:120,coins:70}); true`);
  await b.goto(BASE + "index.html");
  check("はじめての ときは 更新の おしらせを 出さない", await waitFor(`!!navigator.serviceWorker.controller`, 10000) && !(await modalText()).includes("あたらしい バージョン"));
  await ev(`document.getElementById('tbGear').click(); true`);
  await sleep(500);
  check(`設定の バージョンは「1.○○」の 形（${NOW}）`, await waitFor(`document.getElementById('setVer').textContent==='バージョン ${NOW}'`, 4000) && /^\d+\.\d+$/.test(NOW),
    await ev(`document.getElementById('setVer').textContent`));
  check("設定に バックアップの ほぞん・もどす", await ev(`!!document.getElementById('setBackup') && !!document.getElementById('setRestore') && document.getElementById('setUpdate').hidden`));
  await b.shot(path.join(OUT, "ub01-settings.png"));

  // ---------- 3. 新しい 版を 出す → おしらせ ----------
  fs.writeFileSync(swPath, fs.readFileSync(swPath, "utf8").replace(`const APP_VERSION = "${NOW}"`, `const APP_VERSION = "${NEXT}"`));
  await ev(`BCT.ui.show('home'); BCT.update.check(); true`);
  check("新しい 版が とどくと「あたらしい バージョンが あります」", await waitFor(`document.getElementById('modal').classList.contains('show') && document.getElementById('modalBox').textContent.includes('あたらしい バージョンが あります')`, 15000));
  check("おしらせに 新しい 版の 番号", (await modalText()).includes(`バージョン ${NEXT}`));
  await b.shot(path.join(OUT, "ub02-update.png"));
  check("「こうしん する」まで かってに ひらきなおさない（まだ いまの 版）", await ev(`BCT.update.version()`) === NOW);
  await clickModal("あとで");
  await sleep(300);
  await ev(`document.getElementById('tbGear').click(); true`);
  await sleep(400);
  check("「あとで」なら 設定に「こうしん する」ボタン", await ev(`!document.getElementById('setUpdate').hidden`));
  await ev(`window.__beforeReload = 1; document.getElementById('setUpdateGo').click(); true`);
  check("「こうしん する」→ ひらきなおして 新しい 版", await waitFor(`!window.__beforeReload && !!window.BCT && !!BCT.update && document.readyState==='complete' && !!BCT.backup`, 15000) &&
    (await waitFor(`BCT.update.version().then(v=>v===${JSON.stringify(NEXT)})`, 8000)));
  check("こうしん しても そだてた データは そのまま", await ev(`(()=>{const s=BCT.store.get();return s.pet.name==='テスト'&&BCT.game.coins(s)===70})()`));

  // ---------- 4. バックアップ ----------
  await ev(`(async()=>{const c=document.createElement('canvas');c.width=c.height=40;const g=c.getContext('2d');g.fillStyle='#e33';g.fillRect(0,0,40,40);
    const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',0.8));
    BCT.store.update(s=>{s.records.push({id:'rec1',t:Date.now(),type:'bottle',lat:null,lng:null,acc:null,photo:true});});
    await BCT.store.putPhoto('rec1',blob);return true})()`);
  const p = await ev(`BCT.backup.build()`);
  check("バックアップに 育成・記録・写真・チェックサム", p.format === "bct-backup" && p.state.pet.name === "テスト" && p.state.records.length === 1 &&
    /^data:image\/jpeg;base64,/.test(p.photos.rec1 || "") && /^[0-9a-f]{8}$/.test(p.checksum) && p.appVersion === NEXT);
  check("中身が 正しければ 問題なし", (await ev(`BCT.backup.validate(${JSON.stringify(p)})`)) === null);
  const bad = JSON.parse(JSON.stringify(p));
  bad.state.team.name = "かいざん";
  check("書きかえた ファイルは「こわれている かも」", ((await ev(`BCT.backup.validate(${JSON.stringify(bad)})`)) || "").includes("こわれている"));
  check("ほかの ファイルは ことわる", ((await ev(`BCT.backup.validate({format:'shika-gacha-backup',formatVersion:1,state:{}})`)) || "").includes("ありません"));
  // ほぞん（ダウンロード）
  // ひらきなおした あとの しんかの 演出が おわって ホームに もどる ことが あるので、設定が 出るまで まつ
  for (let i = 0; i < 3 && !(await ev(`BCT.ui.current()==='settings' && !!document.getElementById('setBackup')`)); i++) {
    await ev(`document.getElementById('tbGear').click(); true`);
    await sleep(800);
  }
  await ev(`document.getElementById('setBackup').click(); true`);
  let file = null;
  for (let i = 0; i < 40 && !file; i++) { await sleep(200); file = fs.readdirSync(DL).find((f) => /^clean-quest-backup-\d{8}\.json$/.test(f)); }
  check("「バックアップを ほぞん」で ファイルが できる", !!file, file || "");
  const saved = file ? JSON.parse(fs.readFileSync(path.join(DL, file), "utf8")) : null;

  // ---------- 5. ふくげん ----------
  await ev(`BCT.store.reset().then(()=>true)`);
  await b.goto(BASE + "index.html");
  check("さいしょから に した（たまご）", await ev(`!BCT.store.get().pet`));
  await ev(`window.__restore = BCT.backup.restoreFile(new File([${JSON.stringify(JSON.stringify(saved))}], 'b.json', {type:'application/json'})); true`);
  check("もどす まえに 中身を 見せて たしかめる", await waitFor(`document.getElementById('modalBox').textContent.includes('バックアップから もどしますか') && document.getElementById('modalBox').textContent.includes('テスト（Lv')`, 3000));
  await b.shot(path.join(OUT, "ub03-restore.png"));
  await clickModal("もどす");
  await sleep(300);
  check("もういちど たしかめる", (await modalText()).includes("ほんとうに もどしますか"));
  await ev(`window.__beforeReload = 1; true`);
  await clickModal("もどす");
  check("もどすと ひらきなおして もとの ようせい・メダル・記録", await waitFor(`!window.__beforeReload && !!window.BCT && document.readyState==='complete' && !!BCT.backup && !!BCT.store.get().pet`, 10000) &&
    (await ev(`(()=>{const s=BCT.store.get();return s.pet.name==='テスト'&&s.team.name==='テストたい'&&BCT.game.coins(s)===70&&s.records.length===1})()`)));
  check("写真も もどる", await ev(`BCT.store.getPhoto('rec1').then(b=>!!b&&b.size>100)`));
  check("「バックアップから もどしました」", await waitFor(`!!document.querySelector('body > .toast') && document.querySelector('body > .toast').textContent.includes('もどしました')`, 4000));
  // こわれた ファイル
  await ev(`window.__r = BCT.backup.restoreFile(new File(['{"format":"bct-backup"'], 'x.json')); true`);
  check("よめない ファイルは 理由を 出して なにも かえない", await waitFor(`document.getElementById('modalBox').textContent.includes('よみとれませんでした')`, 3000) &&
    (await ev(`BCT.store.get().pet.name==='テスト'`)));
  await clickModal("とじる");

  const errs = b.consoleLogs.filter((l) => /EXCEPTION|error/i.test(l));
  check("コンソールに エラーなし", errs.length === 0, errs.join(" | "));
} finally {
  b.close();
  try { execSync(`taskkill /T /F /PID ${server.pid}`, { stdio: "ignore" }); } catch (e) { server.kill(); }
  setTimeout(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* のこっても よい */ } }, 500);
}
const ok = results.filter(Boolean).length;
console.log(`\n${ok} / ${results.length} OK`);
process.exitCode = ok === results.length ? 0 : 1;
