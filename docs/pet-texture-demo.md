# 原画テクスチャの Three.js 表示

`pet-texture-demo.html` は、承認済み正面画像と生成した側面・背面を使う独立したデモです。ゲームの画面や保存データには接続しません。

プロジェクトのルートで `python -m http.server 8766` を実行し、`http://127.0.0.1:8766/pet-texture-demo.html` を開きます。すでに同じポートのサーバーが動いていれば、そのまま開けます。ES modules と画像読み込みを使うため `file://` では開かないでください。Three.js は `vendor/three/` の同梱版を使い、CDN・APIキー・ビルドは不要です。

別の画面への最小組み込み例（同じプロジェクトのルートに置くHTML）:

```html
<div id="pet" style="width:100%;height:500px"></div>
<script type="module">
  import { createPetTextureScene } from './js/pet-texture-scene.js';
  const pet = createPetTextureScene(document.getElementById('pet'), {
    type: 'dolphin', stage: 1,
    onError: error => console.error(error.message)
  });
  await pet.ready;
  pet.setFloating(true);
  pet.setAutoRotate(true);
  // pet.setAngle(90);              // 側面へ
  // await pet.setPet('turtle', 3); // 種類・成長段階を変更
  // pet.lift();                   // 一度浮き上がる
  // pet.dispose();                // 画面を閉じるときに解放
</script>
```

API: `setPet(type, stage)`、`setAngle(0〜180, {immediate:false})`、`setFloating(bool)`、`setAutoRotate(bool)`、`setSpeed(0.3〜1.8)`、`lift()`、`reset()`、`getState()`、`dispose()`。種類は `dolphin` / `turtle` / `hermit`、段階は 1〜3。

正面・側面・背面の3枚を短いクロスフェードで切り替える **2.5D** 表現です。画像から全周の立体形状を復元するものではありません。左右非対称のヤドカリを反転させないよう、0〜180度の間を往復します。原画の色を保つため sRGB と NoToneMapping を設定し、キャラクターの画素に照明や色付けを加えません。床の影・浮遊・わずかな視差で奥行きを表現します。

側面・背面のシートは余白が均等でないため、透過領域から6体を分離します。元のPNGは書き換えません。テクスチャをキャッシュし、`dispose()` でGPUリソース・イベント・描画ループを解放します。低モーション設定では自動浮遊を止めます。

検証: `node tests/e2e/pet-texture-scene.mjs`。27方向表示、ドラッグ・キー操作・浮上・非同期切り替え・3画面幅・保存データ不変・解放を確認します。
