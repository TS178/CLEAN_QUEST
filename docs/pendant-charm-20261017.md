# 首飾りの紐の除去

1.25でさくらがいのペンダントの編み紐を取り除き、水色の飾り・金色の留め具・ピンクのさくらがいを残しました。

追記：1.26では利用者の追加指示により、元の紐付き画像へ戻し、頭と重なる部分の紐を描画マスクで隠しています。現在の仕様は [1.26の説明](companions-and-equipment-1-26.md) を参照してください。この紐なし画像は旧案として保存しています。
元の承認画像は保存し、編集後の透過PNGを別ファイルとして追加しています。

- 元画像: `assets/items/accessory_pendant.webp`（1.24時点）
- 編集画像: `assets/item-source/sakuragai-pendant-charm.png`
- 配信用: `assets/items/accessory_pendant.webp` と `js/pet-sprites.js`
- 再生成: `python tools/pack-shika-items.py`
- 使用: built-in image_gen（imagegenスキル）。透過背景を指定。

生成指示:

> Use case: precise-object-edit. Edit target: attached existing children's game sakuragai pendant transparent sprite. Remove ONLY the entire beige braided necklace cord loop, including its attachment stubs at the sides of the turquoise jewel. Retain the turquoise round jewel, its gold bezel and little gold connector, and the delicate pink sakuragai seashell drop below it. Preserve their exact illustrated style, colors, highlights, proportions, relative positioning and diagonal orientation. Do not redesign the charm, add motifs, lettering, or background. Output the isolated charm jewel+pink shell on genuinely transparent background with clean edges. Center the retained charm with modest transparent margin. No cord, no chain, no neck loop.
