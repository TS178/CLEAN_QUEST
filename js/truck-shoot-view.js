/* Canvas art is local and resolution independent; no remote assets or engine. */
(function () {
  const B = window.BCT, P = B.truckPhysics, C = P.C;
  function create(canvas) {
    const c = canvas.getContext('2d');
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = C.width * ratio; canvas.height = C.height * ratio;
    c.scale(ratio, ratio);
    function rect(x,y,w,h,r,fill) { c.fillStyle=fill;c.beginPath();c.roundRect(x,y,w,h,r);c.fill(); }
    function oval(x,y,rx,ry,color) {c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();}
    function label(text,x,y,size,color,weight='bold') {c.font=`${weight} ${size}px system-ui, sans-serif`;c.textAlign='center';c.fillStyle=color;c.fillText(text,x,y);}
    function trash(x,y,kind,rotation=0,scale=1) {
      c.save();c.translate(x,y);c.rotate(rotation);c.scale(scale,scale);
      if(kind===0){
        rect(-8,-12,16,26,5,'#f8ffed');rect(-4,-19,8,8,2,'#56a88b');rect(-8,-3,16,10,1,'#78c6ab');
        rect(-4,-10,3,8,1,'#c7e9d6');
      } else if(kind===1){
        rect(-10,-14,20,28,4,'#eab366');rect(-10,-4,20,10,0,'#fff5d8');oval(0,-13,9,3,'#a2b2ab');label('↻',0,5,12,'#799184');
      } else {
        c.fillStyle='#fcf1d9';c.beginPath();c.moveTo(-13,-9);c.lineTo(5,-15);c.lineTo(14,2);c.lineTo(3,14);c.lineTo(-11,10);c.closePath();c.fill();
        c.strokeStyle='#b5aa84';c.lineWidth=1.5;c.beginPath();c.moveTo(-8,-7);c.lineTo(5,7);c.lineTo(9,0);c.stroke();
      }
      c.restore();
    }
    function background(t,reduced) {
      c.fillStyle='#f4dfb2';c.fillRect(0,0,360,520);
      const sky=c.createLinearGradient(0,0,0,90);sky.addColorStop(0,'#bce4dc');sky.addColorStop(1,'#e9f2d4');c.fillStyle=sky;c.fillRect(0,0,360,91);
      oval(308,30,18,18,'#ffedac');
      for(const x of [14,91,275,348]){rect(x-3,42,6,41,2,'#8c9771');oval(x,34,22,23,'#9bc99a');oval(x-7,29,15,17,'#b4d8a5');}
      c.fillStyle='#ccdab3';c.beginPath();c.moveTo(0,66);c.quadraticCurveTo(95,43,180,71);c.quadraticCurveTo(270,46,360,66);c.lineTo(360,95);c.lineTo(0,95);c.fill();
      rect(126,20,108,25,8,'#fffaf0');label('↑ りくの かいしゅうじょ',180,36,10,'#47735c');
      c.fillStyle='#8faaa0';c.fillRect(0,91,360,70);
      c.strokeStyle='#dbe4cc';c.lineWidth=3;c.setLineDash([17,19]);c.beginPath();c.moveTo(0,132);c.lineTo(360,132);c.stroke();c.setLineDash([]);
      rect(0,160,360,12,0,'#c2c8b0');rect(0,172,360,5,0,'#a2ae99');
      for(let x=0;x<360;x+=35){rect(x,173,2,10,0,'#b9b995');}
      for(let i=0;i<70;i++){oval((i*71+19)%360,192+(i*53)%270,.9,.65,'#d7c293');}
      for(const x of [16,330]){c.strokeStyle='#97ad78';c.lineWidth=2;c.beginPath();c.moveTo(x,211);c.lineTo(x-4,195);c.moveTo(x,211);c.lineTo(x+7,198);c.stroke();}
      const wave=reduced?0:Math.sin(t*1.3)*3;
      c.fillStyle='#a7d8cb';c.beginPath();c.moveTo(0,474+wave);c.bezierCurveTo(80,454+wave,200,504+wave,360,470+wave);c.lineTo(360,520);c.lineTo(0,520);c.fill();
      c.strokeStyle='#effbf0';c.lineWidth=5;c.beginPath();c.moveTo(0,474+wave);c.bezierCurveTo(80,454+wave,200,504+wave,360,470+wave);c.stroke();
      label('うみ',324,507,11,'#427f77');
    }
    function truck(t,flash) {
      const x=P.truckX(t), y=C.launchY-C.roadDepth-C.openingHeight;
      oval(x+9,y+43,73,9,'#264d4930');
      c.save();c.translate(x,y);
      // The rim is centered exactly on the physics target.
      rect(-43,0,86,40,8,'#4b9980');rect(-40,8,80,28,5,'#70b38c');
      rect(-C.halfWidth,-C.halfDepth*.48,C.halfWidth*2,C.halfDepth*.96,8,'#d9edb9');
      rect(-C.halfWidth+4,-8,C.halfWidth*2-8,16,5,'#294f48');
      c.strokeStyle='#fff3a1';c.lineWidth=2;c.setLineDash([4,3]);c.strokeRect(-29,-7,58,14);c.setLineDash([]);
      label('ここへ！',0,-17,10,'#28574c');
      const dir=Math.cos(t*.65+.004*t*t)>=0?1:-1;
      c.save();c.scale(dir,1);
      rect(41,10,29,30,5,'#eec267');rect(45,13,18,12,3,'#d5eee0');rect(65,29,9,11,3,flash?'#fff9b4':'#ffe5a0');
      for(const wx of [-24,51]){oval(wx,42,10,10,'#355955');oval(wx,42,5,5,'#dce6cf');}
      c.restore();label('♻',0,31,21,'#f5f6d8');
      if(flash){oval(dir*70,33,15,15,'#fff8ac66');}
      c.restore();
    }
    function draw(s,reduced) {
      const res=P.result(s.outcomes), f=s.feedback, age=f?s.time-f.at:10;
      background(s.time,reduced);
      const remaining=Math.max(0,12-res.hits);
      for(let i=0;i<remaining;i++) {const x=28+(i*83)%305,y=230+(i*47)%97;trash(x,y,i%3,i*.7,.5);}
      truck(s.time,!!f&&f.ok&&age<.65);
      oval(C.launchX,C.launchY+10,29,9,'#ac985f44');
      c.strokeStyle='#d1b883';c.lineWidth=2;c.beginPath();c.ellipse(C.launchX,C.launchY+8,34,12,0,0,Math.PI*2);c.stroke();
      if(s.aim){
        for(let t=.08;t<=1;t+=.065){const p=P.point(s.aim,t);oval(p.x,C.launchY-p.d-p.h,2.6,2.6,'#fffef1');}
        c.strokeStyle='#bd956b';c.lineWidth=3;c.beginPath();c.moveTo(C.launchX-20,C.launchY);c.lineTo(C.launchX+s.aim.dx,C.launchY+s.aim.dy);c.lineTo(C.launchX+20,C.launchY);c.stroke();
        trash(C.launchX+s.aim.dx,C.launchY+s.aim.dy,s.outcomes.length%3,-s.aim.dx*.008);
        label('はなして シュート！',180,352,12,'#735b36');
      } else if(!s.shot&&s.phase!=='result') {
        trash(C.launchX,C.launchY,s.outcomes.length%3,0,1.15);
        label('↓ ひっぱる',180,435,12,'#836d48');
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
          oval(f.x,259,20+age*15,7,'#d6b98499');trash(f.x,250,Math.max(0,s.outcomes.length-1)%3,age*.5,.6);
          label('おしい！ もういちど',180,211,20,'#8b6745');
          label('ゴミは はまべで かいしゅう',180,232,11,'#8b6745');
        }c.restore();
      }
    }
    return { draw };
  }
  B.truckView={create};
})();
