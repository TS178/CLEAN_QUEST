# 称号・分別の実装と背面パーツ

## 実装済みのデザイン

承認された称号案 `output/design-proposals/titles-v3` と分別案 `output/design-proposals/home-sorting-v3` から実装用透過素材を作成。

- 称号7種類：じぶん画面、獲得モーダル、運営画面に同じ絵を使用。未獲得は淡い色。獲得演出は一度だけ拡大し、動きを減らす設定に対応。
- ごみ箱3種類、ごみ6種類：ホームへ反映。青＝プラスチック、黄＝かん・びん、コーラル＝もえるゴミ。ロープはもえるゴミ。紙くずは出現対象から除外。
- 保存済みの紙くずは、同じID・位置の木の枝へ変換する。ポイント、分別数、きれいにした回数は変えない。実際のごみ記録用 `BCT.TRASH` は変更していない。
- 称号ID・名前・達成条件・報酬・時間経過の設定はそのまま。

`assets/collection/*.webp` の16素材を `js/collection-sprites.js` に埋め込み、`js/collection-art.js` で既存のSVG描画口へ接続。サービスワーカーはスクリプトとCSSを事前保存し、圏外の表示にも対応。元の原画・提案は残している。

確認：`preview-collection-art.html`。アプリの保存データは使用しない。

### ごみ箱の形状修正

３種類とも取っ手・足を外し、底が平らな縦長のごみ箱へ変更。青・黄・コーラルの色分けと分別マークは維持。ホームの表示枠も縦長（78×112px）に変更した。

保存先：`assets/collection/bin_plastic.webp`、`bin_canbin.webp`、`bin_burn.webp`。原画と内蔵image_genの最終プロンプトは `assets/art-source/ui-collection/tall-bins/`。`node tools/pack-collection-art.mjs --bins` で３種類だけを再生成できる。`--ui` でも新しい縦長原画を適用する。

## そうじミッションのアイコン（2026-10-12）

- ミッション7種類と「ひろう」の種類選択・記録完了で同じイラストを使用。
- ボトル・袋・ロープ・缶・木材は `assets/collection/` の承認済み素材をそのまま流用。種類選択のびんも既存画像を流用。既存の画像ファイルと埋め込みバンドルは変更しない。
- 足りない「うき・ブイ」はオレンジ色のブイ、「そのほか」は紫の立体的な「？」を追加。保存先は `assets/mission-icons/float.webp` と `other.webp`。
- 内蔵image_genで生成。原画・最終プロンプトは `assets/art-source/mission-icons/`。`node tools/pack-mission-art.mjs` で最大420pxの透過WebPと `js/mission-sprites.js` を再生成できる。
- ミッション条件・報酬・分類は変更しない。追加画像の埋め込みスクリプトもサービスワーカーに保存する。
- `tests/e2e/collection-art.mjs` で7種類の対応、8種類の記録選択、画面幅、画像デコード、圏外表示を確認。

## 背面の静止画パーツ

既存の背面参考図の右列を参照して、3種類×3段階を描き起こした。正面を左右反転したものではない。付け根を補完した生成画像であり、元画像と画素単位の一致を保証するものではない。

- イルカ：胴体、左右の胸びれ、後ろから見た背びれ、尾の付け根、尾びれ。6×3＝18枚。
- カメ：甲羅・後頭部、左右の前後びれ、しっぽ。6×3＝18枚。
- ヤドカリ：貝殻・胴体、左右のハサミ、左右の前後脚。7×3＝21枚。最終形態の大きなハサミは背面の画面左側。

計57枚。`assets/pet-parts-rear/*.png` と `manifest.json`。元原画は `assets/art-source/rear-parts/`。各部品の左右は動物の左右で、背面では画面の左右と一致する。PNGの透明な付け根を本体の下へ重ねる。

今回は静止画パーツの納品。アニメーションの配置・回転中心・表裏切り替えは設定していない。既存の正面パーツや現在の動作は変更しない。確認：`preview-pet-rear-parts.html`。

## 再生成・検証

- `node tools/pack-collection-art.mjs --ui`：16素材と埋め込みバンドルを再生成。
- `node tools/pack-collection-art.mjs --rear`：57枚の背面パーツと座標manifestを再生成。
- パッカーは各連結シルエットと2pxの輪郭余白を抽出。UI用は最大420px、背面用は元の解像度を保持する。元原画は改変しない。
- `node --test tests/logic.test.mjs`：既存ゲーム計算と紙くずの移行・ロープ分別。
- `BCT_URL=http://127.0.0.1:8766/` で `node tests/e2e/beach.mjs`：分別・購入・進化・住処。
- `node tests/e2e/collection-art.mjs`：16透過素材、称号獲得・一覧・運営表示、圏外、背面57枚。

画像生成には内蔵image_genを使用。使用プロンプトは各原画フォルダの `generation-record.json` に保存。
