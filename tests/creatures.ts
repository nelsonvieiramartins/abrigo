import './skeleton';
import './rat';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {createCreature} from '../src/creature';
import {wolfGait} from '../src/wolf-gait';
import {CREATURE_SPECIES,CREATURE_FIELDS,presetCreature,randomCreature,validateCreatureSpec,type CreatureSpecies} from '../src/creature-schema';
const maxima={low:0,high:0};let count=0;
for(const species of Object.keys(CREATURE_SPECIES) as CreatureSpecies[]){
  assert.deepEqual(randomCreature('forest',species),randomCreature('forest',species));
  assert.notDeepEqual(randomCreature('forest',species),randomCreature('other',species));
  const samples=[presetCreature(species),...Array.from({length:5},(_,i)=>randomCreature(String(i),species))];
  for(const edge of ['min','max'] as const){const s=presetCreature(species);for(const f of CREATURE_FIELDS[species])s.anatomy[f.key]=f[edge];if(s.rat){s.rat.bodyLength=s.anatomy.length;s.rat.bodyWidth=s.anatomy.spread;s.rat.legLength=s.anatomy.legs;s.rat.earSize=s.anatomy.ears;s.rat.tailLength=s.anatomy.tail;s.rat.tailThickness=s.anatomy.thickness;}if(s.spider){s.spider.legLength=s.anatomy.legs;s.spider.legSpread=s.anatomy.spread;s.spider.legThickness=s.anatomy.thickness;}if(s.scorpion){s.scorpion.legLength=s.anatomy.legs;s.scorpion.legSpread=s.anatomy.spread;s.scorpion.legThickness=s.anatomy.thickness;s.scorpion.tailLength=s.anatomy.tail;}s.body.scale=edge==='min'?.5:1.8;s.body.bulk=edge==='min'?0:1;samples.push(s);}
  for(const s of samples){assert.deepEqual(validateCreatureSpec(JSON.parse(JSON.stringify(s))),s);
    for(const detail of ['low','high'] as const){const c=createCreature(s,{detail});count++;assert(c.sockets.target);assert.equal(c.detail,detail);
      maxima[detail]=Math.max(maxima[detail],c.stats.triangles);assert(c.stats.triangles<65000);
      const scene=new THREE.Scene();scene.add(c.root);const position=c.root.position.clone(),rotation=c.root.quaternion.clone();
      if(species!=='rat')assert.throws(()=>c.update(0,'runPlus'),/Correr\+/);
      if(species!=='skeleton')assert.throws(()=>c.update(0,'sprint'),/Correr\+/);
      for(const motion of (species==='rat'?['idle','move','run','runPlus','attack'] as const:species==='skeleton'?['idle','move','run','sprint','attack'] as const:['wolf','werewolf','spider','scorpion'].includes(species)?['idle','move','run','attack'] as const:['idle','move','attack'] as const))for(const t of [0,.17,.7,1.8,20]){c.update(t,motion);c.root.updateMatrixWorld(true);
        c.root.traverse((o:any)=>{for(const v of o.matrixWorld.elements)assert(Number.isFinite(v));if(o.isMesh)for(const key of ['position','normal'])for(const v of o.geometry.attributes[key].array)assert(Number.isFinite(v),species+' '+key);});
        assert(c.root.position.equals(position));assert(c.root.quaternion.equals(rotation));
        const box=new THREE.Box3().setFromObject(c.root);assert(!box.isEmpty());assert(box.min.y>-.07*s.body.scale,`${species} intersects floor: ${box.min.y}`);
      }
      const resources=new Set<THREE.BufferGeometry|THREE.Material>();c.root.traverse((o:any)=>{if(o.isMesh){resources.add(o.geometry);resources.add(o.material);}});let released=0;resources.forEach(r=>r.addEventListener('dispose',()=>released++));c.dispose();c.dispose();assert.equal(released,resources.size);assert.equal(c.root.parent,null);
    }
  }
}
for(const raw of [null,{}, {kind:'creature',schemaVersion:2}, {...presetCreature('wolf'),species:'__proto__'}, {...presetCreature('wolf'),body:{scale:NaN,bulk:.5}}, {...presetCreature('swarm'),anatomy:{count:500,spread:1}}, {...presetCreature('snake'),appearance:{primary:'red'}}])assert.throws(()=>validateCreatureSpec(raw));
const a=createCreature(randomCreature('same','swarm')),b=createCreature(randomCreature('same','swarm'));
// Geometry remains identical to the supplied generator; only the requested attack changes.
assert.equal(readFileSync('src/spider-detail.ts','utf8').split('  const up=')[0],readFileSync('extras/aranha-abrigo-v1/spider-detail.ts','utf8').split('  const up=')[0]);
const reference=validateCreatureSpec(JSON.parse(readFileSync('extras/aranha-abrigo-v1/aranha-da-mata.criatura.json','utf8')));
assert.deepEqual(presetCreature('spider'),reference);
for(const detail of ['low','high'] as const){
 const spider=createCreature(reference,{detail});assert.equal(spider.stats.triangles,detail==='low'?1224:1704);
 for(const side of ['L','R'])for(let i=1;i<=4;i++)for(const suffix of ['','Femur','Tibia','Knee'])assert(spider.nodes['leg'+side+i+suffix]);
 for(const socket of ['head','mouth','back','target'])assert(spider.sockets[socket]);
 const rest=new THREE.Box3().setFromObject(spider.root);
 const foot=(side:string,index:number)=>{const mesh=spider.nodes['leg'+side+index+'Tibia'] as THREE.Mesh;mesh.geometry.computeBoundingBox();return mesh.localToWorld(new THREE.Vector3(0,mesh.geometry.boundingBox!.max.y,0));};
 const lengths=['L','R'].flatMap(side=>[1,2,3,4].map(index=>foot(side,index).distanceTo(spider.nodes['leg'+side+index+'Tibia'].getWorldPosition(new THREE.Vector3()))));
 const restingFangs=['L','R'].map(side=>spider.nodes['fang'+side].localToWorld(new THREE.Vector3(side==='L'?.018:-.018,-.18,.13)));
 spider.update(10,'attack');spider.update(10.34,'attack');spider.root.updateMatrixWorld(true);
 for(const [i,side] of ['L','R'].entries()){
  assert(foot(side,1).y>.3,'front leg rises during attack');assert(foot(side,1).z>1.15,'front leg projects forward');
  assert(foot(side,2).y>.15,'second pair participates in attack');
  for(let j=3;j<=4;j++)assert(Math.abs(foot(side,j).y-.009)<1e-5,'rear support feet remain planted');
  const tip=spider.nodes['fang'+side].localToWorld(new THREE.Vector3(side==='L'?.018:-.018,-.18,.13));assert(tip.z>restingFangs[i].z+.2,'both fangs project forward');
 }
 assert(spider.nodes.body.position.y>.05);assert(spider.nodes.body.rotation.x<-.05);
 const attackLengths=['L','R'].flatMap(side=>[1,2,3,4].map(index=>foot(side,index).distanceTo(spider.nodes['leg'+side+index+'Tibia'].getWorldPosition(new THREE.Vector3()))));
 attackLengths.forEach((length,i)=>assert(Math.abs(length-lengths[i])<1e-8,'leg segments do not stretch'));
 spider.update(10.95,'attack');assert(new THREE.Box3().setFromObject(spider.root).equals(rest),'single attack returns to rest');
 spider.update(0,'idle');spider.update(20,'attack');spider.update(20.34,'attack');assert(foot('L',1).z>1.15,'attack can restart');
 for(const motion of ['idle','move','run','attack'] as const)for(let i=0;i<120;i++){spider.update(i/30,motion);spider.root.updateMatrixWorld(true);spider.root.traverse(o=>assert(o.matrixWorld.elements.every(Number.isFinite)));}
 spider.update(0,'idle');assert(new THREE.Box3().setFromObject(spider.root).equals(rest));spider.dispose();
}
const basic=JSON.parse(JSON.stringify(reference));delete basic.spider;basic.anatomy.legs=1.2;assert.equal(validateCreatureSpec(basic).spider!.legLength,1.2);
const override=JSON.parse(JSON.stringify(reference));override.spider.legLength=1.3;assert.equal(validateCreatureSpec(override).anatomy.legs,1.3,'override is synchronized for UI and JSON');
for(const key of Object.keys(reference.spider!)){const bad=JSON.parse(JSON.stringify(reference));bad.spider[key]=1.4;assert.throws(()=>validateCreatureSpec(bad));}
console.log('Spider: original geometry, v2 single attack with forward legs and fangs, planted rear support, fixed segment lengths, restart and idle reset passed.');
// Skeleton source and reference are preserved in the fully integrated dispatcher.
// Preserve original skeleton geometry; only the requested sprint animation is added.
assert.equal(readFileSync('src/skeleton-detail.ts','utf8').split(' const rest=')[0],readFileSync('extras/esqueleto-abrigo-v4/skeleton-detail.ts','utf8').split(' const rest=')[0]);
const skeletonReference=validateCreatureSpec(JSON.parse(readFileSync('extras/esqueleto-abrigo-v4/esqueleto-referencia.criatura.json','utf8')));
assert.deepEqual(presetCreature('skeleton'),skeletonReference);
for(const detail of ['low','high'] as const){
 const skeleton=createCreature(skeletonReference,{detail});
 assert.equal(skeleton.stats.triangles,detail==='low'?5549:7945);assert.equal(skeleton.stats.meshes,21);
 skeleton.dispose();
}
// Scorpion: original geometry, forward claw thrust and single-shot tail attack.
assert.equal(readFileSync('src/scorpion-detail.ts','utf8').split(' let previousMotion:')[0],readFileSync('extras/escorpiao-abrigo-v1/scorpion-detail.ts','utf8').split(' let previousMotion:')[0]);
const scorpionReference=validateCreatureSpec(JSON.parse(readFileSync('extras/escorpiao-abrigo-v1/escorpiao-da-mata.criatura.json','utf8')));
assert.deepEqual(presetCreature('scorpion'),scorpionReference);
for(const detail of ['low','high'] as const){
 const scorpion=createCreature(scorpionReference,{detail});assert.equal(scorpion.stats.triangles,detail==='low'?1872:4208);
 for(const side of ['L','R']){
  for(let i=1;i<=4;i++)for(const suffix of ['','Femur','Tibia','Knee'])assert(scorpion.nodes['leg'+side+i+suffix]);
  for(const name of ['clawArm','claw','clawOuter','clawInner'])assert(scorpion.nodes[name+side]);
 }
 for(let i=0;i<5;i++)assert(scorpion.nodes['tail'+i]);
 for(const name of ['head','mouth','back','target','stinger'])assert(scorpion.sockets[name]);
 const rest=new THREE.Box3().setFromObject(scorpion.root),tip=scorpion.sockets.stinger.getWorldPosition(new THREE.Vector3());
 const palms=['L','R'].map(side=>scorpion.nodes['claw'+side].getWorldPosition(new THREE.Vector3()));
 const anchors=['L','R'].map(side=>scorpion.nodes['clawArm'+side].position.clone());
 scorpion.update(10,'attack');scorpion.update(10.43,'attack');
 const strike=scorpion.sockets.stinger.getWorldPosition(new THREE.Vector3());assert(strike.z>tip.z+.25,'stinger strikes forward');
 for(const [i,side] of ['L','R'].entries()){
  const palm=scorpion.nodes['claw'+side].getWorldPosition(new THREE.Vector3());
  assert(palm.z>palms[i].z+.15,'both claws thrust forward');
  assert(Math.abs(palm.x)>.2,'claws do not cross');
  assert(scorpion.nodes['clawArm'+side].position.equals(anchors[i]),'arm stays attached');
 }
 scorpion.update(11.1,'attack');assert(scorpion.sockets.stinger.getWorldPosition(new THREE.Vector3()).distanceTo(tip)<1e-8,'tail returns');
 for(const [i,side] of ['L','R'].entries())assert(scorpion.nodes['claw'+side].getWorldPosition(new THREE.Vector3()).distanceTo(palms[i])<1e-8,'claws return after attack');
 scorpion.update(0,'idle');scorpion.update(20,'attack');scorpion.update(20.43,'attack');assert(scorpion.sockets.stinger.getWorldPosition(new THREE.Vector3()).distanceTo(strike)<1e-8,'new attack restarts');
 for(const motion of ['idle','move','run','attack'] as const)for(let i=0;i<120;i++){scorpion.update(i/30,motion);scorpion.root.updateMatrixWorld(true);scorpion.root.traverse(o=>assert(o.matrixWorld.elements.every(Number.isFinite)));}
 scorpion.update(0,'idle');assert(new THREE.Box3().setFromObject(scorpion.root).equals(rest));scorpion.dispose();
}
const scorpionBasic=JSON.parse(JSON.stringify(scorpionReference));delete scorpionBasic.scorpion;scorpionBasic.anatomy.tail=1.2;assert.equal(validateCreatureSpec(scorpionBasic).scorpion!.tailLength,1.2);
for(const key of Object.keys(scorpionReference.scorpion!)){const bad=JSON.parse(JSON.stringify(scorpionReference));bad.scorpion[key]=1.4;assert.throws(()=>validateCreatureSpec(bad));}
console.log('Scorpion: original geometry, forward claws, fixed attachments, exact recipe/triangles, tail strike/restart/reset and validation passed.');
// Biped werewolf: reference features, independent limb pivots and a resettable pose.
const werewolf=createCreature(presetCreature('werewolf'));
const werewolfLow=createCreature(presetCreature('werewolf'),{detail:'low'});
assert(werewolf.stats.triangles>werewolfLow.stats.triangles*3,'rounded presentation has enough curved surface detail');
const roundedSkull=werewolf.root.getObjectByName('wolf-skull') as THREE.Mesh;
assert.equal(roundedSkull.geometry.type,'SphereGeometry');
assert.equal((roundedSkull.material as THREE.MeshStandardMaterial).flatShading,false);
assert.equal(((werewolfLow.root.getObjectByName('wolf-skull') as THREE.Mesh).material as THREE.MeshStandardMaterial).flatShading,true);
assert((werewolf.root.getObjectByName('muscular-torso') as THREE.Mesh).geometry.getAttribute('position').count>400,'torso shares refined character profiles');
assert(werewolf.root.getObjectByName('ear-root'),'ears have embedded roots');
assert(Math.abs(werewolf.nodes.earL.position.x)<.17,'ears sit on the crown rather than outside it');
assert(!werewolf.root.getObjectByName('cheek-ruff'),'no detached oval cheeks');
assert(roundedSkull.userData.integratedCheeks,'cheeks are sculpted into the skull');
for(const model of [werewolf,werewolfLow]){
 const skull=model.root.getObjectByName('wolf-skull') as THREE.Mesh,positions=skull.geometry.getAttribute('position');
 let lowerWidth=0,templeWidth=0;
 for(let i=0;i<positions.count;i++){const y=positions.getY(i),x=Math.abs(positions.getX(i));if(y<-.12)lowerWidth=Math.max(lowerWidth,x);if(Math.abs(y)<.07)templeWidth=Math.max(templeWidth,x);}
 assert(lowerWidth<templeWidth*.9,'cheek contour tapers naturally into the jaw at both detail levels');
}
werewolf.root.traverse(o=>{if(o.name==='hand-claw'||o.name==='thumb-claw')assert(o.position.z<0,'hand claws curl downward toward the palm');});
const shorts=werewolf.root.getObjectByName('torn-shorts') as THREE.Mesh;
const deltoid=werewolf.root.getObjectByName('deltoid') as THREE.Mesh;deltoid.geometry.computeBoundingBox();assert(deltoid.geometry.boundingBox!.getSize(new THREE.Vector3()).x<.39,'shoulders have slimmer muscles');
shorts.geometry.computeBoundingBox();assert(shorts.geometry.boundingBox!.max.y>.04,'shorts upper ring overlaps pelvis above the hip pivot');
assert(!werewolf.root.getObjectByName('abdominal-muscle'),'abdomen no longer uses detached inflated muscle volumes');
for(const model of [werewolf,werewolfLow]){
 for(const name of ['rib-muscle','biceps','forearm-muscle','upper-arm'])assert(!model.root.getObjectByName(name),'no separate muscle balloons: '+name);
 for(const name of ['deltoid','forearm','pelvis']){
  const surface=model.root.getObjectByName(name) as THREE.Mesh;
  assert.equal(surface.geometry.type,'BufferGeometry','organic profile surface: '+name);
  const positions=surface.geometry.getAttribute('position');
  assert(positions.count>40,'continuous ring profile: '+name);
 }
}
assert.equal(shorts.parent,werewolf.nodes.hips,'garment anchors at the waist');
werewolf.update(0,'idle');const shortsRest=Array.from(shorts.geometry.getAttribute('position').array);
werewolf.update(.37,'move');const shortsMove=Array.from(shorts.geometry.getAttribute('position').array);
assert.deepEqual(shortsMove.slice(0,3),shortsRest.slice(0,3),'top ring stays attached to hips');
assert.notDeepEqual(shortsMove,shortsRest,'lower fabric follows the moving thighs');
werewolf.update(0,'idle');assert.deepEqual(Array.from(shorts.geometry.getAttribute('position').array),shortsRest,'cloth deformation resets deterministically');
werewolfLow.dispose();
const werewolfParts:string[]=[];werewolf.root.traverse(o=>{if(o instanceof THREE.Mesh)werewolfParts.push(o.name);});
assert.equal(werewolfParts.filter(n=>n==='hand-claw').length,8);
assert.equal(werewolfParts.filter(n=>n==='thumb-claw').length,2);
assert.equal(werewolfParts.filter(n=>n==='foot-claw').length,6);
for(const name of ['wolf-skull','upper-muzzle','pointed-ear-shell','ear-inner','amber-eye','torn-shorts','abdominal-patch','digitigrade-calf'])assert(werewolfParts.includes(name),name);
for(const name of ['upperArmR','lowerArmR','handR','upperLegL','lowerLegL','footL'])assert(werewolf.nodes[name],name);
assert(werewolf.sockets.handL&&werewolf.sockets.handR);
werewolf.update(0,'idle');werewolf.root.updateMatrixWorld(true);
const werewolfRest=new THREE.Box3().setFromObject(werewolf.root),restArm=werewolf.nodes.upperArmR.rotation.x;
assert(werewolfRest.max.y>2.7&&werewolfRest.max.y<3.2);
werewolf.update(0,'attack');werewolf.update(.24,'attack');assert(Math.abs(werewolf.nodes.upperArmR.rotation.x-restArm)>.5);
werewolf.update(.37,'run');werewolf.update(0,'idle');assert(new THREE.Box3().setFromObject(werewolf.root).equals(werewolfRest));
console.log('Lobisomem: lupine face, 16 claws, torn shorts, biped rig, walk/run/attack and idle reset passed.');werewolf.dispose();
for(const detail of ['low','high'] as const){
 const w=createCreature(presetCreature('werewolf'),{detail});w.update(0,'idle');w.root.updateMatrixWorld(true);
 const origin=w.root.position.clone(),hip=w.nodes.hips.position.clone(),mouth=w.sockets.mouth.getWorldPosition(new THREE.Vector3());
 const hand=w.sockets.handR.getWorldPosition(new THREE.Vector3());
 w.update(10,'attack');w.update(10.10,'attack');w.root.updateMatrixWorld(true);
 const raisedHands=['R','L'].map(side=>w.sockets['hand'+side].getWorldPosition(new THREE.Vector3()));
 raisedHands.forEach(point=>assert(point.y>w.nodes.head.getWorldPosition(new THREE.Vector3()).y+.15,'both werewolf claws must rise above the head'));
 w.update(10.12,'attack');assert(w.nodes.jaw.rotation.x>.6,'werewolf opens its mouth before the bite');
 w.update(10.22,'attack');w.root.updateMatrixWorld(true);
 assert(w.nodes.hips.position.z>.3,'werewolf body does not lunge');assert(w.sockets.mouth.getWorldPosition(new THREE.Vector3()).z>mouth.z+.3,'werewolf muzzle does not advance');
 assert(w.sockets.handR.getWorldPosition(new THREE.Vector3()).z>hand.z+.5,'werewolf claws do not thrust');
 ['R','L'].forEach((side,i)=>assert(w.sockets['hand'+side].getWorldPosition(new THREE.Vector3()).y<raisedHands[i].y-.7,'werewolf strike must descend from overhead'));
 assert(w.nodes.jaw.rotation.x<.1,'werewolf jaws do not snap closed at impact');
 const strike=w.nodes.hips.position.clone();
 for(let i=0;i<=70;i++){w.update(0,'idle');w.update(0,'attack');w.update(i/100,'attack');w.root.updateMatrixWorld(true);
  assert(new THREE.Box3().setFromObject(w.root).min.y>-.07,'werewolf attack penetrates floor');assert(w.root.position.equals(origin),'werewolf attack moves the host root');
  for(const side of ['L','R'])for(const [parent,child] of [['upperLeg','lowerLeg'],['lowerLeg','foot'],['upperArm','lowerArm'],['lowerArm','hand']]){const a=w.nodes[parent+side],b=w.nodes[child+side];assert(Math.abs(a.getWorldPosition(new THREE.Vector3()).distanceTo(b.getWorldPosition(new THREE.Vector3()))-b.position.length())<1e-8,'werewolf joint stretches');}
 }
 w.update(0,'idle');w.update(20,'attack');w.update(20.22,'attack');assert(w.nodes.hips.position.distanceTo(strike)<1e-8,'werewolf attack does not restart');
 w.update(20.61,'attack');assert(w.nodes.hips.position.distanceTo(hip)<1e-8&&w.nodes.upperArmR.rotation.x===0&&w.nodes.jaw.rotation.x===0,'werewolf attack fails to recover');
 w.update(0,'idle');assert(w.nodes.hips.position.distanceTo(hip)<1e-8,'werewolf lunge persists');w.dispose();
}
console.log('Werewolf attack: both claws raised overhead then striking downward, quick body lunge, snapping bite, fixed limb lengths, floor bounds, unchanged host root, recovery and restart at both detail levels passed.');
a.update(2,'move');b.update(2,'move');assert.deepEqual(a.nodes['insect-3'].position,b.nodes['insect-3'].position);a.dispose();b.dispose();
// HD wolf: richer geometry stays within the character-scale budget and batches static detail.
const wolf=createCreature(presetCreature('wolf')),wolfLow=createCreature(presetCreature('wolf'),{detail:'low'});
assert(wolf.stats.triangles>wolfLow.stats.triangles*8);assert(wolf.stats.triangles<55000);assert(wolf.stats.meshes<=50);
assert.deepEqual(Object.keys(wolf.sockets).sort(),Object.keys(wolfLow.sockets).sort());
const parts:string[]=[];wolf.root.traverse((o:any)=>{if(o.isMesh){parts.push(...(o.userData.parts??[o.name]));for(const v of o.geometry.attributes.color.array)assert(Number.isFinite(v));}});
assert.equal(parts.filter(p=>p.startsWith('toe-')&&!p.startsWith('toe-pad')).length,16);
assert.equal(parts.filter(p=>p.startsWith('claw-')).length,16);
for(const p of ['sculpted-torso-neck','ear-shell','ear-cavity','continuous-tail','iris','catchlight'])assert(parts.includes(p),p);
assert(!parts.includes('cheek-L')&&!parts.includes('cheek-R'),'wolf cheeks are sculpted into the skull rather than separate balls');
for(const joint of ['frontL','frontLKnee','hindL','hindLKnee']){
 const surface=wolf.nodes[joint].children.find(o=>o instanceof THREE.Mesh) as THREE.Mesh;
 assert(surface.geometry.getAttribute('position').count>150,'wolf legs use rounded multi-ring contours');
}
wolf.update(0,'idle');const knee=wolf.nodes.frontLKnee.rotation.x;
wolf.update(.63,'move');assert.notEqual(wolf.nodes.frontLKnee.rotation.x,knee);
let open=Infinity,closed=-Infinity;
for(let i=0;i<800;i++){wolf.update(i/100);open=Math.min(open,wolf.nodes.lidL.scale.y);closed=Math.max(closed,wolf.nodes.lidL.scale.y);}
assert(open<.2&&closed>.8,'HD wolf blinks while idle');
const wolfStats={low:wolfLow.stats,high:wolf.stats};wolf.dispose();wolfLow.dispose();
// Distinct gaits: continuous support at walking speed, two aerial intervals at a gallop.
const gaitWolf=createCreature(presetCreature('wolf')),pawNames=['frontRPaw','frontLPaw','hindRPaw','hindLPaw'];
let flights=0,wasAir=false;
for(let frame=0;frame<200;frame++){
  const phase=frame/200,walk=wolfGait(phase/1.05,'move',.62),run=wolfGait(phase/2.05,'run',.62);
  assert(walk.feet.filter(f=>f.stance).length>=2,'walk always has supporting feet');
  const inAir=run.feet.every(f=>!f.stance);if(inAir&&!wasAir)flights++;wasAir=inAir;
  for(const [motion,time,gait] of [['move',phase/1.05,walk],['run',phase/2.05,run]] as const){
    gaitWolf.update(time,motion);gaitWolf.root.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(gaitWolf.root);assert(box.min.y>-.07,`${motion} penetrates floor at ${phase}`);
    gait.feet.forEach((foot,i)=>{const pos=gaitWolf.nodes[pawNames[i]].getWorldPosition(new THREE.Vector3());if(foot.stance)assert(Math.abs(pos.y-.055)<.035,`${motion} stance paw leaves floor: ${pos.y}`);});
  }
}
assert.equal(flights,2,'gallop has two suspension phases');
gaitWolf.update(0,'idle');const resting=new THREE.Box3().setFromObject(gaitWolf.root);
gaitWolf.update(.39,'run');gaitWolf.update(0,'idle');assert(new THREE.Box3().setFromObject(gaitWolf.root).equals(resting),'idle restores neutral pose after running');gaitWolf.dispose();
console.log('Wolf gaits: four-beat walk, paired gallop, two suspensions, stance height, floor bounds and idle reset passed.');
// Quick wolf attack: rigid forelimbs/body advance, timed bite, recovery and restart.
for(const detail of ['low','high'] as const){
 const model=createCreature(presetCreature('wolf'),{detail});model.update(0,'idle');model.root.updateMatrixWorld(true);
 const body=model.nodes.body,origin=model.root.position.clone(),mouth=model.sockets.mouth.getWorldPosition(new THREE.Vector3());
 const frontNames=detail==='high'?['frontRPaw','frontLPaw']:['frontR','frontL'];
 const restFront=frontNames.map(name=>model.nodes[name].getWorldPosition(new THREE.Vector3()));
 model.update(10,'attack');model.update(10.18,'attack');model.root.updateMatrixWorld(true);
 assert(model.nodes.jaw.rotation.x>.6,'wolf opens mouth before snapping');
 frontNames.forEach((name,i)=>assert(model.nodes[name].getWorldPosition(new THREE.Vector3()).y>restFront[i].y+.08,'both forelegs rise into the attack'));
 model.update(10.26,'attack');model.root.updateMatrixWorld(true);
 assert(body.position.z>.20,'wolf body lunges forward');
 assert(model.sockets.mouth.getWorldPosition(new THREE.Vector3()).z>mouth.z+.15,'muzzle projects into bite');
 assert(model.nodes.jaw.rotation.x<.2,'wolf snaps jaws at impact');
 const strike=body.position.clone();
 for(let i=0;i<=90;i++){model.update(0,'idle');model.update(0,'attack');model.update(i/100,'attack');model.root.updateMatrixWorld(true);assert(new THREE.Box3().setFromObject(model.root).min.y>-.07,'wolf attack penetrates floor');assert(model.root.position.equals(origin),'attack moves host root');
  if(detail==='high')for(const name of ['frontL','frontR','hindL','hindR']){const upper=model.nodes[name],knee=model.nodes[name+'Knee'],ankle=model.nodes[name+'Ankle'];assert(Math.abs(upper.getWorldPosition(new THREE.Vector3()).distanceTo(knee.getWorldPosition(new THREE.Vector3()))-knee.position.length())<1e-8,'upper leg stretches');assert(Math.abs(knee.getWorldPosition(new THREE.Vector3()).distanceTo(ankle.getWorldPosition(new THREE.Vector3()))-ankle.position.length())<1e-8,'lower leg stretches');}
 }
 model.update(0,'idle');model.update(20,'attack');model.update(20.26,'attack');assert(body.position.distanceTo(strike)<1e-8,'wolf attack does not restart');
 model.update(20.73,'attack');assert(body.position.length()<1e-8&&model.nodes.jaw.rotation.x===0,'wolf does not recover after quick attack');
 model.update(0,'idle');assert(body.position.z===0,'lunge persists after idle');model.dispose();
}
console.log('Wolf attack: fast forepaw/body lunge, opening/snapping bite, planted-floor bounds, rigid joints, host root preserved, single attack recovery and restart at both detail levels passed.');
const refinedStats:Record<string,unknown>={};
for(const detail of ['low','high'] as const){
 const snake=createCreature(presetCreature('snake'),{detail});snake.update(0,'idle');snake.root.updateMatrixWorld(true);const origin=snake.root.position.clone(),head=snake.nodes.head.getWorldPosition(new THREE.Vector3());
 snake.update(10,'attack');snake.update(10.07,'attack');snake.root.updateMatrixWorld(true);assert(snake.nodes.head.getWorldPosition(new THREE.Vector3()).z<head.z-.04,'snake must compress before striking');
 if(detail==='high')assert(snake.nodes.jaw.rotation.x>.5,'snake must open mouth before striking');
 snake.update(10.16,'attack');snake.root.updateMatrixWorld(true);assert(snake.nodes.body.position.z>.8&&snake.nodes.body.position.y>.24,'snake must leap forward at impact');assert(snake.nodes.head.getWorldPosition(new THREE.Vector3()).z>head.z+.8,'snake head must reach forward');assert(new THREE.Box3().setFromObject(snake.root).min.y>.1,'snake body must leave floor during the leap');
 const strike=snake.nodes.body.position.clone();
 for(let i=0;i<=65;i++){snake.update(0,'idle');snake.update(0,'attack');snake.update(i/100,'attack');snake.root.updateMatrixWorld(true);assert(snake.root.position.equals(origin),'snake changes host position');assert(new THREE.Box3().setFromObject(snake.root).min.y>-.07,'snake attack penetrates floor');snake.root.traverse(o=>{assert(o.matrixWorld.elements.every(Number.isFinite));if(o instanceof THREE.Mesh)assert(Array.from(o.geometry.attributes.position.array).every(Number.isFinite));});}
 snake.update(0,'idle');snake.update(20,'attack');snake.update(20.16,'attack');assert(snake.nodes.body.position.distanceTo(strike)<1e-8,'snake attack does not restart');snake.update(20.59,'attack');snake.root.updateMatrixWorld(true);const landed=new THREE.Box3().setFromObject(snake.root);assert(snake.nodes.body.position.length()===0,'snake does not land');snake.update(21.5,'attack');snake.root.updateMatrixWorld(true);assert(new THREE.Box3().setFromObject(snake.root).equals(landed),'snake repeats its attack automatically');snake.update(0,'idle');assert(snake.nodes.body.position.length()===0,'snake lunge persists after idle');snake.dispose();
}
console.log('Snake: compressed preparation, airborne forward strike, single bite, landing, no automatic repetition, finite connected mesh and host root preserved in both detail levels passed.');
for(const detail of ['low','high'] as const){
 const bat=createCreature(presetCreature('bat'),{detail});bat.update(0,'idle');bat.root.updateMatrixWorld(true);
 const origin=bat.root.position.clone(),restZ=bat.sockets.target.getWorldPosition(new THREE.Vector3()).z,wing=bat.nodes.wingL,restWing=wing.rotation.z;
 bat.update(10,'attack');bat.update(10.06,'attack');assert(Math.abs(wing.rotation.z-restWing)>.3,'bat wings must beat rapidly during the rush');
 bat.update(10.12,'attack');bat.root.updateMatrixWorld(true);assert(bat.sockets.target.getWorldPosition(new THREE.Vector3()).z>restZ+.8,'bat must rush forwards at impact');assert(bat.nodes.body.rotation.x>.3,'bat must dive into the attack');
 const strike=bat.nodes.body.position.clone();
 for(let i=0;i<=50;i++){bat.update(0,'idle');bat.update(0,'attack');bat.update(i/100,'attack');bat.root.updateMatrixWorld(true);assert(bat.root.position.equals(origin),'bat changes host position');assert(new THREE.Box3().setFromObject(bat.root).min.y>-.07,'bat attack reaches below floor');bat.root.traverse(o=>assert(o.matrixWorld.elements.every(Number.isFinite),'bad bat attack transform'));}
 bat.update(0,'idle');bat.update(20,'attack');bat.update(20.12,'attack');assert(bat.nodes.body.position.distanceTo(strike)<1e-8,'bat attack does not restart');bat.update(20.45,'attack');assert(bat.nodes.body.position.z===0&&bat.nodes.body.rotation.x===0,'bat does not recover from attack');
 bat.update(0,'idle');assert(bat.nodes.body.position.z===0,'bat attack persists during idle');bat.dispose();
}
console.log('Bat attack: fast forward dive, rapid wing beat, fixed host root, floor bounds, recovery and repeat at both detail levels passed.');
for(const species of ['bat','snake','swarm'] as const){
  const high=createCreature(presetCreature(species)),low=createCreature(presetCreature(species),{detail:'low'});
  assert(high.stats.triangles>low.stats.triangles*2);assert(high.stats.meshes<40);
  assert.deepEqual(Object.keys(high.sockets).sort(),Object.keys(low.sockets).sort());
  high.update(0,'idle');const target=high.sockets.mouth??high.sockets.target;const initial=target.getWorldPosition(new THREE.Vector3());
  if(species!=='swarm')high.update(0,'attack');high.update(species==='bat'?.12:species==='snake'?.16:.35,'attack');const after=target.getWorldPosition(new THREE.Vector3());if(species!=='swarm')assert(initial.distanceTo(after)>.01);
  if(species==='bat'){assert(high.nodes.earL&&high.nodes.jaw&&high.nodes.lidL);const wing=high.root.getObjectByName('curved-wing-membrane') as THREE.Mesh;const before=Array.from(wing.geometry.attributes.position.array);high.update(.7,'move');assert.notDeepEqual(Array.from(wing.geometry.attributes.position.array),before);}
  if(species==='snake'){assert(high.nodes.fangL&&high.nodes.jaw&&high.nodes.tongue);const g=(high.root.getObjectByName('scaled-continuous-body') as THREE.Mesh).geometry;assert(g.attributes.position.count>4000);const seam=g.attributes.normal;for(let i=0;i<145;i++){const a=i*33,b=a+32;assert(Math.abs(seam.getX(a)-seam.getX(b))<1e-6);}}
  refinedStats[species]=high.stats;high.dispose();low.dispose();
}
// Instanced and compatibility paths must draw the same recipe and release GPU instance buffers.
const recipe=presetCreature('swarm'),instanced=createCreature(recipe),fallback=createCreature(recipe,{instancing:false});
assert.equal(instanced.stats.meshes,3);assert.equal(fallback.stats.meshes,recipe.anatomy.count*3);assert.equal(instanced.stats.triangles,fallback.stats.triangles);
const bodies=instanced.root.getObjectByName('insect-bodies') as THREE.InstancedMesh,instanceMatrix=new THREE.Matrix4();let releasedInstances=0;
instanced.root.traverse(o=>{if(o instanceof THREE.InstancedMesh)o.addEventListener('dispose',()=>releasedInstances++);});
for(const t of [0,.3,2]){instanced.update(t,'move');fallback.update(t,'move');bodies.getMatrixAt(3,instanceMatrix);const expected=fallback.nodes['insect-3'].matrix;for(let i=0;i<16;i++)assert(Math.abs(instanceMatrix.elements[i]-expected.elements[i])<1e-6);}
instanced.dispose();instanced.dispose();fallback.dispose();assert.equal(releasedInstances,3);
console.log(JSON.stringify({refinedAnimals:refinedStats,checks:['same sockets at both detail levels','moving membranes, jaws, fangs and seamless snake normals','three instanced swarm meshes match the compatibility path','instance GPU buffers disposed once']},null,2));
console.log(JSON.stringify({wolfDetail:wolfStats,checks:['16 toes and claws, sculpted ears and continuous torso/neck','same sockets, articulated knees and blinking lids','batched draw budget below 50 meshes and 55k triangles']},null,2));
console.log(JSON.stringify({creatures:count,maxTriangles:maxima,checks:['nine species, two detail levels, extreme anatomy','seed determinism and JSON validation','finite geometry and animated transforms','floor bounds and external root transform preserved','all owned resources disposed exactly once']},null,2));
