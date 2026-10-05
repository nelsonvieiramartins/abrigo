import type {CreatureMotion} from './creature-schema';

export const BAT_ATTACK_DURATION=.44;
export const BAT_ATTACK_IMPACT=.12;
export const BAT_ATTACK_COOLDOWN=.18;
const smooth=(a:number,b:number,t:number)=>{const u=Math.max(0,Math.min(1,(t-a)/(b-a)));return u*u*(3-2*u);};
export function createBatAttackClock(){
 let lastMotion:CreatureMotion='idle',lastTime=-Infinity,start=0;
 return (time:number,motion:CreatureMotion)=>{
  if(motion==='attack'&&(lastMotion!=='attack'||time<lastTime))start=time;
  lastMotion=motion;lastTime=time;if(motion!=='attack')return null;
  const t=Math.max(0,time-start),rush=smooth(.025,BAT_ATTACK_IMPACT,t)*(1-smooth(.19,BAT_ATTACK_DURATION,t));
  const active=1-smooth(.25,BAT_ATTACK_DURATION,t);
  return {time:t,rush,active,advance:.85*rush,dip:-.08*rush};
 };
}
