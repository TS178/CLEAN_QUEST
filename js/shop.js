/*
 * ショップ：たんけんたいメダルで アイテムを かう（ほんとうの おかねは つかわない。かきん・こうこく・ガチャ なし）
 * 共通19しゅるい ＋ じぶんの ようせい専用6しゅるい ＝ 25しゅるい と ドロップを 表示。
 * 買うまえに じぶんの ようせいで 見本を 見られる。買う処理は js/game.js の buy()。
 */
(function () {
  const BCT = window.BCT;
  const { $, ui, game, pets } = BCT;
  let cat = "all"; // さいしょは「すべて」
  const CATS = [{ key: "all", name: "すべて" }].concat(BCT.SLOTS);

  const ERR = {
    owned: "もう もっているよ",
    species: "ほかの ようせい せんようの ものだよ",
    notforsale: "うっていない とくべつな ものだよ",
    save: "ほぞん できなかったよ。もういちど ためしてね",
  };

  // 見本：あたま・こもの・みため は ようせいに つけて、おもちゃは ポーズ、フレームは わくの中に
  function preview(s, it) {
    if (it.slot === "home") return `<div class="hb-preview">${BCT.homeArt.homeItemSvg(it.id)}</div>`;
    if (it.slot === "toy") return pets.renderState(s, { pose: it.id });
    if (it.slot === "frame") return framePreview(s, it.id);
    return pets.renderState(s, { equip: { [it.slot]: it.id }, face: "happy" });
  }
  function framePreview(s, frameId) {
    return `<div class="frame-prev">${BCT.art.frameThumb(frameId)}<div class="fp-pet">${pets.renderState(s, { pose: "smile" })}</div></div>`;
  }
  BCT.framePreview = framePreview;

  function render() {
    const s = BCT.store.get();
    if (!s.pet) return;
    // すべて：ドロップ ＋ ほかの カテゴリの アイテム ぜんぶ
    const items = cat === "all" ? BCT.SLOTS.filter((c) => c.key !== "food").flatMap((c) => game.shopItems(s, c.key)) : game.shopItems(s, cat);
    const coins = game.coins(s);
    // ← ホーム・メダル・カテゴリ は スクロールしても 上に のこす（エクセルの ウィンドウ枠の 固定の ように）
    $("shopBody").innerHTML = `
      <div class="shop-sticky">
        <div class="sub-head shop-head"><button class="btn small ghost home-back" data-shop-home>← ホーム</button>${BCT.medal.wallet(coins)}</div>
        <div class="chips cats cats1">${CATS.map((c) =>
          `<button class="chip ${c.key === cat ? "on" : ""}" data-cat="${c.key}">${c.key === "all" ? `<span class="cat-all" aria-hidden="true">✦</span>` : BCT.art.icon(c.key)}<span>${c.name}</span></button>`).join("")}</div>
      </div>
      ${cat === "look" ? `<p class="note">${ui.esc(pets.TYPES[s.pet.type].motif)}の ようせい せんようの みためだよ。</p>` : ""}
      ${cat === "toy" ? `<p class="note">おもちゃは ホームの「あそぶ」で つかうよ。おなじ おもちゃで ${BCT.CONFIG.toyUnlockPlays}かい あそぶと、しゃしんの ポーズを おぼえるよ。</p>` : ""}
      ${cat === "home" ? `<p class="note">${ui.esc(BCT.HABITATS[s.pet.type])}（${ui.esc(pets.TYPES[s.pet.type].motif)}の すみか）に おく アイテムだよ。おくと ようせいが そばで あそぶよ。</p>` : ""}
      ${cat === "food" ? `<p class="note">ドロップを ようせいに あげると けいけんちが ふえて、しんか に ちかづくよ。ホームで ようせいへ ドラッグしてね。</p>` : ""}
      ${`<div class="shop-grid">${(cat === "food" || cat === "all" ? BCT.CONFIG.foods.map((f) => foodTile(s, coins, f)) : []).join("")}${(cat === "food" ? [] : items).map((it) => {
        const have = game.owns(s, it.id);
        const worn = s.equip[it.slot] === it.id;
        const price = have ? (worn ? "つけてる" : "もってる") : BCT.medal.amount(it.price);
        return `<button class="shop-item ${have ? "have" : ""} ${!have && coins < it.price ? "short" : ""}" data-item="${it.id}">
          <span class="art">${BCT.art.itemIcon(it.id, s.pet.type)}</span>
          <span class="nm">${ui.esc(it.name)}</span><span class="pr">${price}</span></button>`;
      }).join("")}</div>`}
      <div class="btn-row" style="margin-top:14px">
        <button class="btn ghost" data-go-dress>${BCT.art.icon("dress")} きせかえ</button>
        <button class="btn ghost" data-go-mission>${BCT.art.icon("mission")} ミッション</button>
      </div>`;
    $("shopBody").querySelector("[data-shop-home]").onclick = () => ui.show("home");
    document.querySelectorAll("#shopBody [data-cat]").forEach((b) => (b.onclick = () => { cat = b.dataset.cat; render(); }));
    document.querySelectorAll("#shopBody [data-item]").forEach((b) => (b.onclick = () => detail(b.dataset.item)));
    document.querySelectorAll("#shopBody [data-food-item]").forEach((b) => (b.onclick = () => foodDetail(b.dataset.foodItem)));
    $("shopBody").querySelector("[data-go-dress]").onclick = () => ui.show("dress");
    $("shopBody").querySelector("[data-go-mission]").onclick = () => ui.show("mission");
  }

  async function detail(id) {
    const s = BCT.store.get();
    const it = BCT.itemOf(id);
    const have = game.owns(s, id);
    const chk = game.canBuy(s, id);
    const worn = s.equip[it.slot] === id;
    let note = "";
    if (it.slot === "toy") note = `${BCT.CONFIG.toyUnlockPlays}かい あそぶと「${ui.esc(BCT.poseName(id, s.pet.type))}」の ポーズを おぼえるよ`;
    if (!have && chk.err === "coins") note = `<span class="short-note">あと ${BCT.medal.amount(chk.need)} たりないよ。<br>ミッションで あつめよう！</span>`;
    if (it.slot === "home" && !(!have && chk.err === "coins")) note = `すみかに おくと、ようせいが そばで「${ui.esc(it.actName)}」よ`;
    if (have) note = it.slot === "toy" ? "もっているよ。ホームの「あそぶ」で つかえるよ"
      : it.slot === "home" ? "もっているよ。すみかに おいて あそぼう"
      : "もっているよ。いつでも むりょうで つけかえ できるよ";
    const buttons = [{ label: "とじる", cls: "ghost", value: null }];
    if (!have) buttons.push({ label: "かう", medals: it.price, cls: "mint", value: "buy", disabled: !chk.ok });
    else if (BCT.EQUIP_SLOTS.includes(it.slot)) buttons.push(worn ? { label: "はずす", cls: "peach", value: "off" } : { label: "つける", cls: "mint", value: "on" });
    else if (it.slot === "home") buttons.push({ label: "すみかへ", cls: "mint", value: "home" });
    const act = await ui.modal(
      `<h3>${ui.esc(it.name)}</h3>
       <div class="detail-prev">${preview(s, it)}</div>
       <p class="price-line">${have ? "✓ もってる" : `${BCT.medal.amount(it.price)} たんけんたいメダル`}</p>
       ${note ? `<p class="lead">${note}</p>` : ""}`,
      buttons
    );
    if (act === "buy") return buy(id);
    if (act === "home") return goHome(id);
    if (act === "on") return ui.show("dress", { slot: it.slot, equip: id });
    if (act === "off") { game.equip(it.slot, null); render(); }
  }

  async function buy(id) {
    const r = game.buy(id); // のこりを たしかめて 1かいだけ ひく
    if (!r.ok) {
      await ui.modal(`<h3>かえなかったよ</h3><p class="lead short-note">${r.err === "coins" ? `あと ${BCT.medal.amount(r.need)} たりないよ。<br>ミッションで あつめよう！` : ERR[r.err] || "もういちど ためしてね"}</p>`,
        [{ label: "とじる", cls: "ghost", value: null }]);
      return render();
    }
    const it = r.item;
    const s = BCT.store.get();
    render();
    const buttons = [{ label: "あとで", cls: "ghost", value: null }];
    if (BCT.EQUIP_SLOTS.includes(it.slot)) buttons.push({ label: "いま つける", cls: "mint", value: "on" });
    if (it.slot === "toy") buttons.push({ label: "ホームで あそぶ", cls: "mint", value: "play" });
    if (it.slot === "home") buttons.push({ label: "すみかに おく", cls: "mint", value: "home" });
    const act = await ui.modal(
      `<h3>${BCT.art.icon("shop")} かったよ！</h3>
       <div class="detail-prev">${preview(s, it)}</div>
       <p style="text-align:center;font-weight:800;font-size:19px;margin:4px 0">${ui.esc(it.name)}</p>
       <p class="lead">のこり ${BCT.medal.amount(r.coins)}</p>`,
      buttons
    );
    if (act === "on") ui.show("dress", { slot: it.slot, equip: id });
    if (act === "play") ui.show("home");
    if (act === "home") goHome(id);
  }

  // すみかに おいて すみかの 画面へ
  function goHome(id) {
    const s = BCT.store.get();
    if (!s.habitat[id]) game.placeHome(id, 0.25 + Math.random() * 0.5, 0.5 + Math.random() * 0.3);
    ui.show("habitat");
  }

  // ---------------- ドロップ（きえもの。なんこでも かえる）：ほかの アイテムと おなじ タイル → 説明と「とじる」「かう」 ----------------
  function foodTile(s, coins, f) {
    return `<button class="shop-item food-tile ${coins < f.price ? "short" : ""}" data-food-item="${f.id}">
      <span class="art">${BCT.homeArt.dropSvg(f.id)}</span>
      <span class="nm">${ui.esc(f.name)}</span><span class="pr">${BCT.medal.amount(f.price)}</span>
      <small class="stock">もってる ${game.foodStock(s, f.id)}こ</small></button>`;
  }
  async function foodDetail(id) {
    const s = BCT.store.get();
    const f = BCT.CONFIG.foods.find((x) => x.id === id);
    if (!f) return;
    const coins = game.coins(s);
    const short = coins < f.price;
    const act = await ui.modal(
      `<h3>${ui.esc(f.name)}</h3>
       <div class="detail-prev food-prev">${BCT.homeArt.dropSvg(f.id)}</div>
       <p class="price-line">${BCT.medal.amount(f.price)} たんけんたいメダル</p>
       <p class="lead" style="text-align:center">けいけんち +${f.xp}・${ui.esc(f.note)}<br>もってる ${game.foodStock(s, f.id)}こ</p>
       ${short ? `<p class="lead short-note">あと ${BCT.medal.amount(f.price - coins)} たりないよ。<br>ミッションで あつめよう！</p>`
         : `<p class="note" style="text-align:center">ホームで ようせいへ ドラッグして あげてね</p>`}`,
      [{ label: "とじる", cls: "ghost", value: null }, { label: "かう", medals: f.price, cls: "mint", value: "buy", disabled: short }]
    );
    if (act === "buy") buyFood(id);
  }
  async function buyFood(id) {
    const r = game.buyFood(id);
    if (!r.ok) {
      ui.toast(r.err === "coins" ? `たんけんたいメダルが あと ${r.need}枚 たりないよ` : "かえなかったよ");
      return;
    }
    ui.refreshHeader();
    render();
    // ほかの アイテムと おなじ「かったよ！」の おしらせ
    const go = await ui.modal(
      `<h3>${BCT.art.icon("shop")} かったよ！</h3>
       <div class="detail-prev food-prev">${BCT.homeArt.dropSvg(id)}</div>
       <p style="text-align:center;font-weight:800;font-size:19px;margin:4px 0">${ui.esc(r.food.name)}</p>
       <p class="lead" style="text-align:center">もってる ${r.stock}こ<br>のこり ${BCT.medal.amount(game.coins(BCT.store.get()))}</p>`,
      [{ label: "あとで", cls: "ghost", value: false }, { label: "ホームで あげる", cls: "mint", value: true }]
    );
    if (go) ui.show("home");
  }

  BCT.screens.shop = {
    show(arg) {
      if (arg && CATS.some((c) => c.key === arg)) cat = arg;
      render();
    },
    refresh: render,
  };
})();
