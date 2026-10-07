/*!
 * Uses threejs-procedural-animals, commit c95ae49346aa8e140a924376cec6cf0073d99512.
 * MIT License
 * Copyright (c) 2026 Majid Manzarpour and procedural-animals contributors
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import * as THREE from 'three';
import {FAUNA_PROCEDURAL_SDF,creatureBuildStamp} from './creature-builds';
import wolf from '../vendor/threejs-procedural-animals/src/species/wolf/index.js';
import {buildSync} from '../vendor/threejs-procedural-animals/src/core/build/pipeline.js';
import {Animal} from '../vendor/threejs-procedural-animals/src/animal.js';
import {CpuSkin} from '../vendor/threejs-procedural-animals/tools/lib/skin.mjs';
import {createQuadrupedMotion} from '../vendor/threejs-procedural-animals/src/core/motion/quadruped.js';
import type {CreatureModel} from './creature';
import type {CreatureSpec,CreatureMotion,CreatureDetail} from './creature-schema';

// Upstream's bite-lunge timing; shared with combat damage instead of an unrelated timer.
export const WOLF_SDF_ATTACK_DURATION=.95,WOLF_SDF_ATTACK_IMPACT=.5,WOLF_SDF_ATTACK_COOLDOWN=.65;
const cache=new Map<string,any>();
const pending=new Map<string,Promise<void>>();
declare const __WOLF_SDF_WORKER_SOURCE__:string;
export function wolfSdfSeed(text:string){let n=2166136261;for(const ch of text)n=Math.imul(n^ch.charCodeAt(0),16777619);return n>>>0;}
function dataKey(spec:CreatureSpec,detail:CreatureDetail){return JSON.stringify([spec.species,spec.seed,detail,spec.body.bulk,spec.anatomy.legs,spec.anatomy.length,spec.anatomy.spread,spec.anatomy.tail,spec.anatomy.ears]);}
function remember(key:string,data:any){cache.set(key,data);if(cache.size>8)cache.delete(cache.keys().next().value!);}

/** Prepare in a worker before the synchronous CreatureModel factory is called. */
export function prepareWolfSdf(spec:CreatureSpec,detail:CreatureDetail='high'):Promise<void>{
  const key=dataKey(spec,detail);if(cache.has(key))return Promise.resolve();if(pending.has(key))return pending.get(key)!;
  if(typeof Worker==='undefined'){buildWolfSdfData(spec,detail);return Promise.resolve();}
  const p=new Promise<void>((resolve,reject)=>{
    let url:string|undefined,worker:Worker;
    try{
      if(typeof __WOLF_SDF_WORKER_SOURCE__!=='undefined'){url=URL.createObjectURL(new Blob([__WOLF_SDF_WORKER_SOURCE__],{type:'text/javascript'}));worker=new Worker(url);}
      else worker=new Worker(new URL('./wolf-sdf-worker.ts',import.meta.url),{type:'module'});
    }catch(error){if(url)URL.revokeObjectURL(url);reject(error);return;}
    const finish=()=>{clearTimeout(timer);worker.terminate();if(url)URL.revokeObjectURL(url);};
    const timer=setTimeout(()=>{finish();reject(new Error('A geração do Lobo SDF demorou demais. Tente novamente em detalhe baixo.'));},90000);
    worker.onmessage=e=>{finish();if(e.data.error)reject(new Error(e.data.error));else{remember(key,e.data.data);resolve();}};
    worker.onerror=e=>{finish();reject(new Error(e.message||'Não foi possível gerar o Lobo SDF.'));};
    worker.postMessage({spec,detail});
  }).finally(()=>pending.delete(key));pending.set(key,p);return p;
}

export function buildWolfSdfData(spec:CreatureSpec,detail:CreatureDetail){
  const lowPoly=spec.species==='wolfLowpolySdf',quality=lowPoly?'crowd':detail==='high'?'high':'low';
  const key=dataKey(spec,detail);
  if(cache.has(key))return cache.get(key);
  // Keep the original sculpt, coat, rig and seeded proportions. User controls
  // modify the original continuous warps, not separately stretched body parts.
  const species={...wolf,variation(R:any,o:any){const p=wolf.variation(R,o),girth=spec.anatomy.spread*(.9+spec.body.bulk*.2);return {...p,ear:p.ear*spec.anatomy.ears,tail:p.tail*spec.anatomy.tail,warps:[...p.warps.map((w:any)=>({...w,k:w.k*(w.type==='legs'?spec.anatomy.legs:w.type==='length'?spec.anatomy.length:1)})),...(girth===1?[]:[{type:'girth',k:girth,cy:.56,z0:-.3,z1:.3}])]};}};
  // Native crowd LOD preserves the same sculpt, rig and seeded proportions.
  // The low-detail variant only increases sampling distance; no vertex
  // clustering, head replacement or anatomical warps are introduced.
  const lodSpecies=lowPoly&&detail==='low'?{...species,regions(rig:any,params:any,Q:any){return wolf.regions(rig,params,{...Q,res:6,eyePatches:false});}}:species;
  const data=buildSync(lodSpecies,{seed:wolfSdfSeed(spec.seed),quality,variant:'grey',sex:'male'});
  remember(key,data);
  return data;
}

export function createWolfSdf(spec:CreatureSpec,detail:CreatureDetail,compatible=false):CreatureModel{
  const lowPoly=spec.species==='wolfLowpolySdf',cpuSurface=compatible||lowPoly;
  const data=buildWolfSdfData(spec,detail),animal=new Animal(wolf,data,{quality:data.quality});
  const root=new THREE.Group();root.name=spec.name;root.scale.setScalar(spec.body.scale);
  root.userData.creatureSpec=spec;root.userData.generator=creatureBuildStamp(spec.species);root.userData.rig={kind:'procedural-creature',species:spec.species,source:FAUNA_PROCEDURAL_SDF.source};
  root.add(animal.object);
  const nodes:Record<string,THREE.Object3D>={body:animal.object},sockets:Record<string,THREE.Object3D>={...animal.attachments};
  // Shader-driven bones are not children of the render group; expose attachment
  // proxies rather than reparenting and breaking their independent world matrices.
  sockets.target=sockets.back??new THREE.Object3D();if(!sockets.target.parent)animal.object.add(sockets.target);
  sockets.origin=sockets.target;
  nodes.head=sockets.head??sockets.mouth??sockets.target;
  const render=animal.render,geometry=render.geometry;
  // Silhouette cards compute normals in their shader; provide finite CPU
  // normals too for the editor's generic mesh inspection/export contract.
  animal.object.traverse(o=>{if(o instanceof THREE.Mesh&&!o.geometry.attributes.normal)o.geometry.computeVertexNormals();});
  const skin=new CpuSkin(render.skeleton.bind),posed=new Float32Array(data.pos.length);
  const bounds=new THREE.Box3(),point=new THREE.Vector3(),zero=new THREE.Vector3(),velocity=new THREE.Vector3(),travel=new THREE.Vector3();
  const extraMaterials=new Set<THREE.Material>();
  // Default colours leave upstream's grizzled coat unchanged. Colour edits tint
  // hair only, preserving the nose, claws, teeth and mouth material identities.
  const tint=new Float32Array(data.tint),primary=new THREE.Color(spec.appearance.primary),secondary=new THREE.Color(spec.appearance.secondary);
  if(spec.appearance.primary!=='#73766b'||spec.appearance.secondary!=='#c0baa3'||spec.appearance.markings!==.55){
    for(let i=0;i<data.nV;i++)if(Math.round(tint[i*4+3])===0){const ventral=THREE.MathUtils.clamp(-data.nrm[i*3+1],0,1)*spec.appearance.markings,c=primary.clone().lerp(secondary,ventral);for(let j=0;j<3;j++)tint[i*4+j]=(tint[i*4+j]*.35+c.toArray()[j]*.65);}
    render.geometry.attributes.aTint.array=tint;render.geometry.attributes.aTint.needsUpdate=true;
  }
  if(spec.appearance.eyes!=='#dfac49'){const c=new THREE.Color(spec.appearance.eyes).toArray();render.setEyeLook({iris:{inner:c,mid:c,hi:c,outer:c}});}
  const eyeMaterials=render.eyes.map((eye:THREE.Mesh)=>eye.material);
  if(cpuSurface){
    // CPU DQ preserves the native surface in SVG and the flat-shaded Low Poly
    // variant, with vertex colours and no additional fur shells.
    const fallback=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,flatShading:lowPoly});extraMaterials.add(fallback);
    const colors=new Float32Array(data.nV*3);for(let i=0;i<data.nV;i++)colors.set(tint.subarray(i*4,i*4+3),i*3);
    geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.setAttribute('position',new THREE.BufferAttribute(posed,3));geometry.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(data.nrm),3));
    render.base.material=fallback;animal.setCoverings(false);
    if(lowPoly){render.base.customDepthMaterial=undefined;render.base.customDistanceMaterial=undefined;}
    if(compatible)for(const eye of render.eyes){const mat=new THREE.MeshStandardMaterial({color:spec.appearance.eyes,roughness:.4});extraMaterials.add(mat);eye.material=mat;}
  }
  // GPU skinning does not update CPU bounds. These bounds must match the pose
  // for framing, snapshots and combat health bars; never use upstream's huge
  // frustum-culling sphere to frame the editor.
  const updateBounds=()=>{
    skin.setPose(render.skeleton.bones.map((b:THREE.Bone)=>b.matrixWorld));skin.skin(data,posed);bounds.makeEmpty();
    for(let i=0;i<posed.length;i+=3)bounds.expandByPoint(point.fromArray(posed,i));
    const padded=bounds.clone().expandByScalar(.04);
    for(const mesh of [render.base,render.shells,render.fins])mesh.boundingBox=padded;
    geometry.boundingBox=padded;geometry.boundingSphere=padded.getBoundingSphere(new THREE.Sphere());
    if(cpuSurface){geometry.attributes.position.needsUpdate=true;geometry.computeVertexNormals();}
  };
  let previous=-1,motion:CreatureMotion='idle',disposed=false;
  function reset(next:CreatureMotion){travel.set(0,0,0);animal.object.position.set(0,0,0);animal.motion.dispose();animal.motion=createQuadrupedMotion({species:wolf,data,skeleton:render.skeleton,ground:()=>0,position:zero,heading:0,emit:()=>{}});animal.time=0;motion=next;animal.follow(travel,velocity.set(0,0,next==='move'?1.1:next==='run'?2.5:0),{heading:0});if(next==='attack')void animal.play('attack');animal.update(0);}
  function update(time:number,next:CreatureMotion='idle'){
    if(disposed)return;
    if(next==='sprint'||next==='runPlus')throw new Error('Correr+ não disponível para o lobo SDF.');
    if(!Number.isFinite(time)||time<0||!['idle','move','run','attack'].includes(next))throw new Error('Tempo ou movimento de lobo SDF inválido.');
    const changed=next!==motion||previous<0||time<previous;
    if(changed)reset(next);
    // ABRIGO passes absolute time and can seek backwards during sprite export.
    // On entry into attack time starts at zero even if the preview clock is old.
    let remaining=changed?(next==='attack'?0:Math.min(time,2)):time-previous;
    while(remaining>1e-8){const dt=Math.min(remaining,1/30);travel.addScaledVector(velocity,dt);animal.follow(travel,velocity,{heading:0});animal.object.position.copy(travel).negate();animal.object.updateMatrixWorld(true);animal.update(dt);remaining-=dt;}
    previous=time;updateBounds();root.updateMatrixWorld(true);
  }
  reset('idle');update(0);
  const stats={triangles:data.index.length/3,meshes:0};root.traverse(o=>{if(o instanceof THREE.Mesh)stats.meshes++;});
  root.userData.wolfSdf={sourceCommit:FAUNA_PROCEDURAL_SDF.sourceCommit,quality:data.quality,seed:data.seed,vertices:data.nV};
  if(lowPoly)root.userData.lowPoly={sourceSpecies:'wolfSdf',nativeLod:true,furShells:false,flatShading:true};
  return {root,nodes,sockets,detail,stats,update,dispose(){if(disposed)return;disposed=true;if(compatible)render.eyes.forEach((eye:THREE.Mesh,i:number)=>eye.material=eyeMaterials[i]);animal.dispose();extraMaterials.forEach(m=>m.dispose());root.removeFromParent();}};
}
