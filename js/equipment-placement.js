/* Device-local equipment anchors. Species + evolution + item are independent.
 * Keep the existing scale/rotation and the built-in anchors for exact reset. */
(function () {
  const BCT=window.BCT, art=BCT.art, table=art.ITEM_ANCHOR;
  const KEY='bct-equipment-placements-v1', defaults=JSON.parse(JSON.stringify(table));
  let saved={}, draft=null, revision=0;
  const key=(type,stage,id)=>`${type}/${stage}/${id}`;
  function valid(type,stage,id,p) {
    return ['dolphin','turtle','hermit'].includes(type)&&[1,2,3].includes(Number(stage))&&
      BCT.ITEMS.some(it=>it.id===id&&['head','acc'].includes(it.slot))&&
      p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=-20&&p.x<=220&&p.y>=-20&&p.y<=220;
  }
  function original(type,stage,id) {
    const slot=BCT.ITEMS.find(it=>it.id===id)?.slot;
    return defaults[type]?.[stage]?.[id]||art.ANCHOR[type]?.[stage]?.[slot];
  }
  function apply(type,stage,id,p) {
    const entries=(table[type]??={})[stage]??={};
    if(p) entries[id]={...original(type,stage,id),x:p.x,y:p.y};
    else if(defaults[type]?.[stage]?.[id])entries[id]={...defaults[type][stage][id]};
    else delete entries[id];
    revision++;
  }
  try {
    const data=JSON.parse(localStorage.getItem(KEY)||'{}');
    for(const [k,p] of Object.entries(data||{})) {
      const [t,s,id]=k.split('/');
      if(valid(t,s,id,p)){saved[k]={x:p.x,y:p.y};apply(t,s,id,p);}
    }
  } catch { /* A corrupt/disabled local store must not prevent startup. */ }
  function cancel() {
    if(!draft)return;
    const {type,stage,id}=draft;draft=null;apply(type,stage,id,saved[key(type,stage,id)]);
  }
  BCT.equipmentPlacement={
    get revision(){return revision;},
    get(type,stage,id){return {...art.anchorFor(type,stage,BCT.ITEMS.find(it=>it.id===id)?.slot,id)};},
    preview(type,stage,id,p){
      if(!valid(type,stage,id,p))return false;
      if(draft&&key(type,stage,id)!==key(draft.type,draft.stage,draft.id))cancel();
      draft={type,stage,id};apply(type,stage,id,p);return true;
    },
    cancel,
    save(type,stage,id,reset=false){
      const p=this.get(type,stage,id);if(!valid(type,stage,id,p))return false;
      const next={...saved},k=key(type,stage,id);
      if(reset)delete next[k];else next[k]={x:p.x,y:p.y};
      try{localStorage.setItem(KEY,JSON.stringify(next));}catch{return false;}
      saved=next;draft=null;apply(type,stage,id,saved[k]);return true;
    },
  };
})();
