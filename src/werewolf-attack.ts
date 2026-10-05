import type {CreatureMotion} from './creature-schema';

export const WEREWOLF_ATTACK_DURATION=.60;
export const WEREWOLF_ATTACK_IMPACT=.20;
export const WEREWOLF_ATTACK_COOLDOWN=.25;
const smooth=(a:number,b:number,t:number)=>{const u=Math.max(0,Math.min(1,(t-a)/(b-a)));return u*u*(3-2*u);};
export function createWerewolfAttackClock(){
 let lastMotion:CreatureMotion='idle',lastTime=-Infinity,start=0;
 return (time:number,motion:CreatureMotion)=>{
  if(motion==='attack'&&(lastMotion!=='attack'||time<lastTime))start=time;
  lastMotion=motion;lastTime=time;
  if(motion!=='attack')return null;
  const t=Math.max(0,time-start),wind=smooth(0,.10,t)*(1-smooth(.10,.20,t));
  const thrust=smooth(.10,WEREWOLF_ATTACK_IMPACT,t)*(1-smooth(.27,WEREWOLF_ATTACK_DURATION,t));
  const bite=smooth(.04,.12,t)*(1-smooth(.17,.23,t));
  const raised=smooth(0,.10,t)*(1-smooth(.12,WEREWOLF_ATTACK_IMPACT,t));
  return {wind,thrust,bite,raised,step:smooth(.08,.18,t)*(1-smooth(.25,.50,t))};
 };
}
