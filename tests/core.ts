import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createCharacter,EXPRESSIONS} from '../src/character';
import {MOTIONS,DEFAULT,OPTIONS,FACE_TYPES,FINE_KEYS,applyFaceType,clone,randomCharacter,validateSpec,presetCharacter} from '../src/schema';
const result={checks:[] as string[],characters:0,maxTriangles:{low:0,high:0}};
const LIMIT={low:6000,high:60000};
assert.deepEqual(randomCharacter('Nelson 2407'),randomCharacter('Nelson 2407'));
assert.notDeepEqual(randomCharacter('1'),randomCharacter('2'));
// Golden seeds: new options must never change what an existing seed generates.
{const g=randomCharacter('Nelson');assert.deepEqual([g.outfit.top,g.outfit.pants,g.profession],['tshirt','cargo','ranger'],'seed Nelson changed');}
result.checks.push('Deterministic generation: numeric and text seeds');
const round=validateSpec(JSON.parse(JSON.stringify(randomCharacter('Nelson'))));assert.deepEqual(round,randomCharacter('Nelson'));
for(const raw of [null,[],{}, {...DEFAULT,schemaVersion:2},{...DEFAULT,body:{...DEFAULT.body,height:NaN}},{...DEFAULT,appearance:{...DEFAULT.appearance,skin:'red'}},{...DEFAULT,traits:['fit','unfit']}])assert.throws(()=>validateSpec(raw));
assert.deepEqual(validateSpec({...DEFAULT,items:{hand:'axe'}}).items,{object:'axe',placement:'right',pose:'relaxed',scale:1,offset:[0,0,0],rotation:[0,0,0],armMotion:{idle:false,walk:false,crouchWalk:false,backward:false,run:false,sprint:false,jumpWalk:false,jumpRun:false,jumpSprint:false,pose:false,wave:false,crouch:false,pickup:false,jump:false,attack:true,attackLateral:true,walkAttackLateral:true,runAttackLateral:true,backwardAttackLateral:true,pray:false},arms:{left:{spread:0,twist:0,swing:0},right:{spread:0,twist:0,swing:0}},hands:{left:'open',right:'open'},grip:{left:[0,0,0,0,0],right:[0,0,0,0,0]}});
result.checks.push('JSON round trip, schema and malformed-input rejection');
{
 const model=createCharacter(DEFAULT,{detail:'low'});
 for(const [jump,gait] of [['jumpWalk','walk'],['jumpRun','run'],['jumpSprint','sprint']] as const){
   model.update(.96,gait);model.root.updateMatrixWorld(true);
   const base=model.nodes.hips.position.y;
   model.update(.96,jump);model.root.updateMatrixWorld(true);
   assert(model.nodes.hips.position.y>base+.2,`${jump}: jump must lift the body`);
   for(const foot of ['footL','footR'])assert(model.nodes[foot].getWorldPosition(new THREE.Vector3()).y>.2,`${jump}: both feet must leave the floor`);
   model.update(1.9,gait);const landed=model.nodes.hips.position.y;
   model.update(1.9,jump);assert(Math.abs(model.nodes.hips.position.y-landed)<1e-8,`${jump}: must return to gait after landing`);
 }
 model.dispose();
}
result.checks.push('Moving jumps: airborne body and both feet, followed by return to each gait');
function inspect(s:any){for(const detail of ['low','high'] as const)inspectAt(s,detail);}
function inspectAt(s:any,detail:'low'|'high'){
 const m=createCharacter(s,{detail});m.update(0,'idle');m.root.updateMatrixWorld(true);
 m.root.traverse((o:any)=>{if(!o.isMesh)return;const g=o.geometry;for(const attr of ['position','normal','color']){assert(g.attributes[attr]);for(const v of g.attributes[attr].array)assert(Number.isFinite(v),`${s.seed}: non-finite ${attr}`);}g.computeBoundingBox();assert(!g.boundingBox.isEmpty());});
 const limit=s.style==='faceted'&&detail==='low'?10000:s.outfit.top==='lumber'&&detail==='low'?6500:LIMIT[detail];
 assert(m.stats.triangles<limit,`${detail}: ${m.stats.triangles} triangles`);result.maxTriangles[detail]=Math.max(result.maxTriangles[detail],m.stats.triangles);
 for(const motion of Object.keys(MOTIONS) as (keyof typeof MOTIONS)[])for(const t of [0,.17,.63,1.25]){m.update(t,motion);m.root.updateMatrixWorld(true);for(const o of Object.values(m.nodes))for(const v of o.matrixWorld.elements)assert(Number.isFinite(v));}
 for(const motion of ['walk','run','sprint'] as const){m.update(.37,motion);m.root.updateMatrixWorld(true);const ys=['footL','footR'].map(k=>m.nodes[k].getWorldPosition(new THREE.Vector3()).y-.0895*m.root.scale.y);assert(Math.min(...ys)>-.015);assert(Math.min(...ys)<.015);}
 assert(Object.keys(m.sockets).includes('handR'));assert(Object.keys(m.sockets).includes('back'));
 m.dispose();assert.equal(m.root.parent,null);result.characters++;
}
for(const name of Object.keys(OPTIONS.profession))inspect(presetCharacter(name));
for(let i=0;i<60;i++)inspect(randomCharacter('case-'+i));
for(const top of Object.keys(OPTIONS.top))for(const pants of Object.keys(OPTIONS.pants))for(const hair of Object.keys(OPTIONS.hair)){
 const s=clone(DEFAULT);s.outfit.top=top;s.outfit.pants=pants;s.appearance.hair=hair;s.body.build=.98;s.body.shoulders=.05;inspect(s);
}
result.checks.push('148 configurations x 2 detail levels: finite geometry, sockets, four animation states and grounded stance');
const low=createCharacter(DEFAULT,{detail:'low'}),high=createCharacter(DEFAULT);assert.equal(high.detail,'high');assert(high.stats.triangles>low.stats.triangles*3);
for(const k of Object.keys(low.sockets))assert(high.sockets[k]);for(const k of Object.keys(low.nodes))assert(high.nodes[k],k);low.dispose();high.dispose();
result.checks.push('High detail is the default, keeps every node and socket of the low mesh');
// Faceted is a presentation mesh: denser than its low counterpart, while preserving
// planar illumination and a bounded triangle count for every base character.
for(const id of Object.keys(OPTIONS.profession)){
 const source=presetCharacter(id),low=createCharacter({...source,style:'faceted'},{detail:'low'}),facet=createCharacter({...source,style:'faceted'});
 assert(facet.stats.triangles>low.stats.triangles,`${id}: Facetado needs more detail than its low mesh`);
 assert(facet.stats.triangles<60000,`${id}: Facetado exceeded presentation budget`);
 const face=facet.root.getObjectByName('head-shape') as THREE.Mesh;assert.equal(face.material.flatShading,true,`${id}: Facetado must retain flat planes`);
 low.dispose();facet.dispose();
}
result.checks.push('Facetado: denser presentation mesh and flat planes for every preset');
// UHD: denser mesh, hair strands instanced over the hair (like the forest leaves), same rig, valid geometry.
for(const id of ['ranger','legendario','explorer','pedepano']){
 const high=createCharacter(presetCharacter(id)),uhd=createCharacter(presetCharacter(id),{detail:'uhd'});
 assert.equal(uhd.detail,'uhd');assert(uhd.stats.triangles>high.stats.triangles*1.8,`${id}: UHD should be much denser`);assert(uhd.stats.triangles<400000);
 for(const k of Object.keys(high.nodes))assert(uhd.nodes[k],k);
 let strands=0;uhd.root.traverse((o:any)=>{if(o.isInstancedMesh)strands+=o.count;if(o.isMesh)for(const v of o.geometry.attributes.position.array)assert(Number.isFinite(v));});
 assert(strands>1000,`${id}: expected hair or beard strands`);
 for(const m of ['idle','run','pray'] as const){uhd.update(.7,m);uhd.root.updateMatrixWorld(true);}
 high.dispose();uhd.dispose();
}
result.checks.push('UHD: denser mesh, instanced hair strands, same rig');
const a=createCharacter(DEFAULT),b=createCharacter(DEFAULT);
let aa:number[][]=[],bb:number[][]=[];a.root.traverse((o:any)=>{if(o.isMesh)aa.push(Array.from(o.geometry.attributes.position.array));});b.root.traverse((o:any)=>{if(o.isMesh)bb.push(Array.from(o.geometry.attributes.position.array));});assert.deepEqual(aa,bb);
a.update(0,'walk');a.root.updateMatrixWorld(true);const before=a.sockets.handR.getWorldPosition(new THREE.Vector3());a.update(.3,'walk');a.root.updateMatrixWorld(true);assert(before.distanceTo(a.sockets.handR.getWorldPosition(new THREE.Vector3()))>.01);a.dispose();b.dispose();
result.checks.push('Reproducible geometry and moving attachment sockets');
// Gait direction: the character faces +Z, so a lifted foot must travel forward (+Z) and a planted one backward.
const g=createCharacter(DEFAULT);
for(const motion of ['walk','run','sprint'] as const){
 let forward=0,backward=0;
 for(let i=0;i<200;i++){
  g.update(i/100,motion);g.root.updateMatrixWorld(true);const f0=g.nodes.footL.getWorldPosition(new THREE.Vector3());
  g.update(i/100+.005,motion);g.root.updateMatrixWorld(true);const dz=g.nodes.footL.getWorldPosition(new THREE.Vector3()).z-f0.z;
  if(f0.y>.1)dz>0?forward++:backward++;
 }
 assert(forward>20&&backward===0,`${motion}: lifted foot moves backward`);
 g.update(.3,motion);assert(motion==='run'?g.nodes.lowerArmL.rotation.x<-.5:g.nodes.lowerArmL.rotation.x<0,`${motion}: elbows must bend`);
}
g.dispose();
result.checks.push('Walk and run move forward (+Z): swing foot advances, planted foot pushes back');
// Actions: feet and knees never sink under the floor; kneeling rests both knees on it; the pickup hand reaches low.
{const c=createCharacter(DEFAULT),v=new THREE.Vector3(),ground=(k:string)=>c.nodes[k].getWorldPosition(v).y/c.root.scale.y;
 for(const motion of ['pickup','jump','pray'] as const)for(let i=0;i<=120;i++){c.update(i/120*9,motion);c.root.updateMatrixWorld(true);
  for(const k of ['footL','footR'])assert(ground(k)>.03,`${motion}: ankle under the floor`);for(const k of ['lowerLegL','lowerLegR'])assert(ground(k)>.02,`${motion}: knee under the floor`);}
 c.update(4,'pray');c.root.updateMatrixWorld(true);for(const k of ['lowerLegL','lowerLegR'])assert(ground(k)<.09,'pray: knees should rest on the floor');
 c.update(1.2,'pickup');c.root.updateMatrixWorld(true);assert(c.sockets.handR.getWorldPosition(v).y/c.root.scale.y<.3,'pickup: hand should reach near the floor');
 c.dispose();}
result.checks.push('Actions (pickup, jump, pray) stay above the floor; kneeling and reaching touch down');
// Footwear shape: the HD upper must be as wide as the sole at the ball of the foot (an oval, not a pointed wedge).
for(const shoes of ['boots','sneakers']){
 const s=clone(DEFAULT);s.outfit.shoes=shoes;const c=createCharacter(s);
 const width=(name:string)=>{const p=(c.nodes.footR.getObjectByName(name) as any).geometry.attributes.position;let w=0;for(let i=0;i<p.count;i++)if(Math.abs(p.getZ(i)-.12)<.01)w=Math.max(w,Math.abs(p.getX(i)));return w;};
 assert(width('shoeR')>width('soleR')*.8,`${shoes}: upper narrower than the sole at the toe box`);c.dispose();
}
result.checks.push('HD footwear upper fills the sole at the toe box');
// Backpack straps ride over chest pockets and flaps, with or without bust: no strap vertex inside a pocket box.
for(const top of ['jacket','fieldshirt'])for(const bust of [0,.5,1]){
 const s=clone(DEFAULT);s.outfit.top=top;s.outfit.backpack=true;s.body.bust=bust;const c=createCharacter(s);c.root.updateMatrixWorld(true);
 const boxes:any[]=[],straps:any[]=[];c.root.traverse((o:any)=>{if(!o.isMesh)return;if(/pocket|flap/.test(o.name))boxes.push(o);if(o.name==='backpack-strap')straps.push(o);});
 const v=new THREE.Vector3(),inv=new THREE.Matrix4();let inside=0;
 for(const b of boxes){b.geometry.computeBoundingBox();const bb=b.geometry.boundingBox.clone().expandByScalar(-.001);inv.copy(b.matrixWorld).invert();
  for(const st of straps){const p=st.geometry.attributes.position;for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(st.matrixWorld).applyMatrix4(inv);if(bb.containsPoint(v))inside++;}}}
 assert.equal(inside,0,`${top} bust ${bust}: strap cuts through a pocket`);c.dispose();
}
result.checks.push('Backpack straps clear chest pockets at any bust size');
// Facial animation: eyes open at t=0 (sprite sheets), blinks happen, brows move, and two seeds do not blink in sync.
const blinks=(seed:string)=>{
 const s=clone(DEFAULT);s.seed=seed;const c=createCharacter(s),lid=c.nodes.eyeR.getObjectByName('eyelid')!,brow=c.nodes.eyeL.getObjectByName('brow')!;
 c.update(0);assert.equal(lid.scale.y,1,'eyes must be open at t=0');
 const closed:number[]=[];let lo=1,hi=-1;
 for(let i=0;i<2000;i++){c.update(i/100);if(lid.scale.y>1.7&&!closed.includes(Math.round(i/25)))closed.push(Math.round(i/25));lo=Math.min(lo,brow.position.y);hi=Math.max(hi,brow.position.y);}
 assert(closed.length>=3,`${seed}: expected several blinks in 20 s`);assert(hi-lo>.002,`${seed}: brows should move`);c.dispose();return closed.join();
};
assert.notEqual(blinks('alpha'),blinks('beta'));
// Gaze: held fixations joined by quick saccades, small enough to stay on the eyeball.
{const c=createCharacter(DEFAULT),iris=c.nodes.eyeR.getObjectByName('iris')!;let prev=0,moving=0,max=0;
 for(let i=0;i<2000;i++){c.update(i/100);if(Math.abs(iris.position.x-prev)>1e-5)moving++;prev=iris.position.x;max=Math.max(max,Math.abs(prev));}
 assert(moving>10&&moving<300,`gaze should mostly hold still (${moving} moving frames)`);assert(max>.001&&max<=.0033);c.dispose();}
result.checks.push('Face: blinks, brow motion, gaze saccades and per-seed rhythm; eyes open at t=0');
// Expressions: every one changes the face, keeps blinking, eases in smoothly and never produces invalid geometry.
{const c=createCharacter(DEFAULT),lid=c.nodes.eyeR.getObjectByName('eyelid')!,lip=c.nodes.head.getObjectByName('lower-lip') as any;
 const snap=()=>[lid.position.y,c.nodes.eyeL.getObjectByName('brow')!.rotation.z,lip.geometry.attributes.position.getY(0)].map(v=>v.toFixed(5)).join();
 c.update(4.3);const neutral=snap();
 for(const name of Object.keys(EXPRESSIONS) as (keyof typeof EXPRESSIONS)[]){
  c.setExpression(name,1,true);c.update(4.3);if(name!=='neutral')assert.notEqual(snap(),neutral,`${name} should change the face`);
  let closed=false;for(let i=0;i<2000;i++){c.update(i/100);if(lid.scale.y>1.7)closed=true;}assert(closed,`${name}: blinking must continue`);
  for(const v of lip.geometry.attributes.position.array)assert(Number.isFinite(v));
 }
 c.setExpression('neutral',1,true);c.update(10);c.setExpression('surprised');c.update(10.02);const mid=lid.position.y;c.update(11);assert(Math.abs(lid.position.y-mid)>1e-4,'expressions should ease in');
 c.dispose();}
result.checks.push('Expressions: six faces, blinking kept, smooth transitions');
// Face features: every option and face type builds valid geometry; files saved before them still load.
for(const id of Object.keys(FACE_TYPES))inspect(applyFaceType(clone(DEFAULT),id));
for(const k of ['faceShape','chin','brows','nose','mouth'] as const)for(const v of Object.keys(OPTIONS[k])){const s=clone(DEFAULT);(s.appearance as any)[k]=v;s.appearance.beard='goatee';inspect(s);}
{const old:any=clone(DEFAULT);for(const k of ['faceShape','chin','cheeks','brows','nose','mouth'])delete old.appearance[k];const v=validateSpec(old);assert.equal(v.appearance.faceShape,'oval');assert.equal(v.appearance.cheeks,.5);assert.equal(v.appearance.chinSize,.5);}
for(const chinSize of [0,1]){const s=clone(DEFAULT);s.appearance.chinSize=chinSize;inspect(s);}
{const s:any=clone(DEFAULT);s.appearance.faceShape='block';s.appearance.chin='flat';const v=validateSpec(s);assert.equal(v.appearance.faceShape,'square');assert.equal(v.appearance.chin,'square');}
result.checks.push('Face types and features: all options valid; older files default to the classic face');
// The nose bridge stays embedded in the face for every face shape, chin and nose.
for(const shape of Object.keys(OPTIONS.faceShape))for(const chin of Object.keys(OPTIONS.chin))for(const nose of Object.keys(OPTIONS.nose)){
 const s=clone(DEFAULT);Object.assign(s.appearance,{faceShape:shape,chin,nose});const c=createCharacter(s);
 const np=(c.nodes.head.getObjectByName('nose') as any).geometry.attributes.position,hp=(c.nodes.head.getObjectByName('head-shape') as any).geometry.attributes.position;
 let back=9,front=-1;for(let i=0;i<np.count;i++)if(np.getY(i)>.11&&np.getY(i)<.14)back=Math.min(back,np.getZ(i));
 for(let j=0;j<hp.count;j++)if(hp.getY(j)>.11&&hp.getY(j)<.14&&Math.abs(hp.getX(j))<.01)front=Math.max(front,hp.getZ(j));
 assert(back<front,`${shape}/${chin}/${nose}: nose floats off the face`);c.dispose();
}
result.checks.push('Nose stays on the face for every shape, chin and nose');
// Engenheira: her pieces are built, older files load without the new fields, and no random seed wears them.
{
 const e=createCharacter(presetCharacter('engineer')),names=new Set<string>();e.root.traverse(o=>names.add(o.name));
 for(const n of ['engineer-corset','engineer-harness','open-collar','engineer-necklace','tool-belt-slung','tool-pouch','gear-rim','thigh-strapL','boot-shaftL','boot-cuffL','boot-laceL','glove-wrapR','eyeliner','hair-blade'])assert(names.has(n),`Engenheira sem ${n}`);
 assert(!names.has('nail'),'luvas devem esconder as unhas');
 const old=JSON.parse(JSON.stringify(DEFAULT));delete old.outfit.gloves;delete old.outfit.toolBelt;delete old.appearance.makeup;
 const v=validateSpec(old);assert.equal(v.outfit.gloves,false);assert.equal(v.outfit.toolBelt,false);assert.equal(v.appearance.makeup,false);
 for(let i=0;i<300;i++){const r=randomCharacter('e'+i);assert(r.outfit.top!=='engineer'&&r.outfit.shoes!=='tallboots'&&r.appearance.hair!=='tousled'&&r.appearance.nose!=='small'&&r.profession!=='engineer'&&!r.outfit.gloves&&!r.outfit.toolBelt&&!r.appearance.makeup,'opção nova no sorteio');}
 e.dispose?.();
}
result.checks.push('Engenheira: corset, harness, tool belt, tall boots, gloves, liner and tousled hair; new options stay out of random pools');
// Advanced face mode: every fine offset changes the face at both ends, stays finite, survives a JSON round trip
// and is cleared by picking a face type.
{
 const faceOf=(fine?:Record<string,number>)=>{const s=clone(DEFAULT);if(fine)s.appearance.fine=fine;const c=createCharacter(s);c.update(0,'idle');const head=c.nodes.head,p:number[]=[];
  head.updateMatrixWorld(true);head.traverse((o:any)=>{if(!o.isMesh||o.isInstancedMesh)return;const a=o.geometry.getAttribute('position'),v=new THREE.Vector3();for(let i=0;i<a.count;i+=7){v.fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld);p.push(v.x,v.y,v.z);}});
  assert(p.every(Number.isFinite),'geometria inválida');return p;};
 const base=faceOf();
 for(const k of FINE_KEYS)for(const v of [-1,1]){const p=faceOf({[k]:v});assert(p.length!==base.length||p.some((x,i)=>Math.abs(x-base[i])>1e-5),`ajuste fino ${k}=${v} não muda o rosto`);}
 const s=clone(DEFAULT);s.appearance.fine={eyeSize:.4,noseTip:-.3};assert.deepEqual(validateSpec(JSON.parse(JSON.stringify(s))).appearance.fine,{eyeSize:.4,noseTip:-.3});
 assert.throws(()=>{const b=clone(DEFAULT) as any;b.appearance.fine={eyeSize:3};validateSpec(b);});
 applyFaceType(s,'classic');assert.equal(s.appearance.fine,undefined);
}
result.checks.push(`Advanced face mode: ${FINE_KEYS.length} fine offsets each reshape the face, round-trip in JSON and reset with a face type`);
// Soft hips bend only the top of the thigh: while running, the end of the thigh still meets the knee.
for(const id of ['explorer','engineer','ranger']){
 const m=createCharacter(presetCharacter(id));
 for(const t of [.2,.9,1.35]){
  m.update(t,'run');m.root.updateMatrixWorld(true);
  for(const k of ['L','R']){
   const thigh=m.nodes['upperLeg'+k].children.find((o:any)=>o.name==='thigh'+k) as THREE.Mesh,knee=m.nodes['lowerLeg'+k].getWorldPosition(new THREE.Vector3());
   const a=thigh.geometry.getAttribute('position'),c=new THREE.Vector3(),v=new THREE.Vector3();let n=0;
   for(let i=0;i<a.count;i++)if(a.getY(i)<-.4){c.add(v.fromBufferAttribute(a,i).applyMatrix4(thigh.matrixWorld));n++;}
   c.divideScalar(n);assert(c.distanceTo(knee)<.03,`${id} t=${t}: a coxa ${k} se solta do joelho (${c.distanceTo(knee).toFixed(3)} m)`);
  }
 }
 m.dispose();
}
result.checks.push('Soft hips: the thigh bends only at the top; its end stays on the knee while running');
{
 const s=presetCharacter('lenhador');assert.deepEqual(validateSpec(JSON.parse(JSON.stringify(s))),s);
 assert.equal(s.style,undefined,'Lenhador starts with the original mesh style');
 for(const style of [undefined,'faceted'] as const){
 s.style=style;
 for(const detail of ['low','high','uhd'] as const){
   const m=createCharacter(s,{detail});
   for(const name of ['lumber-beard','lumber-swept-lock','lumber-jacket-back','lumber-jacket-front','lumber-jacket-pocket','lumber-rolled-cuff'])assert(m.root.getObjectByName(name),name);
   assert(m.stats.triangles<(style==='faceted'?(detail==='low'?10000:35000):detail==='low'&&s.items.object==='axe'?6500:detail==='low'?6000:detail==='uhd'?400000:65000));
   assert.equal(m.root.getObjectByName('lumber-coat-tail'),undefined);
   assert.equal(m.root.getObjectByName('lumber-jacket-back')?.parent?.name,'spine');
   if(style==='faceted')assert.equal((m.root.getObjectByName('head-shape') as THREE.Mesh).material.flatShading,true);
   m.dispose();
 }
 }
 for(let i=0;i<300;i++){const r=randomCharacter(String(i));assert.notEqual(r.profession,'lenhador');assert.notEqual(r.appearance.hair,'lumber');assert.notEqual(r.appearance.beard,'lumber');assert.notEqual(r.outfit.top,'lumber');}
}
result.checks.push('Lenhador: original style by default, optional faceted style, hand axe, sculpted pieces, short torso-mounted jacket, three detail budgets and stable random pools');
console.log(JSON.stringify(result,null,2));
