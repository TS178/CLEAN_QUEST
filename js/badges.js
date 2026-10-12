/*
 * とくべつ しょうごう（〇〇賞）
 * 条件の数字は下の定数を変えるだけで調整できる。id は QR に入るので変えないこと。
 * ※ 称号は「記録の思い出」で、アイテムやポイントは出ない（達成報酬のアイテムは js/game.js の ACHIEVEMENTS）。
 */
(function () {
  const BCT = (window.BCT = window.BCT || {});

  const plasticCount = (s) => s.records.filter((r) => BCT.trashOf(r.type).plastic).length;
  const typesFound = (s) => new Set(s.records.map((r) => r.type).filter((k) => BCT.TRASH.some((t) => t.key === k))).size;
  const quizCount = (s) => BCT.game.quizEverCleared(s);
  // うみクイズの 問題の 数（運営画面は クイズを 読まないので、つかう ときに 数える）
  const quizTotal = () => (BCT.QUIZ || []).length || 15;
  // いまの うみクイズの うち 正解した 問題の 数（イベントが かわっても 数える。ときなおして 正解した 問題も 入る）
  const quizAll = (s) => {
    const ids = new Set(Object.keys(s.claims).map((k) => (k.match(/:quiz:([^:]+)$/) || [])[1]).filter(Boolean));
    return (BCT.QUIZ || []).filter((q) => ids.has(q.id)).length;
  };

  BCT.BADGES = [
    { id: "first", name: "はじめのいっぽ賞", ico: "👣", cond: "ゴミを はじめて きろくした",
      test: (s) => s.records.length >= 1 },
    { id: "plahunter", name: "プラごみハンター賞", ico: "🏹", cond: "プラスチックの ゴミを 10こ きろく",
      test: (s) => plasticCount(s) >= 10, prog: (s) => `${Math.min(10, plasticCount(s))} / 10` },
    { id: "hakase", name: "うみはかせ賞", ico: "🎓", cond: "うみクイズに 10もん せいかい",
      test: (s) => quizCount(s) >= 10, prog: (s) => `${Math.min(10, quizCount(s))} / 10` },
    { id: "perfect", name: "クイズまんてん賞", ico: "💯", get cond() { return `うみクイズ ${quizTotal()}もん ぜんぶ せいかい`; },
      test: (s) => quizAll(s) >= quizTotal(), prog: (s) => `${quizAll(s)} / ${quizTotal()}` },
    { id: "tantei", name: "ゴミたんてい賞", ico: "🔍", cond: "ゴミの しゅるいを ぜんぶ みつけた",
      test: (s) => typesFound(s) >= BCT.TRASH.length, prog: (s) => `${typesFound(s)} / ${BCT.TRASH.length}` },
    { id: "meijin", name: "ひろいもの名人賞", ico: "🏅", cond: "ゴミを 20こ きろく",
      test: (s) => s.records.length >= 20, prog: (s) => `${Math.min(20, s.records.length)} / 20` },
    { id: "sodate", name: "そだておや賞", ico: "👑", cond: "ようせいが レベル5に なった",
      test: (s) => BCT.game.level(s) >= BCT.game.maxLevel() },
  ];

  // 新しく とれた しょうごうを 保存して かえす（1回で保存。二重には つかない）
  BCT.checkBadges = function () {
    let got = [];
    BCT.store.transact((s) => {
      const have = new Set(s.badges.map((b) => b.id));
      got = BCT.BADGES.filter((b) => !have.has(b.id) && b.test(s));
      if (!got.length) return { ok: false, err: "none" };
      got.forEach((b) => s.badges.push({ id: b.id, t: Date.now() }));
    });
    return got;
  };
  BCT.badgeOf = (id) => BCT.BADGES.find((b) => b.id === id);
})();
