import strictAssert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createCreature} from '../src/creature';
import * as THREE from 'three';
import {buildDetailedRat,RAT_RUN_PERIOD,RAT_RUN_SPEED,RAT_RUN_PLUS_PERIOD,RAT_RUN_PLUS_SPEED} from '../src/rat-detail';
import {presetCreature,validateCreatureSpec,randomCreature,CREATURE_SPECIES} from '../src/creature-schema';
const assert=(ok:boolean,message:string)=>{if(!ok)throw new Error(message);};
for(const species of Object.keys(CREATURE_SPECIES) as Array<keyof typeof CREATURE_SPECIES>){
 assert(validateCreatureSpec(presetCreature(species)).species===species,'Preset regression '+species);
 assert(validateCreatureSpec(randomCreature('rat-regression',species)).species===species,'Random regression '+species);
}
for(const value of [NaN,Infinity,.69,1.31]){const raw=presetCreature('rat');raw.rat!.headSize=value;let rejected=false;try{validateCreatureSpec(raw);}catch{rejected=true;}assert(rejected,'Invalid rat shape admitted');}
for(const detail of ['high','low'] as const)for(const variation of ['neutral','short-legs-large-paws','long-legs-long-tail','small-head','large-head'] as const){
 const raw=presetCreature('rat');
 if(variation==='short-legs-large-paws'){raw.rat!.legLength=.7;raw.rat!.pawSize=1.3;raw.rat!.bodyLength=1.3;raw.rat!.tailLength=1.3;}
 if(variation==='long-legs-long-tail'){raw.rat!.legLength=1.3;raw.rat!.pawSize=.7;raw.rat!.bodyWidth=1.3;raw.rat!.tailLength=1.3;raw.rat!.tailThickness=1.3;}
 if(variation==='small-head'){raw.rat!.headSize=.7;raw.rat!.earSize=.7;raw.rat!.muzzleLength=.7;}
 if(variation==='large-head'){raw.rat!.headSize=1.3;raw.rat!.earSize=1.3;raw.rat!.muzzleLength=1.3;}
 const spec=validateCreatureSpec(raw),body=new THREE.Group(),nodes:Record<string,THREE.Object3D>={},sockets:Record<string,THREE.Object3D>={},geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
 const animate=buildDetailedRat(spec,{body,nodes,sockets,geometries,materials},detail),original=[...geometries].map(g=>Array.from(g.getAttribute('position').array));
 let triangles=0,meshes=0;body.traverse(o=>{if(o instanceof THREE.Mesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;assert(geometries.has(o.geometry)&&materials.has(o.material as THREE.Material),'Unregistered resource');assert(Array.from(o.geometry.getAttribute('position').array).every(Number.isFinite),'Invalid vertex');}});
 assert(meshes<=40&&triangles<=7000,'Geometry budget exceeded');assert(materials.size===5,'Material budget exceeded');
 assert(!!sockets.head&&!!sockets.mouth&&!!sockets.target&&!!sockets.tailTip,'Missing sockets');
 for(const pair of ['front','hind']){
  const left=nodes['paw-'+pair+'L'].children.find(o=>o instanceof THREE.Mesh) as THREE.Mesh,right=nodes['paw-'+pair+'R'].children.find(o=>o instanceof THREE.Mesh) as THREE.Mesh;
  const lp=left.geometry.getAttribute('position'),rp=right.geometry.getAttribute('position'),key=(x:number,y:number,z:number)=>[x,y,z].map(v=>Math.round(v*1e6)).join(',');
  const reflected=new Set<string>();for(let i=0;i<rp.count;i++)reflected.add(key(-rp.getX(i),rp.getY(i),rp.getZ(i)));
  for(let i=0;i<lp.count;i++)assert(reflected.has(key(lp.getX(i),lp.getY(i),lp.getZ(i))),'Asymmetric paws');
 }
 for(const motion of ['idle','move','run','runPlus','attack'] as const){
  animate(0,'idle');animate(0,motion);
  for(let i=0;i<=72;i++){
   animate(i/90,motion);body.updateMatrixWorld(true);body.traverse(o=>assert(o.matrixWorld.elements.every(Number.isFinite),'Invalid transform'));
   for(const rear of [false,true])for(const side of ['L','R']){
    const name=(rear?'hind':'front')+side,hip=nodes[name].getWorldPosition(new THREE.Vector3()),knee=nodes['knee-'+name].getWorldPosition(new THREE.Vector3()),ankle=nodes['paw-'+name].getWorldPosition(new THREE.Vector3());
    assert(Math.abs(hip.distanceTo(knee)-(rear?.070:.051)*spec.rat!.legLength)<1e-6,'Upper limb stretch');assert(Math.abs(knee.distanceTo(ankle)-(rear?.069:.056)*spec.rat!.legLength)<1e-6,'Lower limb stretch');
    const bounds=new THREE.Box3().setFromObject(nodes['paw-'+name]);assert(bounds.min.y>=-.001,'Paw penetrates ground '+variation+' '+motion+' '+bounds.min.y);
    const normal=new THREE.Vector3(0,1,0).transformDirection(nodes['paw-'+name].matrixWorld);assert(normal.y>.999,'Paw is not level');
   }
   const tails=Object.values(nodes).filter(n=>n.name.startsWith('tail-'));
   for(let j=1;j<tails.length;j++)assert(Math.abs(tails[j].getWorldPosition(new THREE.Vector3()).distanceTo(tails[j-1].getWorldPosition(new THREE.Vector3()))-.325*spec.rat!.tailLength/tails.length)<1e-6,'Tail segment disconnected');
   const tailBounds=new THREE.Box3().setFromObject(nodes['tail-0']);assert(tailBounds.min.y>=-.001,'Tail penetrates ground '+variation+' '+motion+' '+tailBounds.min.y);
  }
 }
 for(const motion of ['move'] as const){
  const period=2*Math.PI/9;
  for(const [name,offset] of [['frontL',0],['frontR',.5],['hindL',.5],['hindR',0]] as const){
   const sample=(phase:number)=>{animate((phase+offset)*period,motion);body.updateMatrixWorld(true);return nodes['paw-'+name].getWorldPosition(new THREE.Vector3());};
   const a=sample(.12),b=sample(.38),c=sample(.62),d=sample(.88);
   assert(b.z>a.z+.008,'Backward swing '+name);assert(d.z<c.z-.008,'Forward stance '+name);assert(a.y>c.y+.003,'Missing lift '+name);
  }
 }
 // Observe a complete run cycle: alternating pair contacts, true suspension,
 // planted feet with nominal host translation, and continuous loop endpoints.
 for(const runMotion of ['run','runPlus'] as const){
 const plus=runMotion==='runPlus',period=plus?RAT_RUN_PLUS_PERIOD:RAT_RUN_PERIOD,speed=plus?RAT_RUN_PLUS_SPEED:RAT_RUN_SPEED;
 const feet=['frontL','frontR','hindL','hindR'];
 const sampleRun=(p:number)=>{animate(p*period,runMotion);body.updateMatrixWorld(true);return feet.map(name=>nodes['paw-'+name].getWorldPosition(new THREE.Vector3()));};
 const rearSupport=sampleRun(.14),foreSupport=sampleRun(.64),air=sampleRun(.40);
 const expectedY=(i:number)=>.016*spec.rat!.pawSize*(i>=2?1.08:1);
 for(let i=0;i<4;i++){
  const support=i>=2?rearSupport:foreSupport,other=i>=2?foreSupport:rearSupport;
  assert(Math.abs(support[i].y-expectedY(i))<1e-5,'Run contact lost '+feet[i]);
  assert(other[i].y>support[i].y+.010*spec.rat!.legLength,'Pairs do not alternate '+feet[i]);
  assert(air[i].y>expectedY(i)+.003*spec.rat!.legLength,'No all-feet suspension '+feet[i]);
  const phase=i>=2?.10:.60,a=sampleRun(phase)[i],b=sampleRun(phase+.03)[i];
  const worldAdvance=speed*spec.rat!.legLength*.03*period;
  assert(Math.abs(b.z+worldAdvance-a.z)<1e-5,'Contact slides '+feet[i]);
 }
 const start=sampleRun(0),loopMatrices=Object.values(nodes).map(n=>n.matrixWorld.clone()),end=sampleRun(1);
 Object.values(nodes).forEach((n,j)=>assert(n.matrixWorld.elements.every((v,k)=>Math.abs(v-loopMatrices[j].elements[k])<1e-6),'Whole rig loop jumps'));
 for(let i=0;i<4;i++)assert(start[i].distanceTo(end[i])<1e-6,'Run loop jumps');
 animate(.4*period,runMotion);const high=body.position.y;animate(.64*period,runMotion);assert(high>body.position.y+(plus?.008:.002)*spec.rat!.legLength,'Missing gentle body leap');
 const pose=(p:number)=>{animate(p*period,runMotion);return [body.position.y,nodes.torso.rotation.x,...feet.flatMap(name=>[nodes[name].rotation.x,nodes['knee-'+name].rotation.x,nodes['paw-'+name].rotation.x])];};
 for(const boundary of [0,.025,.28,.305,.50,.525,.78,.805,.28+.72*.12,.28+.72*.88]){
  const h=1e-5,a=pose(boundary-h),b=pose(boundary),c=pose(boundary+h);
  for(let j=0;j<a.length;j++){
   assert(Math.abs(c[j]-a[j])<.001,'Pose discontinuity at support/swing boundary');
   assert(Math.abs((c[j]-b[j])/h-(b[j]-a[j])/h)<.02,'Velocity kink at support/swing boundary');
  }
 }
 let minY=Infinity,maxY=-Infinity,maxPitch=0;
 for(let j=0;j<240;j++){animate(j/240*period,runMotion);minY=Math.min(minY,body.position.y);maxY=Math.max(maxY,body.position.y);maxPitch=Math.max(maxPitch,Math.abs(nodes.torso.rotation.x));}
 assert(maxY-minY<=(plus?.01801:.00601)*spec.rat!.legLength&&maxPitch<=(plus?.04001:.02501),'Excess body oscillation');
 for(const scale of [.5,1.8]){
  body.scale.setScalar(scale);
  for(let j=0;j<=120;j++){
   animate(j/120*period,runMotion);body.updateMatrixWorld(true);
   for(const name of feet)assert(new THREE.Box3().setFromObject(nodes['paw-'+name]).min.y>=-.001,'Scaled run penetrates floor '+scale+' '+name);
  }
  const a=sampleRun(.1)[2],b=sampleRun(.13)[2];
  assert(Math.abs(b.z+speed*spec.rat!.legLength*scale*.03*period-a.z)<1e-5,'Scaled contact slides');
 }
 body.scale.setScalar(1);
 }
 animate(0,'idle');animate(0,'attack');animate(.16,'attack');assert(nodes.jaw.rotation.x>.40,'Missing open bite');animate(.30,'attack');assert(body.position.z>.015,'Missing lunge');animate(.75,'attack');assert(body.position.z===0&&nodes.jaw.rotation.x===0,'Attack does not recover');
 animate(.80,'idle');animate(1,'attack');animate(1.16,'attack');assert(nodes.jaw.rotation.x>.40,'Second bite does not trigger');
 [...geometries].forEach((g,j)=>assert(Array.from(g.getAttribute('position').array).every((v,i)=>v===original[j][i]),'Animation rewrites static geometry'));
 console.log({detail,variation,meshes,triangles,materials:materials.size});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
}
console.log('Nine species presets/random recipes, rat validation, mirrored paws, rigid geometry, fixed limb/tail lengths, level feet, ground clearance, forward walking, alternating gallop contacts, all-feet suspension, planted run feet, continuous run cycle, body leap, CORRER+ faster/higher gait and one-shot bite/recovery verified.');
const sha=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
const manifest=JSON.parse(readFileSync('extras/ratos-abrigo-v4/manifest.json','utf8'));
for(const [path,expected] of Object.entries(manifest.files) as Array<[string,{bytes:number;sha256:string}]>){
 const bytes=readFileSync('extras/ratos-abrigo-v4/'+path);strictAssert.equal(bytes.length,expected.bytes);strictAssert.equal(sha(bytes),expected.sha256);
}
strictAssert.equal(sha(readFileSync('src/rat-detail.ts')),manifest.files['rat-detail.ts'].sha256,'Production generator must remain byte-identical');
for(const color of ['marrom','cinza','preto']){
 const recipe=JSON.parse(readFileSync('extras/ratos-abrigo-v4/rato-'+color+'.criatura.json','utf8'));
 strictAssert.deepEqual(validateCreatureSpec(recipe),recipe);
 for(const detail of ['low','high'] as const){
  const model=createCreature(recipe,{detail});
  strictAssert.equal(model.stats.triangles,detail==='high'?2586:1652);
  strictAssert.equal(model.stats.meshes,detail==='high'?37:33);
  const origin=model.root.position.clone(),rotation=model.root.quaternion.clone();
  model.update(0,'idle');const rest=new THREE.Box3().setFromObject(model.root);
  for(const motion of ['move','run','runPlus','attack'] as const){model.update(0,'idle');model.update(0,motion);model.update(.3,motion);strictAssert(model.root.position.equals(origin)&&model.root.quaternion.equals(rotation));}
  model.update(0,'idle');strictAssert(new THREE.Box3().setFromObject(model.root).equals(rest));
  model.dispose();model.dispose();
 }
}
const fallback=presetCreature('rat');delete fallback.rat;fallback.anatomy.length=1.2;
strictAssert.equal(validateCreatureSpec(fallback).rat!.bodyLength,1.2);
strictAssert.deepEqual(presetCreature('rat'),JSON.parse(readFileSync('extras/ratos-abrigo-v4/rato-marrom.criatura.json','utf8')));
console.log('Rat integration: intact package hashes, three original recipes, dispatcher, HD/low budgets, root preserved and anatomy fallback passed.');

