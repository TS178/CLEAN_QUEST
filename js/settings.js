/*
 * 設定（ヘッダー 右の はぐるま）：おうちの かたへ（うごきを へらす・このアプリについて・さいしょから）・バージョン
 * バージョンを 7かい つづけて タップすると 管理者モード（js/admin.js）。
 */
(function () {
  const BCT = window.BCT;
  const { $, ui } = BCT;
  let back = "home";      // もどる さき（はぐるまを おした ときの 画面）
  let taps = 0, tapTimer = null;

  // いまの 版（Service Worker の 保存先の なまえ ＝ service-worker.js の APP_VERSION）
  async function version() {
    try {
      const ks = (await caches.keys()).filter((k) => k.startsWith("bct-"));
      return ks.sort().pop() || "—";
    } catch (e) {
      return "—";
    }
  }

  function render() {
    const reduce = !!BCT.prefs.get().reduceMotion;
    $("settingsBody").innerHTML = `
      <div class="sub-top"><button class="btn small ghost" id="setBack">← もどる</button><h3>せってい</h3></div>
      <div class="card parent">
        <h3>おうちの かたへ</h3>
        <label class="ph-check" style="margin-bottom:10px"><input type="checkbox" id="setReduce" ${reduce ? "checked" : ""}> うごきを へらす（アニメーションを みじかく する）</label>
        <button class="btn small ghost block" id="setAbout" style="margin-bottom:10px">このアプリについて（無料・ライセンス）</button>
        <button class="btn small ghost block" id="setReset">さいしょから やりなおす</button>
        <p class="note" style="margin-bottom:0">育成・記録・写真・位置情報は、この端末のブラウザの中だけに保存されています。
          ブラウザのデータを消したり、別のスマホ・別のブラウザで開いたりすると、引き継がれません。
          イベント終了QRには位置情報を含めていません。記念撮影の写真・カメラ映像はどこにも送信しません。</p>
      </div>
      <p class="app-version"><button class="ver-btn" id="setVer" aria-label="バージョン">バージョン …</button></p>`;
    $("setBack").onclick = () => ui.show(back);
    $("setReduce").onchange = (e) => BCT.prefs.set("reduceMotion", e.target.checked);
    $("setAbout").onclick = () => BCT.profile.about();
    $("setReset").onclick = () => BCT.profile.resetAll();
    $("setVer").onclick = tapVersion;
    version().then((v) => { if ($("setVer")) $("setVer").textContent = `バージョン ${v}`; });
  }

  // バージョンを 7かい つづけて タップ → 管理者モード（SHIKA COLLECTION と おなじ 入りかた）
  async function tapVersion() {
    clearTimeout(tapTimer);
    tapTimer = setTimeout(() => (taps = 0), 2500);
    if (++taps < 7) return;
    taps = 0;
    const ok = await ui.modal(
      `<h3>管理者モードに 入りますか？</h3>
       <p class="lead">確認用の 画面です。すべての ようせい・しんかの すがたを えらんで、アイテムを じゆうに きせかえて 見られます。<br>
       <b>ほぞんデータは かわりません。</b></p>`,
      [{ label: "やめる", cls: "ghost", value: false }, { label: "入る", cls: "mint", value: true }]
    );
    if (ok) ui.show("admin");
  }

  $("tbGear").addEventListener("click", () => {
    const cur = ui.current();
    if (cur !== "settings" && cur !== "admin") back = cur || "home";
    ui.show("settings");
  });

  BCT.settings = { back: () => back };
  BCT.screens.settings = { show: render };
})();
