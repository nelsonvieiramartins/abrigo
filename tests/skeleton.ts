import * as THREE from 'three';
import {buildDetailedSkeleton} from '../src/skeleton-detail';
import {presetCreature,validateCreatureSpec,CREATURE_SPECIES} from '../src/creature-schema';
const assert=(condition:boolean,message:string)=>{if(!condition)throw Error(message);};
for(const species of Object.keys(CREATURE_SPECIES) as (keyof typeof CREATURE_SPECIES)[])assert(validateCreatureSpec(presetCreature(species)).species===species,'Preset regression '+species);
for(const detail of ['high','low'] as const)for(const proportion of [1,.85,1.15]){
 const raw=presetCreature('skeleton');raw.anatomy.legs=proportion;raw.anatomy.spread=proportion;raw.anatomy.thickness=proportion;
 const spec=validateCreatureSpec(raw),body=new THREE.Group(),nodes:Record<string,THREE.Object3D>={},sockets:Record<string,THREE.Object3D>={},geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
 const animate=buildDetailedSkeleton(spec,{body,nodes,sockets,geometries,materials},detail);
 for(const name of ['head','jaw','chest','pelvis','neck','hipL','hipR','kneeL','kneeR','footL','footR','shoulderL','shoulderR','elbowL','elbowR','handL','handR'])assert(!!nodes[name],'Missing joint '+name);
 for(const name of ['head','mouth','back','target','handL','handR','footL','footR'])assert(!!sockets[name],'Missing socket '+name);
 // Anatomical handedness is a property of the emitted geometry, not just a side flag.
 for(const limb of ['hand','foot']){
  const left=nodes[limb+'L'].getObjectByName(limb+'L-bones') as THREE.Mesh,right=nodes[limb+'R'].getObjectByName(limb+'R-bones') as THREE.Mesh;
  const lp=left.geometry.getAttribute('position'),rp=right.geometry.getAttribute('position');
  const key=(x:number,y:number,z:number)=>[x,y,z].map(v=>Math.round(v*1e5)).join(',');
  const reflected=new Set<string>();for(let i=0;i<rp.count;i++)reflected.add(key(-rp.getX(i),rp.getY(i),rp.getZ(i)));
  for(let i=0;i<lp.count;i++)assert(reflected.has(key(lp.getX(i),lp.getY(i),lp.getZ(i))),'Unmirrored '+limb+' vertex');
 }
 // Finger tips curl to the palmar side (+Z), with the same direction in both hands.
 for(const side of ['L','R']){
  const mesh=nodes['hand'+side].getObjectByName('hand'+side+'-bones') as THREE.Mesh,p=mesh.geometry.getAttribute('position');let tipZ=-Infinity;
  for(let i=0;i<p.count;i++)if(p.getY(i)<-.13)tipZ=Math.max(tipZ,p.getZ(i));assert(tipZ>.03,'Reversed palmar curl '+side);
 }
 // Verify final world orientation, including parent transforms and the wrist quarter turn.
 animate(0,'idle');body.updateMatrixWorld(true);
 for(const side of ['L','R']){
  const sign=side==='L'?1:-1,hand=nodes['hand'+side],palm=new THREE.Vector3(0,0,1).transformDirection(hand.matrixWorld);
  assert(palm.dot(new THREE.Vector3(-sign,0,0))>.95,'Palm faces away from thigh '+side);
  const mesh=hand.getObjectByName('hand'+side+'-bones') as THREE.Mesh,p=mesh.geometry.getAttribute('position'),wrist=hand.getWorldPosition(new THREE.Vector3());let forward=0,n=0;
  for(let j=0;j<p.count;j++)if(sign*p.getX(j)>.07){forward+=new THREE.Vector3().fromBufferAttribute(p,j).applyMatrix4(hand.matrixWorld).z-wrist.z;n++;}
  assert(n>0&&forward/n>.07,'Thumb faces backwards '+side);
 }
 // An airborne foot advances +Z; a planted foot travels -Z relative to the moving body.
 for(const motion of ['move','run','sprint'] as const){
  const period=2*Math.PI/(motion==='sprint'?13:motion==='run'?9:5.6);
  for(const side of ['L','R']){
   const phaseOffset=side==='L'?0:.5;
   const sample=(phase:number)=>{animate((phase+phaseOffset)*period,motion);body.updateMatrixWorld(true);return nodes['foot'+side].getWorldPosition(new THREE.Vector3());};
   const swingA=sample(.12),swingB=sample(.38),stanceA=sample(.62),stanceB=sample(.88);
   assert(swingB.z>swingA.z+.025,'Swing reversed '+motion+' '+side);
   assert(stanceB.z<stanceA.z-.025,'Stance reversed '+motion+' '+side);
   assert(swingA.y>stanceA.y+.012,'Missing airborne phase '+motion+' '+side);
  }
 }
 const original=[...geometries].map(g=>Array.from(g.getAttribute('position').array));let triangles=0,meshes=0;
 body.traverse(o=>{if(o instanceof THREE.Mesh){meshes++;const g=o.geometry;triangles+=(g.index?.count??g.getAttribute('position').count)/3;assert(geometries.has(g)&&materials.has(o.material as THREE.Material),'Untracked resource');assert(Array.from(g.getAttribute('position').array).every(Number.isFinite),'Bad vertex');}});
 assert(meshes<40&&triangles<18000,'Budget exceeded');
 const ray=new THREE.Raycaster();animate(0,'idle');body.updateMatrixWorld(true);
 const eyeLocal=new THREE.Vector3(.077,0,.4),eyeWorld=nodes.head.localToWorld(eyeLocal.clone()),direction=new THREE.Vector3(0,0,-1).transformDirection(nodes.head.matrixWorld);
 ray.set(eyeWorld,direction);const eyeHits=ray.intersectObject(nodes.head,true);assert(eyeHits.length>0,'Empty eye');assert((eyeHits[0].object as THREE.Mesh).material!==materials.values().next().value,'Orbit is blocked by skull');
 // Proportion and visibility checks on the revised head, including the upper orbital regions.
 const headBounds=new THREE.Box3().setFromObject(nodes.head).getSize(new THREE.Vector3());
 assert(headBounds.y>.30&&headBounds.y<.38,'Skull is elongated or too compressed');
 for(const side of [-1,1])for(const [x,y] of [[.073,0],[.085,.016],[.055,.005],[.090,-.012]]){
  ray.set(nodes.head.localToWorld(new THREE.Vector3(side*x,y,.4)),direction);
  const hits=ray.intersectObject(nodes.head,true);
  assert(hits.length>0&&(hits[0].object as THREE.Mesh).material!==materials.values().next().value,'Blocked upper/inner orbit');
 }
 for(const motion of ['idle','move','run','sprint','attack'] as const){animate(0,'idle');animate(0,motion);
  for(let i=0;i<80;i++){
   animate(i/60,motion);body.updateMatrixWorld(true);body.traverse(o=>assert(o.matrixWorld.elements.every(Number.isFinite),'Bad transform'));
   for(const side of ['L','R']){
    const hip=nodes['hip'+side].getWorldPosition(new THREE.Vector3()),knee=nodes['knee'+side].getWorldPosition(new THREE.Vector3()),ankle=nodes['foot'+side].getWorldPosition(new THREE.Vector3());
    assert(Math.abs(hip.distanceTo(knee)-.42*proportion)<1e-6,'Femur stretch');assert(Math.abs(knee.distanceTo(ankle)-.44*proportion)<1e-6,'Shin stretch');
    let lowest=Infinity;nodes['foot'+side].traverse(o=>{if(o instanceof THREE.Mesh){const p=o.geometry.getAttribute('position');for(let j=0;j<p.count;j++)lowest=Math.min(lowest,new THREE.Vector3().fromBufferAttribute(p,j).applyMatrix4(o.matrixWorld).y);}});assert(lowest>-.002,'Foot penetrates floor '+lowest);
   }
  }
 }
 animate(0,'sprint');assert(Math.abs(nodes.chest.rotation.x-.22)<1e-6,'Missing sprint lean');
 for(const side of ['L','R'])assert(Math.abs(nodes['elbow'+side].rotation.x+1.35)<1e-6,'Missing sprint elbow bend');
 assert(Math.abs(nodes.shoulderL.rotation.x+.95)<1e-6&&Math.abs(nodes.shoulderR.rotation.x-.95)<1e-6,'Sprint arms not opposed');
 animate(0,'idle');assert(Math.abs(nodes.chest.rotation.x)<1e-6,'Sprint lean persists after reset');
 animate(0,'attack');animate(.36,'attack');assert(nodes.shoulderR.rotation.x<-.9,'Missing strike');animate(.95,'attack');assert(body.position.z===0&&nodes.jaw.rotation.x===0,'Attack recovery');animate(1,'move');animate(2,'attack');animate(2.36,'attack');assert(nodes.shoulderR.rotation.x<-.9,'Second strike');
 [...geometries].forEach((g,j)=>assert(Array.from(g.getAttribute('position').array).every((v,i)=>v===original[j][i]),'Rigid geometry changed'));
 console.log({detail,proportion,meshes,triangles,geometries:geometries.size,materials:materials.size});
}
console.log('Presets, world palm/thumb orientation, forward swing/backward stance, mirrored hands/feet, palmar curl, rig, recessed sockets, lengths, floor, repeated attacks, geometry and budgets verified.');
