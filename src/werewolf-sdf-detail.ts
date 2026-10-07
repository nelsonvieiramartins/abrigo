/*!
 * Uses threejs-procedural-animals (MIT), copyright (c) 2026 Majid Manzarpour
 * and procedural-animals contributors. Full license: vendor/threejs-procedural-animals/LICENSE.
 * Original ABRIGO species/pose; not an upstream werewolf or a distorted quadruped.
 */
import * as THREE from 'three';
import {buildSync} from '../vendor/threejs-procedural-animals/src/core/build/pipeline.js';
import {createAnimalObject} from '../vendor/threejs-procedural-animals/src/core/render/animalObject.js';
import {CpuSkin} from '../vendor/threejs-procedural-animals/tools/lib/skin.mjs';
import {werewolfSdfSpecies} from './werewolf-sdf-species';
import {wolfSdfSeed} from './wolf-sdf-detail';
import {creatureBuildStamp,FAUNA_PROCEDURAL_SDF} from './creature-builds';
import {createWerewolfAttackClock} from './werewolf-attack';
import type {CreatureModel} from './creature';
import type {CreatureSpec,CreatureDetail,CreatureMotion} from './creature-schema';
declare const __WEREWOLF_SDF_WORKER_SOURCE__:string;
const cache=new Map<string,any>(),pending=new Map<string,Promise<void>>();
const keyOf=(s:CreatureSpec,d:CreatureDetail)=>JSON.stringify([s.seed,d,s.body.bulk,s.anatomy,s.appearance]);
function remember(key:string,data:any){cache.set(key,data);if(cache.size>8)cache.delete(cache.keys().next().value!);}
export function buildWerewolfSdfData(spec:CreatureSpec,detail:CreatureDetail){
 const key=keyOf(spec,detail);if(cache.has(key))return cache.get(key);
 const data=buildSync(werewolfSdfSpecies(spec),{seed:wolfSdfSeed(spec.seed),quality:detail==='high'?'high':'low'});
 remember(key,data);return data;
}
export function prepareWerewolfSdf(spec:CreatureSpec,detail:CreatureDetail='high'):Promise<void>{
 const key=keyOf(spec,detail);if(cache.has(key))return Promise.resolve();if(pending.has(key))return pending.get(key)!;
 if(typeof Worker==='undefined'){buildWerewolfSdfData(spec,detail);return Promise.resolve();}
 const p=new Promise<void>((resolve,reject)=>{let worker:Worker,url:string|undefined;
  try{if(typeof __WEREWOLF_SDF_WORKER_SOURCE__!=='undefined'){url=URL.createObjectURL(new Blob([__WEREWOLF_SDF_WORKER_SOURCE__],{type:'text/javascript'}));worker=new Worker(url);}else worker=new Worker(new URL('./werewolf-sdf-worker.ts',import.meta.url),{type:'module'});}catch(e){if(url)URL.revokeObjectURL(url);reject(e);return;}
  const finish=()=>{clearTimeout(timer);worker.terminate();if(url)URL.revokeObjectURL(url);};
  const timer=setTimeout(()=>{finish();reject(Error('Geração do Lobisomem SDF demorou demais. Tente detalhe baixo.'));},90000);
  worker.onmessage=e=>{finish();if(e.data.error)reject(Error(e.data.error));else{remember(key,e.data.data);resolve();}};
  worker.onerror=e=>{finish();reject(Error(e.message||'Erro ao gerar Lobisomem SDF.'));};worker.postMessage({spec,detail});
 }).finally(()=>pending.delete(key));pending.set(key,p);return p;
}
export function createWerewolfSdf(spec:CreatureSpec,detail:CreatureDetail,compatible=false):CreatureModel{
 const data=buildWerewolfSdfData(spec,detail),species=werewolfSdfSpecies(spec),render=createAnimalObject(data,species,{quality:data.quality});
 const root=new THREE.Group();root.name=spec.name;root.scale.setScalar(spec.body.scale);root.add(render.group);
 root.userData.creatureSpec=spec;root.userData.generator=creatureBuildStamp('werewolfSdf');root.userData.rig={kind:'procedural-creature',species:'werewolfSdf',source:FAUNA_PROCEDURAL_SDF.source};
 root.userData.werewolfSdf={sourceCommit:FAUNA_PROCEDURAL_SDF.sourceCommit,customSpecies:true,plan:'abrigo-biped',quality:data.quality,vertices:data.nV};
 const nodes:Record<string,THREE.Object3D>={body:render.group},sockets:Record<string,THREE.Object3D>={};
 // Pose graph is separate from the shader skeleton. No scaled joints or floating limbs.
 const pose=new THREE.Group(),J=data.joints;render.group.add(pose);
 const pivot=(name:string,joint:string,parent:THREE.Object3D,parentJoint?:string)=>{const o=new THREE.Group();o.name=name;o.position.fromArray(J[joint]);if(parentJoint)o.position.sub(new THREE.Vector3().fromArray(J[parentJoint]));parent.add(o);nodes[name]=o;return o;};
 const hips=pivot('hips','pelvis',pose),spine=pivot('spine','chest',hips,'pelvis'),neck=pivot('neck','neck',spine,'chest'),head=pivot('head','head',neck,'neck'),jaw=pivot('jaw','jawHinge',head,'head'),tail=pivot('tail','tailBase',hips,'pelvis');
 const boneNode:Record<string,THREE.Object3D>={pelvis:hips,spine,neck,head,jaw,tail0:tail};
 const socket=(name:string,parent:THREE.Object3D,pos:number[])=>{const o=new THREE.Object3D();o.name='socket-'+name;o.position.fromArray(pos);parent.add(o);sockets[name]=o;return o;};
 for(const S of ['L','R']){
  const arm=pivot('upperArm'+S,'shoulder'+S,spine,'chest'),elbow=pivot('lowerArm'+S,'elbow'+S,arm,'shoulder'+S),hand=pivot('hand'+S,'wrist'+S,elbow,'elbow'+S);
  const thigh=pivot('upperLeg'+S,'hip'+S,hips,'pelvis'),knee=pivot('lowerLeg'+S,'knee'+S,thigh,'hip'+S),foot=pivot('foot'+S,'ankle'+S,knee,'knee'+S),ear=pivot('ear'+S,'earBase'+S,head,'head');
  Object.assign(boneNode,{['upperArm'+S]:arm,['lowerArm'+S]:elbow,['hand'+S]:hand,['upperLeg'+S]:thigh,['lowerLeg'+S]:knee,['foot'+S]:foot,['ear'+S]:ear});socket('hand'+S,hand,[0,-.09,.025]);
 }
 socket('head',head,[0,.06,.02]);socket('mouth',jaw,[0,-.03,.29]);socket('back',spine,[0,0,-.24]);socket('target',spine,[0,-.15,0]);sockets.origin=sockets.target;
 const transforms=data.bones.map((b:any,i:number)=>new THREE.Matrix4().makeTranslation(...J[b.headJ].map((v:number)=>-v)).multiply(render.skeleton.bind[i]));
 const skin=new CpuSkin(render.skeleton.bind),posed=new Float32Array(data.pos.length),bounds=new THREE.Box3(),point=new THREE.Vector3(),extra=new Set<THREE.Material>();
 const eyeMaterials=render.eyes.map((e:THREE.Mesh)=>e.material);
 if(spec.appearance.eyes!=='#e7ad32'){const c=new THREE.Color(spec.appearance.eyes).toArray();render.setEyeLook({iris:{inner:c,mid:c,hi:c,outer:c}});}
 if(compatible){const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1});extra.add(mat);const colors=new Float32Array(data.nV*3);for(let i=0;i<data.nV;i++)colors.set(data.tint.subarray(i*4,i*4+3),i*3);render.geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));render.geometry.setAttribute('position',new THREE.BufferAttribute(posed,3));render.geometry.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(data.nrm),3));render.base.material=mat;render.setCoverings(false);for(const e of render.eyes){const m=new THREE.MeshStandardMaterial({color:spec.appearance.eyes});extra.add(m);e.material=m;}}
 render.group.traverse((o:THREE.Object3D)=>{if(o instanceof THREE.Mesh&&!o.geometry.attributes.normal)o.geometry.computeVertexNormals();});
 const attackClock=createWerewolfAttackClock(),L=spec.anatomy.legs,U=.48*L,D=.54*L,H=J.pelvis[1];let disposed=false;
 function update(time:number,motion:CreatureMotion='idle'){
  if(disposed)return;if(motion==='sprint'||motion==='runPlus')throw Error('Correr+ não disponível para o Lobisomem SDF.');if(!Number.isFinite(time)||time<0||!['idle','move','run','attack'].includes(motion))throw Error('Movimento bípede SDF inválido.');
  const moving=motion==='move'||motion==='run',running=motion==='run',p=time*(running?9:5),atk=attackClock(time,motion),wind=atk?.wind??0,hit=atk?.thrust??0,raised=atk?.raised??0,advance=.34*L*hit;
  hips.position.set(0,H+(atk?-L*(wind*.10+hit*.045):moving?Math.abs(Math.sin(p))*.009:Math.sin(time*1.8)*.004),advance);
  spine.rotation.set((running?.16:moving?.07:0)-wind*.08+hit*.32,-wind*.06+hit*.04,moving?Math.sin(p)*.018:0);
  head.rotation.set(-.045-hit*.18,moving||atk?0:Math.sin(time*.6)*.04,0);jaw.rotation.x=(atk?.bite??0)*.65;
  for(const S of ['L','R']){const side=S==='L'?1:-1,a=p+(side<0?Math.PI:0),front=side<0;
   const y=.12+(atk?(front?.08*L*(atk.step):0):moving?Math.max(0,Math.sin(a))*(running?.18:.08):0),z=atk?(front?.16:-.08)*L*hit-advance:moving?-Math.cos(a)*(running?.30:.19):0;
   const dy=hips.position.y-y,r=THREE.MathUtils.clamp(Math.hypot(dy,z),Math.abs(U-D)+.001,U+D-.001),k=Math.acos(THREE.MathUtils.clamp((r*r-U*U-D*D)/(2*U*D),-1,1)),hip=Math.atan2(-z,dy)-Math.atan2(D*Math.sin(k),U+D*Math.cos(k));
   nodes['upperLeg'+S].rotation.set(hip,0,0);nodes['lowerLeg'+S].rotation.set(k,0,0);nodes['foot'+S].rotation.set(-hip-k,0,0);
   const swing=moving?-Math.cos(a)*(running?.65:.30):0;nodes['upperArm'+S].rotation.set(atk?-raised*2.75-hit*.65:swing,0,side*(.12+raised*.12));nodes['lowerArm'+S].rotation.x=atk?-.20-raised*.35-hit*.25:running?-.8:-.20;nodes['hand'+S].rotation.set(-hit*.30,0,side*hit*.15);
  }
  tail.rotation.y=Math.sin(time*2)*.14;pose.updateMatrixWorld(true);
  // Pose matrices are local to the model: host root position/rotation never enters DQ skinning.
  const inverse=new THREE.Matrix4().copy(render.group.matrixWorld).invert();
  data.bones.forEach((b:any,i:number)=>render.skeleton.bones[i].matrixWorld.copy(inverse).multiply(boneNode[b.name].matrixWorld).multiply(transforms[i]));
  render.update({dt:0,time});skin.setPose(render.skeleton.bones.map((b:THREE.Bone)=>b.matrixWorld));skin.skin(data,posed);bounds.makeEmpty();for(let i=0;i<posed.length;i+=3)bounds.expandByPoint(point.fromArray(posed,i));
  const padded=bounds.clone().expandByScalar(.05);render.geometry.boundingBox=padded;render.geometry.boundingSphere=padded.getBoundingSphere(new THREE.Sphere());for(const mesh of [render.base,render.shells,render.fins])mesh.boundingBox=padded;
  if(compatible){render.geometry.attributes.position.needsUpdate=true;render.geometry.computeVertexNormals();}root.updateMatrixWorld(true);
 }
 update(0);const stats={triangles:data.index.length/3,meshes:0};root.traverse(o=>{if(o instanceof THREE.Mesh)stats.meshes++;});
 return {root,nodes,sockets,stats,detail,update,dispose(){if(disposed)return;disposed=true;if(compatible)render.eyes.forEach((e:THREE.Mesh,i:number)=>e.material=eyeMaterials[i]);render.dispose();extra.forEach(m=>m.dispose());root.removeFromParent();}};
}
