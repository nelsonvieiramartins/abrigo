import * as THREE from 'three';
import type {CreatureSpec, CreatureMotion, CreatureDetail} from './creature-schema';

type Context = {
  body:THREE.Group; nodes:Record<string,THREE.Object3D>;
  sockets:Record<string,THREE.Object3D>;
  geometries:Set<THREE.BufferGeometry>; materials:Set<THREE.Material>;
};
type Leg = {base:THREE.Vector3;foot:THREE.Vector3;pole:THREE.Vector3;l1:number;l2:number;
  femur:THREE.Mesh;tibia:THREE.Mesh;joint:THREE.Mesh;index:number;side:number};

/** All geometry is generated here. +Y up, +Z forward, metres, floor at Y=0.
 * High means a more accurate silhouette, not smooth shading.
 * Fixed ring topology and explicit leg landmarks keep the reference reproducible.
 */
export function buildDetailedSpider(spec:CreatureSpec,c:Context,detail:CreatureDetail='high') {
  const {body,nodes,sockets,geometries,materials}=c;
  const shape=spec.spider!;
  const bulk=.85+spec.body.bulk*.3, height=.42*shape.bodyHeight;
  const material=(color:string)=>{const m=new THREE.MeshStandardMaterial({color,
    roughness:.93,metalness:0,flatShading:true,vertexColors:true});materials.add(m);return m;};
  const shell=material(spec.appearance.primary),jointMat=material(spec.appearance.secondary),black=material(spec.appearance.eyes);
  const add=(name:string,g:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Object3D=body)=>{
    // One normal and colour per face. No random noise changing the silhouette.
    const geo=g.index?g.toNonIndexed():g;
    if(geo!==g)g.dispose();geo.computeVertexNormals();
    const p=geo.getAttribute('position'),color:number[]=[];
    for(let i=0;i<p.count;i+=3){const f=i/3,v=1-spec.appearance.markings*(.045+.055*(.5+.5*Math.sin(f*2.39996)));
      for(let j=0;j<3;j++)color.push(v,v,v);}
    geo.setAttribute('color',new THREE.Float32BufferAttribute(color,3));
    geometries.add(geo);const mesh=new THREE.Mesh(geo,m);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  };
  // Offset rings alternate their diagonals: broad, nonuniform triangular planes.
  const volume=(name:string,parent:THREE.Object3D,center:number[],size:number[],m=shell)=>{
    const rows=[[-1,0],[-.80,.57],[-.38,.92],[.15,1],[.65,.78],[1,0]],n=detail==='high'?10:8;
    const vertices:number[]=[],indices:number[]=[];
    rows.forEach(([y,r],i)=>{for(let j=0;j<n;j++){
      const angle=2*Math.PI*(j+(i%2)*.25)/n;
      vertices.push(center[0]+Math.cos(angle)*r*size[0],center[1]+y*size[1],center[2]+Math.sin(angle)*r*size[2]);
    }});
    for(let i=0;i<rows.length-1;i++)for(let j=0;j<n;j++){
      const a=i*n+j,b=i*n+(j+1)%n,d=(i+1)*n+j,e=(i+1)*n+(j+1)%n;
      indices.push(a,d,b,b,d,e);
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);
    // Rings ascend +Y; triangles are wound outward. Remove degenerate pole faces.
    const clean:number[]=[];for(let i=0;i<indices.length;i+=3){const a=new THREE.Vector3().fromArray(vertices,indices[i]*3),b=new THREE.Vector3().fromArray(vertices,indices[i+1]*3),d=new THREE.Vector3().fromArray(vertices,indices[i+2]*3);
      if(b.sub(a).cross(d.sub(a)).lengthSq()>1e-14)clean.push(indices[i],indices[i+1],indices[i+2]);}
    g.setIndex(clean);return add(name,g,m,parent);
  };
  const group=(name:string,parent:THREE.Object3D,pos:number[])=>{const g=new THREE.Group();g.name=name;g.position.fromArray(pos);parent.add(g);nodes[name]=g;return g;};
  volume('abdomen',body,[0,height+.20,-.32],[.37*bulk*shape.abdomenWidth,.34*shape.abdomenHeight,.45*shape.abdomenLength]);
  const head=group('head',body,[0,height-.015,.30]);
  volume('cephalothorax',head,[0,0,0],[.25*bulk*shape.headWidth,.19*shape.headHeight,.30*shape.headLength]);
  // Reference has two pronounced dark eyes. They sit on the front shell.
  for(const side of [-1,1]){
    const eye=add('eye'+(side<0?'R':'L'),new THREE.IcosahedronGeometry(1,0),black,head);
    eye.position.set(side*.105*shape.headWidth,.035*shape.headHeight,.267*shape.headLength);
    eye.scale.set(.066*shape.eyeSize,.067*shape.eyeSize,.047*shape.eyeSize);
  }
  const segment=(name:string,r0:number,r1:number,length:number,m=shell,parent:THREE.Object3D=body)=>{
    // Hexagonal section, swollen knuckle and tapered end rather than round cylinders.
    const radial=detail==='high'?6:4,rows=[[0,r0],[.17,r0*1.16],[.74,r0*.45+r1*.55],[1,r1]],v:number[]=[],idx:number[]=[];
    rows.forEach(([t,r])=>{for(let j=0;j<radial;j++){const a=(j+.5)*2*Math.PI/radial;v.push(Math.cos(a)*r,t*length,Math.sin(a)*r);}});
    for(let i=0;i<3;i++)for(let j=0;j<radial;j++){const a=i*radial+j,b=i*radial+(j+1)%radial,d=a+radial,e=b+radial;idx.push(a,d,b,b,d,e);}
    for(const end of [0,3]){const center=v.length/3;v.push(0,rows[end][0]*length,0);for(let j=0;j<radial;j++){const a=end*radial+j,b=end*radial+(j+1)%radial;idx.push(center,end===0?a:b,end===0?b:a);}}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setIndex(idx);return add(name,g,m,parent);
  };
  const align=(mesh:THREE.Mesh,a:THREE.Vector3,b:THREE.Vector3)=>{mesh.position.copy(a);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());};
  // Short paired chelicerae, distinct from the eight walking legs.
  for(const side of [-1,1]){
    const p=group('fang'+(side<0?'R':'L'),head,[side*.115*shape.headWidth,-.09*shape.headHeight,.25*shape.headLength]);
    const a=new THREE.Vector3(),b=new THREE.Vector3(side*.035,-.075,.08),d=new THREE.Vector3(side*.018,-.18,.13);
    align(segment('fang-base',.043,.031,a.distanceTo(b),shell,p),a,b);
    align(segment('fang-tip',.031,.001,b.distanceTo(d),shell,p),b,d);
  }
  const legs:Leg[]=[];
  // Front -> rear, mirrored. Values are anatomical landmarks, not random placements.
  const landmarks=[{z:.40,kx:.57,kz:.79,fx:.69,fz:1.02,ky:.56},
    {z:.24,kx:.78,kz:.43,fx:.98,fz:.54,ky:.69},
    {z:.06,kx:.79,kz:-.14,fx:1.00,fz:-.27,ky:.73},
    {z:-.10,kx:.59,kz:-.60,fx:.77,fz:-.83,ky:.77}];
  for(const side of [-1,1])landmarks.forEach((p,i)=>{
    const root=new THREE.Vector3(side*.18*bulk,height,p.z);
    const base=new THREE.Vector3(side*.29*bulk,height+.025,p.z);
    const knee=new THREE.Vector3(side*p.kx*shape.legSpread,p.ky*shape.bodyHeight,p.kz*shape.legLength);
    const foot=new THREE.Vector3(side*p.fx*shape.legSpread,.009,p.fz*shape.legLength);
    // Length multiplier extends the entire horizontal footprint, including lateral span.
    base.x*=shape.legLength;knee.x*=shape.legLength;foot.x*=shape.legLength;
    const id='leg'+(side<0?'R':'L')+(i+1);
    const pivot=group(id,body,root.toArray());
    align(segment(id+'Coxa',.049*shape.legThickness,.043*shape.legThickness,root.distanceTo(base),shell,pivot),new THREE.Vector3(),base.clone().sub(root));
    const l1=base.distanceTo(knee),l2=knee.distanceTo(foot);
    const femur=segment(id+'Femur',.057*shape.legThickness,.047*shape.legThickness,l1);
    const tibia=segment(id+'Tibia',.047*shape.legThickness,.008*shape.legThickness,l2);
    const joint=add(id+'Knee',new THREE.IcosahedronGeometry(.060*shape.legThickness,0),jointMat);
    nodes[id+'Knee']=joint;nodes[id+'Femur']=femur;nodes[id+'Tibia']=tibia;
    legs.push({base,foot,pole:knee.clone().sub(base),l1,l2,femur,tibia,joint,index:i,side});
  });
  for(const [name,parent,pos] of [['head',head,[0,0,0]],['mouth',head,[0,-.10,.34]],['back',body,[0,height+.52,-.32]],['target',body,[0,height,0]]] as const){
    const s=new THREE.Object3D();s.name='socket-'+name;s.position.fromArray(pos);parent.add(s);sockets[name]=s;
  }
  const up=new THREE.Vector3(0,1,0);
  const update=(time:number,motion:CreatureMotion)=>{
    const active=motion==='move'||motion==='run',speed=motion==='run'?3.6:2.2;
    // Ground targets are expressed relative to body: no global translation here.
    body.position.y=active?Math.sin(time*speed*4*Math.PI)*.006:0;
    head.rotation.x=motion==='attack'?-.10*(.5+.5*Math.sin(time*7)):0;
    for(const leg of legs){
      const target=leg.foot.clone();
      if(active){
        const phase=(time*speed+(leg.index%2)*.5+(leg.side>0?.5:0))%1;
        const stride=.12*shape.legLength*(motion==='run'?1.35:1);
        if(phase<.6)target.z+=stride*(1-2*phase/.6);
        else{const u=(phase-.6)/.4;target.z+=stride*(-1+2*u);target.y+=Math.sin(u*Math.PI)*.075;}
      }
      target.y-=body.position.y;
      const delta=target.clone().sub(leg.base),dist=THREE.MathUtils.clamp(delta.length(),Math.abs(leg.l1-leg.l2)+1e-5,leg.l1+leg.l2-1e-5),axis=delta.normalize();
      const along=(leg.l1*leg.l1-leg.l2*leg.l2+dist*dist)/(2*dist);
      const pole=leg.pole.clone().addScaledVector(axis,-leg.pole.dot(axis));
      if(pole.lengthSq()<1e-10)pole.copy(up).addScaledVector(axis,-up.dot(axis));pole.normalize();
      const knee=leg.base.clone().addScaledVector(axis,along).addScaledVector(pole,Math.sqrt(Math.max(0,leg.l1*leg.l1-along*along)));
      const reachable=leg.base.clone().addScaledVector(axis,dist);
      align(leg.femur,leg.base,knee);align(leg.tibia,knee,reachable);leg.joint.position.copy(knee);
    }
  };
  return update;
}
