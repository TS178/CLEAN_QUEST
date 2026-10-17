/*
 * パーツで うごかす ようせい（素の JavaScript。外部ライブラリなし）
 * ------------------------------------------------------------
 * - パーツ画像（assets/pet-parts）を 重ねた 入れ物を つくる。
 *   親子（胴体 → 尾の付け根 → 尾びれ など）は 入れ子の 要素にして、親が 回ると 子も ついてくる。
 * - 各パーツの transform-origin は 付け根（設定の pivot）。requestAnimationFrame 1本で サイン波の 回転を かける。
 * - 移動の 速さ（画面上の 位置の 変化）を はかり、ヒレ・脚の 速さと 振れ幅を 連動させる。止まっていると 小さく うごく。
 * - 向きが かわるとき（.left の つけはずし）は 一瞬で 反転する。設定の turnMs を ふやすと そのあいだ 正面の 静止画を 見せる。
 * - 帽子・こもの は 正面の絵と 同じ 付け根で 頭・胴体の パーツの 子に するので、いっしょに うごく。
 * - 正面の絵（js/pet-art.js）と 同じ 位置・大きさに 出すので、正面の絵と 切りかえても ずれない。
 * 設定：js/pet-rig-config.js   確認用ページ：preview-pet-rig.html
 * 正面絵の切り出し版は js/pet-skin.js で１枚の連続した面として描く。
 * 切り出し画像は動かす範囲の判定に使い、付け根に隙間が開かないようにする。
 */
(function () {
  const BCT = (window.BCT = window.BCT || {});
  const TAU = Math.PI * 2;
  const RAD = Math.PI / 180;

  // ---------------- 計算（画面に たよらない。tests/pet-rig.test.mjs） ----------------
  // 速さ（からだの 幅/秒）→ うごきの 強さ 0〜1.3
  const motionLevel = (speed, speedRef) => Math.max(0, Math.min(1.3, speed / (speedRef || 1)));
  // 振れ幅の 割合：止まっていると idleAmp、ふつうに うごくと 1
  const ampScale = (level, idleAmp) => idleAmp + (1 - idleAmp) * Math.min(1, level);
  // 1秒あたりの 回数：止まっていると idleHz、ふつうに うごくと moveHz（はやいと すこし こえる）
  const frequency = (level, cycle) => cycle.idleHz + (cycle.moveHz - cycle.idleHz) * level;
  // パーツの 振れ（度）
  const swingAngle = (swing, phase, scale) => (swing ? swing.amp * scale * Math.sin(phase * (swing.freq || 1) + (swing.phase || 0)) : 0);
  // 歩くときの 胴体の 上下（1歩ごとに 1回 もちあがる）。胴体の 高さに 対する 割合
  const bobOffset = (bob, phase, scale) => (bob ? -bob.amp * scale * Math.abs(Math.sin(phase * ((bob.freq || 2) / 2) + (bob.phase || 0))) : 0);
  // 頭の 上下
  const headOffset = (head, phase, scale) => (head ? -head.amp * scale * Math.sin(phase * (head.freq || 1) + (head.phase || 0)) : 0);
  /*
   * 次の 行き先（横の 位置）。向きを かえるのは canTurn の ときだけ（反対側の ほうが ひろいとき）。
   * それまでは 向いている ほうへ、のこりの 幅の 一部だけ すすむ（何度も 反転すると 目に つくため）
   *   x … いまの 位置、min / max … 行ける はんい、left … 左を むいているか、r … 0〜1 の 乱数
   *   → { x: 行き先, left: 行き先での 向き, turned: 向きを かえたか }
   */
  function nextX(x, min, max, left, canTurn, r) {
    const dir = left ? -1 : 1;
    const ahead = Math.max(0, left ? x - min : max - x);
    const behind = Math.max(0, left ? max - x : x - min);
    if (canTurn && behind > ahead) return { x: x - dir * behind * (0.4 + r * 0.5), left: !left, turned: true };
    return { x: x + dir * ahead * (0.15 + r * 0.35), left, turned: false };
  }
  // 点を 回す
  const rotate = (x, y, deg) => { const c = Math.cos(deg * RAD), s = Math.sin(deg * RAD); return [x * c - y * s, x * s + y * c]; };

  /*
   * 置き場所 → それぞれの 親の 要素の 中での 置き場所
   *   胴体など { x, y, rot, scale } … 画像の まんなかが 元の絵の (x, y) px に くる（付け根を かえても ずれない）
   *   子の パーツ { at, rot, scale } … 付け根を 親の 画像の at（割合）に 付ける。rot・scale は 親に 対して
   *   sizes[id] = [幅, 高さ]（パーツの 画像）
   */
  function localLayout(parts, sizes) {
    const out = {};
    for (const [id, p] of Object.entries(parts)) {
      const [w, h] = sizes[id];
      const piv = [p.pivot[0] * w, p.pivot[1] * h];
      const pl = p.place;
      let rot = pl.rot || 0, scale = pl.scale || 1, left, top;
      const par = p.parent && parts[p.parent];
      if (par && pl.at) {
        const [pw, ph] = sizes[p.parent];
        left = pl.at[0] * pw - piv[0];
        top = pl.at[1] * ph - piv[1];
      } else {
        let cx = pl.x, cy = pl.y;
        if (par) {
          // 親の 画像の 中の 座標に なおす（親も x, y で 置いているとき）
          const [pw, ph] = sizes[p.parent];
          const pp = par.place, ps = pp.scale || 1;
          const [dx, dy] = rotate(pl.x - pp.x, pl.y - pp.y, -(pp.rot || 0));
          cx = pw / 2 + dx / ps;
          cy = ph / 2 + dy / ps;
          rot -= pp.rot || 0;
          scale /= ps;
        }
        // 付け根を 中心に 回しても 画像の まんなかが (cx, cy) に くるように ずらす
        const [ox, oy] = rotate((w / 2 - piv[0]) * scale, (h / 2 - piv[1]) * scale, rot);
        left = cx - piv[0] - ox;
        top = cy - piv[1] - oy;
      }
      out[id] = { left, top, piv, rot, scale, w, h, flipX: !!pl.flip, flipY: !!pl.flipY };
    }
    return out;
  }

  // 正面の絵の 配置（js/pet-art.js の render の 出力から 読む。あちらが かわっても ついていける）
  //   元の絵の px (u, v) → 200×200 の 枠: X = tx + k·u, Y = ty + k·v
  //   帽子の 付け根（ANCHOR）は 胴体を ちぢめる前の 座標なので ox, oy, k0 も かえす
  function frontLayout(type, stage) {
    const sp = BCT.PET_SPRITES && BCT.PET_SPRITES[`${type}-${stage}-normal`];
    if (!sp || !BCT.art) return null;
    const svg = BCT.art.render({ type, stage, motion: false });
    const im = svg.match(/<image data-sprite="[^"]+" x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)"/);
    const bs = svg.match(/data-pet-body="" transform="translate\(([-\d.]+) ([-\d.]+)\) scale\(([\d.]+)\)/);
    if (!im || !bs) return null;
    const [bx, by, bw, bh] = im.slice(1, 5).map(Number);
    const [cx, cy, s] = bs.slice(1, 4).map(Number);
    const k0 = Math.min(bw / sp.width, bh / sp.height);
    const ox = bx + (bw - sp.width * k0) / 2, oy = by + bh - sp.height * k0; // xMidYMax meet
    return { W: sp.width, H: sp.height, k0, ox, oy, tx: cx + (ox - cx) * s, ty: cy + (oy - cy) * s, k: k0 * s };
  }

  const reduced = () => document.body.classList.contains("reduce-motion") ||
    !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  // ---------------- くみたて ----------------
  function loadImg(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("パーツの 画像が よめません: " + src));
      img.src = src;
    });
  }

  async function build(cfg, equip) {
    const front = frontLayout(cfg.type, cfg.stage);
    if (!front) throw new Error("正面の絵の 配置が わかりません");
    const ids = Object.keys(cfg.parts);
    const imgs = {};
    await Promise.all(ids.map(async (id) => { imgs[id] = await loadImg(BCT.petRigFile(cfg.type, cfg.stage, id)); }));
    const sizes = Object.fromEntries(ids.map((id) => [id, [imgs[id].naturalWidth, imgs[id].naturalHeight]]));
    const lay = localLayout(cfg.parts, sizes);

    const root = document.createElement("div");
    root.className = "pet-rig";
    root.dataset.type = cfg.type;
    root.dataset.stage = cfg.stage;
    root.setAttribute("aria-hidden", "true");
    const stage = document.createElement("div");
    stage.className = "pr-stage";
    stage.style.width = front.W + "px";
    stage.style.height = front.H + "px";
    if (cfg.tint) stage.style.filter = cfg.tint; // 色を 正面の絵に 近づける（設定の tint）
    root.appendChild(stage);

    const els = {};
    const mk = (id) => {
      const L = lay[id];
      const el = document.createElement("div");
      el.className = "pr-part";
      el.dataset.part = id;
      el.style.left = L.left.toFixed(2) + "px";
      el.style.top = L.top.toFixed(2) + "px";
      el.style.width = L.w + "px";
      el.style.height = L.h + "px";
      el.style.transformOrigin = `${L.piv[0].toFixed(2)}px ${L.piv[1].toFixed(2)}px`;
      el.style.transform = `rotate(${L.rot}deg) scale(${L.scale})`;
      if (cfg.parts[id].parent) el.style.zIndex = String(cfg.parts[id].z || 0);
      const img = imgs[id];
      img.className = "pr-img";
      img.alt = "";
      img.draggable = false;
      if (L.flipX || L.flipY) img.style.transform = `scale(${L.flipX ? -1 : 1}, ${L.flipY ? -1 : 1})`;
      el.appendChild(img);
      els[id] = el;
      return el;
    };
    stage.appendChild(mk("body"));
    // 親 → 子 の 順に つなぐ（マイナスの z は 親の 絵の うしろに 入る）
    const pending = ids.filter((id) => id !== "body");
    for (let guard = 0; pending.length && guard < 20; guard++) {
      for (let i = pending.length - 1; i >= 0; i--) {
        const parent = cfg.parts[pending[i]].parent;
        if (els[parent]) els[parent].appendChild(mk(pending.splice(i, 1)[0]));
      }
    }

    // ウミガメの 頭：胴体の 絵の 頭だけを ぼかして 切り出した 層（胴体の 中で 上下）
    let headEl = null;
    if (cfg.head) {
      const [bw, bh] = sizes.body;
      const hd = cfg.head;
      headEl = document.createElement("div");
      headEl.className = "pr-head";
      headEl.style.width = bw + "px";
      headEl.style.height = bh + "px";
      const r1 = hd.r * bw, r2 = (hd.r + hd.feather) * bw;
      const mask = `radial-gradient(circle at ${hd.at[0] * bw}px ${hd.at[1] * bh}px, #000 ${r1}px, transparent ${r2}px)`;
      const copy = imgs.body.cloneNode();
      copy.className = "pr-img";
      if (lay.body.flipX) copy.style.transform = "scaleX(-1)";
      copy.style.webkitMaskImage = mask;
      copy.style.maskImage = mask;
      headEl.appendChild(copy);
      els.body.appendChild(headEl);
    }

    // 帽子・こもの（正面の絵と 同じ 付け根。こもの → 帽子 の 順に 重ねる）
    const b = cfg.parts.body, bL = lay.body;
    const anchors = BCT.art.ANCHOR && BCT.art.ANCHOR[cfg.type] && BCT.art.ANCHOR[cfg.type][cfg.stage];
    for (const slot of ["acc", "head"]) {
      const id = equip && equip[slot];
      // アイテムごとの 付け根が あれば それ（js/pet-art-fix.js の anchorFor。ヤドカリの 帽子 など）
      const a = BCT.art.anchorFor ? BCT.art.anchorFor(cfg.type, cfg.stage, slot, id) : anchors && anchors[slot];
      const art = id && BCT.art.ITEM_ART && BCT.art.ITEM_ART[id];
      if (!a || !art) continue;
      const m = art().match(/x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)"[^>]*href="([^"]+)"/);
      if (!m) continue;
      const u = (a.x - front.ox) / front.k0, v = (a.y - front.oy) / front.k0; // 元の絵の px
      const [dx, dy] = rotate(u - b.place.x, v - b.place.y, -bL.rot); // 胴体の 画像の まんなか から
      const item = document.createElement("div");
      item.className = "pr-equip";
      item.dataset.slot = slot;
      item.dataset.item = id;
      // パーツ表示だけの ずらし（設定の equipShift。胴体の 画像に 対する 割合）
      const sh = (cfg.equipShift && cfg.equipShift[slot]) || [0, 0];
      item.style.left = (bL.w / 2 + dx / bL.scale + sh[0] * bL.w).toFixed(2) + "px";
      item.style.top = (bL.h / 2 + dy / bL.scale + sh[1] * bL.h).toFixed(2) + "px";
      item.style.transform = `rotate(${(a.r - bL.rot).toFixed(2)}deg) scale(${(a.s / (front.k0 * bL.scale)).toFixed(4)})`;
      const img = document.createElement("img");
      img.alt = "";
      img.draggable = false;
      img.src = m[5];
      if(BCT.art.isNeckItem?.(id)){
        const [x,y,w,h]=m.slice(1,5).map(Number);
        // Invert the item placement so the same head mask works in item-local space.
        const mask=`<mask id="neck" maskUnits="userSpaceOnUse" x="${x}" y="${y}" width="${w}" height="${h}"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="white"/><g transform="scale(${1/a.s}) rotate(${-a.r}) translate(${-a.x} ${-a.y})">${BCT.art.neckMask(cfg.type,cfg.stage)}</g></mask>`;
        img.src=BCT.art.toDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${w}" height="${h}"><defs>${mask}</defs><g mask="url(#neck)">${art()}</g></svg>`);
      }
      img.style.left = m[1] + "px";
      img.style.top = m[2] + "px";
      img.style.width = m[3] + "px";
      img.style.height = m[4] + "px";
      item.appendChild(img);
      (slot === "head" && headEl ? headEl : els.body).appendChild(item);
    }
    let skin = null;
    if (cfg.cut && BCT.petSkin) {
      skin = await BCT.petSkin.create(cfg, imgs, lay, front);
      root.classList.add('pr-connected');
      els.body.append(skin.fallback, skin.canvas);
    }
    return { root, stage, els, headEl, lay, front, skin, bodyH: sizes.body[1] };
  }

  // ---------------- うごかす ----------------
  const rigs = new Set();
  let raf = 0;

  // 入れ物（正面の絵の svg と 同じ 大きさ）に 合わせる
  function fit(rig) {
    if (!rig.parts) return;
    const hw = rig.host.clientWidth, hh = rig.host.clientHeight;
    if (!hw || !hh) return;
    const f = Math.min(hw, hh) / 200, F = rig.parts.front;
    const x = (hw - 200 * f) / 2 + F.tx * f, y = (hh - 200 * f) / 2 + F.ty * f;
    rig.parts.stage.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${(F.k * f).toFixed(5)})`;
  }

  function apply(rig, scale) {
    const { cfg, parts } = rig;
    for (const [id, el] of Object.entries(parts.els)) {
      const L = parts.lay[id];
      const ang = L.rot + swingAngle(cfg.parts[id].swing, rig.phase, scale);
      const by = id === "body" && cfg.bob ? bobOffset(cfg.bob, rig.phase, scale) * parts.bodyH : 0;
      el.style.transform = `${by ? `translateY(${by.toFixed(2)}px) ` : ""}rotate(${ang.toFixed(2)}deg) scale(${L.scale})`;
    }
    if (parts.headEl) parts.headEl.style.transform = `translateY(${(headOffset(cfg.head, rig.phase, scale) * parts.bodyH).toFixed(2)}px)`;
    if (parts.skin) {
      // The face stays on the continuous body; keep its hat attached to that same surface.
      if (parts.headEl) parts.headEl.style.transform = 'none';
      parts.skin.draw(rig.phase, scale);
    }
  }

  function step(rig, now) {
    const dt = Math.min(0.1, rig.last ? (now - rig.last) / 1000 : 0);
    rig.last = now;
    // 速さ：追いかけている 要素の 画面上の 位置の 変化（からだの 幅/秒）
    let raw = 0;
    if (rig.manual != null) raw = rig.manual;
    else {
      const r = rig.track.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      if (rig.prev && dt > 0) raw = Math.hypot(cx - rig.prev[0], cy - rig.prev[1]) / dt / Math.max(1, r.width);
      rig.prev = [cx, cy];
    }
    rig.speed += (raw - rig.speed) * Math.min(1, dt * rig.cfg.common.speedSmoothing);
    rig.level = motionLevel(rig.speed, rig.cfg.common.speedRef);
    rig.phase = (rig.phase + TAU * frequency(rig.level, rig.cfg.cycle) * dt) % (TAU * 1000);
    apply(rig, ampScale(rig.level, rig.cfg.idleAmp));
  }

  function tick(now) {
    raf = 0;
    if (document.hidden || reduced()) return;
    let any = false;
    for (const rig of rigs) {
      // 画面に 出ていない（ほかの 画面に いる）ときは 止める。もどったら setActive で また うごく
      if (!rig.parts || !rig.active || !rig.host.isConnected || !rig.host.getClientRects().length) continue;
      step(rig, now);
      any = true;
    }
    if (any) raf = requestAnimationFrame(tick);
  }
  function wake() {
    if (!raf && !document.hidden && !reduced()) raf = requestAnimationFrame(tick);
  }
  document.addEventListener("visibilitychange", wake);

  function show(rig) {
    const on = rig.active && !!rig.parts && !reduced();
    rig.owner.classList.toggle("rig-on", on);
    if (!on) rig.owner.classList.remove("rig-turn");
  }

  /*
   * ようせいを パーツで つくる
   *   host  … 入れ物を 入れる 要素（正面の絵の svg と 同じ 大きさ・位置の 要素）
   *   track … 速さ と 向きを 見る 要素（.left が つくと 左向き）
   *   owner … .rig-on（パーツを 見せる）／.rig-turn（ふりむき中）を つける 要素。CSS で 正面の絵と 切りかえる
   *   type, stage, equip … 種類・段階（1〜3）・着せ替え { head, acc }
   */
  function create(opts) {
    const cfg = opts.cfg || (BCT.petRigConfig && BCT.petRigConfig(opts.type, opts.stage));
    if (!cfg) return null;
    const rig = {
      cfg, host: opts.host, track: opts.track || opts.host, owner: opts.owner || opts.track || opts.host,
      parts: null, active: false, phase: Math.random() * TAU, speed: 0, level: 0, last: 0, prev: null, manual: null,
      key: opts.key || "",
    };
    rig.ready = build(cfg, opts.equip).then((parts) => {
      if (rig.destroyed) { if (parts.skin) parts.skin.destroy(); return false; }
      rig.parts = parts;
      rig.host.appendChild(parts.root);
      fit(rig);
      apply(rig, ampScale(0, cfg.idleAmp));
      show(rig);
      wake();
      return true;
    }).catch((e) => {
      console.warn("パーツで うごかせないので 正面の 絵の まま", e);
      return false;
    });
    // 向きの かわりめ（.left の つけはずし）→ turnMs が あれば 正面の 静止画を すこし 見せる
    let wasLeft = rig.track.classList.contains("left");
    rig.observer = new MutationObserver(() => {
      const isLeft = rig.track.classList.contains("left");
      if (isLeft !== wasLeft) {
        wasLeft = isLeft;
        turn(rig);
      }
    });
    rig.observer.observe(rig.track, { attributes: true, attributeFilter: ["class"] });
    rig.resize = new ResizeObserver(() => fit(rig));
    rig.resize.observe(rig.host);
    rigs.add(rig);
    return rig;
  }
  function turn(rig) {
    if (!rig.active || !rig.parts || reduced() || !(rig.cfg.common.turnMs > 0)) return;
    rig.owner.classList.add("rig-turn");
    clearTimeout(rig.turnTimer);
    rig.turnTimer = setTimeout(() => rig.owner.classList.remove("rig-turn"), rig.cfg.common.turnMs);
  }
  // パーツ表示に する（true）／ 正面の 絵に もどす（false）
  function setActive(rig, on) {
    if (!rig) return;
    rig.active = !!on;
    rig.last = 0;
    rig.prev = null;
    if (!on) clearTimeout(rig.turnTimer);
    show(rig);
    if (on) wake();
  }
  function destroy(rig) {
    if (!rig) return;
    rig.destroyed = true;
    rig.observer.disconnect();
    rig.resize.disconnect();
    clearTimeout(rig.turnTimer);
    if (rig.parts) { if (rig.parts.skin) rig.parts.skin.destroy(); rig.parts.root.remove(); }
    rig.owner.classList.remove("rig-on", "rig-turn");
    rigs.delete(rig);
  }

  // 同じ 種類・段階・着せ替え なら いまの ものを つかう。ちがえば 作りなおす（パーツ表示の 状態は 引きつぐ）
  function sync(current, opts) {
    const key = JSON.stringify([opts.type, opts.stage, opts.equip && opts.equip.head, opts.equip && opts.equip.acc, BCT.equipmentPlacement?.revision || 0]);
    if (current && current.key === key && !current.destroyed && current.host === opts.host) return current;
    const wasActive = !!(current && current.active);
    if (current) destroy(current);
    const rig = create(Object.assign({}, opts, { key }));
    if (rig && wasActive) setActive(rig, true);
    return rig;
  }

  // 同じ 種類の ほかの 段階も 先に 読んでおく（進化したあと 圏外でも 表示できるように。Service Worker が 保存する）
  function prefetch(type) {
    for (const stage of [1, 2, 3]) {
      const cfg = BCT.petRigConfig && BCT.petRigConfig(type, stage);
      if (cfg) Object.keys(cfg.parts).forEach((id) => { new Image().src = BCT.petRigFile(type, stage, id); });
    }
  }

  BCT.petRig = {
    create, sync, setActive, destroy, turn, prefetch, fit, frontLayout,
    math: { motionLevel, ampScale, frequency, swingAngle, bobOffset, headOffset, localLayout, nextX },
    nextX,
    // 向きを かえる 間隔（ミリ秒。設定の turnEveryMs）
    turnEvery: () => (BCT.PET_RIG && BCT.PET_RIG.common.turnEveryMs) || 30000,
    rigs: () => [...rigs],
    // 確認用：速さを 固定する（null で もどす）
    setManualSpeed(rig, v) { rig.manual = v; },
    // 確認用：ある 瞬間の 姿に する（phase … 位相（ラジアン）、level … うごきの 強さ 0〜1）
    poseAt(rig, phase, level) {
      if (!rig || !rig.parts) return;
      rig.phase = phase;
      apply(rig, ampScale(level, rig.cfg.idleAmp));
    },
  };
})();
