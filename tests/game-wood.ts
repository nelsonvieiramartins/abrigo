import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createWoodDamage,createWoodTest,woodContact,WOOD_TARGET} from '../src/game-wood';
import {createGameCourse} from '../src/game-course';
import {createCharacter} from '../src/character';
import {presetCharacter,clone,DEFAULT} from '../src/schema';
const inside={x:-5,y:1,z:5},outside={x:-6,y:1,z:5};
assert(woodContact(outside,{x:-4,y:1,z:5}),'swept blade hits even if both endpoints are outside');
assert(!woodContact({...outside,y:2},{x:-4,y:2,z:5}),'above log misses');
assert(!woodContact({...outside,z:6},{x:-4,y:1,z:6}),'beside log misses');
const d=createWoodDamage();assert(!d.sample('idle',.6,[inside]));assert.equal(d.hits,0);
assert(!d.sample('attack',.2,[inside]),'wind-up does not cut');
assert(d.sample('attack',.5,[inside]));assert.equal(d.hits,1);
assert(!d.sample('attack',.6,[inside]));assert(!d.sample('attack',.6,[inside]),'paused time cannot cut');assert.equal(d.hits,1,'one damage event per strike');
assert(!d.sample('attack',.9,[inside]),'recovery does not cut');
for(let i=0;i<5;i++){d.sample('idle',0,[]);assert(d.sample('attackLateral',.5,[inside]));}assert(d.fallen);assert.equal(d.hits,6);assert(!d.sample('attack',.5,[inside]));d.reset();assert.equal(d.hits,0);assert(!d.fallen);
const spec=presetCharacter('lenhador');spec.items=clone(DEFAULT.items);spec.items.object='axe';spec.items.placement='right';spec.items.pose='ready';spec.items.hands.right='closed';spec.items.grip.right=[.18,.9,.9,.9,.9];
const model=createCharacter(spec,{detail:'high'}),course=createGameCourse(spec.body.height),collider=course.boxes.find(b=>b.id==='Tronco de madeira')!;
const wood=createWoodTest(collider);model.root.position.set(-5,0,4.2);model.root.rotation.y=0;
for(let strike=0;strike<6;strike++){
 model.update(0,'idle');wood.update(1/60,model.root,'idle',0,true);
 for(let i=0;i<78;i++){const t=i/60;model.update(t,'attack');wood.update(1/60,model.root,'attack',t,true);}
}
assert.equal(collider.top,.22,'real animated axe blade cuts the log after six strikes');
wood.reset();assert.equal(collider.top,WOOD_TARGET.height);assert(wood.status.includes('100%'));
const before=wood.status;for(let i=0;i<78;i++){model.update(i/60,'attack');wood.update(1/60,model.root,'attack',i/60,false);}assert.equal(wood.status,before,'paused arena is inert');
model.root.position.set(-5,0,2);for(let i=0;i<78;i++){model.update(i/60,'attack');wood.update(1/60,model.root,'attack',i/60,true);}assert.equal(wood.status,before,'attack from far away does not cut');
wood.dispose();model.dispose();
for(const hand of ['left','right','both'] as const)for(const motion of ['attack','attackLateral'] as const){
 const equipped=clone(spec);equipped.items.placement=hand;
 const axe=createCharacter(equipped,{detail:'high'}),target=createWoodTest(collider);let contacted=false;
 for(const [x,z] of [[-5,4.26],[-5.5,4.5],[-4.5,4.5],[-5.75,5],[-4.25,5],[-5,5.75]]){
  target.reset();axe.root.position.set(x,0,z);axe.root.rotation.y=0;
  for(let i=0;i<78;i++){axe.update(i/60,motion);target.update(1/60,axe.root,motion,i/60,true);}
  contacted ||= !target.status.includes('100%');
 }
 assert(contacted,`${hand} ${motion} can cut with the actual blade when positioned in reach`);target.dispose();axe.dispose();
}
console.log('Wood: swept blade contact, misses, one hit per strike, six-hit cut, animated axes (left/right/both, vertical/lateral), reset, pause and distance passed.');
