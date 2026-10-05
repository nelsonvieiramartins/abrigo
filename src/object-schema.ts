// Object recipes: a flat list of simple parts, in the spirit of img2threejs' ObjectSculptSpec component
// tree but small enough to write by hand, generate from an image in the browser, or ask an LLM to edit.
// Coordinates in metres, +Y up, +Z front; rotations in degrees; the object's base sits on y = 0.
export const OBJECT_SHAPES={box:'Caixa',cylinder:'Cilindro',cone:'Cone',sphere:'Esfera',capsule:'Cápsula',torus:'Anel',lathe:'Revolução (perfil)',extrude:'Extrusão (contorno)',tube:'Tubo (caminho)'} as const;
export type ObjectShape=keyof typeof OBJECT_SHAPES;
export const OBJECT_CATEGORIES={tool:'Ferramenta',weapon:'Arma',container:'Recipiente',light:'Iluminação',furniture:'Mobília',nature:'Natureza',misc:'Diversos'} as const;
export type ObjectCategory=keyof typeof OBJECT_CATEGORIES;
export type V3=[number,number,number];
// Interaction metadata lives on the object recipe, so an object made in the workshop
// can explicitly opt in to the character's item list instead of every prop appearing there.
export const OBJECT_ACTIONS={none:'Não pode ser segurado',carry:'Carregar',use:'Usar',swing:'Golpear / cortar'} as const;
export type ObjectAction=keyof typeof OBJECT_ACTIONS;
export const HAND_PLACEMENTS={left:'Mão esquerda',right:'Mão direita',both:'Duas mãos'} as const;
export type HandPlacement=keyof typeof HAND_PLACEMENTS;
export interface ObjectInteraction{action:ObjectAction;hands:HandPlacement[]}
export interface ObjectPart{
  id:string;name:string;shape:ObjectShape;
  position:V3;rotation:V3;
  // box: width/height/depth · cylinder/cone/capsule: [radius, height, radius] · sphere: radii · torus: [radius, tube, -]
  // lathe: scale of the profile · extrude: [scale x, scale y, depth] · tube: [radius, -, -]
  size:V3;
  color:string;roughness:number;metalness:number;
  bevel:number;               // 0..1, rounded edges for boxes and extrusions
  profile?:[number,number][]; // lathe: [radius, height] from bottom to top
  outline?:[number,number][]; // extrude: closed contour [x, y]
  holes?:[number,number][][];  // extrude: optional inner contours cut through the part
  path?:V3[];                 // tube: control points
  mirrorX?:boolean;           // adds a copy mirrored across x = 0
}
export interface ObjectSocket{name:string;position:V3;rotation:V3}
export interface ObjectSpec{
  id?:string;
  kind:'object';schemaVersion:1;name:string;category:ObjectCategory;
  wear:number;                // 0..1 procedural grime painted per vertex
  parts:ObjectPart[];sockets:ObjectSocket[];
  // Reconstruction notes, like img2threejs' review history: how it was made and how close it got.
  source?:{method:string;silhouetteScore?:number;heightMetres?:number};
  interaction?:ObjectInteraction;
}
export const MAX_PARTS=64;
const clone=<T,>(v:T):T=>JSON.parse(JSON.stringify(v));
let counter=0;
export const newPartId=()=>'p'+Date.now().toString(36)+(counter++).toString(36);
export function defaultPart(shape:ObjectShape='box'):ObjectPart{
  const base:ObjectPart={id:newPartId(),name:OBJECT_SHAPES[shape],shape,position:[0,.1,0],rotation:[0,0,0],size:[.1,.1,.1],color:'#8a7a5f',roughness:.8,metalness:0,bevel:.2};
  if(shape==='cylinder'||shape==='cone'||shape==='capsule')base.size=[.05,.15,.05];
  if(shape==='sphere')base.size=[.06,.06,.06];
  if(shape==='torus'){base.size=[.06,.012,0];base.rotation=[90,0,0];}
  if(shape==='lathe'){base.size=[1,1,1];base.position=[0,0,0];base.profile=[[0,0],[.06,0],[.07,.05],[.05,.15],[.02,.2],[0,.2]];}
  if(shape==='extrude'){base.size=[1,1,.02];base.outline=[[-.05,0],[.05,0],[.07,.1],[0,.16],[-.07,.1]];}
  if(shape==='tube'){base.size=[.012,0,0];base.position=[0,0,0];base.path=[[0,0,0],[0,.08,.03],[0,.16,0]];}
  return base;
}

// ---- validation -------------------------------------------------------------------------------
const num=(v:any,key:string,a:number,b:number,fallback?:number)=>{if(v===undefined&&fallback!==undefined)return fallback;if(typeof v!=='number'||!Number.isFinite(v)||v<a||v>b)throw new Error(`${key} deve estar entre ${a} e ${b}.`);return v;};
const vec=(v:any,key:string,a:number,b:number):V3=>{if(!Array.isArray(v)||v.length!==3)throw new Error(`${key} precisa de 3 números.`);return v.map((x,i)=>num(x,`${key}[${i}]`,a,b)) as V3;};
const col=(v:any,key:string)=>{if(typeof v!=='string'||!/^#[0-9a-f]{6}$/i.test(v))throw new Error(`Cor inválida: ${key}.`);return v;};
const text=(v:any,key:string,max=48)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw new Error(`Campo inválido: ${key}.`);return v.trim();};
const points2=(v:any,key:string,min:number):[number,number][]=>{if(!Array.isArray(v)||v.length<min||v.length>256)throw new Error(`${key} precisa de ${min} a 256 pontos.`);return v.map((p:any,i:number)=>{if(!Array.isArray(p)||p.length!==2)throw new Error(`${key}[${i}] precisa de 2 números.`);return [num(p[0],key,-5,5),num(p[1],key,-5,5)] as [number,number];});};
export function validateObjectSpec(raw:unknown):ObjectSpec{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Escolha um arquivo JSON de objeto.');
  const q=raw as any;
  if(q.kind!=='object'||q.schemaVersion!==1)throw new Error('Este arquivo não é uma receita de objeto (kind "object", schemaVersion 1).');
  if(!Array.isArray(q.parts)||!q.parts.length||q.parts.length>MAX_PARTS)throw new Error(`O objeto precisa de 1 a ${MAX_PARTS} peças.`);
  const ids=new Set<string>();
  const parts=q.parts.map((p:any,i:number):ObjectPart=>{
    if(!p||typeof p!=='object')throw new Error(`Peça ${i+1} inválida.`);
    if(!Object.hasOwn(OBJECT_SHAPES,p.shape))throw new Error(`Forma inválida na peça ${i+1}.`);
    let id=typeof p.id==='string'&&p.id?p.id.slice(0,40):newPartId();if(ids.has(id))id=newPartId();ids.add(id);
    const part:ObjectPart={id,name:text(p.name??OBJECT_SHAPES[p.shape as ObjectShape],`nome da peça ${i+1}`),shape:p.shape,
      position:vec(p.position??[0,0,0],'posição',-5,5),rotation:vec(p.rotation??[0,0,0],'rotação',-360,360),size:vec(p.size??[.1,.1,.1],'tamanho',0,5),
      color:col(p.color??'#8a7a5f','cor'),roughness:num(p.roughness,'aspereza',0,1,.8),metalness:num(p.metalness,'metal',0,1,0),bevel:num(p.bevel,'chanfro',0,1,.2),mirrorX:p.mirrorX===true};
    if(part.shape==='lathe')part.profile=points2(p.profile,'perfil',2);
    if(part.shape==='extrude'){part.outline=points2(p.outline,'contorno',3);if(Array.isArray(p.holes)&&p.holes.length)part.holes=p.holes.slice(0,16).map((hole:any)=>points2(hole,'furo',3));}
    if(part.shape==='tube'){if(!Array.isArray(p.path)||p.path.length<2||p.path.length>64)throw new Error('O tubo precisa de 2 a 64 pontos.');part.path=p.path.map((v:any)=>vec(v,'caminho',-5,5));}
    return part;
  });
  const sockets=Array.isArray(q.sockets)?q.sockets.slice(0,16).map((s:any)=>({name:text(s?.name,'nome do ponto',24),position:vec(s?.position??[0,0,0],'posição do ponto',-5,5),rotation:vec(s?.rotation??[0,0,0],'rotação do ponto',-360,360)})):[];
  const out:ObjectSpec={kind:'object',schemaVersion:1,name:text(q.name,'nome',64),category:Object.hasOwn(OBJECT_CATEGORIES,q.category)?q.category:'misc',wear:num(q.wear,'desgaste',0,1,.2),parts,sockets};
  if(q.id!==undefined)out.id=text(q.id,'identificação do objeto',96);
  if(q.interaction!==undefined){
    if(!q.interaction||typeof q.interaction!=='object'||!Object.hasOwn(OBJECT_ACTIONS,q.interaction.action)||!Array.isArray(q.interaction.hands))throw new Error('Configuração de interação inválida.');
    const hands=[...new Set(q.interaction.hands)];
    if(hands.some(hand=>!Object.hasOwn(HAND_PLACEMENTS,hand))||(q.interaction.action==='none'&&hands.length)||(q.interaction.action!=='none'&&!hands.length))throw new Error('Mãos permitidas inválidas para a interação.');
    out.interaction={action:q.interaction.action,hands};
  }
  if(q.source&&typeof q.source==='object')out.source={method:String(q.source.method??'manual').slice(0,40),...(typeof q.source.silhouetteScore==='number'?{silhouetteScore:q.source.silhouetteScore}:{}),...(typeof q.source.heightMetres==='number'?{heightMetres:q.source.heightMetres}:{})};
  return out;
}

// ---- presets: simple props written as data (a few lines each, no code) -------------------------
const P=(p:Partial<ObjectPart>&{shape:ObjectShape}):ObjectPart=>({...defaultPart(p.shape),...p,id:newPartId()});
export const OBJECT_PRESETS:Record<string,{label:string;build:()=>ObjectSpec}>={
  lantern:{label:'Lampião',build:()=>({kind:'object',schemaVersion:1,name:'Lampião',category:'light',wear:.3,interaction:{action:'use',hands:['left','right']},sockets:[{name:'grip',position:[0,.3,0],rotation:[0,0,0]}],parts:[
    P({name:'Base',shape:'lathe',color:'#3d3a33',metalness:.5,roughness:.5,profile:[[0,0],[.07,0],[.075,.02],[.06,.035],[.055,.04],[0,.04]]}),
    P({name:'Vidro',shape:'cylinder',position:[0,.11,0],size:[.048,.14,.048],color:'#e8c878',roughness:.15}),
    P({name:'Grade',shape:'tube',color:'#3d3a33',metalness:.5,size:[.004,0,0],path:[[.05,.04,0],[.055,.11,0],[.05,.18,0]],mirrorX:true}),
    P({name:'Tampa',shape:'lathe',position:[0,.18,0],color:'#3d3a33',metalness:.5,roughness:.5,profile:[[0,0],[.06,0],[.045,.04],[.015,.06],[0,.06]]}),
    P({name:'Alça',shape:'torus',position:[0,.26,0],rotation:[0,0,0],size:[.045,.005,0],color:'#2a2824',metalness:.6})]})},
  canteen:{label:'Cantil',build:()=>({kind:'object',schemaVersion:1,name:'Cantil',category:'container',wear:.35,interaction:{action:'use',hands:['left','right']},sockets:[{name:'grip',position:[0,.2,0],rotation:[0,0,0]}],parts:[
    P({name:'Corpo',shape:'sphere',position:[0,.1,0],size:[.09,.1,.04],color:'#56603f',roughness:.9}),
    P({name:'Gargalo',shape:'cylinder',position:[0,.205,0],size:[.014,.03,.014],color:'#8b8a80',metalness:.6,roughness:.4}),
    P({name:'Tampa',shape:'cylinder',position:[0,.225,0],size:[.018,.018,.018],color:'#2b2d27',roughness:.6}),
    P({name:'Costura',shape:'torus',position:[0,.1,0],rotation:[0,0,0],size:[.092,.004,0],color:'#3b4229'})]})},
  crate:{label:'Caixa de madeira',build:()=>{const parts:ObjectPart[]=[P({name:'Caixa',shape:'box',position:[0,.15,0],size:[.4,.3,.3],color:'#8a6a44',bevel:.1})];
    for(const y of [.02,.28])parts.push(P({name:'Ripa',shape:'box',position:[0,y,.152],size:[.42,.04,.012],color:'#6b5033',bevel:.2}));
    parts.push(P({name:'Diagonal',shape:'box',position:[0,.15,.155],rotation:[0,0,36],size:[.44,.035,.01],color:'#6b5033',bevel:.2}));
    return {kind:'object',schemaVersion:1,name:'Caixa de madeira',category:'container',wear:.45,sockets:[],parts};}},
  axe:{label:'Machado',build:()=>({kind:'object',schemaVersion:1,name:'Machado',category:'tool',wear:.4,interaction:{action:'swing',hands:['left','right','both']},sockets:[{name:'grip',position:[0,.12,0],rotation:[0,0,0]}],parts:[
    P({name:'Cabo',shape:'tube',color:'#7a5733',size:[.013,0,0],path:[[0,0,0],[.006,.2,0],[0,.42,0]]}),
    P({name:'Lâmina',shape:'extrude',position:[0,.36,0],size:[1,1,.018],color:'#8f9391',metalness:.7,roughness:.35,bevel:.3,outline:[[-.02,-.03],[.03,-.035],[.12,-.07],[.13,.07],[.03,.035],[-.02,.03]]}),
    P({name:'Olho',shape:'box',position:[0,.36,0],size:[.04,.06,.03],color:'#5d605e',metalness:.7,roughness:.4})]})},
  barrel:{label:'Barril',build:()=>({kind:'object',schemaVersion:1,name:'Barril',category:'container',wear:.4,sockets:[],parts:[
    P({name:'Corpo',shape:'lathe',color:'#7b5a38',profile:[[0,0],[.2,0],[.23,.15],[.24,.3],[.23,.45],[.2,.6],[0,.6]]}),
    ...[.06,.54].map(y=>P({name:'Aro',shape:'torus',position:[0,y,0],rotation:[90,0,0],size:[.21+(y===.06?.005:.005),.009,0],color:'#3c3b36',metalness:.6,roughness:.5})),
    ...[.2,.4].map(y=>P({name:'Aro',shape:'torus',position:[0,y,0],rotation:[90,0,0],size:[.235,.009,0],color:'#3c3b36',metalness:.6,roughness:.5}))]})},
};
export function presetObject(id:string){return validateObjectSpec(clone((OBJECT_PRESETS[id]??OBJECT_PRESETS.crate).build()));}
export function handItemOptions(){return {invisible:'Invisível — somente pose',...Object.fromEntries(Object.entries(OBJECT_PRESETS).flatMap(([id,p])=>{const interaction=p.build().interaction;return interaction?.hands.length?[[id,p.label]]:[]}))};}
export function objectInteraction(id:string){return id==='invisible'?{action:'use' as const,hands:['left','right','both'] as HandPlacement[]}:OBJECT_PRESETS[id]?presetObject(id).interaction:undefined;}
