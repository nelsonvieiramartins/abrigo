import * as THREE from 'three';
import {criarZumbi} from './vendor/zumbi-procedural.mjs';
import {seededRandom,type CharacterSpec,type Motion} from './schema';
import type {CharacterModel,Expression} from './character';

// User-supplied procedural asset, adapted to ABRIGO's absolute-time animation contract.
// The invisible driver is never added to the scene and owns its original resources.
export function createZombieCharacter(spec:CharacterSpec,driver:CharacterModel):CharacterModel {
 const seed=Math.floor(seededRandom(spec.seed)()*0xffffffff);
 const asset=criarZumbi(THREE,{height:spec.body.height,seed,colors:{skin:spec.appearance.skin,
   skinDark:new THREE.Color(spec.appearance.skin).multiplyScalar(.74),hair:spec.appearance.hairColor,
   eye:spec.appearance.eyeColor,jacket:spec.outfit.topColor,
   lapel:new THREE.Color(spec.outfit.topColor).multiplyScalar(1.16),pants:spec.outfit.pantsColor,shoe:spec.outfit.shoeColor}});
 const root:THREE.Group=asset.mesh,parts=asset.parts,visual=root.children[0];
 root.name=spec.name;root.userData.characterSpec=spec;
 const nodes:Record<string,THREE.Object3D>={hips:parts.pelvis,spine:parts.torso,neck:parts.neck,head:parts.head,jaw:parts.jaw};
 for(const a of parts.arms){const s=a.side<0?'R':'L';nodes['upperArm'+s]=a.shoulder;nodes['lowerArm'+s]=a.elbow;nodes['hand'+s]=a.wrist;}
 for(const l of parts.legs){const s=l.side<0?'R':'L';nodes['upperLeg'+s]=l.hip;nodes['lowerLeg'+s]=l.knee;nodes['foot'+s]=l.ankle;}
 parts.torso.scale.x=.84+spec.body.build*.4;
 parts.head.scale.set(spec.appearance.faceWidth*spec.body.head,spec.body.head,spec.body.head);
 for(const a of parts.arms)a.shoulder.position.x*=.78+spec.body.shoulders*.4;
 for(const l of parts.legs)l.hip.position.x*=.82+spec.body.hips*.4;
 if(['bald','balding'].includes(spec.appearance.hair))root.traverse(o=>{if(/cabelo|franja|mecha/.test(o.name))o.visible=false;});
 const sockets:Record<string,THREE.Object3D>={};
 const socket=(key:string,parent:THREE.Object3D,p:number[])=>{const g=new THREE.Group();g.name='socket-'+key;g.position.fromArray(p);parent.add(g);sockets[key]=g;return g;};
 socket('head',parts.head,[0,.28,0]);socket('back',parts.torso,[0,.32,-.19]);socket('belt',parts.pelvis,[.20,.04,0]);
 for(const s of ['R','L'])socket('hand'+s,nodes['hand'+s],[0,-.068,.006]);
 // Item grips and all saved socket transforms are built by the existing character factory.
 // Move only accessory roots; disposal remains with their original owner (the driver).
 for(const s of ['R','L'])for(const child of [...driver.sockets['hand'+s].children])if(child.name.startsWith('item-'))sockets['hand'+s].add(child);
 const extraNames=/^(backpack|pack-|backpack-strap|strap-buckle|hat|beanie|cap|glasses|tool-belt|tool-pouch)/;
 for(const key of ['spine','head','hips','socket-back','socket-belt']){
   const from=driver.nodes[key],to=key==='socket-back'?sockets.back:key==='socket-belt'?sockets.belt:nodes[key];
   if(from&&to)for(const child of [...from.children])if(extraNames.test(child.name))to.add(child);
 }
 // Generic tests and exporters expect finite vertex colors even with solid-color materials.
 root.traverse(o=>{if(o instanceof THREE.Mesh&&!o.geometry.getAttribute('color')){
   const a=new Float32Array(o.geometry.getAttribute('position').count*3);a.fill(1);o.geometry.setAttribute('color',new THREE.BufferAttribute(a,3));
 }});
 driver.update(0,'idle');
 const links=Object.entries(nodes).filter(([key])=>driver.nodes[key]).map(([key,node])=>({node,source:driver.nodes[key],base:node.quaternion.clone(),inverse:driver.nodes[key].quaternion.clone().invert()}));
 const sourceHipY=driver.nodes.hips.position.y,zombieHipY=parts.pelvis.position.y;
 const neutralJaw=parts.jaw.rotation.x;let expression:Expression='neutral',intensity=0,disposed=false;
 let triangles=0,meshes=0;root.traverse(o=>{if(o instanceof THREE.Mesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;}});
 const update=(time:number,motion:Motion='idle')=>{
   if(disposed)return;driver.update(time,motion);
   for(const l of links)l.node.quaternion.copy(l.base).multiply(l.inverse).multiply(l.source.quaternion);
   parts.pelvis.position.y=zombieHipY+(driver.nodes.hips.position.y-sourceHipY)*driver.root.scale.y/root.scale.y;
   parts.torso.rotation.z+=Math.sin(time*1.4)*.012;parts.head.rotation.z+=Math.sin(time*.8)*.016;
   parts.jaw.rotation.x=neutralJaw+(expression==='surprised'?.18:expression==='angry'?.07:0)*intensity;
   // Rigid-piece retargeting changes foot reach: ground the visual, never move the entity root.
   visual.position.y=0;root.updateMatrixWorld(true);
   const min=Math.min(...['footL','footR'].map(k=>new THREE.Box3().setFromObject(nodes[k]).min.y))-root.position.y;
   const airborne=motion.startsWith('jump');
   visual.position.y=(-min+(airborne?Math.max(0,(driver.nodes.hips.position.y-sourceHipY)*driver.root.scale.y):0))/root.scale.y;
   root.updateMatrixWorld(true);
 };
 const model:CharacterModel={root,nodes,sockets,stats:{triangles,meshes},detail:driver.detail,update,
   setExpression(name,k=1){expression=name;intensity=THREE.MathUtils.clamp(k,0,1);driver.setExpression(name,k);},
   dispose(){if(disposed)return;disposed=true;driver.dispose();asset.dispose();}};
 root.userData.sculptRuntime={nodes,sockets,colliders:{},destructionGroups:{}};
 update(0,'idle');
 const height=new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()).y;
 root.scale.multiplyScalar(spec.body.height/height);update(0,'idle');return model;
}
