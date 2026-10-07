import * as THREE from 'three';
import {createTerrain} from '../extras/editor-isometrico/terrain.js';
import {createEffects} from '../extras/editor-isometrico/effects-v2.js';
import {validateGameMap,validateMapReference,type MapReference,type GameMapData} from './game-map-data';

export function createGameMapScene(data:GameMapData){
 const root=new THREE.Group();root.name='Mapa editável — Terreno e Efeitos';
 const terrain=createTerrain(root),effects=createEffects(root);let disposed=false;
 terrain.set(data.terrain);effects.restore(data.effects);effects.items().forEach(e=>effects.configure(e,e.userData.options));
 let ground=data.ground;if(ground)terrain.setBase(ground);
 let reference:MapReference|null=null,texture:THREE.Texture|null=null,revision=0;
 const refMesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1,100,100),new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));refMesh.visible=false;root.add(refMesh);
 const syncReference=()=>{if(!reference)return;const r=reference;refMesh.visible=r.visible&&!!texture;refMesh.material.opacity=r.opacity;refMesh.rotation.set(-Math.PI/2,0,-THREE.MathUtils.degToRad(r.rotation));refMesh.scale.set(r.width,r.height,1);refMesh.position.set(r.x,.025,r.z);const a=refMesh.geometry.attributes.position,p=new THREE.Vector3();for(let i=0;i<a.count;i++){p.set(a.getX(i)*r.width,a.getY(i)*r.height,0).applyEuler(refMesh.rotation).add(refMesh.position);a.setZ(i,terrain.heightAt(p.x,p.z));}a.needsUpdate=true;refMesh.geometry.computeBoundingSphere();};
 const setReference=(value:MapReference|null)=>{if(value)validateMapReference(value);const old=reference?.image;reference=value?structuredClone(value):null;refMesh.visible=false;if(old===reference?.image){syncReference();return;}const token=++revision;texture?.dispose();texture=null;refMesh.material.map=null;refMesh.material.needsUpdate=true;if(reference)new THREE.TextureLoader().load(reference.image,t=>{if(disposed||token!==revision){t.dispose();return;}texture=t;t.colorSpace=THREE.SRGBColorSpace;refMesh.material.map=t;refMesh.material.needsUpdate=true;syncReference();});};
 if(data.reference)setReference(data.reference);
 const settleEffects=()=>{for(const item of effects.items())item.position.y=terrain.heightAt(item.position.x,item.position.z)+(item.userData.options.height??0);};
 settleEffects();
 return {root,terrain,effects,settleEffects,setReference,syncReference,setGround(color:string){if(!/^#[\da-f]{6}$/i.test(color))throw Error('Cor base inválida.');ground=color;terrain.setBase(color);},update:(time:number)=>effects.update(time),snapshot:()=>validateGameMap({version:1,terrain:terrain.snapshot(),effects:effects.serialize(),...(reference?{reference}: {}),...(ground?{ground}:{})}),
  dispose(){if(disposed)return;disposed=true;revision++;texture?.dispose();refMesh.geometry.dispose();refMesh.material.dispose();refMesh.removeFromParent();effects.dispose();terrain.dispose();root.removeFromParent();},
 };
}
