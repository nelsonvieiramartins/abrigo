import * as THREE from 'three';
import {writeFileSync} from 'node:fs';
import {buildDetailedRat,RAT_RUN_PERIOD,RAT_RUN_SPEED,RAT_RUN_PLUS_PERIOD,RAT_RUN_PLUS_SPEED} from './rat-detail';
import {validateCreatureSpec} from './creature-schema';
import brown from '../rato-marrom.criatura.json';
import gray from '../rato-cinza.criatura.json';
import black from '../rato-preto.criatura.json';
const V=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
function model(recipe:unknown){
 const root=new THREE.Group(),body=new THREE.Group();root.add(body);
 const nodes:Record<string,THREE.Object3D>={},geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
 const animate=buildDetailedRat(validateCreatureSpec(recipe),{body,nodes,sockets:{},geometries,materials});animate(0,'idle');root.updateMatrixWorld(true);
 return {root,body,nodes,geometries,materials,animate};
}
const rat=model(brown);
function render(name:string,from:THREE.Vector3,at:THREE.Vector3,span:number,part?:THREE.Object3D,asset=rat,top=false){
 const camera=new THREE.OrthographicCamera(-span,span,span,-span,.001,10);if(top)camera.up.set(0,0,1);camera.position.copy(from);camera.lookAt(at);camera.updateMatrixWorld(true);asset.root.updateMatrixWorld(true);
 const hidden:THREE.Mesh[]=[];
 if(part)asset.body.traverse(o=>{if(!(o instanceof THREE.Mesh))return;let p:THREE.Object3D|null=o;while(p&&p!==part)p=p.parent;if(!p){o.visible=false;hidden.push(o);}});
 const triangles:any[]=[],light=V(-3,5,4).normalize();
 asset.body.traverseVisible(o=>{if(!(o instanceof THREE.Mesh))return;
  const p=o.geometry.getAttribute('position'),index=o.geometry.index,colors=o.geometry.getAttribute('color'),m=o.material as THREE.MeshStandardMaterial,count=index?.count??p.count;
  for(let i=0;i<count;i+=3){const ids=[0,1,2].map(j=>index?index.getX(i+j):i+j),world=ids.map(id=>new THREE.Vector3().fromBufferAttribute(p,id).applyMatrix4(o.matrixWorld)),normal=world[1].clone().sub(world[0]).cross(world[2].clone().sub(world[0])).normalize(),base=m.color.clone();
   if(m.vertexColors&&colors)base.multiply(new THREE.Color().fromBufferAttribute(colors,ids[0]));base.multiplyScalar(.42+.85*Math.max(0,normal.dot(light))).convertLinearToSRGB();
   triangles.push({p:world.map(v=>v.project(camera).toArray()),color:base.toArray().map(v=>Math.min(255,Math.max(0,Math.round(v*255)))),double:m.side===THREE.DoubleSide});
  }
 });
 writeFileSync('render/rat-'+name+'.json',JSON.stringify(triangles));for(const o of hidden)o.visible=true;
}
const quarterFrom=V(-.72,.42,.90),quarterTarget=V(0,.085,-.065);
render('tres-quartos',quarterFrom,quarterTarget,.35);
render('frente',V(0,.12,2),V(0,.12,.02),.20);
render('lateral',V(-2,.23,-.092),V(0,.095,-.092),.41);
render('traseira',V(0,.14,-2),V(0,.14,-.04),.20);
render('superior',V(0,2,-.09),V(0,.06,-.09),.41,undefined,rat,true);
const head=rat.nodes.head.getWorldPosition(V(0,0,0)).add(V(0,.018,.055));
render('cabeca',head.clone().add(V(-.7,.3,1)),head,.125,rat.nodes.head);
const paw=rat.nodes['paw-frontL'].getWorldPosition(V(0,0,0)).add(V(0,-.009,.012));
render('pata',paw.clone().add(V(-.3,.24,.30)),paw,.038,rat.nodes['paw-frontL']);
const tailTarget=V(0,.065,-.310);
render('cauda',tailTarget.clone().add(V(-.6,.4,-.8)),tailTarget,.20,rat.nodes['tail-0']);
for(const [name,recipe] of [['cinza',gray],['preto',black]] as const){const m=model(recipe);render(name,quarterFrom,quarterTarget,.35,undefined,m);m.geometries.forEach(g=>g.dispose());m.materials.forEach(x=>x.dispose());}
rat.animate(0,'idle');rat.animate(0,'attack');
for(let i=0;i<17;i++){rat.animate(i/24,'attack');render('attack-'+i,quarterFrom,quarterTarget,.35);}
const period=2*Math.PI/9,speed=.023*9*2/Math.PI;
rat.animate(0,'idle');
for(let i=0;i<24;i++){const time=i/24*period*2;rat.animate(time,'move');rat.root.position.z=time*speed;render('walk-'+i,V(-2,.22,-.02),V(0,.10,-.02),.50);}
console.log('Exported real rat mesh projections: five views, details, palettes and attack/walk frames.');

rat.root.position.z=0;
for(let i=0;i<36;i++){
 const time=i/36*RAT_RUN_PERIOD*2;rat.animate(time,'run');rat.root.position.z=time*RAT_RUN_SPEED;
 const follow=rat.root.position.z;
 render('run-'+i,V(-2,.22,-.065+follow),V(0,.10,-.065+follow),.46);
}
rat.root.position.z=0;
for(const [i,p] of [.14,.40,.64,.90].entries()){
 rat.animate(p*RAT_RUN_PERIOD,'run');render('gallop-'+i,V(-2,.18,-.04),V(0,.10,-.04),.43);
}
console.log('Exported galloping frames and hind/flight/fore/regrouping phases.');

rat.root.position.z=0;
for(let i=0;i<48;i++){
 const time=i/48*RAT_RUN_PLUS_PERIOD*4;rat.animate(time,'runPlus');rat.root.position.z=time*RAT_RUN_PLUS_SPEED;
 const follow=rat.root.position.z;
 render('runplus-'+i,V(-2,.22,-.065+follow),V(0,.10,-.065+follow),.46);
}
rat.root.position.z=0;
for(const [i,p] of [.14,.40,.64,.90].entries()){
 rat.animate(p*RAT_RUN_PLUS_PERIOD,'runPlus');render('gallopplus-'+i,V(-2,.18,-.04),V(0,.10,-.04),.43);
}
console.log('Exported CORRER+ at actual speed, with tracking camera.');
