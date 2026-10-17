/* Continuous skin for front-art rigs. Shared mesh vertices keep joints attached.
 * The original illustration is the only visible texture; cutouts supply motion weights only.
 * No generated/repainted pixels, separate limb edges, or duplicate head layer.
 */
(function () {
  const BCT = window.BCT = window.BCT || {};
  const smooth = v => { const t = Math.max(0, Math.min(1, v)); return t*t*(3-2*t); };
  // Small software mask blur: works on Safari without CanvasRenderingContext2D.filter.
  function soften(data,w,h,r) {
    let a=Float32Array.from({length:w*h},(_,i)=>data[i*4+3]/255);
    const n=2*r+1;
    for(let pass=0;pass<2;pass++) {
      const horizontal=new Float32Array(a.length),out=new Float32Array(a.length);
      for(let y=0;y<h;y++)for(let x=0;x<w;x++) {
        let sum=0;for(let d=-r;d<=r;d++)if(x+d>=0&&x+d<w)sum+=a[y*w+x+d];horizontal[y*w+x]=sum/n;
      }
      for(let y=0;y<h;y++)for(let x=0;x<w;x++) {
        let sum=0;for(let d=-r;d<=r;d++)if(y+d>=0&&y+d<h)sum+=horizontal[(y+d)*w+x];out[y*w+x]=sum/n;
      }
      a=out;
    }
    return a;
  }
  function deform(mesh, angles) {
    const {base, bones, weights, indices, stepX, stepY} = mesh;
    const delta = new Float32Array(base.length);
    for (let j=0;j<bones.length;j++) {
      const a=angles[j]||0, c=Math.cos(a), s=Math.sin(a), b=bones[j];
      for (let i=0;i<base.length/2;i++) {
        const w=weights[j][i], x=base[i*2]-b.x, y=base[i*2+1]-b.y;
        delta[i*2]+=w*(x*c-y*s-x); delta[i*2+1]+=w*(x*s+y*c-y);
      }
    }
    // Limit extreme deformation before triangles can fold or invert.
    const positions=new Float32Array(base.length);
    const strength=mesh.strength ?? 1;
    let minArea;
    {
      for(let i=0;i<base.length;i++) positions[i]=base[i]+delta[i]*strength;
      minArea=Infinity;
      for(let i=0;i<indices.length;i+=3) {
        const a=indices[i]*2,b=indices[i+1]*2,c=indices[i+2]*2;
        const area=(positions[b]-positions[a])*(positions[c+1]-positions[a+1])-(positions[b+1]-positions[a+1])*(positions[c]-positions[a]);
        minArea=Math.min(minArea,area/(stepX*stepY));
      }
    }
    return {positions,strength,minArea};
  }

  // Bound the displacement gradient once, for every possible phase/amplitude.
  // ||D|| < .48 keeps both singular values above .52 (area > .27).
  // A constant limit avoids the old per-frame 1 -> .5 snap at joint extremes.
  function safeStrength(mesh,cfg) {
    let maximum=0;
    const {base,bones,weights,indices,stepX,stepY}=mesh;
    for(let t=0;t<indices.length;t+=3) {
      const ids=[indices[t],indices[t+1],indices[t+2]];
      let bound=0;
      for(let j=0;j<bones.length;j++) {
        const b=bones[j],w=weights[j];
        const q=ids.map(i=>[w[i]*(base[i*2]-b.x),w[i]*(base[i*2+1]-b.y)]);
        // Each triangle has one horizontal and one vertical edge.
        const horizontal=base[ids[0]*2+1]===base[ids[1]*2+1]?[0,1]:[1,2];
        const vertical=base[ids[0]*2]===base[ids[2]*2]?[0,2]:[0,1];
        const [a,c]=horizontal,[d,e]=vertical;
        const norm=Math.hypot((q[c][0]-q[a][0])/stepX,(q[c][1]-q[a][1])/stepX,
          (q[e][0]-q[d][0])/stepY,(q[e][1]-q[d][1])/stepY);
        bound+=2*Math.sin(Math.min(Math.PI,Math.abs(cfg.parts[b.id].swing.amp)*Math.PI/180)/2)*norm;
      }
      maximum=Math.max(maximum,bound);
    }
    return Math.min(1,.48/(maximum||1));
  }

  async function create(cfg, imgs, lay, front) {
    const sp=BCT.PET_SPRITES[`${cfg.type}-${cfg.stage}-normal`];
    const original=new Image(); original.src=sp.src; await original.decode();
    const W=front.W,H=front.H,pad=Math.ceil(Math.max(W,H)*.16), cols=40,rows=40;
    const stepX=(W+2*pad)/cols,stepY=(H+2*pad)/rows;
    const base=[],uv=[],indices=[],bones=[],weights=[];
    for(let y=0;y<=rows;y++) for(let x=0;x<=cols;x++) {
      const u=x*stepX-pad,v=y*stepY-pad; base.push(u,v);uv.push(u/W,v/H);
    }
    for(let y=0;y<rows;y++) for(let x=0;x<cols;x++) {
      const a=y*(cols+1)+x,b=a+1,c=a+cols+1,d=c+1;indices.push(a,b,c,b,d,c);
    }
    const mask=document.createElement('canvas');mask.width=128;mask.height=Math.round(128*H/W);
    const mw=mask.width,mh=mask.height;
    const ctx=mask.getContext('2d',{willReadFrequently:true});
    for(const [id,p] of Object.entries(cfg.parts)) {
      if(id==='body'||!p.swing) continue;
      const L=lay[id],x=L.left+L.piv[0],y=L.top+L.piv[1];
      // A tiny leftover sliver is not a separate leg; it follows the surrounding skin.
      if(L.w*L.h<W*H*.003) continue;
      ctx.clearRect(0,0,mw,mh);ctx.drawImage(imgs[id],L.left*mw/W,L.top*mh/H,L.w*mw/W,L.h*mh/H);
      const alpha=soften(ctx.getImageData(0,0,mw,mh).data,mw,mh,Math.max(2,Math.round(Math.min(mw,mh)*.025)));
      const joint=Math.min(W,H)*.13, influence=new Float32Array(base.length/2);
      for(let i=0;i<influence.length;i++) {
        const u=base[i*2],v=base[i*2+1],ix=u/W*mw,iy=v/H*mh;
        if(ix<0||iy<0||ix>=mw-1||iy>=mh-1) continue;
        const ax=Math.floor(ix),ay=Math.floor(iy),fx=ix-ax,fy=iy-ay;
        const a=alpha[ay*mw+ax]*(1-fx)+alpha[ay*mw+ax+1]*fx;
        const b=alpha[(ay+1)*mw+ax]*(1-fx)+alpha[(ay+1)*mw+ax+1]*fx;
        influence[i]=(a*(1-fy)+b*fy)*smooth((Math.hypot(u-x,v-y)-joint*.25)/joint);
      }
      bones.push({id,x,y});weights.push(influence);
    }
    // Overlapping masks share a single displacement rather than adding full rotations.
    for(let i=0;i<base.length/2;i++) {
      const sum=weights.reduce((n,w)=>n+w[i],0);
      if(sum>1) weights.forEach(w=>w[i]/=sum);
    }
    const mesh={base:new Float32Array(base),bones,weights,indices:new Uint16Array(indices),stepX,stepY};
    mesh.strength=safeStrength(mesh,cfg);
    const canvas=document.createElement('canvas');canvas.className='pr-skin';canvas.width=W+2*pad;canvas.height=H+2*pad;
    canvas.style.cssText=`position:absolute;left:${-pad}px;top:${-pad}px;width:${canvas.width}px;height:${canvas.height}px;pointer-events:none`;
    const fallback=original; fallback.className='pr-skin-fallback';fallback.alt='';fallback.draggable=false;
    fallback.style.cssText=`position:absolute;left:0;top:0;width:${W}px;height:${H}px;pointer-events:none`;
    const gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:true,preserveDrawingBuffer:true});
    let program,buffer,indexBuffer,uvBuffer,texture,lost=!gl,disposed=false;
    const showFallback=()=>{lost=true;canvas.hidden=true;fallback.hidden=false;};
    const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader));gl.attachShader(program,shader);gl.deleteShader(shader);};
    function init() {
      program=gl.createProgram();
      compile(gl.VERTEX_SHADER,'attribute vec2 pos; attribute vec2 uv; varying vec2 tex; uniform vec2 size; uniform float pad; void main(){tex=uv;vec2 p=(pos+pad)/size;gl_Position=vec4(p.x*2.0-1.0,1.0-p.y*2.0,0.0,1.0);}');
      compile(gl.FRAGMENT_SHADER,'precision mediump float; varying vec2 tex; uniform sampler2D image; void main(){if(tex.x<0.0||tex.y<0.0||tex.x>1.0||tex.y>1.0)discard;gl_FragColor=texture2D(image,tex);}');
      gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
      gl.useProgram(program);
      buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,mesh.base,gl.DYNAMIC_DRAW);
      const pos=gl.getAttribLocation(program,'pos');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
      uvBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,uvBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(uv),gl.STATIC_DRAW);
      const tex=gl.getAttribLocation(program,'uv');gl.enableVertexAttribArray(tex);gl.vertexAttribPointer(tex,2,gl.FLOAT,false,0,0);
      indexBuffer=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indexBuffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,mesh.indices,gl.STATIC_DRAW);
      texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,original);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.uniform2f(gl.getUniformLocation(program,'size'),canvas.width,canvas.height);gl.uniform1f(gl.getUniformLocation(program,'pad'),pad);
      gl.viewport(0,0,canvas.width,canvas.height);lost=false;fallback.hidden=true;canvas.hidden=false;
    }
    if(gl) {try {init();} catch(e) {showFallback();console.warn('Continuous pet skin unavailable',e);} }
    else showFallback();
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();showFallback();});
    canvas.addEventListener('webglcontextrestored',()=>{if(disposed)return;try{init();}catch{showFallback();}});
    return {canvas,fallback,mesh,gl,
      draw(phase,scale) {
        if(lost||disposed)return;
        const result=deform(mesh,bones.map(b=>BCT.petRig.math.swingAngle(cfg.parts[b.id].swing,phase,scale)*Math.PI/180));
        gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,result.positions);
        gl.clear(gl.COLOR_BUFFER_BIT);gl.drawElements(gl.TRIANGLES,indices.length,gl.UNSIGNED_SHORT,0);
        this.last=result;
      },
      destroy(){disposed=true;if(gl){gl.deleteTexture(texture);gl.deleteBuffer(buffer);gl.deleteBuffer(uvBuffer);gl.deleteBuffer(indexBuffer);gl.deleteProgram(program);gl.getExtension('WEBGL_lose_context')?.loseContext();}}
    };
  }
  BCT.petSkin={create,deform};
})();
