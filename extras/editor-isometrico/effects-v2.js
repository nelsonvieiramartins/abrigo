import * as T from 'three';
import {BatchedRenderer,ParticleSystem,QuarksLoader,ConstantValue,IntervalValue,ConstantColor,Vector4,Vector3,Gradient,ColorOverLife,SizeOverLife,PiecewiseBezier,Bezier,ConeEmitter,Noise,RenderMode} from 'three.quarks';
// As tags agrupam a biblioteca por intenção de cena; um efeito pode servir a mais de
// uma, como a tocha, que é fogo e também fonte de luz.
export const EFFECT_TAGS=[['fogo','Fogo'],['ambiente','Ambiente'],['magia','Magia'],['luz','Iluminação']];
export const EFFECT_LIBRARY=[
 {id:'fire',name:'Fogueira',icon:'🔥',description:'Chamas turbulentas, fumaça e brasas',tags:['fogo','luz'],preview:{kind:'plume',colors:['#ffe9a8','#ff8a1f','#c52d05']}},
 {id:'smoke',name:'Fumaça',icon:'☁',description:'Coluna com expansão e dissipação',tags:['ambiente'],preview:{kind:'plume',colors:['#9aa3a6','#5e6668','#2f3638']}},
 {id:'fog',name:'Névoa rasteira',icon:'〰',description:'Camadas de vapor em movimento',tags:['ambiente'],preview:{kind:'layer',colors:['#c3d2d6','#8fa6ab','#63797e']}},
 {id:'sparks',name:'Brasas',icon:'✦',description:'Centelhas ascendentes e dispersão',tags:['fogo'],preview:{kind:'spark',colors:['#fff0b0','#ffb32e','#ff5a10']}},
 {id:'torchlight',name:'Tocha',icon:'◉',description:'Chama compacta e luz oscilante',tags:['luz','fogo'],preview:{kind:'glow',colors:['#fff1c4','#ffa235','#6b2f04']}},
 {id:'magic',name:'Energia arcana',icon:'✧',description:'Emissão luminosa azul e violeta',tags:['magia','luz'],preview:{kind:'spark',colors:['#bff0ff','#5a9bff','#a24bff']}}
];
const value=n=>new ConstantValue(n),range=(a,b)=>new IntervalValue(a,b);
const curve=(a,b,c,d)=>new PiecewiseBezier([[new Bezier(a,b,c,d),0]]);
const hash=(x,y)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);};
function noise(x,y){const i=Math.floor(x),j=Math.floor(y);let u=x-i,v=y-j;u=u*u*(3-2*u);v=v*v*(3-2*v);return T.MathUtils.lerp(T.MathUtils.lerp(hash(i,j),hash(i+1,j),u),T.MathUtils.lerp(hash(i,j+1),hash(i+1,j+1),u),v);}
// Texturas de densidade autorais, geradas uma vez e compartilhadas pelos emissores.
function texture(spark){const size=128,data=new Uint8Array(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const r=Math.hypot(x/size*2-1,y/size*2-1);let n=0,amp=.55;for(let k=0;k<5;k++){n+=noise(x/size*(4<<k)+11,y/size*(4<<k)+23)*amp;amp*=.5;}const edge=Math.max(0,1-r*r),alpha=spark?Math.pow(edge,5):Math.pow(edge,1.5)*Math.max(0,n-.22)*2,i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=255;data[i+3]=Math.min(255,alpha*255);}const t=new T.DataTexture(data,size,size);t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;}
// Prévia 2D desenhada no próprio navegador: nenhuma imagem é baixada e o desenho é
// sempre o mesmo, porque as posições saem do hash determinístico das texturas.
export function previewCanvas(def,size=54){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=size;canvas.setAttribute('aria-hidden','true');
 const ctx=canvas.getContext('2d'),{kind,colors:[bright,mid,deep]}=def.preview;
 ctx.fillStyle='#0c1512';ctx.fillRect(0,0,size,size);
 const blob=(x,y,r,color,alpha)=>{const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');ctx.globalAlpha=alpha;ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,6.2832);ctx.fill();ctx.globalAlpha=1;};
 if(kind==='plume')for(let i=0;i<16;i++){const t=i/15;blob(size*.5+(hash(i,7)-.5)*size*.4*(.25+t),size*(.92-t*.76),size*(.09+t*.16),i<5?bright:i<11?mid:deep,.62-t*.34);}
 if(kind==='layer'){for(let i=0;i<5;i++){ctx.globalAlpha=.4-i*.06;ctx.fillStyle=[bright,mid,deep][i%3];ctx.beginPath();ctx.ellipse(size*.5,size*(.48+i*.105),size*(.45-i*.055),size*.075,0,0,6.2832);ctx.fill();}ctx.globalAlpha=1;}
 if(kind==='spark'){blob(size*.5,size*.56,size*.42,mid,.3);for(let i=0;i<22;i++){const a=hash(i,13)*6.2832,d=size*.08+hash(i,29)*size*.34;blob(size*.5+Math.cos(a)*d,size*.56+Math.sin(a)*d*.9,size*(.03+hash(i,41)*.045),i%3?bright:deep,.95);}}
 if(kind==='glow'){blob(size*.5,size*.5,size*.48,deep,.55);blob(size*.5,size*.5,size*.3,mid,.8);for(let i=0;i<5;i++)blob(size*.5+(hash(i,19)-.5)*size*.1,size*(.62-i*.07),size*(.11-i*.012),bright,.85);}
 return canvas;
}
export function validatePreset(json){
 if(!json?.object||JSON.stringify(json).length>8*1024*1024)throw Error('Use um preset Quarks Object3D JSON de até 8 MB.');
 let emitters=0,nodes=0;const walk=o=>{if(++nodes>300)throw Error('Preset excede 300 nós.');if(o.type==='ParticleEmitter'){emitters++;if(!o.ps||!json.materials?.some(m=>m.uuid===o.ps.material))throw Error('Emissor ou material ausente no preset. Exporte a cena completa.');if(JSON.stringify(o.ps).includes('EmitSubParticleSystem'))throw Error('Subemissores ainda não são suportados.');}for(const c of o.children||[])walk(c);};walk(json.object);
 if(!emitters||emitters>16)throw Error('O preset deve conter de 1 a 16 emissores.');
 for(const image of json.images||[])if(typeof image.url==='string'&&!image.url.startsWith('data:image/'))throw Error('Incorpore as texturas no JSON (data:image). Caminhos externos não são suportados.');return json;
}
export function createEffects(scene){
 const instances=[],batch=new BatchedRenderer();scene.add(batch);const cloud=texture(false),spark=texture(true);let previous=null;
 function add(type='fire',position=[0,0,0],options={}){
  if(type!=='quarks'&&!EFFECT_LIBRARY.some(d=>d.id===type))throw Error('Tipo de efeito desconhecido.');
  const root=new T.Group();root.name=type==='quarks'?(options.name||'Preset Quarks'):EFFECT_LIBRARY.find(d=>d.id===type).name;root.position.fromArray(position);root.userData={effect:type,options:{scale:1,intensity:1,emission:1,life:1,turbulence:1,height:0,...options},systems:[],phase:Math.random()*6.28};root.scale.setScalar(T.MathUtils.clamp(Number(options.scale)||1,.1,10));const pick=new T.Mesh(new T.SphereGeometry(.62,12,8),new T.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));pick.name='Área de seleção do efeito';pick.userData.effectRoot=root;root.add(pick);scene.add(root);
  function layer({rate=35,life=[1,2],speed=[.6,1.4],size=[.3,.6],radius=.2,angle=.18,colors=[[1,.7,.12],[1,.08,.005]],alpha=.7,additive=true,grow=false,turbulence=.12,height=.1,isSpark=false}={}){
   const material=new T.MeshBasicMaterial({map:isSpark?spark:cloud,transparent:true,depthWrite:false,blending:additive?T.AdditiveBlending:T.NormalBlending,side:T.DoubleSide});
   const system=new ParticleSystem({duration:5,looping:true,prewarm:true,worldSpace:false,shape:new ConeEmitter({radius,angle}),startLife:range(...life),startSpeed:range(...speed),startSize:range(...size),startRotation:range(0,Math.PI*2),startColor:new ConstantColor(new Vector4(1,1,1,1)),emissionOverTime:value(rate),material,renderMode:RenderMode.BillBoard,behaviors:[new ColorOverLife(new Gradient(colors.map((c,i)=>[new Vector3(...c),i/(colors.length-1)]),[[0,0],[alpha,.12],[alpha*.65,.55],[0,1]])),new SizeOverLife(grow?curve(.45,1.1,1.7,2.5):curve(.6,1.2,.7,.05)),new Noise(value(.6),value(turbulence))]});
   system._abrigoBase={rate,life,turbulence};system.emitter.rotation.x=-Math.PI/2;system.emitter.position.y=height;root.add(system.emitter);batch.addSystem(system);root.userData.systems.push(system);
  }
  const smoke=()=>layer({rate:14,life:[2.5,4],speed:[.65,1],size:[.5,.85],colors:[[.22,.23,.24],[.48,.5,.52]],alpha:.27,additive:false,grow:true,turbulence:.25,height:.7});
  const embers=()=>layer({rate:14,life:[1.2,2.6],speed:[1,2],size:[.025,.055],radius:.24,angle:.35,colors:[[2,1,.12],[1,.08,0]],alpha:1,isSpark:true});
  if(type==='fire'||type==='torchlight'){layer({rate:65,life:[.65,1.35],size:[.28,.6],colors:[[2,1.4,.35],[1,.18,.005],[.4,.025,0]]});smoke();embers();const light=new T.PointLight(0xff8833,9,7,2);light.position.y=.6;root.add(light);if(type==='torchlight')root.scale.multiplyScalar(.5);}
  if(type==='smoke')smoke();
  if(type==='fog')layer({rate:12,life:[5,8],speed:[.01,.04],size:[1.4,2.5],radius:2.3,angle:1.4,colors:[[.58,.66,.69],[.72,.78,.8]],alpha:.12,additive:false,grow:true,turbulence:.25,height:.25});
  if(type==='sparks')embers();
  if(type==='magic')layer({rate:55,life:[1.5,3],size:[.025,.16],radius:.65,angle:.5,colors:[[.2,1.3,2],[.55,.1,1]],alpha:.9,isSpark:true,turbulence:.6});
  if(type==='quarks'){try{validatePreset(options.preset);const imported=new QuarksLoader().parse(options.preset);root.add(imported);imported.traverse(o=>{if(o.type==='ParticleEmitter'){const s=o.system;s.emissionOverTime=value(40);s.startLife=range(1,4);s.emissionBursts=[];batch.addSystem(s);root.userData.systems.push(s);}if(o.isLight)o.intensity=Math.min(o.intensity,15);});}catch(e){scene.remove(root);throw e;}}
  scene.updateMatrixWorld(true);instances.push(root);return root;
 }
 function remove(root){const i=instances.indexOf(root);if(i<0)return;instances.splice(i,1);for(const s of root.userData.systems){s.dispose();s.material.dispose();}root.traverse(o=>{if(o.name==='Área de seleção do efeito'){o.geometry.dispose();o.material.dispose();}});scene.remove(root);}
 function update(time){const delta=previous===null?1/60:Math.min(.05,Math.max(0,(time-previous)/1000));previous=time;scene.updateMatrixWorld(true);batch.update(delta);for(const root of instances)for(const c of root.children)if(c.isPointLight)c.intensity=(8+Math.sin(time*.011+root.userData.phase)*1.3+Math.sin(time*.023)*.5)*(Number(root.userData.options.intensity)||1);}
 function serialize(){return instances.map(o=>({type:o.userData.effect,position:o.position.toArray(),options:{...o.userData.options}}));}
 function restore(list){instances.slice().forEach(remove);for(const e of list||[])add(e.type,e.position,e.options);}
 function configure(root,opts){Object.assign(root.userData.options,opts);root.scale.setScalar(root.userData.options.scale*(root.userData.effect==='torchlight'?.5:1));for(const system of root.userData.systems){const base=system._abrigoBase??{rate:40,life:[1,4],turbulence:1};system.emissionOverTime=value(base.rate*(root.userData.options.emission??1));system.startLife=range(...base.life.map(n=>n*(root.userData.options.life??1)));const n=system.behaviors.find(b=>b.type==='Noise');if(n)n.power=value(base.turbulence*(root.userData.options.turbulence??1));if(system.material)system.material.opacity=Math.min(1,root.userData.options.intensity??1);}}
 let disposed=false;
 function dispose(){if(disposed)return;disposed=true;instances.slice().forEach(remove);batch.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});batch.removeFromParent();cloud.dispose();spark.dispose();}
 return {add,remove,update,serialize,restore,configure,dispose,items:()=>instances.slice(),library:EFFECT_LIBRARY};
}
