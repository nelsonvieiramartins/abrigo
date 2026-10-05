import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {buildDetailedRat,RAT_RUN_PERIOD,RAT_RUN_SPEED,RAT_RUN_PLUS_SPEED} from './rat-detail';
import {validateCreatureSpec,type CreatureSpec,type CreatureMotion,type CreatureDetail} from './creature-schema';
import brown from '../rato-marrom.criatura.json';
import gray from '../rato-cinza.criatura.json';
import black from '../rato-preto.criatura.json';
const $=(id:string)=>document.getElementById(id)!,V=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
const stage=$('stage'),scene=new THREE.Scene();scene.background=new THREE.Color('#f7f7f3');
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));stage.appendChild(renderer.domElement);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const camera=new THREE.OrthographicCamera(-.35,.35,.35,-.35,.001,10),controls=new OrbitControls(camera,renderer.domElement);
scene.add(new THREE.HemisphereLight(0xffffff,0x6f695f,1.3));const sun=new THREE.DirectionalLight(0xffffff,2);sun.position.set(-2,4,3);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-1,right:1,top:1,bottom:-1});sun.shadow.normalBias=.002;scene.add(sun);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(5,5),new THREE.MeshStandardMaterial({color:'#f7f7f3',roughness:1}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
const grid=new THREE.GridHelper(4,40,0xbdb7ad,0xe3dfd5);grid.position.y=-.0003;scene.add(grid);
const previewRoot=new THREE.Group();scene.add(previewRoot);
const arrow=new THREE.ArrowHelper(V(0,0,1),V(-.20,.003,-.08),.20,0x718451,.032,.023);previewRoot.add(arrow);
let body:THREE.Group,nodes:Record<string,THREE.Object3D>={},geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),animate:(time:number,motion:CreatureMotion)=>void;
let recipe:CreatureSpec,span=.35,motion:CreatureMotion='idle',clock=0,lastMs=performance.now(),attackStart=-Infinity,paused=false,wire=false;
const palettes=[brown,gray,black];
function resize(){const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;renderer.setSize(w,h);const aspect=w/h;camera.left=-span*aspect;camera.right=span*aspect;camera.top=span;camera.bottom=-span;camera.updateProjectionMatrix();}
function view(){
 previewRoot.position.z=0;animate(0,'idle');body.updateMatrixWorld(true);camera.up.set(0,1,0);
 const scale=recipe.body.scale,name=($('view') as HTMLSelectElement).value;let at=V(0,.085,-.065).multiplyScalar(scale),from=V(-.72,.42,.90).multiplyScalar(scale);span=.35*scale;
 if(name==='front'){at=V(0,.115,.025).multiplyScalar(scale);from=at.clone().add(V(0,0,2));span=.18*scale;}
 else if(name==='side'){at=V(0,.085,-.092).multiplyScalar(scale);from=at.clone().add(V(-2,.10,0));span=.41*scale;}
 else if(name==='rear'){at=V(0,.115,-.06).multiplyScalar(scale);from=at.clone().add(V(0,0,-2));span=.18*scale;}
 else if(name==='top'){at=V(0,.07,-.09).multiplyScalar(scale);from=at.clone().add(V(0,2,0));span=.41*scale;camera.up.set(0,0,1);}
 else if(name==='head'){at=nodes.head.getWorldPosition(V(0,0,0)).add(V(0,.018,.055).multiplyScalar(scale));from=at.clone().add(V(-.7,.30,1));span=.125*scale;}
 else if(name==='paw'){at=nodes['paw-frontL'].getWorldPosition(V(0,0,0)).add(V(0,-.009,.012).multiplyScalar(scale));from=at.clone().add(V(-.3,.24,.30));span=.038*scale;}
 else if(name==='tail'){at=V(0,.05,-.31).multiplyScalar(scale);from=at.clone().add(V(-.6,.4,-.8));span=.21*scale;}
 camera.zoom=1;camera.position.copy(from);controls.target.copy(at);camera.lookAt(at);controls.update();resize();
}
function rebuild(){
 if(body){geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());previewRoot.remove(body);}
 geometries=new Set();materials=new Set();nodes={};body=new THREE.Group();previewRoot.add(body);
 const raw=structuredClone(palettes[Number(($('palette') as HTMLSelectElement).value)]);
 raw.body.scale=Number(($('scale') as HTMLInputElement).value);raw.rat!.tailLength=raw.anatomy.tail=Number(($('tail') as HTMLInputElement).value);
 raw.rat!.earSize=raw.anatomy.ears=Number(($('ears') as HTMLInputElement).value);
 recipe=validateCreatureSpec(raw);body.scale.setScalar(recipe.body.scale);
 const detail=($('detail') as HTMLSelectElement).value as CreatureDetail;
 animate=buildDetailedRat(recipe,{body,nodes,sockets:{},geometries,materials},detail);
 let triangles=0,meshes=0;body.traverse(o=>{if(o instanceof THREE.Mesh){triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;meshes++;}});
 $('stats').textContent=`${triangles.toLocaleString('pt-BR')} triângulos · ${meshes} malhas · 5 materiais`;
 materials.forEach(m=>(m as THREE.MeshStandardMaterial).wireframe=wire);attackStart=-Infinity;
 for(const id of ['scale','tail','ears'])$('value-'+id).textContent=Number(($(''+id) as HTMLInputElement).value).toFixed(2).replace('.',',');
 view();
}
for(const id of ['palette','detail','scale','tail','ears'])$(id).addEventListener('change',rebuild);
$('view').addEventListener('change',view);
$('motion').addEventListener('change',()=>{motion=($('motion') as HTMLSelectElement).value as CreatureMotion;attackStart=-Infinity;});
$('attack').addEventListener('click',()=>{animate(clock,'idle');attackStart=clock;paused=false;});
$('wire').addEventListener('click',()=>{wire=!wire;materials.forEach(m=>(m as THREE.MeshStandardMaterial).wireframe=wire);});
$('pause').addEventListener('click',()=>paused=!paused);
$('export').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(recipe,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='rato-custom.criatura.json';a.click();URL.revokeObjectURL(url);});
new ResizeObserver(resize).observe(stage);window.addEventListener('resize',resize);rebuild();
function frame(ms:number){
 const dt=Math.min(.05,Math.max(0,(ms-lastMs)/1000))*Number(($('tempo') as HTMLSelectElement).value);lastMs=ms;
 if(!paused){clock+=dt;const attacking=clock-attackStart<.70;animate(clock,attacking?'attack':motion);
  if(!attacking&&($('advance') as HTMLInputElement).checked&&(motion==='move'||motion==='run'||motion==='runPlus')){
   const speed=motion==='runPlus'?RAT_RUN_PLUS_SPEED:motion==='run'?RAT_RUN_SPEED:.023*9*2/Math.PI;
   const previous=previewRoot.position.z;previewRoot.position.z+=dt*speed*recipe.rat!.legLength*recipe.body.scale;
   if(previewRoot.position.z>1.2)previewRoot.position.z-=2.4;
   const dz=previewRoot.position.z-previous;camera.position.z+=dz;controls.target.z+=dz;controls.update();
  }
 }
 renderer.render(scene,camera);requestAnimationFrame(frame);
}requestAnimationFrame(frame);
