/*
 * ホームの ビーチ：時間で よごれる → ゴミを 分別ゴミばこへ（ドラッグ・スワイプ） → たんけんたいメダル
 *                  エサ（アクアドロップ）を ようせいへ ドラッグ → けいけんち → 進化
 * ------------------------------------------------------------
 * - ゴミは ドラッグ して ゴミばこに はなす か、ゴミばこの ほうへ はじく（スワイプ）。
 *   タップで えらんで → ゴミばこを タップ でも すてられる（ゆびを うごかすのが にがての 子のため）。
 * - まちがえても なにも へらない。正しい ゴミばこを ひからせて おしえる。
 * - エサも ドラッグ（または タップで えらんで → ようせいを タップ）。
 * - 計算と保存は js/game.js（tickBeach / sortTrash / feed）。ここは 画面だけ。
 * - 画面の中の 海の よごれは ゲームの 演出で、実際の 海の ようすを はかったものでは ない。
 */
(function () {
  const BCT = window.BCT;
  const { $, ui, game, pets } = BCT;
  const H = BCT.homeArt;
  const layer = $("beachTrash");
  const SAND_TOP = 0.66, SAND_H = 0.29; // ゴミを おく 砂浜の はんい（池の 高さに 対する 割合）
  const SORT_LINES = ["ありがとう！ ピカピカだね", "すごい！ ただしく わけられたね", "うみが よろこんでるよ！", "その ちょうし！"];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  // 〜ふん／〜ぷん（1ぷん・2ふん・3ぷん・4ぷん・5ふん・6ぷん・7ふん・8ぷん・9ふん・10ぷん …）
  const funPun = (n) => `${n}${[2, 5, 7, 9].includes(n % 10) ? "ふん" : "ぷん"}`;
  let timer = null;
  let selected = null; // { kind: "trash" | "food", id }

  // ---------------- 時間で よごれる ----------------
  function tick(now) {
    const r = game.tickBeach(now);
    if (r.ok && r.added > 0 && ui.current() === "home") {
      render();
      BCT.home.drawPet();
      BCT.home.say("あれ？ ゴミが ながれついたよ…");
    }
    return r;
  }
  function show() {
    // 画面に もどった ときは ゴミばこを うごかさず、いまの 状態で 出す
    clearTimeout(binsTimer);
    binsShown = null;
    tick();
    render();
    clearInterval(timer);
    timer = setInterval(() => { tick(); renderStatus(); }, 20000);
  }
  function hide() {
    clearInterval(timer);
    timer = null;
    cancelDrag();
    select(null);
    clearBinFx();
    clearTimeout(binsTimer);
  }

  /*
   * ゴミばこは よごれている あいだだけ 出す（css/beach.css の .bins-wrap）
   *   きれいに なったら、ゴミを のみこむ 演出の あとで 高さと 透明度を なめらかに しぼって しまう。
   *   また よごれたら なめらかに 出す。画面に もどった ときは うごかさずに いまの 状態で 出す。
   */
  let binsShown = null;   // null … まだ 出していない（つぎは うごかさずに 出す）
  let binsTimer = null;
  const BIN_HIDE_DELAY = 700; // ゴミを のみこむ 演出（0.45秒）と ゴミが とんでいく（0.3秒）の あと
  function showBins(on) {
    clearTimeout(binsTimer);
    const wrap = $("binsWrap");
    // しぼる 高さの 上限は ゴミばこの 本当の 高さ（＋大きく なる 演出の 余白）。決めうち だと 切れたり、うごきだしが おくれたり する
    const bh = $("bins").getBoundingClientRect().height;
    if (bh > 0) wrap.style.setProperty("--bins-h", Math.ceil(bh + 24) + "px");
    if (on === binsShown) return;
    const apply = () => {
      binsShown = on;
      wrap.classList.toggle("gone", !on);
      wrap.inert = !on; // しまっている あいだは さわれない・読みあげない
    };
    if (binsShown === null || ui.reducedMotion()) {
      wrap.classList.add("instant");
      apply();
      void wrap.offsetWidth;
      wrap.classList.remove("instant");
    } else if (on) apply();
    else binsTimer = setTimeout(apply, BIN_HIDE_DELAY);
  }

  // ゴミばこの 演出（ヒントの 点滅・ゴミを のみこむ）の 目印は、おわったら はずす。
  // のこっていると、ホームに もどって ゴミばこが また 表示された ときに 演出が もう一度 うごいてしまう
  const BIN_FX = { binHint: "hint", gulp: "gulp" };
  function clearBinFx() {
    document.querySelectorAll(".bin.hint, .bin.gulp").forEach((e) => e.classList.remove("hint", "gulp"));
  }
  for (const type of ["animationend", "animationcancel"]) {
    $("bins").addEventListener(type, (e) => {
      const bin = e.target.closest(".bin");
      if (bin && BIN_FX[e.animationName]) bin.classList.remove(BIN_FX[e.animationName]);
    });
  }

  // ---------------- 描く ----------------
  function render() {
    const s = BCT.store.get();
    if (!s.pet) return;
    layer.innerHTML = s.beach.dirt.map((d) => {
      const t = BCT.beachTrashOf(d.kind);
      return `<button class="trash-piece" data-trash="${d.id}" data-sand-x="${d.x}" data-sand-y="${d.y}" aria-label="${ui.esc(t.name)}"
        style="left:${(d.x * 100).toFixed(1)}%;top:${((SAND_TOP + d.y * SAND_H) * 100).toFixed(1)}%">${H.trashSvg(d.kind)}</button>`;
    }).join("");
    if (!$("bins").children.length) {
      $("bins").innerHTML = BCT.BINS.map((b) => `<button class="bin" data-bin="${b.key}" style="--bin:${b.color}" aria-label="${ui.esc(b.name)}の ゴミばこ">
        ${H.binSvg(b.key)}<span>${ui.esc(b.name)}</span></button>`).join("");
    }
    showBins(s.beach.dirt.length > 0);
    renderStatus();
    renderFood();
    layoutTrash();
  }
  // ゴミは元の砂浜の位置へ表示し、端からはみ出さないようにする。
  function layoutTrash() {
    const w = layer.clientWidth, h = layer.clientHeight;
    if (!w || !h) return;
    layer.querySelectorAll("[data-trash]").forEach((el) => {
      const radius = el.offsetWidth / 2 + 6; // ゆれ・選択時の拡大も含める
      const nx = Number(el.dataset.sandX), ny = Number(el.dataset.sandY);
      const x = Math.max(radius, Math.min(w - radius, nx * w));
      const y = Math.max(radius, Math.min(h - radius, (SAND_TOP + ny * SAND_H) * h));
      el.style.left = x + "px";
      el.style.top = y + "px";
    });
  }
  new ResizeObserver(layoutTrash).observe($("pond"));
  function renderStatus() {
    const s = BCT.store.get();
    if (!s.pet) return;
    const lv = game.dirtLevel(s), max = BCT.CONFIG.beach.maxLevel;
    const dots = Array.from({ length: max }, (_, i) => `<i class="${i < lv ? "on" : ""}"></i>`).join("");
    const next = game.nextDirtIn(s);
    const mins = next == null ? null : Math.max(1, Math.ceil(next / 60000));
    $("beachStatus").innerHTML = lv > 0
      ? `<span class="dirt">${BCT.art.icon('dirty')} よごれ ${dots}</span> <b>ゴミを ゴミばこへ ドラッグ！</b>`
      : `<span class="dirt clean">${BCT.art.icon('sparkling')} ピカピカ</span>${mins ? ` <span class="next">つぎの ゴミまで あと ${funPun(mins)}</span>` : ""}`;
  }
  function renderFood() {
    const s = BCT.store.get();
    const foods = BCT.CONFIG.foods;
    const any = foods.some((f) => game.foodStock(s, f.id) > 0);
    $("foodTray").innerHTML = `<span class="lbl">ごはん</span>` + foods.map((f) => {
      const n = game.foodStock(s, f.id);
      return `<button class="food-item ${n ? "" : "empty"} ${selected && selected.id === f.id ? "sel" : ""}" data-food="${f.id}" aria-label="${ui.esc(f.name)} ${n}こ">
        ${H.dropSvg(f.id)}<small>×${n}</small></button>`;
    }).join("") + (any ? `<span class="hint">ようせいへ ドラッグ！</span>` : `<button class="btn small ghost" data-food-shop>ショップでかう</button>`);
  }

  // ---------------- えらぶ（タップで そうさ） ----------------
  function select(sel) {
    selected = sel;
    document.querySelectorAll(".trash-piece.sel, .food-item.sel").forEach((e) => e.classList.remove("sel"));
    document.querySelectorAll(".bin.ready").forEach((e) => e.classList.remove("ready"));
    $("pet").classList.remove("ready");
    if (!sel) return;
    const el = document.querySelector(sel.kind === "trash" ? `[data-trash="${sel.id}"]` : `[data-food="${sel.id}"]`);
    if (el) el.classList.add("sel");
    if (sel.kind === "trash") document.querySelectorAll(".bin").forEach((e) => e.classList.add("ready"));
    else $("pet").classList.add("ready");
  }

  // ---------------- ドラッグ・スワイプ ----------------
  let drag = null;
  function cancelDrag() {
    if (!drag) return;
    drag.ghost.remove();
    drag.el.classList.remove("dragging");
    drag = null;
  }
  function startDrag(e, el, kind, id) {
    if (drag || e.button > 0) return;
    const r = el.getBoundingClientRect();
    const ghost = el.cloneNode(true);
    ghost.classList.add("drag-ghost");
    ghost.classList.remove("sel");
    ghost.style.width = r.width + "px";
    ghost.style.height = r.height + "px";
    ghost.style.left = "0px";
    ghost.style.top = "0px";
    document.body.appendChild(ghost);
    drag = { kind, id, el, ghost, ox: e.clientX - r.left, oy: e.clientY - r.top, x0: e.clientX, y0: e.clientY, home: r, pts: [], moved: 0, pid: e.pointerId };
    el.classList.add("dragging");
    moveGhost(e.clientX, e.clientY);
  }
  function moveGhost(x, y) {
    drag.ghost.style.transform = `translate(${x - drag.ox}px, ${y - drag.oy}px)`;
    drag.pts.push({ x, y, t: performance.now() });
    if (drag.pts.length > 6) drag.pts.shift();
    drag.moved = Math.max(drag.moved, Math.hypot(x - drag.x0, y - drag.y0));
    // いま 上に ある ところを ひからせる
    const tgt = targetAt(drag.kind, x, y);
    document.querySelectorAll(".bin.over").forEach((e) => e.classList.remove("over"));
    $("pet").classList.toggle("over", !!tgt && tgt.pet);
    if (tgt && tgt.bin) tgt.el.classList.add("over");
  }
  const inRect = (r, x, y, pad) => x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;
  function targetAt(kind, x, y) {
    if (kind === "trash") {
      for (const el of document.querySelectorAll(".bin")) if (inRect(el.getBoundingClientRect(), x, y, 8)) return { bin: el.dataset.bin, el };
      return null;
    }
    return inRect(BCT.home.petRect(), x, y, 16) ? { pet: true } : null;
  }
  // はじいた むきに ある ゴミばこ（ようせい）を さがす
  function targetBySwipe(kind, x, y) {
    const p = drag.pts;
    if (p.length < 2) return null;
    const a = p[0], b = p[p.length - 1];
    const dt = Math.max(1, b.t - a.t);
    const vx = (b.x - a.x) / dt, vy = (b.y - a.y) / dt;
    if (Math.hypot(vx, vy) < 0.45) return null; // おそい うごきは はじいた ことに しない
    const dir = Math.atan2(vy, vx);
    const cands = kind === "trash"
      ? [...document.querySelectorAll(".bin")].map((el) => ({ bin: el.dataset.bin, el, r: el.getBoundingClientRect() }))
      : [{ pet: true, r: BCT.home.petRect() }];
    let best = null;
    for (const c of cands) {
      const cx = (c.r.left + c.r.right) / 2, cy = (c.r.top + c.r.bottom) / 2;
      let d = Math.abs(Math.atan2(cy - y, cx - x) - dir);
      if (d > Math.PI) d = 2 * Math.PI - d;
      if (d < 0.5 && (!best || d < best.d)) best = Object.assign(c, { d });
    }
    return best;
  }
  function flyGhost(toRect, ok) {
    const g = drag.ghost;
    const tx = toRect.left + toRect.width / 2 - drag.home.width / 2, ty = toRect.top + toRect.height / 2 - drag.home.height / 2;
    g.style.transition = "transform .3s ease-in, opacity .3s";
    g.style.transform = `translate(${tx}px, ${ty}px) scale(${ok ? 0.2 : 1})`;
    if (ok) g.style.opacity = "0";
    const d = drag;
    drag = null;
    setTimeout(() => { d.ghost.remove(); d.el.classList.remove("dragging"); }, ui.reducedMotion() ? 0 : 320);
  }

  document.addEventListener("pointerdown", (e) => {
    if (ui.current() !== "home") return;
    const t = e.target.closest("[data-trash]");
    const f = e.target.closest("[data-food]");
    if (t) startDrag(e, t, "trash", t.dataset.trash);
    else if (f && !f.classList.contains("empty")) startDrag(e, f, "food", f.dataset.food);
  });
  document.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.pid) return;
    e.preventDefault();
    moveGhost(e.clientX, e.clientY);
  }, { passive: false });
  document.addEventListener("pointerup", (e) => {
    if (!drag || e.pointerId !== drag.pid) return;
    document.querySelectorAll(".bin.over").forEach((x) => x.classList.remove("over"));
    $("pet").classList.remove("over");
    const { kind, id } = drag;
    if (drag.moved < 10) { // うごかさなかった → タップで えらぶ
      cancelDrag();
      select(selected && selected.id === id ? null : { kind, id });
      return;
    }
    const tgt = targetAt(kind, e.clientX, e.clientY) || targetBySwipe(kind, e.clientX, e.clientY);
    if (!tgt) return flyGhost(drag.home, false);
    if (kind === "trash") sortTo(id, tgt.bin, tgt.el);
    else feedPet(id);
  });
  document.addEventListener("pointercancel", cancelDrag);

  // タップ操作：えらんだ ゴミ → ゴミばこ ／ えらんだ エサ → ようせい
  document.addEventListener("click", (e) => {
    if (ui.current() !== "home") return;
    const bin = e.target.closest("[data-bin]");
    if (bin && selected && selected.kind === "trash") return sortTo(selected.id, bin.dataset.bin, bin);
    if (e.target.closest("[data-food-shop]")) return ui.show("shop", "food");
    const f = e.target.closest("[data-food]");
    if (f && f.classList.contains("empty")) return ui.show("shop", "food");
  });
  $("pet").addEventListener("click", (e) => {
    if (selected && selected.kind === "food") {
      e.stopImmediatePropagation(); // なでる では なく エサ
      feedPet(selected.id);
    }
  }, true);

  // ---------------- すてる ----------------
  function sortTo(id, binKey, binEl) {
    select(null);
    const r = game.sortTrash(id, binKey);
    const s = BCT.store.get();
    if (!r.ok) {
      if (drag) flyGhost(drag.home, false);
      if (r.err === "wrong") {
        const right = BCT.binOf(r.bin);
        const el = document.querySelector(`[data-bin="${r.bin}"]`);
        if (el) { el.classList.remove("hint"); void el.offsetWidth; el.classList.add("hint"); }
        BCT.home.say(`これは「${right.name}」の ゴミばこ だよ`);
      } else render();
      return r;
    }
    if (drag) flyGhost(binEl.getBoundingClientRect(), true);
    binEl.classList.remove("gulp");
    void binEl.offsetWidth;
    binEl.classList.add("gulp");
    ui.toast(`+${r.points} たんけんたいメダル`);
    render();
    ui.refreshHeader();
    BCT.home.render();
    if (r.cleaned) {
      BCT.home.react(null, "ビーチが ピカピカに なった！ ありがとう！");
      sparkleAll();
      if (r.first) setTimeout(inviteQuiz, ui.reducedMotion() ? 200 : 1400);
    } else {
      BCT.home.react(null, pick(SORT_LINES));
    }
    return r;
  }
  function sparkleAll() {
    const el = document.createElement("div");
    el.className = "beach-shine";
    $("pond").appendChild(el);
    setTimeout(() => el.remove(), 1600);
  }
  async function inviteQuiz() {
    const s = BCT.store.get();
    const go = await ui.modal(
      `<h3>ビーチが ピカピカに なったね！</h3>
       <div class="reward-preview">${pets.renderState(s, { face: "happy" })}</div>
       <p class="lead" style="color:var(--ink)">「${ui.esc(s.pet.name)}」が いってるよ：<br>
         「うみの ことを もっと しりたいな！ いっしょに うみクイズに ちょうせん しよう！」</p>
       <p class="note" style="text-align:center">クイズに せいかい すると ボーナスの たんけんたいメダルが もらえるよ</p>`,
      [{ label: "あとで", cls: "ghost", value: false }, { label: "クイズへ", cls: "peach", value: true }]
    );
    if (go) ui.show("mission");
  }

  // ---------------- エサを あげる ----------------
  async function feedPet(id) {
    select(null);
    const r = game.feed(id);
    if (!r.ok) {
      if (drag) flyGhost(drag.home, false);
      if (r.err === "empty") ui.toast("ごはんが ないよ。ショップで かえるよ");
      return r;
    }
    if (drag) flyGhost(BCT.home.petRect(), true);
    const f = r.food;
    BCT.home.react({ eat: true, color: f.color === "rainbow" ? "#ffd86b" : f.color }, `${f.name}、おいしい！`);
    ui.toast(`けいけんち +${r.xp}`);
    renderFood();
    ui.refreshHeader();
    BCT.home.render();
    if (r.lvAfter > r.lvBefore) {
      await new Promise((res) => setTimeout(res, ui.reducedMotion() ? 100 : 1300));
      await BCT.afterGain();
    }
    return r;
  }

  BCT.beach = { show, hide, render, tick, sortTo, feedPet, select, funPun };
})();
