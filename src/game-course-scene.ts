import * as THREE from 'three';
import type {GameCourse} from './game-course';

export function createCourseScene(course:GameCourse){
 const root=new THREE.Group();root.name='Circuito de testes';
 const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
 const labels=new Map<string,THREE.Sprite>();
 const material=(color:string)=>{const m=new THREE.MeshStandardMaterial({color,roughness:1});materials.add(m);return m;};
 const mesh=(geometry:THREE.BufferGeometry,color:string)=>{geometries.add(geometry);const m=new THREE.Mesh(geometry,material(color));m.castShadow=true;m.receiveShadow=true;root.add(m);return m;};
 const half=course.size/2,shape=new THREE.Shape();shape.moveTo(-half,-half);shape.lineTo(half,-half);shape.lineTo(half,half);shape.lineTo(-half,half);shape.closePath();
 for(const p of course.pits){const hole=new THREE.Path();hole.moveTo(p.x-p.width/2,-p.z-p.depth/2);hole.lineTo(p.x-p.width/2,-p.z+p.depth/2);hole.lineTo(p.x+p.width/2,-p.z+p.depth/2);hole.lineTo(p.x+p.width/2,-p.z-p.depth/2);hole.closePath();shape.holes.push(hole);const bottom=mesh(new THREE.BoxGeometry(p.width,.12,p.depth),'#182326');bottom.position.set(p.x,-2,p.z);}
 const floor=mesh(new THREE.ShapeGeometry(shape),'#35463b');floor.rotation.x=-Math.PI/2;floor.position.y=-.06;floor.castShadow=false;
 // Grid marks avoid spanning the real opening between the platforms.
 const lines:THREE.Vector3[]=[];for(let x=-half;x<=half;x++)for(let z=-half;z<half;z++){if(course.pits.some(p=>Math.abs(x-p.x)<=p.width/2&&Math.abs(z+.5-p.z)<p.depth/2))continue;lines.push(new THREE.Vector3(x,-.055,z),new THREE.Vector3(x,-.055,z+1));}
 for(let z=-half;z<=half;z++)for(let x=-half;x<half;x++){if(course.pits.some(p=>Math.abs(x+.5-p.x)<p.width/2&&Math.abs(z-p.z)<=p.depth/2))continue;lines.push(new THREE.Vector3(x,-.055,z),new THREE.Vector3(x+1,-.055,z));}
 const gridGeo=new THREE.BufferGeometry().setFromPoints(lines),gridMat=new THREE.LineBasicMaterial({color:'#506354',transparent:true,opacity:.45});geometries.add(gridGeo);materials.add(gridMat);root.add(new THREE.LineSegments(gridGeo,gridMat));
 for(const b of course.boxes){if(b.id==='Tronco de madeira')continue;const m=mesh(new THREE.BoxGeometry(b.width,b.top-b.bottom,b.depth),b.color);m.position.set(b.x,(b.top+b.bottom)/2-.06,b.z);}
 for(const r of course.ramps){const geometry=new THREE.BoxGeometry(r.width,1,r.depth);const pos=geometry.getAttribute('position');for(let i=0;i<pos.count;i++){const t=(r.depth/2-pos.getZ(i))/r.depth;pos.setY(i,pos.getY(i)>0?r.near+(r.far-r.near)*t-.06:-.06);}geometry.computeVertexNormals();const m=mesh(geometry,r.color);m.position.set(r.x,0,r.z);}
 for(const point of course.points){
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=96;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#17221ee8';ctx.fillRect(0,0,768,96);ctx.fillStyle='#dae8b9';ctx.font='bold 32px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(point.label,384,48);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;textures.add(texture);const m=new THREE.SpriteMaterial({map:texture,depthTest:true,toneMapped:false});materials.add(m);const label=new THREE.Sprite(m);label.position.set(point.x,3.3,point.z);label.scale.set(3,.375,1);label.visible=point.id==='start';labels.set(point.id,label);root.add(label);
 }
 return {root,setSector(id:string){labels.forEach((label,key)=>label.visible=key===id);},dispose(){root.removeFromParent();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}};
}
export function animationJumpLift(motion:string,time:number){
 if(['jumpWalk','jumpRun','jumpSprint'].includes(motion)){const cycle=motion==='jumpSprint'?2.05:motion==='jumpRun'?2.35:2.8,t=time%cycle;if(t<=.62||t>=1.3)return 0;return Math.sin(Math.PI*(t-.62)/.68)*(motion==='jumpSprint'?.36:motion==='jumpRun'?.30:.23);}
 if(motion==='jump'){const t=time%2.6,smooth=(v:number)=>v*v*v*(v*(v*6-15)+10);if(t<.62||t>1.2)return 0;return t<.92?.3*smooth((t-.62)/.30):.3*(1-smooth((t-.92)/.28));}
 return 0;
}
