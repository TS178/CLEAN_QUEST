import assert from 'node:assert/strict';
import fs from 'node:fs';
import {launch,sleep} from './cdp.mjs';
const base=process.env.BCT_URL || 'http://127.0.0.1:8766/';
const out='tests/e2e/out';fs.mkdirSync(out,{recursive:true});
const b=await launch({port:13500+Math.floor(Math.random()*300),width:1200,height:1800,mobile:false});
try {
  await b.goto(base+'preview-pet-motion.html');
  await sleep(700);
  assert.equal((await b.ev('BCT.petMotion.stats()')).unavailable,false);
  assert.equal(await b.ev(`document.querySelectorAll('.pet-motion-layer').length`),9);
  const results=await b.ev(`(async()=>{
    document.body.classList.add('reduce-motion');
    const results=[],photos=[];
    for(const type of ['dolphin','turtle','hermit'])for(const stage of [1,2,3])for(const face of ['normal','happy']){
      const player=BCT.petMotion.createPlayer({type,stage,face});await player.ready;
      const canvas=document.createElement('canvas');canvas.width=360;canvas.height=Math.round(360*player.height/player.width);
      const read=()=>canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
      player.draw(canvas,1000,{motion:false,blink:0});const open=read(),openURL=canvas.toDataURL();
      player.draw(canvas,1000,{motion:false,blink:1});const shut=read(),shutURL=canvas.toDataURL();
      let eyeDiff=0, outsideEyeDiff=0;
      const rig=BCT.petMotion.rigs[type+'-'+stage],source=face==='happy'?rig.happy:rig.crop;
      for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
        const i=(y*canvas.width+x)*4, diff=Math.abs(open[i]-shut[i])+Math.abs(open[i+1]-shut[i+1])+Math.abs(open[i+2]-shut[i+2]);
        if(diff>12){eyeDiff++;const px=((x+.5)/canvas.width*1.18-.09)*source[2]+rig.crop[0],py=((y+.5)/canvas.height*1.18-.09)*source[3]+rig.crop[1];
          if(!rig.eyes.some(([cx,cy,rx,ry])=>((px-cx)/rx)**2+((py-cy)/ry)**2<1.05))outsideEyeDiff++;
        }
      }
      player.draw(canvas,1000,{blink:0});const first=read();
      player.draw(canvas,1700,{blink:0});const second=read();let limbDiff=0;
      for(let i=0;i<first.length;i+=4)if(Math.abs(first[i]-second[i])+Math.abs(first[i+1]-second[i+1])+Math.abs(first[i+2]-second[i+2])+Math.abs(first[i+3]-second[i+3])>30)limbDiff++;
      const neutralBlink=face==='happy'?1:0;
      player.draw(canvas,1000,{motion:false,blink:neutralBlink});const neutral=read();
      const original=new Image();original.src=BCT.PET_SPRITES[type+'-'+stage+'-'+face].src;await original.decode();
      const c=document.createElement('canvas');c.width=canvas.width;c.height=canvas.height;const ctx=c.getContext('2d');
      ctx.drawImage(original,c.width*.09/1.18,c.height*.09/1.18,c.width/1.18,c.height/1.18);const expected=ctx.getImageData(0,0,c.width,c.height).data;
      let error=0,count=0;for(let i=0;i<expected.length;i+=4)if(expected[i+3]>245&&neutral[i+3]>245){for(let j=0;j<3;j++)error+=Math.abs(expected[i+j]-neutral[i+j]);count+=3;}
      results.push({type,stage,face,eyeDiff,outsideEyeDiff,limbDiff,neutralError:error/count});
      if(face==='normal')photos.push({name:type+' '+stage,open:openURL,closed:shutURL});
      player.dispose();
    }
    document.getElementById('motionGallery').innerHTML=photos.map(p=>'<div style="display:inline-block;width:32%;text-align:center"><p>'+p.name+'</p><img style="width:48%" src="'+p.open+'"><img style="width:48%" src="'+p.closed+'"></div>').join('');
    return results;
  })()`);
  for(const r of results){assert.ok(r.eyeDiff>100,JSON.stringify(r));assert.equal(r.outsideEyeDiff,0,JSON.stringify(r));assert.ok(r.limbDiff>200,JSON.stringify(r));assert.ok(r.neutralError<2.5,JSON.stringify(r));}
  await b.shot(out+'/pet-blink-contact.png');
  fs.writeFileSync(out+'/pet-motion-results.json',JSON.stringify(results,null,2));
  // Canvas texture composition keeps equipment, toys and existing static exports.
  const composite=await b.ev(`(async()=>{
    const source=await BCT.petMotion.createComposite({type:'dolphin',stage:2,pose:'toy_bubbles',equip:{head:'head_marine',acc:'accessory_scarf'}});
    if(!source)throw new Error('No compositor');
    source.update(1000,{reduced:false,blink:0,motion:false});const open=source.canvas.toDataURL();
    source.update(1500,{reduced:false,blink:1,motion:false});const closed=source.canvas.toDataURL();
    const changed=open!==closed;source.update(1600,{reduced:true});const still=source.canvas.toDataURL();
    source.dispose();return {changed,disposed:!source.update(2000),still:still.length};
  })()`);
  assert.ok(composite.changed&&composite.disposed&&composite.still>10000);
  await b.goto(base);
  await b.ev(`BCT.game.choosePet('dolphin','テスト','テスト',1)`);
  await b.goto(base);
  await sleep(400);
  assert.ok(await b.ev(`!!document.querySelector('#petBody .pet-motion-layer')`));
  const before=await b.ev(`localStorage.getItem('bct-state')`);
  await sleep(900);
  assert.equal(await b.ev(`localStorage.getItem('bct-state')`),before);
  await b.ev(`BCT.ui.show('habitat')`);await sleep(400);
  assert.ok(await b.ev(`!!document.querySelector('#hbPetBody .pet-motion-layer')`));
  await b.ev(`document.body.classList.add('reduce-motion')`);await sleep(150);
  assert.equal((await b.ev('BCT.petMotion.stats()')).running,false);
  assert.equal(await b.ev(`document.querySelector('#hbPetBody image').style.visibility`),'');
  await b.ev(`document.body.classList.remove('reduce-motion')`);await sleep(150);
  assert.equal((await b.ev('BCT.petMotion.stats()')).running,true);
  await b.ev(`BCT.ui.show('mission')`);await sleep(250);
  assert.equal((await b.ev('BCT.petMotion.stats()')).running,false);
  await b.ev(`document.getElementById('petBody').replaceChildren();document.getElementById('hbPetBody').replaceChildren()`);await sleep(100);
  assert.equal((await b.ev('BCT.petMotion.stats()')).mounted,0);
  const errors=b.consoleLogs.filter(l=>/^(error|EXCEPTION)/.test(l));assert.deepEqual(errors,[]);
  console.log(JSON.stringify({variants:results.length,blink:'eyes only',parts:'passed',originalColors:'passed',composite,lifecycle:'passed',storage:'unchanged',errors}));
}finally{b.close();}
