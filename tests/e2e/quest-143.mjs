import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {execFileSync} from 'node:child_process';
import {launch,sleep} from './cdp.mjs';

// Exact public-file allowlist; never expose private repository/configuration files.
const root=process.cwd();
const sw=fs.readFileSync('service-worker.js','utf8');
const precache=[...sw.match(/const FILES = \[([\s\S]*?)\];/)[1].matchAll(/"([^"]+)"/g)].map(m=>m[1]);
const tracked=execFileSync('git',['ls-files','--','assets','css','js','icons','vendor'],{encoding:'utf8'}).trim().split(/\r?\n/);
const allowed=new Set([...precache,...tracked,'service-worker.js','index.html'].filter(f=>/\.(html|json|css|js|png|webp|jpe?g|svg|ico|mp4|woff2?|ttf|txt)$/.test(f)));
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
  const file=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1)||'index.html';
  if(!allowed.has(file)||file.split('/').some(s=>s.startsWith('.'))||file.includes('\\')){res.writeHead(404).end();return;}
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
  fs.createReadStream(path.join(root,file)).pipe(res);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}/`;
fs.mkdirSync('tests/e2e/out',{recursive:true});
let b;
const waitFor=async expr=>{
  for(let i=0;i<100;i++){if(await b.ev(expr))return;await sleep(100);}
  throw Error('Timeout: '+expr);
};
const fits=async label=>{
  const size=await b.ev(`({w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight})`);
  assert.ok(size.sw<=size.w+1 && size.sh<=size.h+1,`${label}: ${JSON.stringify(size)}`);
};
try {
  assert.equal((await fetch(base+'.git/config')).status,404);
  b=await launch({port:12493,width:390,height:844,args:['--disable-gpu']});
  await b.goto(base,100);
  await b.ev(`document.querySelector('.sq-opening__skip').click()`);
  await waitFor(`!document.querySelector('.sq-opening__start').disabled`);
  await b.ev(`document.querySelector('.sq-opening__start').click()`);
  await waitFor(`BCT.ui.current()==='egg'`);
  assert.equal(await b.ev(`document.querySelector('#scr-egg h2').textContent`),'いっしょにぼうけんするようせいをえらぼう！');
  assert.equal(await b.ev(`document.querySelectorAll('#eggs .fairy-choice').length`),3);
  await b.ev(`Promise.all([...document.querySelectorAll('#eggs img')].map(im=>im.decode()))`);
  for(const [width,height] of [[390,844],[320,568],[375,667],[430,932]]){
    await b.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:2,mobile:true});await sleep(100);
    await fits('selection '+width);
    const rects=await b.ev(`[...document.querySelectorAll('.fairy-choice')].map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right}})`);
    assert.equal(rects[0].y,rects[2].y); assert.ok(rects[0].right<rects[1].x && rects[1].right<rects[2].x);
    await b.shot(`tests/e2e/out/quest-selection-${width}.png`);
  }
  await b.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
  await b.ev(`document.querySelector('[data-type=turtle]').click();document.querySelector('[data-type=hermit]').click()`);
  assert.equal(await b.ev(`document.querySelectorAll('.fairy-choice.picked').length`),1);
  await waitFor(`document.querySelector('#modal').classList.contains('show')`);
  assert.match(await b.ev(`document.querySelector('#modalBox').textContent`),/このようせいにしますか？.*ウミガメ/s);
  await b.shot('tests/e2e/out/quest-selection-confirm.png');
  await b.ev(`document.querySelector('#modalBox .btn').click()`);await sleep(50);
  assert.equal(await b.ev(`BCT.store.get().pet`),null);
  assert.equal(await b.ev(`BCT.ui.current()`),'egg');
  await b.ev(`document.querySelector('[data-type=hermit]').click()`);
  await waitFor(`document.querySelector('#modal').classList.contains('show')`);
  await b.ev(`document.querySelectorAll('#modalBox .btn')[1].click()`);await sleep(50);
  assert.equal(await b.ev(`BCT.ui.current()`),'name');
  assert.ok(await b.ev(`document.querySelector('#namePet img').src.endsWith('/hermit.webp')`));
  await b.ev(`document.querySelector('#inPetName').value='かいちゃん';document.querySelector('#nameForm').requestSubmit()`);
  assert.equal(await b.ev(`BCT.ui.current()`),'hatch');
  assert.match(await b.ev(`document.querySelector('#hatchMsg').textContent`),/なかまに なったよ/);
  assert.equal(await b.ev(`BCT.store.get().pet.type`),'hermit');
  await b.ev(`document.querySelector('#hatchGo').click();BCT.prefs.set('reduceMotion',true);BCT.ui.show('plabusters')`);
  for(const [width,height] of [[390,844],[320,568],[375,667],[430,932]]){
    await b.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:2,mobile:true});await sleep(100);
    await fits('busters ready '+width);
    const overflow=await b.ev(`(()=>{const e=document.querySelector('.pb-panel');return e.scrollHeight-e.clientHeight})()`);
    await b.shot(`tests/e2e/out/quest-busters-ready-${width}.png`);
    assert.ok(overflow<=1,`ready panel scroll ${width}: ${overflow}`);
  }
  await b.ev(`document.querySelector('#pbStart').click()`);await waitFor(`BCT.plaBusters.debug().phase==='playing'`);
  for(const [width,height] of [[390,844],[320,568],[375,667],[430,932]]){
    await b.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:2,mobile:true});await sleep(80);
    await fits('busters playing '+width);
    assert.ok(await b.ev(`document.querySelector('#pbPad').getBoundingClientRect().bottom<=innerHeight`));
    await b.shot(`tests/e2e/out/quest-busters-${width}.png`);
  }
  await b.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
  // Flush the headless compositor after the last device-size change before visual captures.
  await sleep(300);await b.send('Page.captureScreenshot',{format:'png'});
  for(const kind of ['b_bag','b_bottle']){
    await b.ev(`{const r=BCT.plaBusters.debug();r.monster=null;r.spawnIn=0;r.cutin=0;r.sinceBoss=r.bossEvery;document.querySelector('#pbArena').innerHTML='';}`);
    await waitFor(`BCT.plaBusters.debug().monster?.type==='boss'`);
    await b.ev(`document.querySelector('.pb-villain').decode()`);
    await sleep(250);await b.shot(`tests/e2e/out/quest-boss-${kind}.png`);
    assert.equal(await b.ev(`document.querySelectorAll('.pb-crown').length`),0);
    assert.ok(await b.ev(`document.querySelector('.pb-villain').complete && document.querySelector('.pb-villain').naturalWidth>0`));
    assert.equal(await b.ev(`BCT.plaBusters.debug().monster.kind`),kind);
    await b.ev(`document.querySelector('#pbStage').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))`);
    assert.equal(await b.ev(`BCT.plaBusters.debug().monster.hp`),9);
    await b.ev(`for(let i=0;i<9;i++)document.querySelector('#pbStage').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))`);
    assert.equal(await b.ev(`BCT.plaBusters.debug().monster`),null);
  }
  await b.ev(`const r=BCT.plaBusters.debug();r.score=18000;r.stats.mistakes=1;r.time=59.99;r.monster=null;r.cutin=0;`);
  await waitFor(`BCT.plaBusters.debug().phase==='result'`);
  await waitFor(`document.querySelector('#pbAgain')?.disabled===false`);
  assert.equal(await b.ev(`BCT.store.get().plaBusters.bestStars`),3);
  assert.equal(await b.ev(`BCT.store.get().plaBusters.lastResult.perfect`),false);
  for(const [width,height] of [[390,844],[320,568],[375,667]]){
    await b.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:2,mobile:true});await sleep(100);
    await fits('busters result '+width);
    assert.ok(await b.ev(`document.querySelector('#pbResultBack').getBoundingClientRect().bottom<=innerHeight`));
    await b.shot(`tests/e2e/out/quest-busters-result-${width}.png`);
  }
  const before=await b.ev(`BCT.game.coins(BCT.store.get())`);
  await b.ev(`BCT.checkBadges()`);
  assert.ok(await b.ev(`BCT.store.get().badges.some(b=>b.id==='beach_hero')`));
  assert.equal(await b.ev(`BCT.game.coins(BCT.store.get())`),before);
  await b.ev(`BCT.ui.show('home');void BCT.ui.modal('<h3>★3 とくべつ しょうごう</h3><div style="display:flex"><div style="width:50%">'+BCT.collectionArt.badge('shoot_master')+'</div><div style="width:50%">'+BCT.collectionArt.badge('beach_hero')+'</div></div>',[{label:'とじる',value:true}]);`);
  await sleep(300);await b.shot('tests/e2e/out/quest-three-star-badges.png');
  const manifest=await (await fetch(base+'manifest.json')).json();
  assert.equal(manifest.name,'しかクエ');assert.equal(manifest.short_name,'しかクエ');
  await b.ev(`navigator.serviceWorker.ready`);
  const cached=await b.ev(`(async()=>{const c=await caches.open('bct-1.43');return Promise.all(['css/fairy-select.css','assets/collection/badge_shoot_master.webp','assets/collection/badge_beach_hero.webp','assets/plabusters/boss-devil.svg','assets/plabusters/boss-bandit.svg'].map(async p=>!!(await c.match(new URL(p,location.href).href))))})()`);
  assert.ok(cached.every(Boolean));
  // Reload offline: installed metadata, saved awards and all new artwork remain available.
  await b.send('Network.enable');
  await b.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
  await b.goto(base,100);
  await b.ev(`document.querySelector('.sq-opening__start').click()`);
  await waitFor(`BCT.ui.current()==='home'`);
  assert.ok(await b.ev(`BCT.store.get().badges.some(b=>b.id==='beach_hero')`));
  assert.equal(await b.ev(`BCT.store.get().plaBusters.bestStars`),3);
  assert.ok(await b.ev(`(async()=>{for(const p of ['assets/collection/badge_shoot_master.webp','assets/collection/badge_beach_hero.webp','assets/plabusters/boss-devil.svg','assets/plabusters/boss-bandit.svg']){const im=new Image();im.src=p;await im.decode();if(!im.naturalWidth)return false;}return true;})()`));
  assert.deepEqual(b.consoleLogs.filter(x=>x.startsWith('EXCEPTION')),[]);
  console.log('PASS: 3 companions, jump/debounce, cancel/reselect, named adoption without eggs, 4 phone sizes, no Busters scroll (ready/play/result), both villain assets, 3-star imperfect result, persistent title, PWA name and precache.');
} finally {b?.close();await new Promise(r=>server.close(r));}
