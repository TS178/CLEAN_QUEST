// Self-contained code/art snapshot: an older service worker cannot mix cached rig JS/CSS into it.
// Cutout PNGs are unchanged and remain referenced from the project's root.
import fs from 'node:fs';
const root=new URL('../',import.meta.url);
let html=fs.readFileSync(new URL('preview-pet-joints.html',root),'utf8');
html=html.replace('<meta charset="utf-8">','<meta charset="utf-8"><base href="/">');
html=html.replace(/<link rel="stylesheet" href="([^"]+)">/g,(_,file)=>'<style>'+fs.readFileSync(new URL(file,root),'utf8')+'</style>');
html=html.replace(/<script src="([^"]+)"><\/script>/g,(_,file)=>'<script>'+fs.readFileSync(new URL(file,root),'utf8').replace(/<\/script/gi,'<\\/script')+'</script>');
const dir=new URL('output/design-proposals/pet-joints-1-25/',root);
fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(new URL('index.html',dir),html);
console.log('output/design-proposals/pet-joints-1-25/index.html');
