import assert from 'node:assert/strict';
import {createCombatRuntime,defaultCombatConfig,validateCombatConfig,loadCombatConfig,type CombatConfig} from '../src/game-combat';
import {createCombatScene} from '../src/game-combat-scene';
import {createGameCourse} from '../src/game-course';
import type {GameFrame} from '../src/game-controls';
import {CREATURE_SPECIES} from '../src/creature-schema';
import * as THREE from 'three';
const course=createGameCourse(),player:GameFrame={x:0,z:16,y:0,yaw:0,motion:'idle',time:0,playing:true};
const config=defaultCombatConfig();assert.deepEqual(validateCombatConfig(config),config);
assert.deepEqual(loadCombatConfig({getItem:()=>'{bad'}),config);
assert.deepEqual(loadCombatConfig({getItem:()=>JSON.stringify(config)}),config);
for(const enemies of [{wolf:0},{wolf:21},{wolf:1.5},{dragon:1},{wolf:15,spider:15}])assert.throws(()=>validateCombatConfig({...config,waves:[{enemies}]}));
for(const waves of [[],Array.from({length:11},()=>config.waves[0])])assert.throws(()=>validateCombatConfig({...config,waves}));
assert.throws(()=>validateCombatConfig({...config,damage:NaN}));
const one=(species='skeleton',damage=30):CombatConfig=>({version:1,waves:[{enemies:{[species]:1}}],health:100,damage,interval:1});
const spawn=(runtime:ReturnType<typeof createCombatRuntime>)=>{for(let i=0;i<21;i++)runtime.update(.1,player);};
const r=createCombatRuntime(one(),course,[],.4);r.update(10,{...player,playing:false});assert.equal(r.wave,0);spawn(r);assert.equal(r.phase,'fighting');assert.equal(r.enemies.length,1);assert.equal(r.colliders().length,1);
const e=r.enemies[0],oldDistance=Math.hypot(e.x-player.x,e.z-player.z);r.update(.1,player);assert(Math.hypot(e.x-player.x,e.z-player.z)<oldDistance);
const attack=(time:number,yaw=0,y=0)=>({...player,motion:'attackLateral' as const,time,yaw,y});
// One hit per enemy per strike, no premature hits, behind-player or airborne damage.
e.x=0;e.z=17;e.y=0;e.motion='idle';e.cooldown=10;
r.update(0,attack(.2));assert.equal(e.health,60);
r.update(0,attack(.5,Math.PI));assert.equal(e.health,60);
r.update(0,attack(.55,0,2));assert.equal(e.health,60);
r.update(0,attack(.6));assert.equal(e.health,30);
r.update(.1,attack(.65));assert.equal(e.health,30);
const frozen={x:e.x,z:e.z,time:e.time};r.update(.1,{...player,playing:false});assert.deepEqual({x:e.x,z:e.z,time:e.time},frozen);
r.update(0,player);r.update(0,attack(.6));assert.equal(r.phase,'victory');assert.equal(r.kills,1);assert.equal(r.colliders().length,0);
const multi=createCombatRuntime({...one('bat',100),waves:[{enemies:{bat:1}},{enemies:{spider:1,skeleton:1}}]},course,[],.4);spawn(multi);multi.enemies[0].x=0;multi.enemies[0].z=17;multi.update(0,attack(.6));assert.equal(multi.phase,'waiting');assert.equal(multi.wave,1);multi.update(.1,{...player,playing:false});assert.equal(multi.phase,'waiting');for(let i=0;i<11;i++)multi.update(.1,player);assert.equal(multi.wave,2);assert.equal(multi.enemies.length,2);
const deadly=createCombatRuntime({...one(),health:10},course,[],.4);spawn(deadly);deadly.enemies[0].x=0;deadly.enemies[0].z=16.9;deadly.enemies[0].cooldown=0;for(let i=0;i<15;i++)deadly.update(.1,player);assert.equal(deadly.phase,'defeat');assert.equal(deadly.health,0);const time=deadly.enemies[0].time;deadly.update(.1,player);assert.equal(deadly.enemies[0].time,time);
// Every supported species constructs, animates and cleans up in the arena.
for(const species of Object.keys(CREATURE_SPECIES)){
 const scene=createCombatScene(one(species),course,[],.4),camera=new THREE.PerspectiveCamera();for(let i=0;i<23;i++)scene.update(.1,player,1.6,camera);
 assert(scene.root.children.length>0,species+' missing from combat');scene.root.updateMatrixWorld(true);scene.root.traverse(o=>assert(o.matrixWorld.elements.every(Number.isFinite)));
 scene.dispose();assert.equal(scene.root.children.length,0);
}
console.log('Combat: validation/storage, wave counts/types, pursuit, pause, directional/height hit rules, one hit per strike, wave intervals, victory/defeat, eight species and resource cleanup passed.');
const wolfCombat=createCombatRuntime(one('wolf'),course,[],.4);spawn(wolfCombat);const wolfEnemy=wolfCombat.enemies[0];wolfEnemy.x=0;wolfEnemy.z=16.9;wolfEnemy.cooldown=0;wolfCombat.update(.01,player);assert.equal(wolfEnemy.motion,'attack');wolfCombat.update(.1,player);wolfCombat.update(.1,player);assert.equal(wolfCombat.health,100,'wolf damages before the bite');wolfCombat.update(.05,player);assert.equal(wolfCombat.health,82,'wolf bite is not synchronized');for(let i=0;i<5;i++)wolfCombat.update(.1,player);assert.equal(wolfEnemy.motion,'idle');assert.equal(wolfCombat.health,82,'wolf deals multiple hits per bite');assert(wolfEnemy.cooldown<=.35,'wolf cooldown is not faster');
const werewolfCombat=createCombatRuntime(one('werewolf'),course,[],.4);spawn(werewolfCombat);const werewolfEnemy=werewolfCombat.enemies[0];werewolfEnemy.x=0;werewolfEnemy.z=16.9;werewolfEnemy.cooldown=0;werewolfCombat.update(.01,player);assert.equal(werewolfEnemy.motion,'attack');werewolfCombat.update(.1,player);assert.equal(werewolfCombat.health,100,'werewolf damages before impact');werewolfCombat.update(.1,player);assert.equal(werewolfCombat.health,68,'werewolf damage is not synchronized with its lunge');for(let i=0;i<4;i++)werewolfCombat.update(.1,player);assert.equal(werewolfEnemy.motion,'idle');assert.equal(werewolfCombat.health,68,'werewolf deals multiple hits per strike');assert(werewolfEnemy.cooldown<=.25,'werewolf cooldown is not faster');
const batCombat=createCombatRuntime(one('bat'),course,[],.4);spawn(batCombat);const batEnemy=batCombat.enemies[0];batEnemy.x=0;batEnemy.z=16.9;batEnemy.cooldown=0;batCombat.update(.01,player);assert.equal(batEnemy.motion,'attack');batCombat.update(.1,player);assert.equal(batCombat.health,100,'bat damages before impact');batCombat.update(.03,player);assert.equal(batCombat.health,95,'bat damage does not match the quick rush');for(let i=0;i<4;i++)batCombat.update(.1,player);assert.equal(batEnemy.motion,'idle');assert.equal(batCombat.health,95,'bat deals multiple hits per rush');assert(batEnemy.cooldown<=.18,'bat cooldown is not faster');
const snakeCombat=createCombatRuntime(one('snake'),course,[],.4);spawn(snakeCombat);const snakeEnemy=snakeCombat.enemies[0];snakeEnemy.x=0;snakeEnemy.z=16.9;snakeEnemy.cooldown=0;snakeCombat.update(.01,player);assert.equal(snakeEnemy.motion,'attack');snakeCombat.update(.1,player);assert.equal(snakeCombat.health,100,'snake damages before impact');snakeCombat.update(.06,player);assert.equal(snakeCombat.health,88,'snake bite is not synchronized');for(let i=0;i<5;i++)snakeCombat.update(.1,player);assert.equal(snakeEnemy.motion,'idle');assert.equal(snakeCombat.health,88,'snake deals multiple hits per bite');assert(snakeEnemy.cooldown>0,'snake does not recover between unique strikes');
