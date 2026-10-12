/* Local deformation of the approved painting; no replacement character artwork.
 * One shared GPU renderer, independent fin/leg weights and original closed-eye patches.
 * DOM canvases are enhancements only: SVG export and unavailable WebGL stay intact.
 */
(function () {
  const BCT = window.BCT;
  const PAD = .09, NS = 'http://www.w3.org/2000/svg';
  // Coordinates on the original approved atlases: [crop], [eye centers/radii],
  // [part center/radius, travel x/y, phase]. Crop metadata matches pack-pet-art.mjs.
  const RIGS = {
    'dolphin-1': {crop:[54,124,352,335], happy:[54,633,352,337], eyes:[[208,257,34,37],[344,216,20,29]], parts:[[230,423,69,56,-17,14,0],[100,325,59,36,-5,-13,1.1],[380,300,33,43,4,10,3],[111,175,42,33,-4,-5,2]], speed:2.9},
    'dolphin-2': {crop:[530,58,398,439], happy:[530,568,397,440], eyes:[[738,178,34,38],[856,154,19,30]], parts:[[778,442,104,70,-22,19,0],[604,278,72,63,-10,15,1.1],[891,257,37,36,5,11,3],[586,100,61,44,-4,6,2]], speed:2.6},
    'dolphin-3': {crop:[938,22,573,485], happy:[938,533,573,486], eyes:[[1320,204,29,33],[1432,179,18,28]], parts:[[1228,444,109,72,17,22,0],[1079,335,136,79,-12,-22,1.1],[1433,332,70,93,16,-13,3],[1155,75,111,64,-8,10,2]], speed:2.3},
    'turtle-1': {crop:[62,156,319,256], happy:[62,664,320,258], eyes:[[266,246,26,31],[354,219,16,25]], parts:[[189,364,54,54,-13,10,0],[92,345,40,29,-6,-8,2],[314,338,39,39,10,8,3.1]], speed:2.1},
    'turtle-2': {crop:[516,100,414,346], happy:[517,608,413,348], eyes:[[808,187,27,33],[897,164,16,26]], parts:[[691,363,79,79,-18,16,0],[884,335,47,68,15,-13,3.1],[559,335,43,34,-7,9,2]], speed:1.9},
    'turtle-3': {crop:[1014,42,491,470], happy:[1014,553,491,465], eyes:[[1394,166,28,33],[1482,136,15,27]], parts:[[1287,411,104,96,-21,14,0],[1158,95,104,53,-9,-15,3.1],[1075,367,58,36,-8,10,2],[1424,270,35,45,7,9,1]], speed:1.7},
    'hermit-1': {crop:[58,160,352,314], happy:[58,638,352,313], eyes:[[295,310,28,32],[371,308,24,31]], parts:[[263,425,49,47,-8,-11,0],[365,424,42,49,9,-9,2],[159,445,36,25,-10,5,0],[196,421,23,43,6,-8,3.14]], speed:3.7},
    'hermit-2': {crop:[506,78,440,406], happy:[506,556,440,407], eyes:[[803,248,28,32],[875,253,26,31]], parts:[[756,412,52,68,-12,-11,0],[892,407,54,75,10,-16,2],[578,429,37,46,-11,7,0],[641,422,34,55,9,-8,3.14]], speed:3.4},
    'hermit-3': {crop:[990,81,536,415], happy:[990,560,536,415], eyes:[[1267,264,27,32],[1345,268,26,31]], parts:[[1455,299,71,106,9,-20,0],[1233,404,47,50,-10,11,2],[1053,418,41,40,-11,8,0],[1148,428,36,59,10,-9,3.14],[1349,422,28,49,6,-8,1.2]], speed:3.1},
  };
  const records = new Map(), textures = new Map();
  let gpu = null, unavailable = false, raf = 0, lastFrame = -Infinity;
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => media.matches || document.body.classList.contains('reduce-motion');
  const smooth = (v) => { v = Math.max(0, Math.min(1,v)); return v*v*(3-2*v); };

  function makeGPU() {
    if (gpu || unavailable) return gpu;
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl', {alpha:true, premultipliedAlpha:true, antialias:false, preserveDrawingBuffer:true});
    if (!gl) { unavailable = true; return null; }
    const compile = (type, text) => {
      const s = gl.createShader(type); gl.shaderSource(s,text); gl.compileShader(s);
      if (!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const vs = compile(gl.VERTEX_SHADER, `attribute vec2 position; varying vec2 uv; void main(){uv=vec2(position.x*.5+.5,.5-position.y*.5);gl_Position=vec4(position,0.,1.);}`);
    const fs = compile(gl.FRAGMENT_SHADER, `precision highp float;
      varying vec2 uv; uniform sampler2D baseArt; uniform sampler2D eyeArt;
      uniform vec4 parts[6]; uniform vec2 travel[6]; uniform vec4 eyes[2];
      uniform vec2 otherScale; uniform float eyeMix; uniform float padding;
      vec2 displacement(vec2 p){vec2 d=vec2(0.);for(int i=0;i<6;i++){
        vec2 q=(p-parts[i].xy)/max(parts[i].zw,vec2(.001));
        float w=max(0.,1.-dot(q,q)); d+=travel[i]*w*w;
      }return d;}
      void main(){vec2 target=uv*(1.+2.*padding)-padding;
        vec2 p=target; for(int j=0;j<4;j++) p=target-displacement(p);
        if(p.x<0.||p.y<0.||p.x>1.||p.y>1.){gl_FragColor=vec4(0.);return;}
        vec4 color=texture2D(baseArt,p); float mask=0.;
        for(int i=0;i<2;i++){vec2 q=(p-eyes[i].xy)/eyes[i].zw;mask=max(mask,1.-smoothstep(.9,1.,length(q)));}
        vec4 other=texture2D(eyeArt,p*otherScale);
        gl_FragColor=mix(color,other,mask*eyeMix);
      }`);
    const program = gl.createProgram(); gl.attachShader(program,vs); gl.attachShader(program,fs); gl.linkProgram(program);
    if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.deleteShader(vs); gl.deleteShader(fs); gl.useProgram(program);
    const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program,'position'); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
    const u = Object.fromEntries(['baseArt','eyeArt','parts[0]','travel[0]','eyes[0]','otherScale','eyeMix','padding'].map(k=>[k,gl.getUniformLocation(program,k)]));
    gl.uniform1i(u.baseArt,0); gl.uniform1i(u.eyeArt,1); gl.uniform1f(u.padding,PAD);
    canvas.addEventListener('webglcontextlost', event => {event.preventDefault();unavailable=true;for(const r of records.values()) restore(r);stop();});
    gpu = {gl,canvas,program,u}; return gpu;
  }

  function texture(id) {
    if (textures.has(id)) return textures.get(id);
    const task = (async () => {
      const img = new Image(); img.src = BCT.PET_SPRITES[id].src; await img.decode();
      const renderer = makeGPU(); if (!renderer || unavailable) return null;
      const {gl} = renderer, tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);
      return tex;
    })();
    textures.set(id,task); return task;
  }

  function createPlayer({type='dolphin',stage=1,face='normal'} = {}) {
    const rig = RIGS[`${type}-${stage}`]; if (!rig || !makeGPU()) return null;
    const happy = face === 'happy', source = happy ? rig.happy : rig.crop, other = happy ? rig.crop : rig.happy;
    const [ox,oy,w,h] = rig.crop;
    const parts = new Float32Array(24), travel = new Float32Array(12);
    rig.parts.forEach(([x,y,rx,ry],i) => parts.set([(x-ox)/source[2],(y-oy)/source[3],rx/source[2],ry/source[3]],i*4));
    const eyes = new Float32Array(rig.eyes.flatMap(([x,y,rx,ry])=>[(x-ox)/source[2],(y-oy)/source[3],rx/source[2],ry/source[3]]));
    const phase = Math.random()*6.28;
    let main, alternate, disposed=false, nextBlink=2.1+Math.random()*3.2, blinkAt=-10, manualBlink=false, start=null;
    const ready = Promise.all([texture(`${type}-${stage}-${face}`),texture(`${type}-${stage}-${happy?'normal':'happy'}`)]).then(t=>{[main,alternate]=t;return !!main&&!!alternate;});
    return {
      ready, width:source[2], height:source[3], padding:PAD,
      draw(canvas, time, options={}) {
        if (disposed || unavailable || !main || !alternate) return false;
        if (start === null) start=time;
        const t=(time-start)/1000;
        if(t>=nextBlink||manualBlink){blinkAt=t;manualBlink=false;nextBlink=t+(Math.random()<.18?.37:2.8+Math.random()*3.5);}
        const bt=t-blinkAt;
        let blink=bt<.075?smooth(bt/.075):bt<.115?1:1-smooth((bt-.115)/.13);
        if(happy && t<.7) blink=1;
        if(options.blink!==undefined) blink=options.blink;
        const energy=options.energy || 1;
        rig.parts.forEach((p,i) => {
          const wave=options.motion===false?0:Math.sin(t*rig.speed*energy+phase+p[6]);
          travel[i*2]=p[4]/source[2]*wave;travel[i*2+1]=p[5]/source[3]*wave;
        });
        const {gl,u,canvas:surface}=gpu;
        if(surface.width!==canvas.width || surface.height!==canvas.height){surface.width=canvas.width;surface.height=canvas.height;}
        gl.viewport(0,0,surface.width,surface.height); gl.useProgram(gpu.program);
        gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,main);
        gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,alternate);
        gl.uniform4fv(u['parts[0]'],parts);gl.uniform2fv(u['travel[0]'],travel);gl.uniform4fv(u['eyes[0]'],eyes);
        gl.uniform2f(u.otherScale,source[2]/other[2],source[3]/other[3]);gl.uniform1f(u.eyeMix,happy?1-blink:blink);
        gl.drawArrays(gl.TRIANGLES,0,6);
        const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(surface,0,0);
        return true;
      },
      blink(){manualBlink=true;},
      dispose(){disposed=true;},
    };
  }

  function restore(r) { r.image.style.removeProperty('visibility'); if(r.layer)r.layer.style.display='none'; }
  // The same animation as a canvas source for Three.js, preserving equipment and toy layering.
  async function createComposite(options={}) {
    const opts={...options,motion:false,px:512};
    const markup=BCT.art.render(opts), doc=new DOMParser().parseFromString(markup,'image/svg+xml'), root=doc.documentElement;
    const player=createPlayer({type:root.dataset.pet,stage:Number(root.dataset.stage),face:root.dataset.face});
    if(!player || !await player.ready){player?.dispose();return null;}
    try {
      const [under,over,still]=await Promise.all([
        BCT.art.toImage(BCT.art.render({...opts,motionLayer:'underlay'})),
        BCT.art.toImage(BCT.art.render({...opts,motionLayer:'overlay'})),BCT.art.toImage(markup),
      ]);
      const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
      const skin=document.createElement('canvas');skin.width=400;skin.height=Math.round(400*player.height/player.width);
      const ctx=canvas.getContext('2d');ctx.drawImage(still,0,0,512,512);
      const body=root.querySelector('[data-pet-body]'), image=body.querySelector('image');
      const m=(body.parentNode.transform.baseVal.consolidate()?.matrix || new DOMMatrix()).multiply(body.transform.baseVal.consolidate().matrix);
      const x=Number(image.getAttribute('x')),y=Number(image.getAttribute('y')),w=Number(image.getAttribute('width')),h=Number(image.getAttribute('height'));
      const k=Math.min(w/player.width,h/player.height),iw=player.width*k,ih=player.height*k;
      let disposed=false,last=-Infinity,wasReduced=true;
      return {canvas,
        update(time,settings={}) {
          if(disposed)return false;
          const reduce=settings.reduced ?? reduced();
          if(reduce){if(wasReduced)return false;ctx.clearRect(0,0,512,512);ctx.drawImage(still,0,0);wasReduced=true;return true;}
          if(time-last<1000/30)return false;last=time;wasReduced=false;
          if(!player.draw(skin,time,settings))return false;
          ctx.clearRect(0,0,512,512);ctx.drawImage(under,0,0);ctx.save();ctx.scale(512/200,512/200);ctx.transform(m.a,m.b,m.c,m.d,m.e,m.f);
          ctx.drawImage(skin,x+(w-iw)/2-iw*PAD,y+h-ih-ih*PAD,iw*(1+2*PAD),ih*(1+2*PAD));ctx.restore();ctx.drawImage(over,0,0);
          return true;
        },
        dispose(){disposed=true;player.dispose();},
      };
    } catch(error){player.dispose();throw error;}
  }
  function mount(svg) {
    if(records.has(svg) || svg.dataset.petMotion==='off')return;
    const id=`${svg.dataset.pet}-${svg.dataset.stage}-${svg.dataset.face}`;
    const image=svg.querySelector(`image[data-sprite="${id}"]`); if(!image)return;
    const r={svg,image,visible:false,player:null,layer:null,canvas:null};records.set(svg,r); observer.observe(svg);
  }
  async function prepare(r) {
    if(r.loading || r.player || unavailable)return;
    r.loading=true;
    try {
      const player=createPlayer({type:r.svg.dataset.pet,stage:Number(r.svg.dataset.stage),face:r.svg.dataset.face});
      if(!player || !await player.ready || !r.svg.isConnected){player?.dispose();return;}
      const x=Number(r.image.getAttribute('x')),y=Number(r.image.getAttribute('y')),w=Number(r.image.getAttribute('width')),h=Number(r.image.getAttribute('height'));
      const k=Math.min(w/player.width,h/player.height),iw=player.width*k,ih=player.height*k;
      const layer=document.createElementNS(NS,'foreignObject');layer.setAttribute('x',x+(w-iw)/2-iw*PAD);layer.setAttribute('y',y+h-ih-ih*PAD);
      layer.setAttribute('width',iw*(1+2*PAD));layer.setAttribute('height',ih*(1+2*PAD));layer.setAttribute('pointer-events','none');layer.setAttribute('aria-hidden','true');layer.classList.add('pet-motion-layer');
      const canvas=document.createElementNS('http://www.w3.org/1999/xhtml','canvas');
      canvas.style.cssText='display:block;width:100%;height:100%;pointer-events:none';
      const pixels=Math.min(480,Math.max(200,r.svg.getBoundingClientRect().width*(devicePixelRatio||1)));
      canvas.width=Math.round(pixels);canvas.height=Math.round(pixels*ih/iw);
      layer.appendChild(canvas);r.image.after(layer);Object.assign(r,{player,layer,canvas});
      wake();
    } catch(error) { restore(r); console.warn('Pet motion: static artwork retained.',error); }
    finally{r.loading=false;}
  }
  const observer=new IntersectionObserver(entries=>{
    for(const entry of entries){const r=records.get(entry.target);if(!r)continue;r.visible=entry.isIntersecting;if(r.visible&&!reduced())prepare(r);}
    wake();
  });
  function clean() {
    for(const [svg,r] of records)if(!svg.isConnected){observer.unobserve(svg);r.player?.dispose();records.delete(svg);}
  }
  function stop(){cancelAnimationFrame(raf);raf=0;}
  function tick(now){
    raf=0;if(document.hidden||reduced()||unavailable)return;
    const active=[...records.values()].filter(r=>r.visible&&r.svg.isConnected&&r.player);
    if(!active.length)return;
    if(now-lastFrame>=1000/30){
      lastFrame=now;
      for(const r of active){
        const host=r.svg.closest('.pet,.hb-pet');
        const energy=host&&/joy|eat|playing|act-through|act-climb/.test(host.className)?1.5:1;
        if(r.player.draw(r.canvas,now,{energy})){r.image.style.visibility='hidden';r.layer.style.display='';}
      }
    }
    raf=requestAnimationFrame(tick);
  }
  function wake(){
    clean();
    if(reduced()||document.hidden||unavailable){stop();for(const r of records.values())restore(r);return;}
    if(!raf&&[...records.values()].some(r=>r.visible&&r.player))raf=requestAnimationFrame(tick);
  }
  const mutation=new MutationObserver(entries=>{
    for(const entry of entries)for(const node of entry.addedNodes){
      if(node.nodeType!==1)continue;
      if(node.matches('svg[data-pet-motion]'))mount(node);
      node.querySelectorAll('svg[data-pet-motion]').forEach(mount);
    }
    clean();
  });
  mutation.observe(document.body,{childList:true,subtree:true});
  new MutationObserver(()=>{if(!reduced())for(const r of records.values())if(r.visible)prepare(r);wake();}).observe(document.body,{attributes:true,attributeFilter:['class']});
  media.addEventListener('change',()=>{if(!reduced())for(const r of records.values())if(r.visible)prepare(r);wake();});
  document.addEventListener('visibilitychange',wake);
  document.querySelectorAll('svg[data-pet-motion]').forEach(mount);
  BCT.petMotion={createPlayer,createComposite,rigs:RIGS,refresh:wake,blink:()=>{for(const r of records.values())r.player?.blink();},stats:()=>({mounted:records.size,visible:[...records.values()].filter(r=>r.visible).length,running:!!raf,unavailable})};
})();
