// Development-only inspection sheet: several fixed cameras over one character.
// Query: ?top=tank&bust=0.8&backpack=0 also override the preset.
// Query: ?hair=bob&hat=none&beard=none&hairColor=%23b19a68 override the preset.
// Query: ?jaw=1 shows the underside of the jaw from the side and from behind.
// Query: ?legs=1 shows the hips from behind and the right ankle close-up.
// Query: ?expr=happy&k=1 sets a facial expression (neutral, happy, angry, sad, tired, surprised).
// Query: ?face=strong applies a face type; ?faceShape=&chin=&brows=&nose=&mouth=&cheeks= override features.
// Query: ?palm=1 zooms the hand close-up and turns it to the outside.
// Query: ?headback=1 swaps the hand close-up for the crown; ?chest=1 swaps the face close-ups for the torso (&close=1 zooms in); ?feet=1 for the feet (&top=1 looks down on them).
// Query: ?preset=ranger|mechanic|medic|civilian  &seed=text  &detail=low|high  &motion=idle|walk|run|pose  &t=seconds  &wire=1
import * as THREE from 'three';
import {createCharacter} from '../src/character';
import {presetCharacter,randomCharacter,applyFaceType} from '../src/schema';
import type {Detail} from '../src/character';

const q=new URLSearchParams(location.search);
const spec=q.get('seed')?randomCharacter(q.get('seed')!):presetCharacter(q.get('preset')||'ranger');
for(const k of ['hair','beard','hairColor','faceShape','chin','brows','nose','mouth','skin'] as const)if(q.get(k))(spec.appearance as any)[k]=q.get(k);
if(q.get('hat'))spec.outfit.hat=q.get('hat')!;
if(q.get('top'))spec.outfit.top=q.get('top')!;
if(q.get('shoes'))spec.outfit.shoes=q.get('shoes')!;
if(q.get('backpack'))spec.outfit.backpack=q.get('backpack')==='1';
if(q.get('bust'))spec.body.bust=Number(q.get('bust'));
if(q.get('face'))applyFaceType(spec,q.get('face')!);
if(q.get('cheeks'))spec.appearance.cheeks=Number(q.get('cheeks'));
if(q.get('chinSize'))spec.appearance.chinSize=Number(q.get('chinSize'));
if(q.get('chin'))spec.appearance.chin=q.get('chin')!;
// fine=eyeSize:1,noseTip:-.5 — advanced face offsets.
if(q.get('fine'))spec.appearance.fine=Object.fromEntries(q.get('fine')!.split(',').map(p=>{const [k,v]=p.split(':');return [k,Number(v)];}));
if(q.get('faceShape'))spec.appearance.faceShape=q.get('faceShape')!;
if(q.get('nose'))spec.appearance.nose=q.get('nose')!;
const detail=(q.get('detail')||'high') as Detail;
const W=1600,H=900;
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setSize(W,H);renderer.setScissorTest(true);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.3;renderer.outputColorSpace=THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#27302c');
scene.add(new THREE.HemisphereLight('#eef1da','#3c494b',2.1));
const key=new THREE.DirectionalLight('#fff0d8',3);key.position.set(-3,5,4);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.normalBias=.025;scene.add(key);
const fill=new THREE.DirectionalLight('#a6c8cc',1.7);fill.position.set(3,3,-4);scene.add(fill);
const model=createCharacter(spec,{detail});scene.add(model.root);
if(q.get('expr'))model.setExpression(q.get('expr') as any,Number(q.get('k')||1),true);
model.update(Number(q.get('t')||0),(q.get('motion')||'idle') as any);
// paint=knee,thigh: colour meshes whose name starts with each prefix (red, blue, yellow...) to find a part.
if(q.get('paint')){const cols=['#ff2020','#2060ff','#ffe020','#20ff60'];q.get('paint')!.split(',').forEach((pre,i)=>model.root.traverse((o:any)=>{if(o.isMesh&&o.name.startsWith(pre)){o.material=new THREE.MeshBasicMaterial({color:cols[i%4]});}}));}
if(q.get('wire'))model.root.traverse((o:any)=>{if(o.isMesh){o.material=o.material.clone();o.material.wireframe=true;}});
model.root.updateMatrixWorld(true);
const world=(name:string)=>model.nodes[name].getWorldPosition(new THREE.Vector3());
const chestP=world('spine').add(new THREE.Vector3(0,.36,0)),headP=world('head').add(new THREE.Vector3(0,.13,0)),handP=world('handR').add(new THREE.Vector3(0,-.06,0)),footP=world('footR').add(new THREE.Vector3(.1,-.03,.06));
// [x,y,w,h] in pixels, camera direction, target, half-height of view
const views:[number[],number[],THREE.Vector3,number][]=[
 [[0,0,320,560],[0,0,1],new THREE.Vector3(0,.95,0),1.05],
 [[320,0,320,560],[1,.6,1.2],new THREE.Vector3(0,.95,0),1.05],
 [[640,0,320,560],[1,0,0],new THREE.Vector3(0,.95,0),1.05],
 [[960,0,320,560],[0,0,-1],new THREE.Vector3(0,.95,0),1.05],
 [[1280,0,320,560],[.8,.72,1],new THREE.Vector3(0,.95,0),1.05],
 ...(q.get('jaw')?[
  [[0,560,420,340],[1,-.05,-.15],world('head').add(new THREE.Vector3(0,.04,0)),.12],
  [[420,560,420,340],[-.8,-.15,-1],world('head').add(new THREE.Vector3(0,.04,0)),.12],
 ]:q.get('legs')?[
  [[0,560,420,340],[-.7,.35,-1],world('hips').add(new THREE.Vector3(0,-.12,0)),.3],
  [[420,560,420,340],[-.8,.3,-.6],world('footR').add(new THREE.Vector3(0,.05,0)),.16],
 ]:q.get('feet')?[
  [[0,560,420,340],[1,.35,.6],footP,.14],
  q.get('top')?[[420,560,420,340],[.05,1,.35],footP.clone().add(new THREE.Vector3(-.1,0,0)),.16]:[[420,560,420,340],[-.6,.3,-1],footP,.14],
 ]:q.get('chest')?[
  [[0,560,420,340],[-.55,.25,1],chestP,q.get('close')?.16:.3],
  [[420,560,420,340],[1,.35,-.8],chestP,.3],
 ]:[
  [[0,560,420,340],[0,0,1],headP,.2],
  [[420,560,420,340],[1,.1,.55],headP,.2],
 ]) as [number[],number[],THREE.Vector3,number][],
 q.get('headback')?[[840,560,380,340],[-.3,.9,-1],headP,.17]:[[840,560,380,340],q.get('palm')?[-1,.1,.25]:[-.35,.2,1],handP,q.get('palm')?.08:.13],
 [[1220,560,380,340],[.9,.5,.9],footP,.17],
];
// portrait=1: two large face views (front and three-quarter), for comparing faces with a reference.
// eye=1: a single eye up close, to check lids, lashes and liner.
// hips=1: the hips and thighs from behind and from the side, for the leg-to-pelvis blend.
if(q.get('hips'))views.splice(0,views.length,[[0,0,800,900],[-.25,.15,-1],world('hips').add(new THREE.Vector3(0,-.08,0)),.28],[[800,0,800,900],[1,.1,.15],world('hips').add(new THREE.Vector3(0,-.08,0)),.28]);
if(q.get('eye'))views.splice(0,views.length,[[0,0,800,900],[0,.05,1],world('eyeR'),.03],[[800,0,800,900],[-.8,.1,1],world('eyeR'),.03]);
if(q.get('portrait'))views.splice(0,views.length,[[0,0,800,900],[0,.05,1],headP.clone().add(new THREE.Vector3(0,-.02,0)),.19],[[800,0,800,900],[.75,.1,1],headP.clone().add(new THREE.Vector3(0,-.02,0)),.19]);
const cam=new THREE.OrthographicCamera(-1,1,1,-1,.01,50);
for(const [[x,y,w,h],dir,target,half] of views){
 cam.left=-half*w/h;cam.right=half*w/h;cam.top=half;cam.bottom=-half;cam.updateProjectionMatrix();
 cam.position.copy(target).add(new THREE.Vector3(...dir as [number,number,number]).normalize().multiplyScalar(8));cam.lookAt(target);
 renderer.setViewport(x,H-y-h,w,h);renderer.setScissor(x,H-y-h,w,h);renderer.render(scene,cam);
}
document.getElementById('info')!.textContent=`${spec.name} · ${detail} · ${Math.round(model.stats.triangles).toLocaleString('pt-BR')} triângulos · ${model.stats.meshes} peças`;
document.title='ready';
