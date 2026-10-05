import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {validateObjectSpec,type ObjectSpec,type ObjectPart} from './object-schema';

export type ObjectDetail='low'|'high';
export interface ObjectModel{
  root:THREE.Group;nodes:Record<string,THREE.Object3D>;sockets:Record<string,THREE.Object3D>;
  stats:{triangles:number;meshes:number};detail:ObjectDetail;
  update:(timeSeconds:number)=>void;dispose:()=>void;
}
const D2R=Math.PI/180;
// Geometry for one part, built only from Three.js primitives (no files). `k` scales tessellation.
export function partGeometry(p:ObjectPart,k:number):THREE.BufferGeometry{
  const [x,y,z]=p.size,seg=(n:number)=>Math.max(3,Math.round(n*k));
  switch(p.shape){
    case 'box':{const b=Math.min(x,y,z)*.5*p.bevel;return b>1e-4&&k>=1?new RoundedBoxGeometry(x,y,z,2,b):new THREE.BoxGeometry(x,y,z);}
    case 'cylinder':return new THREE.CylinderGeometry(x,z||x,y,seg(20),1);
    case 'cone':return new THREE.CylinderGeometry(0,x,y,seg(20),1);
    case 'sphere':{const g=new THREE.SphereGeometry(1,seg(20),seg(14));g.scale(x,y,z);return g;}
    case 'capsule':return new THREE.CapsuleGeometry(x,Math.max(0,y-2*x),seg(6),seg(16));
    case 'torus':return new THREE.TorusGeometry(x,y,seg(8),seg(28));
    case 'lathe':{const pts=(p.profile??[[0,0],[.05,0],[.05,.1],[0,.1]]).map(([r,h])=>new THREE.Vector2(Math.max(0,r*x),h*y));return new THREE.LatheGeometry(pts,seg(24));}
    case 'extrude':{
      const shape=new THREE.Shape((p.outline??[[0,0],[.1,0],[0,.1]]).map(([a,b])=>new THREE.Vector2(a*x,b*y))),b=Math.min(z*.45,.02)*p.bevel;
      for(const hole of p.holes??[])shape.holes.push(new THREE.Path(hole.map(([a,c])=>new THREE.Vector2(a*x,c*y))));
      const g=new THREE.ExtrudeGeometry(shape,{depth:Math.max(1e-3,z-2*b),bevelEnabled:b>1e-4,bevelThickness:b,bevelSize:b,bevelSegments:k>=1?2:1,curveSegments:seg(8)});g.translate(0,0,-z/2+b);return g;
    }
    case 'tube':{const pts=(p.path??[[0,0,0],[0,.1,0]]).map(v=>new THREE.Vector3(...v));return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),seg(Math.max(8,pts.length*6)),x,seg(8),false);}
  }
}
// Per-vertex grime like img2threejs' vertex paint: darker low down and in pseudo-random patches.
function paint(g:THREE.BufferGeometry,wear:number,seed:number){
  const p=g.getAttribute('position'),c=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),n=Math.sin(x*41+y*29+z*37+seed)*Math.sin(x*13-z*17+seed*.7);const v=1-wear*(.12+.22*Math.max(0,n));c[i*3]=v;c[i*3+1]=v*.99;c[i*3+2]=v*.97;}
  g.setAttribute('color',new THREE.BufferAttribute(c,3));
}
export function createObject(raw:ObjectSpec,options:{detail?:ObjectDetail}={}):ObjectModel{
  const spec=validateObjectSpec(raw),detail:ObjectDetail=options.detail==='low'?'low':'high',k=detail==='low'?.45:1;
  const root=new THREE.Group();root.name=spec.name;
  const nodes:Record<string,THREE.Object3D>={},sockets:Record<string,THREE.Object3D>={},geometries=new Set<THREE.BufferGeometry>(),materials=new Map<string,THREE.MeshStandardMaterial>();
  const material=(p:ObjectPart)=>{const key=[p.color,p.roughness,p.metalness].join();let m=materials.get(key);if(!m){m=new THREE.MeshStandardMaterial({color:p.color,roughness:p.roughness,metalness:p.metalness,vertexColors:true,flatShading:detail==='low'});materials.set(key,m);}return m;};
  spec.parts.forEach((p,index)=>{
    for(const mirrored of p.mirrorX?[false,true]:[false]){
      const g=partGeometry(p,k);paint(g,spec.wear,index*7.3);geometries.add(g);
      const mesh=new THREE.Mesh(g,material(p));mesh.name=p.name;mesh.userData.partId=p.id;mesh.castShadow=mesh.receiveShadow=true;
      mesh.position.set(...p.position);mesh.rotation.set(p.rotation[0]*D2R,p.rotation[1]*D2R,p.rotation[2]*D2R);
      if(mirrored){mesh.position.x*=-1;mesh.rotation.y*=-1;mesh.rotation.z*=-1;mesh.scale.x=-1;}
      root.add(mesh);nodes[p.id+(mirrored?'-mirror':'')]=mesh;
    }
  });
  for(const s of spec.sockets){const o=new THREE.Group();o.name='socket-'+s.name;o.position.set(...s.position);o.rotation.set(s.rotation[0]*D2R,s.rotation[1]*D2R,s.rotation[2]*D2R);root.add(o);sockets[s.name]=o;}
  let triangles=0,meshes=0;root.traverse(o=>{if((o as THREE.Mesh).isMesh){const g=(o as THREE.Mesh).geometry;triangles+=(g.index?.count??g.attributes.position.count)/3;meshes++;}});
  root.userData.objectSpec=spec;
  return {root,nodes,sockets,detail,stats:{triangles,meshes},update:()=>{},dispose(){geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());root.removeFromParent();}};
}

// Emit a standalone TypeScript factory, like img2threejs' generate_threejs_factory: plain Three.js
// calls per part, no runtime dependency on this editor and no asset files.
export function objectToTypeScript(raw:ObjectSpec):string{
  const spec=validateObjectSpec(raw),fn='create'+(spec.name.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/gi,' ').trim().split(/\s+/).map(w=>w[0].toUpperCase()+w.slice(1)).join('')||'Object')+'Model';
  const f=(n:number)=>+n.toFixed(4),arr=(a:number[])=>'['+a.map(f).join(',')+']',D=(v:number)=>f(v*D2R);
  const geo=(p:ObjectPart)=>{const [x,y,z]=p.size;switch(p.shape){
    case 'box':{const b=Math.min(x,y,z)*.5*p.bevel;return b>1e-4?`new RoundedBoxGeometry(${f(x)},${f(y)},${f(z)},2,${f(b)})`:`new THREE.BoxGeometry(${f(x)},${f(y)},${f(z)})`;}
    case 'cylinder':return `new THREE.CylinderGeometry(${f(x)},${f(z||x)},${f(y)},20)`;
    case 'cone':return `new THREE.CylinderGeometry(0,${f(x)},${f(y)},20)`;
    case 'sphere':return `new THREE.SphereGeometry(1,20,14).scale(${f(x)},${f(y)},${f(z)})`;
    case 'capsule':return `new THREE.CapsuleGeometry(${f(x)},${f(Math.max(0,y-2*x))},6,16)`;
    case 'torus':return `new THREE.TorusGeometry(${f(x)},${f(y)},8,28)`;
    case 'lathe':return `new THREE.LatheGeometry(${JSON.stringify(p.profile!.map(([r,h])=>[f(r*x),f(h*y)]))}.map(([r,h])=>new THREE.Vector2(r,h)),24)`;
    case 'extrude':{const b=Math.min(z*.45,.02)*p.bevel;return `extrude(${JSON.stringify(p.outline!.map(([a,c])=>[f(a*x),f(c*y)]))},${f(z)},${f(b)},${JSON.stringify((p.holes??[]).map(hole=>hole.map(([a,c])=>[f(a*x),f(c*y)])))})`;}
    case 'tube':return `new THREE.TubeGeometry(new THREE.CatmullRomCurve3(${JSON.stringify(p.path!.map(v=>v.map(f)))}.map(v=>new THREE.Vector3(...v))),${Math.max(8,p.path!.length*6)},${f(x)},8,false)`;
  }};
  const lines=[
    `// ${spec.name} — gerado pelo ABRIGO (aba Objetos). Só Three.js: sem modelos nem texturas.`,
    `import * as THREE from 'three';`,`import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';`,``,
    `function extrude(outline:[number,number][],depth:number,bevel:number,holes:[number,number][][]=[]){const shape=new THREE.Shape(outline.map(([x,y])=>new THREE.Vector2(x,y)));for(const h of holes)shape.holes.push(new THREE.Path(h.map(([x,y])=>new THREE.Vector2(x,y))));const g=new THREE.ExtrudeGeometry(shape,{depth:Math.max(1e-3,depth-2*bevel),bevelEnabled:bevel>1e-4,bevelThickness:bevel,bevelSize:bevel,bevelSegments:2});g.translate(0,0,-depth/2+bevel);return g;}`,``,
    `export function ${fn}(){`,
    `  const root=new THREE.Group();root.name=${JSON.stringify(spec.name)};`,
    `  const sockets:Record<string,THREE.Object3D>={};`,
    `  const part=(name:string,geometry:THREE.BufferGeometry,color:string,roughness:number,metalness:number,position:number[],rotation:number[],mirror=false)=>{`,
    `    for(const m of mirror?[1,-1]:[1]){const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,roughness,metalness}));mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;`,
    `      mesh.position.set(position[0]*m,position[1],position[2]);mesh.rotation.set(rotation[0],rotation[1]*m,rotation[2]*m);mesh.scale.x=m;root.add(mesh);}`,
    `  };`,
    ...spec.parts.map(p=>`  part(${JSON.stringify(p.name)},${geo(p)},'${p.color}',${f(p.roughness)},${f(p.metalness)},${arr(p.position)},[${D(p.rotation[0])},${D(p.rotation[1])},${D(p.rotation[2])}]${p.mirrorX?',true':''});`),
    ...spec.sockets.map(s=>`  {const s=new THREE.Group();s.name='socket-${s.name}';s.position.set(${s.position.map(f).join(',')});s.rotation.set(${s.rotation.map(D).join(',')});root.add(s);sockets[${JSON.stringify(s.name)}]=s;}`),
    `  return {root,sockets};`,`}`,``];
  return lines.join('\n');
}
