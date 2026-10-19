import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function boot(disk=new Map(), fail=false) {
  const storage={getItem:k=>disk.get(k)||null,setItem(k,v){if(this.fail)throw Error('quota');disk.set(k,v);},fail};
  const context=vm.createContext({window:{addEventListener(){}},localStorage:storage,console:{warn(){}},crypto:globalThis.crypto,Date,Math,JSON,setTimeout});
  for(const file of ['config','items','trash','quiz-data','storage','game','badges','pets','truck-shoot-physics'])vm.runInContext(fs.readFileSync(new URL(`../js/${file}.js`,import.meta.url),'utf8'),context);
  const B=context.window.BCT;B.store.load();return {B,storage,disk};
}
const {B}=boot(),P=B.truckPhysics;
function aligned(s) {return P.aim(-(P.truckX(s.time+P.crossing)-180)/P.crossing/3.2,255/P.crossing/3.2);}

test('power and direction stay inland; reverse, small, and invalid pulls do not fire',()=>{
  assert.equal(P.aim(0,-100),null);assert.equal(P.aim(1,5),null);assert.equal(P.aim(NaN,80),null);
  const a=P.aim(500,500);assert.ok(Math.hypot(a.dx,a.dy)<=116.00001);assert.ok(a.vd>0);assert.ok(a.vx<0);
});
test('moving opening is hit on descent with identical outcomes at high and low frame rates',()=>{
  for(const dt of [1/120,1/30,1.2]){
    const s=P.create('hit');s.phase='playing';s.time=7;
    assert.equal(P.fire(s,aligned(s)),true);
    while(s.shot)P.advance(s,dt);
    assert.deepEqual([...s.outcomes],[true]);P.advance(s,2);assert.equal(s.outcomes.length,1);
  }
  const s=P.create('short');s.phase='playing';P.fire(s,P.aim(0,30));P.advance(s,2);
  assert.deepEqual([...s.outcomes],[false]);
});
test('last shot counts after 45 seconds; firing at the deadline and while paused is blocked',()=>{
  const s=P.create('last');s.phase='playing';s.time=44.99;P.fire(s,aligned(s));
  P.advance(s,.02);assert.equal(s.phase,'settling');assert.equal(P.fire(s,aligned(s)),false);
  P.advance(s,1.1);assert.equal(s.phase,'result');assert.equal(s.outcomes[0],true);
  const p=P.create('pause');p.phase='paused';assert.equal(P.fire(p,aligned(p)),false);P.advance(p,100);assert.equal(p.time,0);
  p.phase='playing';p.time=45;assert.equal(P.fire(p,aligned(p)),false);
});
test('star thresholds, no-miss perfect, combo reset and capped coin bonus',()=>{
  assert.equal(P.result([]).coins,0);assert.equal(P.result([false]).stars,0);
  assert.equal(P.result([true]).coins,10);
  assert.equal(P.result(Array(5).fill(true)).stars,2);
  const perfect=P.result(Array(8).fill(true));assert.equal(perfect.stars,3);assert.equal(perfect.coins,52);
  assert.equal(P.result([...Array(8).fill(true),false]).stars,2);
  const r=P.result([true,true,false,true]);assert.equal(r.score,320);assert.equal(r.maxCombo,2);assert.equal(r.combo,1);
  assert.equal(P.result(Array(40).fill(true)).bonus,10);
});
test('every completed round pays once, survives reload/restore, and leaves home and XP unchanged',()=>{
  const {B,disk}=boot();B.game.choosePet('turtle','かめ','隊',1);
  const beach=JSON.stringify(B.store.get().beach),xp=B.game.xp(B.store.get());
  const r={runId:'round-a',phase:'result',time:46,outcomes:Array(8).fill(true)};
  assert.equal(B.game.finishTruckShoot(r).coins,52);
  const other=boot(disk).B;assert.equal(other.game.finishTruckShoot(r).err,'dup');
  assert.equal(other.game.finishTruckShoot({...r,runId:'round-b'}).ok,true);
  assert.equal(other.game.coins(other.store.get()),104);assert.equal(other.store.get().truckShoot.plays,2);
  assert.equal(JSON.stringify(other.store.get().beach),beach);assert.equal(other.game.xp(other.store.get()),xp);
  const backup=JSON.parse(JSON.stringify(other.store.get()));other.store.replace(backup);
  assert.equal(other.store.get().truckShoot.bestScore,1300);assert.equal(other.game.finishTruckShoot(r).err,'dup');
});
test('failed save rolls back both ledger and stats; retry grants exactly once',()=>{
  const {B,storage}=boot();const before=JSON.stringify(B.store.get());
  const r={runId:'retry',phase:'result',time:45,outcomes:[true]};
  storage.fail=true;assert.equal(B.game.finishTruckShoot(r).err,'save');assert.deepEqual(JSON.parse(JSON.stringify(B.store.get())),JSON.parse(before));
  storage.fail=false;assert.equal(B.game.finishTruckShoot(r).coins,10);assert.equal(B.game.finishTruckShoot(r).err,'dup');
});
test('old saves receive default stats, incomplete rounds and malformed results earn nothing',()=>{
  const {B}=boot();const old=JSON.parse(JSON.stringify(B.store.get()));delete old.truckShoot;B.store.replace(old);
  assert.equal(B.store.get().truckShoot.plays,0);
  for(const r of [{},{runId:'a',phase:'playing',time:50,outcomes:[true]},{runId:'b',phase:'result',time:45,outcomes:['true']}])assert.equal(B.game.finishTruckShoot(r).ok,false);
  assert.equal(B.game.coins(B.store.get()),0);
});
