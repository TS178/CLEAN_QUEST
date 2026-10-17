// Reproduce an already-installed app serving old rig code to a new preview page.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import {launch} from './cdp.mjs';
const b=await launch({port:16730,width:900,height:1000,mobile:false});
const base='http://127.0.0.1:8766/';
const version=fs.readFileSync('service-worker.js','utf8').match(/const APP_VERSION = "([^"]+)"/)[1];
try {
  await b.goto(base);
  // This test starts with an installed worker; startup registration is covered separately.
  await b.ev(`navigator.serviceWorker.register('service-worker.js')`);
  await b.ev(`Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(Error('Service Worker did not become ready')),15000))])`);
  for(const file of ['js/pet-rig.js','js/pet-rig-config.js','css/pet-rig.css']) {
    const old=execFileSync('git',['show','101a189:'+file],{encoding:'utf8',maxBuffer:2e6});
    await b.ev(`(async()=>{const cache=await caches.open('bct-${version}');await cache.put(${JSON.stringify(file)},new Response(${JSON.stringify(old)},{headers:{'Content-Type':${JSON.stringify(file.endsWith('.css')?'text/css':'application/javascript')}}}));})()`);
  }
  await b.goto(base+'preview-pet-joints.html',3000);
  const result=await b.ev(`({rigs:document.querySelectorAll('.pet-rig').length,connected:document.querySelectorAll('.pr-connected').length,skinScriptPresent:!!BCT.petSkin})`);
  assert.equal(result.rigs,9);assert.equal(result.connected,0);assert.equal(result.skinScriptPresent,true);
  console.log(JSON.stringify(result));
  await b.goto(base+'output/design-proposals/pet-joints-'+version.replaceAll('.','-')+'/index.html',3000);
  const fixed=await b.ev(`({rigs:document.querySelectorAll('.pet-rig').length,connected:document.querySelectorAll('.pr-connected').length,status:document.querySelector('#renderStatus').textContent})`);
  assert.equal(fixed.connected,9);assert.ok(fixed.status.includes('9/9'));
  console.log(JSON.stringify({isolatedPreview:fixed}));
}finally{b.close();}
