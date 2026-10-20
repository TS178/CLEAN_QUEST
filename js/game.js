/*
 * ゲームの計算と操作（画面には さわらない。自動テストは tests/logic.test.mjs）
 * ------------------------------------------------------------
 * 計算（state を見るだけ）: xp / coins / level / stage / progress / affection / poses …
 * 操作（store.transact で 1回で保存）: claim / buy / equip / pet / playToy / grantAchievements …
 */
(function () {
  const BCT = (window.BCT = window.BCT || {});
  const C = () => BCT.CONFIG;

  // ---------------- 計算 ----------------
  // メダルは共通の台帳、2匹目を迎えた後の経験値は相棒ごとに管理する。
  const sum = (obj, f) => Object.values(obj || {}).reduce((a, v) => a + f(v), 0);
  const foodXp = (s) => sum(s.food, (f) => f.xp);
  const foodSpent = (s) => sum(s.food, (f) => f.spent);
  const xp = (s) => Number.isFinite(s.petXp) ? s.petXp : sum(s.claims, (c) => c.xp) + foodXp(s);
  // ポイント（画面では「ポイント」。中の名前は coins のまま）
  const coinsEarned = (s) => sum(s.claims, (c) => c.coins) + ((s.beach && s.beach.points) || 0);
  const coinsSpent = (s) => sum(s.owned, (o) => (o.via === "shop" ? o.price : 0)) + foodSpent(s);
  const coins = (s) => coinsEarned(s) - coinsSpent(s);
  const foodStock = (s, id) => { const f = s.food && s.food[id]; return f ? f.bought - f.fed : 0; };
  // ビーチの よごれ度（0〜3）
  const dirtLevel = (s) => Math.min(C().beach.maxLevel, Math.ceil(((s.beach && s.beach.dirt.length) || 0) / C().beach.itemsPerLevel));

  const maxLevel = () => C().levels.length;
  // 累計けいけんちから レベル（1回で いくつ こえても 正しく 最後まで進む）
  function levelOf(x) {
    let lv = 1;
    C().levels.forEach((min, i) => { if (x >= min) lv = i + 1; });
    return lv;
  }
  const stageOf = (lv) => C().stageOfLevel[Math.max(1, Math.min(maxLevel(), lv)) - 1];
  function progressOf(x) {
    const lv = levelOf(x);
    if (lv >= maxLevel()) return { lv, ratio: 1, rest: 0 };
    const cur = C().levels[lv - 1], next = C().levels[lv];
    return { lv, ratio: (x - cur) / (next - cur), rest: next - x };
  }
  const level = (s) => levelOf(xp(s));
  const stage = (s) => stageOf(level(s));

  function affection(s) {
    const { perStage, maxStage } = C().affection;
    const total = Math.min(s.affection, perStage * maxStage);
    const st = Math.floor(total / perStage);
    return { stage: st, step: st >= maxStage ? perStage : total % perStage, perStage, maxStage, max: st >= maxStage };
  }

  const ev = () => C().event.id;
  const key = (kind, id, eventId) => `${eventId || ev()}:${kind}:${id}`;
  const isClaimed = (s, kind, id) => !!s.claims[key(kind, id)];
  // このイベントで クリアした数
  const quizCleared = (s) => BCT.QUIZ.filter((q) => isClaimed(s, "quiz", q.id)).length;
  const cleanCleared = (s) => BCT.CLEAN_MISSIONS.filter((t) => isClaimed(s, "clean", t.key)).length; // 「ひろう」は 2026-10-20 に なくした（古い データ用）
  // ミニゲーム（ゴミシュート・プラごみバスターズ）を ★1いじょうで クリアした かいすう。メダルを もらえた（0枚より おおい）あそび＝★1いじょう
  //   ever … ほかの イベントの ぶんも かぞえる
  const miniCleared = (s, ever) => Object.entries(s.claims).filter(([k, c]) =>
    /:(truck|plabusters):/.test(k) && c.coins > 0 && (ever || k.startsWith(ev() + ":"))).length;
  // ミッションの どれか 1つを クリア（はじめのいっぽ賞）：ミニゲームを ★1いじょう か うみクイズに 1もん せいかい（これまでの ぶんも）
  const missionEverCleared = (s) => miniCleared(s, true) > 0 || Object.keys(s.claims).some((k) => /:quiz:/.test(k));
  // これまでの全イベントで 正解した問題（称号用）
  function quizEverCleared(s) {
    const ids = new Set();
    for (const k of Object.keys(s.claims)) {
      const m = k.match(/:quiz:([^:]+)$/);
      if (m) ids.add(m[1]);
    }
    return ids.size;
  }

  const owns = (s, id) => !!s.owned[id];
  const toyPlays = (s, toyId) => s.toys[toyId] || 0;
  // つかえる ポーズ（つうじょう・えがお ＋ 3かい あそんだ おもちゃ）
  function poses(s) {
    const list = BCT.BASE_POSES.map((p) => p.id);
    for (const toyId of Object.keys(BCT.TOY_POSES)) {
      if (toyPlays(s, toyId) >= C().toyUnlockPlays) list.push(toyId);
    }
    return list;
  }

  // ショップに出す商品（共通 ＋ じぶんの ようせい専用）
  function shopItems(s, slot) {
    return BCT.ITEMS.filter((it) => it.shop && (!slot || it.slot === slot) && (!it.only || (s.pet && it.only === s.pet.type)));
  }
  function ownedItems(s, slot) {
    return BCT.ITEMS.filter((it) => owns(s, it.id) && (!slot || it.slot === slot) && (!it.only || (s.pet && it.only === s.pet.type)));
  }
  // 買えるか（理由つき）
  function canBuy(s, id) {
    const it = BCT.itemOf(id);
    if (!it) return { ok: false, err: "unknown" };
    if (!it.shop) return { ok: false, err: "notforsale" };
    if (!s.pet) return { ok: false, err: "nopet" };
    if (it.only && it.only !== s.pet.type) return { ok: false, err: "species" };
    if (owns(s, id)) return { ok: false, err: "owned" };
    const c = coins(s);
    if (c < it.price) return { ok: false, err: "coins", need: it.price - c };
    return { ok: true };
  }

  // ---------------- 操作（1回で保存） ----------------
  // ミッション報酬。同じ「イベントID:種類:ID」は 二度と もらえない
  function claim(kind, id, reward) {
    reward = reward || C().reward[kind];
    return BCT.store.transact((s) => {
      const k = key(kind, id);
      if (s.claims[k]) return { ok: false, err: "dup" };
      const before = levelOf(xp(s));
      s.claims[k] = { xp: reward.xp, coins: reward.coins, t: Date.now() };
      if (Number.isFinite(s.petXp)) s.petXp += reward.xp;
      s.eventId = ev();
      return { ok: true, xp: reward.xp, coins: reward.coins, lvBefore: before, lvAfter: levelOf(xp(s)) };
    });
  }

  // One completed round = one ledger entry. A retry uses the same runId, including zero-score rounds.
  function finishTruckShoot(round) {
    if (!BCT.truckPhysics || !round || round.phase !== 'result' || !Number.isFinite(round.time) || round.time < BCT.truckPhysics.C.duration ||
      typeof round.runId !== 'string' || !/^[a-zA-Z0-9-]{1,60}$/.test(round.runId) || !Array.isArray(round.outcomes) ||
      round.outcomes.some(v => typeof v !== 'boolean')) return { ok: false, err: 'round' };
    const result = BCT.truckPhysics.result(round.outcomes);
    return BCT.store.transact(s => {
      const k = key('truck', round.runId);
      if (s.claims[k]) return { ok: false, err: 'dup' };
      const t = Date.now();
      s.claims[k] = { xp: 0, coins: result.coins, t };
      const stats = s.truckShoot;
      stats.plays++;
      stats.bestScore = Math.max(stats.bestScore, result.score);
      stats.bestCombo = Math.max(stats.bestCombo, result.maxCombo);
      stats.lastResult = { runId: round.runId, score: result.score, hits: result.hits, misses: result.misses,
        maxCombo: result.maxCombo, stars: result.stars, coins: result.coins, t };
      return { ok: true, ...result };
    });
  }

  function buy(id) {
    return BCT.store.transact((s) => {
      const chk = canBuy(s, id);
      if (!chk.ok) return chk;
      const it = BCT.itemOf(id);
      s.owned[id] = { t: Date.now(), price: it.price, via: "shop" };
      return { ok: true, item: it, coins: coins(s) };
    });
  }

  // 装着（itemId = null で はずす）。おもちゃは 装着しない
  function equip(slot, itemId) {
    return BCT.store.transact((s) => {
      if (!BCT.EQUIP_SLOTS.includes(slot)) return { ok: false, err: "slot" };
      if (itemId == null) {
        s.equip[slot] = null;
        return { ok: true };
      }
      const it = BCT.itemOf(itemId);
      if (!it || it.slot !== slot) return { ok: false, err: "slot" };
      if (!owns(s, itemId)) return { ok: false, err: "notowned" };
      if (it.only && (!s.pet || it.only !== s.pet.type)) return { ok: false, err: "species" };
      s.equip[slot] = itemId;
      return { ok: true };
    });
  }

  // はじめて ようせいを えらんだとき（赤いリボンを 1かいだけ プレゼント）
  function choosePet(type, name, team, members) {
    return BCT.store.transact((s) => {
      if (!['dolphin','turtle','hermit'].includes(type)) return {ok:false,err:'species'};
      if (Object.keys(s.companions || {}).length) return {ok:false,err:'companions'};
      s.pet = { type, name };
      s.companionOrder = [type];
      s.team = { name: team, members };
      // 別の種類に えらびなおしたら、その種類専用の みためは はずす
      if (s.equip.look) s.equip.look = null;
      let gift = false;
      if (!s.owned.accessory_ribbon) {
        s.owned.accessory_ribbon = { t: Date.now(), price: 0, via: "gift" };
        s.equip.acc = "accessory_ribbon";
        gift = true;
      }
      // ほかの種類の すみかの 置き場所は はずす
      for (const id of Object.keys(s.habitat || {})) {
        const it = BCT.itemOf(id);
        if (!it || (it.only && it.only !== type)) delete s.habitat[id];
      }
      seedBeach(s, Date.now());
      s.seenLv = levelOf(xp(s));
      return { ok: true, gift };
    });
  }

  const PET_FIELDS = ['pet','seenLv','equip','affection','toys','habitat'];
  function snapshot(s) {
    return {...JSON.parse(JSON.stringify(Object.fromEntries(PET_FIELDS.map(k=>[k,s[k]])))), petXp:xp(s)};
  }
  function companionStates(s) {
    if (!s.pet) return [];
    const types = [...new Set([...(s.companionOrder || []),s.pet.type,...Object.keys(s.companions || {})])];
    return types.map(t=>t===s.pet.type?s:s.companions?.[t]?{...s,...s.companions[t]}:null).filter(Boolean);
  }
  function canAdopt(s) {
    const list=companionStates(s);
    return list.length>0 && list.length<3 && list.every(p=>stage(p)===3);
  }
  function selectCompanion(type) {
    return BCT.store.transact(s=>{
      if(s.pet?.type===type)return {ok:true};
      const target=s.companions?.[type];
      if(!target)return {ok:false,err:'notowned'};
      s.companions[s.pet.type]=snapshot(s);
      Object.assign(s,target);delete s.companions[type];
      return {ok:true};
    });
  }
  function adoptPet(type,name) {
    return BCT.store.transact(s=>{
      if(!canAdopt(s))return {ok:false,err:'locked'};
      if(!['dolphin','turtle','hermit'].includes(type) || companionStates(s).some(p=>p.pet.type===type))return {ok:false,err:'species'};
      s.companions[s.pet.type]=snapshot(s);
      s.pet={type,name:String(name || 'ようせい').slice(0,12)};
      s.petXp=0;s.seenLv=1;s.affection=0;s.toys={};s.habitat={};
      s.equip={head:null,acc:s.owned.accessory_ribbon?'accessory_ribbon':null,look:null,frame:null};
      s.companionOrder.push(type);
      return {ok:true,gift:false};
    });
  }

  // なでる（経験値・ポイントは出ない）
  function pet() {
    return BCT.store.transact((s) => {
      const before = affection(s);
      if (before.max) return { ok: true, capped: true, before, after: before };
      s.affection = Math.min(s.affection + 1, C().affection.perStage * C().affection.maxStage);
      const after = affection(s);
      return { ok: true, before, after, stageUp: after.stage > before.stage };
    });
  }

  // おもちゃの演出が 最後まで おわったら 1かい（経験値・ポイントは出ない）
  function playToy(toyId) {
    return BCT.store.transact((s) => {
      const it = BCT.itemOf(toyId);
      if (!it || it.slot !== "toy") return { ok: false, err: "unknown" };
      if (!owns(s, toyId)) return { ok: false, err: "notowned" };
      const before = toyPlays(s, toyId);
      s.toys[toyId] = before + 1;
      const need = C().toyUnlockPlays;
      return { ok: true, plays: before + 1, unlocked: before + 1 === need ? toyId : null };
    });
  }

  // クイズの 連続正解の 記録（いまは 称号には つかわない。クイズまんてん賞は ぜんぶ 正解で もらえる：js/badges.js）
  function quizAnswered(correct) {
    return BCT.store.transact((s) => {
      s.quiz.streak = correct ? s.quiz.streak + 1 : 0;
      s.quiz.best = Math.max(s.quiz.best, s.quiz.streak);
    });
  }

  // 達成報酬（非売品）。条件を みたしていて まだ持っていない物を わたす
  const ACHIEVEMENTS = [
    // 2026-10-20：そうじミッション（「ひろう」）を なくしたので、ミニゲームで もらえる ように した
    { id: "reward_clean_hat", test: (s) => miniCleared(s) >= 1 },
    { id: "reward_guardian_medal", test: (s) => level(s) >= maxLevel() },
    { id: "reward_event_frame", test: (s) => quizCleared(s) >= C().eventFrameQuiz && miniCleared(s) >= 1 },
  ];
  function grantAchievements() {
    const r = BCT.store.transact((s) => {
      const got = ACHIEVEMENTS.filter((a) => !s.owned[a.id] && a.test(s)).map((a) => a.id);
      if (!got.length) return { ok: false, err: "none", got: [] };
      got.forEach((id) => { s.owned[id] = { t: Date.now(), price: 0, via: "reward" }; });
      return { ok: true, got };
    });
    return r.ok ? r.got : [];
  }

  // ---------------- ビーチの よごれ と 分別 ----------------
  // ゴミを ふやす。ほかの ゴミから なるべく はなれた 場所に おく（かさなると えらびにくい）
  function addDirt(s, n) {
    if (n > 0) s.beach.treasures = [];
    const kinds = BCT.BEACH_TRASH;
    for (let i = 0; i < n; i++) {
      const k = kinds[Math.floor(Math.random() * kinds.length)];
      let best = null;
      for (let c = 0; c < 14; c++) {
        const p = { x: 0.1 + Math.random() * 0.8, y: 0.12 + Math.random() * 0.76 };
        // 横長の 砂浜なので たての きょりは 小さめに 見る
        const d = Math.min(9, ...s.beach.dirt.map((o) => Math.hypot(o.x - p.x, (o.y - p.y) * 0.45)));
        if (!best || d > best.d) best = Object.assign(p, { d });
      }
      s.beach.dirt.push({ id: BCT.store.newId(), kind: k.key, x: best.x, y: best.y });
    }
  }
  // はじめて あそぶとき：よごれ度1 から はじめる（すぐ お掃除できるように）
  function seedBeach(s, now) {
    if (s.beach.last) return false;
    s.beach.last = now;
    if (!s.beach.dirt.length && !s.beach.sorted) addDirt(s, C().beach.startLevel * C().beach.itemsPerLevel);
    return true;
  }
  // One saved set per cleanup; collecting the last item never seeds another set.
  function seedTreasures(s) {
    if (s.beach.dirt.length || s.beach.cleans < 1 || s.beach.treasureCycle === s.beach.cleans) return false;
    s.beach.treasureCycle = s.beach.cleans;
    s.beach.treasures = [
      {kind:'sakura_shell',x:.18,y:.88},
      {kind:'sakura_shell',x:.58,y:.94},
      {kind:'sea_glass',x:.84,y:.87},
    ].map(t => ({...t,id:BCT.store.newId()}));
    return true;
  }
  // 時間が たった分だけ よごす（アプリを とじていた あいだの分も）。よごれ度3 で とまる
  function tickBeach(now) {
    now = now || Date.now();
    return BCT.store.transact((s) => {
      if (!s.pet) return { ok: false, err: "nopet" };
      if (seedBeach(s, now)) { seedTreasures(s); return { ok: true, added: s.beach.dirt.length }; }
      const B = C().beach;
      const every = B.dirtEveryMin * 60000;
      const steps = Math.floor((now - s.beach.last) / every);
      if (steps <= 0) return seedTreasures(s) ? {ok:true,added:0,treasures:true} : { ok: false, err: "notyet" };
      const max = B.maxLevel * B.itemsPerLevel;
      const add = Math.min(max - s.beach.dirt.length, steps * B.itemsPerLevel);
      if (add > 0) addDirt(s, add);
      s.beach.last = s.beach.dirt.length >= max ? now : s.beach.last + steps * every;
      return { ok: true, added: Math.max(0, add) };
    });
  }
  // 次に よごれるまでの ミリ秒
  function nextDirtIn(s, now) {
    const B = C().beach;
    if (dirtLevel(s) >= B.maxLevel || !s.beach.last) return null;
    return Math.max(0, s.beach.last + B.dirtEveryMin * 60000 - (now || Date.now()));
  }
  // ゴミを ゴミばこへ。正しければ クリーンポイント。まちがえても へらない
  function sortTrash(pieceId, binKey) {
    return BCT.store.transact((s) => {
      const i = s.beach.dirt.findIndex((d) => d.id === pieceId);
      if (i < 0) return { ok: false, err: "gone" };
      const t = BCT.beachTrashOf(s.beach.dirt[i].kind);
      if (!t || t.bin !== binKey) return { ok: false, err: "wrong", bin: t && t.bin };
      s.beach.dirt.splice(i, 1);
      const p = C().beach.pointsPerItem;
      s.beach.points += p;
      s.beach.sorted++;
      let cleaned = false, first = false;
      if (!s.beach.dirt.length) {
        cleaned = true;
        s.beach.cleans++;
        s.beach.last = Date.now(); // きれいに した時から 次の よごれまで かぞえる
        seedTreasures(s);
        if (!s.beach.invited) { s.beach.invited = true; first = true; }
      }
      return { ok: true, points: p, cleaned, first, left: s.beach.dirt.length };
    });
  }

  function collectTreasure(id) {
    return BCT.store.transact(s => {
      if (!s.pet) return {ok:false,err:'nopet'};
      if (s.beach.dirt.length || !s.beach.last || nextDirtIn(s) === 0) return {ok:false,err:'dirty'};
      const i = s.beach.treasures.findIndex(t => t.id === id);
      if (i < 0) return {ok:false,err:'gone'};
      const [treasure] = s.beach.treasures.splice(i,1);
      const points = C().beach.pointsPerTreasure;
      s.beach.points += points;
      return {ok:true,points,kind:treasure.kind};
    });
  }

  // ---------------- エサ（アクアドロップ） ----------------
  function buyFood(id, n) {
    n = Math.max(1, Math.floor(n || 1));
    return BCT.store.transact((s) => {
      const f = BCT.foodOf(id);
      if (!f) return { ok: false, err: "unknown" };
      if (!s.pet) return { ok: false, err: "nopet" };
      const cost = f.price * n;
      const c = coins(s);
      if (c < cost) return { ok: false, err: "coins", need: cost - c };
      const o = s.food[id] || (s.food[id] = { bought: 0, fed: 0, spent: 0, xp: 0 });
      o.bought += n;
      o.spent += cost;
      return { ok: true, food: f, stock: o.bought - o.fed, coins: coins(s) };
    });
  }
  // エサを あげる → けいけんち（もっている数だけ）
  function feed(id) {
    return BCT.store.transact((s) => {
      const f = BCT.foodOf(id);
      if (!f) return { ok: false, err: "unknown" };
      const o = s.food[id];
      if (!o || o.bought - o.fed <= 0) return { ok: false, err: "empty" };
      const before = levelOf(xp(s));
      o.fed++;
      o.xp += f.xp;
      if (Number.isFinite(s.petXp)) s.petXp += f.xp;
      return { ok: true, xp: f.xp, food: f, lvBefore: before, lvAfter: levelOf(xp(s)), stock: o.bought - o.fed };
    });
  }

  // ---------------- すみか ----------------
  function placeHome(id, x, y) {
    return BCT.store.transact((s) => {
      const it = BCT.itemOf(id);
      if (!it || it.slot !== "home") return { ok: false, err: "slot" };
      if (!owns(s, id)) return { ok: false, err: "notowned" };
      if (!s.pet || (it.only && it.only !== s.pet.type)) return { ok: false, err: "species" };
      const c = (v) => Math.max(0.05, Math.min(0.95, Number(v) || 0.5));
      s.habitat[id] = { x: c(x), y: c(y) };
    });
  }
  function removeHome(id) {
    return BCT.store.transact((s) => {
      if (!s.habitat[id]) return { ok: false, err: "none" };
      delete s.habitat[id];
    });
  }

  // レベルアップ演出を 見せたことにする
  function markSeen(lv) {
    return BCT.store.transact((s) => {
      if (s.seenLv >= lv) return { ok: false, err: "same" };
      s.seenLv = lv;
    });
  }

  BCT.game = {
    xp, coins, coinsEarned, coinsSpent, levelOf, stageOf, progressOf, level, stage, maxLevel, finishTruckShoot,
    companionStates, canAdopt, adoptPet, selectCompanion,
    affection, key, isClaimed, quizCleared, cleanCleared, miniCleared, missionEverCleared, quizEverCleared,
    owns, toyPlays, poses, shopItems, ownedItems, canBuy, ACHIEVEMENTS,
    claim, buy, equip, choosePet, pet, playToy, quizAnswered, grantAchievements, markSeen,
    foodStock, dirtLevel, nextDirtIn, tickBeach, sortTrash, collectTreasure, buyFood, feed, placeHome, removeHome,
  };
})();
