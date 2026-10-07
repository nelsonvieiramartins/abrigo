import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createCreature} from '../src/creature';
import {presetCreature,randomCreature,validateCreatureSpec} from '../src/creature-schema';
import {buildTarantulaSdfData,tarantulaSdfSeed,TARANTULA_SDF_ATTACK_DURATION,TARANTULA_SDF_ATTACK_IMPACT} from '../src/tarantula-sdf-detail';
import {buildSync} from '../vendor/threejs-procedural-animals/src/core/build/pipeline.js';
import spider from '../vendor/threejs-procedural-animals/src/species/spider/index.js';
import {FAUNA_PROCEDURAL_SDF,getCreatureBuild} from '../src/creature-builds';
const reference=presetCreature('tarantulaSdf');
assert.equal(getCreatureBuild('spider'),undefined);assert.deepEqual(reference.generator,FAUNA_PROCEDURAL_SDF);
assert.deepEqual(reference.behavior,presetCreature('spider').behavior);
assert.deepEqual(validateCreatureSpec(JSON.parse(JSON.stringify(reference))),reference);
assert.deepEqual(randomCreature('same','tarantulaSdf'),randomCreature('same','tarantulaSdf'));
const original=buildSync(spider,{seed:tarantulaSdfSeed(reference.seed),quality:'low',variant:'tarantula',sex:'female'});
const data=buildTarantulaSdfData(reference,'low');
for(const key of ['pos','nrm','index','skinIndex','skinWeight','tint','coat'])assert.deepEqual(data[key],original[key],key+' changed');
assert.deepEqual(data.bones,original.bones);assert.deepEqual(data.joints,original.joints);
assert.equal(data.bones.filter((b:any)=>/^tarsus[1-4][LR]$/.test(b.name)).length,8);
assert.equal(data.bones.filter((b:any)=>/^fang[LR]$/.test(b.name)).length,2);
for(const change of ['legs','thickness'] as const){const edited=structuredClone(reference);edited.anatomy[change]=1.15;assert.notDeepEqual(buildTarantulaSdfData(edited,'low').pos,data.pos);}
const model=createCreature(reference,{detail:'low'});model.root.position.set(2,3,4);model.root.rotation.y=.7;
const pos=model.root.position.clone(),rot=model.root.quaternion.clone();
model.update(0,'idle');const rest=model.nodes.head.getWorldPosition(new THREE.Vector3());
model.update(0,'attack');model.update(TARANTULA_SDF_ATTACK_IMPACT,'attack');const strike=model.nodes.head.getWorldPosition(new THREE.Vector3());assert(rest.distanceTo(strike)>.002,'body must rear/lunge');
model.update(TARANTULA_SDF_ATTACK_DURATION+1,'attack');assert(strike.distanceTo(model.nodes.head.getWorldPosition(new THREE.Vector3()))>.001,'attack must recover');
for(const motion of ['idle','move','run','attack'] as const)for(const t of [0,.17,.7,1.8,4]){model.update(t,motion);const box=new THREE.Box3().setFromObject(model.root);assert(box.min.y>2.98,'penetration');assert(box.getSize(new THREE.Vector3()).length()<.7,'world drift');assert(model.root.position.equals(pos));assert(model.root.quaternion.equals(rot));model.root.traverse(o=>assert(o.matrixWorld.elements.every(Number.isFinite)));}
const fallback=createCreature(reference,{detail:'low',instancing:false});fallback.update(0,'move');const mesh=fallback.root.getObjectByName('base') as THREE.Mesh,p=Array.from(mesh.geometry.attributes.position.array);fallback.update(.3,'move');assert.notDeepEqual(Array.from(mesh.geometry.attributes.position.array),p);assert.deepEqual(data.nrm,original.nrm);fallback.dispose();fallback.dispose();model.dispose();model.dispose();
console.log('Tarantula SDF: exact native tarantula mesh/coat/rig, eight legs, fangs, recipes, anatomy, threat/lunge/recovery, ground bounds, host root and CPU fallback passed.');
let maximum=0;for(const sample of [reference,...Array.from({length:5},(_,i)=>randomCreature(String(i),'tarantulaSdf')),...(['min','max'] as const).map(edge=>{const s=presetCreature('tarantulaSdf');s.body.bulk=edge==='min'?0:1;s.anatomy.legs=s.anatomy.spread=s.anatomy.thickness=edge==='min'?.7:1.3;return s;})]){const triangles=buildTarantulaSdfData(sample,'high').index.length/3;maximum=Math.max(maximum,triangles);console.log('Tarantula HD budget',sample.seed,sample.anatomy.legs,triangles);}assert(maximum<220000,'tarantula anatomy exceeds its bounded HD budget');
