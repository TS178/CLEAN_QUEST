/*
 * きせかえ：もっている物だけ 表示。おおきな見本で たしかめながら つけかえる（むりょう・なんどでも）
 * 同時に つけられるのは あたま1・こもの1・みため1、さつえいフレームは べつに1。
 * ヤドカリの かいがらを かえると「おひっこし」の みじかい演出。
 */
(function () {
  const BCT = window.BCT;
  const { $, ui, game, pets } = BCT;
  let slot = "head";
  let moving = false;

  const SLOT_LIST = BCT.SLOTS.filter((c) => BCT.EQUIP_SLOTS.includes(c.key));

  function previewHtml(s) {
    if (slot === "frame") {
      return s.equip.frame ? BCT.framePreview(s, s.equip.frame)
        : `<div class="frame-prev none"><div class="fp-pet">${pets.renderState(s, { pose: "smile" })}</div></div>`;
    }
    return pets.renderState(s, { face: "happy" });
  }

  function render() {
    const s = BCT.store.get();
    if (!s.pet) return;
    const owned = game.ownedItems(s, slot);
    const cur = s.equip[slot];
    const noneLabel = slot === "look" ? BCT.LOOK_DEFAULT[s.pet.type] : "なし";
    const noneIcon = slot === "look" ? BCT.art.render({ type: s.pet.type, stage: 2 }) : `<svg viewBox="0 0 100 100"><text x="50" y="62" font-size="40" text-anchor="middle" fill="#9aa8b8">✕</text></svg>`;
    $("dressBody").innerHTML = `
      <p class="eyebrow">YOUR LITTLE COMPANION</p><h2>きせかえ</h2>
      <div class="dress-preview" id="dressPreview">${previewHtml(s)}</div>
      <div class="chips cats">${SLOT_LIST.map((c) =>
        `<button class="chip ${c.key === slot ? "on" : ""}" data-slot="${c.key}">${BCT.art.icon(c.key)} ${c.name}</button>`).join("")}</div>
      ${slot === "frame" ? `<p class="note">フレームは「いっしょに さつえい」の しゃしんに つくよ。</p>` : ""}
      <div class="shop-grid">
        <button class="shop-item ${!cur ? "worn" : ""}" data-eq="">
          <span class="art">${noneIcon}</span><span class="nm">${ui.esc(noneLabel)}</span><span class="pr">${!cur ? "つけてる" : ""}</span></button>
        ${owned.map((it) => `<button class="shop-item ${cur === it.id ? "worn" : ""}" data-eq="${it.id}">
          <span class="art">${BCT.art.itemIcon(it.id, s.pet.type)}</span><span class="nm">${ui.esc(it.name)}</span>
          <span class="pr">${cur === it.id ? "つけてる" : ""}</span></button>`).join("")}
      </div>
      ${owned.length ? "" : `<p class="lead">まだ もっていないよ。ショップで さがしてみよう！</p>`}
      <p class="note">おもちゃは ホームの「あそぶ」で つかうよ。</p>
      <div class="btn-row" style="margin-top:12px">
        <button class="btn ghost" data-go-shop>${BCT.art.icon("shop")} ショップ</button>
        <button class="btn lilac" data-go-photo>${BCT.art.icon("capture")} さつえい</button>
      </div>`;
    document.querySelectorAll("#dressBody [data-slot]").forEach((b) => (b.onclick = () => { slot = b.dataset.slot; render(); }));
    document.querySelectorAll("#dressBody [data-eq]").forEach((b) => (b.onclick = () => wear(slot, b.dataset.eq || null)));
    $("dressBody").querySelector("[data-go-shop]").onclick = () => ui.show("shop", slot);
    $("dressBody").querySelector("[data-go-photo]").onclick = () => ui.show("photo");
  }

  async function wear(sl, id) {
    if (moving) return;
    const s = BCT.store.get();
    if (s.equip[sl] === id) return;
    const isMove = sl === "look" && s.pet.type === "hermit";
    if (isMove) {
      // おひっこし：いまの かいがらから とびだして、あたらしい かいがらに はいる
      moving = true;
      const box = $("dressPreview");
      box.classList.add("moving");
      box.insertAdjacentHTML("beforeend", `<div class="move-msg">おひっこし！</div>`);
      await new Promise((r) => setTimeout(r, ui.reducedMotion() ? 50 : 550));
      game.equip(sl, id);
      box.querySelector("svg").outerHTML = previewHtml(BCT.store.get());
      await new Promise((r) => setTimeout(r, ui.reducedMotion() ? 50 : 650));
      moving = false;
      render();
      return;
    }
    game.equip(sl, id);
    render();
  }

  BCT.screens.dress = {
    show(arg) {
      if (arg && arg.slot) {
        slot = arg.slot;
        render();
        if (arg.equip) wear(arg.slot, arg.equip);
        return;
      }
      render();
    },
    refresh() { if (!moving) render(); },
  };
})();
