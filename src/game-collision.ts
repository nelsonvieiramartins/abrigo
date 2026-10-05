import {randomCharacter,type CharacterSpec} from './schema';

export type GameObstacle={id:string;x:number;z:number;radius:number;yaw:number;spec?:CharacterSpec};
export function proceduralTestCharacters(seed:string):GameObstacle[]{
 return gameTestObstacles(.4).map((o,i)=>{const spec=randomCharacter(`${seed}:npc:${i}`);return {...o,id:spec.name,spec,radius:characterCollisionRadius(spec)};});
}
// Conservative body footprint: clothing/arms fit inside a rounded ground collider.
export const characterCollisionRadius=(s:CharacterSpec)=>.28+s.body.shoulders*.10+s.body.build*.06;
export function gameTestObstacles(radius:number):GameObstacle[]{
 return [[-1.5,-1.8],[0,-1.8],[1.5,-1.8],[-2.3,0],[2.3,0],[-1.5,1.8],[0,1.8],[1.5,1.8]].map(([x,z],i)=>({id:`Personagem ${i+1}`,x,z,radius,yaw:i*Math.PI/4}));
}
export function resolveGameMovement(start:{x:number;z:number},target:{x:number;z:number},radius:number,obstacles:readonly GameObstacle[]){
 let x=start.x,z=start.z;const contacts=new Set<string>();
 const dx=target.x-start.x,dz=target.z-start.z;
 // Small bounded steps prevent sprinting through a collider; projection allows sliding.
 const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.06));
 for(let step=0;step<steps;step++){
  x+=dx/steps;z+=dz/steps;
  for(let pass=0;pass<6;pass++){
   let overlap=false;
   for(const o of obstacles){
    const vx=x-o.x,vz=z-o.z,d=Math.hypot(vx,vz),limit=radius+o.radius;
    if(d>=limit)continue;
    contacts.add(o.id);overlap=true;
    let nx=vx,nz=vz,n=d;
    if(n<1e-8){nx=start.x-o.x;nz=start.z-o.z;n=Math.hypot(nx,nz);if(n<1e-8){nx=1;nz=0;n=1;}}
    x=o.x+nx/n*(limit+1e-6);z=o.z+nz/n*(limit+1e-6);
   }
   if(!overlap)break;
  }
 }
 return {x,z,contacts:[...contacts]};
}
