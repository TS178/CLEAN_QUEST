import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {launch,sleep} from './cdp.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.json':'application/json','.mp4':'video/mp4'};
const server=http.createServer((req,res)=>{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
  if(!file.startsWith(root)){res.writeHead(403);res.end();return;}
  fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(err?'Not found':data);});
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=process.env.BCT_URL||`http://127.0.0.1:${server.address().port}/`;
let b;
try {b=await launch({port:18980,width:390,height:844});}catch(e){server.close();throw e;}
fs.mkdirSync('tests/e2e/out',{recursive:true});
const ev=b.ev;
async function tap(sel){
  for(let i=0;i<50;i++) {if(!await ev(`document.querySelector(${JSON.stringify(sel)})?.disabled`))break;await sleep(100);}
  const p=await ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await b.send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});
  await b.send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});
}
async function drag(dx,dy,touch=false,cancel=false){
  const r=await ev(`(()=>{const e=document.getElementById('tsCanvas');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width}})()`);
  const x=r.x+180*r.w/360,y=r.y+385*r.w/360;
  if(touch){
    await b.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    await b.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*r.w/360,y:y+dy*r.w/360}]});
    await b.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});
  }else{
    await b.send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});
    await b.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:x+dx*r.w/360,y:y+dy*r.w/360,button:'left',buttons:1});
    await b.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:x+dx*r.w/360,y:y+dy*r.w/360,button:'left',clickCount:1});
  }
}
try{
  await b.goto(base);
  await ev(`BCT.game.choosePet('dolphin','いるか','確認隊',1);BCT.ui.show('mission')`);
  await b.shot('tests/e2e/out/truck-shoot-mission.png');
  await tap('#msTruck');
  assert.equal(await ev(`document.getElementById('tsTime').textContent`),'60');
  for(const [width,height] of [[320,568],[390,844],[768,1024]]){
    await b.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:2,mobile:true});await sleep(150);
    assert.ok(await ev(`document.documentElement.scrollWidth<=innerWidth`),`${width}: no horizontal overflow`);
    assert.ok(await ev(`(()=>{const r=document.getElementById('tsCanvas').getBoundingClientRect();return r.height<innerHeight})()`),'game canvas fits screen height');
    if(width===320){
      assert.ok(await ev(`(()=>{const r=document.getElementById('tsStart').getBoundingClientRect(),o=document.getElementById('tsOverlay').getBoundingClientRect();return r.top>=o.top&&r.bottom<=Math.min(o.bottom,innerHeight)})()`),'start button visible on small screen');
      await b.shot('tests/e2e/out/truck-shoot-small.png');
    }
  }
  await b.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});await sleep(200);
  await b.shot('tests/e2e/out/truck-shoot-ready.png');
  if(process.argv.includes('--layout-only')){
    console.log('PASS: small, phone and tablet layouts.');
  }else{
  await tap('#tsStart');
  await drag(0,-60,true);await sleep(250);
  assert.equal(await ev(`document.getElementById('tsScore').textContent`),'0');
  await drag(0,90,true,true);await sleep(150);
  assert.equal(await ev(`document.getElementById('tsPet').dataset.mood`),'idle','touch cancel leaves no aim');
  // Aim using elapsed time shown by the HUD, with a tolerance smaller than the opening.
  const elapsed=await ev(`BCT.truckPhysics.C.duration-Number(document.getElementById('tsTime').textContent)`);
  const aim=await ev(`(()=>{const P=BCT.truckPhysics,t=${elapsed}+.6;return {dx:-(P.truckX(t+P.crossing)-P.C.launchX)/P.crossing/P.C.velocityScale,dy:P.C.roadDepth/P.crossing/P.C.velocityScale}})()`);
  await ev(`window.truckFlightCounts=[];window.originalTruckFire=BCT.truckPhysics.fire;BCT.truckPhysics.fire=(s,a)=>{const ok=window.originalTruckFire(s,a);if(ok)window.truckFlightCounts.push(s.shots.length);return ok}`);
  await drag(aim.dx,aim.dy,true);
  await drag(0,30,true);
  await drag(0,30);
  assert.deepEqual(await ev(`window.truckFlightCounts`),[1,2,3],'touch and mouse can shoot before the first landing');
  await sleep(200);await b.shot('tests/e2e/out/truck-shoot-rapid.png');
  await sleep(1200);
  assert.ok(Number(await ev(`document.getElementById('tsScore').textContent`))>=100,'real touch hits moving target');
  await b.shot('tests/e2e/out/truck-shoot-playing.png');
  await tap('#tsPause');const remaining=await ev(`document.getElementById('tsTime').textContent`);await sleep(1100);
  assert.equal(await ev(`document.getElementById('tsTime').textContent`),remaining,'pause freezes clock');
  await tap('#tsBack');await tap('#msTruck');
  assert.ok(await ev(`!!document.getElementById('tsResume')`),'navigation preserves paused round');
  await tap('#tsResume');
  await ev(`document.getElementById('tsCanvas').focus()`);
  for(let i=0;i<14;i++)await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowDown',code:'ArrowDown'});
  await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space'});
  await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space'});
  assert.equal(await ev(`window.truckFlightCounts.at(-1)`),2,'keyboard can fire while a shot is airborne');
  await sleep(1300);
  assert.ok(await ev(`document.getElementById('tsLive').textContent.includes('おしい')`),'keyboard weak shot misses');
  await ev(`void BCT.ui.modal('<p>設定テスト</p>',[{label:'とじる',value:true}])`);
  await sleep(100);assert.ok(await ev(`!!document.getElementById('tsResume')`),'modal pauses game');
  await ev(`BCT.ui.closeModal()`);await tap('#tsResume');
  const beach=await ev(`JSON.stringify(BCT.store.get().beach)`);
  await ev(`window.realFinishTruck=BCT.game.finishTruckShoot;BCT.game.finishTruckShoot=()=>{BCT.game.finishTruckShoot=window.realFinishTruck;return {ok:false,err:'save'}}`);
  // Let the actual 60-second round finish (without changing production timing).
  console.log('Waiting for the 60-second round to finish.');
  for(let i=0;i<150;i++){if(await ev(`!!document.getElementById('tsAgain')`))break;await sleep(500);}
  await sleep(100);
  assert.equal(await ev(`document.getElementById('tsAgain').disabled`),true,'failed save prevents losing the result');
  assert.equal(await ev(`BCT.store.get().truckShoot.plays`),0);
  await tap('#tsRetry');await sleep(1600);
  assert.equal(await ev(`document.getElementById('tsAgain').disabled`),false);
  assert.equal(await ev(`BCT.store.get().truckShoot.plays`),1);
  assert.equal(await ev(`BCT.game.coins(BCT.store.get())`),10);
  assert.equal(await ev(`JSON.stringify(BCT.store.get().beach)`),beach,'home is unaffected');
  await b.shot('tests/e2e/out/truck-shoot-result.png');
  await tap('#tsResultBack');await tap('#msTruck');await sleep(200);
  assert.equal(await ev(`BCT.game.coins(BCT.store.get())`),10,'reopened result does not pay twice');
  await tap('#tsAgain');assert.ok(await ev(`!!document.getElementById('tsStart')`));
  const backup=await ev(`(async()=>{const p=await BCT.backup.build();return {valid:BCT.backup.validate(p),plays:p.state.truckShoot.plays}})()`);
  assert.equal(backup.valid,null);assert.equal(backup.plays,1);
  await b.goto(base);assert.equal(await ev(`BCT.store.get().truckShoot.plays`),1);
  assert.equal(await ev(`BCT.game.coins(BCT.store.get())`),10);
  await ev(`navigator.serviceWorker.ready`);
  await b.send('Network.enable');await b.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
  await b.goto(base);await ev(`BCT.ui.show('mission')`);await tap('#msTruck');await tap('#tsStart');
  assert.ok(await ev(`BCT.truckShoot.busy()`),'game works offline');
  await tap('#tsPause');
  assert.ok(!b.consoleLogs.some(s=>s.startsWith('EXCEPTION:')),b.consoleLogs.join('\n'));
  console.log('PASS: touch, keyboard, cancel, inland constraint, layout, pause/navigation/modal, 60s result, save retry, coins, backup, reload, offline.');
  }
}finally{b.close();server.closeAllConnections();server.close();}
