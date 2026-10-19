/* Painted scenery and truck; trash uses the very same embedded images as the home beach. */
(function () {
  const B = window.BCT, P = B.truckPhysics, C = P.C;
  let images = null, loading = null;
  const sources = {
    background: 'assets/truck-shoot/coast-inland-v1.webp',
    truck: 'assets/truck-shoot/recycling-truck-v1.webp',
    ...Object.fromEntries(P.trashKinds.map(key => [key, B.COLLECTION_SPRITES[key].src])),
  };
  function load() {
    if (images) return Promise.resolve();
    if (!loading) loading = Promise.all(Object.entries(sources).map(async ([key, src]) => {
      const image = new Image(); image.src = src; await image.decode(); return [key, image];
    })).then(entries => { images = Object.fromEntries(entries); }).catch(error => { loading = null; throw error; });
    return loading;
  }
  function create(canvas) {
    const c = canvas.getContext('2d');
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = C.width * ratio; canvas.height = C.height * ratio;
    c.scale(ratio, ratio);
    function oval(x,y,rx,ry,color) {c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();}
    function label(text,x,y,size,color,weight='bold') {c.font=`${weight} ${size}px system-ui, sans-serif`;c.textAlign='center';c.fillStyle=color;c.fillText(text,x,y);}
    function trash(x,y,kind,rotation=0,scale=1) {
      const im=images[P.trashKinds[kind%P.trashKinds.length]],fit=40*scale/Math.max(im.width,im.height);
      c.save();c.translate(x,y);c.rotate(rotation);
      c.drawImage(im,-im.width*fit/2,-im.height*fit/2,im.width*fit,im.height*fit);
      c.restore();
    }
    function truck(t,flash) {
      const x=P.truckX(t), y=C.launchY-C.roadDepth-C.openingHeight;
      const dir=Math.cos(t*.65+.004*t*t)>=0?1:-1;
      // Measured sprite anchors: hopper center (.43,.258), tire contact y=.91.
      const w=134,h=w*images.truck.height/images.truck.width;
      oval(x+dir*10,y+C.openingHeight,64,4,'#263c4729');
      c.save();c.translate(x,y);c.scale(dir,1);
      c.drawImage(images.truck,-w*.43,-h*.258,w,h);
      if(flash){oval(w*.47,h*.40,9,9,'#fff4a6bb');oval(0,0,25,5,'#ffeaa855');}
      c.restore();
      c.save();c.strokeStyle=flash?'#fff39c':'#fff5ce';c.lineWidth=1.3;c.setLineDash([3,3]);
      c.beginPath();c.ellipse(x,y,25,5,0,0,Math.PI*2);c.stroke();c.restore();
      c.fillStyle='#fffaf0ed';c.beginPath();c.roundRect(x-24,y-25,48,15,6);c.fill();
      label('ここへ！',x,y-14,10,'#326759');
    }
    function draw(s,reduced) {
      if(!images){c.fillStyle='#f6e7c7';c.fillRect(0,0,C.width,C.height);return;}
      const res=P.result(s.outcomes), f=s.feedback, age=f?s.time-f.at:10;
      c.drawImage(images.background,0,0,C.width,C.height);
      const remaining=Math.max(0,12-res.hits);
      for(let i=0;i<remaining;i++) {const x=28+(i*83)%305,y=230+(i*47)%97;trash(x,y,i,i*.7,.68);}
      truck(s.time,!!f&&f.ok&&age<.65);
      oval(C.launchX,C.launchY+10,29,9,'#ac985f33');
      c.strokeStyle='#c5a66b';c.lineWidth=2;c.beginPath();c.ellipse(C.launchX,C.launchY+8,34,12,0,0,Math.PI*2);c.stroke();
      if(s.aim){
        for(let t=.08;t<=P.flightTime;t+=.065){const p=P.point(s.aim,t);oval(p.x,C.launchY-p.d-p.h,2.6,2.6,'#fffef1');}
        c.strokeStyle='#bd956b';c.lineWidth=3;c.beginPath();c.moveTo(C.launchX-20,C.launchY);c.lineTo(C.launchX+s.aim.dx,C.launchY+s.aim.dy);c.lineTo(C.launchX+20,C.launchY);c.stroke();
        trash(C.launchX+s.aim.dx,C.launchY+s.aim.dy,s.outcomes.length,-s.aim.dx*.008);
        label('はなして シュート！',180,352,12,'#735b36');
      } else if(!s.shot&&s.phase!=='result') {
        trash(C.launchX,C.launchY,s.outcomes.length,0,1.15);
        label('↓ ひっぱる',180,435,12,'#735b36');
      }
      if(s.shot){
        const a=s.time-s.shot.start,p=P.point(s.shot,a),sc=1-p.d/1000;
        oval(p.x,C.launchY-p.d,10*sc,4*sc,'#746d4933');
        if(!reduced)for(let i=1;i<=7;i++){const ta=a-i*.025;if(ta<0)continue;const q=P.point(s.shot,ta);oval(q.x,C.launchY-q.d-q.h,3-i*.3,3-i*.3,`rgba(241,255,244,${.7-i*.08})`);}
        trash(p.x,C.launchY-p.d-p.h,s.shot.kind,reduced?0:a*8,sc);
      }
      if(f&&age<1.15){
        c.save();c.globalAlpha=Math.min(1,(1.15-age)*3);
        if(f.ok){
          if(!reduced)for(let i=0;i<18;i++){const a=i*2.4;label(i%2?'✦':'●',f.x+Math.cos(a)*age*70,f.y-10-Math.sin(a)*age*45+age*age*25,8,['#edac59','#fdf7be','#71b9a3'][i%3]);}
          label('SUCCESS!',180,210-(reduced?0:age*9),27,'#2c8062');
          label(res.combo>1?`${res.combo} コンボ！`:'ナイス シュート！',180,233,13,'#537c52');
        }else{
          oval(f.x,259,20+age*15,7,'#d6b98499');trash(f.x,250,Math.max(0,s.outcomes.length-1),age*.5,.6);
          label('おしい！ もういちど',180,211,20,'#8b6745');
          label('ゴミは はまべで かいしゅう',180,232,11,'#8b6745');
        }c.restore();
      }
    }
    return { draw };
  }
  B.truckView={create,load,isReady:()=>!!images};
})();
