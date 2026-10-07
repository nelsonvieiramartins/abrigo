import assert from 'node:assert/strict';
import * as THREE from 'three';
import {fitGameCameraDepth} from '../src/game-camera';
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
import {createGameMapScene} from '../src/game-map-scene';
import {createCoursePhysics,courseGround,type GameCourse} from '../src/game-course';
import {brush,paintLine,fillRegion,heightAt} from '../extras/editor-isometrico/terrain-data.js';
import {loadMapLibrary,saveMap,MAP_LIBRARY_STORE} from '../src/map-library';
import {importGameMap,validateMapReference} from '../src/game-map-data';
const data=emptyGameMap();assert.deepEqual(validateGameMap(JSON.parse(JSON.stringify(data))),data);
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
restored.terrain.set(null);restored.terrain.apply({x:0,z:0},{tool:'flatten',radius:10,strength:1,level:-10});restored.terrain.rebuild();assert.equal(physics.reset(),-10);assert(!physics.step(.016,{x:0,z:0},{x:.01,z:0},false,false,0,true,false).respawned,'valid negative relief is not a fall');
assert.throws(()=>validateGameMap({...data,effects:[{type:'fire',position:[NaN,0,0],options:{}}]}));assert.throws(()=>validateGameMap({...data,effects:[{type:'fire',position:[0,0,0],options:{scale:100}}]}));assert.throws(()=>validateGameMap({...data,terrain:{...data.terrain,heights:[]}}));
map.dispose();map.dispose();restored.dispose();restored.dispose();assert.equal(map.root.children.length,0);
console.log('Game map: source terrain brushes, ray/surface parity, snow/water, live physics and negative relief, Quarks emission, relative placement, options/groups, storage/JSON validation and idempotent disposal passed.');
