// Lampião — gerado pelo ABRIGO (aba Objetos). Só Three.js: sem modelos nem texturas.
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

function extrude(outline:[number,number][],depth:number,bevel:number,holes:[number,number][][]=[]){const shape=new THREE.Shape(outline.map(([x,y])=>new THREE.Vector2(x,y)));for(const h of holes)shape.holes.push(new THREE.Path(h.map(([x,y])=>new THREE.Vector2(x,y))));const g=new THREE.ExtrudeGeometry(shape,{depth:Math.max(1e-3,depth-2*bevel),bevelEnabled:bevel>1e-4,bevelThickness:bevel,bevelSize:bevel,bevelSegments:2});g.translate(0,0,-depth/2+bevel);return g;}

export function createLampiaoModel(){
  const root=new THREE.Group();root.name="Lampião";
  const sockets:Record<string,THREE.Object3D>={};
  const part=(name:string,geometry:THREE.BufferGeometry,color:string,roughness:number,metalness:number,position:number[],rotation:number[],mirror=false)=>{
    for(const m of mirror?[1,-1]:[1]){const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,roughness,metalness}));mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;
      mesh.position.set(position[0]*m,position[1],position[2]);mesh.rotation.set(rotation[0],rotation[1]*m,rotation[2]*m);mesh.scale.x=m;root.add(mesh);}
  };
  part("Base",new THREE.LatheGeometry([[0,0],[0.07,0],[0.075,0.02],[0.06,0.035],[0.055,0.04],[0,0.04]].map(([r,h])=>new THREE.Vector2(r,h)),24),'#3d3a33',0.5,0.5,[0,0,0],[0,0,0]);
  part("Vidro",new THREE.CylinderGeometry(0.048,0.048,0.14,20),'#e8c878',0.15,0,[0,0.11,0],[0,0,0]);
  part("Grade",new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[0.05,0.04,0],[0.055,0.11,0],[0.05,0.18,0]].map(v=>new THREE.Vector3(...v))),18,0.004,8,false),'#3d3a33',0.8,0.5,[0,0,0],[0,0,0],true);
  part("Tampa",new THREE.LatheGeometry([[0,0],[0.06,0],[0.045,0.04],[0.015,0.06],[0,0.06]].map(([r,h])=>new THREE.Vector2(r,h)),24),'#3d3a33',0.5,0.5,[0,0.18,0],[0,0,0]);
  part("Alça",new THREE.TorusGeometry(0.045,0.005,8,28),'#2a2824',0.8,0.6,[0,0.26,0],[0,0,0]);
  {const s=new THREE.Group();s.name='socket-grip';s.position.set(0,0.3,0);s.rotation.set(0,0,0);root.add(s);sockets["grip"]=s;}
  return {root,sockets};
}
