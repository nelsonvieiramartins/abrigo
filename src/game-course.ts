import {WOOD_TARGET} from './game-wood';
export type CourseBox={id:string;x:number;z:number;width:number;depth:number;bottom:number;top:number;color:string};
export type CourseRamp={id:string;x:number;z:number;width:number;depth:number;near:number;far:number;color:string};
export type CoursePit={id:string;x:number;z:number;width:number;depth:number};
export type CoursePoint={id:string;label:string;x:number;z:number;yaw?:number};
export type GameCourse={size:number;boxes:CourseBox[];ramps:CourseRamp[];pits:CoursePit[];points:CoursePoint[]};
export function createGameCourse(height=1.8):GameCourse{
 const boxes:CourseBox[]=[
  {id:'Tronco de madeira',x:WOOD_TARGET.x,z:WOOD_TARGET.z,width:WOOD_TARGET.radius*2,depth:WOOD_TARGET.radius*2,bottom:0,top:WOOD_TARGET.height,color:'#89603b'},
  {id:'Plataforma de partida',x:6,z:-10,width:4,depth:4,bottom:0,top:1,color:'#777963'},
  {id:'Plataforma de chegada',x:6,z:-15,width:4,depth:4,bottom:0,top:1,color:'#777963'},
  {id:'Passagem baixa — agache',x:-7,z:-8,width:3.6,depth:5,bottom:height*.88,top:height*.88+.25,color:'#8c7658'},
  ...[-1,1].map(side=>({id:'Pilar da passagem',x:-7+side*1.9,z:-8,width:.3,depth:5,bottom:0,top:height*.88+.25,color:'#72634d'})),
  {id:'Muro alto',x:-7,z:7,width:5,depth:.5,bottom:0,top:2.2,color:'#687174'},
  {id:'Caixa baixa — salte',x:6,z:6,width:2.5,depth:.7,bottom:0,top:.35,color:'#a18050'},
  {id:'Caixa média',x:9,z:5,width:1.5,depth:1.5,bottom:0,top:.65,color:'#997548'},
  {id:'Caixa alta',x:11,z:8,width:2,depth:2,bottom:0,top:1.5,color:'#826549'},
  {id:'Parede do zigue-zague',x:-12,z:10,width:.5,depth:6,bottom:0,top:2,color:'#586c65'},
  {id:'Parede do zigue-zague',x:-9,z:12,width:.5,depth:5,bottom:0,top:2,color:'#586c65'},
 ];
 return {size:48,boxes,ramps:[
  {id:'Rampa de subida',x:6,z:-6,width:4,depth:4,near:0,far:1,color:'#84916b'},
  {id:'Rampa de descida',x:6,z:-19,width:4,depth:4,near:1,far:0,color:'#84916b'},
 ],pits:[{id:'Vão entre plataformas',x:6,z:-12.5,width:4,depth:1}],points:[
  {id:'start',label:'Início / personagens HD',x:0,z:0},
  {id:'ramps',label:'Rampas e plataformas',x:6,z:-3,yaw:Math.PI},
  {id:'jump',label:'Salto entre plataformas',x:6,z:-10,yaw:Math.PI},
  {id:'crouch',label:'Passagem baixa — agachar',x:-7,z:-4,yaw:Math.PI},
  {id:'boxes',label:'Caixas — salto e colisão',x:6,z:3},
  {id:'maze',label:'Muros e zigue-zague',x:-10,z:5},
  {id:'wood',label:'Corte de madeira — machado',x:-5,z:4.2,yaw:0},
  {id:'combat',label:'Combate por ondas',x:0,z:16,yaw:Math.PI},
 ]};
}
export const insideRect=(x:number,z:number,r:{x:number;z:number;width:number;depth:number},pad=0)=>Math.abs(x-r.x)<r.width/2+pad&&Math.abs(z-r.z)<r.depth/2+pad;
export function courseGround(course:GameCourse,x:number,z:number){
 let ground=course.pits.some(p=>insideRect(x,z,p))?null:0;
 for(const b of course.boxes)if(b.bottom===0&&insideRect(x,z,b))ground=Math.max(ground??-Infinity,b.top);
 for(const r of course.ramps)if(insideRect(x,z,r)){const t=Math.max(0,Math.min(1,(r.z+r.depth/2-z)/r.depth));ground=Math.max(ground??-Infinity,r.near+(r.far-r.near)*t);}
 return ground;
}
export function courseCeiling(course:GameCourse,x:number,z:number,radius:number){return Math.min(Infinity,...course.boxes.filter(b=>b.bottom>0&&insideRect(x,z,b,radius)).map(b=>b.bottom));}
export function createCoursePhysics(course:GameCourse,height:number,radius:number){
 let y=0,vy=0,grounded=true,checkpoint={x:0,z:0},pendingJump=false,lowPassageOccupied=false;
 return {
  reset(x=0,z=0){checkpoint={x,z};y=courseGround(course,x,z)??0;vy=0;grounded=true;pendingJump=false;lowPassageOccupied=false;return y;},
  needsCrouch(x:number,z:number){return lowPassageOccupied&&y+height>courseCeiling(course,x,z,radius);},
  step(dt:number,start:{x:number;z:number},target:{x:number;z:number},crouched:boolean,jumpStarted:boolean,actionTime:number,enabled:boolean,jumping=true){
   const contacts=new Set<string>();let x=start.x,z=start.z;
   if(!jumping)pendingJump=false;else if(jumpStarted&&grounded)pendingJump=true;
   if(pendingJump&&actionTime>=.62){pendingJump=false;if(!crouched&&(!enabled||y+height+.12<courseCeiling(course,x,z,radius))){vy=4.8;grounded=false;}}
   const bodyHeight=height*(crouched?.82:1),steps=Math.max(1,Math.ceil(Math.hypot(target.x-x,target.z-z)/.05));
   const dx=(target.x-x)/steps,dz=(target.z-z)/steps;
   for(let i=0;i<steps;i++){
    const prev={x,z};x+=dx;z+=dz;
    if(enabled)for(let pass=0;pass<4;pass++)for(const b of course.boxes){
     if(y>=b.top-.025||y+bodyHeight<=b.bottom+.005)continue;
     const qx=Math.max(b.x-b.width/2,Math.min(b.x+b.width/2,x)),qz=Math.max(b.z-b.depth/2,Math.min(b.z+b.depth/2,z));
     const nx=x-qx,nz=z-qz,d=Math.hypot(nx,nz);if(d>=radius)continue;
     // Low steps can be walked onto; ramps are continuous supporting surfaces.
     if(b.bottom===0&&grounded&&b.top-y<=.18)continue;
     contacts.add(b.id);
     if(d>1e-8){x=qx+nx/d*(radius+1e-5);z=qz+nz/d*(radius+1e-5);}
     else{x=prev.x;z=prev.z;}
    }
    const support=courseGround(course,x,z);
    if(grounded){if(support!==null&&support-y<=.18&&support-y>=-.18)y=support;else grounded=false;}
   }
   if(!grounded){vy-=12*dt;y+=vy*dt;
    const ceiling=enabled?courseCeiling(course,x,z,radius):Infinity;if(vy>0&&y+bodyHeight>=ceiling){y=ceiling-bodyHeight;vy=0;contacts.add('Teto da passagem');}
    const support=courseGround(course,x,z);if(vy<=0&&support!==null&&y<=support){y=support;vy=0;grounded=true;}
   }
   let respawned=false;if(y<-3){x=checkpoint.x;z=checkpoint.z;y=courseGround(course,x,z)??0;vy=0;grounded=true;pendingJump=false;respawned=true;contacts.add('Queda — retorno ao setor');}
   if(crouched&&y+height>courseCeiling(course,x,z,0))lowPassageOccupied=true;
   if(y+height<=courseCeiling(course,x,z,radius)||respawned)lowPassageOccupied=false;
   return {x,z,y,grounded,contacts:[...contacts],respawned};
  },
 };
}
