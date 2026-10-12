import * as T from '../vendor/three/three.module.js';
import {createPetModel} from './pet-model-preview.js';

const host=document.getElementById('scene');
const state={type:'dolphin',stage:1,head:'cap',acc:'scarf',look:'none',happy:false};
let renderer;
try{renderer=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});}
catch(e){const error=document.getElementById('error');error.hidden=false;error.textContent='このブラウザーでは立体表示を開けませんでした。WebGL が利用できるブラウザーで確認してください。';throw e;}
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setClearColor(0,0);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;host.append(renderer.domElement);
const scene=new T.Scene(),camera=new T.PerspectiveCamera(34,1,.1,40);
camera.position.set(0,1.25,6.4);camera.lookAt(0,.05,0);
scene.add(new T.HemisphereLight('#fff8e8','#aec4bd',1.45));
const key=new T.DirectionalLight('#fff8ed',2.3);key.position.set(-3,5,6);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-2;key.shadow.camera.right=2;key.shadow.camera.top=2;key.shadow.camera.bottom=-2;key.shadow.normalBias=.045;key.shadow.bias=-.00005;scene.add(key);
const fill=new T.DirectionalLight('#bde9ff',.95);fill.position.set(4,2,-3);scene.add(fill);
const rim=new T.DirectionalLight('#ffffff',.85);rim.position.set(-3,1,-4);scene.add(rim);
const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=128;
const shadowContext=shadowCanvas.getContext('2d'),gradient=shadowContext.createRadialGradient(64,64,2,64,64,64);
gradient.addColorStop(0,'rgba(35,80,75,.18)');gradient.addColorStop(.5,'rgba(35,80,75,.09)');gradient.addColorStop(1,'rgba(35,80,75,0)');shadowContext.fillStyle=gradient;shadowContext.fillRect(0,0,128,128);
const floor=new T.Mesh(new T.PlaneGeometry(2.6,2),new T.MeshBasicMaterial({map:new T.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false}));floor.rotation.x=-Math.PI/2;floor.position.y=-1.22;scene.add(floor);
let pet,angle=-.40,targetAngle=-.40,turning=false,last=performance.now(),phase=0,drag=null,tilt=0;
const names={dolphin:'イルカ',turtle:'ウミガメ',hermit:'ヤドカリ'};
function rebuild(){
  if(pet){scene.remove(pet);pet.userData.dispose();}
  pet=createPetModel(state);pet.rotation.y=angle;scene.add(pet);
  document.getElementById('petName').textContent=names[state.type];
  document.getElementById('stageName').textContent=['','こどものすがた','せいちょう とちゅう','りっぱに せいちょう'][state.stage];
  document.getElementById('smile').setAttribute('aria-pressed',String(state.happy));
  document.querySelectorAll('[data-option]').forEach(group=>group.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.value===String(state[group.dataset.option])))));
  window.petPreview.ready=true;
}
window.petPreview={state,ready:false,set(next){Object.assign(state,next);rebuild();},get model(){return pet;},get yaw(){return angle;},get moving(){return turning;},setAngle(value){targetAngle=angle=value;pet.rotation.y=value;renderer.render(scene,camera);},render(){renderer.render(scene,camera);}};
document.querySelectorAll('[data-option]').forEach(group=>group.addEventListener('click',e=>{
  const b=e.target.closest('button[data-value]');if(!b)return;
  state[group.dataset.option]=group.dataset.option==='stage'?Number(b.dataset.value):b.dataset.value;rebuild();
}));
const turnButton=document.getElementById('turn');
function stopMoving(){turning=false;turnButton.setAttribute('aria-pressed','false');}
document.getElementById('front').onclick=()=>{stopMoving();targetAngle=0;tilt=0;};
document.getElementById('back').onclick=()=>{stopMoving();targetAngle=Math.PI;tilt=0;};
turnButton.onclick=()=>{turning=!turning;phase=0;turnButton.setAttribute('aria-pressed',String(turning));};
document.getElementById('smile').onclick=e=>{state.happy=!state.happy;e.currentTarget.setAttribute('aria-pressed',String(state.happy));rebuild();};
host.addEventListener('pointerdown',e=>{stopMoving();host.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY,angle:targetAngle,tilt};});
host.addEventListener('pointermove',e=>{if(!drag)return;targetAngle=drag.angle+(e.clientX-drag.x)*.012;tilt=T.MathUtils.clamp(drag.tilt+(e.clientY-drag.y)*.006,-.45,.4);});
host.addEventListener('pointerup',()=>drag=null);host.addEventListener('pointercancel',()=>drag=null);
new ResizeObserver(()=>{const r=host.getBoundingClientRect();renderer.setSize(r.width,r.height);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();}).observe(host);
rebuild();
function tick(now){
  const dt=Math.min(.05,(now-last)/1000);last=now;
  if(turning){phase+=dt*.60;targetAngle=Math.cos(phase)>=0?1.05:-1.05;pet.position.x=Math.sin(phase)*.65;}
  else pet.position.x*=Math.exp(-dt*6);
  floor.position.x=pet.position.x;
  // Actual 3D yaw changes continuously. Scale never crosses zero or mirrors.
  angle+=(targetAngle-angle)*(1-Math.exp(-dt*5));pet.rotation.set(tilt,angle,0);
  const motion=matchMedia('(prefers-reduced-motion: reduce)').matches?0:Math.sin(now*.0017)*.035;
  pet.position.y=motion+(state.type==='turtle'?-.20:0);
  renderer.render(scene,camera);requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
