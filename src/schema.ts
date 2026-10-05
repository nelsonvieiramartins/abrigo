import {objectInteraction,validateObjectSpec,type HandPlacement,type ObjectSpec} from './object-schema';
export const SCHEMA_VERSION = 1;
export const MOTIONS = {idle:'Parado',walk:'Caminhar',crouchWalk:'Andar agachado',backward:'Recuar',run:'Correr',sprint:'Correr+',jumpWalk:'Pulo · caminhada',jumpRun:'Pulo · correr',jumpSprint:'Pulo · correr+',pose:'Pose',wave:'Acenar',crouch:'Agachar',pickup:'Pegar',jump:'Saltar',attack:'Cortar / atacar vertical',attackLateral:'Cortar / atacar lateral',walkAttackLateral:'Caminhar + atacar lateral',runAttackLateral:'Correr + atacar lateral',backwardAttackLateral:'Recuar + atacar lateral',pray:'Orar'} as const;
export type Motion = keyof typeof MOTIONS;
export const OPTIONS = {
  // Reference-based pieces are excluded from the historical random pools below.
  hair: {lumber:'Topete esculpido', crop:'Curto', side:'Lateral', messy:'Despenteado', buzz:'Raspado', bob:'Chanel', long:'Comprido', quiff:'Topete', fade:'Degradê', spiky:'Espetado', fringe:'Franja', slicked:'Para trás', wavy:'Médio ondulado', ponytail:'Rabo de cavalo', tousled:'Repicado', balding:'Careca', bald:'Sem cabelo'},
  beard: {none:'Sem barba', stubble:'Por fazer', full:'Cheia', moustache:'Bigode', goatee:'Cavanhaque', lumber:'Barba esculpida'},
  faceShape: {oval:'Oval', square:'Quadrado', round:'Redondo', long:'Alongado', heart:'Coração'},
  chin: {round:'Arredondado', square:'Quadrado', pointed:'Fino', strong:'Proeminente', vshape:'Pontudo'},
  brows: {natural:'Naturais', thick:'Grossas', thin:'Finas', arched:'Arqueadas', angled:'Angulosas', flat:'Retas'},
  nose: {medium:'Médio', wide:'Largo', narrow:'Fino', long:'Comprido', button:'Arrebitado', small:'Pequeno'},
  mouth: {medium:'Média', full:'Carnuda', thin:'Fina', wide:'Larga', shaped:'Desenhada'},
  top: {zombie:'Jaqueta gasta do Zumbi', lumber:'Flanela e jaqueta', painter:'Colete do Pintor', nightshift:'Uniforme noturno', jacket:'Jaqueta de campo', tshirt:'Camiseta', tank:'Regata', hoodie:'Moletom', fieldshirt:'Camisa de campo', engineer:'Camisa e corpete', none:'Sem camisa'},
  pants: {cargo:'Cargo', jeans:'Jeans', shorts:'Bermuda', briefs:'Cueca'},
  shoes: {boots:'Botas', sneakers:'Tênis', heels:'Sapatos de salto', tallboots:'Botas altas de cadarço', socks:'Só meias',barefoot:'Descalço',wornSneakers:'Tênis gastos e furados',singleSneakerLeft:'Tênis gasto só no pé esquerdo',singleSneakerRight:'Tênis gasto só no pé direito',wornBoots:'Botas gastas e furadas'},
  hat: {none:'Sem acessório', beanie:'Gorro', cap:'Boné', camo:'Boné camuflado'},
  profession: {zumbi:'Zumbi', lenhador:'Lenhador', nightshift:'Atendente noturna', pintor:'Pintor', ranger:'Guarda florestal', mechanic:'Mecânico', medic:'Socorrista', civilian:'Civil', legendario:'Legendário', explorer:'Exploradora', pedepano:'Pé de Pano', engineer:'Engenheira'},
};
export const SKINS=['#e2b899','#cd9b78','#b7845f','#936746','#714b34','#4c3228'];
export const HAIR_COLORS=['#241e1a','#4b3327','#7c5738','#b19a68','#91452f','#a2a09a'];
export const CLOTH_COLORS=['#64715b','#35494b','#81795d','#ae714e','#803f37','#b0afa3','#343c45','#4f6581'];
export const TRAITS = [
 {id:'fit',name:'Atlético',cost:4,description:'Vigor +2',stat:'vigor',amount:2},
 {id:'strong',name:'Forte',cost:4,description:'Força +2',stat:'strength',amount:2},
 {id:'quiet',name:'Discreto',cost:3,description:'Furtividade +2',stat:'stealth',amount:2},
 {id:'handy',name:'Habilidoso',cost:2,description:'Técnica +2',stat:'craft',amount:2},
 {id:'unfit',name:'Sedentário',cost:-3,description:'Vigor −2',stat:'vigor',amount:-2},
 {id:'weak',name:'Frágil',cost:-3,description:'Força −2',stat:'strength',amount:-2},
];
export interface CharacterSpec {
 schemaVersion:1; seed:string; name:string;
 body:{height:number;build:number;shoulders:number;hips:number;head:number;bust:number};
 appearance:{skin:string;hair:string;hairColor:string;beard:string;eyeColor:string;faceWidth:number;faceShape:string;chin:string;chinSize:number;cheeks:number;brows:string;nose:string;mouth:string;makeup:boolean;fine?:Record<string,number>};
 outfit:{top:string;topColor:string;pants:string;pantsColor:string;shoes:string;shoeColor:string;hat:string;backpack:boolean;glasses:boolean;gloves:boolean;toolBelt:boolean};
 items:{object:string;placement:HandPlacement|'none';recipe?:ObjectSpec;pose:'relaxed'|'ready'|'twoHanded';twoHandSpread?:number;scale:number;offset:[number,number,number];rotation:[number,number,number];armMotion:Record<Motion,boolean>;arms:{left:{spread:number;twist:number;swing:number};right:{spread:number;twist:number;swing:number}};hands:{left:'open'|'closed';right:'open'|'closed'};grip:{left:[number,number,number,number,number];right:[number,number,number,number,number]}};
 style?:'faceted';
 wear:number;profession:string;traits:string[];
}
export const DEFAULT:CharacterSpec={
 schemaVersion:1,seed:'2407',name:'Alex Morgan',
 body:{height:1.78,build:.5,shoulders:.55,hips:.45,head:1,bust:0},
 appearance:{skin:SKINS[1],hair:'side',hairColor:HAIR_COLORS[1],beard:'stubble',eyeColor:'#3e5148',faceWidth:1,faceShape:'oval',chin:'round',chinSize:.5,cheeks:.5,brows:'natural',nose:'medium',mouth:'medium',makeup:false},
 outfit:{top:'jacket',topColor:CLOTH_COLORS[0],pants:'cargo',pantsColor:'#4a4a3e',shoes:'boots',shoeColor:'#302922',hat:'none',backpack:true,glasses:false,gloves:false,toolBelt:false},
 items:{object:'none',placement:'none',pose:'relaxed',scale:1,offset:[0,0,0],rotation:[0,0,0],armMotion:{idle:false,walk:false,crouchWalk:false,backward:false,run:false,sprint:false,jumpWalk:false,jumpRun:false,jumpSprint:false,pose:false,wave:false,crouch:false,pickup:false,jump:false,attack:true,attackLateral:true,walkAttackLateral:true,runAttackLateral:true,backwardAttackLateral:true,pray:false},arms:{left:{spread:0,twist:0,swing:0},right:{spread:0,twist:0,swing:0}},hands:{left:'open',right:'open'},grip:{left:[0,0,0,0,0],right:[0,0,0,0,0]}},
 wear:.22,profession:'ranger',traits:['quiet'],
};
// Advanced face mode: fine offsets (-1..1, 0 = the preset as is) added on top of the face presets.
// [id, label, low end, high end], grouped as shown in the editor.
export const FINE_FACE:{group:string;items:[string,string,string,string][]}[]=[
 {group:'Rosto',items:[['faceLength','Comprimento do rosto','Curto','Longo'],['forehead','Largura da testa','Estreita','Larga'],['cheekbones','Maçãs do rosto','Estreitas','Largas'],['jaw','Largura da mandíbula','Estreita','Larga'],['faceDepth','Profundidade do rosto','Plano','Fundo']]},
 {group:'Queixo',items:[['chinWidth','Largura do queixo','Fino','Largo'],['chinDrop','Altura do queixo','Curto','Longo'],['chinForward','Projeção do queixo','Recuado','Projetado']]},
 {group:'Olhos',items:[['eyeHeight','Altura dos olhos','Baixos','Altos'],['eyeSpacing','Distância entre os olhos','Juntos','Separados'],['eyeSize','Tamanho dos olhos','Pequenos','Grandes'],['eyeWidth','Formato dos olhos','Redondos','Amendoados'],['eyeTilt','Inclinação dos olhos','Caídos','Puxados'],['eyeDepth','Profundidade dos olhos','Fundos','Saltados'],['irisSize','Tamanho da íris','Pequena','Grande'],['lidDrop','Pálpebra superior','Aberta','Pesada']]},
 {group:'Sobrancelhas',items:[['browHeight','Altura','Baixas','Altas'],['browTilt','Inclinação','Tristes','Bravas'],['browThickness','Espessura','Finas','Grossas'],['browLength','Comprimento','Curtas','Longas'],['browSpacing','Distância','Juntas','Separadas']]},
 {group:'Nariz',items:[['noseHeight','Altura do nariz','Baixo','Alto'],['noseWidth','Largura','Fino','Largo'],['noseLength','Comprimento','Curto','Comprido'],['noseProjection','Projeção','Achatado','Projetado'],['noseTip','Ponta','Fina','Redonda']]},
 {group:'Boca',items:[['mouthHeight','Altura da boca','Baixa','Alta'],['mouthWidth','Largura','Estreita','Larga'],['upperLip','Lábio superior','Fino','Cheio'],['lowerLip','Lábio inferior','Fino','Cheio'],['mouthCorners','Cantos da boca','Para baixo','Para cima']]},
 {group:'Orelhas',items:[['earSize','Tamanho','Pequenas','Grandes'],['earHeight','Altura','Baixas','Altas'],['earAngle','Abertura','Coladas','Abertas']]},
];
export const FINE_KEYS=FINE_FACE.flatMap(g=>g.items.map(i=>i[0]));
// Ready-made face types: combinations of the individual face features (and, for saved types, the fine offsets).
export type FaceType={label:string;faceShape:string;chin:string;chinSize?:number;cheeks:number;brows:string;nose:string;mouth:string;fine?:Record<string,number>};
export const FACE_TYPES:Record<string,FaceType&{cheeks:number;brows:string;nose:string;mouth:string}>={
 classic:{label:'Clássico',faceShape:'oval',chin:'round',chinSize:.5,cheeks:.5,brows:'natural',nose:'medium',mouth:'medium'},
 strong:{label:'Forte',faceShape:'square',chin:'square',cheeks:.45,brows:'thick',nose:'wide',mouth:'full'},
 long:{label:'Alongado',faceShape:'long',chin:'strong',cheeks:.35,brows:'flat',nose:'long',mouth:'thin'},
 angular:{label:'Anguloso',faceShape:'heart',chin:'pointed',cheeks:.3,brows:'angled',nose:'narrow',mouth:'thin'},
 round:{label:'Redondo',faceShape:'round',chin:'round',cheeks:.9,brows:'arched',nose:'button',mouth:'medium'},
 rugged:{label:'Rústico',faceShape:'square',chin:'strong',cheeks:.55,brows:'thick',nose:'long',mouth:'wide'},
 marked:{label:'Marcado',faceShape:'square',chin:'square',cheeks:.35,brows:'angled',nose:'medium',mouth:'thin'},
 gentle:{label:'Suave',faceShape:'heart',chin:'round',cheeks:.6,brows:'thin',nose:'button',mouth:'full'},
};
export const FACE_KEYS=['faceShape','chin','chinSize','cheeks','brows','nose','mouth'] as const;
// Types saved before the chin size existed use the neutral value.
export function applyFace(s:CharacterSpec,f:FaceType){for(const k of FACE_KEYS)(s.appearance as any)[k]=k==='chinSize'?f.chinSize??.5:f[k];if(f.fine&&Object.keys(f.fine).length)s.appearance.fine={...f.fine};else delete s.appearance.fine;return s;}
export function applyFaceType(s:CharacterSpec,id:string){return applyFace(s,FACE_TYPES[id]);}
export function clone<T>(value:T):T {return JSON.parse(JSON.stringify(value));}
export function seededRandom(seed:string){
 let h=2166136261;
 for(const c of seed)h=Math.imul(h^c.charCodeAt(0),16777619);
 return ()=>{ h+=0x6D2B79F5;let t=h;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};
}
export function randomCharacter(seed:string):CharacterSpec{
 const r=seededRandom(seed),pick=<T>(a:T[])=>a[Math.floor(r()*a.length)],n=(lo:number,hi:number)=>Math.round((lo+r()*(hi-lo))*100)/100;
 const s=clone(DEFAULT);s.seed=seed;
 s.name=pick(['Alex','Morgan','Sam','Riley','Jordan','Robin','Taylor'])+' '+pick(['Reed','Miller','Santos','Vieira','Walker','Hayes']);
 s.body={height:n(1.58,1.94),build:n(.15,.9),shoulders:n(.2,.9),hips:n(.2,.9),head:n(.94,1.07),bust:r()<.4?n(.3,.9):0};
 s.appearance={...s.appearance,skin:pick(SKINS),hair:pick(Object.keys(OPTIONS.hair).filter(k=>!['quiff','fade','spiky','fringe','slicked','wavy','tousled','lumber'].includes(k))),hairColor:pick(HAIR_COLORS),beard:pick(Object.keys(OPTIONS.beard).filter(k=>k!=='goatee'&&k!=='lumber')),eyeColor:pick(['#3e5148','#665141','#4a5962']),faceWidth:n(.9,1.1)};
 {const f=seededRandom(seed+':face'),fp=<T>(a:T[])=>a[Math.floor(f()*a.length)];
  for(const k of ['faceShape','chin','brows','nose','mouth'] as const)s.appearance[k]=fp(Object.keys(OPTIONS[k]).filter(o=>o!=='small'&&o!=='vshape'&&o!=='shaped'));
  s.appearance.cheeks=Math.round((.2+f()*.7)*100)/100;if(s.appearance.beard==='full'&&f()<.25)s.appearance.beard='goatee';
  if(s.appearance.hair!=='bald'&&s.appearance.hair!=='balding'&&f()<.45)s.appearance.hair=fp(['quiff','fade','spiky','fringe','slicked','wavy']);}
 // Options added after release stay out of the random pools, so every existing seed keeps its character.
 const dressed=(o:Record<string,string>)=>Object.keys(o).filter(k=>!['barefoot','wornSneakers','singleSneakerLeft','singleSneakerRight','wornBoots'].includes(k)&&k!=='none'&&k!=='briefs'&&k!=='socks'&&k!=='painter'&&k!=='engineer'&&k!=='tallboots'&&k!=='heels'&&k!=='lumber'&&k!=='nightshift'&&k!=='zombie'&&k!=='zumbi');
 s.outfit={top:pick(dressed(OPTIONS.top)),topColor:pick(CLOTH_COLORS),pants:pick(dressed(OPTIONS.pants)),pantsColor:pick(CLOTH_COLORS),shoes:pick(dressed(OPTIONS.shoes)),shoeColor:pick(['#302922','#4c4438','#535452']),hat:pick(['none','none','none','beanie','cap']),backpack:r()>.35,glasses:r()>.75,gloves:false,toolBelt:false};
 s.wear=n(0,.8);s.profession=pick(Object.keys(OPTIONS.profession).filter(k=>k!=='pedepano'&&k!=='pintor'&&k!=='engineer'&&k!=='lenhador'&&k!=='nightshift'&&k!=='zombie'&&k!=='zumbi'));s.traits=[];return s;
}
export function presetCharacter(id:string):CharacterSpec{
 const s=clone(DEFAULT);s.profession=id;
 if(id==='zumbi'){
   s.name='Zumbi';s.seed='zumbi-17';s.body={height:1.90,build:.85,shoulders:.95,hips:.42,head:1.05,bust:0};
   s.appearance={...s.appearance,skin:'#a0aa82',hair:'messy',hairColor:'#30312b',beard:'none',eyeColor:'#e8dfb7',faceShape:'long',chin:'pointed',cheeks:.25,brows:'angled',nose:'narrow',mouth:'wide'};
   s.outfit={top:'zombie',topColor:'#73533b',pants:'jeans',pantsColor:'#354457',shoes:'sneakers',shoeColor:'#654a34',hat:'none',backpack:false,glasses:false,gloves:false,toolBelt:false};
   s.wear=.85;s.traits=[];
 }
 if(id==='lenhador'){
   s.name='Lenhador';s.seed='lenhador-2026';
   s.body={height:1.90,build:.85,shoulders:.95,hips:.42,head:1.05,bust:0};
   s.appearance={...s.appearance,skin:'#ce8960',hair:'lumber',hairColor:'#202126',beard:'lumber',eyeColor:'#38251d',faceWidth:1.10,faceShape:'square',chin:'strong',chinSize:.7,cheeks:.25,brows:'angled',nose:'wide',mouth:'thin',fine:{browTilt:.8,browThickness:.7,browHeight:-.3,eyeSize:-.15,cheekbones:.6,jaw:.35,noseProjection:.3}};
   s.outfit={...s.outfit,top:'lumber',topColor:'#42553a',pants:'jeans',pantsColor:'#39495e',shoes:'boots',shoeColor:'#643d29',hat:'none',backpack:false,glasses:false};
   s.traits=['strong','handy'];s.wear=.08;
 }
 if(id==='nightshift'){
   s.name='Maya Varela';s.seed='maya-varela-2026';
   s.body={height:1.69,build:.36,shoulders:.30,hips:.72,head:1.06,bust:.70};
   s.appearance={...s.appearance,skin:'#c98769',hair:'tousled',hairColor:'#b85f45',beard:'none',eyeColor:'#5d453a',faceWidth:.94,faceShape:'heart',chin:'pointed',chinSize:.36,cheeks:.55,brows:'arched',nose:'small',mouth:'full',makeup:true,fine:{eyeSize:.38,eyeWidth:.28,eyeTilt:.12,irisSize:.25,upperLip:.22,lowerLip:.28,cheekbones:.22}};
   s.outfit={top:'nightshift',topColor:'#211d28',pants:'shorts',pantsColor:'#251927',shoes:'heels',shoeColor:'#292633',hat:'none',backpack:false,glasses:false,gloves:false,toolBelt:false};
   s.wear=.04;s.traits=['quiet'];
 }
 if(id==='pintor'){
   s.name='Pintor';s.seed='pintor-2026';
   s.body={height:1.76,build:.23,shoulders:.35,hips:.40,head:1.15,bust:0};
   s.appearance={...s.appearance,skin:'#edba94',hair:'messy',hairColor:'#302a28',beard:'none',eyeColor:'#315e61',faceWidth:.95,faceShape:'heart',chin:'round',chinSize:.32,cheeks:.45,brows:'angled',nose:'button',mouth:'thin'};
   s.outfit={top:'painter',topColor:'#735039',pants:'jeans',pantsColor:'#343e4b',shoes:'boots',shoeColor:'#65462e',hat:'none',backpack:false,glasses:false,gloves:false,toolBelt:false};
   s.wear=.04;s.traits=['handy'];
 }
 // Engenheira: ivory shirt with rolled sleeves under a dark buttoned corset, leather harness, tool belt
 // with a gear buckle and pouches, gloves, slim grey trousers and tall laced boots. Tousled auburn hair.
 if(id==='engineer'){
   s.name='Engenheira';s.seed='engenheira-2026';
   s.body={height:1.68,build:.3,shoulders:.24,hips:.42,head:1.04,bust:.72};
   s.appearance={...s.appearance,skin:'#e8b392',hair:'tousled',hairColor:'#3f211d',beard:'none',eyeColor:'#8a5716',faceWidth:.95,faceShape:'round',chin:'vshape',chinSize:.3,cheeks:.6,brows:'angled',nose:'small',mouth:'shaped',makeup:true};
   s.outfit={top:'engineer',topColor:'#3b312c',pants:'jeans',pantsColor:'#4a505c',shoes:'tallboots',shoeColor:'#6a4430',hat:'none',backpack:false,glasses:false,gloves:true,toolBelt:true};
   s.wear=.06;s.traits=['handy'];
 }
 if(id==='mechanic')applyFaceType(s,'rugged');
 if(id==='medic')applyFaceType(s,'gentle');
 if(id==='legendario')applyFaceType(s,'strong');
 if(id==='explorer')applyFaceType(s,'angular');
 if(id==='pedepano')applyFaceType(s,'long');
 if(id==='mechanic'){s.name='Dylan Reed';s.outfit.top='tshirt';s.outfit.topColor='#4f6581';s.outfit.backpack=false;s.outfit.hat='cap';s.appearance.beard='full';s.wear=.58;s.traits=['handy'];}
 if(id==='medic'){s.name='Robin Santos';s.body.shoulders=.25;s.body.hips=.75;s.appearance.hair='ponytail';s.appearance.beard='none';s.outfit.top='hoodie';s.outfit.topColor='#b0afa3';s.outfit.pants='jeans';s.outfit.pantsColor='#4f6581';s.outfit.shoes='sneakers';s.wear=.12;s.traits=['fit'];}
 // Orange field shirt with camouflage pocket panels and patches, camo cap, dark fitted trousers, black trainers.
 if(id==='legendario'){s.name='Davi Rocha';s.body={height:1.8,build:.68,shoulders:.72,hips:.4,head:1};s.appearance={...s.appearance,skin:SKINS[2],hair:'crop',hairColor:HAIR_COLORS[0],beard:'full'};s.outfit={top:'fieldshirt',topColor:'#e2672a',pants:'jeans',pantsColor:'#24292b',shoes:'sneakers',shoeColor:'#1c1d1f',hat:'camo',backpack:false,glasses:false,gloves:false,toolBelt:false};s.wear=.12;s.traits=['fit'];}
 if(id==='explorer'){s.name='Ana Duarte';s.body={height:1.67,build:.35,shoulders:.22,hips:.78,head:.98,bust:.7};s.appearance={...s.appearance,skin:SKINS[1],hair:'long',hairColor:HAIR_COLORS[2],beard:'none',eyeColor:'#665141',faceWidth:.93};s.outfit={top:'jacket',topColor:'#81795d',pants:'cargo',pantsColor:'#3f463a',shoes:'boots',shoeColor:'#4c4438',hat:'none',backpack:true,glasses:false,gloves:false,toolBelt:false};s.wear=.3;s.traits=['quiet'];}
 // Pé de Pano: no shirt, white briefs and white socks; moves without a sound.
 if(id==='pedepano'){s.name='Pé de Pano';s.body={height:1.74,build:.42,shoulders:.45,hips:.4,head:1,bust:0};s.appearance={...s.appearance,skin:SKINS[1],hair:'messy',hairColor:HAIR_COLORS[1],beard:'stubble'};s.outfit={top:'none',topColor:'#e9e6dc',pants:'briefs',pantsColor:'#eeebe3',shoes:'socks',shoeColor:'#f1efe9',hat:'none',backpack:false,glasses:false,gloves:false,toolBelt:false};s.wear=.08;s.traits=['quiet'];}
 if(id==='civilian'){s.name='Sam Walker';s.appearance.hair='messy';s.appearance.beard='none';s.outfit.top='tank';s.outfit.topColor='#803f37';s.outfit.pants='shorts';s.outfit.backpack=false;s.outfit.shoes='sneakers';s.traits=[];}
 return s;
}
export function validateSpec(raw:unknown):CharacterSpec{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Escolha um arquivo JSON de personagem.');
 const q=raw as any;
 if(q.schemaVersion!==1)throw new Error('Versão de personagem incompatível. Esperado: schemaVersion 1.');
 const s=clone(DEFAULT);
 if(q.style!==undefined){if(q.style!=='faceted')throw new Error('Estilo de malha inválido.');s.style='faceted';}
 const text=(v:any,key:string,max=64)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw new Error(`Campo inválido: ${key}.`);return v.trim();};
 const num=(v:any,key:string,a:number,b:number)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<a||v>b)throw new Error(`${key} deve estar entre ${a} e ${b}.`);return v;};
 const col=(v:any,key:string)=>{if(typeof v!=='string'||!/^#[0-9a-f]{6}$/i.test(v))throw new Error(`Cor inválida: ${key}.`);return v;};
 const opt=(v:any,key:keyof typeof OPTIONS)=>{if(typeof v!=='string'||!Object.hasOwn(OPTIONS[key],v))throw new Error(`Opção inválida: ${key}.`);return v;};
 const flag=(v:any,key:string)=>{if(typeof v!=='boolean')throw new Error(`Campo inválido: ${key}.`);return v;};
 s.name=text(q.name,'nome');s.seed=text(q.seed,'semente');
 if(!q.body||!q.appearance||!q.outfit)throw new Error('O arquivo precisa de corpo, aparência e roupas.');
 s.body={height:num(q.body.height,'Altura',1.5,2),build:num(q.body.build,'Constituição',0,1),shoulders:num(q.body.shoulders,'Ombros',0,1),hips:num(q.body.hips,'Quadril',0,1),head:num(q.body.head,'Cabeça',.85,1.15),bust:q.body.bust===undefined?0:num(q.body.bust,'Busto',0,1)};
 s.appearance={skin:col(q.appearance.skin,'pele'),hair:opt(q.appearance.hair,'hair'),hairColor:col(q.appearance.hairColor,'cabelo'),beard:opt(q.appearance.beard,'beard'),eyeColor:col(q.appearance.eyeColor,'olhos'),faceWidth:num(q.appearance.faceWidth,'Rosto',.85,1.15),
  // Face features are optional in files saved before they existed.
  faceShape:q.appearance.faceShape===undefined?'oval':q.appearance.faceShape==='block'?'square':opt(q.appearance.faceShape,'faceShape'),chin:q.appearance.chin===undefined?'round':q.appearance.chin==='flat'?'square':opt(q.appearance.chin,'chin'),chinSize:q.appearance.chinSize===undefined?.5:num(q.appearance.chinSize,'Tamanho do queixo',0,1),cheeks:q.appearance.cheeks===undefined?.5:num(q.appearance.cheeks,'Bochechas',0,1),
  brows:q.appearance.brows===undefined?'natural':opt(q.appearance.brows,'brows'),nose:q.appearance.nose===undefined?'medium':opt(q.appearance.nose,'nose'),mouth:q.appearance.mouth===undefined?'medium':opt(q.appearance.mouth,'mouth'),makeup:q.appearance.makeup===undefined?false:flag(q.appearance.makeup,'maquiagem')};
 // Fine face offsets are optional; only known keys in -1..1 are kept.
 if(q.appearance.fine!==undefined){
   if(!q.appearance.fine||typeof q.appearance.fine!=='object'||Array.isArray(q.appearance.fine))throw new Error('Campo inválido: ajuste fino do rosto.');
   const fine:Record<string,number>={};for(const [k,v] of Object.entries(q.appearance.fine)){if(!FINE_KEYS.includes(k))continue;fine[k]=num(v,'Ajuste fino '+k,-1,1);}
   if(Object.keys(fine).length)s.appearance.fine=fine;
 }
 s.outfit={top:opt(q.outfit.top,'top'),topColor:col(q.outfit.topColor,'camisa'),pants:opt(q.outfit.pants,'pants'),pantsColor:col(q.outfit.pantsColor,'calça'),shoes:opt(q.outfit.shoes,'shoes'),shoeColor:col(q.outfit.shoeColor,'calçados'),hat:opt(q.outfit.hat,'hat'),backpack:flag(q.outfit.backpack,'mochila'),glasses:flag(q.outfit.glasses,'óculos'),
  // Gloves and tool belt are optional in files saved before they existed.
  gloves:q.outfit.gloves===undefined?false:flag(q.outfit.gloves,'luvas'),toolBelt:q.outfit.toolBelt===undefined?false:flag(q.outfit.toolBelt,'cinto de ferramentas')};
 if(q.items!==undefined&&(!q.items||typeof q.items!=='object'||Array.isArray(q.items)))throw new Error('Campo inválido: itens.');
 // Old character files stored only `items.hand`; keep them playable while moving to
 // object-linked items with an explicit hand placement.
 const legacyHand=q.items?.hand;
 const itemId=q.items===undefined?'none':q.items.object===undefined?(legacyHand==='axe'?'axe':'none'):q.items.object;
 const recipe=itemId==='custom'?validateObjectSpec(q.items?.recipe):undefined;
 if(typeof itemId!=='string'||(itemId!=='none'&&itemId!=='custom'&&!objectInteraction(itemId)))throw new Error('Objeto de item inválido.');
 const interaction=itemId==='none'?undefined:itemId==='custom'?recipe!.interaction:objectInteraction(itemId)!;
 if(itemId==='custom'&&!interaction?.hands.length)throw new Error('O objeto personalizado não está configurado para interação em mãos.');
 const placement=q.items?.placement===undefined?(itemId==='none'?'none':'right'):q.items.placement;
 if(placement!=='none'&&placement!=='left'&&placement!=='right'&&placement!=='both')throw new Error('Posição do item inválida.');
 if(itemId==='none'?placement!=='none':!interaction.hands.includes(placement))throw new Error('Este objeto não pode ser usado nessa mão.');
 const vector=(v:any,key:string,limit:number):[number,number,number]=>{if(!Array.isArray(v)||v.length!==3)throw new Error(`${key} precisa ter 3 valores.`);return v.map((n,i)=>num(n,`${key}[${i}]`,-limit,limit)) as [number,number,number];};
 const pose=q.items?.pose===undefined?'relaxed':q.items.pose;
 if(pose!=='relaxed'&&pose!=='ready'&&pose!=='twoHanded')throw new Error('Pose de item inválida.');
 const handState=(v:any,key:string):'open'|'closed'=>v===undefined?'open':v==='open'||v==='closed'?v:(()=>{throw new Error(`Estado inválido: ${key}.`);})();
 const handStates={left:handState(q.items?.hands?.left,'mão esquerda'),right:handState(q.items?.hands?.right,'mão direita')};
 const grip=(side:'left'|'right'):[number,number,number,number,number]=>{const raw=q.items?.grip?.[side];if(raw===undefined)return [handStates[side]==='closed'?1:0,handStates[side]==='closed'?1:0,handStates[side]==='closed'?1:0,handStates[side]==='closed'?1:0,handStates[side]==='closed'?1:0];if(!Array.isArray(raw)||raw.length!==5)throw new Error(`Fechamento da mão ${side} precisa ter 5 valores.`);return raw.map((n,i)=>num(n,`Fechamento da mão ${side}[${i}]`,0,1)) as [number,number,number,number,number];};
 const arm=(side:'left'|'right')=>({spread:q.items?.arms?.[side]?.spread===undefined?0:num(q.items.arms[side].spread,`Abertura do braço ${side}`,-1,1),twist:q.items?.arms?.[side]?.twist===undefined?0:num(q.items.arms[side].twist,`Torção do braço ${side}`,-1,1),swing:q.items?.arms?.[side]?.swing===undefined?0:num(q.items.arms[side].swing,`Giro do braço ${side}`,-1,1)});
 const armMotion=Object.fromEntries((Object.keys(MOTIONS) as Motion[]).map(m=>[m,q.items?.armMotion?.[m]===undefined?(m==='attack'||m==='attackLateral'||m==='walkAttackLateral'||m==='runAttackLateral'||m==='backwardAttackLateral'):flag(q.items.armMotion[m],`movimento do braço ${m}`)])) as Record<Motion,boolean>;
 s.items={object:itemId,placement,...(recipe?{recipe}:{}),pose,scale:q.items?.scale===undefined?1:num(q.items.scale,'Escala proporcional do objeto',.25,2.5),offset:q.items?.offset===undefined?[0,0,0]:vector(q.items.offset,'Ajuste de objeto',.5),rotation:q.items?.rotation===undefined?[0,0,0]:vector(q.items.rotation,'Rotação de objeto',180),armMotion,arms:{left:arm('left'),right:arm('right')},hands:handStates,grip:{left:grip('left'),right:grip('right')}};
 if(q.items?.twoHandSpread!==undefined)s.items.twoHandSpread=num(q.items.twoHandSpread,'Abertura de duas mãos',0,1);
 s.wear=num(q.wear,'Desgaste',0,1);s.profession=opt(q.profession,'profession');
 if(!Array.isArray(q.traits)||q.traits.length>TRAITS.length||q.traits.some((id:any)=>!TRAITS.some(t=>t.id===id)))throw new Error('Lista de traços inválida.');
 s.traits=[...new Set(q.traits)] as string[];
 if(s.traits.includes('fit')&&s.traits.includes('unfit')||s.traits.includes('strong')&&s.traits.includes('weak'))throw new Error('Há traços opostos selecionados.');
 if(characterStats(s).remaining<0)throw new Error('A seleção de traços excede os pontos disponíveis.');
 return s;
}
export function characterStats(s:CharacterSpec){
 const stats:Record<string,number>={vigor:3,strength:3,stealth:3,craft:3};
 const boosts:Record<string,string>={zumbi:'vigor',pintor:'craft',nightshift:'stealth',ranger:'stealth',mechanic:'craft',medic:'vigor',civilian:'strength',legendario:'vigor',explorer:'stealth',pedepano:'stealth',engineer:'craft'};
 stats[s.profession==='lenhador'?'strength':boosts[s.profession]]+=1;
 for(const id of s.traits){const t=TRAITS.find(t=>t.id===id);if(t)stats[t.stat]+=t.amount;}
 return {values:stats,remaining:6-s.traits.reduce((n,id)=>n+(TRAITS.find(t=>t.id===id)?.cost||0),0)};
}
