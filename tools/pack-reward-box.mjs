// Preserve generated alpha and both equal-size animation frames in one small WebP atlas.
import fs from 'node:fs';
import {launch} from '../tests/e2e/cdp.mjs';
const b=await launch({port:18984,mobile:false});
try {
  const src='data:image/png;base64,'+fs.readFileSync('assets/art-source/plabusters/reward-box-v1.png').toString('base64');
  const result=await b.ev(`(async()=>{
    const im=new Image();im.src=${JSON.stringify(src)};await im.decode();
    if(im.width!==im.height*2)throw Error('Expected two square frames');
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;
    const ctx=canvas.getContext('2d');ctx.drawImage(im,0,0,1024,512);
    const data=ctx.getImageData(0,0,1024,512).data;
    let clear=0;for(let i=3;i<data.length;i+=4)if(data[i]===0)clear++;
    return {src:canvas.toDataURL('image/webp',.92),clear};
  })()`);
  if(!result.clear)throw Error('Transparent background missing');
  const out='assets/plabusters/reward-box-v1.webp';
  fs.writeFileSync(out,Buffer.from(result.src.split(',')[1],'base64'));
  console.log(out,fs.statSync(out).size,'bytes;',result.clear,'transparent pixels');
}finally{b.close();}
