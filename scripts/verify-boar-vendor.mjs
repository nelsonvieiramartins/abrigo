import {readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../vendor/threejs-procedural-animals/',import.meta.url);
const manifestUrl=new URL('../docs/boar-vendor-lock.json',import.meta.url);
async function roster(dir=root,prefix=''){
 const files=[];for(const e of await readdir(dir,{withFileTypes:true})){
  assert(!e.isSymbolicLink(),'No links allowed in vendored source');
  const name=prefix+e.name,url=new URL(e.name+(e.isDirectory()?'/':''),dir);
  if(e.isDirectory())files.push(...await roster(url,name+'/'));
  else{const bytes=await readFile(url);files.push({path:name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
 }return files.sort((a,b)=>a.path.localeCompare(b.path));
}
const files=await roster();
if(process.argv.includes('--record')){
 await writeFile(manifestUrl,JSON.stringify({version:1,source:'https://github.com/majidmanzarpour/threejs-procedural-animals',commit:'c95ae49346aa8e140a924376cec6cf0073d99512',license:'MIT',integration:'Manual pinned source integration; game-dev unavailable. Not a Game Development Studio admission receipt.',files},null,2)+'\n');
}else{
 const manifest=JSON.parse(await readFile(manifestUrl,'utf8'));assert.deepEqual(files,manifest.files,'Vendored source differs from the closed hash roster');
}
console.log(`Javali: ${files.length} original files verified (SHA-256, byte sizes, closed roster).`);
