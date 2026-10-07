import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createCreature} from '../src/creature';
import {presetCreature,randomCreature,validateCreatureSpec} from '../src/creature-schema';
import {buildWolfSdfData,wolfSdfSeed,WOLF_SDF_ATTACK_IMPACT} from '../src/wolf-sdf-detail';
import {buildSync} from '../vendor/threejs-procedural-animals/src/core/build/pipeline.js';
import wolf from '../vendor/threejs-procedural-animals/src/species/wolf/index.js';
import {FAUNA_PROCEDURAL_SDF,getCreatureBuild} from '../src/creature-builds';

const reference=presetCreature('wolfLowpolySdf'),old=presetCreature('wolfSdf');
assert.equal(reference.seed,old.seed);
for(const key of ['body','anatomy','appearance','behavior'] as const)assert.deepEqual(reference[key],old[key]);
assert.deepEqual(validateCreatureSpec(JSON.parse(JSON.stringify(reference))),reference);
assert.equal(getCreatureBuild(reference.species),FAUNA_PROCEDURAL_SDF);
assert.deepEqual(randomCreature('same',reference.species),randomCreature('same',reference.species));
const original=buildSync(wolf,{seed:wolfSdfSeed(reference.seed),quality:'crowd',variant:'grey',sex:'male'});
const integrated=buildWolfSdfData(reference,'high'),full=buildWolfSdfData(old,'high');
for(const key of ['pos','nrm','index','skinIndex','skinWeight','tint','coat','bones','joints'])assert.deepEqual(integrated[key],original[key],key+' must preserve native crowd LOD');
assert.deepEqual(integrated.bones,full.bones,'LOD must not reshape rig');
assert.deepEqual(integrated.joints,full.joints);
assert(integrated.index.length<full.index.length*.15);
assert(buildWolfSdfData(reference,'low').index.length<integrated.index.length);
const cachedNormal=new Float32Array(integrated.nrm),cachedTint=new Float32Array(integrated.tint);
for(const detail of ['low','high'] as const){
  const recipes=[reference,...Array.from({length:6},(_,i)=>randomCreature('lowpoly-'+i,reference.species))];
  for(const spec of recipes){
    const model=createCreature(spec,{detail});
    model.root.position.set(2,3,4);model.root.rotation.y=.4;
    assert(model.stats.triangles<25000);
    const position=model.root.position.clone(),rotation=model.root.quaternion.clone();
    const mesh=model.root.getObjectByName('base') as THREE.Mesh;
    assert((mesh.material as THREE.MeshStandardMaterial).flatShading);
    assert.equal(mesh.customDepthMaterial,undefined);
    model.update(0,'idle');const idle=model.nodes.head.getWorldPosition(new THREE.Vector3());
    model.update(0,'attack');model.update(WOLF_SDF_ATTACK_IMPACT,'attack');
    assert(idle.distanceTo(model.nodes.head.getWorldPosition(new THREE.Vector3()))>.01);
    for(const motion of ['idle','move','run','attack'] as const)for(const t of [0,.17,.5,1.8,20]){
      model.update(t,motion);
      const box=new THREE.Box3().setFromObject(model.root);
      assert(box.min.y>position.y-.07,'feet penetrate floor');
      assert(box.getSize(new THREE.Vector3()).length()<4,'bounds drift');
      assert(model.root.position.equals(position));assert(model.root.quaternion.equals(rotation));
      model.root.traverse(o=>{assert(o.matrixWorld.elements.every(Number.isFinite));});
      for(const key of ['position','normal'])assert(Array.from(mesh.geometry.attributes[key].array).every(Number.isFinite));
    }
    model.update(0,'move');const p=new Float32Array(mesh.geometry.attributes.position.array);
    model.update(.3,'move');assert.notDeepEqual(mesh.geometry.attributes.position.array,p,'surface must follow rig');
    const resources=new Set<THREE.BufferGeometry|THREE.Material>();
    model.root.traverse(o=>{if(o instanceof THREE.Mesh){resources.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])resources.add(m);}});
    const disposed=new Map<any,number>();for(const r of resources)r.addEventListener('dispose',()=>disposed.set(r,(disposed.get(r)??0)+1));
    model.dispose();model.dispose();for(const r of resources)assert.equal(disposed.get(r),1,'resource disposal');
  }
}
assert.deepEqual(integrated.nrm,cachedNormal);assert.deepEqual(integrated.tint,cachedTint);
console.log(`Wolf Low Poly SDF: native crowd parity, unchanged proportions/rig, JSON, 6 variations at both tiers, animated surface, attack, floor, root and disposal passed. Base triangles: HD ${integrated.index.length/3}, low ${buildWolfSdfData(reference,'low').index.length/3}, original HD ${full.index.length/3}.`);
