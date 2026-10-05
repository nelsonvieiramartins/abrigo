import * as THREE from 'three';
import type {CharacterSpec} from './schema';

// The old zombie's hollow eyes, damaged cheek, olive undershirt and real torn
// clothing, fitted to the shared human sculpt instead of a second blocky body.
export function addZombieDetails(c:{spec:CharacterSpec;nodes:Record<string,THREE.Object3D>;geometries:Set<THREE.BufferGeometry>;materials:Set<THREE.Material>;torsoAt:(y:number)=>number[]}){
 const {spec,nodes,geometries,materials}=c;if(spec.profession!=='zumbi')return;
 const mat=(color:string)=>{const m=new THREE.MeshStandardMaterial({color,roughness:1,flatShading:spec.style==='faceted',vertexColors:true,side:THREE.DoubleSide});materials.add(m);return m;};
 const skin=mat(spec.appearance.skin),shadow=mat('#46513a'),wound=mat('#624f3e'),shirt=mat('#535c3e'),lapel=mat('#503b2c');
 const add=(name:string,g:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Object3D)=>{
   if(!g.getAttribute('color'))g.setAttribute('color',new THREE.Float32BufferAttribute(Array(g.getAttribute('position').count*3).fill(1),3));
   g.computeVertexNormals();geometries.add(g);const o=new THREE.Mesh(g,m);o.name=name;o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;
 };
 const head=nodes.head,face=head.getObjectByName('head-shape') as THREE.Mesh;
 const eyeY=nodes.eyeR?.position.y??(head.getObjectByName('eye-white')?.position.y??.158);
 // Sculpt cavities and uneven cheek/jaw directly into the existing rounded head.
 const p=face.geometry.getAttribute('position');
 for(let i=0;i<p.count;i++){
   const x=p.getX(i),y=p.getY(i),z=p.getZ(i);if(z<.035)continue;
   const sockets=Math.exp(-(((Math.abs(x)-.039)/.022)**2)-(((y-eyeY)/.018)**2));
   const cheek=Math.exp(-(((x+.050)/.025)**2)-(((y-(eyeY-.035))/.029)**2));
   p.setZ(i,z-.013*sockets-.008*cheek);p.setX(i,x+.004*cheek);
 }p.needsUpdate=true;face.geometry.computeVertexNormals();face.geometry.computeBoundingBox();face.geometry.computeBoundingSphere();
 const ray=new THREE.Raycaster();
 const patch=(name:string,xy:number[][],m:THREE.Material,parent:THREE.Object3D,surface:THREE.Mesh,lift=.0015)=>{
   const points:number[]=[],indices=THREE.ShapeUtils.triangulateShape(xy.map(([x,y])=>new THREE.Vector2(x,y)),[]);
   const tri=(a:number[],b:number[],c:number[],depth:number)=>{
     if(depth){const mid=(u:number[],v:number[])=>u.map((n,i)=>(n+v[i])/2),ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);tri(a,ab,ca,depth-1);tri(ab,b,bc,depth-1);tri(ca,bc,c,depth-1);tri(ab,bc,ca,depth-1);return;}
     for(const [x,y] of [a,b,c]){ray.set(new THREE.Vector3(x,y,1),new THREE.Vector3(0,0,-1));const hit=ray.intersectObject(surface,false)[0];points.push(x,y,(hit?.point.z??.08)+lift);}
   };
   for(const [a,b,c] of indices)tri(xy[a],xy[b],xy[c],2);
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));return add(name,g,m,parent);
 };
 for(const side of [-1,1]){
   const x=side*.039,xy=Array.from({length:12},(_,i)=>{const a=i/12*Math.PI*2;return [x+Math.cos(a)*.026,eyeY-.006+Math.sin(a)*.021];});
   patch('zombie-sunken-orbit',xy,shadow,head,face,.0007);
 }
 patch('zombie-cheek-wound',[[-.065,eyeY-.024],[-.040,eyeY-.028],[-.048,eyeY-.042],[-.035,eyeY-.049],[-.052,eyeY-.062],[-.069,eyeY-.048]],wound,head,face);
 // Strip triangles, and keep a skin lining only behind the opening. No decals
 // or floating patches: both layers use the same garment vertices and parent.
 const tear=(o:THREE.Mesh|undefined,name:string,hole:(x:number,y:number,z:number)=>boolean,backing:THREE.Material,inset=.985)=>{
   if(!o)return;const g=o.geometry,pa=g.getAttribute('position'),source=g.index?Array.from(g.index.array):Array.from({length:pa.count},(_,i)=>i),keep:number[]=[],cut:number[]=[];
   for(let i=0;i<source.length;i+=3){const a=source[i],b=source[i+1],c=source[i+2],x=(pa.getX(a)+pa.getX(b)+pa.getX(c))/3,y=(pa.getY(a)+pa.getY(b)+pa.getY(c))/3,z=(pa.getZ(a)+pa.getZ(b)+pa.getZ(c))/3;(hole(x,y,z)?cut:keep).push(a,b,c);}
   if(!cut.length)return;
   const lining=g.clone(),lp=lining.getAttribute('position');for(let i=0;i<lp.count;i++)lp.setXYZ(i,lp.getX(i)*.985,lp.getY(i),lp.getZ(i)*inset);lining.setIndex(cut);
   const inside=add(name+'-lining',lining,backing,o.parent!);inside.position.copy(o.position);
   g.setIndex(keep);g.computeBoundingBox();g.computeBoundingSphere();o.userData.tornTriangles=cut.length/3;
   const material=(o.material as THREE.MeshStandardMaterial).clone();material.side=THREE.DoubleSide;materials.add(material);o.material=material;
 };
 const mouth=head.getObjectByName('mouth') as THREE.Mesh;mouth.geometry.computeBoundingBox();
 const mouthY=mouth.position.y+mouth.geometry.boundingBox!.getCenter(new THREE.Vector3()).y;
 tear(face,'zombie-open-mouth',(x,y,z)=>z>.045&&(x/.027)**2+((y-mouthY+.003)/.012)**2<1,mat('#25291f'),.72);
 const torso=nodes.spine.getObjectByName('torso') as THREE.Mesh;
 if(spec.outfit.top==='zombie'){
   const support=new THREE.Mesh(torso.geometry.clone(),torso.material);geometries.add(support.geometry);
   // Open brown jacket with a ragged bottom and an olive shirt underneath.
   tear(torso,'zombie-undershirt',(x,y,z)=>z>0&&y>.175&&y<.505&&Math.abs(x)<.040+.010*Math.sin(y*85),shirt);
   for(const o of nodes.spine.children)if(['zipper','zipper-pull','chest-pocket','pocket-flap','pocket-button','lapel'].includes(o.name))o.visible=false;
   for(const side of [-1,1])patch('zombie-ragged-lapel',[[side*.037,.50],[side*.087,.49],[side*.10,.441],[side*.067,.412],[side*.079,.385],[side*.045,.34]],lapel,nodes.spine,support,.003);
 }
 if(spec.outfit.top!=='none'){
   tear(torso,'zombie-torso-rip',(x,y,z)=>z>0&&((x+.075)/.023)**2+((y-.24)/.035)**2<1,skin);
   // Uneven open hems; the lining at the removed triangles reveals the body.
   tear(torso,'zombie-ragged-hem',(x,y)=>y<.165+.020*(.5+.5*Math.sin(x*150)),skin);
   for(const suffix of ['R','L']){
     if(['zombie','jacket','hoodie','fieldshirt'].includes(spec.outfit.top)){
       const sleeve=nodes['upperArm'+suffix].getObjectByName('upper-arm'+suffix) as THREE.Mesh;
       tear(sleeve,'zombie-ragged-sleeve'+suffix,(x,y,z)=>y<-.135+.012*Math.sin(x*150+z*170),skin);
     }
   }
 }
 if(spec.outfit.pants!=='briefs')for(const suffix of ['R','L']){
   const thigh=nodes['upperLeg'+suffix].getObjectByName('thigh'+suffix) as THREE.Mesh;
   tear(thigh,'zombie-knee-rip'+suffix,(x,y,z)=>z>0&&(x/.038)**2+((y+(suffix==='R'?.345:.27))/.050)**2<1,skin);
 }
 for(const suffix of ['R','L']){
   const foot=nodes['foot'+suffix],shoe=foot.getObjectByName('shoe'+suffix) as THREE.Mesh|undefined;
   const sock=foot.getObjectByName('sock'+suffix) as THREE.Mesh|undefined;
   if(sock){
     tear(sock,'zombie-sock-hole'+suffix,(x,y,z)=>z>.09&&y>-.065&&((x+.013)/.035)**2+((z-.135)/.05)**2<1,skin,.92);
     const cuff=nodes['lowerLeg'+suffix].getObjectByName('sock-cuff'+suffix) as THREE.Mesh|undefined;
     tear(cuff,'zombie-sock-ragged-cuff'+suffix,(x,y,z)=>y>.096+.01*Math.sin(x*160+z*100),skin);
     const rib=nodes['lowerLeg'+suffix].getObjectByName('sock-rib'+suffix);if(rib)rib.visible=false;
   }
   if(shoe&&spec.outfit.shoes!=='heels'&&spec.outfit.shoes!=='socks'){
     tear(shoe,'zombie-shoe-hole'+suffix,(x,y,z)=>z>.11&&y>-.055&&((x-(suffix==='R'?-.022:.015))/.028)**2+((z-.145)/.045)**2<1,skin,.92);
     const shaft=nodes['lowerLeg'+suffix].getObjectByName('boot-shaft'+suffix) as THREE.Mesh|undefined;
     tear(shaft,'zombie-boot-rip'+suffix,(x,y,z)=>z>0&&Math.abs(x)<.028&&y>.035&&y<.09,skin);
   }
 }
}
