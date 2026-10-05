import {MOTIONS,type Motion} from './schema';
import {resolveGameMovement,type GameObstacle} from './game-collision';
import {createCoursePhysics,type GameCourse} from './game-course';
import {ATTACK_DURATION,isAttack} from './attack-timing';

export const GAME_CONTROL_STORE='abrigo-game-controls-v1';
export const GAME_COMMANDS={forward:'Mover para frente',back:'Mover para trás',left:'Mover à esquerda',right:'Mover à direita',aimLock:'Travar mira — segurar',...MOTIONS};
export type GameCommand=keyof typeof GAME_COMMANDS;
export type Binding={key:string;button:number|null};
export type GameControls={version:1;bindings:Record<GameCommand,Binding>;axisX:number;axisY:number;invertX:boolean;invertY:boolean;deadzone:number;gamepad:number;speed:number};
export type PadInput={axes:readonly number[];buttons:readonly boolean[]};
export type GameFrame={motion:Motion;time:number;x:number;z:number;yaw:number;contacts?:string[];aimLocked?:boolean;y?:number;grounded?:boolean;falls?:number;playing?:boolean};
const keys:Partial<Record<GameCommand,string>>={forward:'KeyW',back:'KeyS',left:'KeyA',right:'KeyD',aimLock:'KeyV',idle:'KeyX',walk:'ArrowUp',backward:'ArrowDown',run:'ShiftLeft',sprint:'ControlLeft',jump:'Space',crouch:'KeyC',wave:'KeyE',attack:'KeyR',attackLateral:'KeyF',pickup:'KeyG',pray:'KeyH',pose:'KeyP'};
const buttons:Partial<Record<GameCommand,number>>={aimLock:10,jump:0,crouch:1,attackLateral:2,attack:3,run:4,sprint:5,pickup:6,wave:7};
export function defaultGameControls():GameControls{return {version:1,bindings:Object.fromEntries(Object.keys(GAME_COMMANDS).map(id=>[id,{key:keys[id as GameCommand]??'',button:buttons[id as GameCommand]??null}])) as GameControls['bindings'],axisX:0,axisY:1,invertX:false,invertY:false,deadzone:.2,gamepad:-1,speed:1};}
export function validateGameControls(raw:unknown):GameControls{
 const q=raw as any;if(!q||q.version!==1)throw new Error('Configuração de controles inválida.');
 const out=defaultGameControls();
 for(const id of Object.keys(GAME_COMMANDS) as GameCommand[]){const b=q.bindings?.[id];if(!b)continue;
  if(typeof b.key!=='string'||b.key.length>40||(!/^[a-zA-Z0-9]*$/.test(b.key)))throw new Error('Tecla inválida.');
  if(b.button!==null&&(!Number.isInteger(b.button)||b.button<0||b.button>31))throw new Error('Botão inválido.');out.bindings[id]={key:b.key,button:b.button};
 }
 for(const [id,min,max,integer] of [['axisX',0,7,true],['axisY',0,7,true],['gamepad',-1,15,true],['deadzone',.05,.8,false],['speed',.25,2,false]] as const){const n=q[id];if(n===undefined)continue;if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max||(integer&&!Number.isInteger(n)))throw new Error('Ajuste de controle inválido.');(out as any)[id]=n;}
 for(const id of ['invertX','invertY'] as const){if(q[id]!==undefined&&typeof q[id]!=='boolean')throw new Error('Inversão inválida.');out[id]=q[id]??false;}return out;
}
export function loadGameControls(storage:Pick<Storage,'getItem'>){try{const s=storage.getItem(GAME_CONTROL_STORE);return s?validateGameControls(JSON.parse(s)):defaultGameControls();}catch{return defaultGameControls();}}
// In gameplay, moving jumps start at takeoff; the editor retains the full demonstration.
export const MOVING_JUMP_TAKEOFF=.62;
const movingJump=(motion:Motion)=>motion==='jumpWalk'||motion==='jumpRun'||motion==='jumpSprint';
export const actionDuration:Partial<Record<Motion,number>>={jump:2.6,jumpWalk:2.8-MOVING_JUMP_TAKEOFF,jumpRun:2.35-MOVING_JUMP_TAKEOFF,jumpSprint:2.05-MOVING_JUMP_TAKEOFF,attack:ATTACK_DURATION,attackLateral:ATTACK_DURATION,walkAttackLateral:ATTACK_DURATION,runAttackLateral:ATTACK_DURATION,backwardAttackLateral:ATTACK_DURATION,wave:3.6,pickup:4.2,pray:9};
const moving=new Set<Motion>(['walk','backward','run','sprint','crouchWalk','jumpWalk','jumpRun','jumpSprint','walkAttackLateral','runAttackLateral','backwardAttackLateral']);
// Pure input/runtime logic: browser events and real Gamepad objects stay in the UI adapter.
export function createGameController(config:GameControls,cameraYaw=Math.atan2(4,5)){
 let obstacles:readonly GameObstacle[]=[],radius=.4,collisionEnabled=true;
 let course:GameCourse|null=null,physics:ReturnType<typeof createCoursePhysics>|null=null;
 let prior=new Set<GameCommand>(),action:Motion|null=null,elapsed=0,gaitTime=0,lastMotion:Motion='idle';
 const state:GameFrame={motion:'idle',time:0,x:0,z:0,yaw:cameraYaw+Math.PI};
 return {setCollisions(list:readonly GameObstacle[],bodyRadius:number,enabled=true){obstacles=list;radius=bodyRadius;collisionEnabled=enabled;},reset(){prior.clear();action=null;elapsed=gaitTime=0;lastMotion='idle';Object.assign(state,{motion:'idle',time:0,x:0,z:0,yaw:cameraYaw+Math.PI,contacts:[],aimLocked:false,y:physics?.reset()??undefined,grounded:true,falls:0});},
 setCourse(value:GameCourse,height:number){course=value;physics=createCoursePhysics(value,height,radius);state.y=physics.reset();state.grounded=true;state.falls=0;},
 teleport(x=0,z=0,yaw=cameraYaw+Math.PI){this.reset();state.x=x;state.z=z;state.yaw=yaw;state.y=physics?.reset(x,z)??0;state.grounded=true;},
 update(dt:number,pressed:ReadonlySet<string>,pad?:PadInput):GameFrame{
  dt=Number.isFinite(dt)?Math.max(0,Math.min(dt,.1)):0;
  const down=new Set<GameCommand>();for(const id of Object.keys(GAME_COMMANDS) as GameCommand[]){const b=config.bindings[id];if((b.key&&pressed.has(b.key))||(b.button!==null&&pad?.buttons[b.button]))down.add(id);}
  const axis=(i:number,invert:boolean)=>{const raw=pad?.axes[i]??0,n=Number.isFinite(raw)?Math.max(-1,Math.min(1,raw)):0;return Math.abs(n)<=config.deadzone?0:Math.sign(n)*(Math.abs(n)-config.deadzone)/(1-config.deadzone)*(invert?-1:1);};
  let dx=axis(config.axisX,config.invertX)+(down.has('right')?1:0)-(down.has('left')?1:0),dz=-axis(config.axisY,config.invertY)+(down.has('forward')?1:0)-(down.has('back')?1:0);
  const directed=Math.hypot(dx,dz)>.001,aimLocked=down.has('aimLock');state.aimLocked=aimLocked;
  // Convert screen directions to the fixed isometric camera's ground-plane basis.
  // Up goes away from the camera; right follows its horizontal screen axis.
  const screenX=dx,screenUp=dz;
  dx=screenX*Math.cos(cameraYaw)-screenUp*Math.sin(cameraYaw);
  dz=-screenX*Math.sin(cameraYaw)-screenUp*Math.cos(cameraYaw);
  // Lock the existing facing, not a screen direction. Retreat only when walking away from that facing.
  const back=aimLocked&&(directed?(dx*Math.sin(state.yaw)+dz*Math.cos(state.yaw))<-.05:down.has('backward'));
  if(!directed&&down.has('backward')&&!aimLocked){dx=Math.sin(cameraYaw);dz=Math.cos(cameraYaw);}
  let gait:Motion=directed||down.has('walk')||down.has('backward')||down.has('crouchWalk')?(back?'backward':down.has('crouch')||down.has('crouchWalk')?'crouchWalk':down.has('sprint')?'sprint':down.has('run')?'run':'walk'):down.has('crouch')?'crouch':down.has('pose')?'pose':'idle';
  const underCeiling=collisionEnabled&&!!physics?.needsCrouch(state.x,state.z);
  if(underCeiling)gait=directed||moving.has(gait)?'crouchWalk':'crouch';
  // Modifiers only accelerate actual displacement; they do not make a stationary character run.
  const edge=(id:GameCommand)=>down.has(id)&&!prior.has(id);
  let next:Motion|null=null;
  for(const m of Object.keys(actionDuration) as Motion[])if(edge(m))next=m;
  if(next==='jump')next=gait==='sprint'?'jumpSprint':gait==='run'?'jumpRun':moving.has(gait)?'jumpWalk':'jump';
  if(next==='attackLateral')next=gait==='backward'?'backwardAttackLateral':gait==='run'||gait==='sprint'?'runAttackLateral':moving.has(gait)?'walkAttackLateral':'attackLateral';
  if(next==='backwardAttackLateral'&&!aimLocked)next='walkAttackLateral';
  if(action&&elapsed>=(actionDuration[action]??0)){action=null;elapsed=0;}
  // Consume presses during a strike without restarting it or queuing extra attacks.
  if(action&&isAttack(action))next=null;
  if(next){action=next;elapsed=0;}
  if(action==='backwardAttackLateral'&&!aimLocked)action='walkAttackLateral';
  if(underCeiling){action=null;next=null;}
  if(down.has('idle')){action=null;gait='idle';}
  const motion=action??gait;
  if(motion!==lastMotion){gaitTime=0;lastMotion=motion;}state.motion=motion;state.time=action?elapsed+(movingJump(action)?MOVING_JUMP_TAKEOFF:0):gaitTime;
  state.contacts=[];
  let target={x:state.x,z:state.z};
  if(moving.has(motion)){
   if(!directed&&!(down.has('backward')&&!aimLocked)){dx=Math.sin(state.yaw);dz=Math.cos(state.yaw);}
   const retreat=motion==='backward'||motion==='backwardAttackLateral';
   if(retreat){if(!directed){dx=-Math.sin(state.yaw);dz=-Math.cos(state.yaw);}}else if(!aimLocked&&(directed||down.has('backward')))state.yaw=Math.atan2(dx,dz);
   const length=Math.hypot(dx,dz),amount=directed?Math.min(1,length):1;
   const speed=(motion==='sprint'||motion==='jumpSprint'?3.6:motion==='run'||motion==='jumpRun'||motion==='runAttackLateral'?2.5:motion==='crouchWalk'?.6:retreat?.8:1.25)*config.speed;
   const bound=course?course.size/2-radius:8;
   target={x:Math.max(-bound,Math.min(bound,state.x+dx/Math.max(length,.001)*amount*speed*dt)),z:Math.max(-bound,Math.min(bound,state.z+dz/Math.max(length,.001)*amount*speed*dt))};
   const result=collisionEnabled?resolveGameMovement(state,target,radius,obstacles):{...target,contacts:[]};
   target={x:result.x,z:result.z};state.contacts=result.contacts;
  }
  if(physics){const jumping=motion==='jump'||motion==='jumpWalk'||motion==='jumpRun'||motion==='jumpSprint';const p=physics.step(dt,state,target,motion==='crouch'||motion==='crouchWalk',!!next&&jumping,state.time,collisionEnabled,jumping);state.x=p.x;state.z=p.z;state.y=p.y;state.grounded=p.grounded;state.contacts.push(...p.contacts);if(p.respawned){state.falls=(state.falls??0)+1;action=null;}}
  else{state.x=target.x;state.z=target.z;}
  elapsed+=dt;gaitTime+=dt;prior=down;return {...state};
 }};
}
