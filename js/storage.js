/*
 * 保存（すべて この端末の中だけ。サーバーには送らない）
 *   - 育成・記録など … LocalStorage（キー1つ。まとめて1回で書く）
 *   - ゴミの写真      … IndexedDB（LocalStorage は容量が小さいため）
 *   - 記念写真は保存しない（利用者が端末に保存するまでメモリの中だけ）
 *
 * メダルは受け取った報酬・購入記録から計算する。既存の1匹の経験値は従来の台帳を使用。
 * 2匹目を迎えた時に経験値を相棒ごとに確定し、以後の報酬はお世話中の相棒へ加算する。
 */
(function () {
  const BCT = (window.BCT = window.BCT || {});
  const KEY = "bct-state";
  const OLD_KEY = "bct-state-v1";
  const BROKEN_KEY = "bct-state-broken";
  const SCHEMA = 2;
  const listeners = [];

  function newId() {
    try {
      if (crypto.randomUUID) return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    } catch (e) { /* 下へ */ }
    return (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)).slice(-12);
  }

  function blank() {
    return {
      v: SCHEMA,
      id: newId(),            // 端末ごとの ID（運営画面で 同じ隊を 上書きするため）
      createdAt: Date.now(),
      eventId: BCT.CONFIG.event.id,
      pet: null,              // { type, name }
      petXp: null,            // null: legacy ledger; number: this companion's XP
      companions: {},         // inactive companions; shared inventory stays at the top level
      companionOrder: [],
      team: { name: "", members: 0 },
      seenLv: 1,              // レベルアップ演出を 見せた レベル
      claims: {},             // "イベントID:種類:ID" → { xp, coins, t }  受け取った報酬
      owned: {},              // アイテムID → { t, price, via: "shop" | "gift" | "reward" }
      equip: { head: null, acc: null, look: null, frame: null },
      affection: 0,           // なでた回数（上限あり）
      toys: {},               // おもちゃID → あそび終えた回数
      quiz: { streak: 0, best: 0 }, // まちがえずに つづけて せいかいした数
      truckShoot: { version: 1, plays: 0, bestScore: 0, bestCombo: 0, bestStars: 0, lastResult: null },
      plaBusters: { version: 1, plays: 0, bestScore: 0, bestCombo: 0, bestStars: 0, lastResult: null }, // ミニゲーム「プラごみバスターズ」（js/plabusters.js）
      records: [],            // { id, t, type, lat, lng, acc, photo }
      badges: [],             // { id, t }
      food: {},               // エサID → { bought, fed, spent, xp }（かった数・あげた数・つかったポイント・ふえた けいけんち）
      beach: { dirt: [], last: 0, points: 0, sorted: 0, cleans: 0, invited: false, treasures: [], treasureCycle: -1 }, // ホームの ビーチ（js/game.js）
      habitat: {},            // すみかの アイテムID → { x, y }（おいた場所 0〜1）
    };
  }

  // ---------------- こわれたデータでも止まらないよう 1つずつ確かめる ----------------
  const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
  const num = (v, def) => (typeof v === "number" && isFinite(v) ? v : def);
  const str = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");
  const TYPES = ["dolphin", "turtle", "hermit"];

  function sanitize(s) {
    const b = blank();
    if (!isObj(s)) return b;
    b.id = str(s.id, 40) || b.id;
    b.createdAt = num(s.createdAt, b.createdAt);
    b.eventId = str(s.eventId, 60) || b.eventId;
    if (isObj(s.pet) && TYPES.includes(s.pet.type)) b.pet = { type: s.pet.type, name: str(s.pet.name, 12) || "ようせい" };
    if (isObj(s.team)) b.team = { name: str(s.team.name, 16), members: Math.max(0, Math.min(99, Math.floor(num(s.team.members, 0)))) };
    b.seenLv = Math.max(1, Math.min(99, Math.floor(num(s.seenLv, 1))));
    if (isObj(s.claims)) {
      for (const [k, c] of Object.entries(s.claims)) {
        if (typeof k === "string" && k.length < 120 && isObj(c)) {
          b.claims[k] = { xp: Math.max(0, num(c.xp, 0)), coins: Math.max(0, num(c.coins, 0)), t: num(c.t, 0) };
        }
      }
    }
    if (isObj(s.owned)) {
      for (const [k, o] of Object.entries(s.owned)) {
        if (BCT.itemOf(k) && isObj(o)) {
          const via = ["shop", "gift", "reward"].includes(o.via) ? o.via : "shop";
          b.owned[k] = { t: num(o.t, 0), price: via === "shop" ? Math.max(0, num(o.price, 0)) : 0, via };
        }
      }
    }
    if (isObj(s.equip)) {
      for (const slot of Object.keys(b.equip)) {
        const id = s.equip[slot];
        const it = typeof id === "string" ? BCT.itemOf(id) : null;
        if (it && it.slot === slot && b.owned[id] && (!it.only || (b.pet && it.only === b.pet.type))) b.equip[slot] = id;
      }
    }
    b.affection = Math.max(0, Math.min(999, Math.floor(num(s.affection, 0))));
    if (isObj(s.toys)) {
      for (const [k, n] of Object.entries(s.toys)) {
        const it = BCT.itemOf(k);
        if (it && it.slot === "toy") b.toys[k] = Math.max(0, Math.min(9999, Math.floor(num(n, 0))));
      }
    }
    if (isObj(s.quiz)) b.quiz = { streak: Math.max(0, Math.floor(num(s.quiz.streak, 0))), best: Math.max(0, Math.floor(num(s.quiz.best, 0))) };
    if (Array.isArray(s.records)) {
      b.records = s.records.filter(isObj).slice(0, 2000).map((r) => ({
        id: str(r.id, 40) || newId(),
        t: num(r.t, 0),
        type: str(r.type, 20) || "other",
        lat: typeof r.lat === "number" ? r.lat : null,
        lng: typeof r.lng === "number" ? r.lng : null,
        acc: typeof r.acc === "number" ? r.acc : null,
        photo: r.photo === true,
      }));
    }
    if (Array.isArray(s.badges)) {
      const seen = new Set();
      b.badges = s.badges.filter((x) => isObj(x) && typeof x.id === "string" && !seen.has(x.id) && seen.add(x.id))
        .map((x) => ({ id: x.id.slice(0, 40), t: num(x.t, 0) }));
    }
    const int0 = (v) => Math.max(0, Math.floor(num(v, 0)));
    if (isObj(s.truckShoot)) {
      const t = s.truckShoot;
      b.truckShoot = { version: 1, plays: int0(t.plays), bestScore: int0(t.bestScore), bestCombo: int0(t.bestCombo), bestStars: Math.min(3, Math.max(int0(t.bestStars), int0(t.lastResult?.stars))), lastResult: null };
      if (isObj(t.lastResult) && typeof t.lastResult.runId === 'string') {
        const r = t.lastResult;
        b.truckShoot.lastResult = { runId: str(r.runId, 60), score: int0(r.score), hits: int0(r.hits), misses: int0(r.misses),
          maxCombo: int0(r.maxCombo), stars: Math.min(3, int0(r.stars)), coins: int0(r.coins), t: int0(r.t) };
      }
    }
    if (isObj(s.plaBusters)) {
      const t = s.plaBusters;
      b.plaBusters = { version: 1, plays: int0(t.plays), bestScore: int0(t.bestScore), bestCombo: int0(t.bestCombo), bestStars: Math.min(3, Math.max(int0(t.bestStars), int0(t.lastResult?.stars))), lastResult: null };
      if (isObj(t.lastResult) && typeof t.lastResult.runId === "string") {
        const r = t.lastResult;
        b.plaBusters.lastResult = { runId: str(r.runId, 60), score: int0(r.score), stars: Math.min(3, int0(r.stars)), coins: int0(r.coins),
          perfect: r.perfect === true, clean: Math.min(100, int0(r.clean)), t: int0(r.t) };
      }
    }
    const unit = (v) => Math.max(0, Math.min(1, num(v, 0.5)));
    if (isObj(s.food)) {
      for (const f of BCT.CONFIG.foods) {
        const o = s.food[f.id];
        if (!isObj(o)) continue;
        const bought = int0(o.bought);
        b.food[f.id] = { bought, fed: Math.min(bought, int0(o.fed)), spent: Math.max(0, num(o.spent, 0)), xp: Math.max(0, num(o.xp, 0)) };
      }
    }
    if (isObj(s.beach)) {
      const max = BCT.CONFIG.beach.maxLevel * BCT.CONFIG.beach.itemsPerLevel;
      const treasureIds = new Set();
      b.beach = {
        // Retired paper becomes driftwood, preserving existing pieces and earned totals.
        dirt: (Array.isArray(s.beach.dirt) ? s.beach.dirt : []).filter((d) => isObj(d) && (d.kind === "b_paper" || BCT.beachTrashOf(d.kind))).slice(0, max)
          .map((d) => ({ id: str(d.id, 40) || newId(), kind: d.kind === "b_paper" ? "b_wood" : d.kind, x: unit(d.x), y: unit(d.y) })),
        last: Math.max(0, num(s.beach.last, 0)),
        points: Math.max(0, num(s.beach.points, 0)),
        sorted: int0(s.beach.sorted),
        cleans: int0(s.beach.cleans),
        invited: s.beach.invited === true,
        treasureCycle: Number.isSafeInteger(s.beach.treasureCycle) && s.beach.treasureCycle >= 0 ? s.beach.treasureCycle : -1,
        treasures: (Array.isArray(s.beach.treasures) ? s.beach.treasures : []).filter(t => isObj(t) &&
          typeof t.id === 'string' && t.id.length > 0 && t.id.length <= 40 && !treasureIds.has(t.id) &&
          ['sakura_shell','sea_glass'].includes(t.kind) && treasureIds.add(t.id)).slice(0,3)
          .map(t => ({id:t.id,kind:t.kind,x:unit(t.x),y:unit(t.y)})),
      };
      if (b.beach.dirt.length || b.beach.treasureCycle !== b.beach.cleans) b.beach.treasures = [];
    }
    if (isObj(s.habitat)) {
      for (const [k, p] of Object.entries(s.habitat)) {
        const it = BCT.itemOf(k);
        if (it && it.slot === "home" && b.owned[k] && b.pet && (!it.only || it.only === b.pet.type) && isObj(p)) b.habitat[k] = { x: unit(p.x), y: unit(p.y) };
      }
    }
    b.petXp = typeof s.petXp === 'number' && Number.isFinite(s.petXp) ? Math.max(0, s.petXp) : null;
    if (b.pet && isObj(s.companions)) {
      for (const type of TYPES) {
        const p = s.companions[type];
        if (type === b.pet.type || !isObj(p) || p.pet?.type !== type || !Number.isFinite(p.petXp)) continue;
        // Reuse the same ownership/species validation without recursively reading a roster.
        const clean = sanitize({...b, ...p, owned:b.owned, companions:null, companionOrder:[]});
        if (clean.petXp === null) continue;
        b.companions[type] = Object.fromEntries(['pet','petXp','seenLv','equip','affection','toys','habitat'].map(k=>[k,clean[k]]));
      }
    }
    const present = b.pet ? [b.pet.type, ...Object.keys(b.companions)] : [];
    b.companionOrder = [...new Set([...(Array.isArray(s.companionOrder)?s.companionOrder:[]),...present])].filter(t=>present.includes(t));
    return b;
  }

  // 前の版（v1：クリーンPt 方式）からの 引き継ぎ
  function migrateV1(old) {
    const b = blank();
    const ev = BCT.CONFIG.event.id;
    const R = BCT.CONFIG.reward;
    const s = sanitize(Object.assign({}, old, { claims: {}, owned: {}, equip: {} }));
    Object.assign(b, { id: s.id, createdAt: s.createdAt, pet: s.pet, team: s.team, records: s.records, badges: s.badges });
    const correct = old && old.quiz && Array.isArray(old.quiz.correct) ? old.quiz.correct : [];
    correct.forEach((qid) => {
      if (typeof qid === "string") b.claims[`${ev}:quiz:${qid}`] = { xp: R.quiz.xp, coins: R.quiz.coins, t: Date.now() };
    });
    for (const r of b.records) {
      const t = BCT.TRASH.find((x) => x.key === r.type);
      const k = `${ev}:clean:${r.type}`;
      if (t && t.mission && !b.claims[k]) b.claims[k] = { xp: R.clean.xp, coins: R.clean.coins, t: r.t };
    }
    if (old && old.quiz && old.quiz.perfect > 0) b.quiz.best = 5;
    if (b.pet) {
      b.owned.accessory_ribbon = { t: Date.now(), price: 0, via: "gift" };
      b.equip.acc = "accessory_ribbon";
    }
    // 引き継いだ分の レベルアップ演出は 出さない
    const xp = Object.values(b.claims).reduce((a, c) => a + c.xp, 0);
    BCT.CONFIG.levels.forEach((min, i) => { if (xp >= min) b.seenLv = i + 1; });
    return b;
  }

  function readDisk() {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { return null; }
    if (raw) {
      try {
        const s = JSON.parse(raw);
        if (s && s.v === SCHEMA) return sanitize(s);
        console.warn("保存データの版が ちがうので、はじめから にします", s && s.v);
      } catch (e) {
        console.warn("保存データが こわれていたので、はじめから にします", e);
      }
      try { localStorage.setItem(BROKEN_KEY, raw); } catch (e) { /* 控えが 残せなくても つづける */ }
      return null;
    }
    // 前の版が あれば 引き継ぐ
    try {
      const old = localStorage.getItem(OLD_KEY);
      if (old) {
        const o = JSON.parse(old);
        if (o && o.v === 1) return migrateV1(o);
      }
    } catch (e) { /* 引き継げなければ はじめから */ }
    return null;
  }
  function writeDisk() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      console.warn("保存できませんでした", e);
      return false;
    }
  }
  // info.external = true … ほかのタブで 変わった
  function emit(info) {
    listeners.forEach((fn) => { try { fn(state, info || {}); } catch (e) { console.error(e); } });
  }

  let state = null;
  function load() {
    state = readDisk() || blank();
    writeDisk();
    return state;
  }

  /*
   * 変更は かならず transact で行う。
   *   1. ほかのタブが書いたかもしれないので、保存先から読み直す
   *   2. fn(state) で変更（{ ok:false } を返したら なにも保存しない）
   *   3. まとめて1回で保存
   * 同じ報酬を2回もらう・ポイントを2回ひく、といったことが 連打や複数タブでも起きない。
   */
  function transact(fn) {
    const fresh = readDisk();
    if (fresh) state = fresh;
    else if (!state) state = blank();
    const before = JSON.stringify(state);
    let r;
    try {
      r = fn(state);
    } catch (e) {
      state = JSON.parse(before);
      throw e;
    }
    if (r && r.ok === false) {
      state = JSON.parse(before);
      return r;
    }
    if (!writeDisk()) {
      state = JSON.parse(before);
      return { ok: false, err: "save" };
    }
    emit();
    return r === undefined ? { ok: true } : r;
  }

  // ほかのタブで 変更されたら 読み直す
  if (typeof window.addEventListener === "function") {
    window.addEventListener("storage", (e) => {
      if (e.key !== KEY) return;
      const fresh = readDisk();
      if (fresh) {
        state = fresh;
        emit({ external: true });
      }
    });
  }

  // ---------------- ゴミの写真（IndexedDB） ----------------
  let dbp = null;
  function db() {
    if (!dbp) {
      dbp = new Promise((resolve, reject) => {
        if (!("indexedDB" in window)) return reject(new Error("no indexedDB"));
        const req = indexedDB.open("bct-photos", 1);
        req.onupgradeneeded = () => req.result.createObjectStore("photos");
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbp;
  }
  async function putPhoto(id, blob) {
    const d = await db();
    return new Promise((resolve, reject) => {
      const tx = d.transaction("photos", "readwrite");
      tx.objectStore("photos").put(blob, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  async function getPhoto(id) {
    try {
      const d = await db();
      return await new Promise((resolve) => {
        const req = d.transaction("photos").objectStore("photos").get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch (e) {
      return null;
    }
  }
  async function clearPhotos() {
    try {
      const d = await db();
      await new Promise((resolve) => {
        const tx = d.transaction("photos", "readwrite");
        tx.objectStore("photos").clear();
        tx.oncomplete = resolve;
        tx.onerror = resolve;
      });
    } catch (e) { /* なにもしない */ }
  }

  BCT.store = {
    KEY,
    get: () => state || load(),
    load,
    newId,
    sanitize,
    onChange: (fn) => listeners.push(fn),
    transact,
    update(fn) {
      return transact((s) => { fn(s); });
    },
    async reset() {
      state = blank();
      writeDisk();
      try { localStorage.removeItem(OLD_KEY); } catch (e) { /* なし */ }
      emit();
      await clearPhotos();
    },
    // バックアップから もどす：中身を たしかめて まるごと おきかえる（保存できなければ もとの まま。false を かえす）
    replace(next) {
      const before = state;
      state = sanitize(next);
      if (!writeDisk()) {
        state = before;
        return false;
      }
      emit();
      return true;
    },
    putPhoto,
    getPhoto,
    clearPhotos,
  };
})();
