// Review-only models: geometry, appearance variants, rotation and responsive UI.
// Run with a local server on 8766: node tests/e2e/preview-3d.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {launch,sleep} from './cdp.mjs';

fs.mkdirSync('tests/e2e/out',{recursive:true});
const browser=await launch({port:15100+Math.floor(Math.random()*400),width:1300,height:1000,mobile:false,args:['--enable-unsafe-swiftshader']});
let scenarios=0;
try{
  await browser.send('Emulation.setDeviceMetricsOverride',{width:1300,height:1000,deviceScaleFactor:1,mobile:false});
  await browser.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await browser.goto('http://127.0.0.1:8766/preview-3d.html',1800);
  assert.equal(await browser.ev('petPreview.ready'),true);
  const initialStorage=await browser.ev('JSON.stringify(localStorage)');
  for(const type of ['dolphin','turtle','hermit'])for(const stage of [1,2,3]){
    for(const acc of ['none','scarf','pendant']){
      await browser.ev(`petPreview.set(${JSON.stringify({type,stage,acc,head:acc==='none'?'none':'cap',look:'none'})});petPreview.setAngle(-.6)`);
      const geometry=await browser.ev(`(()=>{let meshes=0,invalid=0,sprites=0;petPreview.model.traverse(o=>{if(o.isSprite)sprites++;if(o.isMesh){meshes++;for(const n of o.geometry.attributes.position.array)if(!Number.isFinite(n))invalid++;}});return {meshes,invalid,sprites,scale:petPreview.model.scale.toArray()}})()`);
      assert.ok(geometry.meshes>8);assert.equal(geometry.invalid,0);assert.equal(geometry.sprites,0);assert.deepEqual(geometry.scale,[1,1,1]);
      scenarios++;
    }
    await browser.ev('petPreview.setAngle(2.6)');await sleep(40);
  }
  for(const type of ['dolphin','turtle','hermit']){
    const frames=[];
    for(const look of ['none','wave','star','sparkle']){
      await browser.ev(`petPreview.set(${JSON.stringify({type,stage:3,head:'none',acc:'none',look})});petPreview.setAngle(-.6);petPreview.render()`);
      frames.push(await browser.ev(`document.querySelector('#scene canvas').toDataURL()`));
      await browser.shot(`tests/e2e/out/volume-${type}-${look}.png`);scenarios++;
    }
    assert.equal(new Set(frames).size,4,`${type}: visible appearance variants`);
  }
  await browser.ev(`petPreview.set({type:'dolphin',stage:3,head:'cap',acc:'scarf',look:'none'});document.querySelector('#turn').click()`);
  const yaw=[];
  for(let i=0;i<14;i++){await sleep(300);yaw.push(await browser.ev('petPreview.yaw'));assert.equal(await browser.ev('petPreview.model.scale.x'),1);}
  assert.ok(Math.max(...yaw)>.5&&Math.min(...yaw)<-.5,'turns in both directions');
  await browser.ev(`document.querySelector('#front').click();document.querySelector('#smile').click()`);
  assert.equal(await browser.ev('petPreview.state.happy'),true);
  await browser.ev(`document.querySelector('#back').click()`);await sleep(1100);
  assert.ok(await browser.ev('Math.abs(petPreview.yaw-Math.PI)<.03'));
  await browser.shot('tests/e2e/out/volume-back.png');
  for(const width of [360,768,1300]){
    await browser.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await sleep(100);
    assert.ok(await browser.ev('document.documentElement.scrollWidth<=innerWidth'),`${width}px: no overflow`);
  }
  assert.equal(await browser.ev('JSON.stringify(localStorage)'),initialStorage);
  const errors=browser.consoleLogs.filter(s=>/^(error|EXCEPTION)/.test(s));assert.deepEqual(errors,[]);
  await browser.ev(`petPreview.set({type:'dolphin',stage:3,head:'cap',acc:'scarf',look:'none',happy:false});petPreview.setAngle(-.55)`);await sleep(100);
  await browser.shot('tests/e2e/out/volume-design-review.png');
  console.log(JSON.stringify({scenarios,rotation:'passed',responsiveWidths:[360,768,1300],storage:'unchanged',errors}));
}finally{browser.close();}
