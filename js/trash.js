/* ゴミの種類（記録・マップ・称号・ミッション・QR・運営画面で共通） */
(function () {
  const BCT = (window.BCT = window.BCT || {});
  // key は QR とミッションIDにも入るので変えないこと。
  // plastic: true … 「プラごみハンター賞」の数に入る
  // mission: false … そうじミッション（報酬）の対象にしない。
  //   びんは割れたガラスでけがをするおそれがあるため、拾うことを報酬の条件にしない（記録・マップ・称号には入る）。
  BCT.TRASH = [
    { key: "pet", name: "ペットボトル", ico: "🥤", color: "#4da7de", plastic: true, mission: true },
    { key: "plastic", name: "プラスチック", ico: "🛍️", color: "#a786ea", plastic: true, mission: true },
    { key: "net", name: "あみ・ロープ", ico: "🪢", color: "#ef7fa8", plastic: true, mission: true },
    { key: "float", name: "うき・ブイ", ico: "🛟", color: "#ff7b54", plastic: true, mission: true },
    { key: "can", name: "かん", ico: "🥫", color: "#f2a03d", plastic: false, mission: true },
    { key: "bin", name: "びん", ico: "🍾", color: "#3fb48a", plastic: false, mission: false },
    { key: "wood", name: "きのざい", ico: "🪵", color: "#b07a4a", plastic: false, mission: true },
    { key: "other", name: "そのほか", ico: "❔", color: "#8a96a8", plastic: false, mission: true },
  ];
  BCT.trashOf = (key) => BCT.TRASH.find((t) => t.key === key) || BCT.TRASH[BCT.TRASH.length - 1];

  // ---- ホームの ビーチ（ゲームの中の よごれ。実際の 海の ようすを はかったものでは ない） ----
  // 分別ゴミばこ：色と マークで 直感的に わけられるように（むずかしく しない）
  BCT.BINS = [
    { key: "plastic", name: "プラスチック", mark: "プラ", color: "#3d8fe0" },
    { key: "canbin", name: "かん・びん", mark: "かん", color: "#e9a92a" },
    { key: "burn", name: "もえるゴミ", mark: "もえる", color: "#e2674c" },
  ];
  // ビーチに 流れつく ゴミ（bin = すてる ゴミばこ。ゴミの 色も ゴミばこの 色に そろえる）
  BCT.BEACH_TRASH = [
    { key: "b_bottle", name: "ペットボトル", bin: "plastic" },
    { key: "b_bag", name: "ビニールぶくろ", bin: "plastic" },
    { key: "b_rope", name: "ロープ", bin: "burn" },
    { key: "b_can", name: "かん", bin: "canbin" },
    { key: "b_glass", name: "びん", bin: "canbin" },
    { key: "b_wood", name: "きのえだ", bin: "burn" },
  ];
  BCT.binOf = (key) => BCT.BINS.find((b) => b.key === key) || null;
  BCT.beachTrashOf = (key) => BCT.BEACH_TRASH.find((t) => t.key === key) || null;
  BCT.CLEAN_MISSIONS = BCT.TRASH.filter((t) => t.mission);
})();
