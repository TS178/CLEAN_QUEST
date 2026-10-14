// iPhone で おきた 不具合の 再発を ふせぐ 確認（headless Edge に iPhone の UA を 名のらせる）
//   - 2026-10-13：ショップの「みため」に 大きな ようせいが はみ出した（pet-motion.js の foreignObject を iPhone の WebKit が ずらして 描く）
//     → iPhone・Safari では 正面の絵の「いきづかい」を つかわない（js/pet-art-fix.js）
//   - せまい スマホ（320・360px）で ショップの 上の 固定部分が はみ出して、よこに スクロールしていた
//   python -m http.server 8000 ＋ node tests/e2e/iphone.mjs
//   ※ 本物の WebKit での 通し確認は、開発用に Playwright の WebKit を つかった（アプリには ふくめない。README の テストの 節）
import { launch, sleep } from "./cdp.mjs";

const BASE = process.env.BCT_URL || "http://127.0.0.1:8000/";
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const results = [];
const check = (name, ok, info = "") => { results.push(ok); console.log(`${ok ? "OK" : "NG"}  ${name}${info ? "  " + info : ""}`); };

const b = await launch({ port: 9400 + Math.floor(Math.random() * 400), width: 390, height: 844 });
const ev = b.ev;
try {
  await b.send("Emulation.setUserAgentOverride", { userAgent: UA, platform: "iPhone" });
  await b.goto(BASE + "index.html");
  await ev(`localStorage.clear(); BCT.game.choosePet('turtle','かめさん','たい',1); BCT.game.claim('quiz','zz',{xp:0,coins:15}); true`);
  await b.goto(BASE + "index.html");
  await sleep(1200);
  check("iPhone と して ひらけている", await ev(`/iPhone/.test(navigator.userAgent) && BCT.art.noFrontMotion === true`));
  const clean = `(()=>({auto:document.querySelectorAll('svg[data-pet-motion="auto"]').length,fo:document.querySelectorAll('foreignObject').length}))()`;
  check("ホーム：正面の絵に foreignObject を つかわない", JSON.stringify(await ev(clean)) === '{"auto":0,"fo":0}');
  for (const [screen, arg] of [["shop", "look"], ["dress", { slot: "look" }], ["me"], ["habitat"]]) {
    await ev(`BCT.ui.show(${JSON.stringify(screen)}, ${JSON.stringify(arg || null)}); true`);
    await sleep(800);
    const r = await ev(clean);
    check(`${screen}${arg ? "（" + (arg.slot || arg) + "）" : ""}：foreignObject なし（ようせいが はみ出さない）`, r.auto === 0 && r.fo === 0, JSON.stringify(r));
  }
  // ショップ「みため」の ようせいは タイルの 中に おさまる
  await ev(`BCT.ui.show('shop','look'); true`);
  await sleep(800);
  check("ショップ「みため」の 絵は タイルの 中", await ev(`[...document.querySelectorAll('#shopBody .shop-item')].every(t=>{const r=t.getBoundingClientRect();return [...t.querySelectorAll('svg, canvas, img')].every(e=>{const q=e.getBoundingClientRect();return q.width===0||(q.left>=r.left-1&&q.right<=r.right+1&&q.top>=r.top-1&&q.bottom<=r.bottom+1)})})`));
  check("ショップの アイテムを タップした 見本も foreignObject なし", await (async () => {
    await ev(`document.querySelector('#shopBody [data-item]').click(); true`);
    await sleep(600);
    const r = await ev(clean);
    await ev(`BCT.ui.closeModal(); true`);
    return r.auto === 0 && r.fo === 0;
  })());

  // せまい スマホでも よこに スクロールしない
  for (const w of [320, 360, 375, 390, 430]) {
    await b.send("Emulation.setDeviceMetricsOverride", { width: w, height: 760, deviceScaleFactor: 2, mobile: true });
    const bad = [];
    for (const s of ["home", "mission", "capture", "shop", "me", "dress", "habitat", "settings"]) {
      await ev(`BCT.ui.show(${JSON.stringify(s)}); true`);
      await sleep(250);
      const over = await ev(`document.scrollingElement.scrollWidth - innerWidth`);
      if (over > 0) bad.push(`${s}+${over}`);
    }
    check(`${w}px：どの 画面も よこに はみ出さない`, bad.length === 0, bad.join(" "));
  }
  const errs = b.consoleLogs.filter((l) => /EXCEPTION|error/i.test(l));
  check("コンソールに エラーなし", errs.length === 0, errs.join(" | "));
} finally { b.close(); }
const ok = results.filter(Boolean).length;
console.log(`\n${ok} / ${results.length} OK`);
process.exitCode = ok === results.length ? 0 : 1;
