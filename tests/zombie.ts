import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createCharacter,EXPRESSIONS} from '../src/character';
import {presetCharacter,randomCharacter,validateSpec,MOTIONS,OPTIONS,type Motion} from '../src/schema';
import {categoryOf,categoryOptions,characterStorageKey,randomVillain,readCategoryDraft} from '../src/character-categories';
const spec=presetCharacter('zumbi');assert.deepEqual(validateSpec(JSON.parse(JSON.stringify(spec))),spec);
assert.deepEqual(spec.body,presetCharacter('lenhador').body);
assert.equal(spec.items.object,'none');assert.equal(spec.name,'Zumbi');assert.equal(categoryOf(spec),'villains');
assert.equal(randomCharacter('Nelson').profession,'ranger');
assert.deepEqual(randomVillain('Nelson'),randomVillain('Nelson'));assert.notDeepEqual(randomVillain('Nelson'),randomVillain('Outro'));
assert.notDeepEqual(randomVillain('Nelson').body,randomCharacter('Nelson').body);
for(let i=0;i<50;i++){const v=randomVillain(String(i));assert.equal(v.profession,'zumbi');assert.equal(v.seed,String(i));assert(Object.hasOwn(categoryOptions(OPTIONS.top,'villains','top'),v.outfit.top));}
assert(!Object.hasOwn(categoryOptions(OPTIONS.top,'characters','top'),'zombie'));
for(const id of Object.keys(categoryOptions(OPTIONS.top,'characters','top')))assert(Object.hasOwn(categoryOptions(OPTIONS.top,'villains','top'),id),'Villains keep every manual clothing control');
assert.deepEqual(Object.keys(categoryOptions(OPTIONS.profession,'villains','profession')),['zumbi']);
assert(!Object.hasOwn(categoryOptions(OPTIONS.profession,'characters','profession'),'zumbi'));
const values=new Map<string,string>(),storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);}};
storage.setItem(characterStorageKey('characters'),JSON.stringify(spec));
assert.equal(readCategoryDraft(storage,'characters').profession,'ranger');assert.deepEqual(readCategoryDraft(storage,'villains'),spec);
const human=presetCharacter('lenhador');storage.setItem(characterStorageKey('characters'),JSON.stringify(human));
assert.deepEqual(readCategoryDraft(storage,'characters'),human);assert.deepEqual(readCategoryDraft(storage,'villains'),spec);
const counts:number[]=[];
for(const detail of ['low','high','uhd'] as const){
 const m=createCharacter(spec,{detail});counts.push(m.stats.triangles);assert.equal(m.detail,detail);
 for(const name of ['head-shape','torso','upper-armR','handR','footR'])assert(m.root.getObjectByName(name),name);
 for(const name of ['zombie-sunken-orbit','zombie-cheek-wound','zombie-undershirt-lining','zombie-ragged-sleeveR-lining','bare-upper-armR'])assert(m.root.getObjectByName(name),name);
 assert(!m.root.getObjectByName('cuffR'),'ragged sleeves expose the normal tapered skin forearm');
 assert((m.root.getObjectByName('torso') as THREE.Mesh).userData.tornTriangles>0,'jacket has real removed triangles');
 if(detail!=='low')assert(m.root.getObjectByName('zombie-open-mouth-lining'),'mouth opening is cut into the shared head');
 m.root.traverse(o=>{if(o instanceof THREE.Mesh)for(const attr of ['position','normal','color']){const a=o.geometry.getAttribute(attr);if(attr==='color'&&o instanceof THREE.InstancedMesh)continue;assert(a,`${o.name}: ${attr}`);for(const v of a.array)assert(Number.isFinite(v));}});
 for(const motion of Object.keys(MOTIONS) as Motion[])for(const t of [0,.17,.63,.96,1.9]){m.update(t,motion);m.root.updateMatrixWorld(true);for(const n of Object.values(m.nodes))for(const v of n.matrixWorld.elements)assert(Number.isFinite(v));}
 for(const expression of Object.keys(EXPRESSIONS) as (keyof typeof EXPRESSIONS)[]){m.setExpression(expression,1,true);m.update(.3);}
 m.update(.63,'walk');const hand=m.sockets.handR.getWorldPosition(new THREE.Vector3());m.update(.17,'walk');assert(hand.distanceTo(m.sockets.handR.getWorldPosition(new THREE.Vector3()))>.01);
 m.dispose();
}
assert(counts[1]>counts[0]*3);assert(counts[2]>counts[1]);
for(const shoes of ['wornSneakers','wornBoots','singleSneakerLeft','singleSneakerRight','barefoot'])for(const detail of ['low','high'] as const){
 const m=createCharacter({...spec,outfit:{...spec.outfit,shoes}},{detail});
 const leftBare=shoes==='barefoot'||shoes==='singleSneakerRight',rightBare=shoes==='barefoot'||shoes==='singleSneakerLeft';
 for(const [suffix,bare] of [['L',leftBare],['R',rightBare]] as const){
  assert(!m.root.getObjectByName('bare-foot'+suffix),'zombies never expose a completely barefoot foot');
  assert.equal(!!m.root.getObjectByName('sock'+suffix),bare,'per-foot worn sock selection');
  if(bare)assert((m.root.getObjectByName('sock'+suffix) as THREE.Mesh).userData.tornTriangles>0,'worn sock has a real hole');
  if(!bare)assert((m.root.getObjectByName('shoe'+suffix) as THREE.Mesh).userData.tornTriangles>0,'worn footwear has real holes in both detail levels');
 }
 m.update(.5,'walk');m.root.updateMatrixWorld(true);m.root.traverse(o=>assert(o.matrixWorld.elements.every(Number.isFinite)));m.dispose();
}
const held=presetCharacter('zumbi');held.items.object='axe';held.items.placement='right';
const item=createCharacter(held,{detail:'low'});const axe=item.sockets.handR.getObjectByName('item-axe')!;assert(axe);assert.equal(axe.parent,item.sockets.handR);item.update(.4,'attackLateral');assert.equal(axe.parent,item.sockets.handR);item.dispose();
console.log('Zumbi: standard Lenhador body, rounded LODs, facial expressions, all motions, item sockets, separate villain seeds/wardrobe and legacy draft migration passed.');
