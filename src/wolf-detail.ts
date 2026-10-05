import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {seededRandom} from './schema';
import type {CreatureSpec,CreatureMotion} from './creature-schema';
import {wolfGait} from './wolf-gait';
import {createWolfAttackClock} from './wolf-attack';

type WolfContext={body:THREE.Group;nodes:Record<string,THREE.Object3D>;sockets:Record<string,THREE.Object3D>;geometries:Set<THREE.BufferGeometry>;materials:Set<THREE.Material>};
type Station=[number,number,number,number,number];

// Reference sculpt: broad triangular planes, inset features and layered, solid fur locks.
// Static details are batched per joint/material; the transform hierarchy stays editable.
export function buildDetailedWolf(spec:CreatureSpec,c:WolfContext){
  const {body,nodes,sockets,geometries,materials}=c,h=.62*spec.anatomy.legs,bulk=.85+spec.body.bulk*.3;
  const random=seededRandom(spec.seed+':wolf-detail'),phase=random()*Math.PI*2;
  const mat=(color:string,roughness=.88,flatShading=true)=>{const m=new THREE.MeshStandardMaterial({color,roughness,vertexColors:true,flatShading});materials.add(m);return m;};
  const fur=mat(spec.appearance.primary,.88,false),cream=mat(spec.appearance.secondary),black=mat('#181a16',.73,false),iris=mat(spec.appearance.eyes,.32,false),tooth=mat('#e4dfc5',.6),inner=mat('#a77768'),shine=mat('#fff5db',.15,false);
  const throat=mat(new THREE.Color(spec.appearance.primary).lerp(new THREE.Color(spec.appearance.secondary),.65).getStyle());
  const faceFur=mat(spec.appearance.primary,.9,false);
  const group=(name:string,parent:THREE.Object3D,pos=[0,0,0])=>{const g=new THREE.Group();g.name=name;g.position.fromArray(pos);parent.add(g);nodes[name]=g;return g;};
  const skin=(name:string,geo:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Object3D)=>{
    const p=geo.getAttribute('position'),colors:number[]=[];
    for(let i=0;i<p.count;i++){const v=.96+.035*Math.sin(p.getX(i)*43+p.getY(i)*31+p.getZ(i)*27+phase);colors.push(v,v,v);}
    geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.deleteAttribute('uv');geometries.add(geo);
    const o=new THREE.Mesh(geo,m);o.name=name;o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;
  };
  const ell=(name:string,parent:THREE.Object3D,pos:number[],size:number[],m=fur,res=20,round=false)=>{
    let g:THREE.BufferGeometry=m.flatShading&&!round?new THREE.IcosahedronGeometry(1,res>=20?2:1):new THREE.SphereGeometry(1,res,Math.round(res*.6));
    // All inputs to the static batching pass have the same indexed layout.
    if(!g.index)g.setIndex(Array.from({length:g.attributes.position.count},(_,i)=>i));
    g.scale(size[0],size[1],size[2]);g.translate(pos[0],pos[1],pos[2]);return skin(name,g,m,parent);
  };
  const tube=(name:string,parent:THREE.Object3D,rows:Station[],m=fur,steps=28,radial=20)=>{
    const curve=new THREE.CatmullRomCurve3(rows.map(p=>new THREE.Vector3(p[0],p[1],p[2])));
    const radii=new THREE.CatmullRomCurve3(rows.map(p=>new THREE.Vector3(p[3],p[4],0)),false,'catmullrom',.25);
    const points:number[]=[],indices:number[]=[],normal=new THREE.Vector3(),binormal=new THREE.Vector3(),axis=new THREE.Vector3(1,0,0);
    for(let i=0;i<=steps;i++){
      const t=i/steps,p=curve.getPoint(t),v=curve.getTangent(t),r=radii.getPoint(t);
      normal.copy(axis).addScaledVector(v,-axis.dot(v)).normalize();binormal.crossVectors(v,normal).normalize();
      for(let j=0;j<=radial;j++){
        const a=j/radial*Math.PI*2,q=p.clone().addScaledVector(normal,Math.cos(a)*Math.max(.001,r.x)).addScaledVector(binormal,Math.sin(a)*Math.max(.001,r.y));points.push(q.x,q.y,q.z);
        if(i<steps&&j<radial){const k=i*(radial+1)+j,n=k+radial+1;indices.push(k,k+1,n,k+1,n+1,n);}
      }
    }
    // Closed end caps; joint profiles terminate inside overlapping anatomical volumes.
    for(const end of [0,steps]){const p=curve.getPoint(end/steps),center=points.length/3;points.push(p.x,p.y,p.z);for(let j=0;j<radial;j++){const k=end*(radial+1)+j;indices.push(center,end===0?k+1:k,end===0?k:k+1);}}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));geo.setIndex(indices);geo.computeVertexNormals();
    const n=geo.getAttribute('normal');for(let i=0;i<=steps;i++){const a=i*(radial+1),b=a+radial,v=new THREE.Vector3().fromBufferAttribute(n,a).add(new THREE.Vector3().fromBufferAttribute(n,b)).normalize();n.setXYZ(a,v.x,v.y,v.z);n.setXYZ(b,v.x,v.y,v.z);}
    return skin(name,geo,m,parent);
  };
  const socket=(name:string,parent:THREE.Object3D,pos=[0,0,0])=>sockets[name]=group('socket-'+name,parent,pos);

  // Rounded sweeps retain the anatomical profile without rectangular leg corners.
  const limb=(name:string,parent:THREE.Object3D,rows:Station[])=>{
    return tube(name,parent,rows,fur,rows.length>2?12:6,16);
  };

  // Closed leaf-shaped wedge with a raised ridge: a sculpted lock, not a round cone.
  const lock=(name:string,parent:THREE.Object3D,start:number[],end:number[],width:number,depth:number,m=fur,out=[0,0,1])=>{
    const a=new THREE.Vector3().fromArray(start),b=new THREE.Vector3().fromArray(end),axis=b.clone().sub(a),n=new THREE.Vector3().fromArray(out).normalize();
    const across=new THREE.Vector3().crossVectors(axis,n).normalize(),vertices:number[]=[],indices:number[]=[];
    const outline=name.startsWith('chest-bib')?[[-1,0],[1,0],[.92,.26],[.65,.68],[0,1],[-.65,.68],[-.92,.26]]:[[-.62,0],[.62,0],[1,.30],[.68,.62],[0,1],[-.68,.62],[-1,.30]];
    for(const back of [false,true])for(const [x,t] of outline){const p=a.clone().addScaledVector(axis,t).addScaledVector(across,x*width).addScaledVector(n,back?-depth*.65:0);vertices.push(p.x,p.y,p.z);}
    for(const d of [depth,-depth*.65]){const p=a.clone().addScaledVector(axis,.34).addScaledVector(n,d);vertices.push(p.x,p.y,p.z);}
    for(let i=0;i<7;i++){const j=(i+1)%7;indices.push(14,i,j,15,j+7,i+7,i,i+7,j,j,i+7,j+7);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();
    // Winding follows the requested outward normal, including mirrored locks.
    const v0=new THREE.Vector3().fromArray(vertices,0),v1=new THREE.Vector3().fromArray(vertices,3),center=new THREE.Vector3().fromArray(vertices,42);
    if(v0.sub(center).cross(v1.sub(center)).dot(n)<0){for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];g.setIndex(indices);g.computeVertexNormals();}
    return skin(name,g,m,parent);
  };

  // Warp an even triangular shell into the raised neck. Unlike stacked rings,
  // this keeps the large low-poly planes continuous across the saddle and chest.
  const torsoGeometry=new THREE.IcosahedronGeometry(1,3),tp=torsoGeometry.attributes.position;
  for(let i=0;i<tp.count;i++){
    const x=tp.getX(i),y=tp.getY(i),z=tp.getZ(i),neck=THREE.MathUtils.smoothstep(z,.16,1);
    tp.setXYZ(i,x*.285*bulk*(1-neck*.24),h+.14+y*.30*bulk+neck*.43,-.14+z*.63+neck*.06);
  }
  torsoGeometry.setIndex(Array.from({length:tp.count},(_,i)=>i));torsoGeometry.computeVertexNormals();
  const torso=skin('sculpted-torso-neck',torsoGeometry,fur,body);
  // A continuous belly-to-saddle colour transition replaces intersecting chest/belly shells.
  const p=torso.geometry.getAttribute('position'),colors=torso.geometry.getAttribute('color'),base=new THREE.Color(spec.appearance.primary),belly=new THREE.Color(spec.appearance.secondary);
  for(let i=0;i<p.count;i++){const y=p.getY(i)-(h+.15),v=THREE.MathUtils.smoothstep(-y,-.02,.19)*.82;const color=base.clone().lerp(belly,v);const stripe=1-spec.appearance.markings*.18*THREE.MathUtils.smoothstep(y,.03,.24);color.multiplyScalar(stripe);color.r/=Math.max(base.r,.001);color.g/=Math.max(base.g,.001);color.b/=Math.max(base.b,.001);colors.setXYZ(i,color.r,color.g,color.b);}
  // Solid underlying anatomy seats the mane and bib against the neck in side view.
  ell('pectoral-volume',body,[0,h+.11,.27],[.24*bulk,.30,.26]);
  ell('throat-volume',body,[0,h+.31,.37],[.19*bulk,.33,.22]);
  const head=group('head',body,[0,h+.54,.49]);
  const cranium=ell('cranium',head,[0,.035,-.015],[.212,.21,.215],faceFur,28,true);
  // Cheek fullness is sculpted into the skull, tapering toward the jaw.
  {const p=cranium.geometry.getAttribute('position');for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),jaw=THREE.MathUtils.smoothstep(-y,.025,.16);
    const cheek=Math.exp(-(((Math.abs(x)-.15)/.075)**2)-(((y+.055)/.06)**2)-(((z-.075)/.12)**2));
    p.setXYZ(i,x*(1-.17*jaw)+Math.sign(x)*.009*cheek,y,z+.007*cheek);
  }p.needsUpdate=true;cranium.geometry.computeVertexNormals();}
  tube('muzzle-bridge',head,[[0,-.035,.105,.135,.105],[0,-.052,.20,.137,.088],[0,-.067,.31,.115,.075],[0,-.061,.397,.083,.062],[0,-.053,.431,.062,.048]],cream,10,12);
  ell('nose-leather',head,[0,-.035,.438],[.074,.05,.051],black,24);
  const jaw=group('jaw',head,[0,-.121,.13]);
  tube('lower-jaw',jaw,[[0,0,0,.065,.025],[0,-.013,.09,.107,.032],[0,-.013,.19,.085,.027],[0,-.009,.266,.04,.016]],cream,10,12);
  ell('mouth-interior',jaw,[0,.009,.133],[.099,.013,.145],black);
  for(const side of [-1,1]){
    const suffix=side>0?'L':'R';
    lock('cheek-lock',head,[side*.155,-.025,.04],[side*.195,-.125,.055],.055,.023,fur,[side,0,.6]);
    ell('nostril-'+suffix,head,[side*.043,-.022,.477],[.012,.008,.006],black,12);
    tube('lip-'+suffix,head,[[side*.112,-.12,.155,.004,.004],[side*.117,-.13,.235,.004,.004],[side*.073,-.12,.372,.003,.003]],black,12,6);
    for(let i=0;i<3;i++)ell('whisker-follicle-'+suffix,head,[side*(.131-i*.01),-.061-(i%2)*.020,.24+i*.036],[.003,.003,.003],black,8);
    const eye=group('eye'+suffix,head,[side*.150,.065,.13]);eye.rotation.y=side*.68;
    ell('eye-socket',eye,[0,0,0],[.048,.030,.021],black,24);
    ell('iris',eye,[0,0,.018],[.031,.024,.015],iris,24);
    ell('pupil',eye,[0,0,.031],[.012,.018,.004],black,20);
    ell('catchlight',eye,[-.010,.010,.035],[.006,.005,.002],shine,12);
    const lid=group('lid'+suffix,eye);ell('eyelid',lid,[0,0,.035],[.047,.029,.006],fur,20);
    tube('lower-lid',eye,[[-.044,0,.008,.005,.005],[0,-.027,.017,.006,.006],[.044,0,.008,.005,.005]],fur,8,6);
    tube('brow-'+suffix,eye,[[-.047,.038,-.002,.022,.025],[-.015,.044,.003,.024,.025],[.022,.039,.003,.024,.023],[.050,.026,-.009,.018,.020]],fur,5,6);
    const ear=group('ear'+suffix,head,[side*.137,.174,-.045]);ear.rotation.z=-side*.13;
    const eh=.35*spec.anatomy.ears;
    tube('ear-shell',ear,[[0,0,0,.055,.032],[0,eh*.20,-.005,.084,.043],[0,eh*.47,-.008,.066,.033],[side*.012,eh*.77,-.014,.035,.017],[side*.022,eh,-.017,.001,.001]],fur,8,8);
    tube('ear-cavity',ear,[[0,.033,.028,.027,.005],[0,eh*.23,.035,.059,.008],[0,eh*.48,.027,.046,.006],[side*.01,eh*.76,.01,.023,.004],[side*.019,eh*.92,-.002,.001,.001]],inner,8,8);
    for(let i=0;i<4;i++)lock('ear-fur',ear,[(i-1.5)*.018,.035,.045],[(i-1.5)*.016,.115+(i%2)*.023,.046],.010,.009,cream);
    tube('upper-fang',head,[[side*.094,-.12,.29,.012,.011],[side*.09,-.162,.286,.007,.007],[side*.083,-.181,.277,.001,.001]],tooth,7,8);
    tube('lower-fang',jaw,[[side*.071,.018,.07,.009,.009],[side*.072,.050,.071,.001,.001]],tooth,5,8);
    // Layer the mane down the sides, with tips following the back of the neck.
    for(let i=0;i<3;i++){
      const y=h+.54-i*.115,x=side*(.165+i*.026)*bulk,z=.37-i*.042;
      lock('ruff-lock',body,[x,y,z],[side*(.26+i*.039)*bulk,y-.225,z-.025],.076+i*.013,.035,fur,[side,0,.65]);
    }
    lock('temple-fur',head,[side*.14,.073,-.105],[side*.244,-.026,-.141],.053,.032,fur,[side,0,.4]);
    lock('chest-side-fur',body,[side*.12,h+.32,.535],[side*.18,h+.01,.51],.085,.037,cream);
  }
  lock('chest-bib-upper',body,[0,h+.42,.54],[0,h+.15,.60],.145,.032,throat);
  lock('chest-bib-middle',body,[0,h+.27,.545],[0,h-.075,.50],.155,.045,cream);
  lock('chest-bib-tip',body,[0,h+.015,.48],[0,h-.135,.422],.072,.026,cream);
  const legs:Array<{upper:THREE.Group;knee:THREE.Group;ankle:THREE.Group;paw:THREE.Group;restY:number}>=[];
  for(const rear of [false,true])for(const side of [-1,1]){
    const id=(rear?'hind':'front')+(side>0?'L':'R');
    const upper=group(id,body,[side*(rear?.204:.185)*bulk,h,rear?-.49:.31]);
    if(rear){
      ell('haunch',upper,[-side*.015,.055,0],[.15*bulk,.275,.185]);
    }else{
      // The scapular mass belongs to the ribcage, not the swinging humerus.
      // Bury the pivot under that mass so a long stride cannot peel off the chest.
      ell('shoulder',body,[side*.174*bulk,h+.095,.285],[.125*bulk,.245,.170]);
      ell('shoulder-joint',upper,[0,-.015,0],[.074*bulk,.082,.085]);
    }
    const knee=group(id+'Knee',upper,[0,-h*.50,rear?.075:.015]);
    limb('upper-limb',upper,[[0,rear?.15:.045,0,(rear?.078:.055)*bulk,rear?.105:.065],[0,-h*.12,rear?.02:0,(rear?.100:.085)*bulk,rear?.11:.095],[0,-h*.40,rear?.060:.012,.068,.073],[0,-h*.53,rear?.075:.015,.054,.058]]);
    ell('knee-joint',knee,[0,0,0],[.066,.061,.066],fur,16);
    const ankle=group(id+'Ankle',knee,[0,-h*.38,rear?-.11:-.015]);
    limb('shin',knee,[[0,.038,0,.057,.059],[0,-h*.08,rear?-.025:-.003,.056,.057],[0,-h*.40,rear?-.11:-.015,.044,.046]]);
    ell('hock-joint',ankle,[0,0,0],[.049,.045,.050]);
    const restY=-h*.12+.055,paw=group(id+'Paw',ankle,[0,restY,.03]);
    limb('pastern',ankle,[[0,.025,0,.044,.042],[0,restY,.03,.055,.052]]);
    ell('paw-bridge',paw,[0,.013,.018],[.085,.055,.097],cream,16);
    ell('paw-pad',paw,[0,-.025,.005],[.050,.022,.057],black,16);
    for(let toe=0;toe<4;toe++){
      const x=(toe-1.5)*.042,z=.080-(Math.abs(toe-1.5)>.6?.014:0);
      ell('toe-'+toe,paw,[x,-.002,z],[.029,.034,.050],cream,16);
      ell('toe-pad-'+toe,paw,[x,-.023,z],[.017,.014,.026],black,12);
      tube('claw-'+toe,paw,[[x,.005,z+.030,.013,.017],[x,-.004,z+.056,.012,.013],[x,-.020,z+.080,.001,.001]],black,8,8);
    }
    ell('dewclaw-base',ankle,[-side*.034,.005,.01],[.017,.023,.018],fur,12);
    legs.push({upper,knee,ankle,paw,restY});
  }
  const tail=group('tail',body,[0,h+.23,-.57]),tl=spec.anatomy.tail;
  tube('continuous-tail',tail,[[0,0,.055,.083,.086],[0,-.09,-.12*tl,.119,.125],[0,-.22,-.30*tl,.158,.165],[0,-.25,-.48*tl,.14,.13],[0,-.22,-.64*tl,.078,.070],[0,-.18,-.77*tl,.001,.001]],fur,9,10);
  socket('head',head);socket('mouth',jaw,[0,0,.3]);socket('back',body,[0,h+.43,0]);socket('target',body,[0,h+.1,0]);

  // Merge only siblings sharing a material. Joint/lid transforms remain independent.
  body.traverse(parent=>{
    const batches=new Map<THREE.Material,THREE.Mesh[]>();
    for(const child of parent.children)if(child instanceof THREE.Mesh&&!Array.isArray(child.material)){const list=batches.get(child.material)??[];list.push(child);batches.set(child.material,list);}
    for(const [m,list] of batches){if(list.length<2)continue;const merged=mergeGeometries(list.map(o=>o.geometry),false);if(!merged)throw new Error('Falha ao agrupar detalhes do lobo.');
      const names=list.map(o=>o.name);list.forEach(o=>{parent.remove(o);geometries.delete(o.geometry);o.geometry.dispose();});geometries.add(merged);
      const o=new THREE.Mesh(merged,m);o.name='wolf-batch';o.userData.parts=names;o.castShadow=true;o.receiveShadow=true;parent.add(o);
    }
  });
  const attackClock=createWolfAttackClock();
  const update=(t:number,m:CreatureMotion)=>{
    const gait=wolfGait(t,m,h),attack=attackClock(t,m,h),bite=attack?.bite??0;
    body.position.z=attack?.advance??0;
    body.position.y=attack?attack.lift:gait.active?gait.lift:Math.sin(t*2)*.005;body.rotation.x=attack?.pitch??gait.pitch;
    const inverseBody=new THREE.Quaternion().setFromEuler(body.rotation).invert();
    legs.forEach((leg,i)=>{
      if(!gait.active&&!attack?.active){leg.upper.rotation.x=leg.knee.rotation.x=leg.ankle.rotation.x=leg.paw.rotation.x=0;return;}
      const foot=attack?.feet[i]??gait.feet[i],a=leg.knee.position,b=leg.ankle.position,l1=Math.hypot(a.y,a.z),l2=Math.hypot(b.y,b.z);
      // Solve the elbow/knee for a floor-relative ankle target. Stance travels
      // backwards at constant speed; only the recovery phase lifts the paw.
      const target=leg.upper.position.clone().add(a).add(b);
      target.z+=foot.z+(attack?(i<2?0:-attack.advance):0);target.y+=foot.lift-body.position.y;
      target.applyQuaternion(inverseBody).sub(leg.upper.position);
      const distance=Math.min(Math.hypot(target.y,target.z),l1+l2-.0001);
      const bend=Math.acos(THREE.MathUtils.clamp((distance*distance-l1*l1-l2*l2)/(2*l1*l2),-1,1))*(i<2?-1:1);
      const angle=Math.atan2(-target.z,-target.y)-Math.atan2(l2*Math.sin(bend),l1+l2*Math.cos(bend));
      const restA=Math.atan2(-a.z,-a.y),restB=Math.atan2(-b.z,-b.y);
      leg.upper.rotation.x=angle-restA;leg.knee.rotation.x=bend+restA-restB;
      leg.ankle.rotation.x=-body.rotation.x-leg.upper.rotation.x-leg.knee.rotation.x;leg.paw.rotation.x=0;
    });
    head.rotation.x=-.10-bite*.16-gait.pitch*.7-(attack?.thrust??0)*.18;jaw.rotation.x=bite*.78;
    tail.rotation.y=Math.sin(t*(gait.run?5:2.3))*(gait.run?.07:.16);tail.rotation.x=gait.run?-.14+Math.sin(gait.phase*Math.PI*2)*.09:0;
    for(const side of ['L','R']){const cycle=(t+phase)%4.7,blink=t===0?0:Math.max(0,1-Math.abs(cycle-4.35)/.10);nodes['lid'+side].scale.y=.10+blink*.95;nodes['lid'+side].position.y=.020*(1-blink);nodes['ear'+side].rotation.x=Math.sin(t*1.3+(side==='L'?phase:phase+1))*.045;}
  };
  return update;
}
