// Connected surface regression: nine forms, full cycles, silhouettes, original-art fidelity,
// equipment, context loss, reduced motion, and actual admin/home/habitat integration.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {launch,sleep} from './cdp.mjs';
const base=process.env.BCT_URL||'http://127.0.0.1:8766/';
const out='tests/e2e/out';fs.mkdirSync(out,{recursive:true});
const b=await launch({port:16100+Math.floor(Math.random()*400),width:1200,height:1200,mobile:false});
try {
  await b.goto(base);
  await b.ev(`BCT.game.choosePet('dolphin','確認','確認',1);BCT.ui.show('settings');
    window.jointGrid=document.createElement('div');jointGrid.style.cssText='position:fixed;inset:0;z-index:99999;background:#eaf2f1;display:grid;grid-template-columns:repeat(3,1fr);gap:6px';document.body.append(jointGrid);window.jointRigs=[];`);
  const results=[];
  for(const type of ['dolphin','turtle','hermit']) for(const stage of [1,2,3]) {
    const result=await b.ev(`(async()=>{
      const cell=document.createElement('div');cell.style.cssText='height:390px;position:relative;background:#fff';cell.innerHTML='<b>${type} ${stage}</b><div style="position:absolute;inset:30px 40px"></div>';jointGrid.append(cell);
      const host=cell.lastElementChild,r=BCT.petRig.create({host,type:'${type}',stage:${stage},equip:{head:'head_flower',acc:'accessory_korogaki'}});
      if(!await r.ready)throw Error('rig not ready');r.parts.root.style.display='block';jointRigs.push(r);
      const skin=r.parts.skin;if(!skin?.gl||skin.canvas.hidden)throw Error('connected skin not enabled');
      const pixels=()=>{const a=new Uint8Array(skin.canvas.width*skin.canvas.height*4);skin.gl.readPixels(0,0,skin.canvas.width,skin.canvas.height,skin.gl.RGBA,skin.gl.UNSIGNED_BYTE,a);return a;};
      skin.draw(0,0);const neutral=pixels();
      // Texture at zero movement must match the original image (not inpainted cutouts).
      const ref=document.createElement('canvas');ref.width=skin.canvas.width;ref.height=skin.canvas.height;
      const ctx=ref.getContext('2d');ctx.drawImage(skin.fallback,(ref.width-r.parts.front.W)/2,(ref.height-r.parts.front.H)/2);
      const original=ctx.getImageData(0,0,ref.width,ref.height).data;
      let error=0,n=0;for(let y=0;y<ref.height;y++)for(let x=0;x<ref.width;x++){
        const i=(y*ref.width+x)*4,j=((ref.height-1-y)*ref.width+x)*4;
        if(original[i+3]>250){for(let k=0;k<3;k++){error+=Math.abs(original[i+k]-neutral[j+k]);n++;}}
      }
      let area=Infinity,maxMove=0,changed=0;
      // Dense consecutive frames catch discontinuities that isolated poses miss.
      let prev=null,velocity=null,maxAcceleration=0,minStrength=Infinity,maxStrength=0;
      for(let p=0;p<=512;p++){
        skin.draw(p*Math.PI/256,1);
        const now=skin.last.positions;
        minStrength=Math.min(minStrength,skin.last.strength);maxStrength=Math.max(maxStrength,skin.last.strength);
        area=Math.min(area,skin.last.minArea);
        if(prev){const v=Float32Array.from(now,(n,i)=>n-prev[i]);if(velocity)for(let i=0;i<v.length;i++)maxAcceleration=Math.max(maxAcceleration,Math.abs(v[i]-velocity[i]));velocity=v;}
        prev=now;
      }
      for(let p=0;p<32;p++){
        BCT.petRig.poseAt(r,p*Math.PI/16,1);area=Math.min(area,skin.last.minArea);
        for(let i=0;i<skin.mesh.base.length;i+=2)maxMove=Math.max(maxMove,Math.hypot(skin.last.positions[i]-skin.mesh.base[i],skin.last.positions[i+1]-skin.mesh.base[i+1]));
      }
      const moving=pixels();for(let i=0;i<moving.length;i+=4)if(Math.abs(moving[i+3]-neutral[i+3])>16)changed++;
      BCT.petRig.poseAt(r,Math.PI/2,1);
      return {type:'${type}',stage:${stage},textureError:error/n,minArea:area,maxMove,changed,maxAcceleration,minStrength,maxStrength,equipment:host.querySelectorAll('.pr-equip').length};
    })()`);
    assert.ok(result.textureError<2,JSON.stringify(result));
    assert.ok(result.minArea>=.25,JSON.stringify(result));
    assert.ok(result.maxMove>1,JSON.stringify(result));
    assert.ok(result.changed>10,JSON.stringify(result));
    assert.equal(result.minStrength,result.maxStrength,'no framewise strength jumps');
    assert.ok(result.maxAcceleration<.05,JSON.stringify(result));
    assert.equal(result.equipment,2);
    results.push(result);
  }
  await b.shot(out+'/pet-joints-fixed.png');
  await b.ev(`jointRigs.forEach(r=>{BCT.petRig.poseAt(r,3*Math.PI/2,1);r.host.style.transform='scaleX(-1)';})`);
  await b.shot(out+'/pet-joints-fixed-reverse.png');
  // WebGL loss must show the intact source image, never disconnected cutouts.
  await b.ev(`jointRigs[0].parts.skin.gl.getExtension('WEBGL_lose_context').loseContext()`);
  await sleep(100);
  assert.equal(await b.ev(`!jointRigs[0].parts.skin.fallback.hidden&&jointRigs[0].parts.skin.canvas.hidden`),true);
  await b.ev(`jointRigs.forEach(r=>BCT.petRig.destroy(r));jointGrid.remove();BCT.ui.show('home');`);
  await sleep(1800);
  assert.equal(await b.ev(`!!document.querySelector('#pet .pr-connected .pr-skin')`),true);
  await b.ev(`BCT.ui.show('habitat')`);await sleep(1500);
  assert.equal(await b.ev(`!!document.querySelector('#hbPet .pr-connected .pr-skin')`),true);
  await b.ev(`BCT.ui.show('admin')`);await sleep(500);
  assert.equal(await b.ev(`!!document.querySelector('#scr-admin .pr-connected .pr-skin')`),true);
  await b.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  assert.equal(await b.ev(`[...document.querySelectorAll('#scr-admin .pet-rig')].every(el=>getComputedStyle(el).display==='none')`),true);
  await b.send('Emulation.setEmulatedMedia',{features:[]});
  // Compare home sizing with the new renderer enabled and disabled. Layout is independent.
  await b.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
  await b.ev(`BCT.ui.show('home')`);await sleep(1000);
  const withSkin=await b.ev(`document.getElementById('pet').offsetWidth`);
  await b.ev(`window.savedSkin=BCT.petSkin;BCT.petSkin=null;BCT.petRig.rigs().forEach(r=>BCT.petRig.destroy(r));BCT.ui.show('settings');BCT.ui.show('home');`);await sleep(1000);
  const withoutSkin=await b.ev(`document.getElementById('pet').offsetWidth`);
  assert.equal(withSkin,withoutSkin,'skin renderer must not change home size');
  await b.ev(`BCT.petSkin=savedSkin;BCT.petRig.rigs().forEach(r=>BCT.petRig.destroy(r));`);
  await b.ev(`navigator.serviceWorker.ready`);
  await b.send('Network.enable');
  await b.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
  await b.goto(base);await sleep(800);
  assert.equal(await b.ev(`!!BCT.petRig.rigs().find(r=>r.cfg.type==='dolphin'&&r.parts?.skin?.gl)`),true,'connected renderer offline');
  await b.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
  const beforePreview=await b.ev(`localStorage.getItem('bct-state')`);
  await b.goto(base+'preview-pet-joints.html');await sleep(2500);
  assert.equal(await b.ev(`document.querySelectorAll('.pr-connected').length`),9);
  assert.equal(await b.ev(`localStorage.getItem('bct-state')`),beforePreview);
  assert.equal(await b.ev(`document.documentElement.scrollWidth<=innerWidth`),true);
  const errors=b.consoleLogs.filter(x=>/^(error|EXCEPTION)/.test(x));assert.deepEqual(errors,[]);
  fs.writeFileSync(out+'/pet-joints-results.json',JSON.stringify(results,null,2));
  console.log(JSON.stringify({forms:results.length,poses:results.length*32,consecutivePhases:results.length*513,originalTexture:'passed',connectedMesh:'passed',motion:'passed',equipment:'passed',fallback:'passed',screens:['home','habitat','admin'],homeSize:{withSkin,withoutSkin},offline:'passed',preview:'passed',errors}));
}finally{b.close();}
