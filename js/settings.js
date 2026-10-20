/*
 * 設定（ヘッダー 右の はぐるま）：おうちの かたへ（うごきを へらす・このアプリについて・データの バックアップ・さいしょから）・バージョン
 * バージョンは「1.○○」（service-worker.js の APP_VERSION）。新しい 版が まっている ときは「こうしん する」ボタン（js/update.js）。
 * バージョンを 7かい つづけて タップすると 管理者モード（js/admin.js）。
 */
(function () {
  const BCT = window.BCT;
  const { $, ui } = BCT;
  let back = "home";      // もどる さき（はぐるまを おした ときの 画面）
  let taps = 0, tapTimer = null;

  // いまの 版（service-worker.js の APP_VERSION。例「1.15」）
  const version = () => (BCT.update ? BCT.update.version() : Promise.resolve("—"));

  function render() {
    const reduce = !!BCT.prefs.get().reduceMotion;
    $("settingsBody").innerHTML = `
      <div class="sub-top"><button class="btn small ghost" id="setBack">← もどる</button><h3>せってい</h3></div>
      <div class="card parent">
        <h3>おうちの かたへ</h3>
        <label class="ph-check" style="margin-bottom:10px"><input type="checkbox" id="setReduce" ${reduce ? "checked" : ""}> うごきを へらす（アニメーションを みじかく する）</label>
        <button class="btn small ghost block" id="setAbout" style="margin-bottom:10px">このアプリについて（無料・ライセンス）</button>
        <h4 class="set-sub">イベントの 日</h4>
        <p class="note keep" id="setEvent"></p>
        <button class="btn small ghost block" id="setEventScan" style="margin-bottom:10px">📷 うけつけの QRコードを よむ</button>
        <h4 class="set-sub">データの バックアップ</h4>
        <div class="btn-row set-backup">
          <button class="btn small ghost" id="setBackup">バックアップを ほぞん</button>
          <button class="btn small ghost" id="setRestore">バックアップから もどす</button>
        </div>
        <p class="note">きろくは この 端末の 中だけに あります。ファイルに ほぞん しておくと、機種変更や ブラウザの データを けした ときに もどせます。</p>
        <button class="btn small ghost block" id="setReset">さいしょから やりなおす</button>
        <p class="note" style="margin-bottom:0">育成の記録は、この端末のブラウザの中だけに保存されています。
          ブラウザのデータを消したり、別のスマホ・別のブラウザで開いたりすると、引き継がれません。
          位置情報は使いません。記念撮影の写真・カメラ映像はどこにも送信しません。</p>
      </div>
      <p class="app-version"><button class="ver-btn" id="setVer" aria-label="バージョン">バージョン …</button></p>
      <p class="app-update" id="setUpdate" hidden><button class="btn small mint" id="setUpdateGo">🔄 あたらしい バージョンに こうしん する</button></p>`;
    $("setBack").onclick = () => ui.show(back);
    $("setReduce").onchange = (e) => BCT.prefs.set("reduceMotion", e.target.checked);
    $("setAbout").onclick = () => BCT.profile.about();
    $("setReset").onclick = () => BCT.profile.resetAll();
    $("setVer").onclick = tapVersion;
    $("setBackup").onclick = () => BCT.backup.save();
    $("setRestore").onclick = () => BCT.backup.restore();
    $("setUpdateGo").onclick = () => BCT.update.apply();
    showUpdate();
    showEvent();
    $("setEventScan").onclick = async () => { if (BCT.eventMode && (await BCT.eventMode.scan())) showEvent(); };
    version().then((v) => { if ($("setVer")) $("setVer").textContent = `バージョン ${v}`; });
  }
  // イベントの 日だけ ミッションに「イベント しゅうりょう QR」（js/event-mode.js）
  function showEvent() {
    const el = $("setEvent");
    if (!el || !BCT.eventMode) return;
    const src = BCT.eventMode.source();
    el.innerHTML = src
      ? `<b>きょうは イベントの 日です</b>（${src === "date" ? "イベントの 日" : "うけつけの QR で ひらいた。きょうの 24時まで"}）。ミッションに「イベント しゅうりょう QRコード」が でます。`
      : `ミッションの「イベント しゅうりょう QRコード」は <b>イベントの 日だけ</b> でます。イベントの 日は 自動で、または うけつけの QR を よむと でます。`;
    const b = $("setEventScan");
    if (b) b.hidden = !!src;
  }
  if (BCT.eventMode) BCT.eventMode.onChange(showEvent);
  function showUpdate() {
    const u = $("setUpdate");
    if (u) u.hidden = !(BCT.update && BCT.update.hasUpdate());
  }
  if (BCT.update) BCT.update.onChange(showUpdate);

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
