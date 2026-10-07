// Original ABRIGO biped species, using the unmodified Fauna SDF pipeline.
// Dimensions/motion scaffold: src/werewolf.ts; silhouette study: Tuts+ Werewolf Warrior
// (Monika Zagrobelna), and Smithsonian gray wolf. No third-party artwork incorporated.
import * as THREE from 'three';
import {buildRig} from '../vendor/threejs-procedural-animals/src/core/rig/rig.js';
import {sculptEyeSocket} from '../vendor/threejs-procedural-animals/src/core/sdf/eyeSocket.js';
import {SDFModel} from '../vendor/threejs-procedural-animals/src/core/sdf/sdf.js';
import {EYE_LOOK} from '../vendor/threejs-procedural-animals/src/species/wolf/index.js';
import type {CreatureSpec} from './creature-schema';

export function werewolfSdfSpecies(spec:CreatureSpec){
 const L=spec.anatomy.legs,W=spec.anatomy.spread*(.9+spec.body.bulk*.2),H=1.02*L+.12;
 const eye={c:[.135,.085,.198],r:.034,back:.007,yaw:.32,pitch:.02,lid:.006,R:.040,d:.023,off:0,tilt:-.22,irisZ:.023,irisR:.029};
 const J:any={pelvis:[0,H,0],chest:[0,H+.64,0],neck:[0,H+.91,.025],head:[0,H+1.09,.06],nose:[0,H+1.05,.53],jawHinge:[0,H+.94,.20],jawTip:[0,H+.89,.47],tailBase:[0,H+.03,-.19],tailTip:[0,H-.29,-.66*spec.anatomy.tail]};
 for(const s of [1,-1]){const S=s===1?'L':'R';
  J['shoulder'+S]=[s*.43*W,H+.72,0];J['elbow'+S]=[s*(.43*W+.12),H+.32,.02];J['wrist'+S]=[s*(.43*W+.19),H-.07,.065];J['handTip'+S]=[s*(.43*W+.19),H-.34,.025];
  J['hip'+S]=[s*.20*W,H,0];J['knee'+S]=[s*.20*W,H-.48*L,0];J['ankle'+S]=[s*.20*W,.12,0];J['toe'+S]=[s*.20*W,.08,.30];
  J['earBase'+S]=[s*.155,H+1.29,.015];J['earTip'+S]=[s*.21,H+1.29+.36*spec.anatomy.ears,0];
 }
 const bones:any[]=[['pelvis','pelvis','chest',null],['spine','chest','neck','pelvis'],['neck','neck','head','spine'],['head','head','nose','neck'],['jaw','jawHinge','jawTip','head',{group:'jaw'}],['tail0','tailBase','tailTip','pelvis']];
 const limbs:any={};
 for(const S of ['L','R']){const side=S==='L'?1:-1;
  for(const [name,a,b,parent,group] of [['upperArm','shoulder','elbow','spine','A'],['lowerArm','elbow','wrist','upperArm'+S,'A'],['hand','wrist','handTip','lowerArm'+S,'A'],['upperLeg','hip','knee','pelvis','P'],['lowerLeg','knee','ankle','upperLeg'+S,'P'],['foot','ankle','toe','lowerLeg'+S,'P']])bones.push([name+S,a+S,b+S,parent,{group:group+S,side}]);
  bones.push(['ear'+S,'earBase'+S,'earTip'+S,'head',{group:'ear'+S}]);
  for(const [g,top,a,b,chain] of [['A','upperArm','shoulder','elbow',['upperArm','lowerArm','hand']],['P','upperLeg','hip','knee',['upperLeg','lowerLeg','foot']]])limbs[g+S]={side,bones:chain.map((n:string)=>n+S),proximal:[top+S],distal:[chain[2]+S],field:{a:a+S,b:b+S,top:top+S,tCore:.5,aCore:.025,aBody:-.05,midX:.004}};
 }
 return {id:'abrigo-werewolf',name:'ABRIGO Werewolf',plan:'abrigo-biped',covering:'fur',
  variation(R:any){return {size:1,coatSeed:R()*1000,coatTone:(R()-.5)*.10,warps:[]};},
  rig(){return buildRig({joints:J,bones,limbs,unit:2.3,axial:{points:['nose','head','neck','chest','pelvis','tailBase','tailTip'],bones:['head','neck','spine','pelvis','pelvis','tail0'],bodyTail:0},appendages:['L','R'].map(S=>({group:'ear'+S,bone:'ear'+S})),headOrigin:J.head});},
  sculpt(m:any){
   const e=(c:number[],r:number[],bone:string,tag='fur',group='axial',k=.045,part='body')=>m.ell({c,r,bone,tag,group,k,part});
   const cone=(a:number[],b:number[],ra:number,rb:number,bone:string,tag='fur',group='axial',k=.035,part='body')=>m.cone({a,b,ra,rb,bone,tag,group,k,part});
   e([0,H+.05,0],[.285*W,.22,.22],'pelvis','cloth');
   e([0,H+.31,0],[.255*W,.36,.205],'pelvis');
   e([0,H+.63,-.01],[.39*W,.31,.24],'spine');
   // Smooth pectoral and scapular fullness, fused into the trunk rather than balls.
   for(const s of [1,-1]){e([s*.18*W,H+.64,.12],[.225*W,.235,.17],'spine');e([s*.22*W,H+.73,-.08],[.24*W,.22,.20],'spine');}
   cone(J.neck,J.head,.18,.17,'neck','ruff','axial',.07);
   e([0,H+1.12,.05],[.225,.265,.22],'head');
   e([0,H+1.065,.275],[.145,.115,.245],'head','muzzle');
   // Narrow cheek transition joins the skull, no detached cheek spheres.
   for(const s of [1,-1])e([s*.15,H+1.05,.095],[.105,.14,.115],'head','ruff','axial',.08);
   e([0,H+1.095,.505],[.091,.055,.045],'head','nose','axial',.012);
   for(const s of [1,-1])m.ell({c:[s*.041,H+1.104,.54],r:[.013,.012,.015],bone:'head',tag:'nostril',k:.004,carve:true});
   e([0,H+.94,.338],[.139,.052,.165],'jaw','muzzle','jaw',.02,'jaw');
   e([0,H+.984,.36],[.14,.017,.145],'head','mouth','axial',.006,'mouth');
   for(const s of [1,-1]){const S=s===1?'L':'R',A='A'+S,P='P'+S;
    e(J['shoulder'+S],[.19,.205,.18],'upperArm'+S,'fur',A,.075);
    cone(J['shoulder'+S],J['elbow'+S],.15,.105,'upperArm'+S,'fur',A,.06);
    const mid=(a:number[],b:number[],t:number)=>a.map((v,i)=>v+(b[i]-v)*t);
    e(mid(J['shoulder'+S],J['elbow'+S],.46),[.145,.205,.14],'upperArm'+S,'fur',A,.065);
    cone(J['elbow'+S],J['wrist'+S],.122,.073,'lowerArm'+S,'fur',A,.05);
    e(mid(J['elbow'+S],J['wrist'+S],.35),[.129,.175,.116],'lowerArm'+S,'ruff',A,.055);
    const h=J['wrist'+S],at=(x:number,y:number,z:number)=>[h[0]+x,h[1]+y,h[2]+z];
    e(at(0,-.085,.012),[.112,.127,.073],'hand'+S,'pale',A,.03);
    for(let i=0;i<4;i++){const x=(i-1.5)*.053,y=-.145-Math.abs(i-1.5)*.009;
     cone(at(x,y,.01),at(x,y-.085,-.025),.027,.021,'hand'+S,'pale',A,.009);
     cone(at(x,y-.085,-.025),at(x,y-.128,-.055),.021,.015,'hand'+S,'pale',A,.007);
     cone(at(x,y-.128,-.055),at(x,y-.205,-.10),.022,.002,'hand'+S,'claw',A,.002,'claws'+S);
    }
    cone(at(-s*.08,-.04,0),at(-s*.16,-.095,-.025),.037,.024,'hand'+S,'pale',A,.016);
    cone(at(-s*.16,-.095,-.025),at(-s*.18,-.17,-.065),.025,.002,'hand'+S,'claw',A,.002,'claws'+S);
    cone(J['hip'+S],J['knee'+S],.17*W,.107,'upperLeg'+S,'fur',P,.065);
    e(mid(J['hip'+S],J['knee'+S],.36),[.18*W,.27*L,.185],'upperLeg'+S,'cloth',P,.07);
    // Digitigrade calf and rear hock flow into the paw, with no separate muscle bulbs.
    const k=J['knee'+S],a=J['ankle'+S],hock=[a[0],a[1]+.16*L,-.12];
    cone(k,hock,.105,.066,'lowerLeg'+S,'fur',P,.045);e(mid(k,hock,.32),[.105,.19*L,.107],'lowerLeg'+S,'fur',P,.055);
    cone(hock,a,.066,.080,'lowerLeg'+S,'pale',P,.025);
    e([a[0],.083,.09],[.14,.083,.17],'foot'+S,'pale',P,.025);
    for(let i=0;i<3;i++){const x=a[0]+(i-1)*.085;e([x,.067,.213],[.051,.066,.085],'foot'+S,'pale',P,.013);cone([x,.061,.265],[x,.025,.352],.029,.002,'foot'+S,'claw',P,.002,'footclaws'+S);}
    const eb=J['earBase'+S],et=J['earTip'+S];
    cone(eb,et,.086,.007,'ear'+S,'ear','ear'+S,.027);
    e([eb[0]+s*.025,eb[1]+.115*spec.anatomy.ears,.049],[.048,.135*spec.anatomy.ears,.013],'ear'+S,'inner','ear'+S,.009);
    sculptEyeSocket(m,eye,J.head,s,{orbit:{at:[0,0,-.02],r:[.044,.042,.028],k:.02}});
    cone([s*.09,H+1.197,.265],[s*.185,H+1.236,.205],.024,.036,'head','brow','axial',.025);
    for(let i=0;i<3;i++)cone([s*(.035+i*.031),H+1.005,.46],[s*(.035+i*.031),H+.967-(i===2?.053:0),.46],i===2?.018:.010,.002,'head','tooth','axial',.001,'teeth');
   }
   cone(J.tailBase,J.tailTip,.085,.018,'tail0','ruff','axial',.045);
   e([0,H-.09,-.37*spec.anatomy.tail],[.095,.15,.19*spec.anatomy.tail],'tail0','ruff');
  },
  regions(_rig:any,_p:any,Q:any){const reg=(name:string,part:string,h:number,rigidBone?:string)=>({name,part,h:h*Q.res,F:4,bmin:[-1.15,-.04,-1.2],bmax:[1.15,H+1.92,.72],...(rigidBone?{rigidBone}: {})});
   return {jobs:[[reg('body','body',.012)],...[reg('jaw','jaw',.006,'jaw'),reg('mouth','mouth',.008,'head'),reg('teeth','teeth',.004,'head'),...['L','R'].flatMap(S=>[reg('claws'+S,'claws'+S,.004,'hand'+S),reg('footclaws'+S,'footclaws'+S,.005,'foot'+S)])].map(r=>[r])]};
  },
  coat({nV,pos,nrm,lists,params}:any){
   const tint=new Float32Array(nV*4),comb=new Float32Array(nV*3),furLen=new Float32Array(nV),pattern=new Float32Array(nV).fill(1),mark=new Float32Array(nV).fill(1),surf=new Float32Array(nV*4);
   const primary=new THREE.Color(spec.appearance.primary),secondary=new THREE.Color(spec.appearance.secondary);
   for(let v=0;v<nV;v++){
    const x=pos[v*3],y=pos[v*3+1],z=pos[v*3+2];let nearest:any=null,best=Infinity;
    for(const pr of lists[v])if(!pr.carve){const d=SDFModel.dist(pr,x,y,z);if(d<best){best=d;nearest=pr;}}
    const tag=nearest?.tag||'fur';let material=0,color=primary.clone(),hair=.019;
    const front=THREE.MathUtils.smoothstep(z,.08,.22),chest=THREE.MathUtils.smoothstep(y,H+.12,H+.47)*(1-THREE.MathUtils.smoothstep(y,H+.82,H+.98));
    color.lerp(secondary,front*chest*.8);
    if(['pale','muzzle'].includes(tag)){color=secondary.clone();hair=.012;}
    if(tag==='ruff')hair=.045;
    if(tag==='ear')hair=.011;
    if(tag==='cloth'||(y<H+.16&&y>H-.36*L&&Math.abs(x)<.41*W&&Math.abs(z)<.25&&nearest?.group?.startsWith('P'))){color=new THREE.Color('#29394d');material=4;hair=0;}
    if(material===4){const hem=H-.31*L+.06*Math.sin(x*32+z*23);if(y<hem){color=primary.clone();material=0;hair=.018;}}
    if(tag==='nose'){color=new THREE.Color('#141a17');material=1;hair=0;}
    if(tag==='inner'){color=new THREE.Color('#a37e72');material=4;hair=0;}
    if(tag==='claw'){color=new THREE.Color('#111713');material=5;hair=0;}
    if(tag==='tooth'){color=new THREE.Color('#eee1bd');material=5;hair=0;}
    if(tag==='mouth'){color=new THREE.Color('#221316');material=3;hair=0;}
    if(tag==='eyelid'||tag==='brow'){color=primary.clone().multiplyScalar(.50);hair=tag==='brow'?.009:.003;}
    const noise=Math.sin(x*23+y*13+z*17+params.coatSeed)*.025+Math.sin(x*9-y*6+params.coatSeed)*.045;
    color.multiplyScalar(1+noise*spec.appearance.markings+params.coatTone);tint.set([...color.toArray(),material],v*4);
    furLen[v]=hair;const dir=new THREE.Vector3(nrm[v*3]*.22,-1,nrm[v*3+2]*.12).normalize();comb.set(dir.toArray(),v*3);surf.set([0,.005,.4,.35],v*4);
   }
   return {tint,comb,furLen,pattern,mark,surf};
  },
  eyeSpecs(){return [1,-1].map(side=>({side,spec:eye,headOrigin:J.head,bone:'head',look:EYE_LOOK}));},
  render:{strandDensity:850,clumpDensity:.55,markColor:[.014,.012,.009],noseRoughness:.65},
 };
}
