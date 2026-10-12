import assert from 'node:assert/strict';
import fs from 'node:fs';
import {launch,sleep} from './cdp.mjs';
const base=process.env.BCT_URL||'http://127.0.0.1:8766/';
const out='tests/e2e/out';fs.mkdirSync(out,{recursive:true});
const b=await launch({port:12169,width:390,height:844,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
async function waitFor(expr){for(let i=0;i<60;i++){if(await b.ev(expr))return;await sleep(150);}console.log(await b.ev(`({state:BCT.photo.state,screen:BCT.ui.current(),requested:window.requestedFacing,message:document.getElementById('phMsg').innerText,ready:document.getElementById('phVideo').readyState,stream:!!document.getElementById('phVideo').srcObject})`),b.consoleLogs);throw new Error('Timed out: '+expr);}
try{
  await b.goto(base);
  await b.ev(`BCT.game.choosePet('dolphin','テスト','たんけんたい',1);BCT.ui.show('me');true`);
  const baseline=JSON.parse(fs.readFileSync(new URL('./fixtures/camera-icons-before.json',import.meta.url),'utf8'));
  for(const width of [390,320]){
    await b.send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});
    await b.ev(`BCT.ui.show('me');true`);
    const sizes=await b.ev(`[...document.querySelectorAll('#scr-me .me-actions .btn')].map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {width:r.width,height:r.height,padding:s.padding,fontSize:s.fontSize}})`);
    assert.deepEqual(sizes,baseline[width],'Claude-adjusted button dimensions preserved');
    assert.equal(await b.ev(`document.querySelectorAll('#scr-home .actions').length`),0);
    assert.equal(await b.ev(`document.querySelectorAll('#scr-me .me-actions .camera-art img').length`),3);
    assert.ok(await b.ev(`[...document.querySelectorAll('#scr-me .me-actions .btn')].every(e=>getComputedStyle(e).color==='rgb(49, 93, 87)')`));
    await b.ev(`Promise.all([...document.querySelectorAll('#scr-me .me-actions img')].map(i=>i.decode()))`);
    await b.shot(`${out}/camera-icons-me-${width}.png`);
    await b.ev(`document.querySelector('#scr-me [data-go="dress"]').click();true`);assert.equal(await b.ev('BCT.ui.current()'),'dress');
    await b.ev(`BCT.ui.show('me');document.getElementById('actPlay').click();true`);assert.equal(await b.ev('BCT.ui.current()'),'ar');
    await b.ev(`BCT.ui.show('me');document.querySelector('#scr-me [data-go="photo"]').click();true`);assert.equal(await b.ev('BCT.ui.current()'),'photo');
    assert.ok(await b.ev(`document.documentElement.scrollWidth<=innerWidth`));
    await b.shot(`${out}/camera-icons-photo-${width}.png`);
  }
  // No hardware camera is accessed: Edge supplies a synthetic test stream.
  await b.ev(`document.getElementById('phCam').click();true`);
  await waitFor(`BCT.photo.state.source==='camera'`);
  const nextFacing=await b.ev(`BCT.photo.state.facing==='user'?'environment':'user'`);
  await b.ev(`(()=>{const get=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async options=>{window.requestedFacing=options.video.facingMode.ideal;return get(options);};})()`);
  await b.ev(`document.getElementById('phSwitch').click();true`);
  // Some Edge fake-device builds expose only the rear camera; verify the existing fallback too.
  await waitFor(`window.requestedFacing==='${nextFacing}'&&((document.getElementById('phVideo').srcObject&&document.getElementById('phVideo').readyState>=2)||(!document.getElementById('phSource').hidden&&document.getElementById('phMsg').innerText.includes('カメラが みつかりませんでした')))`);
  await b.ev(`document.getElementById('phChange').click();document.getElementById('phSea').click();true`);
  await waitFor(`BCT.photo.state.source==='sea'`);
  await b.ev(`document.getElementById('phShutter').click();true`);
  await waitFor(`!document.getElementById('phResult').hidden`);
  assert.ok(await b.ev(`document.getElementById('phResultImg').src.startsWith('blob:')`));
  assert.equal(await b.ev(`document.querySelectorAll('#phResult .camera-icon-badge').length`),2);
  await b.shot(out+'/camera-icons-result.png');
  // Check save wiring without opening a share sheet or writing a download.
  await b.ev(`Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{window.savedPhoto={size:data.files[0].size,type:data.files[0].type};}});document.getElementById('phSave').click();true`);
  await waitFor(`window.savedPhoto?.size>0`);
  assert.equal(await b.ev(`window.savedPhoto.type`),'image/jpeg');
  await b.ev(`document.getElementById('phRetake').click();true`);
  assert.equal(await b.ev(`document.getElementById('phControls').hidden`),false);
  // Load a bundled image through the same file-input event used by the photo picker.
  await b.ev(`(async()=>{document.getElementById('phChange').click();const blob=await(await fetch('assets/ui/beach.webp')).blob();const dt=new DataTransfer();dt.items.add(new File([blob],'test.webp',{type:'image/webp'}));const input=document.getElementById('phFile');input.files=dt.files;input.dispatchEvent(new Event('change'));})()`);
  await waitFor(`BCT.photo.state.source==='image'`);
  await b.ev(`BCT.ui.show('capture');true`);
  assert.ok(await b.ev(`!!document.querySelector('#locBox [data-ui-icon="location"]')`));
  assert.equal(await b.ev(`document.querySelectorAll('#scr-capture .seg .camera-art').length`),2);
  await b.shot(out+'/camera-icons-capture.png');
  await b.ev(`document.querySelector('[data-sub="map"]').click();true`);
  assert.equal(await b.ev(`document.getElementById('subMap').hidden`),false);
  // All approved artwork is available after an offline reload.
  for(let i=0;i<80&&!await b.ev(`!!navigator.serviceWorker.controller`);i++)await sleep(150);
  await b.send('Network.enable');await b.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
  await b.goto(base);await b.ev(`BCT.ui.show('me');true`);
  assert.ok(await b.ev(`(async()=>{for(const src of ['assets/ui/camera.webp','assets/ui/dress.webp','assets/ui/album.webp','assets/ui/map.webp','assets/items/toy_ball.webp']){const im=new Image();im.src=src;await im.decode();if(!im.naturalWidth)return false;}return true;})()`));
  assert.deepEqual(b.consoleLogs.filter(x=>x.startsWith('EXCEPTION')),[]);
  console.log('PASS: exact 3-button sizes preserved at 390/320px; navigation, synthetic camera/switch request or unavailable-camera fallback, sea/photo capture, save, retake, location/map, offline images.');
}finally{b.close();}
