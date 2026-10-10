import {TARANTULA_SDF_ATTACK_DURATION,TARANTULA_SDF_ATTACK_IMPACT,TARANTULA_SDF_ATTACK_COOLDOWN} from './tarantula-sdf-detail';
import {RAT_SDF_ATTACK_DURATION,RAT_SDF_ATTACK_IMPACT,RAT_SDF_ATTACK_COOLDOWN} from './rat-sdf-detail';
import {RAT_RUN_SPEED} from './rat-detail';
import {BOAR_ATTACK_DURATION,BOAR_ATTACK_IMPACT,BOAR_ATTACK_COOLDOWN} from './boar-detail';
import {WOLF_SDF_ATTACK_DURATION,WOLF_SDF_ATTACK_IMPACT,WOLF_SDF_ATTACK_COOLDOWN} from './wolf-sdf-detail';
import {CREATURE_SPECIES,presetCreature,type CreatureSpecies,type CreatureMotion,type CreatureSpec} from './creature-schema';
import {ATTACK_SPEED,isAttack} from './attack-timing';
import type {GameFrame} from './game-controls';
import {resolveGameMovement,type GameObstacle} from './game-collision';
import {createCoursePhysics,courseGround,type GameCourse} from './game-course';
import {WOLF_ATTACK_DURATION,WOLF_ATTACK_IMPACT,WOLF_ATTACK_COOLDOWN} from './wolf-attack';
import {WEREWOLF_ATTACK_DURATION,WEREWOLF_ATTACK_IMPACT,WEREWOLF_ATTACK_COOLDOWN} from './werewolf-attack';
import {BAT_ATTACK_DURATION,BAT_ATTACK_IMPACT,BAT_ATTACK_COOLDOWN} from './bat-attack';
import {SNAKE_ATTACK_DURATION,SNAKE_ATTACK_IMPACT,SNAKE_ATTACK_COOLDOWN} from './snake-attack';

export const COMBAT_STORE='abrigo-combat-waves-v1';
export const GAME_CREATURE_SCALE=.8;
export type CombatConfig={version:1;waves:{enemies:Partial<Record<CreatureSpecies,number>>}[];interval:number;health:number;damage:number};
export type CombatEnemy={id:string;spec:CreatureSpec;x:number;z:number;y:number;yaw:number;radius:number;health:number;motion:CreatureMotion;time:number;hit:boolean;cooldown:number};
export const defaultCombatConfig=():CombatConfig=>({version:1,waves:[{enemies:{skeleton:2}},{enemies:{skeleton:2,spider:2}},{enemies:{werewolf:1,wolf:2}}],interval:4,health:100,damage:30});
export function validateCombatConfig(raw:unknown):CombatConfig{
 const q=raw as CombatConfig;if(!q||q.version!==1||!Array.isArray(q.waves)||q.waves.length<1||q.waves.length>10)throw Error('Configure de 1 a 10 ondas.');
 const number=(n:unknown,min:number,max:number)=>{if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max)throw Error('Valor de combate inválido.');return n;};
 const waves=q.waves.map(w=>{if(!w?.enemies||typeof w.enemies!=='object')throw Error('Onda inválida.');const enemies:Partial<Record<CreatureSpecies,number>>={};let total=0;
  for(const [key,value] of Object.entries(w.enemies)){if(!Object.hasOwn(CREATURE_SPECIES,key))throw Error('Criatura inválida.');const n=number(value,0,20);if(!Number.isInteger(n))throw Error('Use quantidades inteiras.');if(n)enemies[key as CreatureSpecies]=n;total+=n;}
  if(total<1||total>20)throw Error('Cada onda deve ter de 1 a 20 criaturas.');return {enemies};
 });return {version:1,waves,interval:number(q.interval,0,30),health:number(q.health,1,500),damage:number(q.damage,1,100)};
}
export function loadCombatConfig(storage:Pick<Storage,'getItem'>){try{const value=storage.getItem(COMBAT_STORE);return value?validateCombatConfig(JSON.parse(value)):defaultCombatConfig();}catch{return defaultCombatConfig();}}

// Pure wave/AI/damage simulation. Pausing never advances attacks or timers.
export function createCombatRuntime(raw:CombatConfig,course:GameCourse,obstacles:readonly GameObstacle[],playerRadius:number){
 const config=validateCombatConfig(raw),enemies:CombatEnemy[]=[],physics=new Map<string,ReturnType<typeof createCoursePhysics>>();
 let phase:'waiting'|'fighting'|'victory'|'defeat'='waiting',wave=-1,countdown=2,health=config.health,kills=0,serial=0,error='';
 let priorAttack=false,priorTime=-1,hitIds=new Set<string>();
 const spawn=(player:GameFrame)=>{
  const types=Object.entries(config.waves[wave].enemies).flatMap(([species,count])=>Array.from({length:count!},()=>species as CreatureSpecies));
  types.forEach((species,i)=>{const spec=presetCreature(species),radius=GAME_CREATURE_SCALE*(species==='tarantulaSdf'?.09:species==='boar'?.4:(species==='werewolf'||species==='werewolfSdf')?.48:(species==='wolf'||species==='wolfSdf'||species==='wolfLowpolySdf')?.38:(species==='rat'||species==='ratSdf')?.12:.32);
   let x=0,z=0,found=false;
   for(let attempt=0;attempt<120;attempt++){const angle=(i/types.length+attempt*.381966)*Math.PI*2,r=5+Math.floor(attempt/24)*.5;
    x=player.x+Math.sin(angle)*r;z=player.z+Math.cos(angle)*r;
    if(Math.abs(x)>course.size/2-radius||Math.abs(z)>course.size/2-radius||courseGround(course,x,z)!==0)continue;
    if(course.boxes.some(b=>Math.abs(x-b.x)<b.width/2+radius&&Math.abs(z-b.z)<b.depth/2+radius))continue;
    if(course.cylinders?.some(c=>Math.hypot(x-c.x,z-c.z)<radius+c.radius))continue;
    if([...obstacles,...enemies].some(o=>Math.hypot(x-o.x,z-o.z)<radius+o.radius+.15))continue;found=true;break;
   }
   // A blocked spawn is retried by the wave rather than placed inside geometry.
   if(!found){error='Sem espaço para a onda. Reinicie no setor Combate.';return;}
   const id=`combat-${++serial}`,e:CombatEnemy={id,spec,x,z,y:0,yaw:0,radius,health:spec.behavior.health,motion:'move',time:0,hit:false,cooldown:i*.08};
   const p=createCoursePhysics(course,1.6*GAME_CREATURE_SCALE,radius);p.reset(x,z);physics.set(id,p);enemies.push(e);
  });phase=error?'defeat':'fighting';
 };
 const colliders=()=>enemies.filter(e=>e.health>0).map(e=>({id:e.id,x:e.x,z:e.z,radius:e.radius,yaw:e.yaw}));
 return {
  get enemies(){return enemies;},get phase(){return phase;},get health(){return health;},get wave(){return wave+1;},get kills(){return kills;},colliders,
  get status(){return error||`Vida ${Math.ceil(health)}/${config.health} · Onda ${Math.max(1,wave+1)}/${config.waves.length} · ${enemies.filter(e=>e.health>0).length} inimigos · ${kills} derrotados · ${phase==='waiting'?`próxima em ${Math.ceil(countdown)}s`:phase==='victory'?'VITÓRIA':phase==='defeat'?'DERROTA':'Combate'}`;},
  update(dt:number,player:GameFrame,reach=1.6){
   if(player.playing===false||phase==='victory'||phase==='defeat')return;
   dt=Number.isFinite(dt)?Math.max(0,Math.min(dt,.1)):0;
   if(phase==='waiting'){countdown-=dt;if(countdown<=0){wave++;spawn(player);}return;}
   const attacking=isAttack(player.motion);
   if(!attacking||!priorAttack||player.time<priorTime-1e-6)hitIds=new Set();
   const advancing=!priorAttack||player.time>priorTime+1e-7;
   priorAttack=attacking;priorTime=player.time;
   if(attacking&&advancing&&player.time*ATTACK_SPEED>=.67&&player.time*ATTACK_SPEED<=1.12){
    for(const e of enemies){const dx=e.x-player.x,dz=e.z-player.z,d=Math.hypot(dx,dz),front=(dx*Math.sin(player.yaw)+dz*Math.cos(player.yaw))/Math.max(d,.001);
     if(e.health>0&&!hitIds.has(e.id)&&d<=reach+e.radius&&front>.25&&Math.abs((player.y??0)-e.y)<.9){e.health=Math.max(0,e.health-config.damage);hitIds.add(e.id);if(!e.health)kills++;}
    }
   }
   for(const e of enemies){if(e.health<=0)continue;e.cooldown=Math.max(0,e.cooldown-dt);
    const dx=player.x-e.x,dz=player.z-e.z,d=Math.hypot(dx,dz),range=playerRadius+e.radius+.22;e.yaw=Math.atan2(dx,dz);
    if(e.motion==='attack'){
     e.time+=dt;
     const tarantulaSdf=e.spec.species==='tarantulaSdf',ratSdf=e.spec.species==='ratSdf',wolfSdf=(e.spec.species==='wolfSdf'||e.spec.species==='wolfLowpolySdf'),wolf=e.spec.species==='wolf',werewolf=(e.spec.species==='werewolf'||e.spec.species==='werewolfSdf'),bat=e.spec.species==='bat',snake=e.spec.species==='snake',rat=e.spec.species==='rat',boar=e.spec.species==='boar';
     if(!e.hit&&e.time>=(tarantulaSdf?TARANTULA_SDF_ATTACK_IMPACT:ratSdf?RAT_SDF_ATTACK_IMPACT:wolfSdf?WOLF_SDF_ATTACK_IMPACT:boar?BOAR_ATTACK_IMPACT:snake?SNAKE_ATTACK_IMPACT:bat?BAT_ATTACK_IMPACT:werewolf?WEREWOLF_ATTACK_IMPACT:wolf?WOLF_ATTACK_IMPACT:rat?.28:.6)){e.hit=true;if(d<=range+.15&&Math.abs((player.y??0)-e.y)<.7)health=Math.max(0,health-e.spec.behavior.damage);}
     if(e.time>=(tarantulaSdf?TARANTULA_SDF_ATTACK_DURATION:ratSdf?RAT_SDF_ATTACK_DURATION:wolfSdf?WOLF_SDF_ATTACK_DURATION:boar?BOAR_ATTACK_DURATION:snake?SNAKE_ATTACK_DURATION:bat?BAT_ATTACK_DURATION:werewolf?WEREWOLF_ATTACK_DURATION:wolf?WOLF_ATTACK_DURATION:rat?.68:1.2)){e.motion='idle';e.time=0;e.cooldown=tarantulaSdf?TARANTULA_SDF_ATTACK_COOLDOWN:ratSdf?RAT_SDF_ATTACK_COOLDOWN:wolfSdf?WOLF_SDF_ATTACK_COOLDOWN:boar?BOAR_ATTACK_COOLDOWN:snake?SNAKE_ATTACK_COOLDOWN:bat?BAT_ATTACK_COOLDOWN:werewolf?WEREWOLF_ATTACK_COOLDOWN:wolf?WOLF_ATTACK_COOLDOWN:.8;}
    }else if(d<=range&&e.cooldown===0){e.motion='attack';e.time=0;e.hit=false;}
    else if(d>range){
     e.motion=['werewolfSdf','wolfLowpolySdf','wolfSdf','boar','wolf','werewolf','spider','tarantulaSdf','scorpion','skeleton','rat','ratSdf'].includes(e.spec.species)?'run':'move';e.time+=dt;
     const speed=e.spec.species==='tarantulaSdf'?.1*e.spec.anatomy.legs*e.spec.body.scale:e.spec.species==='ratSdf'?1.25*(e.spec.rat?.legLength??1)*e.spec.body.scale:e.spec.species==='rat'?RAT_RUN_SPEED*(e.spec.rat?.legLength??1)*e.spec.body.scale:Math.min(e.spec.behavior.speed,2.5),distance=Math.min(speed*dt,Math.max(0,d-range)),target={x:e.x+dx/d*distance,z:e.z+dz/d*distance};
     const limit=course.size/2-e.radius;target.x=Math.max(-limit,Math.min(limit,target.x));target.z=Math.max(-limit,Math.min(limit,target.z));
     const others=[...obstacles,...colliders().filter(o=>o.id!==e.id),{id:'player',x:player.x,z:player.z,radius:playerRadius,yaw:player.yaw}];
     const moved=resolveGameMovement(e,target,e.radius,others),p=physics.get(e.id)!.step(dt,e,moved,false,false,0,true,false);e.x=p.x;e.z=p.z;e.y=p.y;
    }else{e.motion='idle';e.time+=dt;}
   }
   if(health===0)phase='defeat';
   else if(enemies.every(e=>e.health===0)){enemies.length=0;physics.clear();phase=wave===config.waves.length-1?'victory':'waiting';countdown=config.interval;priorAttack=false;}
  },
 };
}
