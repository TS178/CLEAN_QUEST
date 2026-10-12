import fs from 'node:fs';
import {launch} from '../tests/e2e/cdp.mjs';
const b=await launch({port:12061,mobile:false});
try {
  await b.goto('http://127.0.0.1:8766/preview-collection-art.html');
  const keys=process.argv.includes('--habitat')?['habitat']:['medal','beach'];
  for(const key of keys) {
    const data=await b.ev(`(async()=>{
      const im=new Image();im.src='assets/art-source/ui-refresh/${key}.png';await im.decode();
      const c=document.createElement('canvas');c.width=im.width;c.height=im.height;
      const g=c.getContext('2d');g.drawImage(im,0,0);let l=0,t=0,w=im.width,h=im.height;
      if('${key}'!=='beach'){
        const d=g.getImageData(0,0,w,h).data;let r=0,b=0;l=w;t=h;
        for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(d[(y*w+x)*4+3]>32){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);}
        l=Math.max(0,l-4);t=Math.max(0,t-4);w=Math.min(im.width,r+5)-l;h=Math.min(im.height,b+5)-t;
      }
      const out=document.createElement('canvas'),scale=Math.min(1,('${key}'==='beach'?1200:320)/Math.max(w,h));out.width=Math.round(w*scale);out.height=Math.round(h*scale);
      out.getContext('2d').drawImage(c,l,t,w,h,0,0,out.width,out.height);return out.toDataURL('image/webp',.91);
    })()`);
    fs.writeFileSync(`assets/ui/${key}.webp`,Buffer.from(data.split(',')[1],'base64'));
  }
  console.log('Packaged '+keys.join(', ')+'.');
}finally{b.close();}
