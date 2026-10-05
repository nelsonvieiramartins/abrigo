import type {CreatureMotion} from './creature-schema';

export const SNAKE_ATTACK_DURATION=.58;
export const SNAKE_ATTACK_IMPACT=.16;
export const SNAKE_ATTACK_COOLDOWN=.6;
const smooth=(a:number,b:number,t:number)=>{const u=Math.max(0,Math.min(1,(t-a)/(b-a)));return u*u*(3-2*u);};
// A single compressed wind-up, airborne forward strike, bite and landing.
export function createSnakeAttackClock(){
 let lastMotion:CreatureMotion='idle',lastTime=-Infinity,start=0;
 return (time:number,motion:CreatureMotion)=>{
  if(motion==='attack'&&(lastMotion!=='attack'||time<lastTime))start=time;
  lastMotion=motion;lastTime=time;if(motion!=='attack')return null;
  const t=Math.max(0,time-start),wind=smooth(0,.07,t)*(1-smooth(.08,.16,t));
  const thrust=smooth(.08,SNAKE_ATTACK_IMPACT,t)*(1-smooth(.25,SNAKE_ATTACK_DURATION,t));
  const leap=smooth(.07,.15,t)*(1-smooth(.22,.39,t));
  const bite=smooth(.03,.10,t)*(1-smooth(.14,.20,t));
  return {wind,thrust,bite,advance:.85*thrust,lift:.26*leap};
 };
}
