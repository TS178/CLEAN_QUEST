import fs from 'node:fs';
import {launch} from '../tests/e2e/cdp.mjs';
const b=await launch({port:11873,width:1400,height:1000,mobile:false});
try{
 await b.goto('http://127.0.0.1:8766/preview-pet-motion.html');
 const result=await b.ev(`(async()=>{
  const out={};
  for(const [type,file] of [['dolphin','dolphin-parts-v1.png'],['turtle','turtle-parts-v1.png'],['hermit','hermit-parts-v2.png']]){
   const im=new Image();im.src='assets/art-source/motion-parts/'+file;await im.decode();
   const c=document.createElement('canvas');c.width=im.width;c.height=im.height;
   const g=c.getContext('2d');g.drawImage(im,0,0);
   const d=g.getImageData(0,0,c.width,c.height).data,w=c.width,h=c.height,seen=new Uint8Array(w*h),queue=new Int32Array(w*h),regions=[];
   let transparent=0,opaque=0;
   for(let k=0;k<w*h;k++){if(d[k*4+3]===0)transparent++;if(d[k*4+3]===255)opaque++;}
   for(let k=0;k<w*h;k++){
    if(seen[k]||d[k*4+3]<128)continue;
    let start=0,end=1,n=0,l=w,t=h,r=0,bot=0;queue[0]=k;seen[k]=1;
    while(start<end){const q=queue[start++],x=q%w,y=Math.floor(q/w);n++;l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);bot=Math.max(bot,y);
     for(const a of [x? q-1:-1,x<w-1?q+1:-1,y?q-w:-1,y<h-1?q+w:-1])if(a>=0&&!seen[a]&&d[a*4+3]>=128){seen[a]=1;queue[end++]=a;}
    }
    if(n>350)regions.push({n,rect:[l,t,r-l+1,bot-t+1]});
   }
   out[type]={width:w,height:h,transparent,opaque,regions:regions.sort((a,b)=>a.rect[1]-b.rect[1])};
  }
  return out;
 })()`);
 fs.writeFileSync('assets/art-source/motion-parts/inspection.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 await b.ev(`document.body.innerHTML='<img style="width:1350px" src="assets/art-source/motion-parts/dolphin-parts-v1.png">';document.body.style.background='#fffaf0'`);
 await new Promise(r=>setTimeout(r,500));await b.shot('tests/e2e/out/motion-parts-alpha.png');
}finally{b.close();}
