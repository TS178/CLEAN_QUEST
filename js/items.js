/*
 * アイテム一覧（ショップ24種類 ＋ 達成報酬3種類 ＝ 27種類）
 * ------------------------------------------------------------
 * slot: head（あたま） / acc（こもの） / look（とくべつな みため） / toy（おもちゃ） / frame（さつえいフレーム）
 * only: そのようせい専用（ほかの種類の人には ショップに出ない・買えない）
 * shop: false … 非売品（達成報酬）
 * id は保存データに入るので、一度使ったら変えないこと。
 * 見た目（絵）は js/pet-art.js の ITEM_ART / LOOK_ART / FRAME_ART にある。
 */
(function () {
  const BCT = (window.BCT = window.BCT || {});

  // 名前の \u200b は「ここで おりかえして よい」の 目じるし（目に 見えない。ショップで 3れつに した とき 不自然な ところで きれない ように）
  BCT.ITEMS = [
    // 共通の あたま：5
    { id: "head_straw", name: "むぎわらぼうし", slot: "head", price: 40 },
    { id: "head_marine", name: "マリンキャップ", slot: "head", price: 40 },
    { id: "head_flower", name: "はなかざり", slot: "head", price: 20 },
    { id: "head_shell", name: "かいがらかざり", slot: "head", price: 20 },
    { id: "head_crown", name: "ちいさな おうかん", slot: "head", price: 100 },
    // 共通の こもの：4（ウミガメ・イルカは くびもと、ヤドカリは かいがらに つける）
    { id: "accessory_ribbon", name: "あかい リボン", slot: "acc", price: 20, gift: true },
    { id: "accessory_scarf", name: "あおい スカーフ", slot: "acc", price: 40 },
    { id: "accessory_pendant", name: "かいがら\u200bペンダント", slot: "acc", price: 40 },
    { id: "accessory_badge", name: "おそうじたい\u200bバッジ", slot: "acc", price: 20 },
    // ようせい専用の みため：9（3しゅるい × 3）
    { id: "turtle_wave", name: "なみもようの こうら", slot: "look", price: 60, only: "turtle" },
    { id: "turtle_flower", name: "はなもようの こうら", slot: "look", price: 60, only: "turtle" },
    { id: "turtle_star", name: "ほしもようの こうら", slot: "look", price: 80, only: "turtle" },
    { id: "dolphin_wave", name: "なみの もよう", slot: "look", price: 60, only: "dolphin" },
    { id: "dolphin_star", name: "ほしの もよう", slot: "look", price: 60, only: "dolphin" },
    { id: "dolphin_sparkle", name: "きらめく もよう", slot: "look", price: 80, only: "dolphin" },
    { id: "hermit_stripe", name: "しましまの かいがら", slot: "look", price: 60, only: "hermit" },
    { id: "hermit_dot", name: "みずたまの かいがら", slot: "look", price: 60, only: "hermit" },
    { id: "hermit_rainbow", name: "にじいろの かいがら", slot: "look", price: 80, only: "hermit" },
    // 共通の おもちゃ：3（そうびしない。あそぶときに えらぶ）
    { id: "toy_ball", name: "ビーチボール", slot: "toy", price: 60 },
    { id: "toy_bubbles", name: "あわの リング", slot: "toy", price: 60 },
    { id: "toy_music", name: "かいがらの がっき", slot: "toy", price: 60 },
    // さつえいフレーム：3
    { id: "frame_wave", name: "なみフレーム", slot: "frame", price: 20 },
    { id: "frame_shell", name: "かいがら\u200bフレーム", slot: "frame", price: 20 },
    { id: "frame_rainbow", name: "にじフレーム", slot: "frame", price: 40 },
    // 達成報酬：3（非売品）
    { id: "reward_clean_hat", name: "おそうじたいの ぼうし", slot: "head", shop: false, reward: true,
      how: "そうじミッションを 1つ クリア" },
    { id: "reward_guardian_medal", name: "うみの まもりて メダル", slot: "acc", shop: false, reward: true,
      how: "ようせいが レベル5に なる" },
    { id: "reward_event_frame", name: "イベントきねん フレーム", slot: "frame", shop: false, reward: true,
      how: "クイズ 10もん ＋ そうじミッション 1つ" },
    // すみかの デコレーション：9（3しゅるい × 3。じぶんの ようせい専用）
    // act = ようせいが そばで する うごき（js/habitat.js）
    { id: "home_dolphin_ring", name: "シーグラスの うきわリング", slot: "home", price: 60, only: "dolphin", act: "through", actName: "ジャンプで くぐる" },
    { id: "home_dolphin_boat", name: "さいせいプラの ひこうきボート", slot: "home", price: 80, only: "dolphin", act: "ride", actName: "ボートに のる" },
    { id: "home_dolphin_tower", name: "レインボー\u200bサンゴの タワー", slot: "home", price: 100, only: "dolphin", act: "climb", actName: "くるくる のぼる" },
    { id: "home_turtle_cushion", name: "リサイクル\u200bとうきの シェルター\u200bクッション", slot: "home", price: 60, only: "turtle", act: "rest", actName: "ひとやすみ" },
    { id: "home_turtle_lantern", name: "ボトルアートの とうろう", slot: "home", price: 80, only: "turtle", act: "look", actName: "あかりを ながめる" },
    { id: "home_turtle_bed", name: "アマモの ふわふわベッド", slot: "home", price: 100, only: "turtle", act: "sleep", actName: "すやすや ねる" },
    { id: "home_hermit_parasol", name: "キャップの ミニ\u200bパラソル＆\u200bベンチ", slot: "home", price: 60, only: "hermit", act: "sit", actName: "ベンチで ひとやすみ" },
    { id: "home_hermit_house", name: "デコレーション・\u200bマイおやど", slot: "home", price: 80, only: "hermit", act: "hide", actName: "おやどに はいる" },
    { id: "home_hermit_gym", name: "りゅうぼくの ミニ\u200bアスレチック", slot: "home", price: 100, only: "hermit", act: "climb", actName: "よじのぼる" },
  ];
  BCT.ITEMS.forEach((it) => { if (it.shop === undefined) it.shop = true; });
  BCT.itemOf = (id) => BCT.ITEMS.find((it) => it.id === id) || null;

  // ショップの タブ（food = エサ は アイテムではなく 消えもの。js/config.js の foods）
  BCT.SLOTS = [
    { key: "food", name: "ごはん", ico: "💧" },
    { key: "home", name: "すみか", ico: "🏝️" },
    { key: "head", name: "あたま", ico: "🎩" },
    { key: "acc", name: "こもの", ico: "🎀" },
    { key: "look", name: "みため", ico: "✨" },
    { key: "toy", name: "おもちゃ", ico: "🏐" },
    { key: "frame", name: "フレーム", ico: "🖼️" },
  ];
  // 装着できる枠（おもちゃ・すみかは装着しない）
  BCT.EQUIP_SLOTS = ["head", "acc", "look", "frame"];
  // すみかの なまえ（ようせいごと）
  BCT.HABITATS = {
    dolphin: "ラグーン・オーシャン",
    turtle: "アクア・ガーデン",
    hermit: "ビーチ・ヴィレッジ",
  };

  // 買わなくても使える 標準の見た目（27種類には ふくめない）
  BCT.LOOK_DEFAULT = {
    turtle: "ふつうの こうら",
    dolphin: "ふつうの からだ",
    hermit: "ふつうの かいがら",
  };

  // おもちゃで おぼえる ポーズ（さつえいで つかう）
  BCT.TOY_POSES = {
    toy_ball: { turtle: "ボールを おいかける", dolphin: "はなさきで ポン", hermit: "はさみで ボールを おす" },
    toy_bubbles: { turtle: "あわの わを くぐる", dolphin: "あわの わを ジャンプ", hermit: "あわに てを のばす" },
    toy_music: { turtle: "おとに あわせて ダンス", dolphin: "おとに あわせて ダンス", hermit: "がっきを ならす" },
  };
  // さいしょから つかえる ポーズ
  BCT.BASE_POSES = [
    { id: "normal", name: "つうじょう" },
    { id: "smile", name: "えがお" },
  ];
  BCT.poseName = (poseId, type) => {
    const base = BCT.BASE_POSES.find((p) => p.id === poseId);
    if (base) return base.name;
    const t = BCT.TOY_POSES[poseId];
    return t ? t[type] || "" : "";
  };
})();
