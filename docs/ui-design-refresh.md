# 探検隊のUIデザイン更新

## 反映内容

- うみクイズ、そうじミッション、とくべつなごほうび、みつけたごみ、きせかえ、ピカピカ・よごれを新しいアイコンに統一。
- 下部はホーム・ミッション・ひろう・ショップの4タブ。承認済み案に合わせ、ようせいはホームの海の左上へ移動。その右に小さめの住処アイコンを配置。
- ようせいの丸枠には現在の種類・成長段階・着せ替えを反映。住処は `assets/habitats/habitat_{dolphin,turtle,hermit}.webp` の風景を丸く縮小表示。元の住処ボタンを置き換え、残りのホーム操作は3列に配置。
- 主人公の移動・回転・ジャンプの表示領域は入口より下に限定。画面の伸縮時も座標を補正。海は最低320pxを確保し、小さく低い画面は必要に応じてスクロール。ごみは元の砂浜の位置へ戻し、保存データ・報酬・分別ルールは変更しない。
- ショップ7ジャンルと着せ替えの分類を統一。エサ・帽子・スカーフ・ボール・フレームは既存の承認済み画像をそのまま使用。
- プロフィールのごみ8種類も、先に作成したイラストを使用。発見済み・未発見の表示を分ける。
- ホーム背景を文字のない海辺へ変更。背景上の英字・日本語装飾文も削除。
- 画面上の「ポイント」を「たんけんたいメダル」へ変更。内部のcoins、価格、報酬、保存形式は変更しない。
- メダルは、きれいになった砂浜に幼体のイルカ・ウミガメ・ヤドカリを描いた金色のコイン。左にイルカ、右にウミガメ、手前にヤドカリ。既存の幼体画像を参照して色・顔・特徴を引き継ぐ。
- SHIKA COLLECTIONのローカル実装（shika-gacha-build/shika-gacha/css/app.css のgachahome__coin）を参考に、ショップ上部のコイン画像と残高を大きく表示。ヘッダー・報酬・購入価格も同じ画像を使用。

## 素材と編集先

- `assets/ui/medal.webp`：砂浜のメダル。原画は `assets/art-source/ui-refresh/medal.png`。
- `assets/ui/beach.webp`：文字なしのホーム背景。原画は `assets/art-source/ui-refresh/beach.png`。
- `assets/ui/habitat.webp`：初案の貝がらアイコン（不採用・本体から参照なし）。原画とプロンプトは `assets/art-source/ui-refresh/habitat.png` / `habitat-prompt.json` に保管。最終案は既存の3種類の住処画像を使用し、新たな画像生成は行わない。
- 内蔵image_genで生成。初回プロンプトは同フォルダーの `generation-record.json`、砂浜への修正は `medal-revision.json`、幼体３匹を加えた最終プロンプトは `medal-baby-pets-revision.json`。
- `tools/pack-ui-refresh.mjs`：透過を保ったメダルと背景をWebPへ変換。原画は保管。
- `js/ui-design.js`：共通SVGアイコン、既存画像の再利用、メダル表示。
- `css/ui-design.css`：サイズ・色・残高カード・小画面表示。
- `preview-ui-design.html`：保存データに触れないデザイン一覧。

## 確認

`node tests/e2e/home-shortcuts.mjs`：390px/320pxで左上の配置・画面移動・ごみの分別・3種類×3段階の肖像・動作領域の分離・住処画像のオフライン読み込み。

`node tests/e2e/ui-design.mjs`：4タブ、各画面、小画面320px、清掃前後、背景文字なし、報酬・購入・残高更新、オフライン画像表示。

`node --test tests/logic.test.mjs`：既存の報酬・購入・保存データ計算27件。

`BCT_URL=http://127.0.0.1:8766/ node tests/e2e/run.mjs`：クイズ・記録・購入・着せ替え・撮影・保存を含む通し確認51件。すべて成功。
