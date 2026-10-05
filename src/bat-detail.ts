import * as THREE from 'three';
import {detailBuilder,type DetailContext} from './creature-detail-utils';
import type {CreatureSpec,CreatureMotion} from './creature-schema';
import {createBatAttackClock} from './bat-attack';
import {seededRandom} from './schema';

// Bat rebuilt from a reference: small furry body with the head sunk into it, small pointed ears, and wings
// built on the real bone layout. The arm rises from the shoulder to a high wrist (the "M" silhouette);
// four fingers fan out from the wrist, and the membrane edge scallops inward between the finger tips.
// Wing coordinates are 2D [outward, up] in wing space; the wing span scales the outward axis.
const SHOULDER:[number,number]=[0,.01],ELBOW:[number,number]=[.17,.1],WRIST:[number,number]=[.34,.27];
const TIPS:[number,number][]=[[.98,.1],[.86,-.2],[.62,-.36],[.36,-.38]];
const ANKLE:[number,number]=[.035,-.2];

// Closed wing outline, sampled densely: leading edge along the arm, scallops between tips, back to the body.
function wingOutline(){
  const pts:[number,number][]=[],lerp=(a:[number,number],b:[number,number],t:number):[number,number]=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
  const edge=(a:[number,number],b:[number,number],n:number,sag:number)=>{
    // Scallop: the midpoint of each trailing span is pulled toward the wrist.
    for(let i=0;i<n;i++){const t=i/n,p=lerp(a,b,t),w=Math.sin(t*Math.PI)*sag;pts.push([p[0]+(WRIST[0]-p[0])*w,p[1]+(WRIST[1]-p[1])*w]);}
  };
  edge(SHOULDER,ELBOW,6,-.06);edge(ELBOW,WRIST,6,-.05);edge(WRIST,TIPS[0],10,-.03);
  edge(TIPS[0],TIPS[1],10,.28);edge(TIPS[1],TIPS[2],10,.3);edge(TIPS[2],TIPS[3],10,.32);edge(TIPS[3],ANKLE,10,.2);
  edge(ANKLE,SHOULDER,6,0);
  return pts;
}

export function buildDetailedBat(s:CreatureSpec,c:DetailContext){
  const {mat,group,mesh,ell,tube,socket,batch}=detailBuilder(c),body=c.body,bulk=.85+s.body.bulk*.3,phase=seededRandom(s.seed+':bat')()*6;
  const fur=mat(s.appearance.primary,.92),membrane=mat(s.appearance.secondary,.6),dark=mat('#141215',.45),eye=mat(s.appearance.eyes,.18),ivory=mat('#d9cfb6',.35),earPink=mat(new THREE.Color(s.appearance.secondary).lerp(new THREE.Color('#8a6a70'),.5).getStyle(),.7);
  // Small furry body; the head sits low, sunk into the shoulders, with no visible neck.
  ell('thorax',body,[0,0,0],[.078*bulk,.12,.07],fur,24);ell('abdomen',body,[0,-.1,-.004],[.058*bulk,.075,.056],fur,20);
  const head=group('head',body,[0,.112,.016]);ell('skull',head,[0,0,0],[.062,.056,.056],fur,24);
  ell('muzzle',head,[0,-.018,.05],[.03,.022,.026],fur,18);ell('nose-pad',head,[0,-.012,.074],[.013,.009,.008],dark,12);
  const jaw=group('jaw',head,[0,-.034,.04]);ell('jaw-shape',jaw,[0,-.004,.012],[.024,.011,.022],fur,16);ell('mouth',jaw,[0,.004,.018],[.02,.003,.016],dark,12);
  const wings:THREE.Group[]=[],flex:Array<{mesh:THREE.Mesh;base:Float32Array;weights:number[]}>=[],outline=wingOutline();
  for(const side of [-1,1]){
    const id=side>0?'L':'R',ears=s.anatomy.ears;
    // Small pointed ears: a tapered triangular blade, leaning outward, with a paler inner face.
    const ear=group('ear'+id,head,[side*.034,.038,-.004]);ear.rotation.z=-side*.32;
    tube('ear-rim',ear,[[0,0,0],[0,.035*ears,.004],[side*.004,.07*ears,0]],.022,.001,fur,12,8);
    tube('ear-bowl',ear,[[0,.004,.01],[0,.034*ears,.013],[side*.003,.06*ears,.006]],.013,.001,earPink,10,6);
    const e=group('eye'+id,head,[side*.028,.008,.046]);e.rotation.y=side*.35;
    ell('eye-socket',e,[0,0,0],[.012,.012,.007],dark,14);ell('iris',e,[0,0,.005],[.0085,.009,.005],eye,14);ell('pupil',e,[0,0,.009],[.005,.006,.002],dark,10);ell('eye-glint',e,[-.003,.003,.011],[.002,.002,.001],ivory,6);
    const lid=group('lid'+id,e,[0,.01,.009]);ell('eyelid',lid,[0,0,0],[.013,.011,.004],fur,14);
    tube('fang',jaw,[[side*.009,.008,.027],[side*.009,.001,.029],[side*.008,-.003,.028]],.0022,.0003,ivory,8,6);
    // Wing: the membrane is a fan of rings around an interior point that sees the whole outline,
    // so it has interior vertices to billow between the bones.
    const wing=group('wing'+id,body,[side*.06,.045,-.004]);wings.push(wing);
    const span=s.anatomy.wingspan,centre:[number,number]=[.33,.02],rings=9,vertices:number[]=[],weights:number[]=[],colors:number[]=[],indices:number[]=[],N=outline.length;
    const boneDist=(x:number,y:number)=>{ // distance to the nearest bone, used to shade and to stiffen the membrane there
      const seg=(a:[number,number],b:[number,number])=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=THREE.MathUtils.clamp(((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy),0,1);return Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t);};
      return Math.min(seg(SHOULDER,ELBOW),seg(ELBOW,WRIST),...TIPS.map(tp=>seg(WRIST,tp)));
    };
    for(let r=0;r<=rings;r++)for(let i=0;i<N;i++){
      const k=r/rings,[ox,oy]=outline[i],x=centre[0]+(ox-centre[0])*k,y=centre[1]+(oy-centre[1])*k,d=boneDist(x,y),free=THREE.MathUtils.smoothstep(d,0,.08)*(1-k*k*.35);
      vertices.push(side*x*span,y,-free*.02);weights.push(free);
      const shade=.7+.22*THREE.MathUtils.smoothstep(d,0,.12)-.1*k;colors.push(shade,shade,shade*1.02);
    }
    for(let r=0;r<rings;r++)for(let i=0;i<N;i++){const a=r*N+i,b=r*N+(i+1)%N,a2=a+N,b2=b+N;if(r===0)indices.push(a,a2,b2);else indices.push(a,a2,b,b,a2,b2);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();
    const web=mesh('curved-wing-membrane',g,membrane,wing);web.userData.dynamic=true;flex.push({mesh:web,base:Float32Array.from(vertices),weights});
    const P=(p:[number,number],z=0):number[]=>[side*p[0]*span,p[1],z];
    tube('upper-arm',wing,[P(SHOULDER),P([(SHOULDER[0]+ELBOW[0])/2,(SHOULDER[1]+ELBOW[1])/2+.012]),P(ELBOW)],.017,.011,fur,14,10);
    tube('forearm',wing,[P(ELBOW),P([(ELBOW[0]+WRIST[0])/2,(ELBOW[1]+WRIST[1])/2+.008]),P(WRIST)],.011,.008,fur,14,8);
    ell('wrist-joint',wing,P(WRIST),[.012,.012,.011],fur,12);ell('elbow-joint',wing,P(ELBOW),[.013,.013,.012],fur,12);
    for(const tip of TIPS){ // fingers bow slightly toward the trailing edge, with a knuckle a third of the way
      const mid:[number,number]=[WRIST[0]+(tip[0]-WRIST[0])*.4,WRIST[1]+(tip[1]-WRIST[1])*.4-.012];
      tube('wing-finger',wing,[P(WRIST),P(mid,.002),P(tip)],.0065,.0018,dark,16,6);ell('knuckle',wing,P(mid,.002),[.0075,.0075,.007],dark,8);
    }
    tube('thumb-claw',wing,[P(WRIST),P([WRIST[0]+.012,WRIST[1]+.035],.008),P([WRIST[0]-.004,WRIST[1]+.05],.012)],.007,.0008,ivory,10,6);
    // Legs hang under the belly; the membrane's inner corner reaches the ankle.
    const leg=group('foot'+id,body,[side*.03,-.15,0]);
    tube('shin',leg,[[0,0,0],[side*.004,-.028,-.004],[side*.006,-.05,.004]],.009,.006,fur,10,8);
    for(let toe=0;toe<3;toe++){const x=side*.006+(toe-1)*.006;tube('toe-claw',leg,[[x,-.048,.004],[x,-.062,.01],[x,-.064,.02]],.0035,.0005,ivory,8,6);}
  }
  // Tail membrane between the legs.
  const tailGeo=new THREE.BufferGeometry();tailGeo.setAttribute('position',new THREE.Float32BufferAttribute([-.045,-.16,-.01,.045,-.16,-.01,0,-.25,-.03],3));tailGeo.setIndex([0,2,1]);tailGeo.computeVertexNormals();mesh('tail-membrane',tailGeo,membrane,body);
  tube('tail-bone',body,[[0,-.15,-.01],[0,-.2,-.02],[0,-.25,-.03]],.006,.002,fur,10,6);
  socket('head',head);socket('mouth',jaw,[0,-.004,.03]);socket('back',body,[0,0,-.07]);socket('target',body);
  batch(body);
  const attackClock=createBatAttackClock();
  return (t:number,m:CreatureMotion)=>{
    const attack=attackClock(t,m),rate=m==='move'?12:8,normalFlap=Math.sin(t*rate),flap=attack?Math.sin(attack.time*26)*(attack.active):normalFlap,up=Math.max(0,flap);
    body.position.z=attack?.advance??0;body.position.y=1.4+(attack?attack.dip:Math.sin(t*3)*.05-flap*.025);body.rotation.x=attack?attack.rush*.35:m==='move'?.25:0;
    // Down-stroke opens the wings flat; up-stroke raises them and folds the tips back slightly.
    wings.forEach((w,i)=>{const sd=i?1:-1;w.rotation.z=sd*(flap*.62+.12);w.rotation.y=sd*(.12+up*.22+(attack?.rush??0)*.32);});
    flex.forEach(f=>{const p=f.mesh.geometry.attributes.position;for(let i=0;i<p.count;i++)p.setZ(i,f.base[i*3+2]*(1+flap*.6)+f.weights[i]*Math.sin((attack?attack.time*26:t*rate)+1.2)*.008*(attack?.active??1));p.needsUpdate=true;f.mesh.geometry.computeVertexNormals();});
    jaw.rotation.x=.03+(attack?.rush??0)*.48;
    for(const id of ['L','R']){const cycle=(t+phase)%5,blink=t===0?0:Math.max(0,1-Math.abs(cycle-4.6)/.12);c.nodes['lid'+id].scale.y=.08+blink;c.nodes['lid'+id].position.y=.01*(1-blink);c.nodes['ear'+id].rotation.x=Math.sin(t*1.8+phase+(id==='L'?0:1))*.08;}
  };
}
