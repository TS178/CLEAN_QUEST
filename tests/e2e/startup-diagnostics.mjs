// Record fresh-load / reload failures without changing the app or user storage.
import fs from 'node:fs';
import {launch} from './cdp.mjs';
const b=await launch({port:15800+Math.floor(Math.random()*100),width:390,height:844});
const base=process.env.BCT_URL||'http://127.0.0.1:8766/';
const events=[]; const requests=new Map();
try {
  await b.send('Network.enable');
  b.on(e=>{
    if(e.method==='Network.requestWillBeSent') requests.set(e.params.requestId,e.params.request.url);
    if(e.method==='Runtime.exceptionThrown') events.push({type:'exception',...e.params.exceptionDetails});
    if(e.method==='Network.loadingFailed') events.push({type:'failed',url:requests.get(e.params.requestId),...e.params});
    if(e.method==='Network.responseReceived'&&e.params.response.status>=400) events.push({type:'http',url:e.params.response.url,status:e.params.response.status});
  });
  await b.send('Emulation.setUserAgentOverride',{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',platform:'iPhone'});
  for(let i=0;i<4;i++) {
    await b.goto(base+'index.html');
    console.log('load',i,await b.ev(`(async()=>({ready:document.readyState,start:typeof BCT.start,ui:typeof BCT.ui,screen:BCT.ui?.current(),version:await BCT.update?.version()}))()`));
  }
} finally {
  fs.mkdirSync('tests/e2e/out',{recursive:true});
  fs.writeFileSync('tests/e2e/out/startup-diagnostics.json',JSON.stringify(events,null,2));
  console.log('diagnostic events:',events.length); b.close();
}
