import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {buildDetailedSkeleton} from './skeleton-detail';
import {validateCreatureSpec,type CreatureMotion} from './creature-schema';
import recipe from '../esqueleto-referencia.criatura.json';
const stage=document.querySelector('#stage') as HTMLElement,scene=new THREE.Scene();scene.background=new THREE.Color('#f7f7f5');
const camera=new THREE.OrthographicCamera(-1.14,1.14,1.14,-1.14,.01,25),renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;stage.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xffffff,0x776b59,1.35));const sun=new THREE.DirectionalLight(0xffffff,2);sun.position.set(-3,5,4);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-2,right:2,top:3,bottom:-2});sun.shadow.normalBias=.007;scene.add(sun);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(15,15),new THREE.MeshStandardMaterial({color:'#f7f7f5',roughness:1}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
const previewRoot=new THREE.Group();scene.add(previewRoot);const body=new THREE.Group();previewRoot.add(body);const nodes:Record<string,THREE.Object3D>={},geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
const update=buildDetailedSkeleton(validateCreatureSpec(recipe),{body,nodes,sockets:{},geometries,materials});body.updateMatrixWorld(true);
const grid=new THREE.GridHelper(16,40,0xc2b9a8,0xdfd8cb);grid.position.y=.003;scene.add(grid);
const frontArrow=new THREE.ArrowHelper(new THREE.Vector3(0,0,1),new THREE.Vector3(-.65,.03,-.12),.85,0x647b48,.12,.07);previewRoot.add(frontArrow);
const controls=new OrbitControls(camera,renderer.domElement);let span=1.14;
const V=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
function resize(){const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;renderer.setSize(w,h);const aspect=w/h;camera.left=-span*aspect;camera.right=span*aspect;camera.top=span;camera.bottom=-span;camera.updateProjectionMatrix();}
function view(value:string){
 const headView=value.startsWith('head');sun.position.set(headView?3:-3,5,4);
 const refHead=document.querySelector('#reference-head') as HTMLImageElement|null,refBody=document.querySelector('#reference-body') as HTMLImageElement|null;
 if(refHead&&refBody){refHead.hidden=!headView;refBody.hidden=headView;}
 previewRoot.position.z=0;update(0,'idle');body.updateMatrixWorld(true);let target=V(0,1.07,0),from=V(3.6,2,5);span=1.14;
 if(value==='front')from=V(0,1.07,6);else if(value==='side')from=V(6,1.07,0);else if(value==='rear')from=V(0,1.07,-6);
 else if(value.startsWith('head')){target=nodes.head.getWorldPosition(V(0,0,0)).add(V(0,-.015,.035));span=.25;from=target.clone().add(value==='head-front'?V(0,0,5):value==='head-side'?V(5,0,0):V(-3,.415,5));}
 else if(value==='chest'){target=nodes.chest.getWorldPosition(V(0,0,0)).add(V(0,.02,0));span=.43;from=target.clone().add(V(3,.5,5));}
 else if(value==='pelvis'){target=nodes.pelvis.getWorldPosition(V(0,0,0)).add(V(0,.03,0));span=.3;from=target.clone().add(V(2,.2,5));}
 else if(value==='hand'||value==='hand-left'){target=nodes[value==='hand-left'?'handL':'handR'].getWorldPosition(V(0,0,0)).add(V(0,-.085,.03));span=.17;from=target.clone().add(V(value==='hand-left'?-5:5,.1,1.3));}
 else if(value==='foot'){target=nodes.footL.getWorldPosition(V(0,0,0)).add(V(0,-.04,.08));span=.23;from=target.clone().add(V(1,.6,3));}
 camera.zoom=1;camera.position.copy(from);controls.target.copy(target);camera.lookAt(target);controls.update();resize();
}
view('quarter');document.querySelector('#view')!.addEventListener('change',e=>view((e.target as HTMLSelectElement).value));
let motion:CreatureMotion='idle',attackStart=-Infinity,wire=false,paused=false,advance=true,lastNow=performance.now()/1000;
document.querySelector('#advance')!.addEventListener('change',e=>advance=(e.target as HTMLInputElement).checked);
document.querySelector('#motion')!.addEventListener('change',e=>{motion=(e.target as HTMLSelectElement).value as CreatureMotion;attackStart=-Infinity;});
document.querySelector('#attack')!.addEventListener('click',()=>{update(0,'idle');attackStart=performance.now()/1000;paused=false;});
document.querySelector('#wire')!.addEventListener('click',()=>{wire=!wire;materials.forEach(m=>(m as THREE.MeshStandardMaterial).wireframe=wire);});
document.querySelector('#pause')!.addEventListener('click',()=>paused=!paused);
let triangles=0,meshes=0;body.traverse(o=>{if(o instanceof THREE.Mesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;}});document.querySelector('#stats')!.textContent=`${triangles.toLocaleString('pt-BR')} triângulos · ${meshes} malhas · 3 materiais`;
window.addEventListener('resize',resize);new ResizeObserver(resize).observe(stage);
function frame(ms:number){const now=ms/1000,dt=Math.min(.05,Math.max(0,now-lastNow));lastNow=now;
 if(!paused){const attacking=now-attackStart<.95;update(attacking?now-attackStart:now,attacking?'attack':motion);
  if(advance&&!attacking&&(motion==='move'||motion==='run')){
   const before=previewRoot.position.z;previewRoot.position.z+=dt*(motion==='run'?.831:.339);if(previewRoot.position.z>3)previewRoot.position.z-=6;
   const dz=previewRoot.position.z-before;camera.position.z+=dz;controls.target.z+=dz;controls.update();
  }
 }
 renderer.render(scene,camera);requestAnimationFrame(frame);
}requestAnimationFrame(frame);
(window as any).skeletonReady=true;
