import * as THREE from 'three';
// Catmull-Rom through every control row. Components in `lock` stay inside their segment so
// sweep rings never fold back; components in `radii` may bulge slightly but never go negative.
export function refine(rows:number[][],steps:number,lock:number[],radii:number[]):number[][]{
 if(steps<2||rows.length<3)return rows;
 const out:number[][]=[];
 for(let i=0;i<rows.length-1;i++){
   const p0=rows[Math.max(0,i-1)],p1=rows[i],p2=rows[i+1],p3=rows[Math.min(rows.length-1,i+2)];
   for(let s=0;s<steps;s++){
     const t=s/steps,t2=t*t,t3=t2*t;
     out.push(p1.map((b,k)=>{
       const a=p0[k],c=p2[k],d=p3[k];
       const v=.5*(2*b+(c-a)*t+(2*a-5*b+4*c-d)*t2+(3*b-a-3*c+d)*t3);
       if(lock.includes(k))return THREE.MathUtils.clamp(v,Math.min(b,c),Math.max(b,c));
       if(radii.includes(k))return THREE.MathUtils.clamp(v,Math.min(b,c)*.9,Math.max(b,c)*1.08);
       return v;
     }));
   }
 }
 out.push(rows[rows.length-1]);return out;
}
