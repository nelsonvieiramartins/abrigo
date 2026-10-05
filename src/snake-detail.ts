import * as THREE from 'three';
import {detailBuilder,type DetailContext} from './creature-detail-utils';
import {seededRandom} from './schema';
import type {CreatureSpec,CreatureMotion} from './creature-schema';
import {createSnakeAttackClock} from './snake-attack';

export function buildDetailedSnake(s:CreatureSpec,c:DetailContext){
  const {mat,group,mesh,ell,tube,socket,batch}=detailBuilder(c),body=c.body;
  const length=1.9*s.anatomy.length,radius=.065*s.anatomy.thickness*(.85+s.body.bulk*.3),rows=144,sides=32,phase=seededRandom(s.seed+':geometry')()*Math.PI*2;
  const skin=mat(s.appearance.primary,.53),belly=mat(s.appearance.secondary,.7),black=mat('#252b22',.35),eye=mat(s.appearance.eyes,.16),ivory=mat('#dfdac2',.25),pink=mat('#975b59',.55),bodyMat=mat('#ffffff',.58);
  const positions=new Float32Array((rows+1)*(sides+1)*3),colors=new Float32Array(positions.length),indices:number[]=[],a=new THREE.Color(s.appearance.primary),b=new THREE.Color(s.appearance.secondary);
  for(let i=0;i<=rows;i++)for(let j=0;j<=sides;j++){
    const u=i/rows,angle=j/sides*Math.PI*2,underside=Math.cos(angle)<-.38,diamond=Math.cos(u*Math.PI*24+Math.cos(angle)*2.8);
    const color=underside?b.clone():a.clone().lerp(b,Math.max(0,diamond)*s.appearance.markings*.7);
    const scaleShade=.90+.10*Math.pow(Math.abs(Math.cos(u*Math.PI*64+(j%2)*Math.PI*.5)),.5);color.multiplyScalar(scaleShade);color.toArray(colors,(i*(sides+1)+j)*3);
    if(i<rows&&j<sides){const k=i*(sides+1)+j,n=k+sides+1;indices.push(k,n,k+1,k+1,n,n+1);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3));geo.setAttribute('color',new THREE.BufferAttribute(colors,3));geo.setIndex(indices);
  const surface=mesh('scaled-continuous-body',geo,bodyMat,body);surface.userData.dynamic=true;
  const head=group('head',body),factor=radius/.065;head.scale.setScalar(factor);
  ell('head-cranium',head,[0,.007,.024],[.09,.047,.126],skin,28);
  ell('snout',head,[0,.002,.117],[.065,.032,.068],skin,24);
  for(const side of [-1,1]){
    ell('jaw-muscle',head,[side*.059,-.002,-.001],[.041,.044,.078],skin,20);
    ell('brow-shield',head,[side*.068,.034,.064],[.039,.02,.045],skin,20);
    const e=group('eye'+(side>0?'L':'R'),head,[side*.079,.02,.079]);e.rotation.y=side*.86;
    ell('eye-rim',e,[0,0,0],[.024,.021,.012],black,18);ell('iris',e,[0,0,.009],[.019,.018,.009],eye,20);ell('slit-pupil',e,[0,0,.017],[.0035,.014,.004],black,16);ell('eye-glint',e,[-.005,.006,.02],[.003,.003,.0015],ivory,8);
    ell('nostril',head,[side*.047,.018,.16],[.009,.005,.005],black,12);
    ell('heat-pit',head,[side*.066,.001,.123],[.009,.007,.006],black,12);
    tube('upper-lip',head,[[side*.072,-.025,.017],[side*.076,-.025,.088],[side*.044,-.018,.165]],.0035,.002,black,20,8);
  }
  // Flattened overlapping head shields add a readable scale structure without separate textures.
  for(let row=0;row<3;row++)for(let col=-1;col<=1;col++){
    const z=.003+row*.04,x=col*(.034-row*.003),y=.046-Math.abs(col)*.004;
    ell('crown-scale',head,[x,y,z],[.026-row*.002,.005,.027],skin,12);
  }
  const jaw=group('jaw',head,[0,-.025,.015]);ell('lower-jaw',jaw,[0,-.007,.066],[.067,.019,.11],belly,24);ell('mouth-floor',jaw,[0,.009,.063],[.055,.006,.086],pink,20);
  for(const side of [-1,1]){
    const fang=group('fang'+(side>0?'L':'R'),head,[side*.043,-.018,.112]);
    tube('curved-fang',fang,[[0,0,0],[0,-.037,.012],[0,-.068,.024]],.012,.001,ivory,18,12);
  }
  const tongue=group('tongue',jaw,[0,.01,.145]);tube('tongue-stem',tongue,[[0,0,0],[0,0,.07]],.005,.003,pink,12,8);
  for(const side of [-1,1])tube('tongue-fork',tongue,[[0,0,.07],[side*.012,0,.095],[side*.021,0,.116]],.003,.0008,pink,12,8);
  socket('head',head);socket('mouth',jaw,[0,0,.16]);socket('target',head);batch(body);
  const attackClock=createSnakeAttackClock();let attack:ReturnType<typeof attackClock>=null;
  const center=(u:number,t:number,m:CreatureMotion,target:THREE.Vector3)=>{
    const cycle=u*Math.PI*3-(attack?0:t*(m==='move'?4:1))+phase,raise=attack?.wind??0;
    return target.set(Math.sin(cycle)*.16*(1+raise*.8)*Math.sin(u*Math.PI),radius+Math.pow(1-u,4)*(raise*.22+(attack?.thrust??0)*.10),length*(.5-u)*(1-raise*.22));
  };
  const p=new THREE.Vector3(),next=new THREE.Vector3(),tangent=new THREE.Vector3(),normal=new THREE.Vector3(),up=new THREE.Vector3(),worldUp=new THREE.Vector3(0,1,0);
  const update=(t:number,m:CreatureMotion)=>{
    attack=attackClock(t,m);body.position.set(0,attack?.lift??0,attack?.advance??0);
    for(let i=0;i<=rows;i++){
      const u=i/rows;center(u,t,m,p);center(Math.min(1,u+.001),t,m,next);if(i===rows){center(u-.001,t,m,next);tangent.subVectors(p,next);}else tangent.subVectors(next,p);tangent.normalize();
      normal.crossVectors(worldUp,tangent).normalize();up.crossVectors(tangent,normal).normalize();
      const r=radius*(1-.99*Math.pow(u,3));
      for(let j=0;j<=sides;j++){
        const angle=j/sides*Math.PI*2,underside=Math.cos(angle)<-.38;
        const relief=underside?1+.022*Math.cos(u*Math.PI*90):1+.035*Math.pow(Math.abs(Math.sin(u*Math.PI*64+Math.sin(angle*8)*.6)),6);
        const lateral=Math.sin(angle)*r*relief,vertical=Math.cos(angle)*r*relief,k=(i*(sides+1)+j)*3;
        positions[k]=p.x+normal.x*lateral+up.x*vertical;positions[k+1]=p.y+up.y*vertical;positions[k+2]=p.z+normal.z*lateral+up.z*vertical;
      }
    }
    geo.attributes.position.needsUpdate=true;geo.computeVertexNormals();const normals=geo.attributes.normal;
    for(let i=0;i<=rows;i++){const a=i*(sides+1),b=a+sides;normal.fromBufferAttribute(normals,a);up.fromBufferAttribute(normals,b);normal.add(up).normalize();normals.setXYZ(a,normal.x,normal.y,normal.z);normals.setXYZ(b,normal.x,normal.y,normal.z);}
    geo.computeBoundingSphere();geo.computeBoundingBox();center(0,t,m,head.position);center(.01,t,m,next);tangent.subVectors(head.position,next);head.rotation.set(-Math.atan2(tangent.y,Math.hypot(tangent.x,tangent.z)),Math.atan2(tangent.x,tangent.z),0);
    const bite=attack?.bite??0;jaw.rotation.x=bite*.85;
    for(const side of ['L','R'])c.nodes['fang'+side].rotation.x=-(1-bite)*1.05;
    tongue.scale.z=attack?.12:.12+Math.pow(Math.max(0,Math.sin(t*5+phase)),4)*.88;
  };
  return update;
}
