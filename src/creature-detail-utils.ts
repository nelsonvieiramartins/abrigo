import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export type DetailContext={body:THREE.Group;nodes:Record<string,THREE.Object3D>;sockets:Record<string,THREE.Object3D>;geometries:Set<THREE.BufferGeometry>;materials:Set<THREE.Material>;instancing?:boolean};
export function detailBuilder(c:DetailContext){
  const mat=(color:string,roughness=.8)=>{const m=new THREE.MeshStandardMaterial({color,roughness,vertexColors:true,side:THREE.DoubleSide});c.materials.add(m);return m;};
  const group=(name:string,parent:THREE.Object3D,pos=[0,0,0])=>{const g=new THREE.Group();g.name=name;g.position.fromArray(pos);parent.add(g);c.nodes[name]=g;return g;};
  const mesh=(name:string,g:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Object3D)=>{
    if(!g.attributes.color)g.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count*3).fill(1),3));
    g.deleteAttribute('uv');c.geometries.add(g);const o=new THREE.Mesh(g,m);o.name=name;o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;
  };
  const ell=(name:string,parent:THREE.Object3D,pos:number[],size:number[],m:THREE.Material,res=18)=>{
    const g=new THREE.SphereGeometry(1,res,Math.max(3,Math.round(res*.55)));g.scale(size[0],size[1],size[2]);g.translate(pos[0],pos[1],pos[2]);return mesh(name,g,m,parent);
  };
  const tube=(name:string,parent:THREE.Object3D,points:number[][],radius:number,endRadius:number,m:THREE.Material,steps=14,sides=10)=>{
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p as [number,number,number]))),g=new THREE.TubeGeometry(curve,steps,1,sides,false),p=g.attributes.position;
    for(let i=0;i<=steps;i++){const center=curve.getPointAt(i/steps),r=THREE.MathUtils.lerp(radius,endRadius,i/steps);for(let j=0;j<=sides;j++){const k=i*(sides+1)+j;p.setXYZ(k,center.x+(p.getX(k)-center.x)*r,center.y+(p.getY(k)-center.y)*r,center.z+(p.getZ(k)-center.z)*r);}}
    g.computeVertexNormals();return mesh(name,g,m,parent);
  };
  const socket=(name:string,parent:THREE.Object3D,pos=[0,0,0])=>c.sockets[name]=group('socket-'+name,parent,pos);
  const batch=(root:THREE.Object3D)=>root.traverse(parent=>{
    const groups=new Map<THREE.Material,THREE.Mesh[]>();
    for(const o of parent.children)if(o instanceof THREE.Mesh&&!(o instanceof THREE.InstancedMesh)&&!Array.isArray(o.material)&&!o.userData.dynamic){const list=groups.get(o.material)??[];list.push(o);groups.set(o.material,list);}
    for(const [m,list] of groups){if(list.length<2)continue;const g=mergeGeometries(list.map(o=>o.geometry),false);if(!g)throw new Error('Geometrias de detalhe incompatíveis.');const names=list.flatMap(o=>o.userData.parts??[o.name]);for(const o of list){parent.remove(o);c.geometries.delete(o.geometry);o.geometry.dispose();}const o=mesh('detail-batch',g,m,parent);o.userData.parts=names;}
  });
  return {mat,group,mesh,ell,tube,socket,batch};
}
