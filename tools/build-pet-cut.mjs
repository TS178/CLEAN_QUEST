/*
 * 正面の絵から「動く ようせい」の パーツを 切り出す（2026-10-13 利用者の 指示「正面の絵を 参考に 手足を 配置」）
 * ------------------------------------------------------------
 * 正面の絵（BCT.PET_SPRITES の <種類>-<段階>-normal）を、胴体と ヒレ・尾・足・ハサミ に わけて
 *   assets/pet-cut/<種類>-<段階>-<パーツ>.png と js/pet-rig-cut.js（置き場所・付け根・重ね順）を つくる。
 * 止まっている しゅんかんは 正面の絵と おなじ。そこから 手足が 付け根を 中心に ゆれる（js/pet-rig.js）。
 *
 * 下の LIMBS に、正面の絵の 手足ごとに
 *   poly  … その 手足を かこむ 多角形（元の絵の px）。絵の ある ところ だけ 切り出す
 *   pivot … 付け根（回転の 中心。元の絵の px）
 *   z     … 1 = 胴体の 前（絵で 胴体に かぶさって いる 手足）／ -1 = 胴体の うしろ（胴体から 生えて いる 手足）
 * を 書く。前の 手足の 下に かくれて いた 胴体は、まわりの 胴体の 色で うめる（ゆれても 穴が あかない）。
 * うしろの 手足は 付け根の ほうへ 胴体の 中に すこし のばす（ゆれても すきまが 見えない）。
 * 正面の絵が かわったら、サーバー（python -m http.server 8000）を 立てて： node tools/build-pet-cut.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launch } from "../tests/e2e/cdp.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.BCT_URL || "http://127.0.0.1:8000/";
const OUT = path.join(ROOT, "assets", "pet-cut");

// パーツの 名前は js/pet-rig-config.js と おなじ（うごきの 振れ幅・周期は そちらの 設定を つかう）
const LIMBS = {
  "dolphin-1": {
    dorsal: { z: -1, pivot: [85, 45], poly: [[24, 48], [45, 28], [80, 17], [118, 20], [112, 30], [95, 38], [78, 48], [63, 62], [52, 78], [50, 92], [40, 80], [30, 65]] },
    "fin-near": { z: 1, pivot: [82, 200], poly: [[0, 180], [20, 172], [60, 170], [85, 180], [93, 198], [85, 218], [55, 232], [15, 228], [0, 210]] },
    "fin-far": { z: 1, pivot: [290, 185], poly: [[285, 165], [300, 150], [330, 145], [352, 147], [352, 160], [340, 180], [325, 195], [300, 205], [280, 205], [278, 190]] },
    "tail-fluke": { z: -1, pivot: [150, 280], poly: [[125, 288], [140, 275], [160, 268], [195, 262], [220, 272], [215, 285], [195, 298], [198, 320], [202, 332], [185, 335], [160, 328], [140, 315], [128, 302]] },
  },
  "dolphin-2": {
    dorsal: { z: -1, pivot: [100, 65], poly: [[0, 40], [20, 15], [60, 2], [110, 2], [150, 12], [162, 28], [140, 40], [110, 58], [85, 80], [65, 100], [58, 115], [50, 95], [35, 70], [10, 55]] },
    "fin-near": { z: 1, pivot: [138, 188], poly: [[15, 275], [18, 250], [40, 215], [70, 190], [110, 172], [140, 166], [152, 180], [146, 200], [120, 215], [90, 235], [60, 255], [35, 274]] },
    "fin-far": { z: -1, pivot: [292, 195], poly: [[284, 202], [300, 182], [330, 173], [352, 171], [377, 184], [397, 210], [392, 222], [350, 224], [305, 216]] },
    "tail-fluke": { z: 1, pivot: [195, 340], poly: [[195, 328], [220, 303], [280, 296], [332, 308], [342, 330], [300, 336], [262, 346], [272, 375], [287, 410], [287, 437], [258, 437], [218, 416], [184, 390], [170, 360], [177, 343]] },
  },
  "dolphin-3": {
    dorsal: { z: -1, pivot: [300, 150], poly: [[95, 0], [365, 0], [365, 85], [325, 105], [295, 138], [272, 180], [258, 225], [250, 240], [160, 240], [150, 200], [95, 150]] },
    "fin-near": { z: 1, pivot: [280, 290], poly: [[0, 300], [30, 262], [90, 248], [150, 253], [200, 263], [250, 253], [300, 243], [312, 270], [292, 300], [262, 330], [232, 345], [180, 350], [130, 375], [80, 402], [38, 397], [8, 362]] },
    "tail-base": { z: -1, pivot: [250, 350], poly: [[128, 400], [148, 363], [200, 343], [256, 338], [268, 360], [262, 420], [252, 472], [220, 483], [178, 472], [138, 447]] },
    "tail-fluke": { z: -1, pivot: [275, 350], poly: [[268, 343], [300, 343], [347, 358], [377, 383], [390, 430], [384, 477], [355, 472], [318, 457], [283, 442], [262, 400], [262, 363]] },
    "fin-far": { z: -1, pivot: [450, 300], poly: [[383, 300], [420, 288], [470, 248], [520, 213], [562, 228], [573, 280], [567, 332], [542, 372], [500, 387], [458, 372], [418, 367], [383, 357]] },
  },
  "turtle-1": {
    "front-near": { z: 1, pivot: [160, 175], poly: [[84, 226], [99, 194], [130, 168], [160, 158], [177, 168], [180, 195], [161, 221], [131, 246], [110, 255], [86, 252]] },
    "front-far": { z: -1, pivot: [225, 180], poly: [[208, 190], [224, 163], [250, 150], [276, 156], [287, 180], [282, 206], [256, 214], [224, 209]] },
    "rear-near": { z: -1, pivot: [60, 185], poly: [[0, 190], [9, 168], [30, 160], [56, 163], [72, 180], [66, 199], [46, 212], [14, 214], [2, 206]] },
  },
  "turtle-2": {
    "front-near": { z: 1, pivot: [225, 175], poly: [[76, 327], [88, 290], [114, 249], [140, 213], [170, 178], [210, 157], [242, 157], [258, 175], [254, 216], [237, 256], [206, 297], [171, 327], [130, 345], [93, 345]] },
    "front-far": { z: -1, pivot: [300, 175], poly: [[283, 175], [310, 156], [346, 162], [382, 193], [403, 240], [413, 287], [402, 300], [374, 292], [343, 267], [313, 237], [288, 207]] },
    "rear-near": { z: -1, pivot: [75, 215], poly: [[0, 241], [9, 213], [40, 196], [71, 198], [92, 214], [87, 236], [61, 257], [30, 267], [3, 264]] },
    "rear-far": { z: -1, pivot: [66, 165], poly: [[20, 186], [23, 168], [44, 148], [60, 136], [72, 138], [70, 160], [62, 180], [48, 195], [28, 197]] },
  },
  "turtle-3": {
    "front-far": { z: -1, pivot: [265, 92], poly: [[43, 20], [60, 3], [120, 0], [181, 8], [232, 33], [267, 63], [288, 90], [271, 102], [240, 107], [199, 102], [159, 82], [119, 62], [79, 47]] },
    "front-near": { z: 1, pivot: [330, 230], poly: [[153, 447], [158, 419], [199, 383], [239, 339], [258, 299], [273, 258], [299, 213], [331, 203], [367, 218], [392, 259], [397, 301], [382, 342], [352, 382], [311, 417], [261, 447], [211, 464], [169, 467]] },
    "rear-far": { z: -1, pivot: [380, 225], poly: [[363, 215], [384, 193], [411, 193], [432, 214], [437, 246], [421, 267], [394, 270], [373, 251]] },
    "rear-near": { z: -1, pivot: [105, 300], poly: [[0, 336], [9, 304], [39, 283], [80, 278], [116, 288], [122, 310], [101, 331], [61, 352], [24, 360], [2, 354]] },
  },
  "hermit-1": {
    "claw-right": { z: 1, pivot: [200, 222], poly: [[150, 265], [158, 234], [184, 216], [216, 218], [242, 239], [254, 270], [247, 296], [221, 312], [184, 312], [158, 296]] },
    "claw-left": { z: 1, pivot: [300, 225], poly: [[263, 270], [270, 239], [294, 218], [321, 213], [342, 224], [352, 255], [347, 291], [326, 307], [289, 309], [268, 296]] },
    "leg-near-rear": { z: -1, pivot: [105, 268], poly: [[64, 291], [70, 269], [89, 258], [111, 260], [117, 275], [106, 294], [85, 302], [68, 302]] },
    "leg-near-front": { z: -1, pivot: [145, 242], poly: [[108, 280], [113, 254], [129, 236], [149, 230], [160, 245], [157, 270], [154, 296], [141, 309], [119, 309], [108, 299]] },
  },
  "hermit-2": {
    "claw-right": { z: 1, pivot: [235, 262], poly: [[183, 320], [188, 284], [209, 260], [240, 246], [266, 250], [287, 274], [297, 315], [300, 360], [287, 392], [260, 397], [224, 387], [198, 361]] },
    "claw-left": { z: 1, pivot: [350, 275], poly: [[328, 300], [338, 268], [369, 250], [406, 253], [430, 279], [440, 320], [434, 371], [416, 400], [384, 402], [363, 386], [353, 366], [338, 351], [330, 326]] },
    "leg-far-rear": { z: -1, pivot: [82, 310], poly: [[28, 366], [33, 334], [54, 310], [81, 303], [92, 317], [77, 341], [56, 366], [40, 377]] },
    "leg-far-front": { z: -1, pivot: [115, 298], poly: [[60, 341], [69, 313], [89, 296], [111, 290], [124, 304], [112, 331], [97, 356], [79, 367], [63, 362]] },
    "leg-near-rear": { z: -1, pivot: [165, 280], poly: [[116, 330], [123, 299], [139, 278], [161, 270], [180, 281], [177, 311], [162, 336], [164, 371], [160, 402], [139, 404], [123, 386], [116, 361]] },
    "leg-near-front": { z: -1, pivot: [200, 330], poly: [[176, 341], [194, 323], [212, 328], [217, 356], [207, 377], [186, 374]] },
  },
  "hermit-3": {
    "claw-left": { z: 1, pivot: [370, 275], poly: [[358, 290], [373, 249], [388, 199], [399, 158], [424, 128], [470, 118], [512, 133], [532, 169], [536, 220], [527, 271], [502, 312], [461, 330], [419, 327], [388, 312], [368, 307]] },
    "claw-right": { z: 1, pivot: [215, 270], poly: [[183, 300], [194, 268], [214, 253], [241, 256], [262, 279], [287, 309], [292, 345], [282, 377], [255, 382], [224, 372], [203, 346], [188, 321]] },
    "leg-far-rear": { z: -1, pivot: [68, 322], poly: [[10, 371], [18, 339], [39, 320], [66, 313], [77, 329], [57, 356], [36, 380], [16, 380]] },
    "leg-far-front": { z: -1, pivot: [120, 300], poly: [[58, 387], [63, 344], [79, 313], [104, 293], [126, 290], [132, 310], [117, 336], [107, 371], [97, 402], [74, 402], [60, 397]] },
    "leg-near-rear": { z: -1, pivot: [175, 282], poly: [[123, 351], [133, 309], [149, 283], [170, 270], [187, 284], [182, 315], [177, 350], [187, 385], [187, 412], [164, 412], [138, 391], [126, 371]] },
    "leg-near-front": { z: -1, pivot: [330, 320], poly: [[298, 346], [314, 318], [344, 308], [375, 298], [402, 303], [412, 335], [407, 372], [385, 380], [366, 367], [351, 387], [330, 400], [313, 397], [303, 376]] },
  },
};

const PAGE = String.raw`(async (LIMBS) => {
  const load = async (src) => { const i = new Image(); i.src = src; await i.decode(); return i; };
  const out = {};
  for (const key of Object.keys(LIMBS)) {
    const [type, stage] = [key.split("-")[0], Number(key.split("-")[1])];
    const sp = BCT.PET_SPRITES[type + "-" + stage + "-normal"];
    const W = sp.width, H = sp.height, N = W * H;
    const front = await load(sp.src);
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(front, 0, 0, W, H);
    const F = g.getImageData(0, 0, W, H).data;
    const fg = new Uint8Array(N);
    for (let p = 0; p < N; p++) fg[p] = F[p * 4 + 3] > 8 ? 1 : 0;
    const morph = (m, r) => { // ふくらませる
      let a = m;
      for (let it = 0; it < r; it++) {
        const b = a.slice();
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const p = y * W + x;
          if (a[p]) continue;
          if ((x > 0 && a[p - 1]) || (x < W - 1 && a[p + 1]) || (y > 0 && a[p - W]) || (y < H - 1 && a[p + W])) b[p] = 1;
        }
        a = b;
      }
      return a;
    };
    const polyMask = (poly) => {
      g.clearRect(0, 0, W, H);
      g.fillStyle = "#000"; g.beginPath(); poly.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill();
      const d = g.getImageData(0, 0, W, H).data, m = new Uint8Array(N);
      for (let p = 0; p < N; p++) m[p] = d[p * 4 + 3] > 127 ? 1 : 0;
      return m;
    };
    // 手足の はんい（多角形 ＋ 3px。さきに 書いた ものが 優先）
    const L = LIMBS[key];
    const ids = Object.keys(L);
    const owner = new Int8Array(N).fill(-1);
    ids.forEach((id, i) => {
      const m = morph(polyMask(L[id].poly), 5); // ふちの 線も 手足に ふくめる
      for (let p = 0; p < N; p++) if (m[p] && fg[p] && owner[p] < 0) owner[p] = i;
    });
    const bodyM = new Uint8Array(N);
    for (let p = 0; p < N; p++) bodyM[p] = fg[p] && owner[p] < 0 ? 1 : 0;
    // 胴体から はなれた 小さな かけら（手足の ふちの 線の のこり）は、いちばん 多く 接して いる 手足へ
    {
      const lab = new Int32Array(N).fill(-1), sizes = [];
      for (let p = 0; p < N; p++) {
        if (!bodyM[p] || lab[p] >= 0) continue;
        const id = sizes.length, st = [p]; let n = 0; lab[p] = id;
        while (st.length) { const q = st.pop(); n++; const x = q % W, y = (q / W) | 0;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const r = Y * W + X; if (bodyM[r] && lab[r] < 0) { lab[r] = id; st.push(r); } } }
        sizes.push(n);
      }
      const main = sizes.indexOf(Math.max(...sizes));
      sizes.forEach((n, id) => {
        if (id === main) return;
        const votes = {};
        for (let p = 0; p < N; p++) if (lab[p] === id) { const x = p % W, y = (p / W) | 0;
          for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const o = owner[Y * W + X]; if (o >= 0) votes[o] = (votes[o] || 0) + 1; } }
        const best = Object.keys(votes).sort((a, b) => votes[b] - votes[a])[0];
        if (best == null) return;
        for (let p = 0; p < N; p++) if (lab[p] === id) { owner[p] = Number(best); bodyM[p] = 0; }
      });
    }
    // 胴体の 絵：前の 手足の 下に かくれて いた ところを まわりの 色で うめる（胴体を とじた 形の 中だけ）
    const shrink = (m, r) => { const inv = new Uint8Array(N); for (let p = 0; p < N; p++) inv[p] = m[p] ? 0 : 1; const g2 = morph(inv, r); const o = new Uint8Array(N); for (let p = 0; p < N; p++) o[p] = g2[p] ? 0 : 1; return o; };
    const CR = Math.max(12, Math.round(Math.min(W, H) * 0.07));
    const hull = shrink(morph(bodyM, CR), CR);
    const frontLimb = new Uint8Array(N);
    for (let p = 0; p < N; p++) if (owner[p] >= 0 && L[ids[owner[p]]].z > 0) frontLimb[p] = 1;
    const BD = new Uint8ClampedArray(N * 4);
    const known = new Uint8Array(N);
    for (let p = 0; p < N; p++) if (bodyM[p]) { for (let k = 0; k < 4; k++) BD[p * 4 + k] = F[p * 4 + k]; known[p] = 1; }
    // 胴体の ふちの 線（手足と 接する ところ）は 色の もとに しない
    const edge = morph(frontLimb, 3);
    const src = new Uint8Array(N);
    for (let p = 0; p < N; p++) src[p] = known[p] && !edge[p] && F[p * 4 + 3] > 200 && F[p * 4] * 0.3 + F[p * 4 + 1] * 0.59 + F[p * 4 + 2] * 0.11 > 115 ? 1 : 0;
    const want = new Uint8Array(N);
    for (let p = 0; p < N; p++) want[p] = (frontLimb[p] || (edge[p] && known[p])) && hull[p] ? 1 : 0;
    const have = src.slice();
    const col = new Float32Array(N * 3);
    for (let p = 0; p < N; p++) if (have[p]) { col[p * 3] = F[p * 4]; col[p * 3 + 1] = F[p * 4 + 1]; col[p * 3 + 2] = F[p * 4 + 2]; }
    // うめるのは 胴体の ふちから すこしの はばだけ（凸包は 胴体より ひろいので、ふかく うめると 板のように 見える）
    const depth = 400;
    for (let it = 0; it < depth; it++) {
      const add = [];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const p = y * W + x;
        if (!want[p] || have[p]) continue;
        let r = 0, gg = 0, b = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
          const q = Y * W + X; if (!have[q]) continue;
          r += col[q * 3]; gg += col[q * 3 + 1]; b += col[q * 3 + 2]; n++;
        }
        if (n) add.push([p, r / n, gg / n, b / n]);
      }
      if (!add.length) break;
      for (const [p, r, gg, b] of add) { have[p] = 1; col[p * 3] = r; col[p * 3 + 1] = gg; col[p * 3 + 2] = b; }
    }
    for (let p = 0; p < N; p++) if (want[p] && have[p] && !src[p]) { BD[p * 4] = col[p * 3]; BD[p * 4 + 1] = col[p * 3 + 1]; BD[p * 4 + 2] = col[p * 3 + 2]; BD[p * 4 + 3] = 255; }
    const toPng = (D, x0, y0, w, h) => {
      const cc = document.createElement("canvas"); cc.width = w; cc.height = h;
      const gg = cc.getContext("2d"); const im = gg.createImageData(w, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const p = (y + y0) * W + (x + x0), k = (y * w + x) * 4; for (let j = 0; j < 4; j++) im.data[k + j] = D[p * 4 + j]; }
      gg.putImageData(im, 0, 0);
      return cc.toDataURL("image/png");
    };
    const files = { body: toPng(BD, 0, 0, W, H) };
    const parts = { body: { size: [W, H], place: { x: W / 2, y: H / 2, rot: 0, scale: 1 } } };
    ids.forEach((id, i) => {
      const spec = L[id];
      const M = new Uint8Array(N);
      for (let p = 0; p < N; p++) M[p] = owner[p] === i ? 1 : 0;
      // うしろの 手足：付け根の ほうへ 胴体の 中に のばす（胴体に かくれる）
      if (spec.z < 0) {
        const band = Math.max(8, Math.round(Math.min(W, H) / 30));
        const gr = morph(M, band);
        const [jx, jy] = spec.pivot;
        for (let p = 0; p < N; p++) if (gr[p] && bodyM[p] && (p % W - jx) ** 2 + (((p / W) | 0) - jy) ** 2 < (band * 4) ** 2) M[p] = 1;
      }
      let x0 = W, y0 = H, x1 = -1, y1 = -1;
      for (let p = 0; p < N; p++) if (M[p]) { const x = p % W, y = (p / W) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 < 0) return;
      const w = x1 - x0 + 1, h = y1 - y0 + 1;
      const D = new Uint8ClampedArray(N * 4);
      for (let p = 0; p < N; p++) if (M[p]) for (let k = 0; k < 4; k++) D[p * 4 + k] = F[p * 4 + k];
      files[id] = toPng(D, x0, y0, w, h);
      parts[id] = { parent: "body", z: spec.z, size: [w, h], place: { x: +(x0 + w / 2).toFixed(1), y: +(y0 + h / 2).toFixed(1), rot: 0, scale: 1 },
        pivot: [+((spec.pivot[0] - x0) / w).toFixed(3), +((spec.pivot[1] - y0) / h).toFixed(3)] };
    });
    // ウミガメの 頭（胴体の 絵の 頭だけを ぼかして 切り出す）：いままでの 位置を 正面の絵の 座標に なおす
    let head = null;
    const cfg = BCT.petRigConfig(type, stage);
    if (cfg.head) {
      const bp = cfg.parts.body.place, bimg = await load(BCT.petRigFile(type, stage, "body"));
      const bw = bimg.naturalWidth * (bp.scale || 1), bh = bimg.naturalHeight * (bp.scale || 1);
      const ax = (cfg.head.at[0] - 0.5) * bw, ay = (cfg.head.at[1] - 0.5) * bh, RAD = Math.PI / 180;
      const cs = Math.cos((bp.rot || 0) * RAD), sn = Math.sin((bp.rot || 0) * RAD);
      head = { at: [+((bp.x + ax * cs - ay * sn) / W).toFixed(3), +((bp.y + ax * sn + ay * cs) / H).toFixed(3)], r: +((cfg.head.r * bw) / W).toFixed(3), feather: +((cfg.head.feather * bw) / W).toFixed(3) };
    }
    out[key] = { parts, files, head };
  }
  return out;
})`;

const b = await launch({ port: 9300 + Math.floor(Math.random() * 600), width: 600, height: 400, mobile: false });
try {
  await b.goto(BASE + "index.html");
  // もとの パーツの 設定（頭の 位置）を つかうので、切り出しの 上書き前の 設定を 読みなおす
  await b.ev(`(async()=>{ (0, eval)(await (await fetch("js/pet-rig-config.js", { cache: "reload" })).text()); delete BCT.PET_RIG_CUT; return true })()`);
  const res = await b.ev(`${PAGE}(${JSON.stringify(LIMBS)})`);
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) if (f.endsWith(".png")) fs.unlinkSync(path.join(OUT, f));
  const layout = {};
  for (const [key, r] of Object.entries(res)) {
    for (const [id, url] of Object.entries(r.files)) fs.writeFileSync(path.join(OUT, `${key}-${id}.png`), Buffer.from(url.split(",")[1], "base64"));
    layout[key] = { parts: r.parts, head: r.head };
    console.log(key, Object.keys(r.parts).join(" "));
  }
  const js = `/*
 * 正面の絵から 切り出した「動く ようせい」の パーツ（tools/build-pet-cut.mjs が つくる。手で かえない）
 * ------------------------------------------------------------
 * 画像：assets/pet-cut/<種類>-<段階>-<パーツ>.png。js/pet-rig-config.js の あとに 読み、置き場所・付け根・重ね順・画像を おきかえる。
 * 止まっている しゅんかんは 正面の絵と おなじ。振れ幅・周期などの うごきは js/pet-rig-config.js の まま。
 * もとの パーツ（assets/pet-parts）に もどすときは index.html から この ファイルを はずす。
 */
(function () {
  const BCT = window.BCT;
  if (!BCT || !BCT.PET_RIG) return;
  const CUT = ${JSON.stringify(layout)};
  for (const [key, c] of Object.entries(CUT)) {
    const [type, stage] = key.split("-");
    const R = BCT.PET_RIG[type];
    const st = (R.stages[stage] = R.stages[stage] || {});
    st.place = {};
    st.pivot = {};
    st.parent = {};
    st.z = {};
    for (const [id, p] of Object.entries(c.parts)) {
      st.place[id] = p.place;
      if (p.pivot) st.pivot[id] = p.pivot;
      if (p.parent) { st.parent[id] = p.parent; st.z[id] = p.z; }
    }
    st.tint = "";
    st.cut = true;
    if (c.head) st.head = c.head;
  }
  for (const R of Object.values(BCT.PET_RIG)) if (R && R.equipShift) R.equipShift = {};
  // 1枚の 絵から 切り出した 手足なので、ゆれは ひかえめに（もとの 設定の 0.6倍）
  for (const type of new Set(Object.keys(CUT).map((k) => k.split("-")[0]))) {
    const parts = BCT.PET_RIG[type].parts;
    for (const [id, p] of Object.entries(parts)) if (id !== "body" && p.swing) parts[id] = Object.assign({}, p, { swing: Object.assign({}, p.swing, { amp: +(p.swing.amp * 0.6).toFixed(1) }) });
  }
  const file = BCT.petRigFile;
  BCT.petRigFile = (type, stage, part) => (CUT[type + "-" + stage] ? "assets/pet-cut/" + type + "-" + stage + "-" + part + ".png" : file(type, stage, part));
  BCT.PET_RIG_CUT = CUT;
})();
`;
  fs.writeFileSync(path.join(ROOT, "js", "pet-rig-cut.js"), js);
  console.log("ok");
} finally { b.close(); }
