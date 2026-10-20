import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {execFileSync} from 'node:child_process';
import {launch,sleep} from './cdp.mjs';

// Serve only an explicit set of public app files; never the repository itself.
const root=process.cwd();
const sw=fs.readFileSync('service-worker.js','utf8');
const precache=[...sw.match(/const FILES = \[([\s\S]*?)\];/)[1].matchAll(/"([^"]+)"/g)].map(m=>m[1]);
const tracked=execFileSync('git',['ls-files','--','assets','css','js','icons','vendor'],{encoding:'utf8'}).trim().split(/\r?\n/);
const allowed=new Set([...precache,...tracked,'service-worker.js'].filter(f=>/\.(html|webmanifest|json|css|js|png|webp|jpe?g|svg|ico|mp4|woff2?|ttf|txt)$/.test(f)));
allowed.add('index.html');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.mp4':'video/mp4'};
const server=http.createServer((req,res)=>{
  let file;
  try {file=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1)||'index.html';}catch{res.writeHead(400).end();return;}
  if(!allowed.has(file)||file.split('/').some(s=>s.startsWith('.'))||file.includes('\\')){res.writeHead(404).end();return;}
  const target=path.join(root,file);
  if(!fs.existsSync(target)){res.writeHead(404).end();return;}
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
  fs.createReadStream(target).pipe(res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}/`;
let b;
try {
  for(const file of ['.git/config','.env','README.md','js/../.git/config']) assert.equal((await fetch(base+file)).status,404);
  b=await launch({port:12489,width:390,height:844});
  await b.goto(base,50);
  assert.equal(await b.ev('BCT.ui.current()'),null);
  assert.equal(await b.ev('document.getElementById("app").inert'),true);
  assert.equal(await b.ev('document.title'),'SHIKA QUEST');
  await b.ev(`new Promise((resolve,reject)=>{const end=Date.now()+12000;function check(){if(document.querySelector('.sq-opening__start')?.disabled===false)return resolve();if(Date.now()>end)return reject(Error('Opening did not reach start'));setTimeout(check,50)}check()})`);
  assert.equal(await b.ev('getComputedStyle(document.querySelector(".sq-opening__fairies")).opacity'),'0');
  fs.mkdirSync('tests/e2e/out',{recursive:true});
  await b.shot('tests/e2e/out/quest-opening-title.png');
  await b.ev('document.querySelector(".sq-opening__start").click();document.querySelector(".sq-opening__start").click()');
  await sleep(500);
  assert.equal(await b.ev('BCT.ui.current()'),'egg');
  assert.equal(await b.ev('document.getElementById("app").inert'),false);
  assert.equal(await b.ev('document.querySelectorAll(".sq-opening").length'),0);
  assert.equal(await b.ev('document.querySelectorAll("#eggs [data-type]").length'),3);
  await b.shot('tests/e2e/out/quest-opening-egg.png');
  await b.ev(`BCT.game.choosePet('turtle','かめちゃん','テスト隊',2);BCT.game.claim('opening-test','gift',{xp:0,coins:123});BCT.ui.show('home');BCT.prefs.set('reduceMotion',true);window.beforeOpening={pet:BCT.store.get().pet,claims:BCT.store.get().claims,owned:BCT.store.get().owned};`);
  const before=await b.ev('window.beforeOpening');
  await b.ev(`Promise.race([navigator.serviceWorker.ready.then(()=>true),new Promise((_,reject)=>setTimeout(()=>reject(Error('Service worker install timed out')),15000))])`);
  await b.goto(base,200);
  assert.equal(await b.ev('BCT.ui.current()'),null);
  assert.equal(await b.ev('document.querySelector(".sq-opening").classList.contains("is-reduced")'),true);
  await b.ev('document.querySelector(".sq-opening__start").click()');
  await sleep(100);
  assert.equal(await b.ev('BCT.ui.current()'),'home');
  assert.deepEqual(await b.ev('({pet:BCT.store.get().pet,claims:BCT.store.get().claims,owned:BCT.store.get().owned})'),before);
  await b.shot('tests/e2e/out/quest-opening-home.png');
  assert.equal(await b.ev('BCT.update.version()'),'1.42');
  const cached=await b.ev(`(async()=>{const c=await caches.open('bct-1.42');return Promise.all(['css/opening.css','js/opening.js','js/startup.js','assets/opening/logo.png','assets/opening/shore.webp','assets/opening/dolphin.webp','assets/opening/turtle.webp','assets/opening/hermit.webp'].map(async p=>!!(await c.match(new URL(p,location.href).href))))})()`);
  assert.ok(cached.every(Boolean),'All opening resources cached');
  await b.send('Network.enable');
  await b.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
  await b.goto(base,150);
  assert.equal(await b.ev('document.querySelector(".sq-opening__start").disabled'),false);
  assert.equal(await b.ev('[...document.querySelectorAll(".sq-opening img")].every(im=>im.complete&&im.naturalWidth>0)'),true);
  await b.ev('document.querySelector(".sq-opening__start").click()');
  await sleep(100);
  assert.equal(await b.ev('BCT.ui.current()'),'home');
  assert.deepEqual(await b.ev('({pet:BCT.store.get().pet,claims:BCT.store.get().claims,owned:BCT.store.get().owned})'),before);
  await b.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
  await b.ev('BCT.prefs.set("reduceMotion",false)');
  await b.goto(base,100);
  await b.ev('document.querySelector(".sq-opening__skip").click()');
  await sleep(1300);
  assert.equal(await b.ev('document.querySelector(".sq-opening__start").disabled'),false);
  await b.ev('document.querySelector(".sq-opening__start").click()');
  await sleep(500);
  assert.equal(await b.ev('BCT.ui.current()'),'home');
  assert.deepEqual(b.consoleLogs.filter(x=>x.startsWith('EXCEPTION')),[]);
  console.log('PASS: opening sequence, fresh egg selection, returning home, saved pet/rewards/items, double click, reduced motion, skip, service worker 1.42 and offline startup.');
} finally {
  b?.close();
  await new Promise(resolve=>server.close(resolve));
}
