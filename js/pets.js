/*
 * うみの ようせい（海の妖精）の 名前・セリフ・レベルの呼び名
 * ------------------------------------------------------------
 * 絵は js/pet-art.js、レベルに必要な けいけんち は js/config.js。
 * 名前・セリフ・呼び名は 下の定数を 書き換えるだけで変わる。
 */
(function () {
  const BCT = (window.BCT = window.BCT || {});

  // ようせいの種類（コード上の名前は pet のまま）
  const TYPES = {
    dolphin: {
      egg: "あおの たまご",
      motif: "イルカ",
      personality: "げんきで かっぱつ",
      defaultName: "イルカのようせい",
      eggColor: "#b3d4d7", eggSpot: "#e5f0e2", eggLine: "#6598a7",
      lines: ["キュイキュイ！", "なみに のって あそびたいな〜", "ジャンプ みててね！"],
    },
    turtle: {
      egg: "みどりの たまご",
      motif: "ウミガメ",
      personality: "おっとり やさしい",
      defaultName: "ウミガメのようせい",
      eggColor: "#c2d8a6", eggSpot: "#f1f3d2", eggLine: "#779c73",
      lines: ["のんびり いこうね", "すなはまは ぼくの ふるさと なんだ", "ひれを ふりふり〜"],
    },
    hermit: {
      egg: "あかの たまご",
      motif: "ヤドカリ",
      personality: "こうきしん いっぱい",
      defaultName: "ヤドカリのようせい",
      eggColor: "#e9c19b", eggSpot: "#fcf0d6", eggLine: "#c78c6e",
      lines: ["ハサミで チョキチョキ！", "あれ なんだろう？", "かいがらから こんにちは！"],
    },
  };
  const TYPE_KEYS = ["dolphin", "turtle", "hermit"];

  // レベルの呼び名（左から Lv1〜Lv5）。見た目の段階は config.js の stageOfLevel
  const LEVEL_NAMES = ["うまれたて", "げんきっこ", "なかよし ようせい", "うみの ゆうしゃ", "うみの まもりがみ"];
  const STAGE_NAMES = { 1: "こども", 2: "せいちょう とちゅう", 3: "りっぱに せいちょう" };

  // なでたときの セリフ
  const LINES = [
    "なでなで ありがとう！",
    "くすぐったいよ〜",
    "うみが きれいになると ちからが わいてくるよ",
    "いっしょに うみを まもろうね",
    "きょうも たんけん がんばろう！",
    "{team}の みんな だいすき！",
  ];
  // なつき度が あがったとき（だん 1〜3）
  const AFFECTION_LINES = {
    1: "えへへ、うれしいな！",
    2: "もっと そばに いたいな",
    3: "だいだいだいすき！ とくべつな ダンスを みせてあげる！",
  };
  // ゴミを記録したとき
  const THANKS = [
    "ありがとう！ うみが ひとつ きれいに なったよ",
    "すごい！ その ちょうしだよ",
    "ちからが わいてきた〜！",
  ];

  const levelName = (lv) => LEVEL_NAMES[Math.max(1, Math.min(LEVEL_NAMES.length, lv)) - 1];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  function randomLine(type, team) {
    return pick(LINES.concat((TYPES[type] || {}).lines || [])).replace("{team}", team || "たんけんたい");
  }

  // いまの 保存データの ようせいを描く（ホーム・きせかえ・ショップの見本 など）
  function renderState(s, extra) {
    const e = extra || {};
    const lv = e.lv || BCT.game.level(s);
    return BCT.art.render({
      type: s.pet ? s.pet.type : "dolphin",
      stage: e.stage || BCT.game.stageOf(lv),
      pose: e.pose || "normal",
      equip: Object.assign({}, s.equip, e.equip || {}),
      face: e.face,
      px: e.px,
    });
  }
  // 種類とレベルだけで描く（たまご・おしらせ など）
  const svg = (type, lv) => BCT.art.render({ type, stage: BCT.game.stageOf(lv || 1) });

  BCT.pets = {
    TYPES, TYPE_KEYS, LEVEL_NAMES, STAGE_NAMES, AFFECTION_LINES, levelName, randomLine,
    randomThanks: () => pick(THANKS),
    renderState, svg,
    eggSvg: (type) => BCT.art.eggSvg(type),
  };
})();
