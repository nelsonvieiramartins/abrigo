import assert from 'node:assert/strict';
import {presetCharacter,validateSpec} from '../src/schema';
import {createCharacter} from '../src/character';

const spec=presetCharacter('nightshift');
assert.equal(spec.outfit.top,'nightshift');
assert.deepEqual(validateSpec(JSON.parse(JSON.stringify(spec))),spec);
for(const detail of ['low','high','uhd'] as const){
 const model=createCharacter(spec,{detail});
 for(const name of ['nightshift-wine-inset','nightshift-corset','nightshift-necklace','nightshift-stockingL','nightshift-stockingR'])assert(model.root.getObjectByName(name),name);
 for(const motion of ['idle','walk','run','pickup','pray'] as const){
  model.update(.37,motion);model.root.updateMatrixWorld(true);
  model.root.traverse((o:any)=>{if(o.isMesh)for(const v of o.geometry.getAttribute('position').array)assert(Number.isFinite(v));});
 }
 console.log(detail,model.stats);model.dispose();
}
