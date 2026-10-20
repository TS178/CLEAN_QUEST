/* ようせい（もと「じぶん」）：ようせいの すがた・すすみぐあいの 線・イベントしゅうりょうQR（「みつけた ゴミ」は 2026-10-20 に なくした）。
   しょうごうは ミッション画面の いちばん した、おうちの かたへ は 設定（右上の はぐるま） */
(function () {
  const BCT = window.BCT;
  const { $, ui, pets } = BCT;
  const SAVE_FAIL = "保存できませんでした。もう一度ためしてください。";

  // 進み具合の 線（ゲージ）。ratio は 0〜1
  const bar = (label, value, ratio, sub) => `
    <div class="pbar">
      <div class="pb-top"><span class="pb-lbl">${label}</span><span class="pb-val">${value}${sub ? ` <small>${sub}</small>` : ""}</span></div>
      <div class="progress"><div style="width:${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%"></div></div>
    </div>`;

  function render() {
    const s = BCT.store.get();
    if (!s.pet) return;
    const g = BCT.game;
    const lv = g.level(s);
    const a = g.affection(s);
    const p = g.progressOf(g.xp(s));
    const q = g.quizCleared(s);
    const have = BCT.badgesHave(s).length;

    // 名前の カード（この したに あそぶ・きせかえ・さつえい の ボタン。index.html の .me-actions）
    $("meTop").innerHTML = `
      <div class="card fairy-card">
        <div class="fc-art">${pets.renderState(s, { lv: Math.min(s.seenLv, lv) })}</div>
        <div class="fc-info">
          <div class="fc-name">${ui.esc(s.pet.name)}</div>
          <div class="note">${pets.TYPES[s.pet.type].motif}の ようせい</div>
          <div class="note">🚩 ${ui.esc(s.team.name)}${s.team.members ? `（${s.team.members}にん）` : ""}</div>
          <button class="btn small ghost" id="meEdit">なまえを かえる</button>
        </div>
      </div>`;

    $("meBody").innerHTML = `
      <div class="card me-progress">
        ${bar("レベル", `Lv${lv}「${ui.esc(pets.levelName(lv))}」`, p.ratio, p.rest > 0 ? `つぎまで ${p.rest}` : "いちばん うえ")}
        ${bar("なつきど", `<span class="hearts">${Array.from({ length: a.maxStage }, (_, i) => `<span class="${i < a.stage ? "on" : ""}">♥</span>`).join("")}</span>`,
          a.max ? 1 : (a.stage * a.perStage + a.step) / (a.maxStage * a.perStage), a.max ? "MAX" : `なでなで ${a.step}/${a.perStage}`)}
        ${bar("うみクイズ", `${q} / ${BCT.QUIZ.length}`, q / BCT.QUIZ.length)}
        ${bar("しょうごう", `${have} / ${BCT.BADGES.length}`, have / BCT.BADGES.length)}
        <div class="me-mini">
          <div><b>${g.miniCleared(s, true)}</b><span>ゲームを クリア</span></div>
          <div><b>${s.beach.sorted}</b><span>ビーチで わけた</span></div>
          <div><b>${g.poses(s).length}</b><span>おぼえた ポーズ</span></div>
        </div>
      </div>`;

    $("meEdit").onclick = editNames;
    const roster=document.createElement('section');roster.className='card';$('meTop').prepend(roster);BCT.companionUI.picker(roster,'me');
  }

  async function editNames() {
    const s = BCT.store.get();
    const ok = await ui.modal(
      `<h3>なまえを かえる</h3>
       <label class="field"><span>ようせいの なまえ</span><input id="edPet" maxlength="12" value="${ui.esc(s.pet.name)}"></label>
       <label class="field"><span>たんけんたいの なまえ</span><input id="edTeam" maxlength="16" value="${ui.esc(s.team.name)}"></label>
       <label class="field"><span>なんにんで さんか？</span><select id="edMem">${[0, 1, 2, 3, 4, 5, 6, 7, 8]
         .map((n) => `<option value="${n}" ${n === s.team.members ? "selected" : ""}>${n ? n + "にん" : "えらばない"}</option>`).join("")}</select></label>`,
      [{ label: "やめる", cls: "ghost", value: false }, { label: "かえる", cls: "mint", value: true }]
    );
    if (ok) {
      // モーダルを とじても 入力欄は のこっているので 読める
      const pn = $("edPet").value.trim(), tn = $("edTeam").value.trim();
      const mem = parseInt($("edMem").value, 10) || 0;
      const r = BCT.store.update((st) => {
        if (pn) st.pet.name = pn;
        if (tn) st.team.name = tn;
        st.team.members = mem;
      });
      if (!r.ok) ui.toast(SAVE_FAIL);
    }
    render();
  }

  // ---------- イベント しゅうりょう QR ----------
  // キーは短く。位置情報は入れない（子どもの行動範囲が わかってしまうため）
  // v2：けいけんち(xp) を入れる。クリーンPt(pt) は なくなった
  //   2026-10-20：「ひろう」を なくしたので ゴミの きろく（rc・tr・cm）は 入れない。かわりに ミニゲームの さいこう てん（sh・pbs）
  function payload() {
    const s = BCT.store.get();
    const g = BCT.game;
    return {
      v: 2,
      app: "bct",
      ev: BCT.CONFIG.event.id,
      id: s.id,
      tm: s.team.name,
      n: s.team.members,
      pet: s.pet.type,
      pn: s.pet.name,
      lv: g.level(s),
      xp: g.xp(s),
      qz: g.quizCleared(s),
      sh: (s.truckShoot && s.truckShoot.bestScore) || 0,
      pbs: (s.plaBusters && s.plaBusters.bestScore) || 0,
      bd: BCT.badgesHave(s).map((b) => b.id),
      t: Math.floor(Date.now() / 1000),
    };
  }

  function drawQr(text) {
    qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"];
    const qr = qrcode(0, "M");
    qr.addData(text, "Byte");
    qr.make();
    const n = qr.getModuleCount();
    const cell = Math.max(4, Math.floor(400 / n));
    const quiet = 4;
    const size = (n + quiet * 2) * cell;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d");
    g.fillStyle = "#fff";
    g.fillRect(0, 0, size, size);
    g.fillStyle = "#000";
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++)
        if (qr.isDark(y, x)) g.fillRect((x + quiet) * cell, (y + quiet) * cell, cell, cell);
    c.setAttribute("aria-label", "イベント しゅうりょう QRコード");
    return c;
  }

  async function showQr() {
    const p = payload();
    const text = JSON.stringify(p);
    const p2 = ui.modal(
      `<h3>おつかれさま！</h3>
       <p class="lead" style="color:var(--ink);margin-bottom:4px">この がめんを <b>うんえいの ひと</b>に みせてね</p>
       <div class="qr-wrap" id="qrWrap"></div>
       <p class="note" style="text-align:center">🚩 ${ui.esc(p.tm)} ／ Lv${p.lv} ／ クイズ ${p.qz}もん ／ しょうごう ${p.bd.length}こ</p>
       <button class="btn block ghost" data-close>とじる</button>`
    );
    try {
      $("qrWrap").appendChild(drawQr(text));
    } catch (e) {
      $("qrWrap").textContent = "QRコードを つくれませんでした";
      console.error(e);
    }
    await p2;
  }

  // ---------- このアプリについて ----------
  async function about() {
    const p = ui.modal(`
      <div class="about">
        <h3>このアプリについて</h3>
        <p><b>ビーチクリーン探検隊</b>は、親子で参加するビーチクリーンイベントのためのアプリです。</p>

        <h4>💴 料金について</h4>
        <p><b>完全無料です。</b>利用者・運営者ともに、利用料・登録料・後日の請求は一切ありません。</p>
        <ul>
          <li>公開：GitHub Pages（GitHub の無料プラン・公開リポジトリ）</li>
          <li>保存：この端末の中だけ（サーバー・クラウドは使っていません）</li>
          <li>アクセス解析・広告・有料サービス・課金のしくみは入っていません</li>
          <li>アプリの「たんけんたいメダル」はゲームの中だけのもので、本物のお金では買えません（課金・広告視聴・ガチャはありません）</li>
          <li>どのサービスにも、クレジットカードなどの支払い情報は登録していません</li>
        </ul>
        <p class="note">※ 通信料（パケット代）は、ご契約中の携帯電話の料金プランに従います。</p>

        <h4>🔒 個人情報について</h4>
        <p>育成の記録は、この端末の中だけに保存され、外部へ送信されません。位置情報は使いません。<br>
          記念撮影・AR のカメラ映像・写真は送信しません。できた画像は、保存するまで端末のメモリの中だけにあります。</p>

        <h4>📦 使っているソフトウェア</h4>
        <table>
          <tr><th>名前</th><th>ライセンス</th></tr>
          <tr><td>qrcode-generator 2.0.4<br><span class="note">© Kazuhiko Arase</span></td><td>MIT</td></tr>
          <tr><td>jsQR 1.4.0（運営用画面のみ）<br><span class="note">cozmo/jsQR</span></td><td>Apache-2.0</td></tr>
          <tr><td>three.js 0.186.1（AR で なでる・あそぶ）<br><span class="note">© three.js authors</span></td><td>MIT</td></tr>
        </table>
        <p class="note">いずれも無料で利用・再配布できるライセンスです（コピーレフト型のライセンスは使っていません）。</p>
        <details><summary>qrcode-generator のライセンス全文</summary><pre data-lic="vendor/qrcode/LICENSE.txt">読み込み中…</pre></details>
        <details><summary>jsQR のライセンス全文</summary><pre data-lic="vendor/jsqr/LICENSE.txt">読み込み中…</pre></details>
        <details><summary>three.js のライセンス全文</summary><pre data-lic="vendor/three/LICENSE.txt">読み込み中…</pre></details>
        <p class="note">「QRコード」は株式会社デンソーウェーブの登録商標です。</p>
      </div>
      <button class="btn block ghost" data-close style="margin-top:12px">とじる</button>`);
    document.querySelectorAll("#modalBox [data-lic]").forEach(async (pre) => {
      try {
        const r = await fetch(pre.dataset.lic);
        pre.textContent = r.ok ? await r.text() : "読み込めませんでした（ファイル: " + pre.dataset.lic + "）";
      } catch (e) {
        pre.textContent = "読み込めませんでした（ファイル: " + pre.dataset.lic + "）";
      }
    });
    await p;
  }

  // ---------- 保護者向け：さいしょから ----------
  async function resetAll() {
    if (!confirm("【おうちの かたへ】\n記録・たんけんたいメダル・ようせい・写真が すべて消えます。\nよろしいですか？")) return;
    if (!confirm("本当に消しますか？ 元には戻せません。")) return;
    await BCT.store.reset();
    ui.show("egg");
  }

  BCT.profile = { payload, drawQr, about, resetAll, showQr }; // showQr は ミッション画面（うみクイズの うえ）から つかう // about・resetAll は 設定（js/settings.js）の「おうちの かたへ」から つかう
  BCT.screens.me = { show: render };
})();
