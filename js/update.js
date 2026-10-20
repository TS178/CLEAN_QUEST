/*
 * アプリの 更新（SHIKA COLLECTION と おなじ しくみ）
 * ------------------------------------------------------------
 * - 新しい 版が とどいたら「あたらしい バージョンが あります」を 出し、「こうしん する」で すぐ 新しい 版に して ひらきなおす。
 * - かってには ひらきなおさない（クイズや さつえいの とちゅうで 画面が もどらない ように）。
 *   ほかの おしらせ・しんかの 演出・たまご・AR・さつえいの あいだは、おわるまで まってから 出す。
 * - 「あとで」を えらんだ ときは、設定の バージョンの したに「こうしん する」ボタンを 出す。
 * - 版の 番号は service-worker.js の APP_VERSION（「1.○○」）だけで きめる。画面には それを そのまま 出す。
 * - 画像の読み込みを待たず起動時に確認。表示中は1分ごと、復帰時は前回から15秒以上なら確認する。
 */
(function () {
  const BCT = window.BCT;
  const CHECK_MS = 60 * 1000;
  const RETURN_MS = 15 * 1000;
  const WAIT_SCREENS = ["egg", "name", "hatch", "ar", "photo"];
  let reg = null;
  let waiting = null;     // 「こうしん する」を まっている 新しい 版
  let asked = false;      // 「こうしん する」が おされた（このときだけ ひらきなおす）
  let refreshing = false;
  let prompting = false;
  let lastCheck = 0;
  let checking = null;
  const watched = new WeakSet();
  const offered = new WeakSet();
  const listeners = [];

  const can = () => "serviceWorker" in navigator && location.protocol !== "file:";
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Service Worker に 版を きく（こたえが なければ null）
  function ask(worker) {
    return new Promise((resolve) => {
      if (!worker) return resolve(null);
      const ch = new MessageChannel();
      const t = setTimeout(() => resolve(null), 1500);
      ch.port1.onmessage = (e) => { clearTimeout(t); resolve(typeof e.data === "string" ? e.data : null); };
      try { worker.postMessage({ type: "VERSION" }, [ch.port2]); } catch (e) { clearTimeout(t); resolve(null); }
    });
  }

  // いま うごいている 版（例「1.15」）。わからなければ 保存先の なまえ（bct-○○）から
  async function version() {
    if (can()) {
      const v = await ask(navigator.serviceWorker.controller || (reg && reg.active));
      if (v) return v;
    }
    try {
      const ks = (await caches.keys()).filter((k) => k.startsWith("bct-"));
      if (ks.length) return ks.sort().pop().replace(/^bct-/, "");
    } catch (e) { /* なし */ }
    return "—";
  }

  // ほかの ことを している あいだは まつ
  function busy() {
    if (!BCT.ui || !BCT.ui.current() || document.visibilityState === 'hidden') return true;
    if (BCT.truckShoot && BCT.truckShoot.busy()) return true;
    if (BCT.plaBusters && BCT.plaBusters.busy()) return true;
    const m = document.getElementById("modal");
    if (m && m.classList.contains("show")) return true;
    const evo = document.getElementById("evo");
    if (evo && evo.classList.contains("show")) return true;
    return WAIT_SCREENS.includes(BCT.ui && BCT.ui.current());
  }

  async function prompt(worker) {
    waiting = worker;
    listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
    if (prompting || offered.has(worker)) return;
    prompting = true;
    try {
      while (busy()) await sleep(250);
      if (waiting !== worker || asked || worker.state === 'redundant') return;
      const next = await ask(worker);
      // A game or dialog may have opened while the worker answered.
      while (busy()) await sleep(250);
      if (waiting !== worker || asked || worker.state === 'redundant') return;
      offered.add(worker);
      const ok = await BCT.ui.modal(
      `<h3 class="keep">🔄 あたらしい バージョンが あります</h3>
       <p class="lead keep" style="text-align:center">${next ? `バージョン ${BCT.ui.esc(next)}<br>` : ""}こうしん すると、あたらしい ないようで ひらきなおします。<br>そだてた ようせいや きろくは そのまま だよ。</p>`,
      [{ label: "あとで", cls: "ghost", value: false }, { label: "こうしん する", cls: "mint", value: true }]
    );
      if (ok) apply();
    } finally {
      prompting = false;
      if (waiting && waiting !== worker && !offered.has(waiting) && !asked) prompt(waiting);
    }
  }

  // 新しい 版に して ひらきなおす
  function apply() {
    const w = waiting || (reg && reg.waiting);
    if (!w) { location.reload(); return; }
    asked = true;
    w.postMessage({ type: "SKIP_WAITING" });
    // 入れかわりの しらせが こない ときの 保険
    setTimeout(() => { if (!refreshing) { refreshing = true; location.reload(); } }, 4000);
  }

  function check() {
    if (!reg) return Promise.resolve(false);
    if (checking) return checking;
    lastCheck = Date.now();
    checking = reg.update().then(() => {
      watch(reg.installing);
      if (reg.waiting && navigator.serviceWorker.controller) prompt(reg.waiting);
      return true;
    }).catch(() => false).finally(() => { checking = null; });
    return checking;
  }

  function watch(sw) {
    if (!sw || watched.has(sw)) return;
    watched.add(sw);
    const changed = () => {
      if (sw.state === 'installed' && navigator.serviceWorker.controller) prompt(sw);
    };
    sw.addEventListener('statechange', changed);
    changed();
  }

  async function register() {
    if (!can()) return;
    try {
      // 「こうしん する」を おした ときだけ ひらきなおす（はじめて 入った ときの 入れかわりでは ひらきなおさない）
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (refreshing || !asked) return;
        refreshing = true;
        location.reload();
      });
      reg = await navigator.serviceWorker.register("service-worker.js", { updateViaCache: 'none' });
      if (!reg) return; // 登録 できなかった（プライベート モード・確認用の ブラウザ など）
      if (reg.waiting && navigator.serviceWorker.controller) prompt(reg.waiting);
      reg.addEventListener("updatefound", () => watch(reg.installing));
      watch(reg.installing); // Installation can start before register() resolves.
      check();
    } catch (e) {
      console.warn("SW", e);
    }
  }

  const foregroundCheck = () => {
    if (document.visibilityState === 'visible' && Date.now() - lastCheck >= RETURN_MS) check();
  };
  document.addEventListener('visibilitychange', foregroundCheck);
  window.addEventListener('pageshow', foregroundCheck);
  window.addEventListener('focus', foregroundCheck);
  window.addEventListener('online', () => { if (reg) check(); });
  if (can()) setInterval(() => {
    if (document.visibilityState === 'visible' && Date.now() - lastCheck >= CHECK_MS) check();
  }, CHECK_MS);

  BCT.update = {
    version,
    check,
    apply,
    hasUpdate: () => !!(waiting || (reg && reg.waiting && navigator.serviceWorker.controller)),
    onChange: (fn) => listeners.push(fn),
  };
  register(); // Do not wait for window.load (images, video, etc.).
})();
