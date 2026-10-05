import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {RAT_SHAPE_DEFAULTS,type CreatureSpec,type CreatureMotion,type CreatureDetail} from './creature-schema';
import {seededRandom} from './schema';

export interface RatContext {
 body:THREE.Group;nodes:Record<string,THREE.Object3D>;sockets:Record<string,THREE.Object3D>;
 geometries:Set<THREE.BufferGeometry>;materials:Set<THREE.Material>;
}
type Point=[number,number,number];
/** Stylized gallop: hind support, suspension, fore support, regrouping. */
export const RAT_RUN_PERIOD=.30;
/** Nominal metres/second for legLength=1, scale=1; the host applies translation. */
export const RAT_RUN_SPEED=.040/(.28*RAT_RUN_PERIOD);
/** CORRER+: faster bounding with larger, smooth body and paw arcs. */
export const RAT_RUN_PLUS_PERIOD=.24;
export const RAT_RUN_PLUS_SPEED=.048/(.28*RAT_RUN_PLUS_PERIOD);
/** Rigid procedural rat. Metres, Y up, +Z forward. World movement belongs to ABRIGO. */
export function buildDetailedRat(spec:CreatureSpec,c:RatContext,detail:CreatureDetail='high') {
 const {body,nodes,sockets,geometries,materials}=c,high=detail==='high',n=high?8:6;
 const shape={...RAT_SHAPE_DEFAULTS,bodyLength:spec.anatomy.length,bodyWidth:spec.anatomy.spread,
  legLength:spec.anatomy.legs,earSize:spec.anatomy.ears,tailLength:spec.anatomy.tail,
  tailThickness:spec.anatomy.thickness,...spec.rat};
 const rng=seededRandom(spec.seed+':rat'),width=shape.bodyWidth*(.88+.24*spec.body.bulk),length=shape.bodyLength;
 const foreL1=.051*shape.legLength,foreL2=.056*shape.legLength,pawHeight=.016*shape.pawSize;
 const H=(foreL1+foreL2)*.76+pawHeight;
 const material=(color:string)=>{const m=new THREE.MeshStandardMaterial({color,roughness:.94,flatShading:true});materials.add(m);return m;};
 const fur=material(spec.appearance.primary);fur.vertexColors=true;
 const light=material(spec.appearance.secondary),pink=material('#b5827e'),dark=material(spec.appearance.eyes),ivory=material('#ddd0ae');
 const batches=new Map<THREE.Object3D,Map<THREE.Material,THREE.BufferGeometry[]>>();
 const V=(p:Point)=>new THREE.Vector3(...p);
 function group(name:string,parent:THREE.Object3D,p:Point=[0,0,0]){
  const g=new THREE.Group();g.name=name;g.position.copy(V(p));parent.add(g);nodes[name]=g;return g;
 }
 function add(parent:THREE.Object3D,g:THREE.BufferGeometry,m=fur){
  g.deleteAttribute('uv');const geo=g.index?g.toNonIndexed():g;if(g.index)g.dispose();
  if(m===fur&&!geo.hasAttribute('color'))geo.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(geo.getAttribute('position').count*3).fill(1),3));
  let b=batches.get(parent);if(!b){b=new Map();batches.set(parent,b);}if(!b.has(m))b.set(m,[]);b.get(m)!.push(geo);
 }
 function triangles(parent:THREE.Object3D,p:number[],m=fur,colors?:number[]){
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
  if(colors)g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();add(parent,g,m);
 }
 function joint(parent:THREE.Object3D,p:Point,r:number,size:Point=[1,1,1],m=fur){
  const g=new THREE.IcosahedronGeometry(r,0);g.scale(...size);g.translate(...p);add(parent,g,m);
 }
 function box(parent:THREE.Object3D,p:Point,size:Point,m=fur){const g=new THREE.BoxGeometry(...size);g.translate(...p);add(parent,g,m);}
 /** Closed rings along Z. Independent centres provide the arched back and tapered muzzle. */
 function loft(parent:THREE.Object3D,slices:Array<[number,number,number,number]>,m=fur,sides=n,dorsal=false){
  const rings=slices.map(([z,y,rx,ry])=>Array.from({length:sides},(_,j)=>new THREE.Vector3(Math.sin(j/sides*Math.PI*2)*rx,y+Math.cos(j/sides*Math.PI*2)*ry,z)));
  const p:number[]=[],colors:number[]=[];
  const tri=(a:THREE.Vector3,b:THREE.Vector3,d:THREE.Vector3)=>{
   p.push(...a.toArray(),...b.toArray(),...d.toArray());
   for(const v of [a,b,d]){const shade=dorsal?1-spec.appearance.markings*.23*THREE.MathUtils.smoothstep(v.y,-.015,.055):1;colors.push(shade,shade,shade);}
  };
  for(let i=0;i<rings.length-1;i++)for(let j=0;j<sides;j++){const k=(j+1)%sides;tri(rings[i][j],rings[i+1][k],rings[i][k]);tri(rings[i][j],rings[i+1][j],rings[i+1][k]);}
  for(let j=0;j<sides;j++){const k=(j+1)%sides;tri(new THREE.Vector3(0,slices[0][1],slices[0][0]),rings[0][j],rings[0][k]);tri(new THREE.Vector3(0,slices.at(-1)![1],slices.at(-1)![0]),rings.at(-1)![k],rings.at(-1)![j]);}
  triangles(parent,p,m,m===fur?colors:undefined);
 }
 /** Closed faceted tube with parallel-transport frames, shared by limbs, digits and whiskers. */
 function tube(parent:THREE.Object3D,points:Point[],radii:number[],m=fur,sides=high?6:4,flatten=1){
  let previous:THREE.Vector3|undefined;const rings:THREE.Vector3[][]=[],p:number[]=[];
  points.forEach((point,i)=>{
   const tangent=V(points[Math.min(i+1,points.length-1)]).sub(V(points[Math.max(0,i-1)])).normalize();
   let u=previous?previous.clone().addScaledVector(tangent,-previous.dot(tangent)):new THREE.Vector3(0,0,1).cross(tangent);
   if(u.lengthSq()<1e-8)u=new THREE.Vector3(1,0,0).cross(tangent);u.normalize();previous=u;const v=tangent.clone().cross(u).normalize();
   rings.push(Array.from({length:sides},(_,j)=>V(point).addScaledVector(u,Math.cos(j/sides*Math.PI*2)*radii[i]).addScaledVector(v,Math.sin(j/sides*Math.PI*2)*radii[i]*flatten)));
  });
  const tri=(a:THREE.Vector3,b:THREE.Vector3,d:THREE.Vector3)=>p.push(...a.toArray(),...b.toArray(),...d.toArray());
  for(let i=0;i<rings.length-1;i++)for(let j=0;j<sides;j++){const k=(j+1)%sides;tri(rings[i][j],rings[i][k],rings[i+1][k]);tri(rings[i][j],rings[i+1][k],rings[i+1][j]);}
  for(let j=0;j<sides;j++){const k=(j+1)%sides;tri(V(points[0]),rings[0][k],rings[0][j]);tri(V(points.at(-1)!),rings.at(-1)![j],rings.at(-1)![k]);}
  triangles(parent,p,m);
 }
 function socket(name:string,parent:THREE.Object3D,p:Point=[0,0,0]){const o=new THREE.Object3D();o.name='socket-'+name;o.position.copy(V(p));parent.add(o);sockets[name]=o;}
 const torso=group('torso',body,[0,H,0]);
 loft(torso,[[-.148,-.012,.013,.029],[-.122,.009,.055,.060],[-.084,.026,.078,.077],[-.025,.020,.073,.067],[.04,.015,.062,.053],[.085,.018,.048,.051],[.124,.008,.032,.033],[.140,.009,.009,.015]].map(([z,y,rx,ry])=>[z*length,y,rx*width,ry*(.92+.16*spec.body.bulk)] as [number,number,number,number]),fur,n,true);
 // The lighter underside follows the body, rather than using a detached sphere.
 loft(torso,[[-.114,-.027,.034,.017],[-.065,-.032,.053,.019],[.025,-.028,.043,.017],[.085,-.020,.026,.012]].map(([z,y,rx,ry])=>[z*length,y,rx*width,ry] as [number,number,number,number]),light);
 const head=group('head',torso,[0,.031,.122*length]);head.scale.setScalar(shape.headSize);
 loft(head,[[-.036,.008,.026,.031],[-.010,.012,.040,.043],[.026,.006,.037,.037],[.058,-.004,.028,.025],[.088,-.013,.012,.011]]);
 const muzzle=group('muzzle',head);
 loft(muzzle,[[.045,-.008,.029,.021],[.079,-.016,.024,.017],[.112,-.021,.017,.011],[.133,-.024,.007,.006]].map(([z,y,rx,ry])=>[.045+(z-.045)*shape.muzzleLength,y,rx,ry] as [number,number,number,number]),light);
 const noseZ=.045+.088*shape.muzzleLength;
 joint(muzzle,[0,-.023,noseZ+.004],.0085,[1,.75,.70],pink);
 for(const side of [-1,1]){
  joint(head,[side*.032,.013,.039],.0085,[.67,.97,1],dark);
  if(high)joint(head,[side*.035,.016,.044],.0017,[1,1,1],ivory);
  const ear=group('ear'+(side>0?'L':'R'),head,[side*.033,.035,-.010]);ear.scale.setScalar(shape.earSize*.8);ear.rotation.y=side*.65;ear.rotation.z=-side*.23;
  loft(ear,[[-.006,.018,.011,.016],[0,.020,.023,.029],[.006,.020,.020,.025],[.008,.020,.0006,.0006]],fur,high?10:7);
  const earFace:number[]=[],earN=high?9:6;
  for(let j=0;j<earN;j++){const a=j/earN*Math.PI*2,b=(j+1)/earN*Math.PI*2;earFace.push(0,.020,.009,Math.sin(b)*.016,.020+Math.cos(b)*.020,.009,Math.sin(a)*.016,.020+Math.cos(a)*.020,.009);}
  triangles(ear,earFace,pink);
  for(let j=0;j<(high?3:2);j++){
   const d=j-(high?1:.5),z=.095*shape.muzzleLength+.006,whisker=shape.whiskerLength;
   tube(muzzle,[[side*.022,-.014,z],[side*.052*whisker,-.012+d*.005,z+d*.012],[side*.100*whisker,-.009+d*.012,z+d*.032]], [.0010,.0007,.00022],ivory,3);
  }
  tube(muzzle,[[side*.005,-.030,noseZ-.004],[side*.014,-.029,noseZ-.025],[side*.025,-.026,.069]], [.0012,.0010,.0007],dark,3);
 }
 const jaw=group('jaw',head,[0,-.030,.029]);
 loft(jaw,[[.005,0,.020,.008],[.045,-.003,.023,.009],[noseZ-.041,-.004,.011,.006],[noseZ-.032,-.003,.005,.003]],light);
 for(const side of [-1,1]){
  box(muzzle,[side*.0035,-.032,noseZ-.011],[.0045,.010,.006],ivory);
  box(jaw,[side*.003,-.001,noseZ-.044],[.004,.007,.006],ivory);
 }
 type Leg={side:number;rear:boolean;hip:THREE.Group;knee:THREE.Group;paw:THREE.Group;L1:number;L2:number;ankleY:number;phase:number};
 const legs:Leg[]=[];
 for(const rear of [false,true])for(const side of [-1,1]){
  const suffix=(rear?'hind':'front')+(side>0?'L':'R'),L1=(rear?.070:.051)*shape.legLength,L2=(rear?.069:.056)*shape.legLength;
  const hip=group(suffix,body,[side*(rear?.056:.043)*width,H+(rear?.005:0),(rear?-.105:.095)*length]);
  tube(hip,[[0,.005,0],[0,-L1*.22,0],[0,-L1*.72,0],[0,-L1,0]],rear?[.020,.025,.018,.010]:[.012,.013,.009,.007],fur,high?6:4);
  joint(hip,[0,-.003,0],rear?.020:.011,[1.1,1,1.1]);
  const knee=group('knee-'+suffix,hip,[0,-L1,0]);
  tube(knee,[[0,0,0],[0,-L2*.68,0],[0,-L2,0]],rear?[.010,.008,.0055]:[.007,.006,.0045]);
  const paw=group('paw-'+suffix,knee,[0,-L2,0]),pawScale=shape.pawSize*(rear?1.08:1);paw.scale.setScalar(pawScale);
  joint(paw,[0,-.003,.004],.010,[1.10,.62,1.40],pink);
  const digits=rear?5:4;
  for(let j=0;j<digits;j++){
   const x=(j-(digits-1)/2)*.0055,reach=(rear?.035:.027)-Math.abs(j-(digits-1)/2)*.002;
   tube(paw,[[x*.75,-.006,.007],[x,-.010,reach*.63],[x*1.1,-.012,reach]],[.0030,.0024,.0014],pink,high?5:3);
  }
  // Small vestigial thumb on the medial side of each forepaw.
  if(!rear)tube(paw,[[-.008,-.004,.003],[-.014,-.009,.011]],[.0025,.0015],pink,high?5:3);
  const ankleY=.016*pawScale;
  legs.push({side,rear,hip,knee,paw,L1,L2,ankleY,phase:side>0?(rear?Math.PI:0):(rear?0:Math.PI)});
  socket('foot'+suffix,paw,[0,-.009,.020]);
 }
 // The taper stays connected while every segment rotates about its previous endpoint.
 const tail:THREE.Group[]=[],tailN=high?10:7,tailLength=.325*shape.tailLength,segmentLength=tailLength/tailN;
 const tailPitch=-Math.asin(Math.min(.40,Math.max(0,(H-.018-.028)/tailLength))),bendSign=rng()>.5?1:-1;
 let tailParent:THREE.Object3D=torso;
 for(let i=0;i<tailN;i++){
  const segment=group('tail-'+i,tailParent,i===0?[0,-.018,-.145*length]:[0,0,-segmentLength]);
  const radius=(u:number)=>(.0105*(1-u)+.0012*u)*shape.tailThickness;
  tube(segment,[[0,0,.001],[0,0,-segmentLength*.22],[0,0,-segmentLength*.80],[0,0,-segmentLength]], [radius(i/tailN),radius((i+.22)/tailN)*.97,radius((i+.80)/tailN),radius((i+1)/tailN)],pink,high?8:5);
  segment.rotation.x=i===0?tailPitch:0;tail.push(segment);tailParent=segment;
 }
 socket('head',head);socket('mouth',jaw,[0,0,noseZ-.040]);socket('back',torso,[0,.10,-.04*length]);socket('target',torso,[0,.012,0]);socket('tailTip',tail.at(-1)!,[0,0,-segmentLength]);
 for(const [parent,batch] of batches)for(const [m,parts] of batch){
  const merged=mergeGeometries(parts,false);if(!merged)throw new Error('Falha ao unir partes do rato.');
  parts.forEach(g=>g.dispose());
  // Build canonical digits once and reflect all their vertices for the opposite paw.
  if(parent.name.startsWith('paw-')&&parent.name.endsWith('R')){
   merged.scale(-1,1,1);
   for(const name of Object.keys(merged.attributes)){
    const a=merged.getAttribute(name) as THREE.BufferAttribute;
    for(let i=0;i<a.count;i+=3)for(let k=0;k<a.itemSize;k++){
     const b=(i+1)*a.itemSize+k,d=(i+2)*a.itemSize+k,v=a.array[b];a.array[b]=a.array[d];a.array[d]=v;
    }
   }
   merged.computeVertexNormals();
  }
  merged.computeBoundingSphere();geometries.add(merged);
  const mesh=new THREE.Mesh(merged,m);mesh.name=parent.name+'-'+(m===fur?'fur':m===pink?'skin':m===light?'light':m===dark?'dark':'ivory');mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);
 }
 const hipRest=legs.map(leg=>leg.hip.position.clone());
 const legPose=(leg:Leg,dz:number,lift:number,scaledOffset=false)=>{
  const dy=leg.ankleY+lift-body.position.y/(scaledOffset?body.scale.y:1)-leg.hip.position.y;
  dz-=body.position.z/(scaledOffset?body.scale.z:1);
  const distance=Math.sqrt(dy*dy+dz*dz),D=THREE.MathUtils.clamp(distance,Math.abs(leg.L1-leg.L2)+1e-6,leg.L1+leg.L2-1e-6);
  const base=Math.atan2(-dz,-dy),bend=Math.acos(THREE.MathUtils.clamp((leg.L1*leg.L1+D*D-leg.L2*leg.L2)/(2*leg.L1*D),-1,1));
  const angle=base+(leg.rear?-bend:bend),targetY=dy*D/distance,targetZ=dz*D/distance;
  const lowerAngle=Math.atan2(-(targetZ+leg.L1*Math.sin(angle)),-(targetY+leg.L1*Math.cos(angle)));
  leg.hip.rotation.x=angle;leg.knee.rotation.x=lowerAngle-angle;leg.paw.rotation.x=-lowerAngle;
 };
 let previous:CreatureMotion='idle',lastTime=-Infinity,attackStart=0;
 const ease=(a:number,b:number,x:number)=>THREE.MathUtils.smoothstep(x,a,b);
 const animate=(time:number,motion:CreatureMotion='idle')=>{
  if(motion==='attack'&&(previous!=='attack'||time<lastTime))attackStart=time;
  const elapsed=Math.max(0,time-attackStart),attack=motion==='attack'&&elapsed<.68;
  const prepare=attack?ease(0,.16,elapsed)*(1-ease(.17,.32,elapsed)):0;
  const bite=attack?ease(.17,.28,elapsed)*(1-ease(.34,.57,elapsed)):0;
  const open=attack?ease(.02,.16,elapsed)*(1-ease(.23,.35,elapsed)):0;
  const plus=motion==='runPlus',running=motion==='run'||plus,moving=motion==='move'||running,frequency=9;
  const period=plus?RAT_RUN_PLUS_PERIOD:RAT_RUN_PERIOD;
  const phase=((time/period)%1+1)%1;
  // One broad, analytic arc: no short pulses or frame-dependent filtering.
  // Small body travel keeps the fast gait light and the silhouette steady.
  const buoyancy=.003+(plus?.018:.006)*(.5-.5*Math.cos(2*Math.PI*(phase-.90)));
  body.position.y=running?body.scale.y*shape.legLength*buoyancy:
   moving?.0015*shape.legLength*Math.pow(Math.sin(time*frequency),2):.0005*Math.sin(time*2.2);
  body.position.z=bite*.026-prepare*.009;body.rotation.set(0,0,0);
  torso.rotation.x=running?(plus?.040:.025)*Math.sin(2*Math.PI*(phase-.12)):bite*.07-prepare*.035;
  torso.rotation.z=running?0:moving?Math.sin(time*frequency)*.009:0;
  head.rotation.x=running?-torso.rotation.x*.65:prepare*-.10+bite*.12;
  head.rotation.y=running?0:moving?Math.sin(time*frequency*.5)*.012:Math.sin(time*1.5)*.015;
  jaw.rotation.x=open*.48;
  for(let i=0;i<legs.length;i++){
   const leg=legs[i];leg.hip.position.copy(hipRest[i]);
   if(running){
    // Keep shoulders and haunches attached to the pitching torso. Body rotation
    // stays zero so IK targets and level paws remain in the ground coordinate frame.
    const y=hipRest[i].y-H,z=hipRest[i].z,c=Math.cos(torso.rotation.x),s=Math.sin(torso.rotation.x);
    leg.hip.position.y=H+y*c-z*s;leg.hip.position.z=y*s+z*c;
    const start=(leg.rear?0:.50)+(leg.side>0?.025:0),duty=.28;
    const p=((phase-start)%1+1)%1,stride=(plus?.024:.020)*shape.legLength;
    let dz:number,lift:number;
    if(p<duty){dz=stride*(1-2*p/duty);lift=0;}
    else{
     const u=(p-duty)/(1-duty);
     // Cycloidal return retains rearward velocity at toe-off and touchdown.
     dz=stride*(-1+2*(u-Math.sin(2*Math.PI*u)/(2*Math.PI*duty)));
     // Zero velocity AND acceleration at liftoff/landing. The former clipped
     // lift envelope introduced a kink, most visible at higher playback rates.
     const fold=Math.sin(Math.PI*u)**4;
     const follow=THREE.MathUtils.smootherstep(u,0,.12)*(1-THREE.MathUtils.smootherstep(u,.88,1));
     lift=(plus?.035:.027)*shape.legLength*fold+(body.position.y/body.scale.y)*follow;
    }
    // Compensate shoulder motion: contact feet remain still when the host
    // advances at the active run speed * legLength (and scales metres by body.scale).
    legPose(leg,dz+hipRest[i].z-leg.hip.position.z,lift,true);
   }else{
    const p=time*frequency+leg.phase;
    legPose(leg,moving?-Math.cos(p)*.023*shape.legLength:0,moving?Math.max(0,Math.sin(p))*.014*shape.legLength:0);
   }
  }
  for(let i=0;i<tail.length;i++){
   tail[i].rotation.x=i===0?tailPitch-(running?torso.rotation.x:0):0;
   tail[i].rotation.y=(i===0?.20:bendSign*.045*Math.sin(i*.60))+Math.sin((running?phase*2*Math.PI:time*2.3)-i*.55)*(running?.006:moving?.020:.010)+bite*.015*Math.sin(i*.5);
  }
  previous=motion;lastTime=time;
 };
 animate(0,'idle');return animate;
}
