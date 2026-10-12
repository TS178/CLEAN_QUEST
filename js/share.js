/*
 * 「みんなの クリーンマップ」用の 差し込み口（いまは なにも 送らない）
 * ------------------------------------------------------------
 * 他の隊の記録も地図に出したくなったら、ここだけを書き換える。
 *   sendRecord(record)   … 記録を どこかへ 送る
 *   fetchSharedRecords() … みんなの記録を 取ってくる（[{type, lat, lng, t}] を返す）
 *
 * 【方式を決めるときの条件（README にも記載）】
 *   - 完全無料で、クレジットカードの登録が要らないこと
 *   - 上限を超えたら「止まる」だけで、あとから請求が来ないこと
 *   - 位置情報は 子どもの行動範囲が わかるので、送る前に 保護者の同意を とること
 */
(function () {
  const BCT = (window.BCT = window.BCT || {});
  BCT.share = {
    enabled: false,
    async sendRecord(record) {
      return false;
    },
    async fetchSharedRecords() {
      return [];
    },
  };
})();
