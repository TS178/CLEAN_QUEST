/*
 * カメラの きょかが ない ときの おしらせ（さつえい・AR）
 * ------------------------------------------------------------
 * スマホの ブラウザは、いちど「きょか しない」を えらぶと、アプリから もう いちど きょかの 画面を 出せない
 * （ブラウザの 設定で ゆるす ひつようが ある）。そこで、カメラが つかえない ときは きょかの しかたを 出し、
 * 「もういちど ためす」で カメラを ためす。まだ だめなら、きょかが 出るまで なんどでも おなじ おしらせを 出す。
 * まだ「きょか しない」を えらんでいない ときは、「もういちど ためす」で ブラウザの きょかの 画面が また 出る。
 * ブラウザが きょかの かわりめを おしえて くれる ときは、きょか されたら すぐ カメラを うごかす。
 */
(function () {
  const BCT = (window.BCT = window.BCT || {});
  const ua = navigator.userAgent || "";
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);
  let showing = false;
  let watching = null;
  // おしらせが いま 出ているか（ほかの おしらせに いれかわったら 出ていない あつかい）
  const open = () => {
    const m = document.getElementById("modal");
    return showing && !!m && m.classList.contains("show") && !!document.querySelector("#modalBox .perm-steps");
  };

  // いまの きょかの じょうたい（"granted" / "denied" / "prompt" / "unknown"）
  async function state() {
    try {
      const p = await navigator.permissions.query({ name: "camera" });
      return p.state;
    } catch (e) {
      return "unknown";
    }
  }

  function steps() {
    if (isIOS) {
      return `<ol class="perm-steps">
          <li>がめんの いちばん したの <b>「ぁあ」</b>（または 「AA」）を おす</li>
          <li><b>「Webサイトの設定」</b> → <b>「カメラ」</b> を <b>「許可」</b> に する</li>
          <li>ホーム画面に ついかした アプリの ときは、iPhone の <b>「設定」</b> → <b>「Safari」</b> → <b>「カメラ」</b> を <b>「許可」</b></li>
        </ol>`;
    }
    if (isAndroid) {
      return `<ol class="perm-steps">
          <li>がめんの うえの <b>アドレス バーの ひだりの マーク</b>（かぎ や せってい）を おす</li>
          <li><b>「権限」</b>（または「サイトの設定」）→ <b>「カメラ」</b> を <b>「許可」</b> に する</li>
          <li>ホーム画面に ついかした アプリの ときは、アプリの アイコンを ながおし → <b>「アプリ情報」</b> → <b>「権限」</b> → <b>「カメラ」</b></li>
        </ol>`;
    }
    return `<ol class="perm-steps"><li>ブラウザの アドレス バーの マーク（かぎ や カメラ）から、この ページの <b>カメラ</b> を <b>「許可」</b> に する</li></ol>`;
  }

  /*
   * カメラが ゆるされて いない ときに よぶ。retry … もういちど カメラを ためす 関数（ためして だめなら また これを よぶ）
   * ほかの おしらせを とじて しまわない よう、おしらせを 出している あいだは かさねて 出さない
   */
  let asking = false; // おしらせを 出す じゅんびちゅう（2回 かさねて よばれた とき）
  async function ask(retry) {
    if (open() || asking) return;
    asking = true;
    showing = true;
    // ブラウザが かわりめを おしえて くれる ときは、きょか されたら すぐ ためす
    try {
      const p = await navigator.permissions.query({ name: "camera" });
      if (watching) watching.onchange = null;
      watching = p;
      p.onchange = () => {
        if (p.state === "granted" && open()) {
          showing = false;
          BCT.ui.closeModal();
          retry();
        }
      };
    } catch (e) { /* おしえて くれない ブラウザ */ }
    asking = false;
    const again = await BCT.ui.modal(
      `<h3>📷 カメラを つかわせてね</h3>
       <p class="lead">カメラの <b>きょか</b> が ありません。<br>おうちの ひとと いっしょに、カメラを ゆるして ね。</p>
       ${steps()}
       <p class="note">ゆるしたら「もういちど ためす」を おしてね。</p>`,
      [{ label: "あとで", cls: "ghost", value: false }, { label: "もういちど ためす", cls: "mint", value: true }]
    );
    showing = false;
    if (watching) { watching.onchange = null; watching = null; }
    if (again) retry();
  }

  const isPermissionError = (e) => !!e && (e.name === "NotAllowedError" || e.name === "SecurityError" || e.name === "PermissionDeniedError");

  BCT.cameraPermission = { state, ask, isPermissionError, showing: open };
})();
