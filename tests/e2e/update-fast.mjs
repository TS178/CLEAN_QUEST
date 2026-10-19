// Real SW lifecycle, including registration before a deliberately stalled image finishes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {launch,sleep} from './cdp.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const source=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
const initial=/const APP_VERSION = "([^"]+)"/.exec(source)[1];
let version=initial,stall=true;
const delayed=[];
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.json':'application/json','.mp4':'video/mp4'};
const release=()=>{stall=false;for(const res of delayed)res.end('<svg xmlns="http://www.w3.org/2000/svg"/>');};
const server=http.createServer((req,res)=>{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(name==='/slow-image.svg'){res.writeHead(200,{'Content-Type':'image/svg+xml'});if(stall)delayed.push(res);else res.end('<svg xmlns="http://www.w3.org/2000/svg"/>');return;}
  const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
  if(!file.startsWith(root)){res.writeHead(403);res.end();return;}
  fs.readFile(file,(err,data)=>{
    if(!err&&name==='/service-worker.js')data=source.replace(`const APP_VERSION = "${initial}"`,`const APP_VERSION = "${version}"`);
    if(!err&&(name==='/'||name==='/index.html'))data=data.toString().replace('</body>','<img src="slow-image.svg" alt="" style="position:absolute;width:1px;height:1px"></body>');
    res.writeHead(err?404:200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(err?'Not found':data);
  });
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}/`;
let b;
try{
  b=await launch({port:18981,width:390,height:844});
  const ev=b.ev;
  async function until(expr,timeout=20000){
    const end=Date.now()+timeout;
    while(Date.now()<end){try{if(await ev(expr))return;}catch{/* navigation */}await sleep(100);}
    throw Error('Timed out: '+expr);
  }
  const hasPrompt=`document.getElementById('modal').classList.contains('show') && document.getElementById('modalBox').textContent.includes('あたらしい バージョン')`;
  const click=text=>ev(`document.querySelectorAll('#modalBox button').forEach(b=>{if(b.textContent.includes(${JSON.stringify(text)}))b.click()})`);
  await b.send('Page.navigate',{url:base});
  await until(`!!window.BCT?.update && !!navigator.serviceWorker.controller`);
  assert.notEqual(await ev(`document.readyState`),'complete','SW registered while image still loading');
  release();await until(`document.readyState==='complete'`);
  await ev(`BCT.game.choosePet('turtle','かめ','更新テスト',1);BCT.ui.show('mission')`);
  assert.equal(await ev(hasPrompt),false,'initial install is silent');
  await ev(`BCT.ui.show('truck-shoot');document.getElementById('tsStart').click()`);
  const marker=await ev(`window.updateTestMarker='preserved';BCT.game.coins(BCT.store.get())`);
  version='9.91';
  await ev(`window.dispatchEvent(new Event('online'))`);
  await until(`BCT.update.hasUpdate()`);
  assert.equal(await ev(hasPrompt),false,'update does not interrupt the game');
  await ev(`BCT.ui.show('mission')`);
  await until(hasPrompt,5000);
  assert.ok(await ev(`document.getElementById('modalBox').textContent.includes('9.91')`));
  assert.equal(await ev(`window.updateTestMarker`),'preserved','no automatic reload');
  await click('あとで');
  await ev(`window.dispatchEvent(new Event('online'))`);await sleep(800);
  assert.equal(await ev(hasPrompt),false,'postponed update is not prompted repeatedly');
  await ev(`document.getElementById('tbGear').click()`);
  assert.equal(await ev(`document.getElementById('setUpdate').hidden`),false);
  await ev(`document.getElementById('setUpdateGo').click()`);
  await until(`!window.updateTestMarker && !!window.BCT?.update`);
  await until(`BCT.update.version().then(v=>v==='9.91')`);
  assert.equal(await ev(`BCT.store.get().pet.name`),'かめ');
  assert.equal(await ev(`BCT.game.coins(BCT.store.get())`),marker);
  const errors=b.consoleLogs.filter(s=>s.startsWith('EXCEPTION:'));
  assert.deepEqual(errors,[]);
  console.log('PASS: update registration before window.load, reconnect detection, game deferral, postpone, settings update, reload, preserved data.');
}finally{release();b?.close();server.closeAllConnections();server.close();}
