export const VEGETATION_LIMIT=1200;
export const VEGETATION_KINDS={tree:'Árvores da floresta',shrub:'Mato / arbustos',grass:'Grama densa',rock:'Pedras com musgo'} as const;
export type VegetationKind=keyof typeof VEGETATION_KINDS;
export type VegetationInstance={kind:VegetationKind;variant:number;x:number;z:number;scale:number;rotation:number};
export function validateVegetation(raw:any):VegetationInstance[]{
 if(!Array.isArray(raw)||raw.length>VEGETATION_LIMIT)throw Error(`Vegetação inválida (máximo ${VEGETATION_LIMIT} elementos).`);
 for(const v of raw)if(!v||!Object.hasOwn(VEGETATION_KINDS,v.kind)||!Number.isInteger(v.variant)||v.variant<0||v.variant>7||!['x','z','scale','rotation'].every(k=>Number.isFinite(v[k]))||Math.abs(v.x)>49.8||Math.abs(v.z)>49.8||v.scale<.25||v.scale>2||Math.abs(v.rotation)>Math.PI*2)throw Error('Posição, tamanho ou variação de vegetação inválida.');
 return raw.map(({kind,variant,x,z,scale,rotation})=>({kind,variant,x,z,scale,rotation}));
}
export function seededRandom(seed:string){let n=2166136261;for(const c of seed)n=Math.imul(n^c.charCodeAt(0),16777619);return ()=>{n+=0x6D2B79F5;let v=n;v=Math.imul(v^v>>>15,v|1);v^=v+Math.imul(v^v>>>7,v|61);return ((v^v>>>14)>>>0)/4294967296;};}
export function scatterVegetation(existing:VegetationInstance[],options:{kind:VegetationKind;variant:number;seed:string;count:number;x:number;z:number;radius:number;spacing:number;minScale:number;maxScale:number},allowed:(x:number,z:number)=>boolean){
 const out=existing.slice(),random=seededRandom(options.seed),limit=Math.min(VEGETATION_LIMIT,out.length+Math.max(0,Math.min(300,Math.floor(options.count))));
 for(let attempt=0;attempt<options.count*50&&out.length<limit;attempt++){
  const angle=random()*Math.PI*2,r=Math.sqrt(random())*options.radius,x=options.x+Math.cos(angle)*r,z=options.z+Math.sin(angle)*r;
  if(Math.abs(x)>49.8||Math.abs(z)>49.8||!allowed(x,z))continue;
  if(out.some(v=>v.kind===options.kind&&Math.hypot(v.x-x,v.z-z)<options.spacing))continue;
  out.push({kind:options.kind,variant:options.variant<0?Math.floor(random()*8):options.variant,x,z,scale:options.minScale+random()*(options.maxScale-options.minScale),rotation:random()*Math.PI*2});
 }
 return validateVegetation(out);
}
