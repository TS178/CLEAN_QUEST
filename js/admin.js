/*
 * 管理者モード（確認用のお試し画面）
 * ------------------------------------------------------------
 * - すべての ようせい（イルカ・ウミガメ・ヤドカリ）と しんかの すがた（段階1〜3）を えらべる
 * - あたま・こもの・みため を じゆうに きせかえ、ポーズ・かおも えらべる（もっていない アイテムも 見られる）
 * - 「うごく すがた（パーツ。js/pet-rig.js）」と「正面の絵（js/pet-art.js）」を きりかえて 見る
 * - ほぞんデータは かえない（ここで えらんだ ものは この画面の 中だけ）
 * - イベント しゅうりょう QR を イベントの 日 いがいでも 見られる（ミッションでは イベントの 日だけ。中身は いまの データ）
 * 入りかた：設定（右上の はぐるま）の バージョンを 7かい つづけて タップ（js/settings.js）
 */
(function () {
  const BCT = window.BCT;
  const { $, ui, pets } = BCT;
  const st = { type: "dolphin", stage: 1, equip: {}, pose: "normal", face: "normal", view: "rig", left: false, swim: true };
  let rig = null;
  const SLOTS = [["head", "あたま"], ["acc", "こもの"], ["look", "みため"]];
  const POSES = [["normal", "ふつう"], ["smile", "えがお"], ["toy_ball", "ボール"], ["toy_bubbles", "あわ"], ["toy_music", "おんがく"]];

  const btn = (on, attrs, label) => `<button class="adm-chip ${on ? "on" : ""}" ${attrs}>${label}</button>`;

  function render() {
    const items = (slot) => BCT.ITEMS.filter((it) => it.slot === slot && (!it.only || it.only === st.type));
    // べつの ようせい せんようの みためは はずす
    if (st.equip.look && !items("look").some((it) => it.id === st.equip.look)) delete st.equip.look;
    $("adminBody").innerHTML = `
      <div class="sub-top"><button class="btn small ghost" id="admBack">← せってい</button><h3>管理者モード</h3></div>
      <p class="note adm-note">確認用の お試し画面です。ここで えらんだ ものは ほぞんされません。</p>
      <button class="btn small sea block" id="admQr" style="margin-bottom:10px">🎉 イベント しゅうりょう QR を 見る（イベントの 日 いがいでも）</button>
      <div class="adm-stage ${st.left ? "left" : ""}" id="admStage"><div class="adm-face" id="admFace"></div></div>
      <div class="adm-row">${btn(st.view === "rig", 'data-view="rig"', "うごく すがた")}${btn(st.view === "front", 'data-view="front"', "正面の絵")}
        ${btn(st.left, 'data-left', "← むき")}${st.view === "rig" ? btn(st.swim, 'data-swim', st.swim ? "およぐ" : "とまる") : ""}</div>
      <h4>ようせい</h4>
      <div class="adm-row">${pets.TYPE_KEYS.map((t) => btn(st.type === t, `data-type="${t}"`, `${pets.TYPES[t].motif}`)).join("")}</div>
      <h4>しんかの すがた</h4>
      <div class="adm-row">${[1, 2, 3].map((n) => btn(st.stage === n, `data-stage="${n}"`, `${n}：${pets.STAGE_NAMES[n]}`)).join("")}</div>
      ${st.view === "front" ? `<h4>ポーズ・かお</h4>
      <div class="adm-row">${POSES.map(([k, n]) => btn(st.pose === k, `data-pose="${k}"`, n)).join("")}
        ${btn(st.face === "happy", 'data-face', "にっこり")}</div>` : ""}
      ${SLOTS.map(([slot, name]) => `<h4>${name}</h4>
        <div class="adm-items">${btn(!st.equip[slot], `data-eq="${slot}" data-id=""`, "なし")}${items(slot).map((it) =>
          `<button class="adm-item ${st.equip[slot] === it.id ? "on" : ""}" data-eq="${slot}" data-id="${it.id}" title="${ui.esc(it.name)}">
            <span class="art">${BCT.art.itemIcon(it.id, st.type)}</span><span class="nm">${ui.esc(it.name)}</span></button>`).join("")}</div>`).join("")}`;
    $("admBack").onclick = () => ui.show("settings");
    $("admQr").onclick = () => BCT.profile.showQr();
    const on = (sel, fn) => document.querySelectorAll(`#adminBody ${sel}`).forEach((b) => (b.onclick = () => { fn(b); render(); }));
    on("[data-view]", (b) => (st.view = b.dataset.view));
    on("[data-left]", () => (st.left = !st.left));
    on("[data-swim]", () => (st.swim = !st.swim));
    on("[data-type]", (b) => (st.type = b.dataset.type));
    on("[data-stage]", (b) => (st.stage = Number(b.dataset.stage)));
    on("[data-pose]", (b) => (st.pose = b.dataset.pose));
    on("[data-face]", () => (st.face = st.face === "happy" ? "normal" : "happy"));
    on("[data-eq]", (b) => { if (b.dataset.id) st.equip[b.dataset.eq] = b.dataset.id; else delete st.equip[b.dataset.eq]; });
    drawPet();
  }

  // えらびなおす たびに 作りなおす（パーツの 画像は 保存ずみ なので かるい）
  function drawPet() {
    if (rig) { BCT.petRig.destroy(rig); rig = null; }
    const face = $("admFace"), stage = $("admStage");
    const opts = { type: st.type, stage: st.stage, equip: Object.assign({}, st.equip) };
    // 正面の絵（パーツが 読めない ときも これを 見せる）
    face.innerHTML = `<div class="adm-front rig-front">${BCT.art.render(Object.assign({}, opts, st.view === "front" ? { pose: st.pose, face: st.face } : {}))}</div>`;
    if (st.view !== "rig" || !BCT.petRig) return;
    rig = BCT.petRig.create(Object.assign({}, opts, { host: face, track: stage, owner: stage }));
    if (!rig) return;
    BCT.petRig.setActive(rig, true);
    BCT.petRig.setManualSpeed(rig, st.swim ? BCT.PET_RIG.common.speedRef : 0);
  }

  BCT.admin = { state: () => JSON.parse(JSON.stringify(st)) };
  BCT.screens.admin = {
    show: render,
    hide() { if (rig) { BCT.petRig.destroy(rig); rig = null; } },
  };
})();
