/*
 * とくべつ しょうごう（〇〇賞）
 * 条件の数字は下の定数を変えるだけで調整できる。id は QR に入るので変えないこと。
 * ※ 称号は「記録の思い出」で、アイテムやポイントは出ない（達成報酬のアイテムは js/game.js の ACHIEVEMENTS）。
 * 2026-10-20：ゴミを カメラで きろく する「ひろう」を なくしたので、きろくの 称号（プラごみハンター・ゴミたんてい・ひろいもの名人）を なくした。
 *   はじめのいっぽ賞は ミッションの 3つ（ゴミシュート・プラごみバスターズ・うみクイズ）の どれか 1つを クリアで もらえる。
 *   なくした 称号を もっている 古い データは そのまま（数えたり 表示したり しない。BCT.badgesHave）。
 */
(function () {
  const BCT = (window.BCT = window.BCT || {});

  const quizCount = (s) => BCT.game.quizEverCleared(s);
  // うみクイズの 問題の 数（運営画面は クイズを 読まないので、つかう ときに 数える）
  const quizTotal = () => (BCT.QUIZ || []).length || 15;
  // いまの うみクイズの うち 正解した 問題の 数（イベントが かわっても 数える。ときなおして 正解した 問題も 入る）
  const quizAll = (s) => {
    const ids = new Set(Object.keys(s.claims).map((k) => (k.match(/:quiz:([^:]+)$/) || [])[1]).filter(Boolean));
    return (BCT.QUIZ || []).filter((q) => ids.has(q.id)).length;
  };

  BCT.BADGES = [
    { id: "first", name: "はじめのいっぽ賞", ico: "👣", cond: "ミッションを どれか 1つ クリア（ゴミシュート・プラごみバスターズで ★1いじょう、または うみクイズに 1もん せいかい）",
      test: (s) => BCT.game.missionEverCleared(s) },
    { id: "hakase", name: "うみはかせ賞", ico: "🎓", cond: "うみクイズに 10もん せいかい",
      test: (s) => quizCount(s) >= 10, prog: (s) => `${Math.min(10, quizCount(s))} / 10` },
    { id: "perfect", name: "クイズまんてん賞", ico: "💯", get cond() { return `うみクイズ ${quizTotal()}もん ぜんぶ せいかい`; },
      test: (s) => quizAll(s) >= quizTotal(), prog: (s) => `${quizAll(s)} / ${quizTotal()}` },
    { id: "sodate", name: "そだておや賞", ico: "👑", cond: "ようせいが レベル5に なった",
      test: (s) => BCT.game.level(s) >= BCT.game.maxLevel() },
    { id: "shoot_master", name: "シュートめいじん賞", ico: "🐢", cond: "ゴミシュートで ★3を かくとく（1,200てん いじょう・ミスなし）",
      test: (s) => Math.max(s.truckShoot?.bestStars || 0, s.truckShoot?.lastResult?.stars || 0) >= 3 },
    { id: "beach_hero", name: "はまべのヒーロー賞", ico: "🐚", cond: "プラごみバスターズで ★3を かくとく（18,000てん いじょう）",
      test: (s) => Math.max(s.plaBusters?.bestStars || 0, s.plaBusters?.lastResult?.stars || 0) >= 3 || (s.plaBusters?.bestScore || 0) >= 18000 },
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
  // いま ある 称号の うち もっている もの（なくした 称号は ふくめない）
  BCT.badgesHave = (s) => BCT.BADGES.filter((b) => s.badges.some((x) => x.id === b.id));
})();
