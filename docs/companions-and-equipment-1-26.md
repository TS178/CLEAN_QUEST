# 相棒3匹・装備・すみか調整（1.26）

## 利用方法

- 1匹目が第3形態になると、ホームとようせい画面に「あたらしい相棒をむかえる」が出ます。2匹目も第3形態になると3匹目を迎えられます。同じ種類は重複せず、最大3匹です。
- ホームの円形アイコンは2匹なら半分ずつ、3匹なら3分割。各区画をタップすると、その相棒のようせい画面／すみかへ移動します。キーボードで円全体を押した場合は名前で選択できます。
- ホームの3匹はそれぞれヒレや脚を動かします。各相棒をタップするとお世話対象を切り替え、ドロップも渡した相棒が受け取ります。
- 名前・経験値・なつき度・おもちゃの習得・着せ替え・置物の位置は相棒別。メダル・購入品・ドロップ在庫・ミッション・称号・ゴミの記録は共有です。
- 管理者モードの「すみかのアイテムの大きさ」で、選択中の種類に置けるアイテムを25〜250%に調整できます。「大きさを保存」で反映し、変更を戻す／標準に戻して保存も使えます。
- 前版の装備ドラッグ・拡大縮小・種類／形態別保存、ヤドカリ装備の標準25%拡大は継続しています。

## 保存と描画

既存の保存データ（schema 2）の1匹と台帳は維持します。2匹目を迎えるトランザクションで、経験値を相棒別に確定します。お世話中の相棒は従来のトップレベルのフィールド、他の相棒は `companions`、迎えた順番は `companionOrder` に保持します。保存失敗時は変更を巻き戻します。通常のバックアップに3匹の育成データが含まれます。

装備調整は `bct-equipment-placements-v1`、置物の倍率は `bct-habitat-sizes-v1` の端末内設定です。倍率は種類・アイテム別で、置く位置は通常のすみか画面のドラッグで相棒ごとに保存します。管理者の調整値は他端末やGitHubへ自動同期されず、通常の育成バックアップにも含めません。

ペンダントは元の紐付きの絵を再使用。ペンダントとポシェットのうち、頭の領域に重なる画素だけをSVGマスクで隠します。頭の絵を重ね直さないため、まばたきを妨げません。静止画・撮影用SVG・動く描画で同じ頭の領域を使用し、管理者で位置や大きさを変えても追従します。

## 王冠の画像編集

組み込み `image_gen` による編集。参照元：`assets/items/head_crown.webp`（1.25版）。新しい元画像：`assets/item-source/crown-forward.png`。出力：`assets/items/head_crown.webp` と `js/pet-sprites.js` の埋め込み画像。`tools/pack-shika-items.py` で再生成できます。元の色・ハートや星の宝石を保ち、手前への傾きと底の楕円に奥行きを付けました。

最終プロンプト：

> Use case: precise-object-edit. Edit target: the supplied gold cartoon crown equipment sprite for a cute children's ocean pet game. Change only its 3D orientation: tilt the crown forward toward the viewer by about 25 degrees, viewed slightly from above, so it sits over a rounded pet's head rather than standing upright as a flat sticker. Show the hollow oval opening and back rim, with the front rim lower; make the oval bottom opening broad and curved so the head can visually fit inside. Keep the same five rounded gold ball tips, shiny warm gold, large central pink heart jewel, turquoise star gems, tiny pink gems, soft painted glossy shading and adorable style. Single isolated crown, centered, no head/character, no text, no extra props, no cast shadow/background; genuine transparent background. Preserve design identity. Perspective should visibly change, not merely rotate the image in its own plane.

## 検証

- 単体テスト49件：相棒の解放条件、重複禁止、経験値と共有残高、切替、バックアップ用データ、保存失敗の巻き戻し、既存の育成・描画計算。
- 通し確認123項目：ホーム・ミッション・ショップ・着せ替え・撮影・管理者・運営画面。
- `tests/e2e/equipment-placement.mjs`：9形態でのサイズ変更、タッチドラッグ、反転、保存、再読み込み、失敗時復帰。
- `tests/e2e/home-admin-polish.mjs`：27種類／形態／装備の組み合わせの顔が円形領域内に収まること。
- `tests/e2e/companions.mjs`：お迎え操作、3匹表示、相棒別の給餌、円形アイコン、移動後の重なり、画面を離れたときの停止、置物倍率、再読み込み、バックアップ、320px画面、オフライン、動く首飾りの画像読み込み。

PCのテスト用Edgeで検証しています。実機のiPhone／Androidでは未確認です。
