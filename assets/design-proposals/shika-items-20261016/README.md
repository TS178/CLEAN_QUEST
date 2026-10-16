# 志賀町のショップアイテム画像（承認版）
2026-10-16

ユーザー確認後の最新画像６点です。**画像追加のみ。ショップへの登録、価格設定、装着処理、既存画像の差し替えは未実施です。**
[画像一覧を開く](index.html)

| 画像 | アイテム | 用途・状態 |
|---|---|---|
| [sakuragai-pendant.png](sakuragai-pendant.png) | さくらがいのペンダント | 既存のかいがらペンダントの差し替え候補 |
| [korogaki-pochette.png](korogaki-pochette.png) | ころ柿のポシェット | 新規きせかえアイテム |
| [hamanasu-flower.png](hamanasu-flower.png) | ハマナスのはなかざり | 既存のはなかざりの差し替え候補 |
| [fukuura-lighthouse.png](fukuura-lighthouse.png) | 旧福浦灯台の置物 | すみかに飾る新規アイテム |
| [ganmon.png](ganmon.png) | 巌門の置物 | 添付写真に合わせた岩壁・洞門・右側のくぼみ |
| [bench.png](bench.png) | 世界一長いベンチの置物 | 直線の座面・色タイル。手前の赤い椅子は削除済み |

## 実装時の引き継ぎ
- さくらがいのペンダントは既存の `accessory_pendant`（かいがらペンダント）の差し替え候補。
- ハマナスのはなかざりは既存の `head_flower` の差し替え候補。
- ポシェットと３つの置物は新規アイテム。価格・利用できるペット・装着位置は未設定。
- ベンチは最終調整版：長い座面とタイル面を直線化し、手前にあった赤い木製の椅子２つは削除。
- 巌門はユーザー添付写真を直接参照。大きな連続する岩壁、下部の細い洞門、右の低いくぼみを表現。
- 全画像は背景透過PNG。大きさ・縦横比は画像ごとに異なります。比率を維持して表示してください。
- 参照写真そのもの、未採用案、個人のローカルパス、アプリの動作変更は含めていません。

## 制作記録
内蔵 `image_gen` で生成・編集しました。最終プロンプトとファイルの寸法・SHA-256は [generation-record.json](generation-record.json) に記録しています。

モチーフ確認資料：
- [旧福浦灯台（石川県観光公式）](https://www.hot-ishikawa.jp/spot/detail_5205.html)
- [世界一長いベンチ（石川県観光公式）](https://www.hot-ishikawa.jp/spot/detail_5677.html)
- [巌門（石川県観光公式）](https://www.hot-ishikawa.jp/spot/detail_5174.html)
- [さくら貝（石川県観光公式）](https://www.hot-ishikawa.jp/blog/detail_208.html)
- [ころ柿（JA志賀）](https://ja-shika.jp/tokusan/korokaki.html)
- [町花ハマナス（志賀町広報）](https://www.town.shika.lg.jp/uploaded/attachment/3133.pdf)
