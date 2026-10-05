import * as THREE from 'three';
import type {Motion} from './schema';
import {ATTACK_SPEED,isAttack} from './attack-timing';
import type {CourseBox} from './game-course';

export const WOOD_TARGET={x:-5,z:5,radius:.34,height:1.65,hits:6};
type Point={x:number;y:number;z:number};
// Segment vs finite cylinder: sweeps between frames cannot miss a fast blade.
export function woodContact(a:Point,b:Point):Point|null{
 const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,ox=a.x-WOOD_TARGET.x,oz=a.z-WOOD_TARGET.z;
 let lo=0,hi=1;
 if(Math.abs(dy)<1e-9){if(a.y<.16||a.y>WOOD_TARGET.height-.06)return null;}
 else{const t0=(.16-a.y)/dy,t1=(WOOD_TARGET.height-.06-a.y)/dy;lo=Math.max(lo,Math.min(t0,t1));hi=Math.min(hi,Math.max(t0,t1));}
 const A=dx*dx+dz*dz,B=2*(ox*dx+oz*dz),C=ox*ox+oz*oz-WOOD_TARGET.radius**2;
 if(A<1e-12){if(C>0)return null;}
 else{const disc=B*B-4*A*C;if(disc<0)return null;const d=Math.sqrt(disc);lo=Math.max(lo,(-B-d)/(2*A));hi=Math.min(hi,(-B+d)/(2*A));}
 if(lo>hi)return null;return {x:a.x+dx*lo,y:a.y+dy*lo,z:a.z+dz*lo};
}
export function createWoodDamage(){
 let hits=0,spent=false,lastTime=-1,lastMotion:Motion='idle',previous:Point[]=[];
 return {
  get hits(){return hits;},get fallen(){return hits>=WOOD_TARGET.hits;},
  reset(){hits=0;spent=false;lastTime=-1;lastMotion='idle';previous=[];},
  sample(motion:Motion,time:number,points:Point[]):Point|null{
   if(!isAttack(motion)||!points.length){lastMotion=motion;lastTime=time;previous=[];spent=false;return null;}
   const newStrike=!isAttack(lastMotion)||time<lastTime-1e-6;
   if(newStrike){spent=false;previous=[];}
   const advancing=newStrike||time>lastTime+1e-7,prior=previous;
   previous=points.map(p=>({...p}));lastMotion=motion;lastTime=time;
   const phase=time*ATTACK_SPEED;
   if(!advancing||spent||hits>=WOOD_TARGET.hits||phase<.67||phase>1.12)return null;
   for(let i=0;i<points.length;i++){
    const a=prior[i]??points[i],b=points[i];
    // Do not sweep across the arena when teleporting or replacing an item.
    if(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)>2)continue;
    const contact=woodContact(a,b);if(contact){hits++;spent=true;return contact;}
   }
   return null;
  },
 };
}
export function createWoodTest(collider:CourseBox){
 const root=new THREE.Group(),pivot=new THREE.Group();root.position.set(WOOD_TARGET.x,-.06,WOOD_TARGET.z);root.name='Tronco de teste';pivot.position.y=.22;root.add(pivot);
 const geometry=new THREE.CylinderGeometry(WOOD_TARGET.radius*.94,WOOD_TARGET.radius,WOOD_TARGET.height-.22,24,32);
 geometry.translate(0,(WOOD_TARGET.height-.22)/2,0);
 // Modest vertical bark ridges, deterministic and matching at the cylinder seam.
 const bark=geometry.attributes.position;for(let i=0;i<bark.count;i++){const x=bark.getX(i),z=bark.getZ(i),r=Math.hypot(x,z);if(r>.1){const a=Math.atan2(z,x),s=1+.015*Math.sin(a*12)+.01*Math.sin(bark.getY(i)*9+a*7);bark.setX(i,x*s);bark.setZ(i,z*s);}}geometry.computeVertexNormals();
 const original=Float32Array.from(geometry.attributes.position.array),colors=new Float32Array(geometry.attributes.position.count*3);
 for(let i=0;i<geometry.attributes.position.count;i++){
  const y=original[i*3+1],cap=y<.001||y>WOOD_TARGET.height-.221;
  const c=new THREE.Color(cap?'#d4ab72':i%5===0?'#65432b':'#89603b');c.toArray(colors,i*3);
 }
 geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
 const originalColors=Float32Array.from(colors);
 const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1});
 const trunk=new THREE.Mesh(geometry,material);trunk.castShadow=trunk.receiveShadow=true;pivot.add(trunk);
 const stumpGeo=new THREE.CylinderGeometry(WOOD_TARGET.radius,WOOD_TARGET.radius*1.05,.22,24),stumpMat=new THREE.MeshStandardMaterial({color:'#aa7a49',roughness:1});
 const stump=new THREE.Mesh(stumpGeo,stumpMat);stump.position.y=.11;stump.castShadow=stump.receiveShadow=true;root.add(stump);
 const chipGeo=new THREE.BoxGeometry(.035,.025,.07),chipMat=new THREE.MeshStandardMaterial({color:'#d5af78',roughness:1});
 const chips:Array<{mesh:THREE.Mesh;velocity:THREE.Vector3;life:number}>=[],damage=createWoodDamage();
 let blade:THREE.Mesh|null=null,bladeRoot:THREE.Object3D|null=null,localSamples:THREE.Vector3[]=[],fallTime=0;
 const fallAxis=new THREE.Vector3(1,0,0);
 const cuts:Array<{y:number;angle:number}>=[];
 const findBlade=(model:THREE.Object3D)=>{bladeRoot=model;blade=null;localSamples=[];model.traverse(o=>{if(o instanceof THREE.Mesh&&o.userData.woodCuttingBlade)blade=o;});
  if(blade){const mesh=blade as THREE.Mesh,p=mesh.geometry.attributes.position;const unique=new Set<string>();for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i),key=v.toArray().map(n=>n.toFixed(4)).join(',');if(!unique.has(key)){unique.add(key);localSamples.push(v);}}}
 };
 const carve=()=>{
  const p=geometry.attributes.position,c=geometry.attributes.color;
  for(let i=0;i<p.count;i++){
   const x=original[i*3],y=original[i*3+1],z=original[i*3+2],angle=Math.atan2(z,x);
   let depth=0;for(const cut of cuts){const delta=Math.atan2(Math.sin(angle-cut.angle),Math.cos(angle-cut.angle));depth+=(.013+.092*Math.max(0,1-Math.abs(delta)/1.35))*Math.max(0,1-Math.abs(y+.22-cut.y)/.24);}
   const scale=Math.max(.12,1-depth/WOOD_TARGET.radius);p.setXYZ(i,x*scale,y,z*scale);
   if(depth>.005)c.setXYZ(i,.78,.57,.32);
  }
  p.needsUpdate=true;c.needsUpdate=true;geometry.computeVertexNormals();
 };
 return {root,
  get status(){return damage.fallen?'Tronco cortado · reinicie para repetir':`Madeira: ${Math.round(100*(1-damage.hits/WOOD_TARGET.hits))}% · golpes ${damage.hits}/${WOOD_TARGET.hits}`;},
  update(dt:number,model:THREE.Object3D,motion:Motion,time:number,playing:boolean){
   if(!playing)return;if(bladeRoot!==model)findBlade(model);model.updateWorldMatrix(true,true);
   const points=blade?localSamples.map(p=>p.clone().applyMatrix4(blade!.matrixWorld)):[];
   const hit=damage.sample(motion,time,points);
   if(hit){cuts.push({y:hit.y+.06,angle:Math.atan2(hit.z-WOOD_TARGET.z,hit.x-WOOD_TARGET.x)});carve();
    for(let i=0;i<10;i++){const mesh=new THREE.Mesh(chipGeo,chipMat);mesh.position.set(hit.x-WOOD_TARGET.x,hit.y+.06,hit.z-WOOD_TARGET.z);root.add(mesh);chips.push({mesh,velocity:new THREE.Vector3(Math.sin(i*2.4)*.9,1+i*.08,Math.cos(i*2.4)*.9),life:.8});}
    if(damage.fallen){collider.top=.22;const angle=cuts[cuts.length-1].angle;fallAxis.set(-Math.sin(angle),0,Math.cos(angle));}
   }
   if(damage.fallen){fallTime=Math.min(1.1,fallTime+dt);const t=THREE.MathUtils.smoothstep(fallTime,0,1.1);pivot.quaternion.setFromAxisAngle(fallAxis,Math.PI/2*t);pivot.position.y=.22+(WOOD_TARGET.radius-.22)*t;}
   for(let i=chips.length-1;i>=0;i--){const c=chips[i];c.life-=dt;c.velocity.y-=5*dt;c.mesh.position.addScaledVector(c.velocity,dt);c.mesh.rotation.x+=dt*4;if(c.life<=0){c.mesh.removeFromParent();chips.splice(i,1);}}
  },
  reset(){damage.reset();cuts.length=0;fallTime=0;pivot.rotation.set(0,0,0);pivot.position.y=.22;geometry.attributes.position.array.set(original);geometry.attributes.position.needsUpdate=true;geometry.attributes.color.array.set(originalColors);geometry.attributes.color.needsUpdate=true;geometry.computeVertexNormals();collider.top=WOOD_TARGET.height;chips.forEach(c=>c.mesh.removeFromParent());chips.length=0;bladeRoot=null;},
  dispose(){root.removeFromParent();[geometry,stumpGeo,chipGeo].forEach(g=>g.dispose());[material,stumpMat,chipMat].forEach(m=>m.dispose());},
 };
}
