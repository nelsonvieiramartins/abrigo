import assert from 'node:assert/strict';
import {presetCharacter,validateSpec} from '../src/schema';
import {createCharacter} from '../src/character';
import * as THREE from 'three';
const base=presetCharacter('lenhador');
assert.equal(base.style,undefined);
assert.deepEqual(validateSpec(JSON.parse(JSON.stringify(base))),base);
for(const style of [undefined,'faceted'] as const){
 for(const detail of ['low','high','uhd'] as const){
  const model=createCharacter({...base,style},{detail});
  console.log(style??'original',detail,model.stats);
  assert(model.stats.triangles<(style==='faceted'?(detail==='low'?10000:35000):detail==='low'&&base.items.object==='axe'?6500:detail==='low'?6000:detail==='uhd'?400000:65000));
  assert(model.root.getObjectByName('lumber-beard'));
  const shirt=model.root.getObjectByName('torso') as THREE.Mesh;
  const proxy=new THREE.Mesh(shirt.geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
  const ray=new THREE.Raycaster();
  const clothZ=(x:number,y:number)=>{ray.set(new THREE.Vector3(x,y,2),new THREE.Vector3(0,0,-1));return ray.intersectObject(proxy)[0].point.z;};
  model.root.traverse(o=>{
   if(o.name==='lumber-shirt-button')assert(Math.abs(o.position.z-clothZ(o.position.x,o.position.y)-.002)<1e-5,'button sewn onto shirt');
   if(o.name==='lumber-suspender'){
    const p=(o as THREE.Mesh).geometry.getAttribute('position');
    for(let i=0;i<p.count;i++)assert(Math.abs(p.getZ(i)-clothZ(p.getX(i),p.getY(i))-.0015)<1e-5,'strap follows shirt');
   }
  });
  proxy.material.dispose();
  for(const motion of ['idle','walk','run'] as const){model.update(.37,motion);model.root.updateMatrixWorld(true);model.root.traverse(o=>assert(o.matrixWorld.elements.every(Number.isFinite)));}
  model.dispose();
 }
}
