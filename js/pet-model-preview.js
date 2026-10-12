// Review-only volumetric models. No saved game data is read or modified.
import * as T from '../vendor/three/three.module.js';

const V = (x,y,z) => new T.Vector3(x,y,z);
const color = value => new T.Color(value);
const PALETTE = {
  dolphin: [['#a3edff','#53bddd'],['#87eff7','#1687d0'],['#abf5ec','#0865b4']],
  turtle: [['#d0efb0','#8acdb2'],['#b6edaa','#35b2ae'],['#b3e9a9','#087b95']],
  hermit: [['#fff0d4','#efbea5'],['#ffd9c7','#ad98d5'],['#f9c7c2','#9275c5']]
};

function patternTexture(kind) {
  if(!kind || kind==='none') return null;
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;
  const c=canvas.getContext('2d');
  if(kind==='wave') {
    for(let row=-1;row<4;row++) {
      c.beginPath();
      for(let x=-10;x<=1034;x+=4) {
        const y=110+row*170+28*Math.sin(x/1024*Math.PI*4);
        x===-10?c.moveTo(x,y):c.lineTo(x,y);
      }
      c.lineWidth=42;c.strokeStyle='#266281';c.stroke();
      c.lineWidth=29;c.strokeStyle='#fff4cc';c.stroke();
    }
  } else {
    for(let row=0;row<3;row++) for(let col=0;col<7;col++) {
      const x=col*160+(row%2)*70,y=80+row*175;
      c.beginPath();
      const n=kind==='star'?10:8;
      for(let i=0;i<n;i++) {
        const angle=-Math.PI/2+i*Math.PI*2/n,r=i%2?15:40;
        const px=x+Math.cos(angle)*r,py=y+Math.sin(angle)*r;
        i?c.lineTo(px,py):c.moveTo(px,py);
      }
      c.closePath();c.lineJoin='round';c.lineWidth=8;
      c.strokeStyle=kind==='star'?'#946078':'#9c6baf';c.stroke();
      c.fillStyle=kind==='star'?'#ffe398':'#ffe3f3';c.fill();
      c.beginPath();c.arc(x-7,y-10,5,0,Math.PI*2);c.fillStyle='#fffdf5';c.fill();
    }
  }
  const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;
  return tex;
}

function material(hex,roughness=.38) {
  return new T.MeshPhysicalMaterial({color:hex,roughness,metalness:0,clearcoat:.28,clearcoatRoughness:.3});
}
function gradientMaterial(top,bottom,pattern) {
  const mat=material('#ffffff');mat.vertexColors=true;
  if(pattern) {
    mat.userData.pattern=pattern;
    mat.onBeforeCompile=shader=>{
      shader.uniforms.petPattern={value:pattern};
      shader.vertexShader='varying vec2 petUV;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\npetUV=uv;');
      shader.fragmentShader='uniform sampler2D petPattern;\nvarying vec2 petUV;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nvec4 patternColor=texture2D(petPattern,petUV);\ndiffuseColor.rgb=mix(diffuseColor.rgb,patternColor.rgb,patternColor.a*.95);');
    };
    mat.customProgramCacheKey=()=> 'pet-pattern-v1';
  }
  mat.userData.gradient=[color(top),color(bottom)];
  return mat;
}
function shade(geometry,mat) {
  if(!mat.userData.gradient)return geometry;
  geometry.computeBoundingBox();
  const p=geometry.attributes.position,box=geometry.boundingBox,colors=[];
  const [top,bottom]=mat.userData.gradient;
  for(let i=0;i<p.count;i++) {
    const f=T.MathUtils.clamp((p.getY(i)-box.min.y)/Math.max(.01,box.max.y-box.min.y),0,1);
    const c=bottom.clone().lerp(top,f*.9+.05);colors.push(c.r,c.g,c.b);
  }
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  return geometry;
}
function mesh(parent,geometry,mat,pos=[0,0,0],scale=[1,1,1]) {
  const m=new T.Mesh(shade(geometry,mat),mat);m.position.set(...pos);m.scale.set(...scale);
  m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
function oval(parent,mat,pos,size) {return mesh(parent,new T.SphereGeometry(1,40,28),mat,pos,size);}
function line(parent,points,radius,mat,closed=false) {
  const curve=new T.CatmullRomCurve3(points.map(p=>V(...p)),closed);
  return mesh(parent,new T.TubeGeometry(curve,Math.max(24,points.length*8),radius,10,closed),mat);
}
function loop(parent,cx,cy,cz,rx,rz,radius,mat,tilt=0) {
  return line(parent,Array.from({length:32},(_,i)=>{
    const a=i/32*Math.PI*2;return [cx+rx*Math.cos(a),cy+Math.sin(a)*tilt,cz+rz*Math.sin(a)];
  }),radius,mat,true);
}
function leaf(parent,mat,points,width,thickness) {
  const curve=new T.CatmullRomCurve3(points.map(p=>V(...p)));
  const positions=[],uvs=[],indices=[],rows=28,sides=16;
  for(let i=0;i<=rows;i++) {
    const t=i/rows,center=curve.getPoint(t),tangent=curve.getTangent(t);
    let across=new T.Vector3().crossVectors(tangent,V(0,0,1)).normalize();
    if(across.length()<.1)across=V(1,0,0);
    const normal=new T.Vector3().crossVectors(across,tangent).normalize();
    const envelope=Math.max(.015,Math.pow(Math.sin(Math.PI*t),.75));
    for(let j=0;j<=sides;j++) {
      const a=j/sides*Math.PI*2;
      const p=center.clone().addScaledVector(across,Math.cos(a)*width*envelope).addScaledVector(normal,Math.sin(a)*thickness*envelope);
      positions.push(p.x,p.y,p.z);uvs.push(j/sides,t);
      if(i<rows&&j<sides){const q=i*(sides+1)+j;indices.push(q,q+sides+1,q+1,q+1,q+sides+1,q+sides+2);}
    }
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();
  return mesh(parent,g,mat);
}
function face(parent,{y=.5,z=.5,spread=.27,eye=.125,happy=false,cheek=.41,cheekZ=z-.035,mouthY=.24,mouth=true}) {
  const dark=material('#122c43',.18),white=material('#ffffff',.2),pink=material('#f5a6ab',.58);
  for(const side of [-1,1]) {
    if(happy)line(parent,[[side*spread-eye*.8,y-.01,z],[side*spread,y+eye*.45,z+.02],[side*spread+eye*.8,y-.01,z]],.025,dark);
    else {
      oval(parent,material('#fbf3e8'),[side*spread,y,z-.019],[eye*1.06,eye*1.2,.036]);
      oval(parent,dark,[side*spread,y,z+.006],[eye,eye*1.13,.040]);
      oval(parent,material('#1c5477',.22),[side*spread,y-eye*.45,z+.041],[eye*.6,eye*.42,.009]);
      oval(parent,white,[side*spread-eye*.26,y+eye*.32,z+.047],[eye*.30,eye*.32,.016]);
      oval(parent,white,[side*spread+eye*.30,y-eye*.2,z+.048],[eye*.12,eye*.13,.009]);
    }
    const blush=oval(parent,pink,[side*cheek,y-.20,cheekZ],[.085,.047,.014]);blush.rotation.y=side*.45;
  }
  if(mouth)line(parent,[[-.11,mouthY+.025,z+.085],[0,mouthY-.025,z+.11],[.11,mouthY+.025,z+.085]],.012,material('#794b48'));
}
function shellPatch(parent,mat,inner,outer,start,end,scale,baseY) {
  const pos=[],uv=[],ind=[],radial=40,angular=100;
  for(let i=0;i<=radial;i++)for(let j=0;j<=angular;j++){
    const a=start+(end-start)*j/angular,r=inner+(outer-inner)*i/radial;
    const x=Math.cos(a)*r,z=Math.sin(a)*r;
    pos.push(x*scale[0],baseY+Math.sqrt(1-r*r)*scale[1],z*scale[2]);uv.push(x*.5+.5,z*.5+.5);
    if(i<radial&&j<angular){const q=i*(angular+1)+j;ind.push(q,q+1,q+angular+1,q+1,q+angular+2,q+angular+1);}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ind);g.computeVertexNormals();
  const m=mesh(parent,g,mat);m.material.side=T.DoubleSide;return m;
}

function makeDolphin(root,stage,happy,skin) {
  const finMat=gradientMaterial('#b6f5e8',stage===3?'#168dcc':'#40bedf');
  // A continuous rounded body, with a tapered underside and no point on the head.
  const bodyGeometry=new T.SphereGeometry(1,80,64),bodyPositions=bodyGeometry.attributes.position;
  for(let i=0;i<bodyPositions.count;i++){
    const y=bodyPositions.getY(i),radius=.58+.23*y;
    bodyPositions.setXYZ(i,bodyPositions.getX(i)*radius,y*1.045+.095,bodyPositions.getZ(i)*radius);
  }
  const body=mesh(root,bodyGeometry,skin,[0,0,0],[1,1,.92]);
  const bp=body.geometry.attributes.position,bc=body.geometry.attributes.color,ivory=color('#fff7e2');
  for(let i=0;i<bp.count;i++){
    const x=bp.getX(i),y=bp.getY(i),z=bp.getZ(i);
    // The pale underside is part of the skin, not a raised patch.
    const front=T.MathUtils.smoothstep(z/Math.max(.01,Math.hypot(x,z)),.42,.82);
    const belly=(1-T.MathUtils.smoothstep(y,.22,.46))*front;
    const c=new T.Color().fromBufferAttribute(bc,i).lerp(ivory,belly);bc.setXYZ(i,c.r,c.g,c.b);
    bp.setZ(i,z-.48*Math.max(0,.15-y)**1.4);
  }
  body.geometry.computeVertexNormals();
  const plainSkin=gradientMaterial(...PALETTE.dolphin[stage-1]);
  oval(root,plainSkin,[0,.31,.58],[.24,.10,.21]);
  oval(root,material('#743848'),[0,.22,.64],[.102,.070,.055]);
  oval(root,material('#f8999e'),[0,.193,.683],[.060,.025,.022]);
  face(root,{y:.61,z:.501,spread:.265,eye:.125,happy,cheek:.415,cheekZ:.409,mouth:false});
  const reach=[0,.75,1.0,1.28][stage];
  for(const s of [-1,1]) {
    leaf(root,finMat,[[s*.42,.18,.02],[s*.68,-.03,.12],[s*reach,-.24,.16]],stage===3?.22:.16,.055);
    if(stage===3)leaf(root,finMat,[[s*.43,.14,-.02],[s*.76,-.22,.03],[s*1.14,-.44,.10]],.14,.045);
  }
  const dorsal=leaf(root,plainSkin,[[0,.28,-.34],[0,.62,-.65],[0,.91+(stage-1)*.12,-.82]],.23,.065);
  // The width of this fin lies along the back, its thickness across the body.
  const p=dorsal.geometry.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);p.setX(i,x*.28);p.setZ(i,z+x*.45);}
  dorsal.geometry.computeVertexNormals();
  for(const s of [-1,1])leaf(root,finMat,[[0,-.86,-.48],[s*.30,-.91,-.63],[s*(stage===3?.70:.49),-.77,-.86]],stage===3?.24:.15,.055);
  return {head:{pos:[0,.88,0],rx:.50,rz:.46,height:.30},neck:{pos:[0,.10,-.015],rx:.565,rz:.525},charm:[0,-.10,.49]};
}
function makeTurtle(root,stage,happy,shellMat) {
  const skin=gradientMaterial('#d8efaf','#80c6a5'),cream=material('#fff0cf');
  const shellScale=[.66+(stage-1)*.06,.38+(stage-1)*.03,.79];
  const shell=new T.Group();shell.position.set(0,0,-.27);root.add(shell);
  oval(shell,cream,[0,.035,0],[shellScale[0]+.04,.15,shellScale[2]+.03]);
  shellPatch(shell,shellMat,0,.998,0,Math.PI*2,shellScale,.06);
  const seam=material('#def0ad',.55);
  for(const [cx,cz] of [[0,-.54],[0,0],[0,.54],[-.468,-.27],[-.468,.27],[.468,-.27],[.468,.27]]){
    for(let edge=0;edge<6;edge++){
      const a=edge*Math.PI/3,b=(edge+1)*Math.PI/3,points=[];
      for(let j=0;j<=12;j++){
        const t=j/12,x=cx+.312*(Math.cos(a)*(1-t)+Math.cos(b)*t),z=cz+.312*(Math.sin(a)*(1-t)+Math.sin(b)*t),r=Math.hypot(x/shellScale[0],z/shellScale[2]);
        if(r<.96)points.push([x,.067+Math.sqrt(1-r*r)*shellScale[1],z]);
      }
      if(points.length>1)line(shell,points,.010,seam);
    }
  }
  oval(root,cream,[0,-.16,-.19],[.52,.21,.65]);
  oval(root,skin,[0,.01,.43],[.29,.25,.40]);
  oval(root,skin,[0,.24,.74],[.45,.42,.39]);
  face(root,{y:.31,z:1.058,spread:.22,eye:.105,happy,cheek:.32,mouthY:.095});
  const reach=[0,.79,1.02,1.42][stage];
  for(const s of [-1,1]) {
    leaf(root,skin,[[s*.40,-.13,.30],[s*.78,-.26,.39],[s*reach,-.36,.09]],stage===3?.27:.21,.075);
    leaf(root,skin,[[s*.39,-.13,-.70],[s*.66,-.21,-.83],[s*.76,-.29,-.96]],.17,.065);
  }
  leaf(root,skin,[[0,-.1,-.92],[0,-.12,-1.10],[0,-.20,-1.15]],.08,.06);
  return {head:{pos:[0,.53,.74],rx:.34,rz:.30},neck:{pos:[0,-.09,.62],rx:.32,rz:.43},charm:[0,-.29,1.07]};
}
function makeHermit(root,stage,happy,shellMat) {
  const skin=gradientMaterial('#ffc7a2','#eb887f'),cream=material('#ffe8cb');
  const shell=new T.Group();shell.position.set(-.07,.20,-.30);root.add(shell);
  // Spiral ridges are sculpted into the shell surface and share its shading.
  const sx=stage===3?.78:.65,sy=stage===2?.80:.65;
  const outer=mesh(shell,new T.SphereGeometry(1,128,96),shellMat,[0,.07,0],[sx,sy,.57]);
  const points=outer.geometry.attributes.position,colors=outer.geometry.attributes.color;
  for(let i=0;i<points.count;i++){
    const x=points.getX(i),y=points.getY(i),z=points.getZ(i),r=Math.hypot(x,y),a=Math.atan2(y,x);
    const coil=r*16-a,fade=T.MathUtils.smoothstep(z,0,.3)*Math.sin(Math.PI*Math.min(r,1));
    points.setZ(i,z+.075*Math.sin(coil)*fade);
    const c=new T.Color().fromBufferAttribute(colors,i).lerp(color('#ffedcc'),(.5+.5*Math.sin(coil))*.32*fade);colors.setXYZ(i,c.r,c.g,c.b);
  }
  outer.geometry.computeVertexNormals();
  if(stage>=2){
    const spire=new T.Group();spire.position.set(-.40,.47,.11);spire.rotation.set(.8,0,.65);shell.add(spire);
    mesh(spire,new T.LatheGeometry([[0,.27],[.06,.25],[.09,.17],[.13,.15],[.16,.06],[.21,.035],[.25,-.09],[.29,-.14]].map(p=>new T.Vector2(...p)),48),shellMat);
  }
  const aperture=[];
  for(let j=0;j<64;j++){
    const a=j/64*Math.PI*2,r=stage===3?1+.035*Math.cos(a*7):1;
    aperture.push([Math.cos(a)*sx*.76*r,-.34+Math.sin(a)*.31*r,.43+Math.sin(a)*.055]);
  }
  line(shell,aperture,.042,cream,true);
  if(stage===3)for(const a of [.95,1.65,2.4])oval(shell,shellMat,[Math.cos(a)*.69,Math.sin(a)*.62,.20],[.075,.075,.070]);
  oval(root,skin,[0,-.44,.31],[.46,.34,.39]);
  for(const s of [-1,1]) {
    line(root,[[s*.19,-.24,.49],[s*.22,-.015,.58]],.067,skin);
    oval(root,skin,[s*.22,.015,.58],[.144,.155,.122]);
    if(happy)line(root,[[s*.22-.085,.00,.70],[s*.22,.065,.71],[s*.22+.085,.00,.70]],.022,material('#442e35'));
    else{
      oval(root,material('#fff2dc'),[s*.22,.024,.682],[.118,.130,.029]);
      oval(root,material('#29263b',.13),[s*.22,.024,.706],[.101,.111,.028]);
      oval(root,material('#ffffff',.2),[s*.22-.029,.063,.731],[.030,.035,.012]);
    }
    oval(root,material('#f89d9c'),[s*.25,-.29,.638],[.075,.038,.017]);
    for(let i=0;i<3;i++){
      const points=[[s*.31,-.55,.12-i*.18],[s*(.53+i*.055),-.57,.06-i*.14],[s*(.63+i*.05),-.79,.12-i*.12]];
      leaf(root,skin,points,.070,.059);
    }
    const claw=stage===3&&s===1?.31:(stage===1?.18:.22);
    line(root,[[s*.35,-.4,.39],[s*.59,-.39,.52]],.085,skin);
    const group=new T.Group();group.position.set(s*.63,stage===3&&s===1?-.13:-.4,.56);root.add(group);
    oval(group,skin,[0,0,0],[claw,claw*1.12,claw*.65]);
    leaf(group,skin,[[-claw*.58,claw*.35,0],[-claw*.58,claw*.85,.005],[-claw*.10,claw*1.20,.02]],claw*.40,claw*.53);
    leaf(group,skin,[[claw*.53,claw*.35,0],[claw*.56,claw*.79,.005],[claw*.18,claw*1.04,.02]],claw*.35,claw*.51);
  }
  line(root,[[-.11,-.35,.663],[0,-.40,.697],[.11,-.35,.663]],.015,material('#894d49'));
  return {head:{pos:[0,stage===2?.93:.83,-.28],rx:.40,rz:.34},neck:{pos:[0,-.26,.37],rx:.37,rz:.34},charm:[0,-.48,.72]};
}

function cap(root,seat) {
  const g=new T.Group();g.position.set(...seat.pos);root.add(g);
  const white=material('#fff5de'),blue=material('#23659d'),gold=material('#efb945');
  // Open hemispherical cap, fitted around the upper head instead of a floating icon.
  mesh(g,new T.SphereGeometry(1,40,24,0,Math.PI*2,0,Math.PI/2),white,[0,0,0],[seat.rx,seat.height||.25,seat.rz]);
  loop(g,0,.015,0,seat.rx,seat.rz,.048,blue);
  oval(g,blue,[0,-.016,seat.rz*.70],[seat.rx*.83,.032,seat.rz*.75]);
  const badge=mesh(g,new T.CylinderGeometry(.085,.085,.022,28),gold,[0,.117,seat.rz*.95]);badge.rotation.x=Math.PI/2;
  line(g,[[0,.165,seat.rz+ .012],[0,.07,seat.rz+.024]],.012,white);
  line(g,[[-.045,.09,seat.rz+.024],[0,.065,seat.rz+.024],[.045,.09,seat.rz+.024]],.012,white);
}
function scarf(root,neck) {
  const [x,y,z]=neck.pos,blue=material('#2774ba'),light=material('#a4def0');
  // Full 360-degree collar, with rear portions naturally hidden by the body.
  loop(root,x,y,z,neck.rx,neck.rz,.070,blue,.025);
  loop(root,x,y+.040,z,neck.rx+.009,neck.rz+.009,.013,light,.025);
  const knot=[x+neck.rx*.67,y-.045,z+neck.rz*.80];
  oval(root,blue,knot,[.11,.086,.07]);
  leaf(root,blue,[knot,[knot[0]+.07,knot[1]-.14,knot[2]+.04],[knot[0]+.17,knot[1]-.30,knot[2]+.08]],.082,.024);
  leaf(root,light,[knot,[knot[0]-.05,knot[1]-.14,knot[2]+.07],[knot[0]-.12,knot[1]-.24,knot[2]+.08]],.064,.021);
}
function pendant(root,neck,charm) {
  const [x,y,z]=neck.pos,gold=material('#d9a85c'),shell=material('#f8c7dc');
  const points=Array.from({length:48},(_,i)=>{
    const a=i/48*Math.PI*2,front=Math.max(0,Math.sin(a));
    return [x+neck.rx*Math.cos(a),y+(charm[1]+.085-y)*front,z+(Math.sin(a)>0?charm[2]-.015-z:neck.rz)*Math.sin(a)];
  });
  line(root,points,.017,gold,true);
  const pos=charm;
  const ring=mesh(root,new T.TorusGeometry(.032,.011,8,20),gold,[pos[0],pos[1]+.045,pos[2]]);
  for(let i=-2;i<=2;i++) {
    const bead=oval(root,shell,[pos[0]+i*.035,pos[1]-.04+Math.abs(i)*.015,pos[2]],[.035,.088-Math.abs(i)*.012,.034]);bead.rotation.z=-i*.19;
  }
}

export function createPetModel({type='dolphin',stage=1,happy=false,head='cap',acc='scarf',look='none'}={}) {
  const root=new T.Group();root.name=type+'-'+stage;
  const pattern=patternTexture(look),palette=PALETTE[type][stage-1];
  const skin=gradientMaterial(...palette,pattern);
  const fit=type==='dolphin'?makeDolphin(root,stage,happy,skin):type==='turtle'?makeTurtle(root,stage,happy,skin):makeHermit(root,stage,happy,skin);
  if(head==='cap')cap(root,fit.head);
  if(acc==='scarf')scarf(root,fit.neck);
  if(acc==='pendant')pendant(root,fit.neck,fit.charm);
  root.userData.dispose=()=>{
    const geometries=new Set(),materials=new Set();
    root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());pattern?.dispose();
  };
  return root;
}
