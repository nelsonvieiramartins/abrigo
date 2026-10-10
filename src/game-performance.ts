export type GamePerformance={resolution:number;shadows:0|512|1024|2048|4096;post:boolean;reflections:boolean;fps:0|30|60};
export const PERFORMANCE_KEY='abrigo-game-performance-v1';
// Editing has a separate render budget; this never enters the saved map schema.
export const MAP_EDITOR_PERFORMANCE:GamePerformance={resolution:1,shadows:1024,post:false,reflections:false,fps:30};
export const PERFORMANCE_PROFILES:Record<string,{label:string;settings:GamePerformance}>={
 low:{label:'Leve',settings:{resolution:.75,shadows:0,post:false,reflections:false,fps:60}},
 balanced:{label:'Equilibrado',settings:{resolution:1,shadows:2048,post:false,reflections:false,fps:60}},
 high:{label:'Alto',settings:{resolution:1.5,shadows:2048,post:true,reflections:true,fps:60}},
 original:{label:'Máximo · configuração anterior',settings:{resolution:2,shadows:4096,post:true,reflections:true,fps:0}},
};
export function validateGamePerformance(raw:unknown):GamePerformance{
 const q=raw as GamePerformance;
 if(!q||![.5,.75,1,1.5,2].includes(q.resolution)||![0,512,1024,2048,4096].includes(q.shadows)||typeof q.post!=='boolean'||typeof q.reflections!=='boolean'||![0,30,60].includes(q.fps))throw Error('Configuração de desempenho inválida.');
 return {resolution:q.resolution,shadows:q.shadows,post:q.post,reflections:q.reflections,fps:q.fps};
}
export function loadGamePerformance(storage:Pick<Storage,'getItem'>):GamePerformance{
 try{const raw=storage.getItem(PERFORMANCE_KEY);if(raw)return validateGamePerformance(JSON.parse(raw));}catch{}
 return {...PERFORMANCE_PROFILES.balanced.settings};
}
