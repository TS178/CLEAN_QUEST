// ゲームの計算・保存の自動テスト（ブラウザ不要）
//   node --test tests/
// js/ のファイルを そのまま読み込み、localStorage を まねた入れ物で動かす。
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILES = ["config", "items", "trash", "quiz-data", "storage", "game", "badges", "pets"].map((f) => `js/${f}.js`);
const SRC = FILES.map((f) => [f, fs.readFileSync(path.join(ROOT, f), "utf8")]);

function makeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    _map: m,
  };
}
// 1つの「タブ」（同じ localStorage を共有すれば 再読み込み・別タブ を再現できる）
function tab(storage) {
  const window = { addEventListener() {} };
  const ctx = vm.createContext({ window, localStorage: storage, console, crypto: globalThis.crypto, Date, Math, JSON, setTimeout });
  for (const [f, src] of SRC) vm.runInContext(src, ctx, { filename: f });
  const BCT = window.BCT;
  BCT.store.load();
  return BCT;
}
const fresh = () => tab(makeStorage());

function cleanBeach(B) {
  for (const d of [...B.store.get().beach.dirt]) assert.equal(B.game.sortTrash(d.id,B.beachTrashOf(d.kind).bin).ok,true);
}
test('きれいな砂浜の貝2個・シーグラス1個は各5メダルで、別タブや再読み込みで重複しない',()=>{
  const disk=makeStorage(),B=tab(disk);B.game.choosePet('dolphin','いるか','隊',1);
  assert.equal(B.store.get().beach.treasures.length,0);cleanBeach(B);
  const treasures=JSON.parse(JSON.stringify(B.store.get().beach.treasures));
  assert.deepEqual(treasures.map(t=>t.kind),['sakura_shell','sakura_shell','sea_glass']);
  const other=tab(disk),xp=B.game.xp(B.store.get()),sorted=B.store.get().beach.sorted,start=B.game.coins(B.store.get());
  assert.equal(B.game.collectTreasure(treasures[0].id).points,5);
  assert.equal(other.game.collectTreasure(treasures[0].id).err,'gone');
  for(const t of treasures.slice(1))assert.equal(other.game.collectTreasure(t.id).points,5);
  const reload=tab(disk);reload.game.tickBeach();
  assert.equal(reload.store.get().beach.treasures.length,0);
  assert.equal(reload.game.coins(reload.store.get()),start+15);
  assert.equal(reload.game.xp(reload.store.get()),xp);assert.equal(reload.store.get().beach.sorted,sorted);
  const backup=JSON.parse(JSON.stringify(reload.store.get()));reload.store.replace(backup);reload.game.tickBeach();
  assert.equal(reload.store.get().beach.treasures.length,0);
});
test('ゴミの到着で拾い残しを消し、次の掃除で新しい貝を出す。期限切れは加算しない',()=>{
  const B=fresh();B.game.choosePet('turtle','かめ','隊',1);cleanBeach(B);
  const ids=B.store.get().beach.treasures.map(t=>t.id),points=B.store.get().beach.points;
  B.store.transact(s=>{s.beach.last=Date.now()-B.CONFIG.beach.dirtEveryMin*60000-100;return {ok:true};});
  assert.equal(B.game.collectTreasure(ids[0]).err,'dirty');assert.equal(B.store.get().beach.points,points);
  assert.ok(B.game.tickBeach().added>0);assert.equal(B.store.get().beach.treasures.length,0);
  cleanBeach(B);assert.equal(B.store.get().beach.treasures.length,3);
  assert.equal(B.store.get().beach.treasureCycle,2);assert.ok(B.store.get().beach.treasures.every(t=>!ids.includes(t.id)));
});
test('貝の保存失敗は報酬と拾った状態を巻き戻す',()=>{
  const disk=makeStorage(),B=tab(disk);B.game.choosePet('hermit','やど','隊',1);cleanBeach(B);
  const before=JSON.stringify(B.store.get()),id=B.store.get().beach.treasures[0].id;
  disk.setItem=()=>{throw Error('quota');};assert.equal(B.game.collectTreasure(id).err,'save');
  assert.deepEqual(JSON.parse(JSON.stringify(B.store.get())),JSON.parse(before));
});
test('旧版のきれいな保存データには一度だけ追加し、不正な貝データを除外する',()=>{
  const disk=makeStorage(),B=tab(disk);B.game.choosePet('dolphin','いるか','隊',1);cleanBeach(B);
  const old=JSON.parse(JSON.stringify(B.store.get()));delete old.beach.treasures;delete old.beach.treasureCycle;
  B.store.replace(old);assert.equal(B.game.tickBeach().treasures,true);assert.equal(B.store.get().beach.treasures.length,3);
  const ids=JSON.parse(JSON.stringify(B.store.get().beach.treasures));tab(disk).game.tickBeach();assert.deepEqual(JSON.parse(JSON.stringify(tab(disk).store.get().beach.treasures)),ids);
  const bad=JSON.parse(JSON.stringify(B.store.get()));const t=bad.beach.treasures[0];bad.beach.treasures=[t,t,{...t,id:'bad',kind:'unknown'}];
  B.store.replace(bad);assert.equal(B.store.get().beach.treasures.length,1);
  old.beach.last=Date.now()-B.CONFIG.beach.dirtEveryMin*60000-100;B.store.replace(old);B.game.tickBeach();assert.equal(B.store.get().beach.treasures.length,0);
});

test('相棒は順に3匹まで育成でき、経験値・装備・すみかを独立して保存する',()=>{
  const disk=makeStorage(),B=tab(disk),g=B.game,s=()=>B.store.get();
  g.choosePet('dolphin','いるか','探検隊',2);
  assert.equal(g.adoptPet('turtle','かめ').ok,false);
  g.claim('test','first',{xp:1000,coins:10000});
  g.buy('head_crown');g.equip('head','head_crown');g.buy('home_shika_bench');g.placeHome('home_shika_bench',.3,.6);
  const firstXp=g.xp(s()),coins=g.coins(s());
  assert.equal(g.adoptPet('turtle','かめ').ok,true);
  assert.equal(g.xp(s()),0);assert.equal(g.coins(s()),coins);assert.equal(s().equip.head,null);assert.equal(Object.keys(s().habitat).length,0);
  assert.equal(g.adoptPet('hermit','やど').ok,false);
  g.claim('test','second',{xp:1000,coins:10});
  g.equip('head','head_crown');g.placeHome('home_shika_bench',.7,.8);
  assert.equal(g.adoptPet('dolphin','重複').ok,false);
  assert.equal(g.adoptPet('hermit','やど').ok,true);
  assert.equal(g.adoptPet('turtle','重複').ok,false);
  assert.equal(g.selectCompanion('dolphin').ok,true);
  assert.equal(g.xp(s()),firstXp);assert.equal(s().equip.head,'head_crown');assert.equal(s().habitat.home_shika_bench.x,.3);
  assert.equal(g.selectCompanion('turtle').ok,true);assert.equal(s().habitat.home_shika_bench.x,.7);
  const reload=tab(disk);assert.equal(reload.game.companionStates(reload.store.get()).length,3);
  assert.deepEqual(Array.from(reload.store.get().companionOrder),['dolphin','turtle','hermit']);
  const backup=JSON.parse(JSON.stringify(reload.store.get()));assert.equal(reload.store.replace(backup),true);
  assert.equal(reload.game.selectCompanion('hermit').ok,true);assert.equal(reload.game.xp(reload.store.get()),0);
  const food=reload.CONFIG.foods[0];reload.game.buyFood(food.id);reload.game.feed(food.id);
  assert.equal(reload.game.xp(reload.store.get()),food.xp);
  assert.equal(reload.game.selectCompanion('dolphin').ok,true);assert.equal(reload.game.xp(reload.store.get()),firstXp);
});

test('相棒の切替・お迎えは保存失敗時に巻き戻り、不正な相棒データを除外する',()=>{
  const disk=makeStorage(),B=tab(disk);B.game.choosePet('dolphin','いるか','隊',1);B.game.claim('test','unlock',{xp:1000,coins:200});
  const before=JSON.stringify(B.store.get()),write=disk.setItem;disk.setItem=()=>{throw Error('quota');};
  assert.equal(B.game.adoptPet('turtle','かめ').err,'save');assert.equal(JSON.stringify(B.store.get()),before);
  disk.setItem=write;B.game.adoptPet('turtle','かめ');
  const two=JSON.stringify(B.store.get());disk.setItem=()=>{throw Error('quota');};assert.equal(B.game.selectCompanion('dolphin').err,'save');assert.deepEqual(JSON.parse(JSON.stringify(B.store.get())),JSON.parse(two));
  disk.setItem=write;
  const bad=JSON.parse(two);bad.companions.hermit={pet:{type:'hermit',name:'不正'},petXp:'1000'};bad.companionOrder=['turtle','turtle','dragon','hermit'];
  B.store.replace(bad);assert.equal(B.game.companionStates(B.store.get()).length,2);
});
// vm の中で作った配列・オブジェクトは「生まれ」が違うので、中身だけ比べる
const eq = (a, b, m) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b, m);
const giveCoins = (B, n) => {
  // テスト用に クイズ報酬を 使って コインを ためる（20枚ずつ）
  let i = 0;
  while (B.game.coins(B.store.get()) < n) B.game.claim("quiz", "q" + String(++i).padStart(2, "0"));
};

test("紙くずを引き継ぎ、ロープをもえるゴミへ分別できる", () => {
  const storage = makeStorage(), B = tab(storage);
  B.game.choosePet('dolphin', 'テスト', 'たい', 1);
  B.store.transact(s => {
    s.beach = {dirt: [{id:'old-paper',kind:'b_paper',x:.2,y:.3},{id:'rope',kind:'b_rope',x:.6,y:.4}],last:Date.now(),points:35,sorted:7,cleans:2,invited:true};
  });
  const reloaded = tab(storage), before = reloaded.store.get();
  eq(before.beach.dirt.map(d=>[d.id,d.kind,d.x,d.y]), [['old-paper','b_wood',.2,.3],['rope','b_rope',.6,.4]]);
  eq([before.beach.points,before.beach.sorted,before.beach.cleans], [35,7,2]);
  assert.equal(reloaded.BEACH_TRASH.length,6);
  assert.ok(!reloaded.BEACH_TRASH.some(t=>t.key==='b_paper'));
  assert.equal(reloaded.game.sortTrash('rope','plastic').err,'wrong');
  assert.equal(reloaded.game.sortTrash('rope','burn').ok,true);
  assert.equal(reloaded.game.sortTrash('old-paper','burn').ok,true);
});

test("アイテムは40種類（ショップ25＋すみか12＋達成報酬3）、1匹に見えるショップ商品は25種類", () => {
  const B = fresh();
  assert.equal(B.ITEMS.length, 40);
  assert.equal(B.ITEMS.filter((i) => i.shop).length, 37);
  assert.equal(B.ITEMS.filter((i) => i.reward).length, 3);
  assert.equal(B.ITEMS.filter((i) => i.slot === "home").length, 12);
  assert.equal(new Set(B.ITEMS.map((i) => i.id)).size, 40, "IDが重複していない");
  for (const t of ["dolphin", "turtle", "hermit"]) {
    B.game.choosePet(t, "テスト", "たい", 0);
    const items = B.game.shopItems(B.store.get());
    assert.equal(items.length, 25, t);
    assert.equal(items.filter((i) => i.slot === "home").length, 6, "すみかは 専用3つ＋共通3つ");
    assert.ok(items.every((i) => !i.only || i.only === t), "ほかの種類の専用品が出ない");
  }
});

test("志賀町の共通置物は全種類で購入・配置・再読込でき、専用家具だけ種類変更でしまわれる", () => {
  for (const type of ["dolphin", "turtle", "hermit"]) {
    const storage = makeStorage(), B = tab(storage);
    B.game.choosePet(type, "テスト", "たい", 0);
    const ids = ["home_shika_lighthouse", "home_shika_bench", "home_shika_ganmon"];
    assert.equal(B.game.buy(ids[0]).err, "coins");
    assert.equal(B.game.placeHome(ids[0], .2, .3).err, "notowned");
    giveCoins(B, 500);
    for (const id of ids) {
      const before = B.game.coins(B.store.get());
      assert.equal(B.game.buy(id).ok, true);
      assert.equal(B.game.coins(B.store.get()), before - B.itemOf(id).price);
      assert.equal(B.game.buy(id).err, "owned");
      assert.equal(B.game.coins(B.store.get()), before - B.itemOf(id).price);
      assert.equal(B.game.placeHome(id, .25, .65).ok, true);
    }
    const dedicated = B.ITEMS.find(it => it.slot === "home" && it.only === type);
    B.game.buy(dedicated.id);
    B.game.placeHome(dedicated.id, .7, .8);
    const R = tab(storage);
    for (const id of ids) eq(R.store.get().habitat[id], {x:.25,y:.65});
    R.game.choosePet(type === "dolphin" ? "turtle" : "dolphin", "テスト", "たい", 0);
    assert.equal(R.store.get().habitat[dedicated.id], undefined);
    assert.equal(R.game.placeHome(dedicated.id, .5, .5).err, "species");
    for (const id of ids) eq(tab(storage).store.get().habitat[id], {x:.25,y:.65});
    assert.equal(R.game.removeHome(ids[0]).ok, true);
    assert.equal(tab(storage).store.get().habitat[ids[0]], undefined);
  }
});

test("ペンダントと花飾りは旧購入情報を継承し、ころ柿ポシェットも装着状態を保存できる", () => {
  const storage = makeStorage(), B = tab(storage);
  B.game.choosePet("dolphin", "テスト", "たい", 0);
  B.store.transact(s => {
    s.owned.accessory_pendant = {t:123,price:40,via:"shop"};
    s.owned.head_flower = {t:124,price:20,via:"shop"};
    s.equip.acc = "accessory_pendant"; s.equip.head = "head_flower";
  });
  const R = tab(storage);
  assert.equal(R.itemOf(R.store.get().equip.acc).name.replaceAll('\u200b',''), "さくらがいのペンダント");
  assert.equal(R.itemOf(R.store.get().equip.head).name, "ハマナスの はなかざり");
  assert.equal(R.store.get().owned.accessory_pendant.t, 123);
  giveCoins(R, 60);
  assert.equal(R.game.buy("accessory_korogaki").ok, true);
  assert.equal(R.game.equip("acc", "accessory_korogaki").ok, true);
  assert.equal(tab(storage).store.get().equip.acc, "accessory_korogaki");
  assert.equal(R.game.equip("head", "accessory_korogaki").err, "slot");
});

test("レベルは累計けいけんちから計算し、1回で複数レベルをこえても最後まで進む", () => {
  const B = fresh();
  const g = B.game;
  // イベント用の配分：60 / 150 / 280 / 450
  eq([0, 59, 60, 149, 150, 279, 280, 449, 450, 9999].map(g.levelOf), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  eq([1, 2, 3, 4, 5].map(g.stageOf), [1, 1, 2, 2, 3]);
  assert.equal(g.progressOf(100).rest, 50);
  assert.equal(g.progressOf(450).ratio, 1);
  g.choosePet("turtle", "かめ", "たい", 2);
  const r = g.claim("quiz", "big", { xp: 300, coins: 0 });
  assert.equal(r.lvBefore, 1);
  assert.equal(r.lvAfter, 4, "Lv1→Lv4 に一気に進む");
  assert.equal(g.level(B.store.get()), 4);
  assert.equal(g.stage(B.store.get()), 2);
});

test("はじめの ようせい選択で 赤いリボンを1回だけ無料でもらえる", () => {
  const B = fresh();
  const r1 = B.game.choosePet("hermit", "やど", "たい", 3);
  assert.equal(r1.gift, true);
  const s = B.store.get();
  assert.equal(s.owned.accessory_ribbon.via, "gift");
  assert.equal(s.equip.acc, "accessory_ribbon");
  assert.equal(B.game.coins(s), 0, "無料なのでコインは減らない");
  const r2 = B.game.choosePet("hermit", "やど2", "たい", 3);
  assert.equal(r2.gift, false, "2回目は配らない");
  assert.equal(B.game.buy("accessory_ribbon").err, "owned");
});

test("ミッション報酬は 連打・再読み込み・別タブでも1回だけ", () => {
  const storage = makeStorage();
  const A = tab(storage);
  A.game.choosePet("dolphin", "いるか", "たい", 1);
  assert.equal(A.game.claim("quiz", "q01").ok, true);
  assert.equal(A.game.claim("quiz", "q01").err, "dup", "連打");
  assert.equal(A.game.xp(A.store.get()), 0, "クイズは ポイントだけ（けいけんちは エサ）");
  assert.equal(A.game.coins(A.store.get()), 20);
  // 再読み込み
  const A2 = tab(storage);
  assert.equal(A2.game.coins(A2.store.get()), 20);
  assert.equal(A2.game.claim("quiz", "q01").err, "dup");
  // 別タブ：B は 古い状態を持っているが、保存の直前に読み直すので 二重にならない
  const B = tab(storage);
  assert.equal(A2.game.claim("clean", "pet").ok, true);
  assert.equal(B.game.claim("clean", "pet").err, "dup");
  const C = tab(storage);
  assert.equal(C.game.xp(C.store.get()), 0);
  assert.equal(C.game.coins(C.store.get()), 40);
});

test("イベントIDが変わると 同じミッションでも 新しく報酬がもらえる（同じイベントでは1回）", () => {
  const B = fresh();
  B.game.choosePet("turtle", "かめ", "たい", 1);
  assert.equal(B.game.claim("clean", "can").ok, true);
  B.CONFIG.event.id = "next-event";
  assert.equal(B.game.claim("clean", "can").ok, true);
  assert.equal(B.game.claim("clean", "can").err, "dup");
  assert.equal(B.game.coins(B.store.get()), 40);
});

test("購入：残高不足・再購入・ほかの種類の専用品・非売品を防ぎ、コインは1回だけ減る", () => {
  const B = fresh();
  const g = B.game;
  g.choosePet("turtle", "かめ", "たい", 1);
  const r0 = g.buy("head_flower");
  assert.equal(r0.err, "coins");
  assert.equal(r0.need, 20);
  giveCoins(B, 100);
  const before = g.coins(B.store.get());
  assert.equal(g.buy("head_flower").ok, true);
  assert.equal(g.coins(B.store.get()), before - 20);
  assert.equal(g.buy("head_flower").err, "owned", "再購入できない");
  assert.equal(g.coins(B.store.get()), before - 20, "2回目で減らない");
  assert.equal(g.buy("dolphin_star").err, "species", "イルカ専用はウミガメでは買えない");
  assert.equal(g.buy("reward_clean_hat").err, "notforsale");
  assert.equal(g.buy("nothing").err, "unknown");
  assert.equal(g.buy("turtle_wave").ok, true);
  const after = g.coins(B.store.get());
  assert.ok(after >= 0);
  const r = g.buy("head_crown");
  if (after < 100) assert.equal(r.err, "coins");
});

test("通常の参加で 頭40＋専用60＋おもちゃ60＋フレーム20＝180コイン の組み合わせが買える", () => {
  const B = fresh();
  const g = B.game;
  g.choosePet("dolphin", "いるか", "たい", 1);
  // クイズ6問＋そうじ3しゅるい（＝180コイン）
  ["q01", "q02", "q03", "q04", "q05", "q06"].forEach((q) => g.claim("quiz", q));
  ["pet", "can", "wood"].forEach((t) => g.claim("clean", t));
  assert.equal(g.coins(B.store.get()), 180);
  for (const id of ["head_straw", "dolphin_wave", "toy_ball", "frame_wave"]) assert.equal(g.buy(id).ok, true, id);
  assert.equal(g.coins(B.store.get()), 0);
});

test("装着：もっていない物・おもちゃ・ほかの種類の専用品は つけられない。枠ごとに1つ", () => {
  const B = fresh();
  const g = B.game;
  g.choosePet("hermit", "やど", "たい", 1);
  assert.equal(g.equip("head", "head_straw").err, "notowned");
  giveCoins(B, 200);
  g.buy("head_straw");
  g.buy("head_flower");
  g.buy("hermit_dot");
  g.buy("toy_ball");
  assert.equal(g.equip("head", "head_straw").ok, true);
  assert.equal(g.equip("head", "head_flower").ok, true);
  assert.equal(B.store.get().equip.head, "head_flower", "頭は1つだけ");
  assert.equal(g.equip("look", "hermit_dot").ok, true);
  assert.equal(g.equip("toy", "toy_ball").err, "slot");
  assert.equal(g.equip("acc", "head_straw").err, "slot");
  assert.equal(g.equip("head", null).ok, true);
  assert.equal(B.store.get().equip.head, null);
});

test("成長しても 買った物と装着は そのまま", () => {
  const B = fresh();
  const g = B.game;
  g.choosePet("dolphin", "いるか", "たい", 1);
  giveCoins(B, 60);
  g.buy("dolphin_star");
  g.equip("look", "dolphin_star");
  g.claim("quiz", "grow", { xp: 500, coins: 0 });
  const s = B.store.get();
  assert.equal(g.level(s), 5);
  assert.equal(s.equip.look, "dolphin_star");
  assert.equal(s.equip.acc, "accessory_ribbon");
});

test("なでる：5回で1だん、最大3だん。経験値・コインは出ない", () => {
  const B = fresh();
  const g = B.game;
  g.choosePet("turtle", "かめ", "たい", 1);
  const ups = [];
  for (let i = 0; i < 20; i++) {
    const r = g.pet();
    if (r.stageUp) ups.push(i + 1);
  }
  eq(ups, [5, 10, 15]);
  const a = g.affection(B.store.get());
  assert.equal(a.stage, 3);
  assert.equal(a.max, true);
  assert.equal(B.store.get().affection, 15, "上限で止まる");
  assert.equal(g.xp(B.store.get()), 0);
  assert.equal(g.coins(B.store.get()), 0);
});

test("おもちゃ：もっていないと遊べない。同じおもちゃで3回遊ぶとポーズを1回だけ覚える", () => {
  const B = fresh();
  const g = B.game;
  g.choosePet("dolphin", "いるか", "たい", 1);
  assert.equal(g.playToy("toy_ball").err, "notowned");
  eq(g.poses(B.store.get()), ["normal", "smile"]);
  giveCoins(B, 120);
  g.buy("toy_ball");
  g.buy("toy_bubbles");
  const unlocked = [1, 2, 3, 4].map(() => g.playToy("toy_ball").unlocked);
  eq(unlocked, [null, null, "toy_ball", null]);
  g.playToy("toy_bubbles");
  eq(g.poses(B.store.get()), ["normal", "smile", "toy_ball"], "2回しか遊んでいない泡は まだ");
  const coins = g.coins(B.store.get());
  g.playToy("toy_bubbles");
  assert.equal(g.coins(B.store.get()), coins, "遊んでもコインは変わらない");
});

test("達成報酬：おそうじたいの帽子・まもりてメダル・イベント記念フレームを条件どおり1回だけ", () => {
  const B = fresh();
  const g = B.game;
  g.choosePet("turtle", "かめ", "たい", 1);
  eq(g.grantAchievements(), []);
  g.claim("clean", "pet");
  eq(g.grantAchievements(), ["reward_clean_hat"]);
  eq(g.grantAchievements(), [], "2回目はない");
  for (let i = 1; i <= 9; i++) g.claim("quiz", B.QUIZ[i - 1].id);
  eq(g.grantAchievements(), [], "クイズだけでは Lv5 に ならない・クイズは まだ9問");
  g.claim("quiz", "zz-xp", { xp: 450, coins: 0 });
  eq(g.grantAchievements(), ["reward_guardian_medal"], "けいけんち450で Lv5");
  g.claim("quiz", B.QUIZ[9].id);
  eq(g.grantAchievements(), ["reward_event_frame"]);
  assert.equal(B.store.get().owned.reward_event_frame.via, "reward");
  assert.equal(g.coins(B.store.get()), 220, "達成報酬で ポイントは 減らない");
});

test("称号は1回だけ。クイズまんてん賞は うみクイズ15問 ぜんぶ 正解で もらえる（5問 つづけて 正解では もらえない）", () => {
  const B = fresh();
  B.game.choosePet("hermit", "やど", "たい", 1);
  assert.equal(B.QUIZ.length, 15);
  // 5問 つづけて 正解しても まだ
  B.QUIZ.slice(0, 5).forEach((q) => { B.game.quizAnswered(true); B.game.claim("quiz", q.id); });
  assert.ok(!B.checkBadges().some((b) => b.id === "perfect"), "5問では もらえない");
  // まちがえても ときなおして 14問 → まだ
  B.game.quizAnswered(false);
  B.QUIZ.slice(5, 14).forEach((q) => { B.game.quizAnswered(true); B.game.claim("quiz", q.id); });
  assert.ok(!B.checkBadges().some((b) => b.id === "perfect"), "14問では もらえない");
  assert.equal(B.badgeOf("perfect").prog(B.store.get()), "14 / 15");
  // 15問め
  B.game.claim("quiz", B.QUIZ[14].id);
  const got = B.checkBadges().map((b) => b.id);
  assert.ok(got.includes("perfect"));
  eq(B.checkBadges(), []);
});

test("こわれた保存データでも止まらない", () => {
  const storage = makeStorage();
  storage.setItem("bct-state", "{こわれた");
  const B = tab(storage);
  assert.equal(B.store.get().pet, null);
  assert.equal(storage.getItem("bct-state-broken"), "{こわれた", "控えを残す");
  // 中身がおかしい
  storage.setItem("bct-state", JSON.stringify({
    v: 2, pet: { type: "shark", name: "x" }, claims: { "a:quiz:q1": { xp: -50, coins: "100" }, bad: 3 },
    owned: { head_crown: { via: "shop", price: -5 }, nothing: {} }, equip: { head: "head_crown", acc: "head_flower", look: "turtle_star" },
    affection: "many", records: [{ type: "pet", lat: "x" }, 5], badges: "no",
  }));
  const C = tab(storage);
  const s = C.store.get();
  assert.equal(s.pet, null, "知らない種類は消える");
  assert.equal(C.game.xp(s), 0, "マイナスは0");
  assert.equal(C.game.coins(s), 0, "文字のコインは0、マイナスの値段は0");
  eq(Object.keys(s.owned), ["head_crown"]);
  assert.equal(s.equip.head, "head_crown");
  assert.equal(s.equip.acc, null, "持っていない物は外す");
  assert.equal(s.equip.look, null);
  assert.equal(s.records.length, 1);
  assert.equal(s.records[0].lat, null);
  eq(s.badges, []);
});

test("名前は文字として保存し、長さを制限する", () => {
  const B = fresh();
  B.game.choosePet("dolphin", "<img src=x onerror=alert(1)>", "たい", 1);
  const s = B.store.sanitize(JSON.parse(JSON.stringify(B.store.get())));
  assert.equal(s.pet.name, "<img src=x o", "12文字まで（表示は textContent / esc() で行う）");
});

test("前の版（クリーンPt方式）の保存データを引き継ぐ", () => {
  const storage = makeStorage();
  storage.setItem("bct-state-v1", JSON.stringify({
    v: 1, id: "olddevice", pet: { type: "turtle", name: "かめきち" }, team: { name: "うみたい", members: 3 },
    pt: 999, lv: 5, quiz: { correct: ["q01", "q02", "q03"], tries: 1, perfect: 1 },
    records: [{ id: "r1", t: 1, type: "pet" }, { id: "r2", t: 2, type: "pet" }, { id: "r3", t: 3, type: "bin" }],
    badges: [{ id: "first", t: 1 }],
  }));
  const B = tab(storage);
  const s = B.store.get();
  assert.equal(s.v, 2);
  assert.equal(s.id, "olddevice");
  assert.equal(s.pet.name, "かめきち");
  assert.equal(B.game.quizCleared(s), 3);
  assert.equal(B.game.cleanCleared(s), 1, "ペットボトルだけ（びんは報酬の対象外）");
  assert.equal(B.game.xp(s), 0, "いまの ルールでは クイズ・そうじは ポイントだけ");
  assert.equal(B.game.coins(s), 80);
  assert.equal(s.seenLv, 1);
  assert.equal(s.quiz.best, 5);
  assert.equal(s.owned.accessory_ribbon.via, "gift");
  assert.equal(s.records.length, 3);
});

test("びんは そうじミッション（報酬）の対象外", () => {
  const B = fresh();
  assert.ok(!B.CLEAN_MISSIONS.some((t) => t.key === "bin"));
  assert.ok(B.CLEAN_MISSIONS.some((t) => t.key === "float"));
});

// ---------------- エサ・お掃除・すみか（追加仕様） ----------------
test("クイズを ぜんぶ 解いて エサに かえても、それだけでは 最終進化しない", () => {
  const B = fresh();
  const g = B.game;
  g.choosePet("dolphin", "いるか", "たい", 1);
  B.QUIZ.forEach((q) => g.claim("quiz", q.id));
  const pts = g.coins(B.store.get());
  assert.equal(pts, 300);
  // いちばん おとくな レインボーで けいけんちに かえる
  while (g.buyFood("drop_rainbow").ok) g.feed("drop_rainbow");
  while (g.buyFood("drop_blue").ok) g.feed("drop_blue");
  const s = B.store.get();
  assert.ok(g.level(s) < g.maxLevel(), `Lv${g.level(s)} けいけんち${g.xp(s)}`);
  assert.ok(g.stage(s) < 3, "最終進化は まだ");
});

test("エサ：ポイントで かい（たりないと かえない）、あげると けいけんち。もっていないと あげられない", () => {
  const B = fresh();
  const g = B.game;
  g.choosePet("turtle", "かめ", "たい", 1);
  assert.equal(g.feed("drop_blue").err, "empty");
  assert.equal(g.buyFood("drop_blue").err, "coins");
  giveCoins(B, 200);
  const before = g.coins(B.store.get());
  const r = g.buyFood("drop_blue", 3);
  assert.equal(r.ok, true);
  assert.equal(r.stock, 3);
  assert.equal(g.coins(B.store.get()), before - 30, "10ポイント × 3");
  assert.equal(g.buyFood("drop_green").ok, true);
  assert.equal(g.coins(B.store.get()), before - 70);
  assert.equal(g.feed("drop_blue").xp, 10);
  assert.equal(g.feed("drop_green").xp, 50);
  const s = B.store.get();
  assert.equal(g.xp(s), 60);
  assert.equal(g.foodStock(s, "drop_blue"), 2);
  assert.equal(g.foodStock(s, "drop_green"), 0);
  assert.equal(g.feed("drop_green").err, "empty");
  assert.equal(g.buyFood("nothing").err, "unknown");
});

test("エサは 1回で 複数レベルを こえても 正しく 進む（レインボー＝200）", () => {
  const B = fresh();
  const g = B.game;
  g.choosePet("hermit", "やど", "たい", 1);
  giveCoins(B, 280);
  g.buyFood("drop_rainbow");
  const r = g.feed("drop_rainbow");
  assert.equal(r.lvBefore, 1);
  assert.equal(r.lvAfter, 3, "0 → 200 で Lv3（進化1）");
  assert.equal(g.stage(B.store.get()), 2);
});

test("ビーチ：はじめは よごれ度1。時間が たつと よごれ、よごれ度3 で とまる", () => {
  const B = fresh();
  const g = B.game;
  g.choosePet("dolphin", "いるか", "たい", 1);
  let s = B.store.get();
  assert.equal(s.beach.dirt.length, 3);
  assert.equal(g.dirtLevel(s), 1);
  const t0 = s.beach.last;
  const every = B.CONFIG.beach.dirtEveryMin * 60000;
  assert.equal(g.tickBeach(t0 + every - 1).err, "notyet");
  assert.equal(g.tickBeach(t0 + every).added, 3);
  assert.equal(g.dirtLevel(B.store.get()), 2);
  // アプリを とじていた あいだの分も まとめて（ただし 3まで）
  g.tickBeach(t0 + every * 10);
  s = B.store.get();
  assert.equal(s.beach.dirt.length, 9);
  assert.equal(g.dirtLevel(s), 3);
  assert.equal(g.tickBeach(t0 + every * 20).added, 0, "3より ふえない");
});

test("分別：正しい ゴミばこなら ポイント、まちがえても へらない。ぜんぶ きれいで はじめてなら クイズへ さそう", () => {
  const B = fresh();
  const g = B.game;
  g.choosePet("turtle", "かめ", "たい", 1);
  const dirt = B.store.get().beach.dirt.map((d) => ({ ...d }));
  const binOf = (d) => B.beachTrashOf(d.kind).bin;
  const wrongBin = (d) => B.BINS.find((b) => b.key !== binOf(d)).key;
  const w = g.sortTrash(dirt[0].id, wrongBin(dirt[0]));
  assert.equal(w.err, "wrong");
  assert.equal(w.bin, binOf(dirt[0]), "正しい ゴミばこを おしえる");
  assert.equal(g.coins(B.store.get()), 0, "まちがえても へらない");
  assert.equal(B.store.get().beach.dirt.length, 3);
  let last;
  for (const d of dirt) last = g.sortTrash(d.id, binOf(d));
  assert.equal(last.cleaned, true);
  assert.equal(last.first, true, "はじめて きれいに → クイズへ さそう");
  assert.equal(g.coins(B.store.get()), 15, "5ポイント × 3");
  assert.equal(g.xp(B.store.get()), 0, "お掃除は ポイントだけ");
  assert.equal(g.sortTrash(dirt[0].id, binOf(dirt[0])).err, "gone", "同じ ゴミは 2回 すてられない");
  // 2回目に きれいに しても さそわない
  const every = B.CONFIG.beach.dirtEveryMin * 60000;
  g.tickBeach(B.store.get().beach.last + every);
  for (const d of B.store.get().beach.dirt.map((x) => ({ ...x }))) last = g.sortTrash(d.id, binOf(d));
  assert.equal(last.cleaned, true);
  assert.equal(last.first, false);
  assert.equal(B.store.get().beach.cleans, 2);
});

test("ビーチの ゴミは 別タブで 同時に すてても 1回だけ ポイント", () => {
  const storage = makeStorage();
  const A = tab(storage);
  A.game.choosePet("dolphin", "いるか", "たい", 1);
  const d = A.store.get().beach.dirt[0];
  const bin = A.beachTrashOf(d.kind).bin;
  const Bt = tab(storage);
  assert.equal(A.game.sortTrash(d.id, bin).ok, true);
  assert.equal(Bt.game.sortTrash(d.id, bin).err, "gone");
  assert.equal(tab(storage).game.coins(tab(storage).store.get()), 5);
});

test("すみか：じぶんの ようせいの アイテムだけ かえて、もっている物だけ おける", () => {
  const B = fresh();
  const g = B.game;
  g.choosePet("hermit", "やど", "たい", 1);
  assert.equal(g.buy("home_dolphin_ring").err, "species");
  assert.equal(g.placeHome("home_hermit_house", 0.5, 0.5).err, "notowned");
  giveCoins(B, 100);
  assert.equal(g.buy("home_hermit_house").ok, true);
  assert.equal(g.placeHome("home_hermit_house", 0.3, 2).ok, true);
  eq(B.store.get().habitat.home_hermit_house, { x: 0.3, y: 0.95 });
  assert.equal(g.placeHome("head_straw", 0.5, 0.5).err, "slot");
  assert.equal(g.removeHome("home_hermit_house").ok, true);
  assert.equal(B.store.get().habitat.home_hermit_house, undefined);
  assert.equal(g.equip("head", "home_hermit_house").err, "slot", "すみかの アイテムは 身に つけない");
});

test("配分の 切りかえ：長く遊ぶ 配分では 最終進化に もっと けいけんちが 要る", () => {
  const B = fresh();
  const P = B.CONFIG.PACES;
  assert.ok(P.long.levels[4] > P.event.levels[4] * 2);
  assert.ok(P.long.dirtEveryMin > P.event.dirtEveryMin);
  assert.equal(B.CONFIG.levels, P[B.CONFIG.pace].levels);
});

test("こわれた エサ・ビーチ・すみか の データでも 止まらない", () => {
  const storage = makeStorage();
  storage.setItem("bct-state", JSON.stringify({
    v: 2, pet: { type: "turtle", name: "x" },
    food: { drop_blue: { bought: 2, fed: 9, spent: -5, xp: "a" }, nothing: { bought: 1 } },
    beach: { dirt: [{ kind: "b_can", x: 9, y: -1 }, { kind: "???" }, 3], points: -10, last: "x" },
    habitat: { home_turtle_bed: { x: 0.5, y: 0.5 }, home_dolphin_ring: { x: 0.1, y: 0.1 } },
  }));
  const B = tab(storage);
  const s = B.store.get();
  eq(s.food, { drop_blue: { bought: 2, fed: 2, spent: 0, xp: 0 } });
  assert.equal(s.beach.dirt.length, 1);
  assert.equal(s.beach.dirt[0].x, 1);
  assert.equal(s.beach.points, 0);
  eq(s.habitat, {}, "もっていない すみかの アイテムは おけない");
});
