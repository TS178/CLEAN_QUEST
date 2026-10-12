import fs from 'node:fs';
import assert from 'node:assert/strict';
import {launch,sleep} from '../tests/e2e/cdp.mjs';
const b=await launch({port:12139,width:1040,height:1250,mobile:false});
const root='assets/design-proposals/camera-icons/';
try{
  await b.goto('http://127.0.0.1:8766/preview-home-shortcuts.html');
  for(const key of ['camera','dress','album','map']){
    const data=await b.ev(`(async()=>{const im=new Image();im.src='${root}${key}.png';await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const g=c.getContext('2d');g.drawImage(im,0,0);const d=g.getImageData(0,0,c.width,c.height).data;let l=c.width,t=c.height,r=0,b=0;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(d[(y*c.width+x)*4+3]>32){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}const edge=Math.max(r-l+1,b-t+1);const out=document.createElement('canvas');out.width=out.height=320;const ctx=out.getContext('2d');const s=300/edge;const w=(r-l+1)*s,h=(b-t+1)*s;ctx.drawImage(c,l,t,r-l+1,b-t+1,(320-w)/2,(320-h)/2,w,h);return out.toDataURL('image/webp',.93);})()`);
    fs.writeFileSync(root+key+'.webp',Buffer.from(data.split(',')[1],'base64'));
  }
  await b.goto('http://127.0.0.1:8766/preview-camera-icons.html');
  await b.ev(`Promise.all([...document.images].map(im=>im.decode()))`);
  assert.ok(await b.ev(`[...document.images].every(im=>im.naturalWidth>0)`));
  await b.shot(root+'proposal.png');
  await b.send('Emulation.setDeviceMetricsOverride',{width:360,height:950,deviceScaleFactor:1,mobile:true});await sleep(100);
  assert.ok(await b.ev(`document.documentElement.scrollWidth<=innerWidth`),'mobile layout fits');
  await b.shot(root+'proposal-mobile.png');
  assert.deepEqual(b.consoleLogs.filter(x=>x.startsWith('EXCEPTION')),[]);
  console.log('Proposal images packaged; desktop and mobile preview checked. Production app unchanged.');
}finally{b.close();}
