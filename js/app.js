/* 画面の切りかえ・ヘッダー・おしらせ・ごほうびの順番 */
(function () {
  const BCT = (window.BCT = window.BCT || {});
  const $ = (id) => document.getElementById(id);
  BCT.$ = $;

  const NO_TABS = ["egg", "name", "hatch", "photo", "ar"];
  const screens = {}; // name -> { show(), hide(), refresh() }
  let current = null;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ---------------- もどる（ひとつ まえの 画面）----------------
  // 画面を うつる たびに 記録し、ブラウザの「もどる」の 記録にも 1つずつ つむ。
  // Android の もどる・iPhone の Safari の 左はしからの スワイプ・js/swipe-back.js の はしからの スワイプ で 1つ まえへ。
  // たまご・なまえ・たんじょう には もどらない。おしらせ（ウィンドウ）が ひらいて いる ときは まず それを とじる
  const NO_BACK = ["egg", "name", "hatch"];
  let stack = [];
  function back() {
    if ($("modal").classList.contains("show")) {
      closeModal();
      if (BCT._modalResolve) BCT._modalResolve(null);
      return true;
    }
    if (stack.length) {
      show(stack.pop(), undefined, { back: true });
      return true;
    }
    return false;
  }
  window.addEventListener("popstate", () => {
    const wasModal = $("modal").classList.contains("show");
    if (back() && wasModal) {
      try { history.pushState({ bct: stack.length }, ""); } catch (e) { /* なし */ }
    }
  });
  // スワイプで もどる とき：ブラウザの 記録が あれば それで（記録と ずれない）、なければ アプリの 中で
  function swipeBack() {
    if ($("modal").classList.contains("show")) return back();
    if (!stack.length) return false;
    try { history.back(); } catch (e) { back(); }
    return true;
  }
  // ヘッダーの 高さ（ショップの 上の 部分を かためる ときに つかう）
  function topbarVar() {
    const t = document.querySelector(".topbar");
    if (t && t.offsetHeight) document.documentElement.style.setProperty("--topbar-h", t.offsetHeight + "px");
  }
  window.addEventListener("resize", topbarVar);

  function show(name, arg, opts) {
    const prev = current;
    if (prev && prev !== name && screens[prev] && screens[prev].hide) {
      try { screens[prev].hide(); } catch (e) { console.error(e); }
    }
    if (!(opts && opts.back) && prev && prev !== name) {
      if (NO_BACK.includes(name) || NO_BACK.includes(prev)) stack = [];
      else {
        stack.push(prev);
        if (stack.length > 30) stack.shift();
        try { history.pushState({ bct: stack.length }, ""); } catch (e) { /* なし */ }
      }
    }
    current = name;
    document.querySelectorAll(".screen").forEach((el) => el.classList.toggle("active", el.id === "scr-" + name));
    document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("active", b.dataset.go === name));
    $("app").classList.toggle("no-tabs", NO_TABS.includes(name));
    window.scrollTo(0, 0);
    requestAnimationFrame(topbarVar);
    const s = screens[name];
    if (s && s.show) s.show(arg);
  }

  function refreshHeader() {
    const s = BCT.store.get();
    $("tbLv").textContent = "Lv" + BCT.game.level(s);
    // ふえた ときは メダルが とんで 数が ふえる（js/coin-fly.js。SHIKA COLLECTION と おなじ 演出）
    if (BCT.coinFly) BCT.coinFly.update(BCT.game.coins(s));
    else {
      $("tbCoin").innerHTML = BCT.medal.amount(BCT.game.coins(s));
      $("tbCoin").title = BCT.medal.name;
    }
    $("tbTeam").textContent = [s.team.name, s.pet ? s.pet.name : ""].filter(Boolean).join(" ／ ");
  }

  function toast(text) {
    document.querySelectorAll("body > .toast").forEach((t) => t.remove()); // まえの おしらせと かさならない
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1900);
  }

  // モーダル。buttons: [{label, cls, value}] → 押したボタンの value で resolve
  function modal(html, buttons) {
    return new Promise((resolve) => {
      const box = $("modalBox");
      box.innerHTML = html;
      if (buttons && buttons.length) {
        const row = document.createElement("div");
        row.className = "btn-row";
        row.style.marginTop = "16px";
        buttons.forEach((b) => {
          const el = document.createElement("button");
          el.className = "btn " + (b.cls || "");
          el.textContent = b.label;
          if (b.medals != null) el.insertAdjacentHTML('beforeend', ' ' + BCT.medal.amount(b.medals));
          if (b.disabled) el.disabled = true;
          el.onclick = () => { closeModal(); resolve(b.value); };
          row.appendChild(el);
        });
        box.appendChild(row);
      }
      $("modal").classList.add("show");
      box.scrollTop = 0;
      BCT._modalResolve = resolve;
    });
  }
  function closeModal() {
    $("modal").classList.remove("show");
  }

  // ミッションの おしらせ用：けいけんち・たんけんたいメダル
  const gainHtml = (r) => `<p class="gain">${r.xp ? `<span>⭐ けいけんち +${r.xp}</span>` : ""}<span>たんけんたいメダル ${BCT.medal.amount(r.coins, '+')}</span></p>`;

  /*
   * けいけんち・記録が 増えたあとに よぶ。順番に 見せる：
   *   1. レベルアップ（見た目が かわるときは しんかアニメ、それ以外は みじかい おいわい）
   *   2. 達成報酬（非売品アイテム）
   *   3. 称号
   */
  async function afterGain() {
    const s = BCT.store.get();
    if (!s.pet) return;
    const lv = BCT.game.level(s);
    if (lv > s.seenLv) {
      const from = s.seenLv;
      BCT.game.markSeen(lv);
      await BCT.home.celebrate(from, lv);
    }
    for (const id of BCT.game.grantAchievements()) {
      const it = BCT.itemOf(id);
      const st = BCT.store.get();
      const preview = it.slot === "frame" ? BCT.art.itemIcon(id) : BCT.pets.renderState(st, { equip: { [it.slot]: id }, face: "happy" });
      const r = await modal(
        `<h3>${BCT.art.icon('gift')} とくべつな ごほうび！</h3>
         <div class="reward-preview">${preview}</div>
         <p style="text-align:center;font-size:20px;font-weight:800;margin:6px 0">${esc(it.name)}</p>
         <p class="lead">${esc(it.how)}<br>きせかえで いつでも つけられるよ（うっていない とくべつな もの）</p>`,
        [{ label: "あとで", cls: "ghost", value: false }, { label: "つける！", cls: "mint", value: true }]
      );
      if (r) BCT.game.equip(it.slot, id);
    }
    for (const b of BCT.checkBadges()) {
      await modal(
        `<h3>とくべつ しょうごう ゲット！</h3>
         <div class="badge" style="margin:12px 0"><div class="medal painted-medal badge-celebration">${BCT.collectionArt.badge(b.id)}</div></div>
         <p style="text-align:center;font-size:20px;font-weight:800;margin:6px 0">${esc(b.name)}</p>
         <p class="lead">${esc(b.cond)}</p>`,
        [{ label: "やったね！", cls: "mint", value: true }]
      );
    }
    refreshHeader();
  }

  // ---------------- うごきを へらす（端末ごとの設定。OSの設定にも したがう） ----------------
  const PREF_KEY = "bct-prefs";
  function prefs() {
    try { return JSON.parse(localStorage.getItem(PREF_KEY) || "{}") || {}; } catch (e) { return {}; }
  }
  function setPref(k, v) {
    const p = prefs();
    p[k] = v;
    try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch (e) { /* 保存できなくても 今回は 反映 */ }
    applyPrefs(p);
  }
  function applyPrefs(p) {
    document.body.classList.toggle("reduce-motion", !!(p || prefs()).reduceMotion);
  }
  const reducedMotion = () =>
    document.body.classList.contains("reduce-motion") ||
    (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  function start() {
    applyPrefs();
    const s = BCT.store.load();
    document.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => show(b.dataset.go)));
    // 下の タブの ようせい・すみか：押したら そのまま その 画面へ（2026-10-21 利用者の 指示）。
    //   js/companions.js の「どの相棒にする？」は 出さない（相棒は ようせい・すみか の 画面の 中で えらびなおせる）。
    //   document の capture で うけて、ボタンに ついた companions.js の 処理まで とどかせない
    document.addEventListener("click", (e) => {
      const t = e.target.closest && e.target.closest(".tabs #actFairy, .tabs #actHabitat");
      if (!t) return;
      e.stopPropagation();
      show(t.dataset.go);
    }, true);
    // モーダルの中の [data-close] を押したら とじる
    $("modalBox").addEventListener("click", (e) => {
      if (e.target.closest("[data-close]")) {
        closeModal();
        if (BCT._modalResolve) BCT._modalResolve();
      }
    });
    BCT.store.onChange((st, info) => {
      refreshHeader();
      // ほかのタブで 変わったら いまの画面を 描きなおす
      if (info.external && screens[current] && screens[current].refresh) screens[current].refresh();
    });
    refreshHeader();
    show(s.pet ? "home" : "egg");
    // Service Worker の 登録と 更新の おしらせは js/update.js
  }

  BCT.ui = { show, toast, modal, closeModal, esc, gainHtml, refreshHeader, current: () => current, reducedMotion, back, swipeBack, canBack: () => stack.length > 0 };
  BCT.prefs = { get: prefs, set: setPref };
  BCT.screens = screens;
  BCT.afterGain = afterGain;
  BCT.start = start;
})();
