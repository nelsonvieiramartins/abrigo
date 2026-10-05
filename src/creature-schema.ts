import {seededRandom} from './schema';

export const CREATURE_SPECIES = {wolf:'Lobo',werewolf:'Lobisomem',bat:'Morcego',swarm:'Enxame',snake:'Cobra',spider:'Aranha',scorpion:'Escorpião',skeleton:'Esqueleto',rat:'Rato'} as const;
export type CreatureSpecies = keyof typeof CREATURE_SPECIES;
export type CreatureMotion = 'idle'|'move'|'run'|'sprint'|'runPlus'|'attack';
export type CreatureDetail = 'low'|'high';
export interface RatShape {
 bodyLength:number;bodyWidth:number;headSize:number;muzzleLength:number;earSize:number;
 legLength:number;pawSize:number;tailLength:number;tailThickness:number;whiskerLength:number;
}
export const RAT_SHAPE_DEFAULTS:RatShape={bodyLength:1,bodyWidth:1,headSize:1,muzzleLength:1,earSize:1,legLength:1,pawSize:1,tailLength:1,tailThickness:1,whiskerLength:1};
export const RAT_ANATOMY_MAP={length:'bodyLength',spread:'bodyWidth',legs:'legLength',ears:'earSize',tail:'tailLength',thickness:'tailThickness'} as const;
export interface SpiderShape {
  abdomenWidth:number; abdomenHeight:number; abdomenLength:number;
  headWidth:number; headHeight:number; headLength:number;
  bodyHeight:number; legLength:number; legSpread:number; legThickness:number; eyeSize:number;
}
export const SPIDER_SHAPE_DEFAULTS:SpiderShape={abdomenWidth:1,abdomenHeight:1,abdomenLength:1,
  headWidth:1,headHeight:1,headLength:1,bodyHeight:1,legLength:1,legSpread:1,legThickness:1,eyeSize:1};
export interface ScorpionShape {
 bodyWidth:number;bodyLength:number;bodyHeight:number;
 legLength:number;legSpread:number;legThickness:number;
 clawSize:number;clawReach:number;clawOpening:number;
 tailLength:number;tailThickness:number;stingerSize:number;
}
export const SCORPION_SHAPE_DEFAULTS:ScorpionShape={bodyWidth:1,bodyLength:1,bodyHeight:1,
 legLength:1,legSpread:1,legThickness:1,clawSize:1,clawReach:1,clawOpening:1,
 tailLength:1,tailThickness:1,stingerSize:1};
export interface CreatureSpec {
  rat?:RatShape;
  scorpion?:ScorpionShape;
  spider?:SpiderShape;
  kind:'creature'; schemaVersion:1; species:CreatureSpecies; name:string; seed:string;
  body:{scale:number;bulk:number};
  appearance:{primary:string;secondary:string;eyes:string;markings:number};
  anatomy:{legs:number;tail:number;ears:number;wingspan:number;count:number;spread:number;length:number;thickness:number};
  behavior:{temperament:'defensive'|'territorial'|'aggressive';health:number;damage:number;speed:number;detection:number;venomous:boolean};
}
export const CREATURE_FIELDS:Record<CreatureSpecies,Array<{key:keyof CreatureSpec['anatomy'];label:string;min:number;max:number;step:number}>>={
  rat:[{key:'legs',label:'Comprimento das patas',min:.7,max:1.3,step:.01},{key:'spread',label:'Largura do corpo',min:.7,max:1.3,step:.01},{key:'length',label:'Comprimento do corpo',min:.7,max:1.3,step:.01},{key:'ears',label:'Tamanho das orelhas',min:.7,max:1.3,step:.01},{key:'tail',label:'Comprimento da cauda',min:.7,max:1.3,step:.01},{key:'thickness',label:'Espessura da cauda',min:.7,max:1.3,step:.01}],
  skeleton:[{key:'legs',label:'Comprimento das pernas',min:.85,max:1.15,step:.01},{key:'thickness',label:'Espessura dos ossos',min:.8,max:1.2,step:.01},{key:'spread',label:'Largura do tórax',min:.85,max:1.15,step:.01}],
  scorpion:[{key:'legs',label:'Comprimento das patas',min:.7,max:1.3,step:.01},{key:'spread',label:'Abertura das patas',min:.7,max:1.3,step:.01},{key:'thickness',label:'Espessura das patas',min:.7,max:1.3,step:.01},{key:'tail',label:'Tamanho da cauda',min:.7,max:1.3,step:.01}],
  spider:[{key:'legs',label:'Comprimento das patas',min:.7,max:1.3,step:.01},{key:'spread',label:'Abertura das patas',min:.7,max:1.3,step:.01},{key:'thickness',label:'Espessura das patas',min:.7,max:1.3,step:.01}],
  werewolf:[{key:'legs',label:'Comprimento das patas',min:.7,max:1.3,step:.01},{key:'tail',label:'Comprimento da cauda',min:.5,max:1.5,step:.01},{key:'ears',label:'Tamanho das orelhas',min:.7,max:1.4,step:.01}],
  wolf:[{key:'legs',label:'Comprimento das patas',min:.7,max:1.3,step:.01},{key:'tail',label:'Comprimento da cauda',min:.5,max:1.5,step:.01},{key:'ears',label:'Tamanho das orelhas',min:.7,max:1.4,step:.01}],
  bat:[{key:'wingspan',label:'Envergadura das asas',min:.7,max:1.5,step:.01},{key:'ears',label:'Tamanho das orelhas',min:.7,max:1.4,step:.01}],
  swarm:[{key:'count',label:'Quantidade de insetos',min:12,max:120,step:1},{key:'spread',label:'Dispersão do enxame',min:.4,max:1.4,step:.01}],
  snake:[{key:'length',label:'Comprimento do corpo',min:.7,max:1.5,step:.01},{key:'thickness',label:'Espessura do corpo',min:.6,max:1.4,step:.01}],
};
export function presetCreature(species:CreatureSpecies):CreatureSpec {
  if(!Object.hasOwn(CREATURE_SPECIES,species))throw new Error('Espécie de criatura inválida.');
  if(species==='rat')return {kind:'creature',schemaVersion:1,species,name:'Rato marrom',seed:'abrigo-rato-01',body:{scale:1,bulk:.35},appearance:{primary:'#756d5e',secondary:'#b1a690',eyes:'#171513',markings:.25},anatomy:{legs:1,tail:1,ears:1,wingspan:1,count:48,spread:1,length:1,thickness:1},behavior:{temperament:'territorial',health:18,damage:4,speed:2.5,detection:9,venomous:false},rat:{...RAT_SHAPE_DEFAULTS}};
  const colors={wolf:['#73766b','#c0baa3'],werewolf:['#858974','#d8d4b8'],bat:['#2f2a2f','#4a3f46'],swarm:['#c6a44c','#252b23'],snake:['#677348','#c8b878'],spider:['#51483f','#756353'],scorpion:['#51483f','#756353'],skeleton:['#d5c3a5','#ac967a']}[species];
  const result:CreatureSpec={kind:'creature',schemaVersion:1,species,name:{wolf:'Lobo da mata',werewolf:'Lobisomem',bat:'Morcego da gruta',swarm:'Enxame de vespas',snake:'Víbora da floresta',spider:'Aranha da mata',scorpion:'Escorpião da mata',skeleton:'Esqueleto da referência'}[species],seed:'floresta-2407',body:{scale:1,bulk:.5},appearance:{primary:colors[0],secondary:colors[1],eyes:species==='werewolf'?'#e7ad32':'#dfac49',markings:.55},anatomy:{legs:1,tail:1,ears:1,wingspan:1,count:48,spread:.85,length:1,thickness:1},behavior:{temperament:species==='werewolf'?'aggressive':'territorial',health:{skeleton:60,scorpion:45,spider:35,wolf:80,werewolf:180,bat:20,swarm:35,snake:30}[species],damage:{skeleton:12,scorpion:14,spider:9,wolf:18,werewolf:32,bat:5,swarm:8,snake:12}[species],speed:{skeleton:2,scorpion:1.7,spider:2,wolf:4,werewolf:5,bat:5,swarm:3,snake:1.5}[species],detection:12,venomous:species==='snake'||species==='spider'||species==='scorpion'}};
  if(species==='spider'){result.spider={...SPIDER_SHAPE_DEFAULTS};result.appearance.eyes='#151412';result.anatomy.spread=1;result.seed='aranha-referencia-01';}
  if(species==='scorpion'){result.scorpion={...SCORPION_SHAPE_DEFAULTS};result.appearance.eyes='#151412';result.anatomy.spread=1;result.seed='escorpiao-referencia-01';}
  if(species==='skeleton'){result.anatomy.spread=1;result.appearance.eyes='#29241d';result.appearance.markings=0;result.behavior.temperament='aggressive';result.seed='abrigo-esqueleto-v1';}
  return result;
}
export function validateCreatureSpec(raw:unknown):CreatureSpec {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Escolha um JSON de criatura.');
  const q=raw as any;
  if(q.kind!=='creature'||q.schemaVersion!==1)throw new Error('Receita de criatura incompatível (kind: creature, schemaVersion: 1).');
  const s=presetCreature(q.species);
  const text=(v:unknown,k:string)=>{if(typeof v!=='string'||!v.trim()||v.length>64)throw new Error('Texto inválido: '+k);return v.trim();};
  const num=(v:unknown,k:string,min:number,max:number)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw new Error(`${k}: use um valor entre ${min} e ${max}.`);return v;};
  s.name=text(q.name,'nome');s.seed=text(q.seed,'semente');
  s.body={scale:num(q.body?.scale,'Escala',.5,1.8),bulk:num(q.body?.bulk,'Volume',0,1)};
  for(const k of ['primary','secondary','eyes'] as const){const v=q.appearance?.[k];if(typeof v!=='string'||!/^#[0-9a-f]{6}$/i.test(v))throw new Error('Cor inválida: '+k);s.appearance[k]=v;}
  s.appearance.markings=num(q.appearance?.markings,'Marcas',0,1);
  // Only anatomy relevant to this species is admitted; other fields keep canonical defaults.
  for(const f of CREATURE_FIELDS[s.species])s.anatomy[f.key]=num(q.anatomy?.[f.key],f.label,f.min,f.max);
  if(!Number.isInteger(s.anatomy.count))throw new Error('A quantidade de insetos deve ser inteira.');
  if(!['defensive','territorial','aggressive'].includes(q.behavior?.temperament))throw new Error('Temperamento inválido.');
  s.behavior={temperament:q.behavior.temperament,health:num(q.behavior.health,'Vida',1,500),damage:num(q.behavior.damage,'Dano',0,100),speed:num(q.behavior.speed,'Velocidade',.1,12),detection:num(q.behavior.detection,'Percepção',1,40),venomous:false};
  if(s.species==='snake'||s.species==='swarm'||s.species==='spider'||s.species==='scorpion'){if(typeof q.behavior.venomous!=='boolean')throw new Error('Veneno deve ser verdadeiro ou falso.');s.behavior.venomous=q.behavior.venomous;}
  if(s.species==='spider'){
    s.spider={...SPIDER_SHAPE_DEFAULTS,legLength:s.anatomy.legs,legSpread:s.anatomy.spread,legThickness:s.anatomy.thickness};
    if(q.spider!==undefined){
      if(!q.spider||typeof q.spider!=='object'||Array.isArray(q.spider))throw new Error('Formato spider inválido.');
      for(const key of Object.keys(SPIDER_SHAPE_DEFAULTS) as Array<keyof SpiderShape>){
        if(q.spider[key]!==undefined)s.spider[key]=num(q.spider[key],'Aranha: '+key,.7,1.3);
      }
    }
  }
  if(s.species==='scorpion'){
    s.scorpion={...SCORPION_SHAPE_DEFAULTS,legLength:s.anatomy.legs,legSpread:s.anatomy.spread,legThickness:s.anatomy.thickness,tailLength:s.anatomy.tail};
    if(q.scorpion!==undefined){
      if(!q.scorpion||typeof q.scorpion!=='object'||Array.isArray(q.scorpion))throw new Error('Formato scorpion inválido.');
      for(const key of Object.keys(SCORPION_SHAPE_DEFAULTS) as Array<keyof ScorpionShape>){
        if(q.scorpion[key]!==undefined)s.scorpion[key]=num(q.scorpion[key],'Escorpião: '+key,.7,1.3);
      }
    }
  }
  if(s.species==='spider'&&s.spider){s.anatomy.legs=s.spider.legLength;s.anatomy.spread=s.spider.legSpread;s.anatomy.thickness=s.spider.legThickness;}
  if(s.species==='rat'){
    s.rat={...RAT_SHAPE_DEFAULTS};
    for(const key of Object.keys(RAT_ANATOMY_MAP) as Array<keyof typeof RAT_ANATOMY_MAP>)s.rat[RAT_ANATOMY_MAP[key]]=s.anatomy[key];
    if(q.rat!==undefined){
      if(!q.rat||typeof q.rat!=='object'||Array.isArray(q.rat))throw new Error('Formato rat inválido.');
      for(const key of Object.keys(RAT_SHAPE_DEFAULTS) as Array<keyof RatShape>)if(q.rat[key]!==undefined)s.rat[key]=num(q.rat[key],'Rato: '+key,.7,1.3);
    }
    for(const key of Object.keys(RAT_ANATOMY_MAP) as Array<keyof typeof RAT_ANATOMY_MAP>)s.anatomy[key]=s.rat[RAT_ANATOMY_MAP[key]];
  }
  if(s.species==='scorpion'&&s.scorpion){s.anatomy.legs=s.scorpion.legLength;s.anatomy.spread=s.scorpion.legSpread;s.anatomy.thickness=s.scorpion.legThickness;s.anatomy.tail=s.scorpion.tailLength;}
  return s;
}
export function randomCreature(seed:string,species:CreatureSpecies='wolf'):CreatureSpec {
  const s=presetCreature(species),r=seededRandom(seed+':creature:'+species),n=(a:number,b:number)=>Math.round((a+r()*(b-a))*100)/100;
  s.seed=seed;s.body={scale:n(.8,1.2),bulk:n(.2,.9)};s.appearance.markings=n(.15,.95);
  const palettes=[['#666b62','#c1bca4'],['#655044','#b69774'],['#343a39','#818a79'],['#847965','#d1c9a8']];
  if(species==='skeleton'){palettes.splice(0,palettes.length,['#d5c3a5','#ac967a'],['#c8b699','#93836c']);s.appearance.markings=0;}
  const palette=palettes[Math.floor(r()*palettes.length)];s.appearance.primary=palette[0];s.appearance.secondary=palette[1];
  for(const f of CREATURE_FIELDS[species])s.anatomy[f.key]=f.step===1?Math.round(n(f.min,f.max)):n(f.min,f.max);
  if(species==='spider')s.spider={...SPIDER_SHAPE_DEFAULTS,legLength:s.anatomy.legs,legSpread:s.anatomy.spread,legThickness:s.anatomy.thickness};
  if(species==='rat'){
    s.rat={...RAT_SHAPE_DEFAULTS,bodyLength:s.anatomy.length,bodyWidth:s.anatomy.spread,legLength:s.anatomy.legs,earSize:s.anatomy.ears,tailLength:s.anatomy.tail,tailThickness:s.anatomy.thickness,headSize:n(.8,1.2),muzzleLength:n(.8,1.2),pawSize:n(.8,1.2),whiskerLength:n(.8,1.2)};
  }
  if(species==='scorpion')s.scorpion={...SCORPION_SHAPE_DEFAULTS,legLength:s.anatomy.legs,legSpread:s.anatomy.spread,legThickness:s.anatomy.thickness,tailLength:s.anatomy.tail};
  return validateCreatureSpec(s);
}
