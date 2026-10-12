import * as THREE from '../vendor/three/three.module.js';

const TYPES = ['dolphin', 'turtle', 'hermit'];
const VIEWS = ['front', 'side', 'back'];
const clamp = THREE.MathUtils.clamp;
const assetURL = path => new URL(`../assets/${path}`, import.meta.url).href;

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('イラストを読み込めませんでした。ローカルサーバーから開いてください。'));
    image.src = url;
  });
}

/**
 * Generated sheets have uneven gutters; some neighboring bounding boxes overlap.
 * Split by connected alpha regions, not fixed 2 × 3 rectangles. Copy the original
 * RGBA pixels without recoloring or redrawing; the source PNG is never modified.
 */
function splitTurnaround(image) {
  const canvas = document.createElement('canvas');
  const width = canvas.width = image.width, height = canvas.height = image.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, width, height).data;
  const labels = new Int32Array(width * height), queue = new Int32Array(width * height);
  const regions = [];
  let id = 0;
  for (let seed = 0; seed < labels.length; seed++) {
    if (labels[seed] || pixels[seed * 4 + 3] < 8) continue;
    id++;
    let read = 0, write = 1, left = width, right = 0, top = height, bottom = 0;
    queue[0] = seed; labels[seed] = id;
    while (read < write) {
      const p = queue[read++], x = p % width, y = (p / width) | 0;
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
      for (const n of [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, y > 0 ? p - width : -1, y < height - 1 ? p + width : -1]) {
        if (n >= 0 && !labels[n] && pixels[n * 4 + 3] >= 8) {
          labels[n] = id; queue[write++] = n;
        }
      }
    }
    regions.push({ id, count: write, left, right, top, bottom });
  }
  const figures = regions.filter(r => r.count > 2000).sort((a, b) => b.count - a.count).slice(0, 6);
  if (figures.length !== 6) throw new Error('画像シートの6つのキャラクターを分離できませんでした。');
  figures.sort((a, b) => a.top - b.top);
  // Each row contains side (left) and rear (right), despite small Y offsets.
  for (let row = 0; row < 3; row++) {
    const pair = figures.slice(row * 2, row * 2 + 2).sort((a, b) => a.left - b.left);
    figures.splice(row * 2, 2, ...pair);
  }
  return figures.map(region => {
    const left = Math.max(0, region.left - 3), top = Math.max(0, region.top - 3);
    const right = Math.min(width - 1, region.right + 3), bottom = Math.min(height - 1, region.bottom + 3);
    const out = document.createElement('canvas'); out.width = right - left + 1; out.height = bottom - top + 1;
    const outContext = out.getContext('2d'), data = outContext.createImageData(out.width, out.height);
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
      const p = y * width + x, a = pixels[p * 4 + 3];
      if (!a) continue;
      let keep = labels[p] === region.id;
      // Preserve faint antialiased edges immediately adjacent to this figure.
      if (!keep && a < 8) {
        for (let dy = -2; dy <= 2 && !keep; dy++) for (let dx = -2; dx <= 2 && !keep; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) keep = labels[ny * width + nx] === region.id;
        }
      }
      if (keep) {
        const dest = ((y - top) * out.width + x - left) * 4;
        data.data.set(pixels.subarray(p * 4, p * 4 + 4), dest);
      }
    }
    outContext.putImageData(data, 0, 0);
    return out;
  });
}

function makeViewTextures(images, anisotropy) {
  const contentHeight = 640, padding = 32;
  const width = Math.ceil(Math.max(...images.map(i => i.width / i.height)) * contentHeight) + padding * 2;
  const height = contentHeight + padding * 2;
  const textures = images.map(image => {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d');
    context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
    const drawWidth = image.width / image.height * contentHeight;
    context.drawImage(image, (width - drawWidth) / 2, padding, drawWidth, contentHeight);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = anisotropy;
    return texture;
  });
  return { textures, aspect: width / height };
}

function shadowTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d'), gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(37,79,65,.35)');
  gradient.addColorStop(.45, 'rgba(37,79,65,.16)');
  gradient.addColorStop(1, 'rgba(37,79,65,0)');
  context.fillStyle = gradient; context.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

/**
 * Mount a self-contained Three.js 2.5D illustration viewer.
 * No game globals, localStorage, network services or generated 3D character mesh.
 * Available source directions: 0° original front, 90° side, 180° rear.
 * Opposite-side art is NOT fabricated by mirroring an asymmetric character.
 */
export function createPetTextureScene(container, options = {}) {
  if (!(container instanceof HTMLElement)) throw new TypeError('A container element is required.');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const state = {
    type: options.type || 'dolphin', stage: options.stage || 1,
    angle: 0, targetAngle: 0, floating: !reducedMotion.matches, autoRotate: false,
    speed: 1, loading: true, ready: false, view: 'front', disposed: false
  };
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true }); }
  catch { throw new Error('このブラウザーではWebGLを利用できません。対応ブラウザーで開いてください。'); }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // The art is already shaded: tone mapping or scene lights would recolor it.
  renderer.toneMapping = THREE.NoToneMapping;
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-label', 'キャラクターのプレビュー。左右の矢印キーでも向きを変えられます。');
  canvas.tabIndex = 0;
  container.append(canvas);

  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(34, 1, .1, 60);
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, toneMapped: false,
    uniforms: { fromMap: { value: null }, toMap: { value: null }, blend: { value: 1 } },
    vertexShader: `varying vec2 imageUV;
      void main(){imageUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `uniform sampler2D fromMap;uniform sampler2D toMap;uniform float blend;
      varying vec2 imageUV;
      void main(){
        vec4 a=texture2D(fromMap,imageUV),b=texture2D(toMap,imageUV);
        float alpha=mix(a.a,b.a,blend);
        if(alpha<.001)discard;
        vec3 rgb=mix(a.rgb*a.a,b.rgb*b.a,blend)/max(alpha,.001);
        gl_FragColor=vec4(rgb,alpha);
        #include <colorspace_fragment>
      }`
  });
  // A slightly curved display surface adds subtle parallax; it never becomes
  // edge-on. The painted character itself is not reshaped into primitive meshes.
  const geometry = new THREE.PlaneGeometry(1, 1, 24, 24);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i) * 2, y = positions.getY(i) * 2;
    positions.setZ(i, .025 * (1 - x * x) * (1 - y * y));
  }
  const pet = new THREE.Mesh(geometry, material); pet.visible = false; pet.renderOrder = 3;
  scene.add(pet);
  const shadowMap = shadowTexture();
  const shadowMaterial = new THREE.MeshBasicMaterial({ map: shadowMap, transparent: true, opacity: .8, depthWrite: false, toneMapped: false });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 2.4), shadowMaterial);
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -1.57; scene.add(shadow);
  const rings = new THREE.Group(); rings.position.y = -1.59; scene.add(rings);
  for (const radius of [1.45, 1.85, 2.25]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius, radius + .008, 96),
      new THREE.MeshBasicMaterial({ color: '#96c5b3', opacity: .22, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; rings.add(ring);
  }

  const atlasCache = new Map(), viewCache = new Map();
  const disposables = new Set();
  let loadToken = 0, frame = 0, elapsed = 0, last = performance.now();
  let currentViews, viewIndex = 0, fromIndex = 0, transitionAge = 1;
  let planeHeight = 3, planeWidth = 3, orbitPhase = 0, drag;
  let hop = 0, velocity = 0, hoverX = 0, hoverY = 0, tiltX = 0, tiltY = 0;
  let contextLost = false, lastReported = '';

  function report(force = false) {
    const key = [state.type, state.stage, Math.round(state.angle), state.floating, state.autoRotate, state.speed, state.loading, state.ready, state.view].join(':');
    if (force || key !== lastReported) { lastReported = key; options.onChange?.(getState()); }
  }
  function getState() {
    return { ...state, height: pet.position.y, blend: material.uniforms.blend.value, planeWidth, planeHeight,
      textureCount: disposables.size, scale: pet.scale.toArray(), viewport: { width: container.clientWidth, height: container.clientHeight } };
  }
  function resize() {
    if (state.disposed) return;
    const width = container.clientWidth, height = container.clientHeight;
    if (width <= 0 || height <= 0) return;
    renderer.setSize(width, height, false); camera.aspect = width / height;
    const viewHeight = Math.max(5.2, (planeWidth + .75) / camera.aspect);
    camera.position.set(0, 2.35, viewHeight / (2 * Math.tan(THREE.MathUtils.degToRad(17))));
    camera.lookAt(0, .08, 0); camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize); observer.observe(container);

  async function getViews(type, stage) {
    const key = `${type}-${stage}`;
    if (!viewCache.has(key)) {
      if (!atlasCache.has(type)) {
        const task = loadImage(assetURL(`art-source/turnarounds/${type}-side-back-v1.png`)).then(splitTurnaround);
        atlasCache.set(type, task);
        task.catch(() => atlasCache.delete(type));
      }
      const task = Promise.all([
        loadImage(assetURL(`pets/${type}-${stage}-normal.webp`)), atlasCache.get(type)
      ]).then(([front, sides]) => {
        if (state.disposed) return null;
        const views = makeViewTextures([front, sides[(stage - 1) * 2], sides[(stage - 1) * 2 + 1]], Math.min(4, renderer.capabilities.getMaxAnisotropy()));
        views.textures.forEach(t => disposables.add(t));
        return views;
      });
      viewCache.set(key, task);
      task.catch(() => viewCache.delete(key));
    }
    return viewCache.get(key);
  }
  function showView(index, immediate = false) {
    if (!currentViews) return;
    if (index !== viewIndex || immediate) {
      fromIndex = viewIndex; viewIndex = index; transitionAge = immediate ? 1 : 0;
      material.uniforms.fromMap.value = currentViews.textures[fromIndex];
      material.uniforms.toMap.value = currentViews.textures[index];
      material.uniforms.blend.value = immediate ? 1 : 0;
      state.view = VIEWS[index];
    }
  }
  async function setPet(type, stage = state.stage) {
    if (state.disposed) return;
    if (!TYPES.includes(type) || ![1, 2, 3].includes(Number(stage))) throw new TypeError('Unknown species or growth stage.');
    const token = ++loadToken;
    state.loading = true; state.ready = false; report(true);
    try {
      const views = await getViews(type, Number(stage));
      if (state.disposed || token !== loadToken) return;
      currentViews = views; state.type = type; state.stage = Number(stage);
      planeHeight = 3.2 * [0, .82, .92, 1][state.stage]; planeWidth = planeHeight * views.aspect;
      pet.scale.set(planeWidth, planeHeight, 1);
      viewIndex = Math.round(state.angle / 90); showView(viewIndex, true);
      pet.visible = true; state.ready = true; resize();
    } catch (error) {
      if (!state.disposed && token === loadToken) options.onError?.(error);
      throw error;
    } finally {
      if (!state.disposed && token === loadToken) { state.loading = false; report(true); }
    }
  }
  function setAngle(degrees, { immediate = false } = {}) {
    if (!Number.isFinite(Number(degrees))) return;
    state.autoRotate = false; state.targetAngle = clamp(Number(degrees), 0, 180);
    if (immediate || reducedMotion.matches) { state.angle = state.targetAngle; showView(Math.round(state.angle / 90), true); }
    report(true);
  }
  function setFloating(value) { state.floating = Boolean(value); report(true); }
  function setAutoRotate(value) {
    state.autoRotate = Boolean(value);
    orbitPhase = Math.acos(clamp(1 - state.angle / 90, -1, 1)); report(true);
  }
  function setSpeed(value) { if (Number.isFinite(Number(value))) state.speed = clamp(Number(value), .3, 1.8); report(true); }
  function lift() { if (state.ready) velocity = 3.7; }
  function reset() { setAngle(0, { immediate: true }); setFloating(!reducedMotion.matches); setSpeed(1); hop = velocity = hoverX = hoverY = 0; }

  function pointerDown(event) {
    if (event.button !== 0 || !event.isPrimary) return;
    state.autoRotate = false; canvas.setPointerCapture(event.pointerId);
    drag = { x: event.clientX, startAngle: state.angle, distance: 0 }; report(true);
  }
  function pointerMove(event) {
    const rect = canvas.getBoundingClientRect();
    if (!reducedMotion.matches) {
      hoverX = clamp((event.clientX - rect.left) / rect.width * 2 - 1, -1, 1);
      hoverY = clamp((event.clientY - rect.top) / rect.height * 2 - 1, -1, 1);
    }
    if (drag) {
      drag.distance = Math.max(drag.distance, Math.abs(event.clientX - drag.x));
      state.targetAngle = clamp(drag.startAngle + (event.clientX - drag.x) * 180 / Math.max(240, rect.width * .65), 0, 180);
      if (reducedMotion.matches) state.angle = state.targetAngle;
    }
  }
  function pointerUp(event) {
    if (drag && drag.distance < 6) lift(); drag = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  }
  function pointerCancel() { drag = null; hoverX = hoverY = 0; }
  function pointerLeave() { if (!drag) hoverX = hoverY = 0; }
  function keyDown(event) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End', ' '].includes(event.key)) return;
    event.preventDefault();
    if (event.key === ' ') lift();
    else setAngle(event.key === 'Home' ? 0 : event.key === 'End' ? 180 : state.targetAngle + (event.key === 'ArrowRight' ? 10 : -10));
  }
  function lost(event) { event.preventDefault(); contextLost = true; options.onError?.(new Error('描画が一時停止しました。「もう一度開く」で再表示できます。')); }
  function restored() { contextLost = false; options.onRestore?.(); }
  function motionPreference() { if (reducedMotion.matches) { setFloating(false); setAutoRotate(false); hoverX = hoverY = 0; } }
  const events = { pointerdown: pointerDown, pointermove: pointerMove, pointerup: pointerUp, pointercancel: pointerCancel, lostpointercapture: pointerCancel, pointerleave: pointerLeave, keydown: keyDown, webglcontextlost: lost, webglcontextrestored: restored };
  Object.entries(events).forEach(([name, handler]) => canvas.addEventListener(name, handler));
  reducedMotion.addEventListener('change', motionPreference);

  function tick(now) {
    if (state.disposed) return;
    frame = requestAnimationFrame(tick);
    const dt = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now;
    if (document.hidden || contextLost) return;
    elapsed += dt;
    if (state.autoRotate) { orbitPhase += dt * .48 * state.speed; state.targetAngle = (1 - Math.cos(orbitPhase)) * 90; }
    state.angle += (state.targetAngle - state.angle) * (1 - Math.exp(-dt * 12));
    showView(Math.round(state.angle / 90));
    transitionAge += dt;
    material.uniforms.blend.value = reducedMotion.matches ? 1 : THREE.MathUtils.smoothstep(transitionAge, 0, .14);
    velocity += (-28 * hop - 7 * velocity) * dt; hop = Math.max(0, hop + velocity * dt);
    if (hop === 0 && velocity < 0) velocity = 0;
    const bob = state.floating ? Math.sin(elapsed * 1.4) * .11 : 0;
    pet.position.set(state.floating ? Math.sin(elapsed * .7) * .045 : 0, .18 + bob + hop, 0);
    tiltX += (hoverY * .045 - tiltX) * (1 - Math.exp(-dt * 5));
    tiltY += (hoverX * .065 - tiltY) * (1 - Math.exp(-dt * 5));
    pet.quaternion.copy(camera.quaternion);
    pet.rotateX(tiltX); pet.rotateY(tiltY + Math.sin(THREE.MathUtils.degToRad(state.angle * 2)) * .035);
    if (state.floating) pet.rotateZ(Math.sin(elapsed * .8) * .018);
    const elevation = bob + hop;
    shadow.position.x = pet.position.x;
    shadow.scale.setScalar(1 + elevation * .23);
    shadowMaterial.opacity = clamp(.7 - elevation * .48, .18, .85);
    renderer.render(scene, camera); report();
  }
  function dispose() {
    if (state.disposed) return;
    state.disposed = true; loadToken++;
    cancelAnimationFrame(frame); observer.disconnect();
    Object.entries(events).forEach(([name, handler]) => canvas.removeEventListener(name, handler));
    reducedMotion.removeEventListener('change', motionPreference);
    disposables.forEach(t => t.dispose()); disposables.clear();
    atlasCache.clear(); viewCache.clear();
    geometry.dispose(); material.dispose(); shadow.geometry.dispose(); shadowMaterial.dispose(); shadowMap.dispose();
    rings.children.forEach(r => { r.geometry.dispose(); r.material.dispose(); });
    renderer.dispose(); canvas.remove();
  }
  resize(); frame = requestAnimationFrame(tick);
  const ready = setPet(state.type, state.stage);
  return { ready, setPet, setAngle, setFloating, setAutoRotate, setSpeed, lift, reset, dispose, getState, canvas };
}
