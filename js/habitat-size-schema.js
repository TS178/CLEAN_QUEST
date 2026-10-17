/* Shared validation for browser export and the repository import command. */
(function(){
  const B=window.BCT,TYPES=['dolphin','turtle','hermit'];
  const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
  function validKey(key,n){
    if(typeof key!=='string')return false;
    const parts=key.split('/'),[type,id]=parts,it=B.itemOf(id);
    return parts.length===2&&TYPES.includes(type)&&it?.slot==='home'&&(!it.only||it.only===type)&&Number.isFinite(n)&&n>=.25&&n<=2.5;
  }
  function clean(sizes){const out={};if(object(sizes))for(const [k,n]of Object.entries(sizes))if(validKey(k,n))out[k]=n;return out;}
  function validate(data){
    if(!object(data)||data.format!=='clean-quest-habitat-sizes'||data.version!==1)throw Error('置物サイズの配布用設定ファイルではありません。');
    if(!Number.isSafeInteger(data.baseRevision)||data.baseRevision<0)throw Error('配布設定の版が不正です。');
    if(!object(data.sizes)||Object.keys(data.sizes).length>100)throw Error('サイズ一覧が不正です。');
    for(const [k,n]of Object.entries(data.sizes))if(!validKey(k,n))throw Error('不正な置物サイズ: '+k);
    return {format:data.format,version:1,baseRevision:data.baseRevision,sizes:clean(data.sizes)};
  }
  B.habitatSizeSchema={validKey,clean,validate};
})();
