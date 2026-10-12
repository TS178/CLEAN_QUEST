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

  function show(name, arg) {
    const prev = current;
    if (prev && prev !== name && screens[prev] && screens[prev].hide) {
      try { screens[prev].hide(); } catch (e) { console.error(e); }
    }
    current = name;
    document.querySelectorAll(".screen").forEach((el) => el.classList.toggle("active", el.id === "scr-" + name));
    document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("active", b.dataset.go === name));
    $("app").classList.toggle("no-tabs", NO_TABS.includes(name));
    window.scrollTo(0, 0);
    const s = screens[name];
    if (s && s.show) s.show(arg);
  }

  function refreshHeader() {
    const s = BCT.store.get();
    $("tbLv").textContent = "Lv" + BCT.game.level(s);
    $("tbCoin").innerHTML = BCT.medal.amount(BCT.game.coins(s));
    $("tbCoin").title = BCT.medal.name;
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

    if ("serviceWorker" in navigator && location.protocol !== "file:") {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("service-worker.js").catch((e) => console.warn("SW", e));
      });
    }
  }

  BCT.ui = { show, toast, modal, closeModal, esc, gainHtml, refreshHeader, current: () => current, reducedMotion };
  BCT.prefs = { get: prefs, set: setPref };
  BCT.screens = screens;
  BCT.afterGain = afterGain;
  BCT.start = start;
})();
