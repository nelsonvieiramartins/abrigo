import type {CreatureMotion} from './creature-schema';

export const WOLF_ATTACK_DURATION=.72;
export const WOLF_ATTACK_IMPACT=.24;
export const WOLF_ATTACK_COOLDOWN=.35;
const smooth=(a:number,b:number,t:number)=>{const u=Math.max(0,Math.min(1,(t-a)/(b-a)));return u*u*(3-2*u);};
// One quick wind-up, forepaw/body lunge and bite, then a controlled recovery.
export function wolfAttackPose(time:number,height:number){
 const wind=smooth(0,.12,time)*(1-smooth(.12,.23,time)),thrust=smooth(.12,.24,time)*(1-smooth(.30,WOLF_ATTACK_DURATION,time));
 const paws=smooth(.08,.19,time)*(1-smooth(.27,.57,time));
 const bite=smooth(.07,.17,time)*(1-smooth(.21,.28,time));
 return {active:time>=0&&time<WOLF_ATTACK_DURATION,advance:height*.38*thrust,lift:height*(-.10*wind+.035*thrust),pitch:.07*wind+.06*thrust,bite,thrust,
  feet:[0,1,2,3].map(i=>({z:i<2?height*.12*thrust:0,lift:i<2?height*.28*paws:0,stance:i>=2||paws===0}))};
}
export function createWolfAttackClock(){
 let lastMotion:CreatureMotion='idle',lastTime=-Infinity,start=0;
 return (time:number,motion:CreatureMotion,height:number)=>{
  if(motion==='attack'&&(lastMotion!=='attack'||time<lastTime))start=time;
  lastMotion=motion;lastTime=time;
  return motion==='attack'?wolfAttackPose(Math.max(0,time-start),height):null;
 };
}
