import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {CreatureSpec,CreatureMotion,CreatureDetail} from './creature-schema';

export interface SkeletonContext {
 body:THREE.Group;nodes:Record<string,THREE.Object3D>;sockets:Record<string,THREE.Object3D>;
 geometries:Set<THREE.BufferGeometry>;materials:Set<THREE.Material>;
}
type Point=[number,number,number];
/** Metres, Y up, +Z forward. Static parts merge per joint/material; no texture or remote asset. */
export function buildDetailedSkeleton(spec:CreatureSpec,c:SkeletonContext,detail:CreatureDetail='high') {
 const {body,nodes,sockets,geometries,materials}=c,high=detail==='high',sides=high?6:4;
 const thick=spec.anatomy.thickness*(.9+.2*spec.body.bulk),width=spec.anatomy.spread*(.94+.12*spec.body.bulk);
 const L1=.42*spec.anatomy.legs,L2=.44*spec.anatomy.legs,H=(L1+L2)*.994+.088;
 const V=(p:Point)=>new THREE.Vector3(...p);
 const bone=new THREE.MeshStandardMaterial({color:spec.appearance.primary,roughness:.92,flatShading:true});
 const inner=new THREE.MeshStandardMaterial({color:spec.appearance.secondary,roughness:1,flatShading:true});
 const cavity=new THREE.MeshStandardMaterial({color:spec.appearance.eyes,roughness:1,flatShading:true});
 [bone,inner,cavity].forEach(m=>materials.add(m));
 const batches=new Map<THREE.Object3D,Map<THREE.Material,THREE.BufferGeometry[]>>();
 function group(name:string,parent:THREE.Object3D,p:Point=[0,0,0]) {
  const g=new THREE.Group();g.name=name;g.position.copy(V(p));parent.add(g);nodes[name]=g;return g;
 }
 function add(parent:THREE.Object3D,g:THREE.BufferGeometry,m:THREE.Material=bone) {
  g.deleteAttribute('uv');
  let batch=batches.get(parent);if(!batch){batch=new Map();batches.set(parent,batch);}
  if(!batch.has(m))batch.set(m,[]);batch.get(m)!.push(g.index?g.toNonIndexed():g);if(g.index)g.dispose();
 }
 function triangles(parent:THREE.Object3D,positions:number[],m=bone) {
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();add(parent,g,m);
 }
 function box(parent:THREE.Object3D,p:Point,size:Point,m=bone,angle=0) {
  const g=new THREE.BoxGeometry(...size);g.rotateX(angle);g.translate(...p);add(parent,g,m);
 }
 function joint(parent:THREE.Object3D,p:Point,r:number,stretch:Point=[1,1,1],m=bone) {
  const g=new THREE.IcosahedronGeometry(r,0);g.scale(...stretch);g.translate(...p);add(parent,g,m);
 }
 /** Closed faceted tube with stable parallel-transport frames. End-cap winding is outward. */
 function tube(parent:THREE.Object3D,points:Point[],radii:number[],flatten=1,m=bone,n=sides) {
  const rings:THREE.Vector3[][]=[],positions:number[]=[];let previous:THREE.Vector3|undefined;
  points.forEach((point,i)=>{
   const tangent=V(points[Math.min(i+1,points.length-1)]).sub(V(points[Math.max(0,i-1)])).normalize();
   let u=previous?previous.clone().addScaledVector(tangent,-previous.dot(tangent)):new THREE.Vector3(0,0,1).cross(tangent);
   if(u.lengthSq()<1e-8)u=new THREE.Vector3(1,0,0).cross(tangent);u.normalize();previous=u;
   const v=tangent.clone().cross(u).normalize();rings.push(Array.from({length:n},(_,j)=>V(point).addScaledVector(u,Math.cos(j/n*Math.PI*2)*radii[i]).addScaledVector(v,Math.sin(j/n*Math.PI*2)*radii[i]*flatten)));
  });
  const tri=(a:THREE.Vector3,b:THREE.Vector3,d:THREE.Vector3)=>positions.push(...a.toArray(),...b.toArray(),...d.toArray());
  for(let i=0;i<rings.length-1;i++)for(let j=0;j<n;j++){const k=(j+1)%n;tri(rings[i][j],rings[i][k],rings[i+1][k]);tri(rings[i][j],rings[i+1][k],rings[i+1][j]);}
  for(let j=0;j<n;j++){const k=(j+1)%n;tri(V(points[0]),rings[0][k],rings[0][j]);tri(V(points.at(-1)!),rings.at(-1)![j],rings.at(-1)![k]);}
  triangles(parent,positions,m);
 }
 function longBone(parent:THREE.Object3D,a:Point,b:Point,r:number,ends=1.7) {
  const va=V(a),vb=V(b),p=(t:number)=>va.clone().lerp(vb,t).toArray() as Point;
  tube(parent,[p(0),p(.07),p(.25),p(.72),p(.93),p(1)],[r*ends,r*ends,r*.86,r*.72,r*ends,r*ends*.85],1,bone,sides);
 }
 function digitBone(parent:THREE.Object3D,a:Point,b:Point,r:number) {
  const va=V(a),vb=V(b),p=(t:number)=>va.clone().lerp(vb,t).toArray() as Point;
  tube(parent,[p(0),p(.14),p(.86),p(1)],[r*.82,r,r,r*.78],.94,bone,sides);
 }
 function plate(parent:THREE.Object3D,outline:number[][],z:number,depth:number,m=bone) {
  const shape=new THREE.Shape(outline.map(p=>new THREE.Vector2(...p as [number,number])));
  const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,steps:1});g.translate(0,0,z-depth/2);add(parent,g,m);
 }
 function socket(name:string,parent:THREE.Object3D,p:Point=[0,0,0]) {
  const o=new THREE.Object3D();o.name='socket-'+name;o.position.copy(V(p));parent.add(o);sockets[name]=o;
 }
 const pelvis=group('pelvis',body,[0,H,0]);
 const chest=group('chest',pelvis,[0,.395,0]);
 const neck=group('neck',chest,[0,.315,-.01]);
 const head=group('head',neck,[0,.205,.017]);
 head.scale.set(.97,.99,.97);
 const jaw=group('jaw',head,[0,-.080,-.006]);
 // Cranium ring loft. The lower front surface stays behind the recessed orbital cavities.
 // Compact, broad dome: height and depth follow the supplied close-up, without a pointed crown.
 const skullRings=[[-.082,.102,.084,.084],[-.020,.135,.118,.118],[.034,.146,.145,.145],[.054,.146,.202,.159],[.088,.140,.194,.161],[.122,.119,.168,.146],[.150,.085,.118,.110],[.163,.041,.062,.059],[.166,.013,.024,.024]];
 const skull:number[]=[];const ringN=high?14:10;
 const rings=skullRings.map(([y,rx,front,back])=>Array.from({length:ringN},(_,j)=>{const a=j/ringN*Math.PI*2,cz=Math.cos(a);return new THREE.Vector3(Math.sin(a)*rx,y,Math.min((cz>=0?Math.pow(cz,.55)*front:cz*back)-.027,y<=.034?.086:Infinity));}));
 for(let i=0;i<rings.length-1;i++)for(let j=0;j<ringN;j++){
  const k=(j+1)%ringN;
  // The explicit forehead strip replaces these front sectors, avoiding overlapping surfaces.
  if((i===2||i===3)&&Math.min(Math.cos(j/ringN*Math.PI*2),Math.cos(k/ringN*Math.PI*2))>.30)continue;
  skull.push(...rings[i][j].toArray(),...rings[i+1][j].toArray(),...rings[i+1][k].toArray(),...rings[i][j].toArray(),...rings[i+1][k].toArray(),...rings[i][k].toArray());
 }
 for(let j=0;j<ringN;j++){let k=(j+1)%ringN;skull.push(0,.168,-.027,...rings.at(-1)![k].toArray(),...rings.at(-1)![j].toArray());skull.push(0,-.083,-.027,...rings[0][j].toArray(),...rings[0][k].toArray());}
 for(let i=0;i<skull.length;i+=9)for(let k=0;k<3;k++){const v=skull[i+3+k];skull[i+3+k]=skull[i+6+k];skull[i+6+k]=v;}
 triangles(head,skull);
 const outline=[[-.131,.049],[-.085,.056],[-.035,.047],[0,.035],[.035,.047],[.085,.056],[.131,.049],[.136,-.014],[.123,-.058],[.082,-.074],[.062,-.101],[-.062,-.101],[-.082,-.074],[-.123,-.058],[-.136,-.014]];
 const eyeShape=[[-.041,.001],[-.026,.024],[.015,.034],[.043,.024],[.048,-.009],[.022,-.027],[-.019,-.030],[-.043,-.017]];
 const holes:number[][][]=[];
 for(const side of [-1,1]){const h=eyeShape.map(([x,y])=>[side*(x*.91+.073),y*.93]);holes.push(side<0?h.reverse():h);}
 holes.push([[-.018,-.076],[0,-.030],[.017,-.076],[.008,-.085],[-.007,-.081]]);
 const faceShape=new THREE.Shape(outline.map(p=>new THREE.Vector2(p[0],p[1])));
 holes.forEach(h=>faceShape.holes.push(new THREE.Path(h.map(p=>new THREE.Vector2(p[0],p[1])))));
 const faceZ=(x:number,y:number)=>{const a=Math.abs(x),nose=y<-.035&&y>-.101?.029*Math.pow(Math.max(0,1-a/.053),2):0,cheek=y<-.04&&y>-.085?.010*a/.145:0;return .181-.065*Math.pow(Math.min(1,a/.145),2)+nose+cheek;};
 const face=new THREE.ShapeGeometry(faceShape);const f=face.getAttribute('position');
 for(let i=0;i<f.count;i++)f.setZ(i,faceZ(f.getX(i),f.getY(i)));face.computeVertexNormals();add(head,face);
 // Continue the brow into the dome so the orbital rim does not read as a separate rectangular mask.
 const foreheadRing=rings[4].filter(v=>v.z>-.027).sort((a,b)=>a.x-b.x);
 const foreheadPoint=(x:number)=>{
  let i=1;while(i<foreheadRing.length-1&&foreheadRing[i].x<x)i++;
  const a=foreheadRing[i-1],b=foreheadRing[i];
  return a.clone().lerp(b,THREE.MathUtils.clamp((x-a.x)/(b.x-a.x),0,1));
 };
 const forehead:number[]=[];
 for(let i=0;i<6;i++){
  const [x,y]=outline[i],[xx,yy]=outline[i+1],a=new THREE.Vector3(x,y,faceZ(x,y)),b=new THREE.Vector3(xx,yy,faceZ(xx,yy));
  const d=foreheadPoint(x),e=foreheadPoint(xx);
  forehead.push(...a.toArray(),...b.toArray(),...e.toArray(),...a.toArray(),...e.toArray(),...d.toArray());
 }
 // Close each temple between the forehead edge and the preserved lateral dome sectors.
 for(const side of [-1,1]){
  const [x,y]=outline[side<0?0:6],a=new THREE.Vector3(x,y,faceZ(x,y)),b=foreheadPoint(x);
  const edgeIndex=rings[4].reduce((best,v,i)=>side*v.x>side*rings[4][best].x?i:best,0);
  const c=rings[4][edgeIndex],d=rings[2][edgeIndex];
  for(const t of [[a,b,c],[a,c,d]]){
   if(t[1].clone().sub(t[0]).cross(t[2].clone().sub(t[0])).x*side<0)[t[1],t[2]]=[t[2],t[1]];
   forehead.push(...t[0].toArray(),...t[1].toArray(),...t[2].toArray());
  }
 }
 triangles(head,forehead);
 // Close the temples and cheek surfaces into the cranium instead of a floating face plate.
 const facialSides:number[]=[];
 for(let i=6;i<outline.length;i++){
  const j=(i+1)%outline.length,[x,y]=outline[i],[xx,yy]=outline[j];
  const a=new THREE.Vector3(x,y,faceZ(x,y)),b=new THREE.Vector3(xx,yy,faceZ(xx,yy));
  const back=(px:number,py:number)=>new THREE.Vector3(px*.94,py+.004,py<-.075?.085:.008);
  facialSides.push(...a.toArray(),...back(x,y).toArray(),...back(xx,yy).toArray(),...a.toArray(),...back(xx,yy).toArray(),...b.toArray());
 }
 for(let i=0;i<facialSides.length;i+=9)for(let k=0;k<3;k++){const v=facialSides[i+3+k];facialSides[i+3+k]=facialSides[i+6+k];facialSides[i+6+k]=v;}
 triangles(head,facialSides);
 holes.forEach((h,k)=>{
  const center=new THREE.Vector2();h.forEach(p=>center.add(new THREE.Vector2(...p as [number,number])));center.multiplyScalar(1/h.length);
  const wall:number[]=[],cap:number[]=[];
  const back=h.map(([x,y])=>new THREE.Vector3(center.x+(x-center.x)*.88,center.y+(y-center.y)*.86,k===2?.106:.098));
  for(let j=0;j<h.length;j++){
   const n=(j+1)%h.length,a=new THREE.Vector3(h[j][0],h[j][1],faceZ(...h[j] as [number,number])),b=new THREE.Vector3(h[n][0],h[n][1],faceZ(...h[n] as [number,number]));
   // Hole contours are clockwise. These faces point towards the cavity interior.
   wall.push(...a.toArray(),...b.toArray(),...back[n].toArray(),...a.toArray(),...back[n].toArray(),...back[j].toArray());
   cap.push(center.x,center.y,back[j].z,...back[n].toArray(),...back[j].toArray());
  }
  for(let i=0;i<wall.length;i+=9)for(let k=0;k<3;k++){const v=wall[i+3+k];wall[i+3+k]=wall[i+6+k];wall[i+6+k]=v;}
  triangles(head,wall,k<2?cavity:inner);triangles(head,cap,cavity);
 });
 // Cheek arches, narrow maxilla and separate U-shaped mandible.
 for(const side of [-1,1]){
  tube(head,[[side*.125,-.038,.146],[side*.116,-.066,.154],[side*.067,-.087,.177]],[.021,.022,.019],.9);
  tube(jaw,[[side*.098,.007,.016],[side*.085,-.045,.068],[side*.057,-.069,.161],[side*.026,-.070,.186]],[.022,.025,.027,.027],.85);
 }
 tube(jaw,[[-.038,-.071,.184],[0,-.077,.193],[.038,-.071,.184]],[.027,.028,.027],.88);
 for(let i=0;i<8;i++){
  const x=(i-3.5)*.0168,z=.194-Math.pow(Math.abs(x)/.08,2)*.022;
  box(head,[x,-.112,z],[.013,.020,.022]);box(jaw,[x,-.052,z+.009],[.0125,.015,.022]);
 }
 box(head,[0,-.124,.142],[.128,.048,.009],cavity);
 // Stack vertebrae; no solid fill between ribs.
 for(let i=0;i<4;i++)joint(pelvis,[0,.115+i*.067,-.045],.04,[1,1.1,1.05]);
 for(let i=0;i<8;i++){
  joint(chest,[0,-.064+i*.049,-.084],.031,[1,1.03,1]);
  tube(chest,[[0,-.065+i*.049,-.083],[0,-.061+i*.049,-.13]],[.014,.008],.75,inner);
 }
 for(let i=0;i<3;i++)joint(neck,[0,i*.048,-.012],.034,[1,1.08,.97]);
 plate(chest,[[-.044,.231],[.047,.231],[.045,.155],[.028,-.013],[.01,-.075],[-.009,-.075],[-.032,.001],[-.047,.162]],.167,.037);
 for(const side of [-1,1]){
  tube(chest,[[0,.235,.153],[side*.083,.227,.143],[side*.211*width,.255,.075],[side*.28*width,.263,.02]],[.019,.019,.02,.02],1);
  // Blade behind the shoulder: broad triangular scapula with a thin edge.
  plate(chest,[[side*.085,.22],[side*.25*width,.245],[side*.205*width,.077],[side*.1,.113]],-.111,.024,inner);
  for(let i=0;i<6;i++){
   const y=.189-i*.062,spread=(.225-i*.012)*width;
   tube(chest,[[side*.028,y+.023,-.089],[side*.13*width,y+.027,-.113],[side*spread,y+.014,-.073],[side*(spread+.015),y-.015,.025],[side*(spread-.015),y-.051,.121],[side*.064,y-.063,.151]],[.014*thick,.015*thick,.017*thick,.019*thick,.019*thick,.016*thick],1.13);
  }
  // Concave iliac wing: fan surface in front, angled rear surface, visible rim.
  const wing=[[side*.035,.061],[side*.085,.17],[side*.166,.184],[side*.217,.13],[side*.203,.071],[side*.134,-.019],[side*.063,-.039]];
  const center=new THREE.Vector3(side*.125,.083,-.032),front=wing.map(([x,y])=>new THREE.Vector3(x,y,.027)),basin:number[]=[];
  const inn=front.map(v=>center.clone().lerp(v,.77).add(new THREE.Vector3(0,0,.002)));
  const tri=(a:THREE.Vector3,b:THREE.Vector3,d:THREE.Vector3)=>{
   if(b.clone().sub(a).cross(d.clone().sub(a)).z<0)[b,d]=[d,b];basin.push(...a.toArray(),...b.toArray(),...d.toArray());
  };
  for(let i=0;i<front.length;i++){
   const j=(i+1)%front.length;tri(front[i],front[j],inn[j]);tri(front[i],inn[j],inn[i]);tri(inn[i],inn[j],center);
  }
  const backFace=[...basin];for(let i=0;i<backFace.length;i+=9){for(let k=2;k<9;k+=3)backFace[i+k]-=.036;for(let k=0;k<3;k++){const v=backFace[i+3+k];backFace[i+3+k]=backFace[i+6+k];backFace[i+6+k]=v;}}
  basin.push(...backFace);for(let i=0;i<front.length;i++){
   const j=(i+1)%front.length,a=front[i],b=front[j],aa=a.clone().add(new THREE.Vector3(0,0,-.036)),bb=b.clone().add(new THREE.Vector3(0,0,-.036));
   if(side<0)basin.push(...a.toArray(),...aa.toArray(),...bb.toArray(),...a.toArray(),...bb.toArray(),...b.toArray());
   else basin.push(...a.toArray(),...bb.toArray(),...aa.toArray(),...a.toArray(),...b.toArray(),...bb.toArray());
  }
  triangles(pelvis,basin);
  tube(pelvis,[[side*.044,.067,-.016],[side*.09,.167,-.021],[side*.168,.178,-.017],[side*.21,.125,.006]],[.02,.028,.027,.024],1);
  // Obturator opening remains genuinely empty.
  tube(pelvis,[[side*.045,.02,.025],[side*.125,-.021,.018],[side*.113,-.103,.063],[side*.035,-.105,.111],[0,-.065,.135],[side*.018,-.02,.109]],[.023,.027,.023,.02,.019,.02],1);
 }
 joint(pelvis,[0,.012,-.046],.071,[.7,1.3,.56],inner);
 const armRig:Array<{side:number;shoulder:THREE.Group;elbow:THREE.Group;hand:THREE.Group}>=[];
 for(const side of [-1,1]){
  const suffix=side>0?'L':'R',shoulder=group('shoulder'+suffix,chest,[side*.279*width,.245,0]);
  shoulder.rotation.z=side*.14;
  joint(shoulder,[0,0,0],.064,[1,.96,1]);
  longBone(shoulder,[0,-.031,0],[0,-.30,0],.034*thick,1.65);
  const elbow=group('elbow'+suffix,shoulder,[0,-.31,0]);joint(elbow,[0,0,0],.04,[1.05,1,1]);
  for(const d of [-1,1])longBone(elbow,[d*.023,-.024,0],[d*.018,-.278,.004],.017*thick,1.35);
  joint(elbow,[0,-.284,.005],.028,[1.3,.72,1]);
  const hand=group('hand'+suffix,elbow,[0,-.30,.008]);
  hand.scale.setScalar(1.2);
  joint(hand,[0,-.006,-.005],.026,[1.5,.55,.75]);
  // Canonical palms face +Z: thumbs are lateral. A quarter turn makes the palms medial and thumbs face +Z.
  // Order: index, middle, ring, little. Reflect X between hands; keep the palmar curl.
  const fingerLengths=[.079,.091,.085,.064];
  for(let i=0;i<4;i++){
   const x=side*(1.5-i)*.025,l=fingerLengths[i],radius=(i===3?.009:.0105)*thick;
   const base:Point=[x,-.055,.002],first:Point=[x*1.11,-.055-l*.48,.012],second:Point=[x*1.10,-.055-l*.85,.031],tip:Point=[x*1.08,-.055-l,.053];
   digitBone(hand,[x*.82,-.003,-.004],base,.012*thick);
   joint(hand,base,radius*1.06);digitBone(hand,base,first,radius);
   joint(hand,first,radius*.98);digitBone(hand,first,high?second:tip,radius*.93);
   if(high){joint(hand,second,radius*.89);digitBone(hand,second,tip,radius*.82);}
  }
  const thumbBase:Point=[side*.034,-.010,.004],thumbKnuckle:Point=[side*.065,-.038,.020],thumbEnd:Point=[side*.085,-.073,.035],thumbTip:Point=[side*.085,-.100,.055];
  digitBone(hand,thumbBase,thumbKnuckle,.014*thick);joint(hand,thumbKnuckle,.0125*thick);
  digitBone(hand,thumbKnuckle,thumbEnd,.0115*thick);joint(hand,thumbEnd,.0105*thick);digitBone(hand,thumbEnd,thumbTip,.010*thick);
  socket('hand'+suffix,hand,[0,-.06,.04]);armRig.push({side,shoulder,elbow,hand});
 }
 const legRig:Array<{side:number;hip:THREE.Group;knee:THREE.Group;foot:THREE.Group}>=[];
 for(const side of [-1,1]){
  const suffix=side>0?'L':'R',hip=group('hip'+suffix,pelvis,[side*.12*width,-.015,0]);
  joint(hip,[0,0,0],.061,[1.08,1,1]);longBone(hip,[0,-.015,0],[0,-L1+.027,0],.050*thick,1.6);
  const knee=group('knee'+suffix,hip,[0,-L1,0]);joint(knee,[0,0,0],.067,[1,.85,1]);joint(knee,[0,-.005,.033],.035,[1,.92,.52]);
  longBone(knee,[0,-.029,0],[0,-L2+.015,.002],.042*thick,1.5);
  longBone(knee,[side*.060,-.037,-.012],[side*.043,-L2+.015,-.012],.013*thick,1.35);
  const foot=group('foot'+suffix,knee,[0,-L2,0]);joint(foot,[0,0,0],.034,[1.25,.85,1]);
  joint(foot,[0,-.043,-.028],.045,[1.06,.72,1.05]);joint(foot,[0,-.046,.028],.037,[1.2,.65,1]);
  foot.scale.set(1.28,1.15,1.3);
  // Big toe on the medial edge in BOTH feet. The right foot is the reflection of the left.
  for(let i=0;i<5;i++){
   const x=side*(i-2)*.026,toeLength=[.079,.078,.068,.058,.046][i],r=(i===0?.0145:.011)*thick;
   const root:Point=[x,-.056,.107],knuckle:Point=[x,-.057,.113+toeLength*.59],tip:Point=[x,-.057,.113+toeLength];
   digitBone(foot,[x*.56,-.043,.034],root,r*.88);joint(foot,root,r*.96);
   digitBone(foot,root,knuckle,r);digitBone(foot,knuckle,tip,r*.85);
  }
  legRig.push({side,hip,knee,foot});socket('foot'+suffix,foot,[0,-.069,.065]);
 }
 socket('head',head);socket('mouth',jaw,[0,-.06,.21]);socket('back',chest,[0,.09,-.11]);socket('target',chest,[0,.07,0]);
 // Merge independent rigid pieces to one mesh per articulation and material.
 for(const [parent,batch] of batches)for(const [m,parts] of batch){
  const geo=mergeGeometries(parts,false);if(!geo)throw Error('Não foi possível unir os ossos.');parts.forEach(g=>g.dispose());geo.computeBoundingSphere();geometries.add(geo);
  const o=new THREE.Mesh(geo,m);o.name=parent.name+'-'+(m===bone?'bones':m===inner?'inner':'cavities');o.castShadow=true;o.receiveShadow=true;parent.add(o);
 }
 const rest=new Map<THREE.Object3D,{p:THREE.Vector3;q:THREE.Quaternion;s:THREE.Vector3}>();
 body.traverse(o=>rest.set(o,{p:o.position.clone(),q:o.quaternion.clone(),s:o.scale.clone()}));
 const smooth=(a:number,b:number,t:number)=>THREE.MathUtils.smoothstep(t,a,b);
 let lastMotion:CreatureMotion='idle',lastTime=-Infinity,attackStart=0;
 function legPose(leg:typeof legRig[number],z:number,lift:number) {
  // Analytic 3D two-link IK, fixed segment lengths, knees towards +Z.
  const target=new THREE.Vector3(leg.side*.06*spec.anatomy.legs,-(L1+L2)*.985-body.position.y+lift,z);
  const distance=Math.min(target.length(),L1+L2-.00001),u=target.clone().normalize();
  const v=new THREE.Vector3(0,0,1).addScaledVector(u,-u.z).normalize();
  const a=Math.acos(THREE.MathUtils.clamp((L1*L1+distance*distance-L2*L2)/(2*L1*distance),-1,1));
  const upper=u.clone().multiplyScalar(Math.cos(a)).addScaledVector(v,Math.sin(a));
  const lower=u.clone().multiplyScalar(distance).addScaledVector(upper,-L1).normalize();
  const down=new THREE.Vector3(0,-1,0);leg.hip.quaternion.setFromUnitVectors(down,upper);
  const localLower=lower.applyQuaternion(leg.hip.quaternion.clone().invert());leg.knee.quaternion.setFromUnitVectors(down,localLower);
  leg.foot.quaternion.copy(leg.hip.quaternion).multiply(leg.knee.quaternion).invert();
 }
 const animate=(time:number,motion:CreatureMotion='idle')=>{
  if(!Number.isFinite(time)||!['idle','move','run','attack'].includes(motion))throw Error('Tempo ou movimento inválido.');
  if(motion==='attack'&&(lastMotion!=='attack'||time<lastTime))attackStart=time;
  for(const [o,r] of rest){o.position.copy(r.p);o.quaternion.copy(r.q);o.scale.copy(r.s);}
  const gait=motion==='move'||motion==='run',running=motion==='run';
  const stride=(running?.145:.095)*spec.anatomy.legs,freq=running?9:5.6;
  body.position.y=gait?(running?-.025:-.009)+Math.max(0,Math.sin(time*freq*2))*(running?.014:.008):motion==='idle'?Math.sin(time*1.6)*.002:0;
  for(const leg of legRig){const phase=time*freq+(leg.side>0?0:Math.PI),swing=Math.sin(phase);legPose(leg,gait?-Math.cos(phase)*stride:0,gait?Math.max(0,swing)*(running?.063:.045):0);}
  chest.rotation.y=gait?Math.sin(time*freq)*.055:Math.sin(time*.85)*.008;
  head.rotation.y=gait?-chest.rotation.y*.6:Math.sin(time*.65)*.018;
  armRig.forEach(a=>{a.shoulder.rotation.x=gait?-Math.cos(time*freq+(a.side>0?0:Math.PI))*(running?.65:.36):.045+Math.sin(time*1.3)*.015;a.elbow.rotation.x=gait?-.28:-.07;a.hand.rotation.set(0,-a.side*Math.PI/2,0);});
  if(motion==='attack'){
   const t=Math.max(0,time-attackStart),wind=smooth(0,.22,t),hit=smooth(.22,.38,t),recover=1-smooth(.46,.9,t),pose=wind*recover;
   chest.rotation.y=(-.25*wind+.58*hit)*recover;chest.rotation.x=.06*pose;head.rotation.y=-chest.rotation.y*.65;
   const arm=armRig.find(a=>a.side<0)!;arm.shoulder.rotation.x=(.85*wind-2.25*hit)*recover;arm.shoulder.rotation.z=(-.14-.45*wind+.70*hit)*recover-.14*(1-recover);arm.elbow.rotation.x=(-1.25*wind+.70*hit)*recover-.07*(1-recover);arm.hand.rotation.x=-.30*pose;
   jaw.rotation.x=.15*pose;body.position.z=.075*Math.sin(hit*Math.PI/2)*recover;
  }
  lastMotion=motion;lastTime=time;
 };
 animate(0,'idle');body.updateMatrixWorld(true);
 // Calibrate ground contact against the generated foot geometry, for both detail levels.
 let lowest=Infinity;
 legRig.forEach(leg=>leg.foot.traverse(o=>{if(o instanceof THREE.Mesh){const p=o.geometry.getAttribute('position');for(let i=0;i<p.count;i++)lowest=Math.min(lowest,new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld).y);}}));
 rest.get(pelvis)!.p.y-=lowest;animate(0,'idle');return animate;
}
