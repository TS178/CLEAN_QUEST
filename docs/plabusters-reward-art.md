# プラごみバスターズ：結果のリサイクルボックス（1.36）

内蔵 image_gen ツールで生成。収集車とホームの分別ボックスを画風の参照にし、ユーザー指定で足を削除。

- 使用画像：`assets/plabusters/reward-box-v1.webp`（左：閉、右：開。透過アトラス）
- 原本：`assets/art-source/plabusters/reward-box-v1.png`
- 配信用変換：`node tools/pack-reward-box.mjs`
- 開閉は2コマの切り替えと軽い弾み。既存のコイン演出・報酬保存を維持。

## 初回生成プロンプト

Create a production game sprite atlas, transparent background, exactly TWO square frames side by side on a wide 2:1 canvas. References are STYLE REFERENCES ONLY: image 1 painted green recycling truck, image 2 painted blue sorting bin. Match their friendly Japanese children's coastal environmental game illustration style: softly hand-painted highlights, rounded chunky cream trim, rich but gentle green/teal shading, charming polished illustrated toy-like object, NOT flat vector, NOT photorealistic.
Subject: ONE redesigned recycling reward box, forest/seafoam green body, warm ivory rim and handle, subtle turquoise wave motif near the base inspired by the blue bin, clear ivory three-arrow recycling symbol centered on its broad front face. Sturdy rounded rectangular bin, small cream feet, slight three-quarter view showing front and right side. No words, no face, no coins, no particles, no background, no floor plane.
LEFT SQUARE FRAME: lid closed. RIGHT SQUARE FRAME: SAME EXACT bin, lid hinged upward and backward to about 75 degrees so a dark teal empty interior is visible; inside warm cream rim. The BODY of the bin must have IDENTICAL scale, perspective, x-position within each frame, and bottom alignment in both frames. Reserve same blank space above closed lid as for open lid. Fit all art within each square with 12% padding. Body spans local x=22%..78%, y=43%..86%; closed lid near y=39%, opened lid fits local y=15%..45%. BOTH frames centered at local x=50%. Two coherent animation states, not alternative designs. Truly transparent alpha around all objects. No panel borders, no labels, no divider, no extra objects.

## 採用した足なし修正プロンプト

Edit this transparent two-frame recycling reward box sprite atlas. REMOVE ALL FEET from BOTH the closed box in the left frame and the open box in the right frame, exactly as requested by the user. No legs, no feet, no supporting blocks, no wheels. Both bins should end in a smooth continuous flat rounded bottom edge of their green/turquoise body, sitting directly on the ground like a normal sorting bin. Keep the exact existing painted style, cream trim, green body, turquoise wave motif, recycling symbol, open/closed lid states, perspective, framing, transparent background, and matching size/alignment between the two frames. Do not add shadows, backgrounds, coins, words or any other new elements. Keep 2:1 atlas layout.

