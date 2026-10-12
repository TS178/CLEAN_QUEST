/*
 * すみか：ショップで かった すみかの アイテムを おいて、ようせいが そばで あそぶ
 * ------------------------------------------------------------
 * - イルカ「ラグーン・オーシャン」・ウミガメ「アクア・ガーデン」・ヤドカリ「ビーチ・ヴィレッジ」
 * - アイテムは ドラッグで うごかせる（置き場所は 保存。js/game.js の placeHome）
 * - ようせいは ときどき アイテムの そばへ 行って、そのアイテムの うごき（くぐる・ねる・のぼる…）を する
 * - アイテムを タップすると、ようせいが そこへ あそびに 行く
 */
(function () {
  const BCT = window.BCT;
  const { $, ui, game, pets } = BCT;
  const H = BCT.homeArt;
  const scene = $("hbScene");
  const petEl = $("hbPet");
  let timer = null;
  let acting = null;       // いま している うごき
  let actTimer = null;
  let pos = { x: 0.5, y: 0.75 };
  let shownX = 0.5;        // いま 表示している 横の 位置（向きを きめる）
  // パーツで うごかす ようせい（移動している あいだだけ。止まったら 正面の絵。js/pet-rig.js）
  let rig = null;
  let moveTimer = null;
  const MOVE_MS = 1100;    // css/beach.css の .hb-pet の transition と そろえる
  let lastTurn = 0;        // 最後に 向きを かえた 時刻（自分で うごくときは 30秒に 1回ほど。js/pet-rig-config.js の turnEveryMs）
  const turnOk = () => !BCT.petRig || Date.now() - lastTurn >= BCT.petRig.turnEvery();
  const ACTS = ["through", "ride", "climb", "rest", "look", "sleep", "sit", "hide"];

  function render() {
    const s = BCT.store.get();
    if (!s.pet) return;
    $("hbTitle").textContent = `${BCT.HABITATS[s.pet.type]}`;
    $("hbBg").innerHTML = H.habitatBg(s.pet.type);
    $("hbItems").innerHTML = Object.entries(s.habitat).map(([id, p]) =>
      `<button class="hb-item" data-hb="${id}" style="left:${(p.x * 100).toFixed(1)}%;top:${(p.y * 100).toFixed(1)}%"
        aria-label="${ui.esc(BCT.itemOf(id).name)}">${H.homeItemSvg(id)}</button>`).join("");
    const lv = Math.min(s.seenLv, game.level(s));
    $("hbPetBody").innerHTML = pets.renderState(s, { lv, face: "happy" });
    petEl.dataset.type = s.pet.type;
    if (BCT.petRig) rig = BCT.petRig.sync(rig, { type: s.pet.type, stage: game.stageOf(lv), equip: s.equip, host: $("hbPetFace"), track: petEl, owner: petEl });
    placePet(false);
    const owned = game.ownedItems(s, "home");
    $("hbTray").innerHTML = owned.length
      ? owned.map((it) => {
          const on = !!s.habitat[it.id];
          return `<div class="hb-card ${on ? "on" : ""}"><span class="art">${H.homeItemSvg(it.id)}</span>
            <span class="nm">${ui.esc(it.name)}<br><small>${ui.esc(it.actName)}</small></span>
            <button class="btn small ${on ? "ghost" : "mint"}" data-hb-toggle="${it.id}">${on ? "しまう" : "おく"}</button></div>`;
        }).join("")
      : `<p class="lead">まだ もっていないよ。ショップの「すみか」で かえるよ。</p>
         <button class="btn block ghost" data-hb-shop>ショップの すみかへ</button>`;
    $("hbHint").textContent = Object.keys(s.habitat).length
      ? "アイテムは ドラッグで うごかせるよ。タップすると ようせいが あそびに いくよ"
      : owned.length ? "「おく」を おすと すみかに おけるよ" : `${pets.TYPES[s.pet.type].motif}の ようせい せんようの すみかだよ`;
  }

  function placePet(animate) {
    if (animate && BCT.petRig) {
      // 先に パーツ表示に してから 向きを かえる（パーツ表示の あいだは 向きを 一瞬で かえる）
      BCT.petRig.setActive(rig, true);
      clearTimeout(moveTimer);
      moveTimer = setTimeout(() => BCT.petRig.setActive(rig, false), MOVE_MS);
    }
    if (animate && Math.abs(pos.x - shownX) > 0.02 && (pos.x < shownX) !== petEl.classList.contains("left")) {
      petEl.classList.toggle("left", pos.x < shownX);
      lastTurn = Date.now();
    }
    shownX = pos.x;
    petEl.classList.toggle("moving", !!animate);
    petEl.style.left = (pos.x * 100).toFixed(1) + "%";
    petEl.style.top = (pos.y * 100).toFixed(1) + "%";
  }
  // 吹き出しの 大きさを はかってから 置く（ながい セリフでも けしきから はみださない）：
  // ようせいの うえに 入らなければ したへ。左右も けしきの 中へ
  function say(text) {
    const el = $("hbSay");
    el.textContent = text;
    el.hidden = false;
    el.classList.remove("below");
    el.style.width = "";
    el.style.left = "0px";
    const W = scene.clientWidth, H = scene.clientHeight;
    const bw = Math.min(el.offsetWidth, W - 12);
    el.style.width = bw + "px";
    const bh = el.offsetHeight;
    const sr = scene.getBoundingClientRect(), pr = petEl.getBoundingClientRect();
    let y = pr.top - sr.top + 4; // 吹き出しの した
    if (y - bh < 6) {
      el.classList.add("below");
      y = Math.max(6, Math.min(H - bh - 6, pr.bottom - sr.top - 4));
    }
    el.style.left = Math.max(bw / 2 + 6, Math.min(W - bw / 2 - 6, (pr.left + pr.right) / 2 - sr.left)) + "px";
    el.style.top = y + "px";
    clearTimeout(say.t);
    say.t = setTimeout(() => { el.hidden = true; }, 2600);
  }
  function stopAct() {
    clearTimeout(actTimer);
    ACTS.forEach((a) => petEl.classList.remove("act-" + a));
    acting = null;
  }

  // アイテムの そばの 立ち位置。アイテムの すこし まえ（下）に 立つ。くぐる・のる・のぼる・はいる は アイテムの 上に かさなる
  function spotOf(s, id) {
    const p = s.habitat[id];
    const it = BCT.itemOf(id);
    if (!p || !it) return null;
    const onTop = ["ride", "climb", "hide", "through"].includes(it.act);
    return { x: Math.max(0.1, Math.min(0.9, p.x + (onTop ? 0 : 0.14))), y: Math.max(0.2, Math.min(0.92, p.y + (onTop ? 0 : 0.05))) };
  }
  // 向きを かえずに 行けるか（向いている ほう、または ほぼ まうえ・まうしたに ある）
  function ahead(spot) {
    return Math.abs(spot.x - shownX) <= 0.02 || (spot.x < shownX) === petEl.classList.contains("left");
  }

  // アイテムの そばへ 行って うごきを する（タップされたときは うしろでも ふりむいて 行く）
  function goTo(id) {
    const s = BCT.store.get();
    const it = BCT.itemOf(id);
    const spot = spotOf(s, id);
    if (!spot) return;
    stopAct();
    acting = id;
    pos = spot;
    placePet(true);
    const wait = ui.reducedMotion() ? 50 : 1100;
    actTimer = setTimeout(() => {
      if (acting !== id) return;
      petEl.classList.add("act-" + it.act);
      say(`${s.pet.name}が ${it.actName}`);
      actTimer = setTimeout(() => { if (acting === id) stopAct(); }, ui.reducedMotion() ? 800 : 3200);
    }, wait);
  }
  function wander() {
    // アイテムへ むかっている・あそんでいる あいだは じゃましない（タップした すぐあとに 自分で うごきだして やめて しまわない）
    if (ui.current() !== "habitat" || dragging || acting) return;
    const s = BCT.store.get();
    // 自分で うごくときは、向きを かえて よい 時間に なるまで 前に ある アイテムだけ
    const ids = Object.keys(s.habitat).filter((id) => turnOk() || (spotOf(s, id) && ahead(spotOf(s, id))));
    if (ids.length && Math.random() < 0.65) return goTo(ids[Math.floor(Math.random() * ids.length)]);
    stopAct();
    const x = BCT.petRig
      ? BCT.petRig.nextX(shownX, 0.15, 0.85, petEl.classList.contains("left"), turnOk(), Math.random()).x
      : 0.15 + Math.random() * 0.7;
    pos = { x, y: 0.55 + Math.random() * 0.35 };
    placePet(true);
  }

  // ---------------- アイテムを うごかす ----------------
  let dragging = null;
  scene.addEventListener("pointerdown", (e) => {
    const el = e.target.closest("[data-hb]");
    if (!el) return;
    e.preventDefault();
    const r = scene.getBoundingClientRect();
    dragging = { id: el.dataset.hb, el, x0: e.clientX, y0: e.clientY, moved: 0, r };
    try { scene.setPointerCapture(e.pointerId); } catch (err) { /* なし */ }
  });
  scene.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const d = dragging;
    d.moved = Math.max(d.moved, Math.hypot(e.clientX - d.x0, e.clientY - d.y0));
    if (d.moved < 8) return;
    d.el.classList.add("dragging");
    d.el.style.left = (((e.clientX - d.r.left) / d.r.width) * 100).toFixed(1) + "%";
    d.el.style.top = (((e.clientY - d.r.top) / d.r.height) * 100).toFixed(1) + "%";
  });
  scene.addEventListener("pointerup", (e) => {
    const d = dragging;
    dragging = null;
    if (!d) return;
    d.el.classList.remove("dragging");
    if (d.moved < 8) return goTo(d.id); // タップ → あそびに 行く
    game.placeHome(d.id, (e.clientX - d.r.left) / d.r.width, (e.clientY - d.r.top) / d.r.height);
    render();
  });
  scene.addEventListener("pointercancel", () => { dragging = null; render(); });
  // ぴょんと はねる 演出（タップ・移動）の 目印は、おわったら はずす（のこっていると すみかに もどった ときに また はねる）
  for (const type of ["animationend", "animationcancel"]) {
    petEl.addEventListener(type, (e) => {
      if (e.animationName === "hbHop") petEl.classList.remove("joy", "moving");
    });
  }
  // ようせいは アイテムに かさなるので 指は アイテムに とどくように して、ようせいの タップは 位置で みる
  scene.addEventListener("click", (e) => {
    if (e.target.closest("[data-hb]")) return;
    const r = petEl.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
    petEl.classList.remove("joy");
    void petEl.offsetWidth;
    petEl.classList.add("joy");
    const s = BCT.store.get();
    say(pets.randomLine(s.pet.type, s.team.name));
  });

  $("hbTray").addEventListener("click", (e) => {
    const t = e.target.closest("[data-hb-toggle]");
    if (t) {
      const id = t.dataset.hbToggle;
      const s = BCT.store.get();
      if (s.habitat[id]) { game.removeHome(id); if (acting === id) stopAct(); }
      else {
        game.placeHome(id, 0.2 + Math.random() * 0.6, 0.45 + Math.random() * 0.35);
        render();
        return goTo(id);
      }
      return render();
    }
    if (e.target.closest("[data-hb-shop]")) ui.show("shop", "home");
  });

  BCT.habitat = { render, goTo, state: () => ({ pos, acting }) };
  BCT.screens.habitat = {
    show() {
      stopAct();
      pos = { x: 0.5, y: 0.75 };
      shownX = pos.x;
      petEl.classList.remove("left");
      lastTurn = Date.now();
      render();
      clearInterval(timer);
      timer = setInterval(wander, 5200);
      setTimeout(wander, 1500); // まず 正面を むいた すがたを 見せてから うごきだす
    },
    hide() {
      clearInterval(timer);
      timer = null;
      stopAct();
      clearTimeout(moveTimer);
      if (BCT.petRig) BCT.petRig.setActive(rig, false);
      petEl.classList.remove("joy", "moving");
    },
    refresh: render,
  };
})();
