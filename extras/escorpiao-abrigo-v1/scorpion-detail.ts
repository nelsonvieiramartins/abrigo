import * as THREE from 'three';
import type {CreatureSpec,CreatureMotion,CreatureDetail} from './creature-schema';
type Context={body:THREE.Group;nodes:Record<string,THREE.Object3D>;sockets:Record<string,THREE.Object3D>;geometries:Set<THREE.BufferGeometry>;materials:Set<THREE.Material>};
type Leg={base:THREE.Vector3;foot:THREE.Vector3;pole:THREE.Vector3;l1:number;l2:number;femur:THREE.Mesh;tibia:THREE.Mesh;joint:THREE.Mesh;side:number;index:number};
/** Procedural low-poly scorpion. +Z forward, +Y up, metres. No imported mesh. */
export function buildDetailedScorpion(spec:CreatureSpec,c:Context,detail:CreatureDetail='high'){
 const {body,nodes,sockets,geometries,materials}=c,s=spec.scorpion!,bulk=.85+spec.body.bulk*.3,h=.27*s.bodyHeight;
 const mat=(color:string)=>{const m=new THREE.MeshStandardMaterial({color,roughness:.93,flatShading:true,vertexColors:true});materials.add(m);return m;};
 const shell=mat(spec.appearance.primary),accent=mat(spec.appearance.secondary),dark=mat(spec.appearance.eyes);
 const add=(name:string,g:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Object3D=body)=>{
  const geo=g.index?g.toNonIndexed():g;if(geo!==g)g.dispose();geo.computeVertexNormals();const p=geo.getAttribute('position'),colors:number[]=[];
  for(let i=0;i<p.count;i+=3){const v=1-spec.appearance.markings*(.04+.055*(.5+.5*Math.sin(i/3*2.39996)));for(let j=0;j<3;j++)colors.push(v,v,v);}
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometries.add(geo);const o=new THREE.Mesh(geo,m);o.name=name;o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;
 };
 const group=(name:string,parent:THREE.Object3D,pos:number[])=>{const g=new THREE.Group();g.name=name;g.position.fromArray(pos);parent.add(g);nodes[name]=g;return g;};
 const ell=(name:string,parent:THREE.Object3D,pos:number[],size:number[],m=shell)=>{
  const g=new THREE.IcosahedronGeometry(1,detail==='high'?1:0);g.scale(size[0],size[1],size[2]);g.translate(pos[0],pos[1],pos[2]);return add(name,g,m,parent);
 };
 const segment=(name:string,parent:THREE.Object3D,length:number,r0:number,r1:number,m=shell)=>{
  const n=detail==='high'?6:4,rows=[[0,r0],[.18,r0*1.10],[.73,r0*.45+r1*.55],[1,r1]],v:number[]=[],idx:number[]=[];
  rows.forEach(([t,r])=>{for(let j=0;j<n;j++){const a=2*Math.PI*(j+.5)/n;v.push(Math.cos(a)*r,t*length,Math.sin(a)*r);}});
  for(let i=0;i<3;i++)for(let j=0;j<n;j++){const a=i*n+j,b=i*n+(j+1)%n,d=a+n,e=b+n;idx.push(a,d,b,b,d,e);}
  for(const end of [0,3]){const center=v.length/3;v.push(0,rows[end][0]*length,0);for(let j=0;j<n;j++){const a=end*n+j,b=end*n+(j+1)%n;idx.push(center,end===0?a:b,end===0?b:a);}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setIndex(idx);return add(name,g,m,parent);
 };
 const align=(o:THREE.Mesh,a:THREE.Vector3,b:THREE.Vector3)=>{o.position.copy(a);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());};
 const link=(name:string,parent:THREE.Object3D,a:number[],b:number[],r0:number,r1:number,m=shell)=>{const p=new THREE.Vector3().fromArray(a),q=new THREE.Vector3().fromArray(b),o=segment(name,parent,p.distanceTo(q),r0,r1,m);align(o,p,q);return o;};
 // Seven overlapping carapace sections taper toward the tail, with angular ridges.
 for(let i=0;i<7;i++){
  const z=(.15-i*.118)*s.bodyLength,w=(.27-i*.013)*bulk*s.bodyWidth;
  ell('carapace-'+i,body,[0,h,z],[w,.135*s.bodyHeight,.12*s.bodyLength]);
 }
 const head=group('head',body,[0,h,.34*s.bodyLength]);
 ell('cephalothorax',head,[0,0,0],[.27*bulk*s.bodyWidth,.15*s.bodyHeight,.25*s.bodyLength]);
 for(const side of [-1,1]){
  ell('eye'+(side<0?'R':'L'),head,[side*.085*s.bodyWidth,.08*s.bodyHeight,.205*s.bodyLength],[.032,.035,.028],dark);
  link('mouth-fang',head,[side*.066,-.05,.225*s.bodyLength],[side*.085,-.105,.33*s.bodyLength],.025,.002);
 }
 const legs:Leg[]=[];
 const marks=[{z:.27,kx:.53,kz:.57,fx:.66,fz:.75,ky:.43},{z:.11,kx:.67,kz:.28,fx:.83,fz:.37,ky:.50},
  {z:-.08,kx:.68,kz:-.11,fx:.86,fz:-.17,ky:.50},{z:-.27,kx:.56,kz:-.46,fx:.73,fz:-.62,ky:.46}];
 for(const side of [-1,1])marks.forEach((p,i)=>{
  const id='leg'+(side<0?'R':'L')+(i+1),root=new THREE.Vector3(side*.21*bulk*s.bodyWidth,h,p.z*s.bodyLength);
  const base=root.clone().add(new THREE.Vector3(side*.085,0,0));
  const knee=new THREE.Vector3(side*p.kx*s.legSpread*s.legLength,p.ky*s.bodyHeight,p.kz*s.legLength);
  const foot=new THREE.Vector3(side*p.fx*s.legSpread*s.legLength,.010,p.fz*s.legLength);
  const pivot=group(id,body,root.toArray());link(id+'Coxa',pivot,[0,0,0],base.clone().sub(root).toArray(),.042*s.legThickness,.035*s.legThickness);
  const l1=base.distanceTo(knee),l2=knee.distanceTo(foot),femur=segment(id+'Femur',body,l1,.043*s.legThickness,.036*s.legThickness),tibia=segment(id+'Tibia',body,l2,.036*s.legThickness,.007*s.legThickness);
  const joint=ell(id+'Knee',body,[0,0,0],[.048*s.legThickness,.048*s.legThickness,.048*s.legThickness],accent);
  nodes[id+'Femur']=femur;nodes[id+'Tibia']=tibia;nodes[id+'Knee']=joint;
  legs.push({base,foot,pole:knee.clone().sub(base),l1,l2,femur,tibia,joint,side,index:i});
 });
 // Pedipalps are separate from the eight walking legs. Claws pivot at finger roots.
 const claws:Array<{arm:THREE.Group;outer:THREE.Group;inner:THREE.Group;side:number}>=[];
 for(const side of [-1,1]){
  const id=side<0?'R':'L',arm=group('clawArm'+id,body,[side*.20*bulk*s.bodyWidth,h,.42*s.bodyLength]);
  const reach=s.clawReach;
  link('pedipalp-upper',arm,[0,0,0],[side*.25,-.01,.18*reach],.070,.056);
  ell('pedipalp-elbow',arm,[side*.25,-.01,.18*reach],[.075,.070,.075],accent);
  link('pedipalp-forearm',arm,[side*.25,-.01,.18*reach],[side*.38,-.025,.42*reach],.06,.075);
  const palm=group('claw'+id,arm,[side*.38,-.025,.49*reach]);
  ell('claw-palm',palm,[0,0,.04*s.clawSize],[.17*s.clawSize,.115*s.clawSize,.21*s.clawSize]);
  const outer=group('clawOuter'+id,palm,[side*.11*s.clawSize,0,.145*s.clawSize]);
  const inner=group('clawInner'+id,palm,[-side*.10*s.clawSize,0,.145*s.clawSize]);
  // Hooked polygon sweeps, broad at the root and sharp at the ends.
  const finger=(name:string,parent:THREE.Group,points:number[][],radii:number[])=>{
   const n=detail==='high'?6:4,vertices:number[]=[],indices:number[]=[];
   points.forEach((row,i)=>{const p=new THREE.Vector3().fromArray(row),t=new THREE.Vector3().fromArray(points[Math.min(i+1,points.length-1)]).sub(new THREE.Vector3().fromArray(points[Math.max(0,i-1)]));t.normalize();
    const across=new THREE.Vector3(t.z,0,-t.x).normalize();
    for(let j=0;j<n;j++){const a=2*Math.PI*(j+.5)/n,q=p.clone().addScaledVector(across,Math.cos(a)*radii[i]).addScaledVector(new THREE.Vector3(0,1,0),Math.sin(a)*radii[i]*.65);vertices.push(q.x,q.y,q.z);}
   });
   for(let i=0;i<points.length-1;i++)for(let j=0;j<n;j++){const a=i*n+j,b=i*n+(j+1)%n,d=a+n,e=b+n;indices.push(a,b,d,b,e,d);}
   // Correct winding: for a +Z tangent, across is +X and radial second axis is +Y.
   for(const end of [0,points.length-1]){const center=vertices.length/3;vertices.push(...points[end]);for(let j=0;j<n;j++){const a=end*n+j,b=end*n+(j+1)%n;indices.push(center,end===0?b:a,end===0?a:b);}}
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);return add(name,g,shell,parent);
  };
  const size=s.clawSize,opening=s.clawOpening;
  finger('outer-finger',outer,[[0,0,0],[side*.065*opening,0,.17],[side*.015*opening,0,.34],[-side*.11,0,.40]].map(p=>p.map(x=>x*size)),[.090,.075,.043,.002].map(x=>x*size));
  finger('inner-finger',inner,[[0,0,0],[-side*.045*opening,0,.15],[side*.015,0,.25],[side*.09,0,.29]].map(p=>p.map(x=>x*size)),[.070,.055,.033,.002].map(x=>x*size));
  claws.push({arm,outer,inner,side});
 }
 // Five true articulated tail segments follow an arched reference profile.
 const points=[[0,h+.09,-.65*s.bodyLength],[0,h+.29,-.90*s.bodyLength],[0,h+.68,-1.02*s.bodyLength],
  [0,h+1.04,-.90*s.bodyLength],[0,h+1.23,-.60*s.bodyLength],[0,h+1.06,-.30*s.bodyLength]].map(p=>new THREE.Vector3(p[0],h+(p[1]-h)*s.tailLength,p[2]));
 const tailJoints:Array<{node:THREE.Group;angle:number}>=[];let parent:THREE.Object3D=body,previousAngle=0,previousLength=0;
 for(let i=0;i<5;i++){
  const d=points[i+1].clone().sub(points[i]),length=d.length(),angle=Math.atan2(d.z,d.y),tail=group('tail'+i,parent,i===0?points[0].toArray():[0,previousLength,0]);
  tail.rotation.x=angle-previousAngle;const r=(.125-i*.012)*s.tailThickness;
  segment('tail-shell-'+i,tail,length,r,r*.85);ell('tail-joint-'+i,tail,[0,0,0],[r*.91,r*.7,r*.91],accent);
  tailJoints.push({node:tail,angle:tail.rotation.x});parent=tail;previousLength=length;previousAngle=angle;
 }
 const sting=group('stinger',parent,[0,previousLength,0]);
 ell('venom-bulb',sting,[0,.025,0],[.091*s.tailThickness,.105*s.stingerSize,.082*s.tailThickness]);
 const a=[0,.06,0],b=[0,.17*s.stingerSize,.025],d=[0,.29*s.stingerSize,.075];
 link('stinger-base',sting,a,b,.055*s.stingerSize,.032*s.stingerSize,dark);link('stinger-tip',sting,b,d,.032*s.stingerSize,.001,dark);
 for(const [name,parent,pos] of [['head',head,[0,0,0]],['mouth',head,[0,-.08,.30]],['back',body,[0,h+.16,-.20]],['target',body,[0,h,0]],['stinger',sting,d]] as const){const o=new THREE.Object3D();o.name='socket-'+name;o.position.fromArray(pos);parent.add(o);sockets[name]=o;}
 let previousMotion:CreatureMotion='idle',previousTime=-Infinity,attackStart=0;
 const ease=(a:number,b:number,t:number)=>{const u=THREE.MathUtils.clamp((t-a)/(b-a),0,1);return u*u*(3-2*u);};
 const animate=(time:number,motion:CreatureMotion)=>{
  if(motion==='attack'&&(previousMotion!=='attack'||time<previousTime))attackStart=time;
  const elapsed=Math.max(0,time-attackStart),active=motion==='move'||motion==='run';
  const prep=motion==='attack'?ease(0,.23,elapsed)*(1-ease(.25,.43,elapsed)):0;
  const strike=motion==='attack'?ease(.23,.40,elapsed)*(1-ease(.48,.91,elapsed)):0;
  body.position.set(0,active?Math.sin(time*12)*.004:-.018*prep, -.025*prep+.065*strike);body.rotation.x=.025*strike;
  head.rotation.x=.05*strike;
  tailJoints.forEach((j,i)=>j.node.rotation.x=j.angle+[-.12,.08,.12,.06,.10][i]*prep+[.85,-.08,-.10,-.10,-.12][i]*strike);
  claws.forEach(claw=>{
   claw.arm.rotation.y=-claw.side*.10*prep+claw.side*.13*strike;
   claw.outer.rotation.y=-claw.side*.14*prep+claw.side*.24*strike;
   claw.inner.rotation.y=claw.side*.12*prep-claw.side*.22*strike;
  });
  body.updateMatrix();const inv=body.matrix.clone().invert();
  legs.forEach(leg=>{
   const target=leg.foot.clone();if(active){const phase=(time*(motion==='run'?3.5:2.1)+(leg.index%2)*.5+(leg.side>0?.5:0))%1,stride=.09*s.legLength;
    if(phase<.6)target.z+=stride*(1-2*phase/.6);else{const u=(phase-.6)/.4;target.z+=stride*(-1+2*u);target.y+=Math.sin(u*Math.PI)*.05;}}
   target.applyMatrix4(inv);const delta=target.clone().sub(leg.base),distance=THREE.MathUtils.clamp(delta.length(),Math.abs(leg.l1-leg.l2)+1e-5,leg.l1+leg.l2-1e-5),axis=delta.normalize();
   const along=(leg.l1*leg.l1-leg.l2*leg.l2+distance*distance)/(2*distance),pole=leg.pole.clone().addScaledVector(axis,-leg.pole.dot(axis));
   if(pole.lengthSq()<1e-10)pole.set(0,1,0).addScaledVector(axis,-axis.y);pole.normalize();
   const knee=leg.base.clone().addScaledVector(axis,along).addScaledVector(pole,Math.sqrt(Math.max(0,leg.l1*leg.l1-along*along))),foot=leg.base.clone().addScaledVector(axis,distance);
   align(leg.femur,leg.base,knee);align(leg.tibia,knee,foot);leg.joint.position.copy(knee);
  });previousMotion=motion;previousTime=time;
 };
 return animate;
}
