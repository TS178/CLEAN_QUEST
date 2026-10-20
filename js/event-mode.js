/*
 * イベントの 日だけ ミッションに「イベント しゅうりょう QR」を 出す（もとは「ちず」と「ばしょの きろく」。「ひろう」は 2026-10-20 に なくした）
 * ------------------------------------------------------------
 * ふだん 家で つかう ときに 家の 位置を きろく しない ための しくみ（2026-10-13 利用者の 決定：日付と QR の 両方）。
 * 1. 日付：js/config.js の event.days に ある 日は、0時〜24時 だれでも 自動で ひらく
 * 2. 受付の QR：運営画面（operator.html）の「受付用 QR」＝ アプリの URL?event=あいことば。
 *    - スマホの カメラで よんで ひらいた とき（URL に あいことばが ついて くる）
 *    - アプリの 設定の「うけつけの QRコードを よむ」で よんだ とき（iPhone の ホーム画面の アプリは Safari と 保存先が べつなので こちら）
 *    どちらも、その日の おわり（24時）まで ひらく。この 端末だけ（localStorage の bct-event-open）。
 * あいことばは 公開して いる コードからも 見えるので 鍵ではない。「うっかり」を ふせぐ ための もの。
 * ひらいて いない ときは：ミッションに イベント しゅうりょう QR を 出さない（管理者モードでは いつでも 見られる）。
 */
(function () {
  const BCT = (window.BCT = window.BCT || {});
  const KEY = "bct-event-open";
  const listeners = [];
  let arrived = null; // URL の あいことばで ひらいた とき（"ok" / "ng"）。アプリが はじまってから おしらせ

  const cfg = () => (BCT.CONFIG && BCT.CONFIG.event) || {};
  const pad = (n) => String(n).padStart(2, "0");
  function today(d = new Date()) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function endOfToday() {
    const d = new Date();
    d.setHours(24, 0, 0, 0);
    return d.getTime();
  }
  function stored() {
    try {
      const o = JSON.parse(localStorage.getItem(KEY) || "null");
      return o && typeof o.until === "number" ? o : null;
    } catch (e) {
      return null;
    }
  }

  // いま ひらいて いる わけ（"date" / "qr" / null）
  function source() {
    if ((cfg().days || []).includes(today())) return "date";
    const o = stored();
    if (o && o.until > Date.now()) return "qr";
    return null;
  }
  const isOpen = () => !!source();

  // QR の 中身（URL か あいことば）から あいことばを とりだす
  function keyOf(text) {
    const t = String(text || "").trim();
    try {
      const u = new URL(t, location.href);
      const k = u.searchParams.get("event") || new URLSearchParams(u.hash.slice(1)).get("event");
      if (k) return k;
    } catch (e) { /* URL では ない */ }
    return t;
  }
  // あいことばが あって いれば その日の おわりまで ひらく
  function openWith(text) {
    const k = keyOf(text);
    if (!k || !cfg().openKey || k !== cfg().openKey) return false;
    try { localStorage.setItem(KEY, JSON.stringify({ until: endOfToday(), at: Date.now() })); } catch (e) { return false; }
    listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
    return true;
  }

  // 受付用 QR の 中身（運営画面で つかう）
  function receptionUrl(base) {
    const u = new URL("index.html", base || location.href);
    u.search = "event=" + encodeURIComponent(cfg().openKey || "");
    u.hash = "";
    return u.href;
  }

  // ---------- ひらいた URL の あいことば（読んだら URL から けす：ブックマークや ホーム画面に のこさない） ----------
  (function fromUrl() {
    let k = null;
    try {
      const q = new URLSearchParams(location.search);
      k = q.get("event") || new URLSearchParams(location.hash.slice(1)).get("event");
    } catch (e) { return; }
    if (!k) return;
    arrived = openWith(k) ? "ok" : "ng";
    try {
      const u = new URL(location.href);
      u.searchParams.delete("event");
      u.hash = "";
      history.replaceState(history.state, "", u.pathname + u.search);
    } catch (e) { /* なし */ }
  })();
  window.addEventListener("load", () => {
    if (!arrived) return;
    setTimeout(() => {
      if (!BCT.ui) return;
      BCT.ui.toast(arrived === "ok" ? "🎉 きょうは イベントの 日！ ミッションに イベント しゅうりょう QR が でるよ" : "うけつけの QR が ちがう みたい");
    }, 700);
  });

  // ---------- アプリの 中で 受付の QR を よむ ----------
  let jsqrLoad = null;
  function loadJsQR() {
    if (window.jsQR) return Promise.resolve();
    if (!jsqrLoad) {
      jsqrLoad = new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "vendor/jsqr/jsQR.js";
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    return jsqrLoad;
  }

  async function scan() {
    const ui = BCT.ui;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      ui.toast("この スマホでは よめないよ。スマホの カメラで QR を よんでね");
      return false;
    }
    let stream = null, timer = null, done = false, detector = null;
    const stop = () => {
      done = true;
      clearTimeout(timer);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      stream = null;
    };
    const wait = ui.modal(
      `<h3 class="keep">📷 うけつけの QRコードを よむ</h3>
       <div class="ev-scan"><video id="evScanVideo" playsinline muted></video><div class="ev-scan-frame"></div></div>
       <p class="note keep" id="evScanMsg" style="text-align:center">わくの 中に QRコードを うつしてね</p>`,
      [{ label: "やめる", cls: "ghost", value: null }]
    );
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    } catch (e) {
      stop();
      const r = BCT._modalResolve;
      ui.closeModal();
      if (r) r(null);
      if (BCT.cameraPermission && BCT.cameraPermission.isPermissionError(e)) BCT.cameraPermission.ask(scan);
      else ui.toast("カメラが つかえないよ。スマホの カメラで QR を よんでね");
      return false;
    }
    const v = document.getElementById("evScanVideo");
    if (!v || done) { stop(); return false; }
    v.srcObject = stream;
    v.play().catch(() => {});
    try {
      if ("BarcodeDetector" in window && (await BarcodeDetector.getSupportedFormats()).includes("qr_code")) {
        detector = new BarcodeDetector({ formats: ["qr_code"] });
      }
    } catch (e) { /* jsQR へ */ }
    if (!detector) await loadJsQR().catch(() => {});
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const result = new Promise((resolve) => {
      async function tick() {
        if (done) return resolve(null);
        let text = null;
        try {
          if (v.readyState >= 2 && v.videoWidth) {
            if (detector) {
              const codes = await detector.detect(v);
              if (codes.length) text = codes[0].rawValue;
            } else if (window.jsQR) {
              const w = 480, h = Math.round((v.videoHeight / v.videoWidth) * 480);
              canvas.width = w;
              canvas.height = h;
              ctx.drawImage(v, 0, 0, w, h);
              const c = window.jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" });
              if (c) text = c.data;
            }
          }
        } catch (e) { /* つぎの こま */ }
        if (text) {
          if (openWith(text)) return resolve("ok");
          const m = document.getElementById("evScanMsg");
          if (m) m.textContent = "この QR では ひらけないよ。うけつけの QR を よんでね";
        }
        timer = setTimeout(tick, 250);
      }
      tick();
    });
    const how = await Promise.race([wait.then(() => "cancel"), result]);
    stop();
    if (how === "ok") {
      const r = BCT._modalResolve;
      ui.closeModal();
      if (r) r(null);
      ui.toast("🎉 きょうは イベントの 日！ ミッションに イベント しゅうりょう QR が でるよ");
      return true;
    }
    return false;
  }

  BCT.eventMode = { isOpen, source, openWith, receptionUrl, scan, today, onChange: (fn) => listeners.push(fn) };
})();
