/*
 * AR で なでる・あそぶ（ポケモンGO のように、カメラの むこうに ようせいが いる）
 * ------------------------------------------------------------
 * 2つの方式（どちらも無料・アカウント不要）:
 *   1. ゆかに おく AR … WebXR（immersive-ar ＋ hit-test）。Android の Chrome ＋ ARCore 対応機種。
 *                       ゆかを見つけて タップした所に ようせいを 置く（ポケモンGO の「AR+」に近い）。
 *   2. ジャイロ式 AR  … カメラ映像 ＋ スマホの傾き。iPhone・ふつうの Android。
 *                       スマホの向きを かえても ようせいは その方向に とどまって見える。
 *                       傾きが とれない端末では 画面に 固定（それでも なでる・あそぶ は できる）。
 * カメラが つかえないときは、ホームの いつもの あそびかた（js/home.js）に もどる。
 *
 * 数え方は いつもと おなじ（js/game.js）:
 *   - なでる … タップ または 指で こする。演出中の 連打は 1かい。
 *   - あそぶ … 演出が 最後まで おわった 1かいを かぞえる。とちゅうで やめたら かぞえない。
 * カメラ映像は どこにも 送らない・保存しない。
 *
 * three.js（MIT）は vendor/three/ に 同梱。はじめて AR画面を ひらいたときに 読みこむ。
 */
(function () {
  const BCT = window.BCT;
  const { $, ui, game, pets } = BCT;
  const M = BCT.arMath;
  const root = $("scr-ar");
  const video = $("arVideo");
  const touch = $("arTouch");

  const FLOOR_Y = -1.1;       // ジャイロ式：ゆかは 目の高さより 1.1m 下と みなす
  const GYRO_DIST = 1.5;      // ジャイロ式：ようせいまでの きょり
  const SIZE = { xr: 0.5, gyro: 0.8 }; // ようせいの 大きさ（メートル）
  const G = 9.8;
  const AMP = { 1: 0.75, 2: 1, 3: 1.3 }; // 大きく なるほど 動きも 大きく
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  let THREE = null;
  let loading = null;
  let renderer = null, scene, camera, petSprite, shadow, reticle, raycaster;
  let mode = null;            // "xr" | "gyro" | "static"
  let intent = "play";        // ホームの「あそぶ」（なでる と おもちゃ の りょうほう）。open("pet") の ときだけ なでる の 案内
  let stream = null;
  let xrSession = null, hitSource = null;
  let placed = false;
  let petPos = [0, FLOOR_Y, -GYRO_DIST];
  let petOffset = [0, 0, 0];   // 演出の うごき
  let orient = null;           // さいごの deviceorientation
  let camQ = null;
  let busy = false;            // 演出中（このあいだの タップは かぞえない）
  let token = 0;               // AR を とじたら ふえる（とちゅうの あそびを かぞえない）
  let anim = null;             // { kind, t0, dur }
  let lastT = 0;
  const parts = [];            // ハート・ボール・あわ・音符
  const tex = new Map();       // テクスチャの キャッシュ
  const petTextureKeys = new Set();
  let petTextureEpoch = 0;
  let curKey = "";

  // ---------------- three.js を 読みこむ ----------------
  function loadThree() {
    if (!loading) {
      const url = new URL("vendor/three/three.module.js", document.baseURI).href;
      loading = import(url).then((m) => { THREE = m; });
    }
    return loading;
  }

  function setupScene() {
    if (renderer) return;
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    renderer.xr.enabled = true;
    renderer.domElement.id = "arCanvas";
    root.insertBefore(renderer.domElement, touch);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.05, 50);
    raycaster = new THREE.Raycaster();

    petSprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
    petSprite.center.set(0.5, 0.13); // 絵の 足もと（200中 174）を ゆかに あわせる
    petSprite.visible = false;
    petSprite.renderOrder = 2;
    scene.add(petSprite);

    shadow = new THREE.Mesh(new THREE.CircleGeometry(0.2, 32),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.visible = false;
    shadow.renderOrder = 1;
    scene.add(shadow);

    // ゆかの めじるし（WebXR）
    reticle = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.13, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }));
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);

    window.addEventListener("resize", () => {
      if (!renderer || (renderer.xr && renderer.xr.isPresenting)) return;
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    });
  }

  // ---------------- テクスチャ ----------------
  function canvasTexture(c) {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  function imageTexture(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const t = new THREE.Texture(img);
        t.colorSpace = THREE.SRGBColorSpace;
        t.needsUpdate = true;
        resolve(t);
      };
      img.onerror = reject;
      img.src = src;
    });
  }
  // ようせい（着せ替え・表情・ポーズ を 反映した いつもの絵）
  function petTexture(pose) {
    const s = BCT.store.get();
    const lv = Math.min(s.seenLv, game.level(s));
    const face = pose === "normal" && game.affection(s).stage >= 1 ? "happy" : undefined;
    const key = JSON.stringify([s.pet.type, lv, s.equip, pose, face]);
    if (!tex.has(key)) {
      petTextureKeys.add(key);
      tex.set(key, (async () => {
        const c = document.createElement("canvas");
        c.width = c.height = 512;
        const g = c.getContext("2d");
        try {
          const img = await BCT.art.toImage(pets.renderState(s, { lv, face, pose, px: 512 }));
          g.drawImage(img, 0, 0, 512, 512);
          g.getImageData(0, 0, 1, 1); // 書き出せない絵（tainted）なら ここで わかる
        } catch (e) {
          // 予備：着せ替えなしの 本体だけ
          g.clearRect(0, 0, 512, 512);
          const sp = BCT.PET_SPRITES && BCT.PET_SPRITES[`${s.pet.type}-${game.stageOf(lv)}-${face || "normal"}`];
          if (sp) {
            const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = sp.src; });
            const k = Math.min(420 / img.width, 400 / img.height);
            g.drawImage(img, (512 - img.width * k) / 2, 445 - img.height * k, img.width * k, img.height * k);
          }
        }
        if (BCT.petMotion) {
          try {
            const motion = await BCT.petMotion.createComposite({type:s.pet.type,stage:game.stageOf(lv),face,pose,equip:{...s.equip}});
            if (motion) {
              const texture = canvasTexture(motion.canvas);
              texture.userData.petMotion = motion;
              return texture;
            }
          } catch (e) { console.warn('AR pet motion: static artwork retained.', e); }
        }
        return canvasTexture(c);
      })());
    }
    return tex.get(key);
  }
  function glyphTexture(ch, color) {
    const key = "g" + ch + color;
    if (!tex.has(key)) {
      const c = document.createElement("canvas");
      c.width = c.height = 128;
      const g = c.getContext("2d");
      g.font = "bold 104px sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillStyle = color;
      g.strokeStyle = "rgba(255,255,255,.9)";
      g.lineWidth = 8;
      g.strokeText(ch, 64, 70);
      g.fillText(ch, 64, 70);
      tex.set(key, Promise.resolve(canvasTexture(c)));
    }
    return tex.get(key);
  }
  function bubbleTexture() {
    if (!tex.has("bubble")) {
      const c = document.createElement("canvas");
      c.width = c.height = 128;
      const g = c.getContext("2d");
      const grd = g.createRadialGradient(48, 44, 6, 64, 64, 60);
      grd.addColorStop(0, "rgba(255,255,255,.9)");
      grd.addColorStop(0.6, "rgba(200,235,255,.25)");
      grd.addColorStop(1, "rgba(120,190,240,.55)");
      g.fillStyle = grd;
      g.beginPath();
      g.arc(64, 64, 58, 0, Math.PI * 2);
      g.fill();
      tex.set("bubble", Promise.resolve(canvasTexture(c)));
    }
    return tex.get("bubble");
  }
  function toyTexture(id) {
    const sp = BCT.PET_SPRITES && BCT.PET_SPRITES[id];
    if (!tex.has(id)) tex.set(id, sp ? imageTexture(sp.src) : glyphTexture("●", "#ff6b6b"));
    return tex.get(id);
  }

  async function showPose(pose) {
    const key = pose;
    const epoch = petTextureEpoch;
    curKey = key;
    const t = await petTexture(pose);
    if (curKey !== key || epoch !== petTextureEpoch || !petSprite) return;
    petSprite.material.map = t;
    petSprite.material.needsUpdate = true;
  }

  // ---------------- カメラの 位置・向き ----------------
  function camBasis() {
    camera.updateMatrixWorld();
    const e = camera.matrixWorld.elements;
    return { pos: [e[12], e[13], e[14]], right: [e[0], e[1], e[2]], up: [e[4], e[5], e[6]], fwd: [-e[8], -e[9], -e[10]] };
  }
  const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
  function rayCam() {
    if (mode === "xr" && renderer.xr.isPresenting) {
      const xc = renderer.xr.getCamera();
      return (xc.cameras && xc.cameras[0]) || xc;
    }
    return camera;
  }
  function ndc(clientX, clientY) {
    const r = root.getBoundingClientRect();
    return new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  }
  // ようせいに さわったか（子どもでも あたるように 少し ひろめ）
  function hitsPet(clientX, clientY) {
    if (!placed || !petSprite.visible) return false;
    const cam = rayCam();
    raycaster.setFromCamera(ndc(clientX, clientY), cam);
    if (raycaster.intersectObject(petSprite).length) return true;
    const p = petScreen();
    if (!p) return false;
    const r = root.getBoundingClientRect();
    const px = (p.x + 1) / 2 * r.width + r.left, py = (1 - p.y) / 2 * r.height + r.top;
    return Math.hypot(clientX - px, clientY - py) < Math.max(50, p.radius * 1.1);
  }
  // ようせいの 画面上の 位置（-1〜1）と 半径（px）
  function petScreen() {
    if (!placed) return null;
    const cam = rayCam();
    const s = petSprite.scale.y;
    const center = new THREE.Vector3(petSprite.position.x, petSprite.position.y + s * 0.37, petSprite.position.z);
    const v = center.clone().project(cam);
    if (v.z > 1) return null;
    const top = new THREE.Vector3(center.x, center.y + s * 0.45, center.z).project(cam);
    const h = root.getBoundingClientRect().height;
    return { x: v.x, y: v.y, radius: Math.abs(top.y - v.y) / 2 * h };
  }
  // 画面の (x,y) から ゆか（y=floorY）に 当たる点
  function floorPoint(clientX, clientY, floorY) {
    raycaster.setFromCamera(ndc(clientX, clientY), rayCam());
    const o = raycaster.ray.origin, d = raycaster.ray.direction;
    if (d.y > -0.05) return null;
    const t = (floorY - o.y) / d.y;
    if (t < 0.3 || t > 6) return null;
    return [o.x + d.x * t, floorY, o.z + d.z * t];
  }

  // ---------------- ようせいを おく ----------------
  function place(pos) {
    petPos = pos.slice();
    placed = true;
    petOffset = [0, 0, 0];
    const s = SIZE[mode === "xr" ? "xr" : "gyro"];
    petSprite.scale.set(s, s, 1);
    shadow.scale.set(s * 1.2, s * 1.2, 1);
    petSprite.visible = true;
    shadow.visible = true;
    hint(intentHint());
    renderTray();
  }
  function placeInFrontOfCamera() {
    const b = camBasis();
    const floorY = mode === "xr" ? (placed ? petPos[1] : b.pos[1] - 1.2) : FLOOR_Y;
    const f = [b.fwd[0], 0, b.fwd[2]];
    const n = Math.hypot(f[0], f[2]) || 1;
    const d = mode === "xr" ? 1.0 : GYRO_DIST;
    place([b.pos[0] + (f[0] / n) * d, floorY, b.pos[2] + (f[2] / n) * d]);
  }
  const intentHint = () => intent === "play"
    ? "ようせいを タップ・ゆびで なでなで したり、したの おもちゃで あそんでね"
    : "ようせいを タップ・ゆびで なでなで してね";

  // ---------------- 毎フレーム ----------------
  function frame(t, xrFrame) {
    const now = t || performance.now();
    const dt = Math.min(0.1, lastT ? (now - lastT) / 1000 : 0.016);
    lastT = now;
    if (xrFrame && hitSource && mode === "xr") {
      const hits = xrFrame.getHitTestResults(hitSource);
      const ref = renderer.xr.getReferenceSpace();
      if (hits.length && ref) {
        const pose = hits[0].getPose(ref);
        reticle.visible = !placed;
        reticle.matrix.fromArray(pose.transform.matrix);
        if (!placed) hint("ゆかに わっかが でたら、そこを タップして ようせいを おいてね");
      } else {
        reticle.visible = false;
        if (!placed) hint("ゆかを ゆっくり うつしてね");
      }
    }
    if (mode === "gyro" && orient) {
      const angle = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
      const q = M.deviceQuaternion(orient.alpha, orient.beta, orient.gamma, angle);
      const tq = new THREE.Quaternion(q[0], q[1], q[2], q[3]);
      if (!camQ) camQ = tq.clone();
      camQ.slerp(tq, 0.35); // ぶれを すこし なめらかに
      camera.quaternion.copy(camQ);
    }
    update(dt, now / 1000);
    renderer.render(scene, camera);
  }

  function update(dt, sec) {
    if (!placed) return;
    const petMap = petSprite.material.map;
    if (petMap?.userData.petMotion?.update(sec * 1000, {reduced:ui.reducedMotion(),energy:anim ? 1.5 : 1})) petMap.needsUpdate = true;
    const s = BCT.store.get();
    const amp = AMP[game.stageOf(Math.min(s.seenLv, game.level(s)))] || 1;
    let off = [0, 0.02 * Math.sin(sec * 2.2), 0]; // ふわふわ
    let rot = 0;
    if (anim) {
      const k = Math.min(1, (performance.now() - anim.t0) / anim.dur);
      const hop = (n, h) => Math.abs(Math.sin(k * Math.PI * n)) * h * amp;
      if (anim.kind === "pet") off[1] += hop(2, 0.08);
      if (anim.kind === "special") { off[1] += hop(2, 0.16); rot = k * Math.PI * 4; }
      if (anim.kind === "ball") off[1] += hop(3, s.pet.type === "dolphin" ? 0.22 : 0.1);
      if (anim.kind === "bubbles") off[1] += hop(2, 0.18);
      if (anim.kind === "music") { rot = Math.sin(k * Math.PI * 6) * 0.18; off[1] += hop(4, 0.05); }
      if (anim.kind === "move" && anim.from) {
        const e = k * k * (3 - 2 * k);
        petPos = [anim.from[0] + (anim.to[0] - anim.from[0]) * e, anim.from[1] + (anim.to[1] - anim.from[1]) * e, anim.from[2] + (anim.to[2] - anim.from[2]) * e];
        off[1] += hop(4, 0.04);
      }
      if (k >= 1 && anim.kind !== "move") anim = null;
    }
    if (ui.reducedMotion()) { off = [0, 0, 0]; rot = 0; }
    petSprite.position.set(petPos[0] + off[0], petPos[1] + off[1], petPos[2] + off[2]);
    petSprite.material.rotation = rot;
    shadow.position.set(petPos[0], petPos[1] + 0.003, petPos[2]);

    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.t += dt;
      const k = p.t / p.life;
      if (p.kind === "ball") {
        const pos = M.positionAt(p.start, p.v, G, Math.min(p.t, p.flight));
        p.obj.position.set(pos[0], pos[1], pos[2]);
        p.obj.material.rotation += dt * 10;
      } else if (p.kind === "float") {
        p.obj.position.set(p.from[0] + (p.to[0] - p.from[0]) * k, p.from[1] + (p.to[1] - p.from[1]) * k + Math.sin(k * Math.PI) * 0.1, p.from[2] + (p.to[2] - p.from[2]) * k);
        p.obj.material.opacity = Math.min(1, (1 - k) * 2);
      } else {
        p.obj.position.y += dt * 0.35;
        p.obj.material.opacity = Math.min(1, (1 - k) * 2.5); // おわりの ほうで うすく なる
      }
      if (k >= 1) {
        scene.remove(p.obj);
        p.obj.material.dispose();
        parts.splice(i, 1);
      }
    }
  }

  async function spawn(kind, texPromise, size, opts) {
    const t = await texPromise;
    if (!renderer) return null;
    const obj = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
    obj.scale.set(size, size, 1);
    obj.renderOrder = 3;
    const p = Object.assign({ kind, obj, t: 0 }, opts);
    if (opts.at) obj.position.set(opts.at[0], opts.at[1], opts.at[2]);
    scene.add(obj);
    parts.push(p);
    return p;
  }
  function hearts(n, glyph) {
    const s = petSprite.scale.y;
    for (let i = 0; i < n; i++) {
      const at = [petPos[0] + (Math.random() - 0.5) * s * 0.7, petPos[1] + s * (0.55 + Math.random() * 0.3), petPos[2] + (Math.random() - 0.5) * 0.05];
      spawn("rise", glyphTexture(glyph || ["♥", "♥", "✦"][i % 3], i % 3 === 2 ? "#ffcf3f" : "#ff6f9f"), s * 0.22, { at, life: 1.2 + Math.random() * 0.4 });
    }
  }

  // ---------------- なでる ----------------
  async function doPet() {
    if (busy || !placed) return;
    busy = true;
    const tk = token;
    const r = game.pet();
    const a = game.affection(BCT.store.get());
    const special = a.stage >= 3;
    const reduce = ui.reducedMotion();
    anim = { kind: special ? "special" : "pet", t0: performance.now(), dur: special ? 2100 : 1200 };
    showPose(a.stage >= 1 ? "smile" : "normal");
    hearts(special ? 7 : 4);
    // なつきど2：こちらに 近づく
    if (a.stage >= 2) {
      const b = camBasis();
      const to = [petPos[0] + (b.pos[0] - petPos[0]) * 0.3, petPos[1], petPos[2] + (b.pos[2] - petPos[2]) * 0.3];
      const d = Math.hypot(to[0] - b.pos[0], to[2] - b.pos[2]);
      if (d > (mode === "xr" ? 0.55 : 1.0)) { petPos = to; }
    }
    if (r.stageUp) arToast(`なつきど が あがった！ ${"♥".repeat(a.stage)}　${pets.AFFECTION_LINES[a.stage]}`);
    else arToast(pets.randomLine(BCT.store.get().pet.type, BCT.store.get().team.name));
    renderHearts();
    await sleep(reduce ? 400 : special ? 2200 : 1300);
    if (tk !== token) return;
    showPose("normal");
    busy = false;
  }

  // ---------------- おもちゃで あそぶ ----------------
  async function playToy(id, aimDx) {
    if (busy) return;
    if (!placed) { arToast("さきに ようせいを おいてね"); return; }
    if (!game.owns(BCT.store.get(), id)) return;
    busy = true;
    const tk = ++token;
    const ok = () => tk === token && ui.current() === "ar" && !!renderer;
    const reduce = ui.reducedMotion();
    const b = camBasis();
    const s = petSprite.scale.y;
    const catchPt = [petPos[0], petPos[1] + s * 0.4, petPos[2]];
    renderTray();

    if (id === "toy_ball") {
      // 画面の 下の ほうから 飛んでいく（ポケモンGO のように）
      const start = add(add(b.pos, b.fwd, 0.6), b.up, -0.26);
      // はずれても 画面の中に いるくらいの ずれに おさえる
      const miss = M.aimOffset(aimDx, mode === "xr" ? 0.45 : 0.55);
      const home = petPos.slice();
      const target = add(catchPt, b.right, miss);
      const flight = reduce ? 0.35 : 0.75;
      const v = M.throwVelocity(start, target, flight, G);
      const ball = await spawn("ball", toyTexture("toy_ball"), s * 0.16, { start, v, flight, life: flight + 0.05 });
      await sleep(flight * 1000);
      if (!ok()) return;
      if (ball) { scene.remove(ball.obj); ball.life = 0; }
      // とどかなかったら ようせいが おいかける（だれでも あそべるように）
      if (M.dist(target, catchPt) > M.CATCH_RADIUS) {
        const to = [target[0], petPos[1], target[2]];
        anim = { kind: "move", t0: performance.now(), dur: reduce ? 200 : 700, from: petPos.slice(), to };
        arToast("あっ！ おいかけるよ〜");
        await sleep(reduce ? 220 : 720);
        if (!ok()) return;
        petPos = to;
        anim = null;
      }
      showPose("toy_ball");
      anim = { kind: "ball", t0: performance.now(), dur: reduce ? 500 : 1900 };
      hearts(3);
      arToast(BCT.poseName("toy_ball", BCT.store.get().pet.type) + "！");
      await sleep(reduce ? 550 : 2000);
      // おいかけた ときは もとの 場所に もどってくる
      if (ok() && M.dist(petPos, home) > 0.05) {
        anim = { kind: "move", t0: performance.now(), dur: reduce ? 200 : 800, from: petPos.slice(), to: home };
        await sleep(reduce ? 220 : 820);
        if (!ok()) return;
        petPos = home;
        anim = null;
      }
    } else if (id === "toy_bubbles") {
      const from = add(add(b.pos, b.fwd, 0.6), b.up, -0.22);
      for (let i = 0; i < 6; i++) {
        const to = [catchPt[0] + (Math.random() - 0.5) * s * 0.8, catchPt[1] + (Math.random() - 0.2) * s * 0.5, catchPt[2]];
        spawn("float", bubbleTexture(), s * (0.12 + Math.random() * 0.1), { at: from, from, to, life: (reduce ? 0.4 : 1.1) + i * 0.08 });
      }
      await sleep(reduce ? 400 : 1000);
      if (!ok()) return;
      showPose("toy_bubbles");
      anim = { kind: "bubbles", t0: performance.now(), dur: reduce ? 500 : 1800 };
      arToast(BCT.poseName("toy_bubbles", BCT.store.get().pet.type) + "！");
      await sleep(reduce ? 550 : 1900);
    } else if (id === "toy_music") {
      showPose("toy_music");
      anim = { kind: "music", t0: performance.now(), dur: reduce ? 600 : 2400 };
      for (let i = 0; i < 6; i++) setTimeout(() => ok() && hearts(1, "♪"), i * 300);
      arToast(BCT.poseName("toy_music", BCT.store.get().pet.type) + "！");
      await sleep(reduce ? 650 : 2500);
    }
    if (!ok()) return; // とちゅうで やめたら かぞえない
    const r = game.playToy(id);
    showPose("normal");
    busy = false;
    renderTray();
    if (r.ok && r.unlocked) {
      const st = BCT.store.get();
      notice(`<h3>✨ あたらしい ポーズを おぼえた！</h3>
        <div class="reward-preview">${pets.renderState(st, { pose: r.unlocked })}</div>
        <p style="text-align:center;font-size:19px;font-weight:800;margin:6px 0">「${ui.esc(BCT.poseName(r.unlocked, st.pet.type))}」</p>
        <p class="lead">「いっしょに さつえい」で つかえるよ</p>`);
    } else if (r.ok) {
      const need = BCT.CONFIG.toyUnlockPlays;
      arToast(`たのしかった！（ポーズまで ${Math.min(r.plays, need)}/${need}）`);
    }
  }

  // ---------------- 画面の 部品 ----------------
  function hint(text) {
    const h = $("arHint");
    if (h.textContent !== text) h.textContent = text;
  }
  let toastTimer = null;
  function arToast(text) {
    const el = $("arToast");
    el.textContent = text;
    el.hidden = false;
    el.classList.remove("pop");
    void el.offsetWidth;
    el.classList.add("pop");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
  }
  function notice(html) {
    const n = $("arNotice");
    n.innerHTML = `<div class="box">${html}<button class="btn block mint" data-ar-close>やったね！</button></div>`;
    n.hidden = false;
  }
  function renderHearts() {
    const a = game.affection(BCT.store.get());
    $("arHearts").innerHTML = Array.from({ length: a.maxStage }, (_, i) => `<span class="${i < a.stage ? "on" : ""}">♥</span>`).join("") +
      (a.max ? " <small>MAX</small>" : ` <small>${a.step}/${a.perStage}</small>`);
  }
  function renderTray() {
    const s = BCT.store.get();
    const toys = game.ownedItems(s, "toy");
    const need = BCT.CONFIG.toyUnlockPlays;
    $("arTray").innerHTML = toys.length
      ? toys.map((t) => {
          const n = game.toyPlays(s, t.id);
          return `<button class="ar-toy ${busy ? "busy" : ""}" data-toy="${t.id}" aria-label="${ui.esc(t.name)}">
            ${BCT.art.itemIcon(t.id)}<small>${n >= need ? "★" : `${n}/${need}`}</small></button>`;
        }).join("")
      : `<button class="ar-noshop" data-ar-shop>おもちゃは ショップで かえるよ</button>`;
  }

  // ---------------- ゆび の 操作 ----------------
  let down = null;
  touch.addEventListener("pointerdown", (e) => {
    down = { x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, moved: 0, rub: 0, onPet: hitsPet(e.clientX, e.clientY) };
    try { touch.setPointerCapture(e.pointerId); } catch (err) { /* なし */ }
  });
  touch.addEventListener("pointermove", (e) => {
    if (!down) return;
    const d = Math.hypot(e.clientX - down.lastX, e.clientY - down.lastY);
    down.moved += d;
    down.lastX = e.clientX;
    down.lastY = e.clientY;
    // 指で こする（なでなで）
    if (down.onPet && hitsPet(e.clientX, e.clientY)) {
      down.rub += d;
      if (down.rub > 70) {
        down.rub = -1e9; // 1かい こすって 1かい
        doPet();
      }
    }
  });
  touch.addEventListener("pointerup", (e) => {
    const d = down;
    down = null;
    if (!d || d.moved > 14) return;
    tap(e.clientX, e.clientY);
  });
  touch.addEventListener("pointercancel", () => { down = null; });

  function tap(x, y) {
    if (!renderer) return;
    if (!placed) {
      if (mode === "xr") {
        if (reticle.visible) {
          const p = new THREE.Vector3().setFromMatrixPosition(reticle.matrix);
          place([p.x, p.y, p.z]);
        }
      } else {
        place(floorPoint(x, y, FLOOR_Y) || M.placeInFront(camQ ? [camQ.x, camQ.y, camQ.z, camQ.w] : [0, 0, 0, 1], GYRO_DIST, FLOOR_Y));
      }
      return;
    }
    if (hitsPet(x, y)) doPet();
  }

  // WebXR で DOM の上に 出せない端末（dom-overlay なし）は select で うけとる
  function onXrSelect(ev) {
    if (xrSession && xrSession.domOverlayState) return; // ふつうは DOM の ゆび操作で うける
    const ref = renderer.xr.getReferenceSpace();
    if (!placed) {
      if (reticle.visible) {
        const p = new THREE.Vector3().setFromMatrixPosition(reticle.matrix);
        place([p.x, p.y, p.z]);
      }
      return;
    }
    const pose = ev.frame && ev.frame.getPose(ev.inputSource.targetRaySpace, ref);
    if (!pose) return;
    const o = pose.transform.position, q = pose.transform.orientation;
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w));
    raycaster.set(new THREE.Vector3(o.x, o.y, o.z), dir);
    if (raycaster.intersectObject(petSprite).length) doPet();
  }

  // おもちゃ：タップで まっすぐ、うえに はじくと その向きに なげる
  let toyDown = null;
  $("arTray").addEventListener("pointerdown", (e) => {
    const b = e.target.closest("[data-toy]");
    if (!b) return;
    toyDown = { id: b.dataset.toy, x: e.clientX, y: e.clientY };
    try { $("arTray").setPointerCapture(e.pointerId); } catch (err) { /* なし */ }
  });
  $("arTray").addEventListener("pointerup", (e) => {
    const d = toyDown;
    toyDown = null;
    if (!d) return;
    // うえに 30px 以上 はじいたら、横の ずれの ぶんだけ ねらいが ずれる。タップなら まっすぐ
    const flick = d.y - e.clientY > 30;
    const dx = (e.clientX - d.x) / root.getBoundingClientRect().width;
    playToy(d.id, flick ? dx * 2 : 0);
  });
  $("arTray").addEventListener("pointercancel", () => { toyDown = null; });
  root.addEventListener("click", (e) => {
    if (e.target.closest("[data-ar-close]")) $("arNotice").hidden = true;
    if (e.target.closest("[data-ar-shop]")) { stop(); ui.show("shop", "toy"); }
  });
  // XR の DOM の上の ボタンを おしたときは「ゆかを タップ」に しない
  root.addEventListener("beforexrselect", (e) => {
    if (e.target.closest("button, .ar-start, .ar-notice")) e.preventDefault();
  });

  // ---------------- はじめる・おわる ----------------
  function onOrient(e) {
    if (e.alpha == null && e.beta == null) return;
    orient = { alpha: e.alpha || 0, beta: e.beta || 0, gamma: e.gamma || 0 };
  }

  async function xrSupported() {
    try {
      return !!(navigator.xr && window.isSecureContext && (await navigator.xr.isSessionSupported("immersive-ar")));
    } catch (e) {
      return false;
    }
  }

  function running(m) {
    mode = m;
    root.classList.toggle("xr", m === "xr");
    $("arStart").hidden = true;
    $("arHud").hidden = false;
    $("arMode").textContent = m === "xr" ? "ゆかに おく AR" : m === "gyro" ? "ジャイロ AR" : "AR（スマホを うごかしても ついてこない モード）";
    renderHearts();
    renderTray();
    showPose("normal");
    lastT = 0;
    renderer.setAnimationLoop(frame);
  }

  async function startXR() {
    // ユーザーの タップの 直後に よぶ（ブラウザの きまり）
    let session;
    try {
      await loadThree();
      setupScene();
      session = await navigator.xr.requestSession("immersive-ar", {
        requiredFeatures: ["hit-test"],
        optionalFeatures: ["dom-overlay"],
        domOverlay: { root },
      });
    } catch (e) {
      console.warn("WebXR", e);
      startMsg("ゆかに おく AR が はじめられなかったよ。「カメラで AR」を ためしてね");
      return;
    }
    xrSession = session;
    renderer.xr.setReferenceSpaceType("local");
    await renderer.xr.setSession(session);
    try {
      const viewer = await session.requestReferenceSpace("viewer");
      hitSource = await session.requestHitTestSource({ space: viewer });
    } catch (e) {
      console.warn("hit-test", e);
    }
    session.addEventListener("select", onXrSelect);
    session.addEventListener("end", () => {
      xrSession = null;
      hitSource = null;
      placed = false;
      token++;
      busy = false;
      if (renderer) renderer.setAnimationLoop(null);
      root.classList.remove("xr");
      if (ui.current() === "ar") showStart();
    });
    placed = false;
    hint("ゆかを ゆっくり うつしてね");
    running("xr");
  }

  async function startCamera() {
    // iPhone は 傾きの きょかが 要る（タップの 直後に よぶ）
    let permission = Promise.resolve("granted");
    try {
      if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === "function") {
        permission = DeviceOrientationEvent.requestPermission().catch(() => "denied");
      }
    } catch (e) { /* なし */ }
    const why = !window.isSecureContext ? "カメラは https の ページでしか つかえません。"
      : !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia ? "この ブラウザでは カメラが つかえません。" : null;
    if (why) return cameraFailed(why);
    startMsg("📷 カメラを じゅんび しているよ…");
    const ask = () => navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
    try {
      // とじた すぐあとは カメラが まだ 空いていないことが ある → すこしずつ まって 3かいまで
      for (let i = 0; ; i++) {
        try {
          stream = await ask();
          break;
        } catch (e) {
          if (e.name === "NotAllowedError" || e.name === "SecurityError" || i >= 2) throw e;
          await sleep(500 * (i + 1));
        }
      }
    } catch (e) {
      console.warn("AR カメラ", e.name, e.message);
      cameraFailed(e.name === "NotAllowedError" || e.name === "SecurityError"
        ? "カメラの きょかが ありません。" : "カメラを うごかせませんでした。");
      // きょかが ない ときは、きょかの しかたを 出す（ゆるされるまで「もういちど ためす」で なんども。js/camera-permission.js）
      if (BCT.cameraPermission && BCT.cameraPermission.isPermissionError(e) && ui.current() === "ar") BCT.cameraPermission.ask(startCamera);
      return;
    }
    if (ui.current() !== "ar") { stopStream(); return; }
    startMsg("");
    video.srcObject = stream;
    video.hidden = false;
    try { await video.play(); } catch (e) { /* 映像は出る */ }
    await loadThree();
    setupScene();
    await permission;
    window.addEventListener("deviceorientation", onOrient);
    // 傾きが とどくか すこし まつ
    for (let i = 0; i < 10 && !orient; i++) await sleep(80);
    if (ui.current() !== "ar") return;
    camQ = null;
    if (orient) {
      running("gyro");
      // はじめの 1フレームで 向きを きめてから 前に おく
      await sleep(60);
      const q = M.deviceQuaternion(orient.alpha, orient.beta, orient.gamma, (screen.orientation && screen.orientation.angle) || 0);
      place(M.placeInFront(q, GYRO_DIST, FLOOR_Y));
    } else {
      // 傾きが とれない：すこし 下を 見た 向きで 固定
      const q = M.deviceQuaternion(0, 72, 0, 0);
      camera.quaternion.set(q[0], q[1], q[2], q[3]);
      running("static");
      place(M.placeInFront(q, GYRO_DIST, FLOOR_Y));
    }
  }

  function cameraFailed(why) {
    stopStream();
    startMsg(`<b>${ui.esc(why)}</b><br>「カメラを つかわない」で いつもの あそびかたが できるよ。`);
    $("arNoCam").classList.add("mint");
  }
  function startMsg(html) {
    const m = $("arStartMsg");
    m.innerHTML = html || "";
    m.hidden = !html;
  }

  function stopStream() {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
    video.pause && video.pause();
    video.srcObject = null;
    video.hidden = true;
  }
  function stop() {
    token++;
    petTextureEpoch++;
    busy = false;
    anim = null;
    placed = false;
    curKey = '';
    for (const key of petTextureKeys) {
      tex.get(key)?.then(texture => { texture.userData.petMotion?.dispose(); texture.dispose(); }).catch(() => {});
      tex.delete(key);
    }
    petTextureKeys.clear();
    window.removeEventListener("deviceorientation", onOrient);
    orient = null;
    stopStream();
    if (xrSession) {
      xrSession.end().catch(() => {});
      xrSession = null;
    }
    if (renderer) {
      renderer.setAnimationLoop(null);
      petSprite.visible = shadow.visible = reticle.visible = false;
      parts.splice(0).forEach((p) => { scene.remove(p.obj); p.obj.material.dispose(); });
    }
    root.classList.remove("xr");
    $("arNotice").hidden = true;
  }

  async function showStart() {
    stop();
    const epoch = petTextureEpoch;
    $("arStart").hidden = false;
    $("arHud").hidden = true;
    $("arNoCam").classList.remove("mint");
    startMsg("");
    $("arIntent").textContent = intent === "play" ? "ようせいと いっしょに あそぼう！（なでなで・おもちゃ）" : "ようせいを なでなで しよう！";
    // さきに 読みこんで おく（ボタンを おしてから 待たせないため）
    const btns = [$("arXr"), $("arCam")];
    btns.forEach((b) => (b.disabled = true));
    $("arXr").hidden = true;
    loadThree().then(() => {
      if (epoch !== petTextureEpoch || ui.current() !== 'ar') return;
      setupScene();
      const s = BCT.store.get();
      ["normal", "smile", "toy_ball", "toy_bubbles", "toy_music"].forEach((p) => s.pet && petTexture(p));
    }).catch((e) => {
      console.warn(e);
      startMsg("AR の じゅんびが できませんでした。「カメラを つかわない」で あそべるよ");
    }).finally(() => btns.forEach((b) => (b.disabled = false)));
    $("arXr").hidden = !(await xrSupported());
  }

  $("arXr").addEventListener("click", startXR);
  $("arCam").addEventListener("click", startCamera);
  // カメラを つかわない → ホームで いつもの あそびかた（おもちゃを えらぶ。ようせいは ホームで タップすると なでなで）
  $("arNoCam").addEventListener("click", () => {
    stop();
    ui.show("home");
    if (intent === "pet") BCT.home.petLegacy();
    else BCT.home.playLegacy();
  });
  $("arBack").addEventListener("click", () => { stop(); ui.show("home"); });
  $("arStartBack").addEventListener("click", () => { stop(); ui.show("home"); });
  $("arRecall").addEventListener("click", () => {
    if (!renderer || busy) return;
    if (mode === "xr" && reticle.visible) {
      const p = new THREE.Vector3().setFromMatrixPosition(reticle.matrix);
      place([p.x, p.y, p.z]);
    } else {
      placeInFrontOfCamera();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && ui.current() === "ar" && (stream || xrSession)) showStart();
  });
  window.addEventListener("pagehide", stop);

  // ホームの「あそぶ」から ひらく
  function open(what) {
    intent = what === "pet" ? "pet" : "play";
    ui.show("ar");
  }

  BCT.ar = {
    open,
    debug: () => ({
      mode, placed, busy, petPos: petPos.slice(), screen: placed && renderer ? petScreen() : null,
      parts: parts.length, three: !!THREE, camera: !!stream,
    }),
    tapScreen: tap,
  };
  BCT.screens.ar = { show: showStart, hide: stop };
})();
