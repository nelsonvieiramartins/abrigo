import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {detailBuilder,type DetailContext} from './creature-detail-utils';
import {seededRandom} from './schema';
import type {CreatureSpec,CreatureMotion} from './creature-schema';

export function buildDetailedSwarm(s:CreatureSpec,c:DetailContext){
  const {mat,group,mesh,ell,tube,socket}=detailBuilder(c),rng=seededRandom(s.seed+':geometry'),bulk=.85+s.body.bulk*.3;
  const material=mat('#ffffff',.52),wingMat=mat('#ffffff',.35),prototype=new THREE.Group(),wingPrototype=new THREE.Group();
  const primary=new THREE.Color(s.appearance.primary),dark=new THREE.Color('#282a24'),wingColor=new THREE.Color(s.appearance.secondary).lerp(new THREE.Color('#d7d6b4'),.72);
  const tint=(o:THREE.Mesh,col:THREE.Color)=>{const a=o.geometry.attributes.color;for(let i=0;i<a.count;i++)a.setXYZ(i,col.r,col.g,col.b);return o;};
  tint(ell('abdomen',prototype,[0,0,-.033],[.024,.022,.045],material,6),primary);
  const abdomen=(prototype.children[0] as THREE.Mesh).geometry;
  for(let i=0;i<abdomen.attributes.position.count;i++){const z=abdomen.attributes.position.getZ(i),band=Math.sin((z+.075)*180)>0;const col=primary.clone().lerp(dark,band?s.appearance.markings*.95:0);abdomen.attributes.color.setXYZ(i,col.r,col.g,col.b);}
  tint(ell('thorax',prototype,[0,0,.019],[.023,.022,.025],material,6),dark);
  tint(ell('waist',prototype,[0,0,-.01],[.010,.011,.019],material,6),primary);
  tint(ell('head',prototype,[0,.004,.057],[.025,.022,.021],material,6),primary);
  for(const side of [-1,1]){
    tint(ell('compound-eye',prototype,[side*.018,.010,.066],[.011,.014,.012],material,6),dark);
    tint(tube('antenna',prototype,[[side*.012,.017,.065],[side*.021,.043,.082],[side*.03,.05,.106]],.0028,.001,material,4,4),dark);
    tint(tube('mandible',prototype,[[side*.009,-.005,.071],[side*.01,-.013,.088],[side*.003,-.012,.09]],.004,.001,material,2,4),dark);
    for(let i=0;i<3;i++){const z=.028-i*.02;tint(tube('segmented-leg',prototype,[[side*.016,-.01,z],[side*.032,-.026,z-.008],[side*.04,-.043,z-.02]],.0035,.0015,material,3,4),dark);}
  }
  tint(tube('stinger',prototype,[[0,0,-.066],[0,-.006,-.096]],.006,.0005,material,3,4),dark);
  const wing=(name:string,outline:number[][])=>{
    const g=new THREE.BufferGeometry(),positions=outline.flat(),idx:number[]=[];for(let i=1;i<outline.length-1;i++)idx.push(0,i,i+1);
    g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(idx);g.computeVertexNormals();tint(mesh(name,g,wingMat,wingPrototype),wingColor);
  };
  wing('forewing',[[.006,.017,.016],[.029,.019,.05],[.071,.020,.043],[.085,.017,.021],[.069,.016,.004],[.023,.016,-.002]]);
  wing('hindwing',[[.006,.017,-.006],[.030,.018,.001],[.061,.019,-.017],[.055,.017,-.037],[.025,.016,-.041],[.008,.016,-.026]]);
  tint(tube('wing-vein',wingPrototype,[[.009,.019,.01],[.033,.020,.022],[.069,.022,.03]],.0012,.0005,wingMat,3,3),new THREE.Color('#858875'));
  const combine=(parent:THREE.Group)=>{
    const parts=parent.children as THREE.Mesh[],g=mergeGeometries(parts.map(o=>o.geometry),false);if(!g)throw new Error('Falha ao gerar vespa.');
    parts.forEach(o=>{c.geometries.delete(o.geometry);o.geometry.dispose();});c.geometries.add(g);return g;
  };
  const bodyGeo=combine(prototype),wingGeo=combine(wingPrototype),leftGeo=wingGeo.clone();leftGeo.scale(-1,1,1);c.geometries.add(leftGeo);
  const useInstances=c.instancing!==false,instances:THREE.InstancedMesh[]=[];
  if(useInstances)for(const [name,g,m] of [['insect-bodies',bodyGeo,material],['left-wings',leftGeo,wingMat],['right-wings',wingGeo,wingMat]] as const){
    const o=new THREE.InstancedMesh(g,m,s.anatomy.count);o.name=name;o.castShadow=true;o.receiveShadow=true;o.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const r=s.anatomy.spread+.2;o.boundingBox=new THREE.Box3(new THREE.Vector3(-r,.18,-r),new THREE.Vector3(r,1.5,r));o.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,.84,0),Math.hypot(r,.7));c.body.add(o);instances.push(o);
  }
  const insects:Array<{node:THREE.Group;phase:number;radius:number;altitude:number;wings:THREE.Group[]}>=[];
  for(let i=0;i<s.anatomy.count;i++){
    const node=group('insect-'+i,c.body),size=(.8+rng()*.4)*bulk;node.scale.setScalar(size);
    const wings:THREE.Group[]=[];
    if(!useInstances){mesh('wasp-body',bodyGeo,material,node);for(const [id,g] of [['L',leftGeo],['R',wingGeo]] as const){const w=group('insect-'+i+'-wing'+id,node);mesh('wing-pair',g,wingMat,w);wings.push(w);}}
    insects.push({node,phase:rng()*Math.PI*2,radius:(.2+Math.sqrt(rng())*.75)*s.anatomy.spread,altitude:.4+rng()*.9,wings});
  }
  socket('target',c.body,[0,.85,0]);socket('origin',c.body,[0,.85,0]);
  const rotation=new THREE.Matrix4(),matrix=new THREE.Matrix4();
  return (t:number,m:CreatureMotion)=>{
    insects.forEach((it,i)=>{const angle=it.phase+t*(m==='move'?2:1),r=it.radius*(m==='attack'?.55:1),flap=Math.sin(t*45+i)*.75;
      it.node.position.set(Math.cos(angle)*r,it.altitude+Math.sin(t*3+it.phase)*.1,Math.sin(angle)*r);it.node.rotation.set(Math.sin(t*4+it.phase)*.10,-angle,Math.sin(t*2+it.phase)*.13);it.node.updateMatrix();
      if(useInstances){instances[0].setMatrixAt(i,it.node.matrix);for(let j=1;j<=2;j++){rotation.makeRotationZ(j===1?-flap:flap);matrix.multiplyMatrices(it.node.matrix,rotation);instances[j].setMatrixAt(i,matrix);}}
      else it.wings.forEach((w,j)=>w.rotation.z=j===0?-flap:flap);
    });
    instances.forEach(o=>o.instanceMatrix.needsUpdate=true);
  };
}
