# しかクエ 1.45

承認済みのアイコンE案を採用。花形の明るいピンク背景に、カメ・ヤドカリ・イルカと銀色／落ち着いた赤のロゴを配置。

- iPhone: `icons/apple-touch-icon.png`（180×180、不透明、角丸はOS側で適用）。
- Android: `icons/icon-192.png`・`icons/icon-512.png`（通常用）と `icons/icon-maskable-512.png`（切り抜き用）。
- maskable版はキャラクターとロゴの実際の不透明画素から必要な縮小率を算出。中央の半径40%の安全域からさらに8px内側へ収め、背景は端まで描画。
- PWA名「しかクエ」は維持。アイコン参照とサービスワーカーを1.45へ更新。
- 再生成: `node tools/export-fairy-pwa-icons.mjs`。`tools/pwa-icon-E.svg`の配置と既存の`assets/opening`の画像を使用。

検証: 4画像の生成・不透明度確認、maskable安全域（全キャラ・ロゴ画素が半径196.8px以内）、iPhone/Android画像の目視確認。更新の単体テスト6件と`tests/e2e/quest-143.mjs`（1.45のアイコン参照・ピンク背景・PWA名・保存・オフライン・ゲーム動作）が成功。
