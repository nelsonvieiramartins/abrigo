import * as THREE from 'three';
import {seededRandom} from './schema';
import {buildDetailedRat} from './rat-detail';
import {buildDetailedSkeleton} from './skeleton-detail';
import {buildFacetedWolf} from './wolf-simple';
import {buildDetailedWolf} from './wolf-detail';
import {wolfGait} from './wolf-gait';
import {buildDetailedBat} from './bat-detail';
import {buildDetailedSwarm} from './swarm-detail';
import {buildDetailedSnake} from './snake-detail';
import {buildDetailedScorpion} from './scorpion-detail';
import {buildDetailedSpider} from './spider-detail';
import {buildWerewolf} from './werewolf';
import {validateCreatureSpec,type CreatureSpec,type CreatureMotion,type CreatureDetail} from './creature-schema';

export interface CreatureModel {
  root:THREE.Group; nodes:Record<string,THREE.Object3D>; sockets:Record<string,THREE.Object3D>;
  detail:CreatureDetail; stats:{triangles:number;meshes:number};
  update:(time:number,motion?:CreatureMotion)=>void; dispose:()=>void;
}
// All models face +Z, use metres and leave world movement to the host game.
export function createCreature(raw:CreatureSpec,options:{detail?:CreatureDetail;instancing?:boolean}={}):CreatureModel {
  const spec=validateCreatureSpec(raw),detail=options.detail??'high';
  if(detail!=='low'&&detail!=='high')throw new Error('Detalhe de criatura inválido.');
  const root=new THREE.Group(),nodes:Record<string,THREE.Object3D>={},sockets:Record<string,THREE.Object3D>={};
  root.name=spec.name;root.scale.setScalar(spec.body.scale);root.userData.creatureSpec=spec;root.userData.rig={kind:'procedural-creature',species:spec.species};
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),rng=seededRandom(spec.seed+':geometry'),segments=detail==='low'?8:16;
  const material=(color:string)=>{const m=new THREE.MeshStandardMaterial({color,roughness:.85,flatShading:detail==='low',side:THREE.DoubleSide});materials.add(m);return m;};
  const fur=material(spec.appearance.primary),light=material(spec.appearance.secondary),dark=material('#202523'),eye=material(spec.appearance.eyes),ivory=material('#e0d7b9');
  const mark=material(new THREE.Color(spec.appearance.primary).lerp(new THREE.Color(spec.appearance.secondary),spec.appearance.markings).getStyle());
  const group=(name:string,parent:THREE.Object3D,pos:number[])=>{const g=new THREE.Group();g.name=name;g.position.set(pos[0],pos[1],pos[2]);parent.add(g);nodes[name]=g;return g;};
  const mesh=(name:string,g:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Object3D,pos=[0,0,0])=>{geometries.add(g);const o=new THREE.Mesh(g,m);o.name=name;o.position.set(pos[0],pos[1],pos[2]);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
  const ell=(name:string,parent:THREE.Object3D,pos:number[],size:number[],m=fur)=>{const o=mesh(name,new THREE.SphereGeometry(1,segments,Math.max(6,segments/2)),m,parent,pos);o.scale.set(size[0],size[1],size[2]);return o;};
  const link=(name:string,parent:THREE.Object3D,a:number[],b:number[],r1:number,r2:number,m=fur)=>{const v=new THREE.Vector3(...b as [number,number,number]).sub(new THREE.Vector3(...a as [number,number,number]));const o=mesh(name,new THREE.CylinderGeometry(r2,r1,v.length(),segments),m,parent,a.map((x,i)=>(x+b[i])/2));o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());return o;};
  const socket=(name:string,parent:THREE.Object3D,pos=[0,0,0])=>sockets[name]=group('socket-'+name,parent,pos);
  const body=group('body',root,[0,0,0]),bulk=.85+spec.body.bulk*.3;
  let animate=(t:number,m:CreatureMotion)=>{};
  if(spec.species==='rat'){
    animate=buildDetailedRat(spec,{body,nodes,sockets,geometries,materials},detail);
  }else if(spec.species==='skeleton'){
    animate=buildDetailedSkeleton(spec,{body,nodes,sockets,geometries,materials},detail);
  }else if(spec.species==='wolf'&&spec.wolf){
    animate=buildFacetedWolf(spec,{body,nodes,sockets,geometries,materials},detail);
  }else if(spec.species==='scorpion'){
    animate=buildDetailedScorpion(spec,{body,nodes,sockets,geometries,materials},detail);
  }else if(spec.species==='spider'){
    animate=buildDetailedSpider(spec,{body,nodes,sockets,geometries,materials},detail);
  }else if(spec.species==='werewolf'){
    animate=buildWerewolf(spec,{body,nodes,sockets,geometries,materials},detail);
  }else if(spec.species==='wolf'&&detail==='high'){
    animate=buildDetailedWolf(spec,{body,nodes,sockets,geometries,materials});
  }else if(detail==='high'){
    const context={body,nodes,sockets,geometries,materials,instancing:options.instancing};
    animate=spec.species==='bat'?buildDetailedBat(spec,context):spec.species==='swarm'?buildDetailedSwarm(spec,context):buildDetailedSnake(spec,context);
  }else if(spec.species==='wolf'){
    const h=.62*spec.anatomy.legs;
    ell('torso',body,[0,h+.12,0],[.23*bulk,.28*bulk,.55]);
    ell('chest',body,[0,h+.14,.3],[.25*bulk,.31*bulk,.28],mark);
    ell('belly',body,[0,h-.035,.02],[.19*bulk,.19,.42],light);
    const head=group('head',body,[0,h+.43,.46]);head.rotation.x=-.12;
    ell('skull',head,[0,0,.025],[.19,.2,.23]);ell('muzzle',head,[0,-.07,.23],[.115,.09,.21],light);
    ell('nose',head,[0,-.025,.405],[.075,.052,.04],dark);
    const jaw=group('jaw',head,[0,-.09,.10]);ell('jaw-shape',jaw,[0,-.033,.12],[.095,.043,.17],light);
    for(const side of [-1,1]){
      ell('eye',head,[side*.151,.045,.155],[.031,.027,.026],eye);
      ell('pupil',head,[side*.153,.046,.177],[.012,.019,.009],dark);
      const e=mesh('ear',new THREE.ConeGeometry(.1,.27*spec.anatomy.ears,4),fur,head,[side*.125,.21,0]);e.rotation.z=-side*.16;
      const inner=mesh('inner-ear',new THREE.ConeGeometry(.058,.17*spec.anatomy.ears,3),light,head,[side*.125,.215,.048]);inner.rotation.z=-side*.16;
      for(const z of [.14,.27])mesh('fang',new THREE.ConeGeometry(.017,.05,6),ivory,jaw,[side*.07,.016,z]);
      for(let i=0;i<4;i++){const tuft=mesh('ruff',new THREE.ConeGeometry(.08,.2,5),mark,body,[side*(.18+i*.01),h+.22-i*.055,.28]);tuft.rotation.z=side*2.05;}
    }
    const legs:THREE.Group[]=[];
    for(const rear of [false,true])for(const side of [-1,1]){
      const leg=group((rear?'hind':'front')+(side===1?'L':'R'),body,[side*.17,h,rear?-.37:.32]);legs.push(leg);
      const knee=rear?[0,-h*.53,-.085]:[0,-h*.52,.02];
      link('upper-leg',leg,[0,0,0],knee,rear?.115:.075,.052);
      link('lower-leg',leg,knee,[0,-h+.075,0],.052,.035,light);
      ell('paw',leg,[0,-h+.055,.045],[.065,.055,.105],dark);
    }
    const tail=group('tail',body,[0,h+.17,-.47]);
    link('tail-base',tail,[0,0,0],[0,-.18,-.28*spec.anatomy.tail],.095,.08);
    link('tail-tip',tail,[0,-.18,-.28*spec.anatomy.tail],[0,-.32,-.55*spec.anatomy.tail],.08,.012,mark);
    socket('head',head);socket('mouth',jaw,[0,0,.3]);socket('back',body,[0,h+.4,0]);socket('target',body,[0,h+.1,0]);
    animate=(t,m)=>{const gait=wolfGait(t,m,h),a=m==='attack'?(Math.sin(t*5)+1)/2:0;
      body.position.y=gait.active?gait.lift:Math.sin(t*2)*.008;body.rotation.x=-a*.12;
      legs.forEach((l,i)=>{const foot=gait.feet[i],angle=gait.active?-Math.atan2(foot.z,h-.055):0;l.rotation.x=angle;l.position.y=h+(gait.active?foot.lift-gait.lift+(h-.055)*(Math.cos(angle)-1):0);});
      head.rotation.x=-.12-a*.22;tail.rotation.y=Math.sin(t*2.5)*.16;jaw.rotation.x=a*.5;
    };
  }else if(spec.species==='bat'){
    body.position.y=.95;ell('torso',body,[0,0,0],[.08*bulk,.16,.075]);ell('chest',body,[0,0,.045],[.055,.12,.04],light);
    const head=group('head',body,[0,.13,.015]);ell('skull',head,[0,0,0],[.065,.06,.058]);
    const wings:THREE.Group[]=[];
    for(const side of [-1,1]){
      ell('ear',head,[side*.036,.07,-.004],[.018,.045*spec.anatomy.ears,.012],fur);
      ell('inner-ear',head,[side*.036,.07,.006],[.01,.032*spec.anatomy.ears,.004],light);
      ell('eye',head,[side*.028,.008,.05],[.009,.01,.006],eye);
      ell('nostril',head,[side*.01,-.02,.062],[.006,.005,.005],dark);
      const wing=group('wing'+(side===1?'L':'R'),body,[side*.07,.08,0]);wings.push(wing);
      const outline=[[0,0,0],[.29,.14,-.04],[.77,.22,-.02],[1.02,-.02,0],[.76,-.09,.02],[.66,-.27,.025],[.47,-.20,.025],[.31,-.42,.025],[.16,-.30,.02],[0,-.35,0]];
      const vertices:number[]=[];for(let i=1;i<outline.length-1;i++)for(const p of [outline[0],outline[i],outline[i+1]])vertices.push(p[0]*side*spec.anatomy.wingspan,p[1],p[2]);
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.computeVertexNormals();mesh('membrane',geo,mark,wing);
      for(const i of [3,5,7,9])link('wing-finger',wing,[0,0,0],[outline[i][0]*side*spec.anatomy.wingspan,outline[i][1],outline[i][2]+.005],.012,.004,fur);
      link('leading-edge',wing,[0,0,0],[.29*side*spec.anatomy.wingspan,.14,-.04],.025,.018);
      link('leading-tip',wing,[.29*side*spec.anatomy.wingspan,.14,-.04],[1.02*side*spec.anatomy.wingspan,-.02,0],.018,.004);
      link('foot',body,[side*.07,-.19,0],[side*.105,-.31,.025],.025,.013,dark);
    }
    socket('head',head);socket('mouth',head,[0,-.07,.11]);socket('back',body,[0,0,-.12]);socket('target',body);
    animate=(t,m)=>{const flap=Math.sin(t*(m==='move'?13:9))*.65;wings.forEach((w,i)=>w.rotation.z=(i===0?-1:1)*flap);body.position.y=1.3+Math.sin(t*3)*.065;body.rotation.x=m==='attack'?Math.sin(t*5)*.45:0;};
  }else if(spec.species==='swarm'){
    const insects:Array<{group:THREE.Group;wings:THREE.Object3D[];phase:number;radius:number;altitude:number}>=[];
    // Shared geometry and materials keep the editable swarm inexpensive and SVG-compatible.
    const insectGeo=new THREE.SphereGeometry(1,detail==='low'?4:6,detail==='low'?3:4),wingGeo=new THREE.SphereGeometry(1,detail==='low'?4:6,3);geometries.add(insectGeo);geometries.add(wingGeo);
    for(let i=0;i<spec.anatomy.count;i++){
      const g=group('insect-'+i,body,[0,0,0]),size=(.8+rng()*.4)*bulk;
      const abdomen=mesh('abdomen',insectGeo,fur,g);abdomen.scale.set(.024*size,.022*size,.049*size);
      const stripe=mesh('stripe',insectGeo,mark,g,[0,0,.015]);stripe.scale.set(.025*size,.023*size,.012*size);
      const head=mesh('head',insectGeo,dark,g,[0,0,.055*size]);head.scale.setScalar(.02*size);
      const wings=[];for(const side of [-1,1]){const w=mesh('wing',wingGeo,light,g,[side*.04*size,.016,0]);w.scale.set(.048*size,.003,.021*size);wings.push(w);}
      insects.push({group:g,wings,phase:rng()*Math.PI*2,radius:(.2+Math.sqrt(rng())*.75)*spec.anatomy.spread,altitude:.4+rng()*.9});
    }
    socket('target',body,[0,.85,0]);socket('origin',body,[0,.85,0]);
    animate=(t,m)=>insects.forEach((it,i)=>{const angle=it.phase+t*(m==='move'?2:1),r=it.radius*(m==='attack'?.55:1);it.group.position.set(Math.cos(angle)*r,it.altitude+Math.sin(t*3+it.phase)*.1,Math.sin(angle)*r);it.group.rotation.y=-angle;it.wings.forEach((w,j)=>w.rotation.z=Math.sin(t*45+i)*.6*(j?1:-1));});
  }else{
    const length=1.9*spec.anatomy.length,radius=.065*spec.anatomy.thickness*bulk,rows=detail==='low'?32:64,sides=detail==='low'?8:12;
    const positions=new Float32Array((rows+1)*(sides+1)*3),colors=new Float32Array(positions.length),indices:number[]=[];
    const c1=new THREE.Color(spec.appearance.primary),c2=new THREE.Color(spec.appearance.secondary),phase=rng()*Math.PI*2;
    for(let i=0;i<=rows;i++)for(let j=0;j<=sides;j++){const k=(i*(sides+1)+j)*3,c=Math.cos(j/sides*Math.PI*2)<-.25?c2:c1.clone().lerp(c2,(Math.floor(i/3)%2)*spec.appearance.markings*.7);c.toArray(colors,k);if(i<rows&&j<sides){const a=i*(sides+1)+j,b=a+sides+1;indices.push(a,b,a+1,b,b+1,a+1);}}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3));geo.setAttribute('color',new THREE.BufferAttribute(colors,3));geo.setIndex(indices);
    const skin=material('#ffffff');skin.vertexColors=true;mesh('continuous-body',geo,skin,body);
    const head=group('head',body,[0,radius,.85]);ell('head-shape',head,[0,0,.03],[radius*1.6,radius*.85,.13]);
    for(const side of [-1,1]){ell('eye',head,[side*radius*1.17,radius*.35,.085],[.014,.012,.012],eye);ell('pupil',head,[side*radius*1.2,radius*.36,.094],[.004,.009,.005],dark);}
    const tongue=group('tongue',head,[0,-radius*.2,.14]);link('tongue',tongue,[0,0,0],[0,0,.08],.005,.003,light);for(const side of [-1,1])link('fork',tongue,[0,0,.08],[side*.018,0,.12],.003,.001,light);
    socket('head',head);socket('mouth',head,[0,0,.14]);socket('target',head);
    const point=(u:number,t:number,m:CreatureMotion)=>new THREE.Vector3(Math.sin(u*Math.PI*3-t*(m==='move'?4:1)+phase)*.16*Math.sin(u*Math.PI),radius+(m==='attack'?Math.pow(1-u,4)*.32*(.5+.5*Math.sin(t*5)):0),length*(.5-u));
    animate=(t,m)=>{for(let i=0;i<=rows;i++){const u=i/rows,p=point(u,t,m),r=radius*(1-.96*Math.pow(u,3));for(let j=0;j<=sides;j++){const a=j/sides*Math.PI*2,k=(i*(sides+1)+j)*3;positions[k]=p.x+Math.sin(a)*r;positions[k+1]=p.y+Math.cos(a)*r;positions[k+2]=p.z;}}geo.attributes.position.needsUpdate=true;geo.computeVertexNormals();geo.computeBoundingSphere();head.position.copy(point(0,t,m));const dir=point(0,t,m).sub(point(.02,t,m));head.rotation.y=Math.atan2(dir.x,dir.z);tongue.scale.z=.6+Math.max(0,Math.sin(t*6))*.6;};
  }
  const update=(time:number,motion:CreatureMotion='idle')=>{if(!Number.isFinite(time)||!['idle','move','run','runPlus','attack'].includes(motion))throw new Error('Tempo ou movimento de criatura inválido.');if(motion==='run'&&!['wolf','werewolf','spider','scorpion','skeleton','rat'].includes(spec.species))throw new Error('Corrida disponível apenas para lobos, lobisomens, aranhas, escorpiões, esqueletos e ratos.');if(motion==='runPlus'&&spec.species!=='rat')throw new Error('CORRER+ disponível apenas para ratos.');animate(time,motion);};
  update(0);let triangles=0,meshes=0;root.traverse((o:any)=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);}});
  let disposed=false;
  return {root,nodes,sockets,detail,stats:{triangles,meshes},update,dispose(){if(disposed)return;disposed=true;root.traverse(o=>{if(o instanceof THREE.InstancedMesh)o.dispose();});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());root.removeFromParent();}};
}
