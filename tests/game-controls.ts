import assert from 'node:assert/strict';
import './game-performance';
import {GAME_COMMANDS,GAME_CONTROL_STORE,createGameController,defaultGameControls,loadGameControls,validateGameControls,actionDuration} from '../src/game-controls';
import {MOTIONS,type Motion} from '../src/schema';
import {resolveGameMovement,gameTestObstacles,proceduralTestCharacters} from '../src/game-collision';
import {createGameCourse,createCoursePhysics,courseGround} from '../src/game-course';
import {createCharacter} from '../src/character';
const config=defaultGameControls();assert.deepEqual(validateGameControls(JSON.parse(JSON.stringify(config))),config);
assert(Object.keys(MOTIONS).every(m=>Object.hasOwn(config.bindings,m)),'every animation is configurable');
const c=createGameController(config),keys=(...k:string[])=>new Set(k);
assert.equal(c.update(.1,keys('KeyW')).motion,'walk');const walk=c.update(.1,keys('KeyW'));assert(walk.z<0&&walk.x<0,'W goes away from the isometric camera');
const cameraYaw=Math.atan2(4,5),right=[Math.cos(cameraYaw),-Math.sin(cameraYaw)],up=[-Math.sin(cameraYaw),-Math.cos(cameraYaw)];
for(const [key,axis,sign] of [['KeyW',up,1],['KeyS',up,-1],['KeyA',right,-1],['KeyD',right,1]] as const){const r=createGameController(config),f=r.update(.1,keys(key));assert((f.x*axis[0]+f.z*axis[1])*sign>0,`${key} follows its screen direction`);const pad=r;pad.reset();const a=key==='KeyW'?[0,-1]:key==='KeyS'?[0,1]:key==='KeyA'?[-1,0]:[1,0];const p=pad.update(.1,keys(),{axes:a,buttons:[]});assert(Math.abs(p.x-f.x)<1e-9&&Math.abs(p.z-f.z)<1e-9,'joystick and keyboard directions agree');}
assert.equal(c.update(.1,keys('KeyW','ShiftLeft')).motion,'run');assert.equal(c.update(.1,keys('KeyW','ControlLeft')).motion,'sprint');
assert.equal(c.update(.1,keys('KeyW','KeyC')).motion,'crouchWalk');assert.equal(c.update(.1,keys('KeyC')).motion,'crouch');
assert.equal(c.update(.1,keys('KeyW','ShiftLeft','Space')).motion,'jumpRun');
assert.equal(c.update(.1,keys()).motion,'jumpRun','jump finishes after button release');
let landed;for(let i=0;i<30;i++)landed=c.update(.1,keys());assert.equal(landed!.motion,'idle');
c.reset();assert.equal(c.update(.1,keys('KeyS')).motion,'walk');assert(c.update(.1,keys('KeyS')).z>0);assert.equal(c.update(.1,keys('KeyS','KeyF')).motion,'walkAttackLateral');
c.reset();const facing=c.update(.1,keys('KeyW')).yaw;
let aim=c.update(.1,keys('KeyV','KeyS'));assert.equal(aim.motion,'backward');assert.equal(aim.yaw,facing);assert(aim.aimLocked);
aim=c.update(.1,keys('KeyV','KeyS','KeyF'));assert.equal(aim.motion,'backwardAttackLateral');assert.equal(aim.yaw,facing);
aim=c.update(.1,keys('KeyS'));assert.equal(aim.motion,'walkAttackLateral');assert(!aim.aimLocked);assert.notEqual(aim.yaw,facing,'release unlocks rotation immediately during retreat attack');
c.reset();assert.equal(c.update(.1,keys('ArrowDown')).motion,'walk');c.reset();assert.equal(c.update(.1,keys('ArrowDown','KeyV')).motion,'backward');
for(const motion of ['backward','backwardAttackLateral'] as const){const s=defaultGameControls();s.bindings[motion]={key:'KeyZ',button:11};const r=createGameController(s);assert.equal(r.update(.1,keys('KeyZ')).motion,motion==='backward'?'walk':'walkAttackLateral');r.reset();assert.equal(r.update(.1,keys('KeyZ','KeyV')).motion,motion);}
c.reset();const lateralFacing=c.update(.1,keys('KeyD')).yaw;aim=c.update(.1,keys('KeyV','KeyA'));assert.equal(aim.motion,'backward');assert.equal(aim.yaw,lateralFacing,'retreat is relative to locked facing, not always S');
c.reset();const padLock={axes:[0,1],buttons:Array.from({length:11},(_,i)=>i===10)};aim=c.update(.1,keys(),padLock);assert.equal(aim.motion,'backward');assert(aim.aimLocked);assert.equal(c.update(.1,keys(),{axes:[0,1],buttons:[]}).motion,'walk');
c.reset();assert.equal(c.update(.1,keys('KeyW','KeyF')).motion,'walkAttackLateral');assert.equal(c.update(.1,keys('KeyW','KeyF')).time,.1,'held button does not restart the action every frame');
c.reset();assert.equal(c.update(.1,keys('KeyW','ShiftLeft','KeyF')).motion,'runAttackLateral');
// Repeated keyboard/gamepad presses must not restart or replace an active strike.
for(const attack of ['attack','attackLateral','walkAttackLateral','runAttackLateral','backwardAttackLateral'] as const){
 const settings=defaultGameControls();settings.bindings[attack]={key:'KeyZ',button:11};
 for(const usePad of [false,true]){
  const r=createGameController(settings),held=keys('KeyV');
  const press=()=>r.update(.1,usePad?held:keys('KeyV','KeyZ'),usePad?{axes:[],buttons:Array.from({length:12},(_,i)=>i===11)}:undefined);
  assert.equal(press().motion,attack);r.update(.1,held);
  const repeat=press();assert.equal(repeat.motion,attack);assert.equal(repeat.time,.2,'repeated press preserves strike clock');
  const other=r.update(.1,keys('KeyV',attack==='attack'?'KeyF':'KeyR'));assert.equal(other.motion,attack,'different attack cannot interrupt current strike');assert(Math.abs(other.time-.3)<1e-9);
  assert(actionDuration[attack]!<1.3,'attack is 50% faster than its original 1.9s cycle');
  let frame=other;for(let i=0;i<11;i++)frame=r.update(.1,held);
  assert.equal(frame.motion,'idle','strike completes without queued repeats');
  assert.equal(press().motion,attack,'fresh press after completion starts a new strike');
 }
}
c.reset();assert.equal(c.update(.1,keys('Space')).motion,'jump');assert.equal(c.update(.1,keys('KeyX')).motion,'idle','stop cancels action');
// Every action accepts an explicit binding, including combinations without modifiers.
for(const motion of Object.keys(MOTIONS) as Motion[]){const s=defaultGameControls();s.bindings[motion]={key:'KeyZ',button:11};const r=createGameController(s);
 const pad={axes:[0,0],buttons:Array.from({length:12},(_,i)=>i===11)};const frame=r.update(.1,keys(...(motion==='backward'||motion==='backwardAttackLateral'?['KeyV']:[])),pad);
 if(motion==='run'||motion==='sprint'){assert.equal(frame.motion,'idle','speed modifier requires movement');assert.equal(r.update(.1,keys('KeyW'),pad).motion,motion);}else assert.equal(frame.motion,motion);
 assert([frame.x,frame.z,frame.yaw,frame.time].every(Number.isFinite));
}
const analog=createGameController(config);assert.equal(analog.update(.1,keys(),{axes:[.1,-.1],buttons:[]}).motion,'idle','deadzone suppresses drift');
assert.equal(analog.update(.1,keys(),{axes:[0,-1],buttons:[true]}).motion,'jumpWalk');analog.reset();const full=analog.update(.1,keys(),{axes:[1,0],buttons:[]});analog.reset();const partial=analog.update(.1,keys(),{axes:[.6,0],buttons:[]});assert(full.x>partial.x);
analog.reset();const finite=analog.update(Infinity,keys(),{axes:[NaN,Infinity],buttons:[]});assert(Number.isFinite(finite.x)&&Number.isFinite(finite.z));
for(let i=0;i<1000;i++)analog.update(.1,keys('KeyD'));assert(analog.update(.1,keys('KeyD')).x<=8,'arena boundary');
const stored=new Map<string,string>(),storage={getItem:(k:string)=>stored.get(k)??null};const changed=defaultGameControls();changed.bindings.wave={key:'KeyQ',button:9};stored.set(GAME_CONTROL_STORE,JSON.stringify(changed));assert.deepEqual(loadGameControls(storage),changed);stored.set(GAME_CONTROL_STORE,'broken');assert.deepEqual(loadGameControls(storage),config);
for(const bad of [null,{version:2},{...config,deadzone:2},{...config,axisX:NaN},{...config,bindings:{wave:{key:'<script>',button:0}}}])assert.throws(()=>validateGameControls(bad));
const legacy=JSON.parse(JSON.stringify(changed));delete legacy.bindings.aimLock;const migrated=validateGameControls(legacy);assert.deepEqual(migrated.bindings.wave,changed.bindings.wave);assert.deepEqual(migrated.bindings.aimLock,config.bindings.aimLock,'existing bindings preserved when adding aim lock');
console.log('Aim lock: held keyboard/gamepad input, facing preserved, directional retreat, release during attack, explicit bindings and saved-control migration passed.');
console.log('Game test: all '+Object.keys(GAME_COMMANDS).length+' bindings, keyboard and synthetic gamepad inputs, combinations, completed one-shot actions, deadzone, analog speed, bounds, JSON persistence and invalid input passed.');
const obstacle={id:'NPC',x:0,z:-1.5,radius:.4,yaw:0};
const swept=resolveGameMovement({x:0,z:0},{x:0,z:-5},.4,[obstacle]);assert(swept.z>-.71&&swept.contacts.includes('NPC'),'large movement cannot tunnel through the body');
const sliding=resolveGameMovement({x:.45,z:-.8},{x:1.2,z:-1.5},.4,[obstacle]);assert(sliding.x>.45&&Math.hypot(sliding.x,sliding.z+1.5)>=.8,'slide around the side without overlap');
const blocked=createGameController(config,0);blocked.setCollisions([obstacle],.4);let hit=false,f;
for(let i=0;i<100;i++){f=blocked.update(.1,keys('KeyW','ControlLeft'));hit ||= !!f.contacts?.length;assert(Math.hypot(f.x,f.z+1.5)>=.8-1e-6);}
assert(hit&&f!.z>-.71,'sprint stops at stationary character');
blocked.reset();blocked.setCollisions([obstacle],.4,false);for(let i=0;i<10;i++)f=blocked.update(.1,keys('KeyW','ControlLeft'));assert(f!.z<-1.5,'OFF allows crossing');
blocked.reset();blocked.setCollisions([obstacle],.4);for(let i=0;i<40;i++)f=blocked.update(.1,keys('KeyW','Space'));assert(f!.z>-.71,'jump still respects grounded body collision');
const layout=gameTestObstacles(.4);assert.equal(layout.length,8);for(const a of layout){assert(Math.hypot(a.x,a.z)>.8);for(const b of layout)if(a!==b)assert(Math.hypot(a.x-b.x,a.z-b.z)>.8);}
console.log('Collision: eight stationary bodies, safe spawn, no sprint tunneling, sliding, ON/OFF and jump blocking passed.');
const course=createGameCourse(1.9);assert.equal(course.size,48);assert.equal(courseGround(course,6,-6),.5);assert.equal(courseGround(course,6,-10),1);assert.equal(courseGround(course,6,-12.5),null);
const runner=createGameController(config,0);runner.setCollisions([],.4);runner.setCourse(course,1.9);runner.teleport(6,-3);
for(let i=0;i<50;i++)f=runner.update(.1,keys('KeyW'));assert(f!.y!>.95&&f!.z<-8,'walk smoothly up the ramp onto platform');
runner.teleport(-7,-4);for(let i=0;i<35;i++)f=runner.update(.1,keys('KeyW'));assert(f!.z>-5.2&&f!.contacts!.length,'cannot enter low tunnel standing');
for(let i=0;i<45;i++)f=runner.update(.1,keys('KeyW','KeyC'));assert(f!.z<-6.4,'crouched body enters tunnel');
f=runner.update(.1,keys('KeyW'));assert.equal(f!.motion,'crouchWalk','cannot stand up inside low ceiling');
for(let i=0;i<100;i++)f=runner.update(.1,keys('KeyW'));assert.equal(f!.motion,'walk','standing restored after clearing the tunnel');
// Gameplay skips the demonstration's anticipation, for keyboard and gamepad alike.
for(const [modifier,motion] of [['','jumpWalk'],['ShiftLeft','jumpRun'],['ControlLeft','jumpSprint']] as const){
 for(const padInput of [false,true]){
  runner.teleport(0,0);
  const frame=runner.update(1/60,padInput?keys(...(modifier?[modifier]:[])):keys('KeyW','Space',...(modifier?[modifier]:[])),padInput?{axes:[0,-1],buttons:[true]}:undefined);
  assert.equal(frame.motion,motion);assert.equal(frame.time,.62);assert(frame.y!>0&&!frame.grounded,'moving jump takes off on its first input frame');
  const held=runner.update(1/60,padInput?keys(...(modifier?[modifier]:[])):keys('KeyW','Space',...(modifier?[modifier]:[])),padInput?{axes:[0,-1],buttons:[true]}:undefined);
  assert(held.time>frame.time&&held.y!>frame.y!,'held jump continues instead of restarting');
 }
}
runner.teleport(0,0);f=runner.update(1/60,keys('Space'));assert.equal(f.time,0);assert.equal(f.y,0,'stationary jump retains its existing preparation');
runner.teleport(6,-11.3);let peak=1;for(let i=0;i<22;i++){f=runner.update(.1,keys('KeyW','ShiftLeft',...(i===0?['Space']:[])));peak=Math.max(peak,f.y??0);}assert(peak>1.5&&f!.z<-13.5&&f!.y!>=.98&&f!.falls===0,'immediate running jump crosses gap and lands on next platform');
const fall=createCoursePhysics(course,1.9,.4);fall.reset(6,-11.8);let fp={x:6,z:-11.8},fell=false;for(let i=0;i<80;i++){const result=fall.step(.05,fp,{x:6,z:-12.5},false,false,0,true,false);fp=result;if(result.respawned){fell=true;assert.equal(result.z,-11.8);break;}}assert(fell,'falling into gap resets at chosen checkpoint');
const generated=proceduralTestCharacters('qa-course');assert.deepEqual(proceduralTestCharacters('qa-course'),generated);assert(new Set(generated.map(o=>o.spec!.outfit.topColor)).size>1);assert(new Set(generated.map(o=>o.spec!.seed)).size===8);
for(const o of generated){const model=createCharacter(o.spec!,{detail:'high'});assert.equal(model.detail,'high');assert(o.spec!.items.object==='none');model.dispose();}
console.log('Course: 48m arena, procedural HD characters, ramp ascent, standing blocked/crouched tunnel traversal, prevented stand-up, jump crossing/landing and fall checkpoint passed.');
