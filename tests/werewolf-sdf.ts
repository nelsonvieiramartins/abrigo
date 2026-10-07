import assert from 'node:assert/strict';
import * as THREE from 'three';
import {presetCreature,randomCreature,CREATURE_FIELDS,validateCreatureSpec} from '../src/creature-schema';
import {buildWerewolfSdfData,createWerewolfSdf} from '../src/werewolf-sdf-detail';
import {werewolfSdfSpecies} from '../src/werewolf-sdf-species';
import {buildSync} from '../vendor/threejs-procedural-animals/src/core/build/pipeline.js';
import {wolfSdfSeed} from '../src/wolf-sdf-detail';
const spec=presetCreature('werewolfSdf');assert.deepEqual(validateCreatureSpec(JSON.parse(JSON.stringify(spec))),spec);
for(const detail of ['low','high'] as const){
 const data=buildWerewolfSdfData(spec,detail);console.log('Werewolf SDF',detail,data.nV,data.index.length/3);
 assert(data.index.length/3<160000);assert(data.bones.length===20);assert(data.coat.some((v:number,i:number)=>i%4===2&&v>.02));
 const direct=buildSync(werewolfSdfSpecies(spec),{seed:wolfSdfSeed(spec.seed),quality:detail});
 for(const key of ['pos','nrm','skinIndex','skinWeight','tint','coat','index'])assert.deepEqual(data[key],direct[key],key+' deterministic SDF');
 for(const compatible of [false,true]){
  const w=createWerewolfSdf(spec,detail,compatible);w.update(0,'idle');const rest=new THREE.Box3().setFromObject(w.root),arm=w.sockets.handR.getWorldPosition(new THREE.Vector3());
  assert(rest.max.y>2.6&&rest.max.y<3.1);assert(rest.min.y>-.055);
  w.update(10,'attack');w.update(10.10,'attack');const raised=w.sockets.handR.getWorldPosition(new THREE.Vector3());assert(raised.y>w.nodes.head.getWorldPosition(new THREE.Vector3()).y);
  w.update(10.22,'attack');assert(w.nodes.hips.position.z>.3);assert(w.sockets.handR.getWorldPosition(new THREE.Vector3()).y<raised.y-.7);
  w.update(10.61,'attack');assert.equal(w.nodes.hips.position.z,0);assert.equal(w.nodes.jaw.rotation.x,0);
  for(const motion of ['idle','move','run','attack'] as const){w.update(0,motion);for(const t of [.07,.15,.22,.38,.61,1.2]){w.update(t,motion);const b=new THREE.Box3().setFromObject(w.root);assert(b.min.y>-.07,`${detail}/${motion}/${t} floor ${b.min.y}`);}}
  w.update(0,'idle');assert(w.sockets.handR.getWorldPosition(new THREE.Vector3()).distanceTo(arm)<1e-7);
  const scene=new THREE.Scene();scene.add(w.root);w.root.position.set(8,2,-4);w.root.rotation.y=.8;w.update(.22,'run');assert.deepEqual(w.root.position.toArray(),[8,2,-4]);assert.equal(w.root.rotation.y,.8);
  const resources=new Set<any>();w.root.traverse(o=>{if(o instanceof THREE.Mesh){resources.add(o.geometry);resources.add(o.material);}});let released=0;resources.forEach(r=>r.addEventListener('dispose',()=>released++));w.dispose();w.dispose();assert.equal(released,resources.size);
 }
}
const samples=Array.from({length:5},(_,i)=>randomCreature(String(i),'werewolfSdf'));
for(const edge of ['min','max'] as const){const s=presetCreature('werewolfSdf');for(const f of CREATURE_FIELDS.werewolfSdf)s.anatomy[f.key]=f[edge];s.body.bulk=edge==='min'?0:1;samples.push(s);}
for(const s of samples)for(const detail of ['low','high'] as const){const w=createWerewolfSdf(s,detail);assert(w.stats.triangles<160000);for(const motion of ['idle','move','run','attack'] as const){w.update(0,motion);for(const t of [.1,.22,.4,.61]){w.update(t,motion);assert(new THREE.Box3().setFromObject(w.root).min.y>-.07*s.body.scale);}}w.dispose();}
console.log('Werewolf SDF: custom biped, deterministic mesh/coat/rig, overhead strike, recovery, floor, root and fallback passed.');
