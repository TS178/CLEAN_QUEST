// node tools/import-habitat-sizes.mjs <administrator-export.json> [--check]
// Validates before writing. Never commits or pushes automatically.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const ROOT=fileURLToPath(new URL('../',import.meta.url));

export function importHabitatSizes(file,{root=ROOT,check=false}={}){
  if(fs.statSync(file).size>100000)throw Error('設定ファイルが大きすぎます。');
  const ctx=vm.createContext({window:{}});
  for(const f of ['config','items','habitat-size-schema','habitat-size-defaults'])vm.runInContext(fs.readFileSync(path.join(root,'js',f+'.js'),'utf8'),ctx,{filename:f+'.js'});
  const B=ctx.window.BCT,data=B.habitatSizeSchema.validate(JSON.parse(fs.readFileSync(file,'utf8'))),old=B.HABITAT_SIZE_DEFAULTS;
  if(data.baseRevision!==old.revision)throw Error(`配布設定の版が一致しません（ファイル ${data.baseRevision}／現在 ${old.revision}）。最新アプリで調整し直して書き出してください。`);
  const canonical=v=>JSON.stringify(Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))));
  if(canonical(data.sizes)===canonical(old.sizes))return {changed:false,revision:old.revision};
  const configFile=path.join(root,'js/habitat-size-defaults.js'),workerFile=path.join(root,'service-worker.js');
  const beforeConfig=fs.readFileSync(configFile,'utf8'),beforeWorker=fs.readFileSync(workerFile,'utf8');
  const match=beforeWorker.match(/const APP_VERSION = "1\.(\d+)";/);
  if(!match)throw Error('アプリのバージョン番号を確認できません。ファイルは変更しません。');
  const version='1.'+(Number(match[1])+1),revision=old.revision+1;
  const config='/* Published furniture sizes. Import an administrator export with tools/import-habitat-sizes.mjs. */\nwindow.BCT = window.BCT || {};\nwindow.BCT.HABITAT_SIZE_DEFAULTS = '+JSON.stringify({revision,sizes:JSON.parse(canonical(data.sizes))})+';\n';
  const worker=beforeWorker.replace(match[0],`const APP_VERSION = "${version}";`);
  const result={changed:true,revision,appVersion:version,count:Object.keys(data.sizes).length};
  if(check)return result;
  const tmpConfig=configFile+'.import-'+process.pid,tmpWorker=workerFile+'.import-'+process.pid;
  let replaced=false;
  try{
    fs.writeFileSync(tmpConfig,config);fs.writeFileSync(tmpWorker,worker);
    fs.renameSync(tmpConfig,configFile);replaced=true;fs.renameSync(tmpWorker,workerFile);
  }catch(e){if(replaced)fs.writeFileSync(configFile,beforeConfig);throw e;}
  finally{for(const f of [tmpConfig,tmpWorker])if(fs.existsSync(f))fs.unlinkSync(f);}
  return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const args=process.argv.slice(2),files=args.filter(a=>a!=='--check');
    if(files.length!==1)throw Error('使い方: node tools/import-habitat-sizes.mjs <配布用設定.json> [--check]');
    const result=importHabitatSizes(path.resolve(files[0]),{check:args.includes('--check')});
    console.log(JSON.stringify(result,null,2));
    console.log(result.changed?(args.includes('--check')?'確認のみ。ファイルは変更していません。':'設定とアプリ版を更新しました。差分を確認してGitHubへコミット・プッシュしてください。'):'配布中の設定と同じです。変更はありません。');
  }catch(e){console.error(e.message);process.exitCode=1;}
}
