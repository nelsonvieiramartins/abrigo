import * as THREE from 'three';

import {writeFileSync} from 'node:fs';
import {buildDetailedSkeleton} from './skeleton-detail';
import {validateCreatureSpec} from './creature-schema';
import recipe from '../esqueleto-referencia.criatura.json';
class Element{attrs:Record<string,string>={};style:any={};childNodes:Element[]=[];constructor(public tag:string){}setAttribute(k:string,v:any){this.attrs[k]=String(v);}appendChild(e:Element){this.childNodes.push(e);}removeChild(e:Element){this.childNodes.splice(this.childNodes.indexOf(e),1);}get outerHTML():string{return '<'+this.tag+' '+Object.entries(this.attrs).map(([k,v])=>k+'="'+v+'"').join(' ')+'>'+this.childNodes.map(x=>x.outerHTML).join('')+'</'+this.tag+'>';}}
(globalThis as any).document={createElementNS:(_:string,tag:string)=>new Element(tag)};
const scene=new THREE.Scene();scene.background=new THREE.Color('white');scene.add(new THREE.AmbientLight(0xffffff,.70));const light=new THREE.DirectionalLight(0xffffff,1.35);light.position.set(-3,5,4);scene.add(light);
const previewRoot=new THREE.Group();scene.add(previewRoot);const body=new THREE.Group();previewRoot.add(body);const nodes:Record<string,THREE.Object3D>={},geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();const animate=buildDetailedSkeleton(validateCreatureSpec(recipe),{body,nodes,sockets:{},geometries,materials});animate(0,'idle');
const render=(name:string,from:THREE.Vector3,at:THREE.Vector3,span:number,part?:THREE.Object3D)=>{
 const camera=new THREE.OrthographicCamera(-span,span,span,-span,.01,20);camera.position.copy(from);camera.lookAt(at);camera.updateMatrixWorld(true);
 const hidden:THREE.Object3D[]=[];if(part)body.traverse(item=>{if(!(item instanceof THREE.Mesh))return;let p:THREE.Object3D|null=item;while(p&&p!==part)p=p.parent;if(!p){item.visible=false;hidden.push(item);}});
 scene.updateMatrixWorld(true);const rasterTriangles:any[]=[];body.traverseVisible(item=>{if(!(item instanceof THREE.Mesh))return;const geometry=item.geometry,p=geometry.getAttribute('position'),colors=geometry.getAttribute('color'),index=geometry.index,mat=item.material as THREE.MeshStandardMaterial,count=index?index.count:p.count;
  for(let i=0;i<count;i+=3){const ids=[0,1,2].map(j=>index?index.getX(i+j):i+j),world=ids.map(id=>new THREE.Vector3().fromBufferAttribute(p,id).applyMatrix4(item.matrixWorld)),normal=world[1].clone().sub(world[0]).cross(world[2].clone().sub(world[0])).normalize();const base=mat.color.clone();if(mat.vertexColors&&colors)base.multiply(new THREE.Color().fromBufferAttribute(colors,ids[0]));const factor=.42+.85*Math.max(0,normal.dot(new THREE.Vector3(name.startsWith('cranio')?3:-3,5,4).normalize()));base.multiplyScalar(factor);base.convertLinearToSRGB();
   rasterTriangles.push({p:world.map(v=>v.project(camera).toArray()),color:base.toArray().map(v=>Math.min(255,Math.max(0,Math.round(v*255)))),double:mat.side===THREE.DoubleSide});
  }});writeFileSync('render/skeleton-'+name+'.json',JSON.stringify(rasterTriangles));

 for(const child of hidden)child.visible=true;
};
const V=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);body.updateMatrixWorld(true);const head=nodes.head.getWorldPosition(new THREE.Vector3());
render('frente',V(0,1.06,6),V(0,1.06,0),1.14);
render('lateral',V(6,1.06,0),V(0,1.06,0),1.14);
render('tres-quartos',V(3.6,2.0,5),V(0,1.06,0),1.14);
render('traseira',V(0,1.06,-6),V(0,1.06,0),1.14);
render('cranio',head.clone().add(V(-3,.40,5)),head.clone().add(V(0,-.015,.035)),.25);
render('torax',V(3.6,1.65,5),V(0,1.35,0),.44);
const hand=nodes.handR.getWorldPosition(V(0,0,0)).add(V(0,-.089,.016));render('mao',hand.clone().add(V(5,.08,1.3)),hand,.17,nodes.handR);
const handL=nodes.handL.getWorldPosition(V(0,0,0)).add(V(0,-.09,.016));render('mao-L',handL.clone().add(V(-5,.08,1.3)),handL,.17,nodes.handL);
render('cranio-frente',head.clone().add(V(0,0,5)),head.clone().add(V(0,-.015,.035)),.25);
render('cranio-lateral',head.clone().add(V(5,0,0)),head.clone().add(V(0,-.015,.035)),.25);
render('bacia',V(2.0,1.06,5),V(0,.99,0),.30);
render('pe',V(1.1,.6,3),V(.22,.052,.07),.23);
animate(0,'idle');animate(0,'attack');for(let i=0;i<12;i++){animate(i/12,'attack');render('attack-'+i,V(3.6,2.0,5),V(0,1.06,0),1.14);}

// Preview-only world translation. Production root translation remains the responsibility of ABRIGO.
animate(0,'idle');const walkPeriod=2*Math.PI/5.6,previewSpeed=.095*5.6*2/Math.PI;
for(let i=0;i<32;i++){const t=i/32*walkPeriod*2;animate(t,'move');previewRoot.position.z=previewSpeed*t;render('walk-'+i,V(-6,1.08,.4),V(0,1.08,.4),1.24);}
previewRoot.position.z=0;animate(0,'idle');
