// Encode generated artwork for the game, retaining its colors, layout and alpha.
import fs from 'node:fs';
import {launch} from '../tests/e2e/cdp.mjs';
const b=await launch({port:18983,mobile:false});
try {
  for(const [name,maxWidth] of [['coast-inland-v1',1044],['recycling-truck-v1',768]]) {
    const src='data:image/png;base64,'+fs.readFileSync(`assets/art-source/truck-shoot/${name}.png`).toString('base64');
    const result=await b.ev(`(async()=>{
      const im=new Image();im.src=${JSON.stringify(src)};await im.decode();
      const canvas=document.createElement('canvas');canvas.width=Math.min(im.width,${maxWidth});canvas.height=Math.round(im.height*canvas.width/im.width);
      const ctx=canvas.getContext('2d');ctx.drawImage(im,0,0,canvas.width,canvas.height);
      const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
      let clear=0;for(let i=3;i<data.length;i+=4)if(data[i]===0)clear++;
      return {src:canvas.toDataURL('image/webp',.93),width:canvas.width,height:canvas.height,transparentPixels:clear};
    })()`);
    fs.writeFileSync(`assets/truck-shoot/${name}.webp`,Buffer.from(result.src.split(',')[1],'base64'));
    const {src:encoded,...info}=result;console.log(name,info,fs.statSync(`assets/truck-shoot/${name}.webp`).size);
    if(name.startsWith('recycling')&&!info.transparentPixels)throw Error('Truck transparency missing');
  }
}finally{b.close();}
