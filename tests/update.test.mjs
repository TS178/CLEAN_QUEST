import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const src=fs.readFileSync(new URL('../js/update.js',import.meta.url),'utf8');
const flush=async()=>{for(let i=0;i<25;i++)await Promise.resolve();};
function setup({installing=null,controller={},pending=false}={}) {
  let now=100000,updates=0,registrations=0,reloads=0,dialogs=0,finishUpdate;
  const eventTarget=()=>({events:{},addEventListener(k,fn){(this.events[k]||=[]).push(fn);},emit(k){for(const fn of this.events[k]||[])fn();}});
  const reg={...eventTarget(),installing,waiting:null,update(){updates++;return pending?new Promise(r=>finishUpdate=r):Promise.resolve();}};
  const sw={...eventTarget(),controller,register(_path,opts){registrations++;sw.options=opts;return Promise.resolve(reg);}};
  const document={...eventTarget(),readyState:'loading',visibilityState:'visible',getElementById:()=>null};
  const window={...eventTarget(),BCT:{ui:{current:()=> 'home',esc:s=>s,modal:async()=>{dialogs++;return false;}}}};
  const timeouts=[],intervals=[];
  class Channel {constructor(){this.port1={};this.port2={send:data=>this.port1.onmessage?.({data})};}}
  vm.runInNewContext(src,{window,document,navigator:{serviceWorker:sw},location:{protocol:'https:',reload(){reloads++;}},Date:{now:()=>now},
    console,MessageChannel:Channel,setTimeout:(fn,ms)=>{timeouts.push({fn,ms});return timeouts.length;},clearTimeout(){},setInterval:(fn,ms)=>intervals.push({fn,ms}),caches:{keys:async()=>[]}});
  return {window,document,reg,sw,timeouts,intervals,api:window.BCT.update,
    get updates(){return updates;},get registrations(){return registrations;},get dialogs(){return dialogs;},get reloads(){return reloads;},
    tick(ms){now+=ms;},finish(){finishUpdate?.();},worker(state='installing'){return {...eventTarget(),state,postMessage(_msg,ports){ports?.[0].send('1.31');}};}};
}
test('register starts before window.load and does not use the script HTTP cache',async()=>{
  const t=setup();assert.equal(t.registrations,1);assert.equal(t.document.readyState,'loading');
  assert.equal(t.sw.options.updateViaCache,'none');await flush();assert.equal(t.updates,1);
});
test('visible app checks every minute, hidden app does not poll',async()=>{
  const t=setup();await flush();const interval=t.intervals.find(i=>i.ms===60000);
  assert.ok(interval);t.tick(60000);interval.fn();await flush();assert.equal(t.updates,2);
  t.document.visibilityState='hidden';t.tick(60000);interval.fn();await flush();assert.equal(t.updates,2);
});
test('return after 15s and reconnect check again, foreground events are throttled',async()=>{
  const t=setup();await flush();t.tick(14000);t.window.emit('focus');await flush();assert.equal(t.updates,1);
  t.tick(1000);t.document.emit('visibilitychange');await flush();assert.equal(t.updates,2);
  t.window.emit('focus');t.window.emit('pageshow');await flush();assert.equal(t.updates,2);
  t.window.emit('online');await flush();assert.equal(t.updates,3);
});
test('simultaneous check calls share one network request',async()=>{
  const t=setup({pending:true});await flush();const a=t.api.check(),b=t.api.check();assert.equal(a,b);assert.equal(t.updates,1);
  t.finish();await flush();assert.equal(await a,true);
});
test('already installing worker is watched; postpone does not prompt again or reload',async()=>{
  const t=setup();const worker=t.worker();t.reg.installing=worker;await flush();
  worker.state='installed';t.reg.waiting=worker;worker.emit('statechange');await flush();assert.equal(t.dialogs,1);
  await t.api.check();await flush();assert.equal(t.dialogs,1);assert.equal(t.reloads,0);assert.equal(t.api.hasUpdate(),true);
});
test('game defers update prompt until finished; first installation is silent',async()=>{
  const t=setup();let playing=true;t.window.BCT.truckShoot={busy:()=>playing};const worker=t.worker();t.reg.installing=worker;await flush();
  worker.state='installed';worker.emit('statechange');await flush();assert.equal(t.dialogs,0);
  playing=false;const wait=t.timeouts.find(i=>i.ms===250);assert.ok(wait);wait.fn();await flush();assert.equal(t.dialogs,1);
  const first=setup({controller:null});const initial=first.worker();first.reg.installing=initial;await flush();initial.state='installed';initial.emit('statechange');await flush();assert.equal(first.dialogs,0);
});
