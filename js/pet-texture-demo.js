import { createPetTextureScene } from './pet-texture-scene.js';

const $ = id => document.getElementById(id);
const names = { dolphin: 'イルカ', turtle: 'ウミガメ', hermit: 'ヤドカリ' };
const views = { front: '正面の原画', side: '側面のイラスト', back: '背面のイラスト' };
let viewer, requestedType = 'dolphin', requestedStage = 1;

function showError(error) { $('scene-error').hidden = false; $('scene-error').querySelector('p').textContent = error.message; }
function sync(state) {
  $('pet-name').textContent = names[state.type];
  $('stage-name').textContent = ['', 'こどものすがた', 'せいちょう とちゅう', 'りっぱに せいちょう'][state.stage];
  $('view-name').textContent = views[state.view];
  $('load-status').hidden = !state.loading;
  $('lift').disabled = !state.ready;
  $('angle').value = Math.round(state.angle);
  $('angle-value').textContent = `${Math.round(state.angle)}°`;
  $('floating').checked = state.floating; $('rotate').checked = state.autoRotate;
  $('speed').value = state.speed; $('speed-value').textContent = `${state.speed.toFixed(1)}×`;
  document.querySelectorAll('[data-choice]').forEach(group => {
    group.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.value === String(state[group.dataset.choice]))));
  });
  document.querySelectorAll('[data-angle]').forEach(button => button.setAttribute('aria-pressed', String(Math.abs(state.angle - Number(button.dataset.angle)) < 2)));
}

try {
  viewer = createPetTextureScene($('pet-scene'), { onChange: sync, onError: showError, onRestore: () => $('scene-error').hidden = true });
  // Also usable from another screen: the viewer is independent of the demo UI.
  window.petTextureDemo = viewer;
  await viewer.ready;
} catch (error) { showError(error); }

document.querySelectorAll('[data-choice]').forEach(group => group.addEventListener('click', async event => {
  const button = event.target.closest('button[data-value]'); if (!button || !viewer) return;
  if (group.dataset.choice === 'type') requestedType = button.dataset.value;
  else requestedStage = Number(button.dataset.value);
  $('scene-error').hidden = true;
  try { await viewer.setPet(requestedType, requestedStage); } catch { /* Viewer reports the actual loading error. */ }
}));
$('view-choices').addEventListener('click', event => { const button = event.target.closest('[data-angle]'); if (button) viewer?.setAngle(Number(button.dataset.angle)); });
$('angle').addEventListener('input', event => viewer?.setAngle(Number(event.target.value), { immediate: true }));
$('floating').addEventListener('change', event => viewer?.setFloating(event.target.checked));
$('rotate').addEventListener('change', event => viewer?.setAutoRotate(event.target.checked));
$('speed').addEventListener('input', event => viewer?.setSpeed(Number(event.target.value)));
$('lift').addEventListener('click', () => viewer?.lift());
$('reset').addEventListener('click', () => viewer?.reset());
$('retry').addEventListener('click', () => location.reload());
window.addEventListener('pagehide', event => { if (!event.persisted) viewer?.dispose(); });
