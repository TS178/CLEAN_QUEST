/*
 * 正面の絵から 切り出した「動く ようせい」の パーツ（tools/build-pet-cut.mjs が つくる。手で かえない）
 * ------------------------------------------------------------
 * 画像：assets/pet-cut/<種類>-<段階>-<パーツ>.png。js/pet-rig-config.js の あとに 読み、置き場所・付け根・重ね順・画像を おきかえる。
 * 止まっている しゅんかんは 正面の絵と おなじ。振れ幅・周期などの うごきは js/pet-rig-config.js の まま。
 * もとの パーツ（assets/pet-parts）に もどすときは index.html から この ファイルを はずす。
 */
(function () {
  const BCT = window.BCT;
  if (!BCT || !BCT.PET_RIG) return;
  const CUT = {"dolphin-1":{"parts":{"body":{"size":[352,335],"place":{"x":176,"y":167.5,"rot":0,"scale":1}},"dorsal":{"parent":"body","z":-1,"size":[99,76],"place":{"x":77.5,"y":58,"rot":0,"scale":1},"pivot":[0.576,0.329]},"fin-near":{"parent":"body","z":1,"size":[96,71],"place":{"x":50,"y":200.5,"rot":0,"scale":1},"pivot":[0.833,0.493]},"fin-far":{"parent":"body","z":1,"size":[78,68],"place":{"x":312,"y":173,"rot":0,"scale":1},"pivot":[0.218,0.676]},"tail-fluke":{"parent":"body","z":-1,"size":[104,82],"place":{"x":168,"y":292,"rot":0,"scale":1},"pivot":[0.327,0.354]}},"head":null},"dolphin-2":{"parts":{"body":{"size":[398,439],"place":{"x":199,"y":219.5,"rot":0,"scale":1}},"dorsal":{"parent":"body","z":-1,"size":[165,117],"place":{"x":84.5,"y":60.5,"rot":0,"scale":1},"pivot":[0.594,0.538]},"fin-near":{"parent":"body","z":1,"size":[139,118],"place":{"x":87.5,"y":220,"rot":0,"scale":1},"pivot":[0.863,0.229]},"fin-far":{"parent":"body","z":-1,"size":[130,68],"place":{"x":331,"y":190,"rot":0,"scale":1},"pivot":[0.2,0.574]},"tail-fluke":{"parent":"body","z":1,"size":[175,142],"place":{"x":254.5,"y":367,"rot":0,"scale":1},"pivot":[0.16,0.31]}},"head":null},"dolphin-3":{"parts":{"body":{"size":[573,485],"place":{"x":286.5,"y":242.5,"rot":0,"scale":1}},"dorsal":{"parent":"body","z":-1,"size":[259,243],"place":{"x":236.5,"y":123.5,"rot":0,"scale":1},"pivot":[0.745,0.609]},"fin-near":{"parent":"body","z":1,"size":[315,162],"place":{"x":159.5,"y":319,"rot":0,"scale":1},"pivot":[0.883,0.321]},"tail-base":{"parent":"body","z":-1,"size":[152,153],"place":{"x":200,"y":406.5,"rot":0,"scale":1},"pivot":[0.829,0.131]},"tail-fluke":{"parent":"body","z":-1,"size":[131,155],"place":{"x":324.5,"y":399.5,"rot":0,"scale":1},"pivot":[0.122,0.181]},"fin-far":{"parent":"body","z":-1,"size":[193,178],"place":{"x":474.5,"y":300,"rot":0,"scale":1},"pivot":[0.373,0.5]}},"head":null},"turtle-1":{"parts":{"body":{"size":[319,256],"place":{"x":159.5,"y":128,"rot":0,"scale":1}},"front-near":{"parent":"body","z":1,"size":[104,103],"place":{"x":133,"y":204.5,"rot":0,"scale":1},"pivot":[0.76,0.214]},"front-far":{"parent":"body","z":-1,"size":[92,68],"place":{"x":240,"y":179,"rot":0,"scale":1},"pivot":[0.337,0.515]},"rear-near":{"parent":"body","z":-1,"size":[84,63],"place":{"x":44,"y":181.5,"rot":0,"scale":1},"pivot":[0.69,0.556]}},"head":{"at":[0.751,0.346],"r":0.222,"feather":0.048}},"turtle-2":{"parts":{"body":{"size":[414,346],"place":{"x":207,"y":173,"rot":0,"scale":1}},"front-near":{"parent":"body","z":1,"size":[170,193],"place":{"x":178,"y":248.5,"rot":0,"scale":1},"pivot":[0.776,0.119]},"front-far":{"parent":"body","z":-1,"size":[146,159],"place":{"x":339,"y":218.5,"rot":0,"scale":1},"pivot":[0.233,0.226]},"rear-near":{"parent":"body","z":-1,"size":[107,84],"place":{"x":55.5,"y":223,"rot":0,"scale":1},"pivot":[0.682,0.405]},"rear-far":{"parent":"body","z":-1,"size":[67,71],"place":{"x":55.5,"y":161.5,"rot":0,"scale":1},"pivot":[0.657,0.549]}},"head":{"at":[0.768,0.251],"r":0.186,"feather":0.042}},"turtle-3":{"parts":{"body":{"size":[491,470],"place":{"x":245.5,"y":235,"rot":0,"scale":1}},"front-far":{"parent":"body","z":-1,"size":[264,126],"place":{"x":177,"y":65,"rot":0,"scale":1},"pivot":[0.833,0.714]},"front-near":{"parent":"body","z":1,"size":[243,270],"place":{"x":276.5,"y":333,"rot":0,"scale":1},"pivot":[0.72,0.119]},"rear-far":{"parent":"body","z":-1,"size":[83,100],"place":{"x":392.5,"y":222,"rot":0,"scale":1},"pivot":[0.349,0.53]},"rear-near":{"parent":"body","z":-1,"size":[142,104],"place":{"x":72,"y":309,"rot":0,"scale":1},"pivot":[0.732,0.413]}},"head":{"at":[0.819,0.259],"r":0.167,"feather":0.047}},"hermit-1":{"parts":{"body":{"size":[352,314],"place":{"x":176,"y":157,"rot":0,"scale":1}},"claw-right":{"parent":"body","z":1,"size":[114,102],"place":{"x":202,"y":262,"rot":0,"scale":1},"pivot":[0.482,0.108]},"claw-left":{"parent":"body","z":1,"size":[95,101],"place":{"x":302.5,"y":258.5,"rot":0,"scale":1},"pivot":[0.474,0.168]},"leg-near-rear":{"parent":"body","z":-1,"size":[57,59],"place":{"x":93.5,"y":272.5,"rot":0,"scale":1},"pivot":[0.702,0.424]},"leg-near-front":{"parent":"body","z":-1,"size":[54,93],"place":{"x":133,"y":261.5,"rot":0,"scale":1},"pivot":[0.722,0.29]}},"head":null},"hermit-2":{"parts":{"body":{"size":[440,406],"place":{"x":220,"y":203,"rot":0,"scale":1}},"claw-right":{"parent":"body","z":1,"size":[125,158],"place":{"x":240.5,"y":320,"rot":0,"scale":1},"pivot":[0.456,0.133]},"claw-left":{"parent":"body","z":1,"size":[115,156],"place":{"x":380.5,"y":327,"rot":0,"scale":1},"pivot":[0.235,0.167]},"leg-far-rear":{"parent":"body","z":-1,"size":[66,91],"place":{"x":64,"y":329.5,"rot":0,"scale":1},"pivot":[0.773,0.286]},"leg-far-front":{"parent":"body","z":-1,"size":[67,123],"place":{"x":95.5,"y":332.5,"rot":0,"scale":1},"pivot":[0.791,0.22]},"leg-near-rear":{"parent":"body","z":-1,"size":[80,154],"place":{"x":151,"y":328,"rot":0,"scale":1},"pivot":[0.675,0.188]},"leg-near-front":{"parent":"body","z":-1,"size":[17,18],"place":{"x":179.5,"y":339,"rot":0,"scale":1},"pivot":[1.706,0]}},"head":null},"hermit-3":{"parts":{"body":{"size":[536,415],"place":{"x":268,"y":207.5,"rot":0,"scale":1}},"claw-left":{"parent":"body","z":1,"size":[181,207],"place":{"x":443.5,"y":226.5,"rot":0,"scale":1},"pivot":[0.094,0.734]},"claw-right":{"parent":"body","z":1,"size":[119,135],"place":{"x":237.5,"y":315.5,"rot":0,"scale":1},"pivot":[0.311,0.163]},"leg-far-rear":{"parent":"body","z":-1,"size":[70,87],"place":{"x":47,"y":337.5,"rot":0,"scale":1},"pivot":[0.8,0.322]},"leg-far-front":{"parent":"body","z":-1,"size":[77,129],"place":{"x":102.5,"y":335.5,"rot":0,"scale":1},"pivot":[0.727,0.225]},"leg-near-rear":{"parent":"body","z":-1,"size":[81,162],"place":{"x":158.5,"y":332,"rot":0,"scale":1},"pivot":[0.704,0.191]},"leg-near-front":{"parent":"body","z":-1,"size":[121,114],"place":{"x":352.5,"y":343,"rot":0,"scale":1},"pivot":[0.314,0.298]}},"head":null}};
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
