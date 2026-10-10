import * as THREE from 'three';
import {createCreature} from '../src/creature';
import {presetCreature,validateCreatureSpec} from '../src/creature-schema';
const assert=(condition:boolean,message:string)=>{if(!condition)throw Error(message);};
// Old recipes keep normal arm length; new recipes retain the independent adjustment.
const old=presetCreature('skeleton');assert(validateCreatureSpec(old).anatomy.arms===undefined,'Legacy migration');
for(const detail of ['low','high'] as const){
 for(const length of [.7,1,1.3]){
  const spec=presetCreature('skeleton');spec.anatomy.arms=length;
  assert(validateCreatureSpec(JSON.parse(JSON.stringify(spec))).anatomy.arms===length,'Arm setting lost');
  const model=createCreature(spec,{detail});
  for(const motion of ['idle','move','run','sprint','attack'] as const){
   model.update(.17,motion);model.root.updateMatrixWorld(true);
   for(const side of ['L','R']){
    const shoulder=model.nodes['shoulder'+side],elbow=model.nodes['elbow'+side],hand=model.nodes['hand'+side];
    assert(Math.abs(shoulder.getWorldPosition(new THREE.Vector3()).distanceTo(elbow.getWorldPosition(new THREE.Vector3()))-.31*length)<1e-6,'Upper arm disconnected');
    assert(Math.abs(elbow.getWorldPosition(new THREE.Vector3()).distanceTo(hand.getWorldPosition(new THREE.Vector3()))-Math.hypot(.30*length,.008))<1e-6,'Forearm disconnected');
    assert(hand.scale.x===1.2&&hand.scale.y===1.2,'Hand was stretched');
   }
  }
  model.dispose();
 }
 for(const length of [.7,1,1.3]){
  const spec=presetCreature('werewolf');spec.anatomy.legs=length;
  const model=createCreature(spec,{detail});
  for(const [motion,freq,swing,elbow,lean] of [['move',6,.4,-.13,0],['run',10,.7,-1.1,.11],['sprint',13,.95,-1.35,.22]] as const){
   for(let i=0;i<80;i++){
    const t=i/60;model.update(t,motion);model.root.updateMatrixWorld(true);
    assert(Math.abs(model.nodes.spine.rotation.x-lean)<1e-6,'Torso gait mismatch');
    for(const side of ['L','R']){
     const phase=t*freq+(side==='R'?Math.PI:0);
     assert(Math.abs(model.nodes['upperArm'+side].rotation.x+Math.cos(phase)*swing)<1e-6,'Arm gait mismatch');
     assert(Math.abs(model.nodes['lowerArm'+side].rotation.x-elbow)<1e-6,'Elbow gait mismatch');
     const thigh=model.nodes['upperLeg'+side].getWorldPosition(new THREE.Vector3()),knee=model.nodes['lowerLeg'+side].getWorldPosition(new THREE.Vector3()),foot=model.nodes['foot'+side].getWorldPosition(new THREE.Vector3());
     assert(Math.abs(thigh.distanceTo(knee)-.48*length)<1e-6,'Thigh stretched');
     assert(Math.abs(knee.distanceTo(foot)-.54*length)<1e-6,'Shin stretched');
     assert(new THREE.Box3().setFromObject(model.nodes['foot'+side]).min.y>-.002,'Foot penetrates floor');
    }
   }
  }
  model.update(0,'attack');model.update(.24,'attack');assert(model.nodes.upperArmR.rotation.x<-.5,'Attack lost');
  model.update(2,'idle');assert(model.nodes.spine.rotation.x===0,'Sprint persists in idle');
  model.dispose();
 }
}
console.log('Skeleton arm length persistence and connected joints; werewolf character gait, rigid lengths, grounded feet and attack passed.');
