// Approved E layout. Render existing assets without changing their character designs.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {launch} from '../tests/e2e/cdp.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const svg=fs.readFileSync(path.join(root,'tools/pwa-icon-E.svg'),'utf8').replace(/\{\{([^}]+)\}\}/g,(_,name)=>`data:image/${name.endsWith('.png')?'png':'webp'};base64,${fs.readFileSync(path.join(root,'assets/opening',name)).toString('base64')}`);
const b=await launch({port:12528,mobile:false});
try {
 const rendered=await b.ev(`(async()=>{
  const source=${JSON.stringify(svg)};
  const render=async(text,size)=>{const im=new Image();im.src='data:image/svg+xml;base64,'+btoa(text);await im.decode();const c=document.createElement('canvas');c.width=c.height=size;c.getContext('2d').drawImage(im,0,0,size,size);return c;};
  const doc=new DOMParser().parseFromString(source,'image/svg+xml');
  const images=[...doc.querySelectorAll('image')].map(im=>new XMLSerializer().serializeToString(im)).join('');
  const foreground='<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">'+images+'</svg>';
  const c=await render(foreground,512),pixels=c.getContext('2d').getImageData(0,0,512,512).data;
  let radius=0;
  for(let y=0;y<512;y++)for(let x=0;x<512;x++)if(pixels[(y*512+x)*4+3]>0)radius=Math.max(radius,Math.hypot(x+.5-256,y+.5-256));
  // Android maskable safe circle: 40% of the 512px side, with an 8px margin.
  const scale=Math.min(1,(512*.4-8)/radius);
  const bgEnd=source.indexOf('/>',source.indexOf('<circle cx="256" cy="210"'))+2;
  const masked=source.slice(0,bgEnd)+'<g transform="translate(256 256) scale('+scale+') translate(-256 -256)">'+source.slice(bgEnd).replace('</svg>','</g></svg>');
  const results=[];
  for(const [file,size,mask] of [['icon-192.png',192,false],['icon-512.png',512,false],['apple-touch-icon.png',180,false],['icon-maskable-512.png',512,true]]){
   const canvas=await render(mask?masked:source,size),rgba=canvas.getContext('2d').getImageData(0,0,size,size).data;
   if(!rgba.every((v,i)=>i%4!==3||v===255))throw Error(file+' must be opaque');
   results.push({file,size,data:canvas.toDataURL('image/png').split(',')[1]});
  }
  return {results,scale,radius,safeRadius:radius*scale};
 })()`);
 assert.ok(rendered.safeRadius<=512*.4-7.9);
 for(const r of rendered.results){fs.writeFileSync(path.join(root,'icons',r.file),Buffer.from(r.data,'base64'));console.log(`${r.file}: ${r.size}x${r.size}, opaque`);}
 console.log(`Maskable foreground scale ${rendered.scale.toFixed(4)}; all character/logo pixels within radius ${rendered.safeRadius.toFixed(1)}px (safe circle 204.8px).`);
} finally {b.close();}
