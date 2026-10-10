import assert from 'node:assert/strict';
import * as THREE from 'three';
import {fitGameCameraDepth} from '../src/game-camera';
import {fitGameShadows} from '../src/game-shadows';
import {defaultEnvironment,validateEnvironment} from '../src/environment-data';
import {createGameEnvironment} from '../src/game-environment';
import {scatterVegetation,validateVegetation} from '../src/map-vegetation-data';
import {createAdvancedGrassGeometry,EZ_TREE_VARIANTS} from '../extras/bioma/forest-primitives.js';
import {waveAt,waveNormalAt} from '../extras/bioma/water-primitives.js';
const scatterOptions={kind:'tree' as const,variant:-1,seed:'test-forest',count:150,x:0,z:0,radius:20,spacing:3,minScale:.75,maxScale:1.2};
const trees=scatterVegetation([],scatterOptions,(x,z)=>x>0&&z>0);
assert(trees.length>0&&trees.length<150);assert.deepEqual(trees,scatterVegetation([],scatterOptions,(x,z)=>x>0&&z>0));
assert(new Set(trees.map(v=>v.variant)).size>1);for(const t of trees){assert(t.x>0&&t.z>0);assert(t.scale>=.75&&t.scale<=1.2);assert(trees.filter(o=>o!==t).every(o=>Math.hypot(o.x-t.x,o.z-t.z)>=3));}
assert.equal(EZ_TREE_VARIANTS.length,8);assert.throws(()=>validateVegetation([{...trees[0],x:NaN}]));assert.throws(()=>validateVegetation(Array(1201).fill(trees[0])));
const blades=createAdvancedGrassGeometry();assert.equal(blades.attributes.position.count,65);assert.equal(blades.index.count,117);assert.equal(Math.min(...blades.attributes.position.array.filter((_,i)=>i%3===1)),0);blades.dispose();
for(const wind of [0,.45,1])for(const t of [0,1,20]){assert(Number.isFinite(waveAt(12,5,t,wind)));assert(Math.abs(waveNormalAt(12,5,t,wind).length()-1)<1e-8);}
// Both near and far clipping must contain the entire map, even at its edges.
const camera=new THREE.OrthographicCamera(-70,70,35,-35,.01,100),target=new THREE.Vector3(0,.86,0);
camera.position.set(4,3.3,5);camera.lookAt(target);camera.updateMatrixWorld(true);
const sample=new THREE.Vector3(10,0,12),before=sample.clone().project(camera);
assert(sample.clone().project(camera).z < -1,'foreground reproduces the old near-plane cut');
fitGameCameraDepth(camera,target,100);
const after=sample.clone().project(camera);assert(Math.abs(before.x-after.x)<1e-10&&Math.abs(before.y-after.y)<1e-10,'depth correction preserves framing');
const base=camera.position.clone();
for(const zoom of [.18,.4,1,4.5])for(const px of [-50,0,50])for(const pz of [-50,0,50])for(const py of [-20,30]){
 camera.zoom=zoom;camera.position.copy(base).add(new THREE.Vector3(px,py,pz));camera.lookAt(target.clone().add(new THREE.Vector3(px,py,pz)));camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
 for(const x of [-50,50])for(const z of [-50,50])for(const y of [-20,35]){const depth=new THREE.Vector3(x,y,z).project(camera).z;assert(depth>-1&&depth<1,'whole terrain remains inside depth range at every player position and zoom');}
}
import {emptyGameMap,validateGameMap,loadGameMap,GAME_MAP_STORE} from '../src/game-map-data';
const sun=new THREE.DirectionalLight();
for(const zoom of [.18,.4,1,4.5])for(const x of [-50,0,50]){
 camera.zoom=zoom;camera.position.copy(base).add(new THREE.Vector3(x,0,0));camera.lookAt(target.clone().add(new THREE.Vector3(x,0,0)));camera.updateProjectionMatrix();
 const coverage=fitGameShadows(sun,camera,100);
 for(const px of [coverage.min.x,coverage.max.x])for(const py of [-20,35])for(const pz of [coverage.min.z,coverage.max.z]){
  const projected=new THREE.Vector3(px,py,pz).project(sun.shadow.camera);
  assert(Math.abs(projected.x)<1&&Math.abs(projected.y)<1&&Math.abs(projected.z)<1,'visible terrain and casters fit inside the shadow camera');
 }
 assert(sun.shadow.camera.right-sun.shadow.camera.left>4,'shadow coverage is not restricted to the character');
}
import {createGameMapScene} from '../src/game-map-scene';
import {createCoursePhysics,courseGround,type GameCourse} from '../src/game-course';
import {brush,paintLine,fillRegion,heightAt} from '../extras/editor-isometrico/terrain-data.js';
import {loadMapLibrary,saveMap,MAP_LIBRARY_STORE} from '../src/map-library';
import {importGameMap,validateMapReference} from '../src/game-map-data';
const data=emptyGameMap();assert.deepEqual(validateGameMap(JSON.parse(JSON.stringify(data))),data);
const environmentSettings={...defaultEnvironment(),hour:23,weather:'rain' as const,intensity:.8};
const environmentMap=createGameMapScene({...emptyGameMap(),environment:environmentSettings});assert.deepEqual(environmentMap.snapshot().environment,environmentSettings);environmentMap.setEnvironment({...environmentSettings,hour:12});assert.equal(environmentMap.snapshot().environment!.hour,12);assert.throws(()=>validateEnvironment({...environmentSettings,hour:25}));assert.throws(()=>validateEnvironment({...environmentSettings,weather:'storm'}));
const environmentScene=new THREE.Scene(),environmentSun=new THREE.DirectionalLight(),hemisphere=new THREE.HemisphereLight(),fill=new THREE.DirectionalLight();
const fakeRenderer={getPixelRatio:()=>1,toneMappingExposure:1} as THREE.WebGLRenderer;
const ambience=createGameEnvironment(environmentScene,fakeRenderer,environmentSun,hemisphere,fill,()=>new THREE.Vector3());
const priorCompile=environmentMap.terrain.mesh.material.onBeforeCompile;
for(let i=0;i<12;i++)ambience.update(.1,i*.1,environmentSettings,environmentMap.terrain.mesh.material);
assert(!ambience.audioActive,'saved environment never autoplays audio');assert(environmentSun.intensity<.2,'night lighting remains dark during rain');assert(environmentScene.children.some(o=>o instanceof THREE.Points&&o.visible));
const terrainShader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};environmentMap.terrain.mesh.material.onBeforeCompile(terrainShader as any,null as any);assert(terrainShader.fragmentShader.includes('surfacePalette')&&terrainShader.fragmentShader.includes('uniform float uSnow;'),'weather preserves the editor terrain shader');
for(let i=0;i<20;i++)ambience.update(.1,i*.1,{...defaultEnvironment(),weather:'snow',hour:12},environmentMap.terrain.mesh.material);
assert.equal(environmentScene.children.filter(o=>o instanceof THREE.Points&&o.visible).length,1,'rain and snow never fall simultaneously');assert(environmentSun.intensity>1);
ambience.clear();assert.equal(environmentScene.children.length,0);assert.equal(environmentMap.terrain.mesh.material.onBeforeCompile,priorCompile);environmentMap.dispose();
const forestData={...emptyGameMap(),vegetation:trees,visual:{style:'forest' as const,wind:.6}};assert.deepEqual(validateGameMap(JSON.parse(JSON.stringify(forestData))),forestData);
const forestScene=createGameMapScene(forestData);assert.deepEqual(forestScene.snapshot(),forestData);forestScene.terrain.apply(trees[0],{tool:'flatten',radius:5,level:2,strength:1});forestScene.terrain.rebuild();forestScene.settleEffects();assert.equal(forestScene.vegetation.snapshot().length,trees.length);forestScene.setVisual({style:'classic',wind:0});assert.equal(forestScene.snapshot().visual!.style,'classic');forestScene.dispose();forestScene.dispose();
const groundScene=createGameMapScene({...emptyGameMap(),vegetation:[{kind:'grass',variant:1,x:0,z:0,scale:1,rotation:0}]});const grassMesh=groundScene.vegetation.root.children[0] as THREE.InstancedMesh;const grassMatrix=new THREE.Matrix4();grassMesh.getMatrixAt(0,grassMatrix);assert(Math.abs(grassMatrix.elements[13]-groundScene.terrain.heightAt(0,0))<.01);groundScene.dispose();
const collisionMap=createGameMapScene({...emptyGameMap(),vegetation:[
 {kind:'tree',variant:0,x:0,z:0,scale:1,rotation:0},
 {kind:'rock',variant:0,x:4,z:0,scale:1.5,rotation:1},
 {kind:'rock',variant:0,x:8,z:0,scale:.3,rotation:0},
 {kind:'shrub',variant:0,x:12,z:0,scale:2,rotation:0},
 {kind:'grass',variant:0,x:16,z:0,scale:2,rotation:0},
]});
assert.equal(collisionMap.vegetation.colliders.length,2,'only tree trunks and large rocks collide');
const vegetationCourse:GameCourse={size:100,boxes:[],ramps:[],pits:[],points:[],get cylinders(){return collisionMap.vegetation.colliders;},terrainHeight:(x,z)=>collisionMap.terrain.heightAt(x,z)};
const vegetationPhysics=createCoursePhysics(vegetationCourse,1.8,.3);
for(const x of [0,4]){vegetationPhysics.reset(x-3,0);const blocked=vegetationPhysics.step(.016,{x:x-3,z:0},{x:x+3,z:0},false,false,0,true,false);assert(blocked.x<x,'movement cannot tunnel through a tree or large rock');assert(blocked.contacts.length);}
for(const x of [8,12,16]){vegetationPhysics.reset(x-2,0);const pass=vegetationPhysics.step(.016,{x:x-2,z:0},{x:x+2,z:0},false,false,0,true,false);assert(Math.abs(pass.x-(x+2))<1e-6,'small rocks, shrubs and grass stay passable');}
vegetationPhysics.reset(-3,0);assert(vegetationPhysics.step(.016,{x:-3,z:0},{x:3,z:0},false,false,0,false,false).x>2.9,'collision OFF stays respected');
collisionMap.terrain.apply({x:0,z:0},{tool:'paint',radius:2,surface:5});collisionMap.terrain.rebuild();collisionMap.settleEffects();assert.equal(collisionMap.vegetation.colliders.length,1,'hidden trees on water do not leave invisible colliders');
collisionMap.vegetation.set([]);assert.equal(collisionMap.vegetation.colliders.length,0);collisionMap.dispose();
const memory=new Map<string,string>(),storage={getItem:(key:string)=>memory.get(key)??null,setItem:(key:string,value:string)=>{memory.set(key,value);}};
memory.set(GAME_MAP_STORE,JSON.stringify(data));assert.equal(loadMapLibrary(storage)[0].id,'legacy');
saveMap(storage,'one','Floresta',data);saveMap(storage,'two','Lago',data);assert.equal(loadMapLibrary(storage).length,3);const edited=structuredClone(data);edited.terrain.heights[0]=2;saveMap(storage,'one','Floresta editada',edited);assert.equal(loadMapLibrary(storage).find(m=>m.id==='two')!.data.terrain.heights[0],0);assert.equal(loadMapLibrary(storage).find(m=>m.id==='one')!.data.terrain.heights[0],2);assert.equal(loadMapLibrary(storage).length,3);assert(memory.has(GAME_MAP_STORE),'legacy backup is preserved');
assert.throws(()=>saveMap(storage,'one',' ',data));assert.equal(importGameMap({format:'elemental-map',version:1,ground:'#526b57',objects:[],effects:[],terrain:data.terrain}).ground,'#526b57');assert.throws(()=>validateMapReference({image:'https://example.com/image.png'}));
assert(brush(data.terrain,0,0,{tool:'raise',radius:3,strength:1}));assert.equal(heightAt(data.terrain,0,0),1);
brush(data.terrain,0,0,{tool:'flatten',radius:3,strength:1,level:2});
assert(paintLine(data.terrain,{x:-8,z:0},{x:8,z:0},{radius:1,surface:7}));assert(fillRegion(data.terrain,-30,-30,1));
const map=createGameMapScene(data),scene=new THREE.Scene();scene.add(map.root);const ray=new THREE.Raycaster();map.root.updateMatrixWorld(true);
for(const [x,z] of [[.2,.3],[-1.4,.8],[3.7,2.1]]){ray.set(new THREE.Vector3(x,80,z),new THREE.Vector3(0,-1,0));const hit=ray.intersectObject(map.terrain.mesh)[0];assert(hit);assert(Math.abs(hit.point.y-map.terrain.heightAt(x,z))<1e-5);}
const fire=map.effects.add('fire',[0,2,0],{height:.25,scale:2,emission:1.5,life:.8,turbulence:.5,groupId:'group',groupName:'Fogo'});map.effects.configure(fire,fire.userData.options);map.settleEffects();
assert.equal(fire.position.y,map.terrain.heightAt(0,0)+.25);
for(let i=0;i<150;i++)map.update(i*16.667);assert(fire.userData.systems.every(s=>s.particleNum>0));
const saved=map.snapshot(),restored=createGameMapScene(saved);assert.deepEqual(restored.snapshot(),saved);assert.equal(restored.effects.items()[0].scale.x,2);
const stored=JSON.stringify(saved);assert.deepEqual(loadGameMap({getItem:key=>key===GAME_MAP_STORE?stored:null}),saved);
const course:GameCourse={size:100,boxes:[],ramps:[],pits:[],points:[],terrainHeight:(x,z)=>restored.terrain.heightAt(x,z)};
const physics=createCoursePhysics(course,1.8,.3);assert.equal(physics.reset(),courseGround(course,0,0));
for(let i=0;i<10;i++){const p=physics.step(.016,{x:0,z:0},{x:.01,z:0},false,false,0,true,false);assert(Math.abs(p.y-restored.terrain.heightAt(p.x,p.z))<.001);}
restored.terrain.set(null);restored.terrain.apply({x:0,z:0},{tool:'paint',radius:3,surface:6});restored.terrain.rebuild();assert(restored.terrain.heightAt(0,0)>.2);
restored.terrain.apply({x:0,z:0},{tool:'paint',radius:3,surface:5});restored.terrain.rebuild();assert(Math.abs(restored.terrain.heightAt(0,0)+1.2)<.001);
const water=restored.root.children.find(o=>o instanceof THREE.Mesh&&o.geometry.hasAttribute('aDepth')) as THREE.Mesh<THREE.BufferGeometry,THREE.MeshPhysicalMaterial>;
assert(water,'water surface exists');const depths=water.geometry.getAttribute('aDepth'),waterPoints=water.geometry.getAttribute('position'),groundPoints=restored.terrain.mesh.geometry.getAttribute('position');
let bankSamples=0,drySamples=0;
for(let i=0;i<depths.count;i++){
 const actual=waterPoints.getY(i)-groundPoints.getY(i);assert(Math.abs(depths.getX(i)-actual)<1e-6);
 if(actual>0&&actual<.6)bankSamples++;if(actual<0)drySamples++;
}
assert(bankSamples>0&&drySamples>0,'signed water depth covers the sloping bank and excludes dry land');
const waterShader={uniforms:{},vertexShader:THREE.ShaderLib.physical.vertexShader,fragmentShader:THREE.ShaderLib.physical.fragmentShader};water.material.onBeforeCompile(waterShader as any,null as any);
assert(waterShader.vertexShader.includes('terrainWaterDepth = aDepth;'));assert(waterShader.fragmentShader.includes('if(terrainWaterDepth<=.002)discard;'));
assert(!waterShader.fragmentShader.includes('shore=smoothstep(.5-'),'water boundary no longer cuts halfway into the basin');
restored.terrain.set(null);restored.terrain.apply({x:0,z:0},{tool:'flatten',radius:10,strength:1,level:-10});restored.terrain.rebuild();assert.equal(physics.reset(),-10);assert(!physics.step(.016,{x:0,z:0},{x:.01,z:0},false,false,0,true,false).respawned,'valid negative relief is not a fall');
assert.throws(()=>validateGameMap({...data,effects:[{type:'fire',position:[NaN,0,0],options:{}}]}));assert.throws(()=>validateGameMap({...data,effects:[{type:'fire',position:[0,0,0],options:{scale:100}}]}));assert.throws(()=>validateGameMap({...data,terrain:{...data.terrain,heights:[]}}));
map.dispose();map.dispose();restored.dispose();restored.dispose();assert.equal(map.root.children.length,0);
console.log('Game map: source terrain brushes, ray/surface parity, snow/water, live physics and negative relief, Quarks emission, relative placement, options/groups, storage/JSON validation and idempotent disposal passed.');
import './vegetation-performance';
