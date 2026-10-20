# 第三者ライセンス一覧（ビーチクリーン探検隊）

このアプリが同梱・利用している第三者の成果物と、そのライセンスです。
すべて **無料で利用・再配布でき、コピーレフト型（GPL / LGPL / AGPL 等）ではありません**。
同梱しているライブラリは、どれも実行時に依存するパッケージを持っていません（2026-10-10、npm 公式レジストリの package.json で確認）。

| 名前 | 版 | ライセンス | 配布元 | 同梱場所 |
|---|---|---|---|---|
| qrcode-generator | 2.0.4 | MIT | https://github.com/kazuhikoarase/qrcode-generator （npm: `qrcode-generator`） | `vendor/qrcode/` |
| jsQR | 1.4.0 | Apache-2.0 | https://github.com/cozmo/jsQR （npm: `jsqr`） | `vendor/jsqr/`（運営用画面 `operator.html` のみで使用） |
| three.js | 0.186.1 | MIT | https://github.com/mrdoob/three.js （npm: `three`） | `vendor/three/`（AR で なでる・あそぶ。AR画面を開いたときだけ読み込む） |

ライセンス全文は各フォルダの `LICENSE.txt` にあります（アプリの「じぶん」→「このアプリについて」からも読めます）。

- jsQR：npm パッケージに含まれる `LICENSE` をそのまま `LICENSE.txt` として同梱。
- 2026-10-20：ゴミを カメラで記録する「ひろう」（クリーンマップ）を なくしたため、地図の Leaflet（BSD-2-Clause）と OpenStreetMap の地図タイルは 使わなくなり、同梱も やめました。
- qrcode-generator：npm パッケージに LICENSE ファイルが含まれていないため、`qrcode.js` 冒頭の著作権表示（Copyright (c) 2009 Kazuhiko Arase / MIT）と MIT ライセンス全文を `LICENSE.txt` にまとめて同梱。`qrcode.js` 冒頭の著作権表示は改変せずに残しています。
- jsQR：Apache-2.0 の NOTICE ファイルはパッケージに含まれていません（無いことを確認済み）。ファイルは改変していません。
- three.js：2026-10-11 に npm 公式レジストリから `npm pack three@0.186.1` で取得（sha512 がレジストリの値と一致することを確認）。
  実行時の依存パッケージなし。`build/three.module.js` と `build/three.core.js` を改変せずに同梱し、`LICENSE` を `LICENSE.txt` として同梱。
- `js/ar-math.js` のスマホの傾きからカメラの向きを求める式は、three.js の公開例 DeviceOrientationControls（MIT）と同じ考え方で書き直したものです（出典をファイル内に記載）。

## 商標

- 「QRコード」は株式会社デンソーウェーブの登録商標です。

## アプリ本体の絵・文章

- ようせい・たまご・アイテム（あたま・こもの・みため・おもちゃ）・撮影フレーム・海の背景・アイコンの絵は、このアプリのために作った仮の SVG です（外部素材は使っていません）。
- エサ（アクアドロップ）・ビーチのゴミ・分別ゴミばこ・すみかの けしき と アイテム の絵（`js/home-art.js`）は、このアプリのために作った仮の SVG です（外部素材は使っていません）。
- 絵文字は各端末のフォントで表示されます（画像として同梱していません）。
- 文字は端末に入っているフォントを使います（Web フォントは読み込んでいません）。
