/* Approved painted character art. All images are embedded for offline use and photo export. */
(function () {
  const BCT = window.BCT, SPRITES = BCT.PET_SPRITES;
  let uid = 0;
  const nid = p => `${p}${++uid}`;
  const STAGE_SCALE = {1: .82, 2: .93, 3: 1};
  // Longer fins and broader shells need extra room in the final form.
  const BODY_BOX = {1: [20,38,160,146], 2: [20,38,160,146], 3: [10,26,180,158]};
  function sprite(id, x, y, width, height, fit = 'xMidYMid meet') {
    const a = SPRITES[id];
    return a ? `<image data-sprite="${id}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="${fit}" href="${a.src}"/>` : '';
  }
  function sparkle(x, y, s) {
    return `<path class="sparkle" fill="#ffe48c" stroke="#fffaf0" stroke-width="1" d="M${x} ${y-s}Q${x+s*.2} ${y-s*.2} ${x+s} ${y}Q${x+s*.2} ${y+s*.2} ${x} ${y+s}Q${x-s*.2} ${y+s*.2} ${x-s} ${y}Q${x-s*.2} ${y-s*.2} ${x} ${y-s}Z"/>`;
  }
  function note(x, y, s) {
    return `<g transform="translate(${x} ${y}) scale(${s})" fill="#ba9ee8"><ellipse cx="0" cy="10" rx="6" ry="4.5"/><path d="M4 10V-12h3q9 3 8 10Q10-7 7-7v17Z"/></g>`;
  }
  const anchor = (x,y,r=0,s=1) => ({x,y,r,s});
  const ANCHOR = {
    dolphin: {1:{head:anchor(106,52,-9),acc:anchor(116,126,-13)},2:{head:anchor(112,48,-9,.95),acc:anchor(126,113,-13,.85)},3:{head:anchor(136,60,-9,.85),acc:anchor(140,120,-13,.85)}},
    turtle: {1:{head:anchor(132,60,-5,.95),acc:anchor(136,132,0,.9)},2:{head:anchor(145,57,-5,.9),acc:anchor(146,123,0,.85)},3:{head:anchor(152,46,-5,.82),acc:anchor(150,106,0,.8)}},
    hermit: {1:{head:anchor(81,63,-12,.92),acc:anchor(58,139,-12,.9)},2:{head:anchor(81,53,-12,.92),acc:anchor(57,137,-12,.9)},3:{head:anchor(85,51,-12,.85),acc:anchor(55,130,-12,.9)}}
  };
  const SIZE = {
    head_straw:[84,58],head_marine:[68,49],head_flower:[41,30],head_shell:[40,33],head_crown:[55,44],reward_clean_hat:[74,59],
    accessory_ribbon:[43,31],accessory_scarf:[67,48],accessory_pendant:[46,43],accessory_badge:[28,28],reward_guardian_medal:[28,43]
  };
  const ITEM_ART = Object.fromEntries(Object.entries(SIZE).map(([id,[w,h]]) => [id, () => sprite(id,-w/2,BCT.itemOf(id).slot==='head'?-h+11:-h*.3,w,h)]));
  function placed(id,a) {
    return ITEM_ART[id] ? `<g data-item="${id}" transform="translate(${a.x} ${a.y}) rotate(${a.r}) scale(${a.s})">${ITEM_ART[id]()}</g>` : '';
  }
  const LOOK_REGION = {
    dolphin:{
      1:{box:[38,58,50,68],path:'M43 76Q48 54 78 49L88 80Q73 87 68 108L48 126Q33 111 43 76Z'},
      2:{box:[46,61,50,64],path:'M46 94Q50 66 80 58L96 72Q76 88 77 113L55 133Q40 116 46 94Z'},
      3:{box:[83,64,48,60],path:'M86 100Q99 72 122 66L132 82Q116 94 116 112L89 128Q80 117 86 100Z'}
    },
    turtle:{
      1:{box:[26,80,72,74],path:'M27 131Q30 93 62 82Q77 69 104 71Q91 87 89 112Q88 133 103 145Q66 164 34 147Z'},
      2:{box:[35,76,76,66],path:'M35 121Q48 83 87 74L115 74Q102 91 106 112L88 141Q51 151 35 132Z'},
      3:{box:[34,67,84,71],path:'M35 116Q54 83 91 64L125 58Q119 82 121 101Q106 128 78 141L31 143Z'}
    },
    hermit:{
      1:{box:[25,61,85,88],path:'M25 122Q12 91 49 65Q81 47 113 61L119 89Q87 110 74 144L38 155Z'},
      2:{box:[27,54,88,86],path:'M29 112Q15 79 47 44Q79 37 119 70L124 87Q100 87 85 117L58 145Q37 137 29 112Z'},
      3:{box:[24,58,101,81],path:'M14 116Q5 94 36 61Q63 40 113 47L143 59Q141 78 113 91L83 113Q63 135 32 143Z'}
    }
  };
  const LOOK_ART = Object.fromEntries(BCT.ITEMS.filter(it=>it.slot==='look').map(it=>[it.id,(stage=2)=>{
    const a=LOOK_REGION[it.only][stage],clip=nid('look');
    return `<defs><clipPath id="${clip}"><path d="${a.path}"/></clipPath></defs><g data-look="${it.id}" clip-path="url(#${clip})" opacity=".88">${sprite(it.id,...a.box)}</g>`;
  }]));
  const TOY_ART = Object.fromEntries(['toy_ball','toy_bubbles','toy_music'].map(id=>[id,()=>sprite(id,-22,-22,44,44)]));
  const pose = (body='',face='normal',toy=null,fx='') => ({body,face,toy,fx});
  const POSE = {
    normal:{dolphin:pose(),turtle:pose(),hermit:pose()},
    smile:{dolphin:pose('rotate(-3 100 112)','happy',null,'sparkles'),turtle:pose('rotate(-3 100 112)','happy',null,'sparkles'),hermit:pose('rotate(-3 100 112)','happy',null,'sparkles')},
    toy_ball:{dolphin:pose('translate(-8 12) rotate(-17 100 112)','happy',[171,66,.88]),turtle:pose('translate(-9 0) rotate(-5 100 112)','happy',[175,165,.82]),hermit:pose('translate(-8 0) rotate(-3 100 112)','happy',[171,166,.84])},
    toy_bubbles:{dolphin:pose('translate(0 -8) rotate(-10 100 112)','happy',null,'ring'),turtle:pose('translate(0 -3)','happy',null,'ring'),hermit:pose('rotate(-4 100 120)','happy',[164,49,.85])},
    toy_music:{dolphin:pose('rotate(-8 100 112)','happy',[160,146,.65],'notes'),turtle:pose('rotate(6 100 112)','happy',[167,158,.65],'notes'),hermit:pose('rotate(-5 100 112)','happy',[160,146,.65],'notes')}
  };
  function render(opts = {}) {
    const type=BCT.pets.TYPE_KEYS.includes(opts.type)?opts.type:'dolphin';
    const stage=[1,2,3].includes(Number(opts.stage))?Number(opts.stage):1;
    const key=POSE[opts.pose]?opts.pose:'normal',p=POSE[key][type];
    const face=opts.face==='happy'?'happy':p.face,eq=opts.equip||{},a=ANCHOR[type][stage],scale=STAGE_SCALE[stage];
    const look=BCT.itemOf(eq.look);
    let inner=sprite(`${type}-${stage}-${face}`,...BODY_BOX[stage],'xMidYMax meet');
    if(opts.motionLayer==='overlay')inner='';
    if(look&&look.only===type&&LOOK_ART[eq.look])inner+=LOOK_ART[eq.look](stage);
    inner+=placed(eq.acc,a.acc)+placed(eq.head,a.head);
    let back='',front='';
    if(p.toy){const [x,y,s]=p.toy;front+=`<g data-item="${key}" transform="translate(${x} ${y}) scale(${s})">${TOY_ART[key]()}</g>`;}
    if(p.fx==='ring'){
      const clip=nid('ring'),ring=sprite('toy_bubbles',12,67,177,113,'none');back=ring;
      front+=`<defs><clipPath id="${clip}"><rect y="151" width="200" height="49"/></clipPath></defs><g clip-path="url(#${clip})">${ring}</g>`;
    }
    if(p.fx==='notes')front+=note(32,66,.6)+note(167,89,.5);
    if(stage===3||p.fx==='sparkles')front+=sparkle(27,62,6)+sparkle(176,112,4);
    if(opts.motionLayer==='underlay'){inner='';front='';}
    if(opts.motionLayer==='overlay')back='';
    const px=Number(opts.px)>0?`width="${Number(opts.px)}" height="${Number(opts.px)}"`:'';
    return `<svg viewBox="0 0 200 200" ${px} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${BCT.pets.TYPES[type].motif}" data-pet="${type}" data-stage="${stage}" data-face="${face}" data-pet-motion="${opts.motion===false?'off':'auto'}">${back}<g transform="${p.body}"><g data-pet-body="" transform="translate(100 174) scale(${scale}) translate(-100 -174)">${inner}</g></g>${front}</svg>`;
  }
  function itemIcon(id,petType) {
    const it=BCT.itemOf(id);if(!it)return '';
    if(it.slot==='frame')return frameThumb(id);
    if(it.slot==='look')return render({type:it.only||petType,stage:2,equip:{look:id}});
    return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${sprite(id,6,6,88,88)}</svg>`;
  }
  const FRAME_ART=Object.fromEntries(BCT.ITEMS.filter(it=>it.slot==='frame').map(it=>[it.id,(W,H)=>sprite(it.id,0,0,W,H,'none')]));
  const FRAME_BANNER={reward_event_frame:{x:.5,y:.066,size:.038,color:'#285f91'}};
  function frameSvg(id,W,H){return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${FRAME_ART[id]?FRAME_ART[id](W,H):''}</svg>`;}
  function frameThumb(id){return `<svg viewBox="0 0 300 400" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="300" height="400" fill="#f0fbff"/>${FRAME_ART[id]?FRAME_ART[id](300,400):''}</svg>`;}
  const toDataUrl=svg=>'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
  function toImage(svg){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('svg image'));img.src=toDataUrl(svg);});}

  function seaSvg(W, H) {
    const id = nid("s");
    const horizon = H * 0.42, beach = H * 0.74;
    let glints = "";
    for (let i = 0; i < 26; i++) {
      const x = ((i * 397) % 1000) / 1000 * W, y = horizon + 20 + ((i * 211) % 1000) / 1000 * (beach - horizon - 40);
      glints += `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${(W * 0.04).toFixed(0)}" height="${(H * 0.004).toFixed(0)}" rx="3" fill="#ffffff" opacity="0.7"/>`;
    }
    const shells = [[0.15, 0.86], [0.78, 0.9], [0.55, 0.82], [0.3, 0.95]].map(([x, y]) =>
      `<g transform="translate(${W * x} ${H * y}) scale(${W / 260})"><path d="M0 -1 L-12 -15 Q0 -24 12 -15Z" fill="#f3dec0" stroke="#9d7553" stroke-width="1.5"/></g>`).join("");
    return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="${id}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dbe7d6"/><stop offset="1" stop-color="#f5f1d9"/></linearGradient>
        <linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#74a8b0"/><stop offset="1" stop-color="#b4d3c3"/></linearGradient>
      </defs>
      <rect width="${W}" height="${horizon}" fill="url(#${id}a)"/>
      <circle cx="${W * 0.8}" cy="${H * 0.12}" r="${W * 0.08}" fill="#efd69d"/>
      <g fill="#ffffff" opacity="0.9"><ellipse cx="${W * 0.22}" cy="${H * 0.12}" rx="${W * 0.11}" ry="${H * 0.025}"/><ellipse cx="${W * 0.3}" cy="${H * 0.1}" rx="${W * 0.07}" ry="${H * 0.025}"/></g>
      <rect y="${horizon}" width="${W}" height="${beach - horizon}" fill="url(#${id}b)"/>
      ${glints}
      <path d="M0 ${beach} Q${W * 0.25} ${beach - H * 0.03} ${W * 0.5} ${beach} T${W} ${beach} V${H} H0Z" fill="#efdfb9"/>
      <path d="M0 ${beach} Q${W * 0.25} ${beach - H * 0.03} ${W * 0.5} ${beach} T${W} ${beach}" fill="none" stroke="#ffffff" stroke-width="${W * 0.012}" opacity="0.85"/>
      ${shells}
    </svg>`;
  }


  const EGG = "M100 18 C150 18 178 92 178 138 C178 188 142 214 100 214 C58 214 22 188 22 138 C22 92 50 18 100 18Z";
  const ZIG = [[0, 128], [20, 115], [40, 139], [60, 115], [80, 139], [100, 115], [120, 139], [140, 115], [160, 139], [180, 115], [200, 128]];
  function eggSvg(type) {
    const t = BCT.pets.TYPES[type];
    const id = nid("e");
    const zig = ZIG.map((p) => p.join(" ")).join(" L");
    const zigRev = ZIG.slice().reverse().map((p) => p.join(" ")).join(" L");
    const spots = `<circle cx="70" cy="70" r="11" fill="${t.eggSpot}"/><circle cx="128" cy="56" r="7" fill="${t.eggSpot}"/>
      <circle cx="140" cy="96" r="9" fill="${t.eggSpot}"/><circle cx="56" cy="170" r="10" fill="${t.eggSpot}"/>
      <circle cx="120" cy="186" r="12" fill="${t.eggSpot}"/><circle cx="152" cy="160" r="6" fill="${t.eggSpot}"/>`;
    const inner = render({ type, stage: 1 }).replace(/^<svg[^>]*>|<\/svg>$/g, "");
    return `<svg viewBox="0 0 200 230" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${t.egg}">
      <defs>
        <clipPath id="${id}e"><path d="${EGG}"/></clipPath>
        <clipPath id="${id}t"><path d="M0 0 L200 0 L${zigRev} Z"/></clipPath>
        <clipPath id="${id}b"><path d="M${zig} L200 230 L0 230 Z"/></clipPath>
        <radialGradient id="${id}g"><stop offset="0" stop-color="#fffbd0"/><stop offset="1" stop-color="#fffbd0" stop-opacity="0"/></radialGradient>
        <linearGradient id="${id}shell" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#fff9e5"/><stop offset=".38" stop-color="${t.eggColor}"/><stop offset="1" stop-color="${t.eggLine}"/></linearGradient>
      </defs>
      <path d="${EGG}" fill="#fff7dd"/>
      <circle class="egg-glow" cx="100" cy="126" r="74" fill="url(#${id}g)"/>
      <g transform="translate(38 54) scale(0.62)">${inner}</g>
      <g transform="translate(0 8)"><g class="shell-bottom"><g clip-path="url(#${id}e)"><g clip-path="url(#${id}b)">
        <path d="${EGG}" fill="url(#${id}shell)" stroke="#4b5e50" stroke-width="5"/>${spots}
        <path d="M45 161 Q100 208 155 161 M55 178 Q100 211 145 178" fill="none" stroke="#f6df9b" stroke-width="3"/>
        <path d="M${zig}" fill="none" stroke="${t.eggLine}" stroke-width="6" stroke-linejoin="round"/>
      </g></g></g></g>
      <g transform="translate(0 -22) rotate(-9 100 120)"><g class="shell-top"><g clip-path="url(#${id}e)"><g clip-path="url(#${id}t)">
        <path d="${EGG}" fill="url(#${id}shell)" stroke="#4b5e50" stroke-width="5"/>${spots}
        <path d="M49 88 Q61 45 86 37" fill="none" stroke="#fffdf1" stroke-opacity=".7" stroke-width="9" stroke-linecap="round"/>
        <path d="M${zig}" fill="none" stroke="${t.eggLine}" stroke-width="6" stroke-linejoin="round"/>
      </g></g></g></g>
    </svg>`;
  }


  function icon(key) {
    const art = {
      home: '<path d="M5 14 16 5 27 14" fill="#dfb967"/><path d="M8 13v14h16V13L16 7Z" fill="#f6edd4"/><path d="M13 27v-9h6v9" fill="#75a89b"/>',
      mission: '<circle cx="16" cy="16" r="12" fill="#e6c378"/><circle cx="16" cy="16" r="8" fill="#fffae9"/><circle cx="16" cy="16" r="3" fill="#c67b57"/><path d="m16 16 11-11m-5 0h5v5" fill="none"/>',
      capture: '<path d="m6 10 5-1 2-4h7l2 4 5 1v16H5V10Z" fill="#8eafac"/><circle cx="16" cy="17" r="6" fill="#fff5d7"/><circle cx="16" cy="17" r="3" fill="#477887"/><path d="M24 13h1"/>',
      shop: '<path d="M7 12h18l2 15H5Z" fill="#edd19a"/><path d="M11 13V9a5 5 0 0 1 10 0v4" fill="none"/><path d="m16 16 2 3 4 1-3 3v3l-3-2-3 2v-3l-3-3 4-1Z" fill="#679785" stroke-width="1"/>',
      me: '<path d="m10 19-2 10 8-4 8 4-2-10" fill="#729d90"/><circle cx="16" cy="13" r="10" fill="#edcc7c"/><path d="m16 6 2 5 5 1-4 3 1 5-4-3-4 3 1-5-4-3 5-1Z" fill="#fffae4" stroke-width="1.2"/>',
      sea: '<path d="M3 20Q7 8 15 11q6 2 2 7 8 2 12-8v14Q19 31 3 25Z" fill="#5d99aa"/><path d="M4 24q8-8 15-2t10-3M5 17q5-8 9-3" fill="none" stroke="#fff9e3"/><circle cx="24" cy="6" r="3" fill="#e3b963"/>',
      head: '<path d="M9 19 11 6h10l2 13" fill="#edd4a1"/><path d="M10 14h12v5H10Z" fill="#729a8c"/><ellipse cx="16" cy="21" rx="13" ry="4" fill="#e8c382"/>',
      acc: '<path d="m15 16-10-8v17l10-7m2-2 10-8v17l-10-7" fill="#c5775d"/><circle cx="16" cy="17" r="3" fill="#e9b88e"/>',
      look: '<path d="M16 3q1 11 12 13-11 1-12 13Q14 18 4 16 14 14 16 3Z" fill="#e9c570"/><path d="m25 3 1 4 4 1-4 1-1 4-1-4-4-1 4-1Z" fill="#90b6a2" stroke-width="1"/>',
      toy: '<circle cx="16" cy="16" r="12" fill="#f5e8bf"/><path d="M16 4q-10 9 0 24M16 4q10 9 0 24" fill="#81aeb5"/><path d="M4 16h24" fill="none"/>',
      frame: '<rect x="5" y="3" width="22" height="26" rx="2" fill="#e5c17c"/><rect x="8" y="6" width="16" height="20" fill="#e3efe6"/><path d="m9 23 5-7 4 4 3-3 3 6" fill="#88ad91"/><circle cx="19" cy="11" r="2" fill="#e5c17c"/>',
      dress: '<path d="m11 5-8 6 4 7 4-2v12h10V16l4 2 4-7-8-6q-5 6-10 0Z" fill="#94b5a1"/><path d="m14 13 2 2 2-2" fill="none" stroke="#fff9e7"/>',
      pet: '<path d="M10 17V9q0-4 3-2V5q1-3 3-1v2q3-3 4 1v3q3-2 3 2v7q6-5 6-1l-5 9H11L5 19q-2-5 2-3l3 3" fill="#e8c7a1"/>',
      map: '<path d="m3 8 9-4 8 4 9-4v21l-9 4-8-4-9 4Z" fill="#dbe5ce"/><path d="M12 4v21M20 8v21" fill="none" stroke="#a8b598"/><path d="M20 18s5-5 5-9a5 5 0 0 0-10 0c0 4 5 9 5 9Z" fill="#ce8866"/><circle cx="20" cy="9" r="1.5" fill="#fff4d9"/>',
      gift: '<path d="M6 14h20v14H6Z" fill="#e9c88c"/><path d="M4 10h24v6H4Z" fill="#f4dfae"/><path d="M14 10h4v18h-4Z" fill="#8ab29a"/><path d="M16 10C3 11 8-2 16 10c12 0 7-12 0 0Z" fill="#8ab29a"/>',
      quiz: '<path d="M5 4h22v22H18l-5 4v-4H5Z" fill="#f2dfad"/><path d="M12 11a4 4 0 1 1 6 4q-2 1-2 3M16 22v.1" fill="none" stroke-width="2.5"/>',
      clean: '<path d="m24 3-12 16" fill="none" stroke="#9d7545" stroke-width="4"/><path d="m10 15 9 6-7 9-10-7Z" fill="#dec486"/><path d="m8 21-3 4m7-1-3 4" fill="none"/>',
      coin: '<circle cx="16" cy="16" r="12" fill="#e2bd68"/><circle cx="16" cy="16" r="9" fill="#f8e4a6" stroke="#b48a40"/><path d="M10 17q3-5 6-1t6-1" fill="none" stroke="#957033" stroke-width="2"/>',
    };
    return `<svg class="ui-icon" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g stroke="#354942" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${art[key] || art.look}</g></svg>`;
  }

  BCT.art = {
    render, itemIcon, icon, eggSvg, seaSvg, frameSvg, frameThumb, FRAME_BANNER, toDataUrl, toImage,
    ANCHOR, POSE, ITEM_ART, LOOK_ART, TOY_ART, FRAME_ART,
  };
})();
