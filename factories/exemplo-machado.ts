// Machado — gerado pelo ABRIGO (aba Objetos). Só Three.js: sem modelos nem texturas.
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

function extrude(outline:[number,number][],depth:number,bevel:number,holes:[number,number][][]=[]){const shape=new THREE.Shape(outline.map(([x,y])=>new THREE.Vector2(x,y)));for(const h of holes)shape.holes.push(new THREE.Path(h.map(([x,y])=>new THREE.Vector2(x,y))));const g=new THREE.ExtrudeGeometry(shape,{depth:Math.max(1e-3,depth-2*bevel),bevelEnabled:bevel>1e-4,bevelThickness:bevel,bevelSize:bevel,bevelSegments:2});g.translate(0,0,-depth/2+bevel);return g;}

export function createMachadoModel(){
  const root=new THREE.Group();root.name="Machado";
  const sockets:Record<string,THREE.Object3D>={};
  const part=(name:string,geometry:THREE.BufferGeometry,color:string,roughness:number,metalness:number,position:number[],rotation:number[],mirror=false)=>{
    for(const m of mirror?[1,-1]:[1]){const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,roughness,metalness}));mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;
      mesh.position.set(position[0]*m,position[1],position[2]);mesh.rotation.set(rotation[0],rotation[1]*m,rotation[2]*m);mesh.scale.x=m;root.add(mesh);}
  };
  part("Cabo",new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[0,0,0],[0.006,0.2,0],[0,0.42,0]].map(v=>new THREE.Vector3(...v))),18,0.013,8,false),'#7a5733',0.8,0,[0,0,0],[0,0,0]);
  part("Lâmina",extrude([[-0.02,-0.03],[0.03,-0.035],[0.12,-0.07],[0.13,0.07],[0.03,0.035],[-0.02,0.03]],0.018,0.0024,[]),'#8f9391',0.35,0.7,[0,0.36,0],[0,0,0]);
  part("Olho",new RoundedBoxGeometry(0.04,0.06,0.03,2,0.003),'#5d605e',0.4,0.7,[0,0.36,0],[0,0,0]);
  {const s=new THREE.Group();s.name='socket-grip';s.position.set(0,0.12,0);s.rotation.set(0,0,0);root.add(s);sockets["grip"]=s;}
  return {root,sockets};
}
