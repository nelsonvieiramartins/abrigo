import assert from 'node:assert/strict';
import {ATTACK_SPEED} from '../src/attack-timing';
import * as THREE from 'three';
import {presetCharacter,validateSpec} from '../src/schema';
import {createCharacter} from '../src/character';
import {objectInteraction,presetObject} from '../src/object-schema';
import {ITEM_SETUP_STORE,loadItemSetup,restoreItemSetup,saveItemSetup} from '../src/item-setups';

const lenhador=presetCharacter('lenhador');
assert.equal(lenhador.items.object,'none');
const spec=validateSpec({...lenhador,items:{object:'axe',placement:'right',pose:'ready',scale:1,offset:[0,0,0],rotation:[0,0,0],armMotion:{idle:false,walk:false,crouchWalk:false,backward:false,run:false,sprint:false,jumpWalk:false,jumpRun:false,jumpSprint:false,pose:false,wave:false,crouch:false,pickup:false,jump:false,attack:true,attackLateral:true,walkAttackLateral:true,runAttackLateral:true,backwardAttackLateral:true,pray:false},arms:{left:{spread:0,twist:0,swing:0},right:{spread:0,twist:0,swing:0}},hands:{left:'open',right:'closed'},grip:{left:[0,0,0,0,0],right:[1,1,1,1,1]}}});
const noArmMotion={idle:false,walk:false,crouchWalk:false,backward:false,run:false,sprint:false,jumpWalk:false,jumpRun:false,jumpSprint:false,pose:false,wave:false,crouch:false,pickup:false,jump:false,attack:true,attackLateral:true,walkAttackLateral:true,runAttackLateral:true,backwardAttackLateral:true,pray:false};
assert.deepEqual(spec.items,{object:'axe',placement:'right',pose:'ready',scale:1,offset:[0,0,0],rotation:[0,0,0],armMotion:noArmMotion,arms:{left:{spread:0,twist:0,swing:0},right:{spread:0,twist:0,swing:0}},hands:{left:'open',right:'closed'},grip:{left:[0,0,0,0,0],right:[1,1,1,1,1]}});
assert.deepEqual(validateSpec(JSON.parse(JSON.stringify(spec))),spec);
{
 const records=new Map<string,string>(),storage={getItem:(key:string)=>records.get(key)??null,setItem:(key:string,value:string)=>{records.set(key,value);}};
 const configured=validateSpec({...spec,items:{...spec.items,placement:'left',scale:1.7,offset:[.025,.04,-.02],rotation:[20,-35,10],arms:{left:{spread:.4,twist:-.2,swing:.6},right:{spread:-.3,twist:.1,swing:.2}},hands:{left:'closed',right:'open'},grip:{left:[.2,.8,.9,.7,.6],right:[.1,.2,.3,.4,.5]},armMotion:{...spec.items.armMotion,walk:true,run:false,jumpRun:true}}});
 saveItemSetup(storage,configured);
 const canteen=validateSpec({...spec,items:{object:'canteen',placement:'right',scale:.6,offset:[-.02,0,.01]}});saveItemSetup(storage,canteen);
 assert.deepEqual(loadItemSetup(storage,spec,'axe'),configured.items,'saved axe keeps every setting after switching objects');
 assert.deepEqual(loadItemSetup(storage,spec,'canteen'),canteen.items,'each object keeps a separate configuration');
 const reloaded={getItem:(key:string)=>records.get(key)??null,setItem:(key:string,value:string)=>records.set(key,value)};
 assert.deepEqual(restoreItemSetup(reloaded,spec).items,configured.items,'reload restores definitive settings over stale character draft');
 const edited=validateSpec({...configured,items:{...configured.items,scale:1.2}});saveItemSetup(storage,edited);
 assert.equal(loadItemSetup(storage,spec,'axe').scale,1.2,'saving again overwrites only that object');
 assert.deepEqual(loadItemSetup(storage,spec,'canteen'),canteen.items,'overwrite leaves other object settings untouched');
 const recipeA={...presetObject('axe'),id:'workshop-a'},recipeB={...presetObject('axe'),id:'workshop-b'};
 const customA=validateSpec({...configured,items:{...configured.items,object:'custom',recipe:recipeA}}),customB=validateSpec({...canteen,items:{...canteen.items,object:'custom',recipe:recipeB}});
 saveItemSetup(storage,customA);saveItemSetup(storage,customB);
 assert.equal(loadItemSetup(storage,spec,'custom',{...recipeA,name:'Objeto renomeado',parts:recipeA.parts.slice(1)}).scale,1.7,'custom identity survives rename and deletion of its first part');
 assert.equal(loadItemSetup(storage,spec,'custom',recipeB).scale,.6,'different custom objects do not share settings');
 const legacy={...configured.items,armMotion:{walk:true}};storage.setItem(ITEM_SETUP_STORE,JSON.stringify({axe:legacy}));
 const migrated=loadItemSetup(storage,spec,'axe');assert.equal(migrated.armMotion.walk,true);assert.equal(migrated.armMotion.run,false);assert.equal(migrated.armMotion.attackLateral,true,'older saved setups gain new motion defaults');
 const {recipe,...legacyCustom}=customA.items;storage.setItem(ITEM_SETUP_STORE,JSON.stringify({custom:legacyCustom}));
 assert.equal(loadItemSetup(storage,spec,'custom',recipeA).scale,1.7,'legacy custom setup is retained during migration');
 assert.equal(loadItemSetup(storage,spec,'custom',recipeB).scale,1,'legacy custom setup is not copied to other objects');
 records.set(ITEM_SETUP_STORE,'invalid json');assert.deepEqual(restoreItemSetup(storage,spec),spec,'corrupt storage leaves active character intact');
}
console.log('Saved item setups: complete per-object persistence, reload, overwrite, custom identity, legacy migration and corruption handling passed.');
{
 const records=new Map<string,string>(),storage={getItem:(k:string)=>records.get(k)??null,setItem:(k:string,v:string)=>records.set(k,v)};
 const invisible=validateSpec({...lenhador,items:{...lenhador.items,object:'invisible',placement:'both',twoHandSpread:.85}});
 saveItemSetup(storage,invisible);assert.equal(loadItemSetup(storage,lenhador,'invisible').twoHandSpread,.85);
 assert.throws(()=>validateSpec({...invisible,items:{...invisible.items,twoHandSpread:2}}));
 for(const detail of ['low','high'] as const){
  const m=createCharacter(invisible,{detail});assert(!Object.keys(m.nodes).some(n=>n.startsWith('item-')),'invisible pose creates no object geometry');
  m.update(.2,'walk');const arm=m.nodes.upperArmR.rotation.x;m.update(.8,'walk');assert.equal(m.nodes.upperArmR.rotation.x,arm,'invisible OFF locks pose');
  m.update(0,'idle');m.root.updateMatrixWorld(true);const left=m.nodes.handL.getWorldPosition(new THREE.Vector3()),right=m.nodes.handR.getWorldPosition(new THREE.Vector3());
  assert(left.x>right.x,'two hand pose does not cross the hands');assert(left.distanceTo(right)>.25,'two hand pose opens the arms');m.dispose();
 }
 const narrow=createCharacter(validateSpec({...invisible,items:{...invisible.items,twoHandSpread:0}})),wide=createCharacter(invisible);
 narrow.update(0,'idle');wide.update(0,'idle');assert(wide.nodes.upperArmL.rotation.z>narrow.nodes.upperArmL.rotation.z,'opening control changes shoulder angle');narrow.dispose();wide.dispose();
}
assert.deepEqual(validateSpec({...spec,items:{hand:'axe'}}).items,{object:'axe',placement:'right',pose:'relaxed',scale:1,offset:[0,0,0],rotation:[0,0,0],armMotion:noArmMotion,arms:{left:{spread:0,twist:0,swing:0},right:{spread:0,twist:0,swing:0}},hands:{left:'open',right:'open'},grip:{left:[0,0,0,0,0],right:[0,0,0,0,0]}});
assert.deepEqual(objectInteraction('lantern'),{action:'use',hands:['left','right']});
assert.deepEqual(objectInteraction('axe'),{action:'swing',hands:['left','right','both']});
assert.deepEqual(objectInteraction('canteen'),{action:'use',hands:['left','right']});
assert.throws(()=>validateSpec({...spec,items:{object:'lantern',placement:'both'}}));
const custom=presetObject('lantern');custom.name='Lampião criado';
const customSpec=validateSpec({...spec,items:{object:'custom',placement:'left',recipe:custom}});
assert.equal(customSpec.items.recipe?.name,'Lampião criado');
const customModel=createCharacter(customSpec,{detail:'low'});assert(customModel.root.getObjectByName('item-custom'));customModel.dispose();
const twoHanded=validateSpec({...spec,items:{object:'axe',placement:'both'}});
const twoHandedModel=createCharacter(twoHanded,{detail:'high'});twoHandedModel.update(.37,'idle');twoHandedModel.root.updateMatrixWorld(true);
assert(twoHandedModel.root.getObjectByName('item-axe')?.matrixWorld.elements.every(Number.isFinite));twoHandedModel.dispose();
for(const placement of ['right','left','both'] as const){
 const configured=validateSpec({...spec,items:{...spec.items,placement,offset:[.014,.02,-.01],rotation:[10,20,30],scale:1.3}});
 const model=createCharacter(configured,{detail:'low'}),arm=model.nodes[placement==='left'?'upperArmL':'upperArmR'],item=model.nodes['item-axe'];
 model.update(.52/ATTACK_SPEED,'attack');model.root.updateMatrixWorld(true);
 const raised=arm.rotation.x,local=item.matrix.clone(),world=item.matrixWorld.clone();
 model.update(.92/ATTACK_SPEED,'attack');model.root.updateMatrixWorld(true);
 assert(Math.abs(raised-arm.rotation.x)>1,'attack: equipped arm must swing');
 assert(!world.equals(item.matrixWorld),'attack: item must follow the hand');
 assert(local.equals(item.matrix),'attack: saved item transform must stay unchanged');
 if(placement==='both')assert.equal(model.nodes.upperArmL.rotation.x,model.nodes.upperArmR.rotation.x);
 for(const t of [0,.52,.92,1.65,1.9]){model.update(t,'attack');model.root.updateMatrixWorld(true);model.root.traverse(o=>assert(o.matrixWorld.elements.every(Number.isFinite)));}
 model.dispose();
 const locked=createCharacter(validateSpec({...configured,items:{...configured.items,armMotion:{...configured.items.armMotion,attack:false}}}),{detail:'low'});
 const lockedArm=locked.nodes[placement==='left'?'upperArmL':'upperArmR'];locked.update(.52,'attack');const pitch=lockedArm.rotation.x;locked.update(.92,'attack');assert.equal(lockedArm.rotation.x,pitch,'attack OFF: equipped arm remains in carry pose');locked.dispose();
}
console.log('Attack: both hands and single hands, moving attachment, saved transform and independent OFF passed.');
for(const placement of ['right','left','both'] as const){
 const configured=validateSpec({...spec,items:{...spec.items,placement}});
 const model=createCharacter(configured,{detail:'low'}),suffix=placement==='left'?'L':'R',arm=model.nodes['upperArm'+suffix],hand=model.nodes['hand'+suffix],item=model.nodes['item-axe'];
 model.update(.52/ATTACK_SPEED,'attackLateral');model.root.updateMatrixWorld(true);
 const pitch=arm.rotation.x,x=hand.matrixWorld.elements[12],local=item.matrix.clone();
 model.update(.92/ATTACK_SPEED,'attackLateral');model.root.updateMatrixWorld(true);
 assert.equal(arm.rotation.x,pitch,'lateral attack: shoulder pitch remains level');
 assert(Math.abs(hand.matrixWorld.elements[12]-x)>.2,'lateral attack: hand must sweep across horizontally');
 assert(local.equals(item.matrix),'lateral attack: saved item transform is preserved');
 model.update(1.9/ATTACK_SPEED,'attackLateral');assert(Math.abs(model.nodes.spine.rotation.y)<1e-8,'lateral attack: recover torso rotation');
 model.update(0,'idle');assert.equal(arm.rotation.y,0,'idle: no leftover attack rotation');model.dispose();
 const locked=createCharacter(validateSpec({...configured,items:{...configured.items,armMotion:{...configured.items.armMotion,attackLateral:false}}}),{detail:'low'});
 locked.update(.52,'attackLateral');const rotation=locked.nodes['upperArm'+suffix].rotation.toArray();locked.update(.92,'attackLateral');assert.deepEqual(locked.nodes['upperArm'+suffix].rotation.toArray(),rotation,'lateral attack OFF: arm remains locked');locked.dispose();
}
console.log('Lateral attack: horizontal sweep, level pitch, both hands, saved attachment, recovery and independent OFF passed.');
{
 const model=createCharacter(lenhador,{detail:'low'});
 model.update((Math.PI/2-.2)/5.2,'backward');model.root.updateMatrixWorld(true);
 const lifted=model.nodes.footL.matrixWorld.elements[14],planted=model.nodes.footR.matrixWorld.elements[14];
 model.update((Math.PI/2+.2)/5.2,'backward');model.root.updateMatrixWorld(true);
 assert(model.nodes.footL.matrixWorld.elements[14]<lifted,'retreat: lifted foot travels backward');
 assert(model.nodes.footR.matrixWorld.elements[14]>planted,'retreat: planted foot moves forward relative to the body');
 for(let i=0;i<24;i++){model.update(i*(2*Math.PI/5.2)/24,'backward');model.root.updateMatrixWorld(true);assert(Math.abs(model.nodes.hips.rotation.y)<1e-8,'retreat: character keeps facing forward');model.root.traverse(o=>assert(o.matrixWorld.elements.every(Number.isFinite)));}
 model.dispose();
}
console.log('Retreat: reversed foot travel, stable facing and finite animation passed.');
for(const [motion,gait] of [['walkAttackLateral','walk'],['runAttackLateral','run'],['backwardAttackLateral','backward']] as const)for(const placement of ['right','left','both'] as const){
 const configured=validateSpec({...spec,items:{...spec.items,placement}}),model=createCharacter(configured,{detail:'low'});
 const hand=placement==='left'?'L':'R',arm=model.nodes['upperArm'+hand],item=model.nodes['item-axe'];
 for(const t of [.17,.52,.92,1.65,1.9]){
   model.update(t,gait);model.root.updateMatrixWorld(true);
   const feet=['footL','footR'].map(k=>model.nodes[k].matrixWorld.elements.slice());
   const freeArm=model.nodes[hand==='R'?'upperArmL':'upperArmR'].rotation.x;
   model.update(t,motion);model.root.updateMatrixWorld(true);
   for(const [i,k] of ['footL','footR'].entries())assert.deepEqual(model.nodes[k].matrixWorld.elements,feet[i],`${motion}: keep original gait foot targets`);
   if(placement!=='both')assert.equal(model.nodes[hand==='R'?'upperArmL':'upperArmR'].rotation.x,freeArm,`${motion}: free arm continues gait`);
   assert(Math.abs(model.nodes['hand'+hand].rotation.y-(hand==='R'?-1:1)*Math.PI/9)<1e-8,`${motion}: preserve -20 degree wrist adjustment`);
 }
 model.update(.52/ATTACK_SPEED,motion);model.root.updateMatrixWorld(true);const yaw=arm.rotation.y,local=item.matrix.clone(),world=item.matrixWorld.clone();
 model.update(.92/ATTACK_SPEED,motion);model.root.updateMatrixWorld(true);assert(Math.abs(arm.rotation.y-yaw)>1,`${motion}: lateral strike while moving`);assert(local.equals(item.matrix));assert(!world.equals(item.matrixWorld));model.dispose();
 const locked=createCharacter(validateSpec({...configured,items:{...configured.items,armMotion:{...configured.items.armMotion,[motion]:false}}}),{detail:'low'});
 locked.update(.52,motion);const rotation=locked.nodes['upperArm'+hand].rotation.toArray();locked.update(.92,motion);assert.deepEqual(locked.nodes['upperArm'+hand].rotation.toArray(),rotation,`${motion}: independent OFF locks holding arm`);locked.dispose();
}
console.log('Walking/running/retreating lateral attacks: unchanged gait, free-arm swing, item attachment, wrist angle and independent OFF passed.');
{
 const model=createCharacter(spec,{detail:'low'});
 model.update(0,'idle');model.root.updateMatrixWorld(true);const feet=['footL','footR'].map(k=>model.nodes[k].matrixWorld.elements.slice(12,15));
 for(const t of [.2,.5,.85,2,10]){
   model.update(t,'crouch');model.root.updateMatrixWorld(true);
   for(const [i,k] of ['footL','footR'].entries())for(let axis=0;axis<3;axis++)assert(Math.abs(model.nodes[k].matrixWorld.elements[12+axis]-feet[i][axis])<.002,'crouch: feet stay planted');
   model.root.traverse(o=>assert(o.matrixWorld.elements.every(Number.isFinite)));
 }
 assert(model.nodes.hips.position.y<.65,'crouch: pelvis lowers');assert(model.nodes.lowerLegL.rotation.x>1,'crouch: knees bend');
 const held=model.nodes.hips.position.y;model.update(20,'crouch');assert.equal(model.nodes.hips.position.y,held,'crouch: stays down while selected');
 model.update(0,'idle');assert.equal(model.nodes.hips.position.y,.92,'crouch: stand again after changing motion');model.dispose();
}
console.log('Crouch: planted feet, bent knees, held squat, finite transforms and standing reset passed.');
for(const detail of ['low','high'] as const){
 const model=createCharacter(spec,{detail});model.update(0,'idle');model.root.updateMatrixWorld(true);
 const ground=model.nodes.footL.matrixWorld.elements[13];
 for(let i=0;i<24;i++){
   model.update(i*(2*Math.PI/4.5)/24,'crouchWalk');model.root.updateMatrixWorld(true);
   assert(model.nodes.hips.position.y<.65,'crouch walk: remain low throughout the steps');
   for(const leg of ['lowerLegL','lowerLegR'])assert(model.nodes[leg].rotation.x>1,'crouch walk: knees stay bent');
   const ys=['footL','footR'].map(k=>model.nodes[k].matrixWorld.elements[13]);assert(Math.abs(Math.min(...ys)-ground)<.005,'crouch walk: one foot stays planted');assert(Math.min(...ys)>=ground-.005,'crouch walk: feet never sink into floor');
   model.root.traverse(o=>assert(o.matrixWorld.elements.every(Number.isFinite)));
 }
 model.update((Math.PI/2-.2)/4.5,'crouchWalk');model.root.updateMatrixWorld(true);const z=model.nodes.footL.matrixWorld.elements[14];
 model.update((Math.PI/2+.2)/4.5,'crouchWalk');model.root.updateMatrixWorld(true);assert(model.nodes.footL.matrixWorld.elements[14]>z,'crouch walk: lifted foot advances forward');
 model.update(0,'idle');assert.equal(model.nodes.hips.position.z,0,'crouch walk: reset pelvis offset on standing');model.dispose();
}
console.log('Crouch walk: short forward steps, bent knees, low hips, floor contact and standing reset passed.');
for(const placement of ['none','right','left'] as const){
 const configured=placement==='none'?lenhador:validateSpec({...spec,items:{...spec.items,placement}}),model=createCharacter(configured,{detail:'low'});
 const suffix=placement==='right'?'L':'R',hand=model.nodes['hand'+suffix];
 model.update(.85,'wave');model.root.updateMatrixWorld(true);
 assert(hand.matrixWorld.elements[13]>model.nodes.head.matrixWorld.elements[13]+.12,'wave: raise hand above head base');
 assert(Math.abs(hand.rotation.y-(suffix==='R'?-1:1)*Math.PI/3)<1e-8,'wave: wrist rotates -60 degrees, mirrored for each hand');
 const arm=model.nodes['upperArm'+suffix],angle=arm.rotation.z;model.update(1.1,'wave');assert(Math.abs(arm.rotation.z-angle)>.05,'wave: raised arm swings gently side to side');
 if(placement!=='none'){const holding=model.nodes[placement==='right'?'upperArmR':'upperArmL'];assert.equal(holding.rotation.x,-.48,'wave: equipped arm stays in its OFF carry pose');}
 model.update(3.6,'wave');assert(Math.abs(hand.rotation.y)<1e-8,'wave: return wrist to rest');
 model.update(0,'walk');assert.equal(hand.rotation.y,0,'wave: no wrist rotation leaks into walking');model.dispose();
}
console.log('Wave: higher raised-arm swing, -60-degree wrist, free-hand choice, equipped-arm lock and reset passed.');
for(const motion of ['jumpWalk','jumpRun','jumpSprint'] as const){
 const model=createCharacter(lenhador,{detail:'low'}),joints=['upperLegL','lowerLegL','footL','upperLegR','lowerLegR','footR'];
 model.update(.70,motion);const pose=joints.map(k=>model.nodes[k].rotation.x);
 for(const t of [.8,.96,1.15,1.25]){
   model.update(t,motion);model.root.updateMatrixWorld(true);
   for(const [i,k] of joints.entries())assert(Math.abs(model.nodes[k].rotation.x-pose[i])<1e-8,`${motion}: legs remain still during flight`);
 }
 model.update(.96,motion);model.root.updateMatrixWorld(true);
 assert(model.nodes.footR.matrixWorld.elements[14]>model.nodes.hips.matrixWorld.elements[14]+.2,`${motion}: front leg reaches forward`);
 assert(model.nodes.footL.matrixWorld.elements[14]<model.nodes.hips.matrixWorld.elements[14]-.2,`${motion}: rear leg reaches backward`);
 for(const foot of ['footL','footR'])assert(model.nodes[foot].matrixWorld.elements[13]>.2,`${motion}: both feet above the floor`);
 assert(model.nodes.upperArmR.rotation.x>.4&&model.nodes.upperArmL.rotation.x<-.6,`${motion}: one arm back and the other forward`);
 assert(model.nodes.handR.matrixWorld.elements[14]<model.nodes.upperArmR.matrixWorld.elements[14]-.1,`${motion}: rear hand stays behind its shoulder`);
 assert(model.nodes.handL.matrixWorld.elements[14]>model.nodes.upperArmL.matrixWorld.elements[14]+.2,`${motion}: front hand stays ahead of its shoulder`);
 for(const arm of ['upperArmL','upperArmR']){
   const angles:number[]=[];
   for(let i=0;i<=24;i++){model.update(.62+.68*i/24,motion);angles.push(model.nodes[arm].rotation.x);}
   const range=Math.max(...angles)-Math.min(...angles);assert(range>.14&&range<.161,`${motion}: small airborne arm swing`);
   const directions=angles.slice(1).map((v,i)=>Math.sign(v-angles[i]));
   const turns=directions.slice(1).filter((d,i)=>d!==directions[i]).length;assert.equal(turns,2,`${motion}: one arm cycle throughout flight`);
 }
 const gait=motion==='jumpWalk'?'walk':motion==='jumpRun'?'run':'sprint';
 const recoveredJoints=[...joints,'upperArmL','upperArmR'];
 model.update(1.9,motion);const recovered=recoveredJoints.map(k=>model.nodes[k].rotation.x);model.update(1.9,gait);
 for(const [i,k] of recoveredJoints.entries())assert(Math.abs(model.nodes[k].rotation.x-recovered[i])<1e-8,`${motion}: resume gait after landing`);
 model.dispose();
}
console.log('Moving jumps: split legs, opposed arms, one small airborne arm cycle, lifted feet and gait recovery passed.');
for(const detail of ['low','high','uhd'] as const){
 const model=createCharacter(spec,{detail});
 for(const name of ['item-axe','Cabo','Lâmina'])assert(model.root.getObjectByName(name),name);
 for(const motion of ['idle','walk','crouchWalk','backward','run','pickup','pray'] as const){
  model.update(.37,motion);model.root.updateMatrixWorld(true);
  const axe=model.root.getObjectByName('item-axe')!;
  assert(axe.matrixWorld.elements.every(Number.isFinite),`${detail}/${motion}: axe transform`);
 }
 console.log(detail,model.stats);model.dispose();
}
