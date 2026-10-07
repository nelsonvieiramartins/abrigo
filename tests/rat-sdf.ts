import assert from 'node:assert/strict';
import * as THREE from 'three';
import {resizePreviewPlatform} from '../src/preview-platform';
import {createCreature} from '../src/creature';
import {presetCreature,randomCreature,validateCreatureSpec} from '../src/creature-schema';
import {buildRatSdfData,ratSdfSeed,RAT_SDF_ATTACK_DURATION,RAT_SDF_ATTACK_IMPACT} from '../src/rat-sdf-detail';
import {buildSync} from '../vendor/threejs-procedural-animals/src/core/build/pipeline.js';
import rat from '../vendor/threejs-procedural-animals/src/species/rat/index.js';
import {FAUNA_PROCEDURAL_SDF,getCreatureBuild} from '../src/creature-builds';
const reference=presetCreature('ratSdf');
// Changing preview radius must never lower the standing surface, even for tiny creatures.
const platform=new THREE.Group(),plate=new THREE.Mesh(new THREE.CylinderGeometry(.83,.85,.055,64));plate.position.y=-.0275;platform.add(plate);
for(const scale of [.1,.3,1,2,4]){resizePreviewPlatform(platform,scale);const top=new THREE.Box3().setFromObject(platform).max.y;assert(Math.abs(top)<1e-8,'preview surface changed height');assert.equal(platform.scale.y,1);}
assert.throws(()=>resizePreviewPlatform(platform,0));plate.geometry.dispose();(plate.material as THREE.Material).dispose();
assert.deepEqual(reference.behavior,presetCreature('rat').behavior);
assert.equal(getCreatureBuild('rat'),undefined);
assert.deepEqual(reference.generator,FAUNA_PROCEDURAL_SDF);
assert.deepEqual(validateCreatureSpec(JSON.parse(JSON.stringify(reference))),reference);
assert.deepEqual(randomCreature('same','ratSdf'),randomCreature('same','ratSdf'));
const original=buildSync(rat,{seed:ratSdfSeed(reference.seed),quality:'low',variant:'wild',sex:'male'});
const integrated=buildRatSdfData(reference,'low');
for(const key of ['pos','nrm','index','skinIndex','skinWeight','tint','coat'])assert.deepEqual(integrated[key],original[key],key+' changed');
assert.deepEqual(integrated.bones,original.bones);assert.deepEqual(integrated.joints,original.joints);
for(const field of Object.keys(reference.rat!) as Array<keyof NonNullable<typeof reference.rat>>){const changed=structuredClone(reference);changed.rat![field]=1.3;assert.notDeepEqual(buildRatSdfData(changed,'low').pos,integrated.pos,field+' ineffective');}
const model=createCreature(reference,{detail:'low'});model.root.position.set(2,3,4);model.root.rotation.y=.7;
const position=model.root.position.clone(),rotation=model.root.quaternion.clone();
model.update(0,'idle');const rest=model.nodes.head.getWorldPosition(new THREE.Vector3());
model.update(0,'attack');model.update(RAT_SDF_ATTACK_IMPACT,'attack');const strike=model.nodes.head.getWorldPosition(new THREE.Vector3());assert(rest.distanceTo(strike)>.001);
model.update(RAT_SDF_ATTACK_DURATION+1,'attack');assert(strike.distanceTo(model.nodes.head.getWorldPosition(new THREE.Vector3()))>.001);
for(const motion of ['idle','move','run','runPlus','attack'] as const)for(const t of [0,.17,.7,1.8,4]){model.update(t,motion);const box=new THREE.Box3().setFromObject(model.root);assert(box.min.y>2.97,'ground penetration');assert(box.getSize(new THREE.Vector3()).length()<1,'world drift');assert(model.root.position.equals(position));assert(model.root.quaternion.equals(rotation));model.root.traverse(o=>assert(o.matrixWorld.elements.every(Number.isFinite)));}
const tint=Array.from(integrated.tint),changed=structuredClone(reference);changed.appearance.primary='#81432a';const colored=createCreature(changed,{detail:'low'});assert.deepEqual(Array.from(integrated.tint),tint);colored.dispose();
const fallback=createCreature(reference,{detail:'low',instancing:false});fallback.update(0,'move');const mesh=fallback.root.getObjectByName('base') as THREE.Mesh;const p=Array.from(mesh.geometry.attributes.position.array);fallback.update(.3,'move');assert.notDeepEqual(Array.from(mesh.geometry.attributes.position.array),p);assert.deepEqual(integrated.nrm,original.nrm);fallback.dispose();fallback.dispose();model.dispose();model.dispose();
console.log('Rat SDF: exact upstream neutral mesh/rig, ten anatomy controls, deterministic recipes, bite/recovery, locomotion, root isolation and animated CPU fallback passed.');
