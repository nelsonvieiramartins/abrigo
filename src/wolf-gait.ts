import type {CreatureMotion} from './creature-schema';

const cycle=(n:number)=>((n%1)+1)%1;
const smooth=(n:number)=>n*n*(3-2*n);
const ease=(n:number)=>n*n*n*(n*(n*6-15)+10);
// Leg order: front right, front left, hind right, hind left.
// Walk: lateral four-beat sequence. Run: rotary gallop, hind pair then fore pair,
// with a short lead offset within each pair and two aerial intervals.
export function wolfGait(time:number,motion:CreatureMotion,height:number){
  const active=motion==='move'||motion==='run',run=motion==='run';
  const phase=cycle(time*(run?2.05:1.05)),duty=run?.23:.72;
  const contacts=run?[.52,.45,0,.07]:[.25,.75,0,.5];
  const aerial=(a:number,b:number)=>phase>a&&phase<b?Math.sin(Math.PI*(phase-a)/(b-a))**4:0;
  const flight=run?Math.max(aerial(.30,.45),aerial(.75,1)):0;
  // The torso follows one continuous, low-amplitude wave. Separate short flight
  // pulses previously kicked its vertical velocity at every takeoff and landing.
  const lift=active?height*(run?-.095+.025*Math.cos((phase-.375)*Math.PI*4):-.018+.006*Math.cos(phase*Math.PI*4)):0;
  const pitch=active?Math.sin(phase*Math.PI*2)*(run?.035:.009):0;
  const stride=height*(run?.70:.35);
  const feet=contacts.map(offset=>{
    const p=cycle(phase-offset),stance=p<duty,u=stance?p/duty:(p-duty)/(1-duty);
    const progress=run?ease(u):stance?u:smooth(u);
    const z=active?stride*(stance?.5-progress:-.5+progress):0;
    const footLift=active&&!stance?height*(run?.27:.13)*Math.sin(Math.PI*u)**(run?4:2):0;
    return {stance:!active||stance,z,lift:footLift+height*.055*flight};
  });
  return {active,run,phase,lift,pitch,feet};
}
