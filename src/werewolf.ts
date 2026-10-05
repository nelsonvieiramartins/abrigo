import * as THREE from 'three';
import {seededRandom} from './schema';
import type {CreatureSpec,CreatureMotion,CreatureDetail} from './creature-schema';
import {refine} from './mesh-profile';
import {createWerewolfAttackClock} from './werewolf-attack';

type Context={body:THREE.Group;nodes:Record<string,THREE.Object3D>;sockets:Record<string,THREE.Object3D>;geometries:Set<THREE.BufferGeometry>;materials:Set<THREE.Material>};
// Original procedural sculpt based on the supplied reference. Front is +Z; units are metres.
export function buildWerewolf(spec:CreatureSpec,c:Context,detail:CreatureDetail){
 const {body,nodes,sockets,geometries,materials}=c,high=detail==='high',bulk=.86+spec.body.bulk*.28;
 const random=seededRandom(spec.seed+':werewolf'),phase=random()*Math.PI*2;
 const mat=(color:string,roughness=1)=>{const m=new THREE.MeshStandardMaterial({color,roughness,flatShading:!high,vertexColors:true});materials.add(m);return m;};
 const fur=mat(spec.appearance.primary),cream=mat(spec.appearance.secondary),black=mat('#171b18',.8),denim=mat('#29394d'),hem=mat('#354457'),eye=mat(spec.appearance.eyes,.55),inner=mat('#b78d74'),tooth=mat('#e6e1c9');
 const group=(name:string,parent:THREE.Object3D,pos=[0,0,0])=>{const o=new THREE.Group();o.name=name;o.position.fromArray(pos);parent.add(o);nodes[name]=o;return o;};
 const mesh=(name:string,g:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Object3D,pos=[0,0,0])=>{
   geometries.add(g);const p=g.getAttribute('position'),colors:number[]=[];
   for(let i=0;i<p.count;i++){const k=.96+(high?.012+spec.appearance.markings*.012:.025+spec.appearance.markings*.06)*Math.sin(p.getX(i)*7+p.getY(i)*5+p.getZ(i)*4+phase);colors.push(k,k,k);}
   g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();
   const o=new THREE.Mesh(g,m);o.name=name;o.position.fromArray(pos);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;
 };
 // Same rounded ellipsoid construction used by the human character modeler.
 const volume=(name:string,parent:THREE.Object3D,pos:number[],size:number[],m=fur,d=high?1:0)=>mesh(name,(high?new THREE.SphereGeometry(1,d>1?28:20,d>1?18:12):new THREE.IcosahedronGeometry(1,d)).scale(size[0],size[1],size[2]),m,parent,pos);
 const segment=(name:string,parent:THREE.Object3D,a:number[],b:number[],r1:number,r2:number,m=fur)=>{
   const A=new THREE.Vector3().fromArray(a),B=new THREE.Vector3().fromArray(b),v=B.clone().sub(A);
   const o=mesh(name,new THREE.CylinderGeometry(r2,r1,v.length(),high?16:5),m,parent,A.clone().add(B).multiplyScalar(.5).toArray());o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());return o;
 };
 const spike=(name:string,parent:THREE.Object3D,a:number[],b:number[],r:number,m=fur)=>segment(name,parent,a,b,r,0,m);
 // Share the character modeler's bounded Catmull-Rom refinement for flowing contours.
 const shell=(name:string,parent:THREE.Object3D,input:number[][],m=fur,radial=high?24:8)=>{
   const rings=refine(input.map(([y,w,d,z=0,x=0])=>[y,w,d,z,x]),high?3:1,[0],[1,2]);
   const p:number[]=[],ix:number[]=[];
   for(const [y,w,d,z=0,x=0] of rings)for(let j=0;j<radial;j++){const a=j/radial*Math.PI*2;p.push(x+Math.sin(a)*w,y,z+Math.cos(a)*d);}
   for(let i=0;i<rings.length-1;i++)for(let j=0;j<radial;j++){const a=i*radial+j,b=i*radial+(j+1)%radial,d=a+radial,e=b+radial;ix.push(a,b,d,b,e,d);}
   for(const row of [0,rings.length-1]){const center=p.length/3;p.push(rings[row][4]??0,rings[row][0],rings[row][3]??0);for(let j=0;j<radial;j++){const a=row*radial+j,b=row*radial+(j+1)%radial;if(row)ix.push(center,a,b);else ix.push(center,b,a);}}
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(ix);return mesh(name,g,m,parent);
 };
 const legScale=spec.anatomy.legs,upper=.48*legScale,lower=.54*legScale,hipHeight=.94*legScale+.12;
 const hips=group('hips',body,[0,hipHeight,0]),trunk=group('spine',hips,[0,.12,0]);
 const torsoRows=[[0,.25*bulk,.22,0],[.18,.26*bulk,.21,0],[.38,.34*bulk,.25,0],[.61,.44*bulk,.29,0],[.78,.46*bulk,.27,0],[.89,.30*bulk,.20,0],[.99,.19,.17,0]];
 shell('muscular-torso',trunk,torsoRows);
 shell('pelvis',hips,[[-.24,.29*bulk,.20],[-.17,.35*bulk,.235],[-.075,.38*bulk,.25],[.035,.38*bulk,.25],[.105,.315*bulk,.24],[.155,.265*bulk,.225],[.18,.25*bulk,.22]],denim);
 shell('waistband',hips,[[.125,.278*bulk,.233],[.185,.255*bulk,.228]],hem);
 for(const side of [-1,1]){
   if(high){
     // A chest patch follows the actual torso surface, not two spherical balloons.
     const rows=refine(torsoRows,3,[0],[1,2]),p:number[]=[],ix:number[]=[],N=12;
     for(let i=0;i<=N;i++){
       const v=i/N,y=.44+v*.405;let k=0;while(k<rows.length-2&&rows[k+1][0]<y)k++;
       const a=rows[k],b=rows[k+1],t=(y-a[0])/(b[0]-a[0]),w=THREE.MathUtils.lerp(a[1],b[1],t),d=THREE.MathUtils.lerp(a[2],b[2],t);
       const edge=.35*bulk*Math.pow(Math.max(0,Math.sin(v*Math.PI)),.35);
       for(let j=0;j<=N;j++){const u=j/N,x=side*(.012+edge*u),z=d*Math.sqrt(Math.max(.02,1-(x/w)**2))+.006+.018*Math.sin(u*Math.PI)*Math.sin(v*Math.PI);p.push(x,y,z);}
     }
     for(let i=0;i<N;i++)for(let j=0;j<N;j++){const a=i*(N+1)+j,b=a+1,c=a+N+1,d=c+1;if(side>0)ix.push(a,b,c,b,d,c);else ix.push(a,c,b,b,c,d);}
     const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(ix);mesh('pectoral',g,cream,trunk);
   }else{const p=volume('pectoral',trunk,[side*.205*bulk,.62,.21],[.25*bulk,.27,.115],cream);p.rotation.z=-side*.12;}
 }
 // Abdomen is a thin fitted fur patch, not a stack of detached muscle balloons.
 {const rows=refine(torsoRows,high?3:1,[0],[1,2]),p:number[]=[],ix:number[]=[],N=high?16:6;
  for(let i=0;i<=N;i++){
    const t=i/N,y=.025+t*.425;let k=0;while(k<rows.length-2&&rows[k+1][0]<y)k++;
    const a=rows[k],b=rows[k+1],v=(y-a[0])/(b[0]-a[0]),w=THREE.MathUtils.lerp(a[1],b[1],v),d=THREE.MathUtils.lerp(a[2],b[2],v);
    for(let j=0;j<=N;j++){const u=j/N,x=(u*2-1)*(.12+.07*t),groove=.002*Math.cos(t*Math.PI*6);p.push(x,y,d*Math.sqrt(Math.max(.05,1-(x/w)**2))+.004+groove);}
  }
  for(let i=0;i<N;i++)for(let j=0;j<N;j++){const a=i*(N+1)+j,b=a+1,d=a+N+1;ix.push(a,b,d,b,d+1,d);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(ix);mesh('abdominal-patch',g,cream,trunk);
 }
 segment('neck',trunk,[0,.80,0],[0,1.04,.02],.23,.19);
 const head=group('head',trunk,[0,1.075,.075]);
 const skull=volume('wolf-skull',head,[0,.025,0],[.25,.30,.25],fur,high?2:1);
 // Cheekbones belong to the skull surface, not separate oval volumes. Blend
 // a restrained lateral fullness into the temple and taper toward the jaw.
 {const p=skull.geometry.getAttribute('position');
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),jaw=THREE.MathUtils.smoothstep(-y,.04,.27);
    const cheek=Math.exp(-(((Math.abs(x)-.18)/.08)**2)-(((y+.105)/.075)**2)-(((z-.09)/.15)**2));
    p.setXYZ(i,x*(1-.22*jaw)+Math.sign(x)*.014*cheek,y,z+.008*cheek);
  }
  p.needsUpdate=true;skull.geometry.computeVertexNormals();skull.geometry.computeBoundingBox();skull.geometry.computeBoundingSphere();skull.userData.integratedCheeks=true;
 }
 volume('upper-muzzle',head,[0,-.08,.275],[.155,.12,.245],cream);
 volume('nose',head,[0,-.03,.494],[.105,.067,.064],black);
 const jaw=group('jaw',head,[0,-.17,.16]);
 volume('lower-jaw',jaw,[0,-.024,.14],[.15,.055,.185],cream);
 volume('mouth-cavity',head,[0,-.165,.32],[.157,.016,.15],black);
 for(const side of [-1,1]){
   const e=group('ear'+(side<0?'R':'L'),head,[side*.15,.235,0]);e.rotation.set(0,side*.10,-side*.16);e.scale.y=.85;
   volume('ear-root',e,[0,.012,-.015],[.105,.072,.07]);
   // Thin pointed ear shells and inset pink faces instead of round cone ears.
   const points=[[-.11,0,-.035],[.115,0,-.035],[.01,.44*spec.anatomy.ears,-.025],[-.085,.04,.036],[.085,.04,.036],[.01,.415*spec.anatomy.ears,.014]];
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));g.setIndex([0,2,1,3,4,5,0,3,5,0,5,2,1,2,5,1,5,4,0,1,4,0,4,3]);mesh('pointed-ear-shell',g,fur,e);
   const inset=new THREE.BufferGeometry();inset.setAttribute('position',new THREE.Float32BufferAttribute([-.063,.066,.038,.063,.066,.038,.008,.36*spec.anatomy.ears,.022],3));mesh('ear-inner',inset,inner,e);
   const iris=group('eye'+(side<0?'R':'L'),head,[side*.158,.07,.196]);iris.rotation.y=side*.36;
   volume('amber-eye',iris,[0,0,0],[.048,.035,.021],eye,high?2:1);
   volume('vertical-pupil',iris,[0,0,.020],[.009,.026,.008],black);
   volume('eye-glint',iris,[-.012,.012,.026],[.007,.007,.004],tooth);
   const brow=volume('angry-brow',head,[side*.17,.123,.18],[.068,.027,.047]);brow.rotation.z=side*.22;
   spike('fang',head,[side*.10,-.15,.40],[side*.10,-.245,.40],.019,tooth);
   for(let i=0;i<3;i++)spike('small-tooth',head,[side*(.026+i*.027),-.16,.439],[side*(.026+i*.027),-.194,.44],.010,tooth);
   for(let i=0;i<4;i++)spike('head-fur-lock',head,[side*.20,-.01-i*.048,-.02],[side*(.275+i*.01),-.08-i*.065,-.05],.060);
   for(let i=0;i<5;i++)spike('mane-lock',trunk,[side*(.15+i*.048),.93-i*.065,-.045],[side*(.31+i*.055),.75-i*.088,-.05],.12);
 }
 shell('throat-patch',trunk,[[.64,.07,.02,.274],[.81,.13,.035,.226],[1.00,.13,.04,.18]],cream,6);
 const arms:Array<{side:number;arm:THREE.Group;elbow:THREE.Group;hand:THREE.Group}>=[];
 const legs:Array<{side:number;thigh:THREE.Group;knee:THREE.Group;foot:THREE.Group}>=[];
 const trouserBindings:Array<{mesh:THREE.Mesh;thigh:THREE.Group;base:Float32Array}>=[];
 for(const side of [-1,1]){
   const suffix=side<0?'R':'L';
   const arm=group('upperArm'+suffix,trunk,[side*.46*bulk,.73,0]);
   // One flowing shoulder-to-elbow surface replaces the overlapping muscle balls.
   shell('deltoid',arm,[[-.43,.105,.105,.02,side*.12],[-.35,.122,.118,.022,side*.105],[-.24,.142,.137,.025,side*.075],[-.12,.163,.15,.012,side*.045],[0,.178,.164,0,side*.016],[.10,.145,.137,0,0],[.17,.075,.075,0,-side*.02]]);
   const elbow=group('lowerArm'+suffix,arm,[side*.12,-.40,.02]);
   // Muscle fullness is encoded in the profile itself, tapering into the wrist.
   shell('forearm',elbow,[[-.405,.083,.08,.045,side*.07],[-.33,.089,.086,.038,side*.062],[-.23,.112,.102,.026,side*.044],[-.12,.134,.117,.015,side*.024],[-.035,.127,.113,.004,side*.007],[.035,.105,.102,0,0]]);
   for(let i=0;i<3;i++)spike('forearm-fur-lock',elbow,[side*.10,-.06-i*.08,-.015],[side*.21,-.13-i*.10,-.025],.075);
   const hand=group('hand'+suffix,elbow,[side*.07,-.39,.045]);
   volume('clawed-palm',hand,[0,-.07,.015],[.135,.145,.09],cream);
   for(let i=0;i<4;i++){
     const x=(i-1.5)*.054,y=-.125-Math.abs(i-1.5)*.012;
     segment('finger',hand,[x,y,.012],[x,y-.105,-.025],.030,.021,cream);
     segment('finger-tip',hand,[x,y-.105,-.025],[x,y-.150,-.064],.021,.016,cream);
     spike('hand-claw',hand,[x,y-.150,-.064],[x,y-.23,-.10],.024,black);
   }
   segment('thumb',hand,[-side*.09,-.045,.005],[-side*.175,-.10,-.035],.042,.025,cream);
   spike('thumb-claw',hand,[-side*.175,-.10,-.035],[-side*.18,-.18,-.07],.026,black);
   sockets['hand'+suffix]=group('socket-hand'+suffix,hand,[0,-.09,.04]);arms.push({side,arm,elbow,hand});
   const thigh=group('upperLeg'+suffix,hips,[side*.20*bulk,0,0]),knee=group('lowerLeg'+suffix,thigh,[0,-upper,0]),foot=group('foot'+suffix,knee,[0,-lower,0]);
   segment('thigh',thigh,[0,0,0],[0,-upper,0],.16,.115);volume('thigh-muscle',thigh,[side*.008,-upper*.52,.01],[.16,upper*.43,.15]);
   // Jagged hem is part of the trousers' closed mesh, not separate floating triangles.
   const shortLength=upper*.82+.06;
   const shorts=new THREE.CylinderGeometry(1,1,shortLength,high?32:12,high?10:5,true),pa=shorts.getAttribute('position');
   for(let i=0;i<pa.count;i++){
     const q=THREE.MathUtils.clamp((shortLength/2-pa.getY(i))/shortLength,0,1);
     // Bury the narrow upper ring inside the pelvis, then ease over the thigh.
     pa.setX(i,pa.getX(i)*(.13+.055*Math.sin(q*Math.PI*.85))*bulk);
     pa.setZ(i,pa.getZ(i)*(.20-.035*q+.018*Math.sin(q*Math.PI))*Math.max(1,bulk));
   }
   for(let i=0;i<pa.count;i++)if(pa.getY(i)<-shortLength*.49){const a=Math.atan2(pa.getZ(i),pa.getX(i));pa.setY(i,pa.getY(i)-(.018+.035*(.5+.5*Math.sin(a*5+side))));}
   // Open upper rings are buried in the hip shell; their vertices stay waist-bound.
   // The lower rows follow the thigh with a blended transition, like character trousers.
   shorts.translate(0,.06-shortLength/2,0);
   const trouser=mesh('torn-shorts',shorts,denim,hips);
   trouserBindings.push({mesh:trouser,thigh,base:new Float32Array(pa.array)});
   volume('knee',knee,[0,0,.02],[.11,.105,.115]);
   segment('digitigrade-calf',knee,[0,0,0],[0,-lower*.72,-.12],.108,.075);
   volume('calf-muscle',knee,[0,-lower*.24,-.038],[.115,lower*.27,.105]);
   segment('raised-hock',knee,[0,-lower*.72,-.12],[0,-lower,0],.075,.09,cream);
   volume('paw',foot,[0,-.028,.075],[.16,.083,.20],cream);
   for(let i=0;i<3;i++){
     const x=(i-1)*.092;volume('paw-toe',foot,[x,-.038,.195],[.055,.059,.085],cream);
     spike('foot-claw',foot,[x,-.036,.238],[x,-.065,.346],.038,black);
   }
   legs.push({side,thigh,knee,foot});
 }
 const tail=group('tail',hips,[0,.075,-.20]);
 segment('tail-base',tail,[0,0,0],[0,-.16,-.20*spec.anatomy.tail],.105,.14);
 segment('tail-tip',tail,[0,-.16,-.20*spec.anatomy.tail],[0,-.29,-.47*spec.anatomy.tail],.14,.015);
 for(let i=0;i<3;i++)spike('tail-fur-lock',tail,[0,-.12-i*.05,-(.18+i*.07)*spec.anatomy.tail],[0,-.27-i*.065,-(.20+i*.09)*spec.anatomy.tail],.09);
 sockets.head=group('socket-head',head,[0,.03,.03]);sockets.mouth=group('socket-mouth',jaw,[0,-.01,.32]);
 sockets.back=group('socket-back',trunk,[0,.64,-.26]);sockets.target=group('socket-target',trunk,[0,.45,0]);
 const solveLeg=(l:typeof legs[number],y:number,z:number)=>{
   const dy=hips.position.y-y,r=THREE.MathUtils.clamp(Math.hypot(dy,z),Math.abs(upper-lower)+.001,upper+lower-.001);
   const k=Math.acos(THREE.MathUtils.clamp((r*r-upper*upper-lower*lower)/(2*upper*lower),-1,1));
   const hip=Math.atan2(-z,dy)-Math.atan2(lower*Math.sin(k),upper+lower*Math.cos(k));
   l.thigh.rotation.set(hip,0,0);l.knee.rotation.set(k,0,0);l.foot.rotation.set(-hip-k,0,0);
 };
 const garmentPoint=new THREE.Vector3(),garmentBent=new THREE.Vector3();
 const attackClock=createWerewolfAttackClock();
 return (time:number,motion:CreatureMotion)=>{
   const moving=motion==='move'||motion==='run',running=motion==='run',p=time*(running?9:5),attack=attackClock(time,motion);
   const wind=attack?.wind??0,hit=attack?.thrust??0,raised=attack?.raised??0,advance=.34*legScale*hit;
   hips.position.set(0,hipHeight+(attack?-legScale*(wind*.10+hit*.045):moving?Math.abs(Math.sin(p))*.009:Math.sin(time*1.8)*.004),advance);
   trunk.rotation.set((running?.16:moving?.07:0)-wind*.08+hit*.32,-wind*.06+hit*.04,moving?Math.sin(p)*.018:0);
   head.rotation.set(-.045-hit*.18,moving||attack?0:Math.sin(time*.6)*.04,0);jaw.rotation.x=(attack?.bite??0)*.65;
   // Floor-relative foot targets keep the rear support planted during the lunge.
   for(const l of legs){const a=p+(l.side<0?Math.PI:0),front=l.side<0;solveLeg(l,.12+(attack?(front?.08*legScale*attack.step:0):moving?Math.max(0,Math.sin(a))*(running?.18:.08):0),.08+(attack?(front?.16:-.08)*legScale*hit-advance:moving?-Math.cos(a)*(running?.30:.19):0));}
   for(const binding of trouserBindings){
     const p=binding.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
     for(let i=0;i<p.count;i++){
       garmentPoint.fromArray(binding.base,i*3);garmentBent.copy(garmentPoint).applyQuaternion(binding.thigh.quaternion);
       const t=THREE.MathUtils.smoothstep(-garmentPoint.y,.025,.025+.40*upper);
       garmentPoint.lerp(garmentBent,t).add(binding.thigh.position);p.setXYZ(i,garmentPoint.x,garmentPoint.y,garmentPoint.z);
     }
     p.needsUpdate=true;binding.mesh.geometry.computeVertexNormals();binding.mesh.geometry.computeBoundingBox();binding.mesh.geometry.computeBoundingSphere();
   }
   for(const a of arms){const swing=moving?-Math.cos(p+(a.side<0?Math.PI:0))*(running?.65:.30):0;
     // Both claws rise overhead, then sweep down together with the torso lunge.
     a.arm.rotation.set(attack?-raised*2.75-hit*.65:swing,0,a.side*(.12+raised*.12));a.elbow.rotation.x=attack?-.20-raised*.35-hit*.25:running?-.8:-.20;a.hand.rotation.set(hit*-.30,0,a.side*hit*.15);}
   tail.rotation.y=Math.sin(time*2)*.14;
 };
}
