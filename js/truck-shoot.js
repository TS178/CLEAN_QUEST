/* Mission minigame lifecycle. The in-memory round survives navigation; hide always pauses it. */
(function () {
  const B=window.BCT,P=B.truckPhysics,C=P.C,$=B.$;
  let round=null,view=null,raf=0,last=0,abort=null,pointer=null,pausedPhase=null,paid=false,saving=false,audio=null,modalObserver=null;
  let muted=true,petMood='',petArt={};
  const active=()=>B.ui.current()==='truck-shoot';
  const uid=()=>window.crypto?.randomUUID?.() || Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  function sound(hit) {
    if(muted||!audio)return;
    try {
      const at=audio.currentTime;
      [hit?660:180,hit?880:125].forEach((hz,i)=>{
        const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.value=hz;
        g.gain.setValueAtTime(.0001,at+i*.09);g.gain.exponentialRampToValueAtTime(.09,at+i*.09+.01);g.gain.exponentialRampToValueAtTime(.0001,at+i*.09+.17);
        o.connect(g);g.connect(audio.destination);o.start(at+i*.09);o.stop(at+i*.09+.18);
      });
    }catch(e){/* Sound is optional. */}
  }
  function unlockSound(){
    if(muted)return;
    try {const Audio=window.AudioContext||window.webkitAudioContext;if(!audio&&Audio)audio=new Audio();audio?.resume().catch(()=>{});}catch(e){/* silent */}
  }
  function cancelAim(){pointer=null;if(round)round.aim=null;}
  function paint(){
    if(!view||!round||!active())return;
    const r=P.result(round.outcomes);
    view.draw(round,B.ui.reducedMotion());
    $('tsTime').textContent=Math.max(0,Math.ceil(C.duration-round.time));
    $('tsTime').classList.toggle('urgent',round.time>=35);
    $('tsScore').textContent=r.score;$('tsCombo').textContent=r.combo;
    const f=round.feedback,mood=round.aim?'aim':f&&round.time-f.at<1.1?(f.ok?'hit':'miss'):'idle';
    if(mood!==petMood){petMood=mood;$('tsPet').dataset.mood=mood;$('tsPet').innerHTML=petArt[mood==='hit'?'happy':'normal'];}
    $('tsPause').disabled=!['playing','settling'].includes(round.phase);
  }
  function process(dt){
    const events=P.advance(round,dt);
    for(const event of events){
      if(event==='hit'||event==='miss'){sound(event==='hit');$('tsLive').textContent=event==='hit'?`やった！ ${P.result(round.outcomes).combo} れんぞく せいこう`:'おしい！ ゴミは はまべで かいしゅうしたよ';}
      if(event==='end'){cancelAim();resultPanel();}
    }
    if(round.phase==='settling'){$('tsLive').textContent='さいごの シュートを みまもろう';cancelAim();}
  }
  function tick(now){
    raf=0;if(!active()||!['playing','settling'].includes(round?.phase))return;
    process(Math.max(0,(now-last)/1000));last=now;paint();
    if(['playing','settling'].includes(round.phase))raf=requestAnimationFrame(tick);
  }
  function resume(){
    if(document.hidden)return;
    round.phase=pausedPhase||'playing';pausedPhase=null;
    $('tsOverlay').hidden=true;last=performance.now();unlockSound();cancelAnimationFrame(raf);raf=requestAnimationFrame(tick);paint();
  }
  function pause(){
    if(!round||!['playing','settling'].includes(round.phase))return;
    cancelAnimationFrame(raf);raf=0;cancelAim();pausedPhase=round.phase;round.phase='paused';
    if(active()){pausePanel();paint();}
  }
  function panel(html){$('tsOverlay').hidden=false;$('tsOverlay').innerHTML=`<div class="truck-panel">${html}</div>`;}
  function readyPanel(){
    panel(`<div class="truck-eyebrow">BEACH CLEAN CHALLENGE</div><h2>ゴミしゅうしゅうしゃ<br>シュート！</h2><p>ゴミを <b>したに ひっぱって</b> はなそう。<br>りくを はしる くるまの <b>あな</b>が ゴール！</p><p>45びょうで はまべを きれいにしよう。<br>★3 は <b>1,200てん ＋ ミスなし</b></p><button class="btn block mint" id="tsStart">あそぶ！</button><p class="truck-note">★1：10枚 ／ ★2：25枚 ／ ★3：50枚<br>れんぞく せいこうで ボーナスも！</p>`);
    $('tsStart').onclick=()=>{round.phase='playing';resume();};
  }
  function pausePanel(){
    panel('<div class="truck-eyebrow">TAKE A BREAK</div><h2>ひとやすみ</h2><p>じかんは とまっているよ。</p><button class="btn block mint" id="tsResume">つづきから あそぶ</button><button class="btn block ghost" id="tsQuit">このゲームを やめる</button>');
    $('tsResume').onclick=resume;
    $('tsQuit').onclick=()=>{round=null;pausedPhase=null;B.ui.show('mission');};
  }
  function resultPanel(){
    const r=P.result(round.outcomes);
    panel(`<div class="truck-eyebrow">BEACH CLEAN COMPLETE</div><div class="truck-stars" aria-label="ほし ${r.stars}こ">${'★'.repeat(r.stars)}${'☆'.repeat(3-r.stars)}</div><h2>${r.stars===3?'パーフェクト！':r.stars?'はまべが きれいに！':'また チャレンジしよう！'}</h2><div class="truck-result-score">${r.score}<small> てん</small></div><p>かいしゅう ${r.hits}こ ／ ミス ${r.misses}かい<br>さいこう ${r.maxCombo}コンボ</p><div class="truck-box" id="tsRewardBox" aria-label="リサイクルボックス">♻</div><p><b>${B.medal.amount(r.coins,'+')}枚</b><br>ごほうび ${r.baseCoins}枚 ＋ コンボ ${r.bonus}枚</p><p id="tsSave" class="truck-save" role="status"></p><button class="btn block mint" id="tsAgain" disabled>もういちど あそぶ</button><button class="btn block ghost" id="tsResultBack">ミッションへ</button>`);
    $('tsAgain').onclick=()=>{round=P.create(uid());paid=false;petMood='';$('tsLive').textContent='ゴミを したに ひっぱって はなそう';readyPanel();paint();};
    $('tsResultBack').onclick=()=>B.ui.show('mission');
    if(paid){$('tsSave').textContent='ごほうびは ほぞんずみ！';$('tsAgain').disabled=false;}else saveReward();
  }
  async function saveReward(){
    if(saving||paid)return;
    saving=true;const target=round;
    if(active())$('tsSave').textContent='ごほうびを ほぞんちゅう…';
    let result;
    const commit=()=>{
      if(active()&&$('tsRewardBox'))B.coinFly?.from($('tsRewardBox'));
      return B.game.finishTruckShoot(target);
    };
    try { result=navigator.locks?await navigator.locks.request('bct-truck-reward',commit):commit(); }
    catch(e){result={ok:false,err:'save'};}
    saving=false;
    if(round!==target)return;
    paid=result.ok||result.err==='dup';
    if(!active())return;
    if(paid){$('tsSave').textContent='ごほうびは ほぞんずみ！';$('tsAgain').disabled=false;}
    else {$('tsSave').innerHTML='ほぞん できなかったよ。<button class="btn small ghost" id="tsRetry">もういちど ほぞん</button>';$('tsRetry').onclick=saveReward;}
  }
  function mount(){
    document.body.classList.add('truck-game');
    abort?.abort();modalObserver?.disconnect();abort=new AbortController();const opt={signal:abort.signal};
    if(!round){round=P.create(uid());paid=false;pausedPhase=null;}
    const state=B.store.get();
    petArt={normal:B.art.render({type:state.pet?.type||'dolphin',stage:B.game.stage(state),equip:state.equip,motion:false}),happy:B.art.render({type:state.pet?.type||'dolphin',stage:B.game.stage(state),equip:state.equip,pose:'smile',motion:false})};
    petMood='';
    $('truckShootBody').innerHTML=`<div class="truck-shell"><div class="truck-toolbar"><button class="btn small ghost" id="tsBack">← ミッション</button><button class="btn small ghost" id="tsSound" aria-pressed="${!muted}">おと ${muted?'OFF':'ON'}</button><button class="btn small ghost" id="tsPause">ひとやすみ</button></div><div class="truck-hud"><div><span>のこり</span><b id="tsTime">45</b><small>びょう</small></div><div><span>スコア</span><b id="tsScore">0</b></div><div><span>コンボ</span><b id="tsCombo">0</b></div></div><div class="truck-stage"><canvas id="tsCanvas" width="360" height="520" tabindex="0" aria-label="ゴミを下にドラッグして離すと発射。キーボードは左右キーで方向、上下キーで強さを調整しスペースで発射。"></canvas><div class="truck-pet" id="tsPet" aria-hidden="true"></div><div class="truck-overlay" id="tsOverlay"></div></div><div class="truck-live" id="tsLive" role="status">ゴミを したに ひっぱって はなそう</div><p class="truck-note">ゲームの なかだけで シュートしてね。<br>ほんとうの ゴミは なげずに、ゴミばこへ。</p></div>`;
    view=B.truckView.create($('tsCanvas'));
    $('tsBack').onclick=()=>B.ui.show('mission');$('tsPause').onclick=pause;
    $('tsSound').onclick=()=>{muted=!muted;unlockSound();$('tsSound').textContent=`おと ${muted?'OFF':'ON'}`;$('tsSound').setAttribute('aria-pressed',String(!muted));};
    const canvas=$('tsCanvas');
    const position=e=>{const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*C.width/r.width,y:(e.clientY-r.top)*C.height/r.height};};
    const updateAim=e=>{const p=position(e);round.aim=P.aim(p.x-C.launchX,p.y-C.launchY);paint();};
    canvas.addEventListener('pointerdown',e=>{
      if(e.button!==0||pointer!==null||round.phase!=='playing'||round.shot||round.time<round.nextAt)return;
      const p=position(e);if(Math.hypot(p.x-C.launchX,p.y-C.launchY)>48)return;
      e.preventDefault();pointer=e.pointerId;canvas.setPointerCapture(pointer);unlockSound();
    },opt);
    canvas.addEventListener('pointermove',e=>{if(e.pointerId===pointer){e.preventDefault();updateAim(e);}},opt);
    canvas.addEventListener('pointerup',e=>{
      if(e.pointerId!==pointer)return;
      updateAim(e);const direction=round.aim;cancelAim();
      if(round.phase==='playing'){process(Math.max(0,(performance.now()-last)/1000));last=performance.now();P.fire(round,direction);}paint();
    },opt);
    for(const name of ['pointercancel','lostpointercapture'])canvas.addEventListener(name,()=>{cancelAim();paint();},opt);
    canvas.addEventListener('keydown',e=>{
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','Escape'].includes(e.key))return;
      e.preventDefault();if(e.key==='Escape'){pause();return;}
      if(round.phase!=='playing'||round.shot)return;
      const a=round.aim||P.aim(0,90);
      if(e.key===' '){process(Math.max(0,(performance.now()-last)/1000));last=performance.now();P.fire(round,a);unlockSound();}
      else round.aim=P.aim(a.dx+(e.key==='ArrowLeft'?6:e.key==='ArrowRight'?-6:0),Math.max(20,a.dy+(e.key==='ArrowUp'?4:e.key==='ArrowDown'?-4:0)));
      paint();
    },opt);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();},opt);
    window.addEventListener('blur',pause,opt);window.addEventListener('resize',cancelAim,opt);
    modalObserver=new MutationObserver(()=>{if($('modal').classList.contains('show'))pause();});
    modalObserver.observe($('modal'),{attributes:true,attributeFilter:['class']});
    if(round.phase==='result')resultPanel();else if(round.phase==='paused')pausePanel();else readyPanel();
    paint();
    // Keep the clock stopped until all artwork has decoded, including on the first offline visit.
    const mountedView=view,button=$('tsStart')||$('tsResume'),buttonText=button?.textContent;
    if(button&&!B.truckView.isReady()){button.disabled=true;button.textContent='えを よみこみちゅう…';}
    B.truckView.load().then(()=>{
      if(view!==mountedView||!active())return;
      if(button?.isConnected){button.disabled=false;button.textContent=buttonText;}
      paint();
    }).catch(()=>{
      if(view!==mountedView||!active())return;
      $('tsLive').textContent='えを よみこめなかったよ。もういちど ためしてね。';
      if(button?.isConnected){button.disabled=false;button.textContent='えを よみなおす';button.onclick=mount;}
    });
  }
  B.truckShoot={busy:()=>active()&&!!round&&round.phase!=='ready'&&(round.phase!=='result'||!paid)};
  B.screens['truck-shoot']={show:mount,hide(){pause();cancelAnimationFrame(raf);raf=0;abort?.abort();modalObserver?.disconnect();view=null;document.body.classList.remove('truck-game');},refresh(){/* Other tabs must not replace the active game DOM. */}};
})();
