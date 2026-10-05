import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { buildTaperedSweepGeometry } from './vendor/taperedSweep';
import {addLumberDetails} from './lumber-detail';
import {addZombieDetails} from './zombie-detail';
import anatomy from './generated/anatomy.json';
import { CharacterSpec, Motion, seededRandom, validateSpec } from './schema';
import {createObject} from './object';
import {objectInteraction,presetObject} from './object-schema';
import {refine} from './mesh-profile';
import {ATTACK_SPEED} from './attack-timing';

// 'low' is the original faceted mesh (cheap, for crowds); 'high' is the detailed sculpt; 'uhd' adds a much
// denser mesh, skin/fabric micro-relief and individual hair strands (the approach used for the forest leaves).
export type Detail='low'|'high'|'uhd';
export interface CharacterOptions{detail?:Detail}
// Facial expressions layer on top of the idle face animation (blinks, brow drift, gaze), never replace it.
export const EXPRESSIONS={neutral:'Neutra',happy:'Feliz',angry:'Brava',sad:'Triste',tired:'Cansada',surprised:'Surpresa'} as const;
export type Expression=keyof typeof EXPRESSIONS;
export interface CharacterModel {
 root:THREE.Group;
 nodes:Record<string,THREE.Object3D>;
 sockets:Record<string,THREE.Object3D>;
 stats:{triangles:number;meshes:number};
 detail:Detail;
 update:(timeSeconds:number,motion?:Motion)=>void;
 setExpression:(name:Expression,intensity?:number,immediate?:boolean)=>void;
 dispose:()=>void;
}
// Samples a refined ring list at height y: [halfWidth, halfDepth, zOffset].
function profileAt(rows:number[][]){
 return (y:number)=>{let i=0;while(i<rows.length-2&&rows[i+1][0]<y)i++;const a=rows[i],b=rows[i+1],t=THREE.MathUtils.clamp((y-a[0])/(b[0]-a[0]),0,1);return [1,2,3].map(k=>a[k]+(b[k]-a[k])*t);};
}
// Smooth normals welded across sweep seams, split where faces meet at more than `crease`.
function creaseNormals(src:THREE.BufferGeometry,crease=Math.PI*.3):THREE.BufferGeometry{
 const g=src.index?src.toNonIndexed():src,p=g.getAttribute('position').array as ArrayLike<number>,count=p.length/3;
 const fn:number[]=[],fu:number[]=[],degenerate:boolean[]=[];
 for(let f=0;f<count/3;f++){
   const o=f*9,ux=p[o+3]-p[o],uy=p[o+4]-p[o+1],uz=p[o+5]-p[o+2],vx=p[o+6]-p[o],vy=p[o+7]-p[o+1],vz=p[o+8]-p[o+2];
   const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,l=Math.hypot(nx,ny,nz)||1;
   fn.push(nx,ny,nz);fu.push(nx/l,ny/l,nz/l);degenerate.push(l<1e-14);
 }
 const groups=new Map<string,number[]>();
 for(let i=0;i<count;i++){const k=Math.round(p[i*3]*1e5)+','+Math.round(p[i*3+1]*1e5)+','+Math.round(p[i*3+2]*1e5);let a=groups.get(k);if(!a)groups.set(k,a=[]);a.push(i);}
 const limit=Math.cos(crease),normals=new Float32Array(count*3);
 for(const members of groups.values())for(const i of members){
   const f=Math.floor(i/3);let x=0,y=0,z=0;
   for(const j of members){const h=Math.floor(j/3);if(!degenerate[h]&&(degenerate[f]||fu[h*3]*fu[f*3]+fu[h*3+1]*fu[f*3+1]+fu[h*3+2]*fu[f*3+2]>=limit)){x+=fn[h*3];y+=fn[h*3+1];z+=fn[h*3+2];}}
   const l=Math.hypot(x,y,z);
   if(l>1e-12){normals[i*3]=x/l;normals[i*3+1]=y/l;normals[i*3+2]=z/l;}else{normals[i*3]=fu[f*3];normals[i*3+1]=fu[f*3+1];normals[i*3+2]=fu[f*3+2]||1;}
 }
 g.setAttribute('normal',new THREE.BufferAttribute(normals,3));return g;
}
// Actual geometry is generated at runtime. No model, texture or animation file is loaded.
// The upstream sweep uses its normal as rx and binormal as rz; on a vertical spine
// normal points along Z. The adapter below therefore swaps width and depth.
export function createCharacter(raw:CharacterSpec,options:CharacterOptions={}):CharacterModel{
 const spec=validateSpec(raw), root=new THREE.Group();root.name='Survivor';
 const detail:Detail=options.detail==='low'?'low':options.detail==='uhd'?'uhd':'high',UHD=detail==='uhd',HD=detail!=='low';
 const FACET=spec.style==='faceted';
 // Faceted is not the crowd LOD: it keeps flat planes, but uses enough rings and
 // sides for the face, clothing and silhouette to read at close range.
 const STEPS=FACET?2:UHD?5:HD?3:1,seg=(n:number)=>FACET?Math.round(n*1.25):UHD?Math.round(n*4):HD?Math.round(n*2.6):n;
 root.scale.setScalar(spec.body.height/(.92+.57+.257*spec.body.head));
 const rng=seededRandom(spec.seed+':surface'),seedPhase=rng()*100,nodes:Record<string,THREE.Object3D>={},sockets:Record<string,THREE.Object3D>={};
 const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
 const linkedItemDisposers:(()=>void)[]=[];
 const mat=(color:string,metalness=0,roughness=.93)=>{const m=new THREE.MeshStandardMaterial({color,roughness,metalness,flatShading:!HD||FACET,vertexColors:true});materials.add(m);return m;};
 const skin=mat(spec.appearance.skin,0,HD?.72:.93),hair=mat(spec.appearance.hairColor),cloth=mat(spec.outfit.topColor),pants=mat(spec.outfit.pantsColor),shoe=mat(spec.outfit.shoeColor);
 const dark=mat('#242725'),stitch=mat('#aca38a'),pack=mat('#69634d'),metal=mat('#a4a69a',.45,HD?.55:.93),eye=mat(spec.appearance.eyeColor,0,.35),white=mat('#d4cbbc',0,HD?.4:.93);
 const textures=new Set<THREE.Texture>();
 // UHD micro-relief: tileable noise used as a bump map, like the bark relief of the forest trees.
 const reliefTexture=(size:number,fn:(x:number,y:number)=>number,repeat:number)=>{
   const data=new Uint8Array(size*size*4);
   for(let y=0;y<size;y++)for(let x=0;x<size;x++){const v=Math.round(THREE.MathUtils.clamp(fn(x/size,y/size),0,1)*255),i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=v;data[i+3]=255;}
   const t=new THREE.DataTexture(data,size,size);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeat,repeat);t.needsUpdate=true;textures.add(t);return t;
 };
 if(UHD&&!FACET){
   const hr=(x:number,y:number,k:number)=>{const h=Math.sin(x*127.1+y*311.7+k*74.7)*43758.5453;return h-Math.floor(h);};
   const cell=(u:number,v:number,n:number)=>{ // cellular noise: soft pits for pores
     const x=u*n,y=v*n,ix=Math.floor(x),iy=Math.floor(y);let d=9;
     for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const cx=ix+i,cy=iy+j,wx=((cx%n)+n)%n,wy=((cy%n)+n)%n;d=Math.min(d,Math.hypot(cx+hr(wx,wy,1)-x,cy+hr(wx,wy,2)-y));}
     return d;
   };
   const pores=reliefTexture(128,(u,v)=>.55+.45*Math.min(1,cell(u,v,24)*1.6)-.08*hr(Math.floor(u*128),Math.floor(v*128),3),5);
   const weave=reliefTexture(128,(u,v)=>{const a=Math.sin(u*Math.PI*64),b=Math.sin(v*Math.PI*64),over=(Math.floor(u*32)+Math.floor(v*32))%2;return .5+.35*(over?a*a:b*b)-.15*hr(Math.floor(u*128),Math.floor(v*128),5);},6);
   skin.bumpMap=pores;skin.bumpScale=.18;
   for(const m of [cloth,pants,shoe]){m.bumpMap=weave;m.bumpScale=.6;}
 }
 const darker=(base:string,k=.74)=>'#'+new THREE.Color(base).multiplyScalar(k).getHexString();
 const seam=mat(darker(spec.outfit.topColor,.64)),sole=mat('#262925'),hairHi=mat(darker(spec.appearance.hairColor,1.15));
 // Woodland camouflage painted as vertex tint: overlapping blotches quantised into four tones.
 const camoMat=mat('#5b5046',0,.9);
 const camo=(x:number,y:number,z:number)=>{
   const v=Math.sin(x*190+y*60+seedPhase)+Math.sin(y*170-z*130+1.7)+Math.sin(z*180+x*110+3.1);
   return v>1.2?1.9:v>.3?1.2:v>-.8?.72:.38;
 };
 const group=(name:string,parent:THREE.Object3D,pos=[0,0,0])=>{const g=new THREE.Group();g.name=name;g.position.set(...pos as [number,number,number]);parent.add(g);nodes[name]=g;return g;};
 type MeshOptions={crease?:number;tint?:(x:number,y:number,z:number)=>number;lateral?:boolean;roundStart?:boolean};
 const mesh=(name:string,g:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Object3D,pos=[0,0,0],wear=0,opts:MeshOptions={})=>{
   const a=g.getAttribute('position'),colors:number[]=[];
   for(let i=0;i<a.count;i++){
     const grime=Math.sin(a.getX(i)*47+a.getY(i)*28+a.getZ(i)*19+seedPhase);
     const amount=(1-(rng()*.025)-(wear*(.04+Math.max(0,grime)*.23)))*(opts.tint?opts.tint(a.getX(i),a.getY(i),a.getZ(i)):1);colors.push(amount,amount*.998,amount*.986);
   }
   g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
   if(HD){const smooth=creaseNormals(g,opts.crease);if(smooth!==g)g.dispose();g=smooth;}
   geometries.add(g);
   const o=new THREE.Mesh(g,m);o.name=name;o.position.set(...pos as [number,number,number]);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;
 };
 const box=(name:string,size:number[],m:THREE.Material,parent:THREE.Object3D,pos:number[],wear=0)=>{
   const [w,h,d]=size;
   return mesh(name,HD&&Math.min(w,h,d)>=.008?new RoundedBoxGeometry(w,h,d,Math.min(w,h,d)<.015?1:2,Math.min(w,h,d)*.3):new THREE.BoxGeometry(w,h,d),m,parent,pos,wear);
 };
 const bevelBox=(name:string,size:number[],m:THREE.Material,parent:THREE.Object3D,pos:number[])=>{
   const [w,h,d]=size,b=Math.min(HD?.024:.017,w/5,h/5,d/5),x=w/2-b,y=h/2-b,shape=new THREE.Shape();
   shape.moveTo(-x,-y);shape.lineTo(x,-y);shape.lineTo(x,y);shape.lineTo(-x,y);shape.closePath();
   const g=new THREE.ExtrudeGeometry(shape,{depth:d-2*b,steps:1,bevelEnabled:true,bevelSegments:HD?4:1,bevelSize:b,bevelThickness:b,curveSegments:1});
   g.translate(0,0,-d/2+b);return mesh(name,g,m,parent,pos,spec.wear);
 };
 const ellipsoid=(name:string,size:number[],m:THREE.Material,parent:THREE.Object3D,pos:number[],segments=10)=>{
   const g=new THREE.SphereGeometry(1,seg(segments),HD?Math.round(seg(segments)*.62):7);g.scale(...size as [number,number,number]);return mesh(name,g,m,parent,pos);
 };
 type Ring=[number,number,number,number?];
 const sweep=(name:string,rings:Ring[],m:THREE.Material,parent:THREE.Object3D,pos=[0,0,0],wear=0,radial=10,opts:MeshOptions={})=>{
   const rows=refine(rings.map(([y,w,d,z=0])=>[y,w,d,z]),STEPS,[0],[1,2]);
   return mesh(name,buildTaperedSweepGeometry({stations:rows.map(([y,w,d,z])=>({position:[0,y,z],rx:d,rz:w})),radialSegments:seg(radial),capEnds:true}),m,parent,pos,wear,opts);
 };
 // Free path [x,y,z,rx,rz]. rx follows the transported normal, rz the binormal: along X that is
 // depth/height, along Z height/width, along -Y depth/width. `round` closes the end with a dome.
 type Knot=[number,number,number,number,number];
 const tube=(name:string,knots:Knot[],m:THREE.Material,parent:THREE.Object3D,pos=[0,0,0],radial=8,round=false,wear=0,opts:MeshOptions={})=>{
   let rows=refine(knots,STEPS,[],[3,4]);
   // `lateral`: knots are [x,y,z,halfWidthX,halfHeightY] whatever the path. The upstream sweep seeds its
   // frame from the first tangent (normal = X when it runs within ~25 deg of Z, else Z projected), so a
   // steeper first segment would silently rotate the section by 90 degrees; swap to compensate.
   if(opts.lateral){const d=new THREE.Vector3(rows[1][0]-rows[0][0],rows[1][1]-rows[0][1],rows[1][2]-rows[0][2]).normalize();if(Math.abs(d.z)<=.9)rows=rows.map(([x,y,z,a,b])=>[x,y,z,b,a]);}
   // `roundStart` closes the first end with a dome too (after the lateral check, which reads the first segment).
   if(opts.roundStart){
     const a=rows[1],b=rows[0],dir=new THREE.Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2]).normalize(),r=Math.min(b[3],b[4]);
     for(const t of HD?[.45,.75,.92,1]:[1]){const k=Math.sqrt(1-t*t);rows.unshift([b[0]+dir.x*r*t,b[1]+dir.y*r*t,b[2]+dir.z*r*t,b[3]*k,b[4]*k]);}
   }
   if(round){
     const a=rows[rows.length-2],b=rows[rows.length-1],dir=new THREE.Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2]).normalize(),r=Math.min(b[3],b[4]);
     for(const t of HD?[.45,.75,.92,1]:[1]){const k=Math.sqrt(1-t*t);rows.push([b[0]+dir.x*r*t,b[1]+dir.y*r*t,b[2]+dir.z*r*t,b[3]*k,b[4]*k]);}
   }
   return mesh(name,buildTaperedSweepGeometry({stations:rows.map(([x,y,z,a,b])=>({position:[x,y,z],rx:a,rz:b})),radialSegments:seg(radial),capEnds:true}),m,parent,pos,wear,opts);
 };
 const body=group('hips',root,[0,.92,0]);
 const trunk=group('spine',body);
 const build=.79+spec.body.build*.46;
 const shoulder=(FACET?1.15:1)*Math.max(1.8*anatomy.proportions.shoulderWidth/2*(.86+spec.body.shoulders*.3),.18*build+.063*build*.65);
 const hip=1.8*anatomy.proportions.hipWidth/2*(.90+spec.body.hips*.32)*Math.sqrt(build)*(spec.outfit.top==='painter'?.88:1);
 const depth=.108*build,waist=.147*build;
 // Zombie clothes use the same fitted, rounded garment and rig as ordinary characters.
 // Keep the recipe's wardrobe ID intact for the separate villain editor.
 const top=spec.outfit.top==='zombie'?'jacket':spec.outfit.top,wear=spec.wear,hipX=hip*.57;
 const painter=top==='painter',engineer=top==='engineer',nightshift=top==='nightshift',ivory=painter?mat('#eee6d7'):engineer?mat('#ebe4d6'):cloth;
 const bare=top==='none',sleeve=top==='tank'||bare?skin:painter||engineer?ivory:cloth;
 // HD: the arm hangs from inside the shoulder mass instead of outside a full-width torso,
 // and the hip is as wide as the thighs so pelvis and legs read as one piece of clothing.
 const legWide=(FACET?1.12:1)*(.080+spec.body.build*.018)*(1+spec.body.hips*.15)*(painter?.91:1);
 const armX=HD?shoulder*.82:shoulder+.008,armY=HD?.44:.49,hipW=Math.max(hip,hipX+legWide*1.02);
 // Bust: the front of the chest rings moves forward (depth and centre together), and on shirts without
 // chest pockets the torso mesh itself is pushed out in two soft mounds. Everything placed with onChest
 // (zipper, drawstrings, straps, pockets) follows both, so nothing sinks in or floats.
 const pocketed=top==='jacket'||top==='fieldshirt',bust=spec.body.bust,bustY=.37;
 const bump=(y:number)=>bust*(pocketed?.032:.012)*Math.exp(-(((y-bustY)/.05)**2));
 const mounds=(x:number,y:number)=>{
   if(pocketed||bust<=0)return 0;
   const dy=y-bustY+.005,vy=Math.exp(-((dy/(dy>0?.05:.034))**2));
   return bust*.03*vy*(Math.exp(-(((x-.047)/.034)**2))+Math.exp(-(((x+.047)/.034)**2)));
 };
 const withBust=(rings:Ring[]):Ring[]=>{
   if(bust<=0)return rings;
   const out=[...rings];
   for(const yy of [.31,.34,.37,.40,.425])if(!out.some(r=>Math.abs(r[0]-yy)<.012)){
     const i=out.findIndex(r=>r[0]>yy),a=out[i-1],b=out[i],t=(yy-a[0])/(b[0]-a[0]);
     out.splice(i,0,[yy,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t,(a[3]??0)+((b[3]??0)-(a[3]??0))*t]);
   }
   return out.map(([y,w,d,z=0])=>[y,w,d+bump(y)/2,z+bump(y)/2] as Ring);
 };
 const torso:Ring[]=withBust(HD
   ?[[.154,waist*1.02,.117*build],[.21,waist*1.06,.119*build],[.29,(waist*1.06+shoulder*.8)/2,.122*build],[.37,shoulder*.8,.122*build],[.43,shoulder*.82,.116*build],[.47,shoulder*.74,.098*build],[.50,shoulder*.5,.08*build],[.535,.072,.066]]
   :[[.154,waist*1.025,.118*build],[.28,.18*build,.122*build],[.43,shoulder*.95,.121*build],[.49,shoulder*.86,.1*build],[.535,.074,.07]]);
 // HD tank top: the cloth stops at a straight neckline and skin continues above it.
 const tankHD=HD&&top==='tank';
 const torsoMesh=sweep('torso',tankHD?[...torso.filter(r=>r[0]<=.43),[.448,shoulder*.785,.108*build]]:torso,bare?skin:painter||engineer?ivory:cloth,trunk,[0,0,0],bare?0:wear,12);
 if(tankHD)sweep('upper-chest',[[.40,shoulder*.78,.115*build],[.43,shoulder*.8,.112*build],...torso.filter(r=>r[0]>=.47)],skin,trunk,[0,0,0],0,12);
 const torsoAt=profileAt(refine(torso.map(([y,w,d,z=0])=>[y,w,d,z]),STEPS,[0],[1,2]));
 // Position and yaw that make a flat part sit on the curved chest at (x,y), `lift` off the surface.
 const onChest=(x:number,y:number,lift:number,fallbackZ:number):[number,number]=>{
   if(!HD)return [fallbackZ,0];
   const [w,d,c]=torsoAt(y),u=Math.min(.95,Math.abs(x)/w),z=d*Math.sqrt(1-u*u);
   const yaw=Math.atan2(x/(w*w),z/(d*d));return [c+z+mounds(x,y)+lift*Math.cos(yaw),yaw];
 };
 // Flat parts sewn on the chest (pockets, flaps, buttons, patches) are registered as obstacles, so
 // straps and zippers laid over the chest later can ride on top of them instead of cutting through.
 const chestParts:{x0:number;x1:number;y0:number;y1:number;front:(x:number)=>number}[]=[];
 const addChestPart=(x:number,y:number,z:number,yaw:number,w:number,h:number,d:number)=>{
   const hw=w/2*Math.cos(yaw)+d/2*Math.abs(Math.sin(yaw)),zf=z+d/2/Math.cos(yaw);
   chestParts.push({x0:x-hw,x1:x+hw,y0:y-h/2,y1:y+h/2,front:(xx:number)=>zf-(xx-x)*Math.tan(yaw)});
 };
 // Highest front surface at (x,y): the torso itself or any part sewn on it.
 const chestFront=(x:number,y:number)=>{
   const [w,d,c]=torsoAt(y),u=Math.min(.985,Math.abs(x)/w);let z=c+d*Math.sqrt(1-u*u)+mounds(x,y);
   for(const q of chestParts)if(x>=q.x0-.003&&x<=q.x1+.003&&y>=q.y0-.003&&y<=q.y1+.003)z=Math.max(z,q.front(THREE.MathUtils.clamp(x,q.x0,q.x1)));
   return z;
 };
 // A band lying on the chest from y0 to y1 at x (half-width hw): samples every 2 cm (the sweep refines between them), dilated then smoothed.
 const chestBand=(x:number,hw:number,y0:number,y1:number,lift:number)=>{
   const ys:number[]=[];for(let y=y0;y<y1-.008;y+=.02)ys.push(y);ys.push(y1);
   const raw=ys.map(y=>Math.max(chestFront(x-hw,y),chestFront(x,y),chestFront(x+hw,y)));
   const up=raw.map((_,i)=>Math.max(raw[Math.max(0,i-1)],raw[i],raw[Math.min(raw.length-1,i+1)]));
   return ys.map((y,i)=>[y,(up[Math.max(0,i-1)]+2*up[i]+up[Math.min(up.length-1,i+1)])/4+lift] as [number,number]);
 };
 if(bust>0&&!pocketed){
   // Push the front of the torso out and rebuild its normals, so the mounds are part of the shirt.
   const g=torsoMesh.geometry,pa=g.getAttribute('position');
   for(let i=0;i<pa.count;i++){const x=pa.getX(i),y=pa.getY(i),z=pa.getZ(i),[,d,c]=torsoAt(y),front=THREE.MathUtils.clamp((z-c)/d,0,1);pa.setZ(i,z+mounds(x,y)*front);}
   if(HD){const smooth=creaseNormals(g);torsoMesh.geometry=smooth;geometries.delete(g);g.dispose();geometries.add(smooth);}else g.computeVertexNormals();
 }
 // The seat stays outside the thigh down to y=-0.02 and then tucks in at once, so the thigh crosses it at
 // a steep angle: a clean fold instead of two nearly parallel surfaces fighting over a jagged band.
 sweep('pelvis',HD
   ?[[-.05,hipW*.3,.05*build,-.004],[-.036,hipW*.62,.07*build,-.004],[-.02,hipW*.99,.104*build,-.008],[.03,hipW*1.02,.117*build,-.008],[.08,hipW*.96,.116*build,-.004],[.125,waist*1.03,.11*build]]
   :[[.025,hip*.99,.106*build],[.12,hip,.118*build],[.14,waist,.107*build]],pants,body,[0,0,0],wear,12);
 // Belt wraps the waist and provides an equipment anchor.
 const briefs=spec.outfit.pants==='briefs';
 sweep(briefs?'waistband':'belt',HD?[[.118,waist*1.055,.118*build],[.152,waist*1.045,.118*build]]:[[.125,waist*1.035,.116*build],[.156,waist*1.035,.116*build]],briefs?pants:dark,trunk,[0,0,0],0,HD?12:10);
 if(!briefs)box('buckle',[.05,.033,.016],metal,trunk,[0,.14,.124*build]);
 // Every character's nape rises inside the skull instead of ending at a visible
 // horizontal cap below the jaw. A recessed throat preserves the chin outline.
 sweep('neck',[
   [.50,.049,.050], [.535,.046,.047,-.002], [.57,.040,.039,-.006],
   [.595,.039,.038,-.009], [.625,.042,.041,-.010],
   [.57+.085*spec.body.head,.037,.035,-.008],
   [.57+.115*spec.body.head,.025,.026,-.004]
 ],skin,trunk);
 const head=group('head',trunk,[0,.57,0]);
 head.scale.set(spec.body.head*spec.appearance.faceWidth,spec.body.head,spec.body.head);
 // A bare scalp would show the flat crown that hair normally covers, so bald heads get an oval dome.
 const bareTop=spec.appearance.hair==='bald'||spec.appearance.hair==='balding';
 const crown:Ring[]=bareTop
   ?[[.226,.074,.08,-.005],[.246,.064,.07,-.006],[.262,.047,.053,-.007],[.273,.026,.03,-.007],[.278,.004,.005,-.007]]
   :HD?[[.226,.068,.074,-.005],[.244,.055,.062,-.005],[.257,.007,.012,-.005]]:[[.244,.055,.062,-.005],[.257,.007,.012,-.005]];
 // Face shape: jaw, cheek and forehead widths plus how far the chin drops; chin type reshapes the lowest rings.
 const ap=spec.appearance,SS=THREE.MathUtils.smoothstep;
 // Advanced face mode: fine offsets in -1..1 on top of the presets (0 when absent).
 const F=(k:string)=>THREE.MathUtils.clamp(ap.fine?.[k]??0,-1,1);
 const SHAPES:Record<string,number[]>={oval:[1,1,1,0],square:[1.12,1.03,1.02,0],round:[1.06,1.08,1,-.004],long:[.94,.96,.98,.01],heart:[.86,1.02,1.07,.004]};
 const CHINS:Record<string,number[]>={round:[1,0,0],square:[1.2,0,.002],pointed:[.62,.005,-.003],strong:[1.1,.009,-.003],vshape:[1,.006,-.013]}; // width, forward, down
 const shapeRing=([y,w,d,z=0]:Ring):Ring=>{
   const [jaw0,cheek0,fore0,drop0]=SHAPES[ap.faceShape]??SHAPES.oval,[cw0,cz0,cy0]=CHINS[ap.chin]??CHINS.round;
   const jaw=jaw0*(1+.15*F('jaw')),cheek=cheek0*(1+.12*F('cheekbones')),fore=fore0*(1+.12*F('forehead')),drop=drop0+.012*F('faceLength');
   const cw=cw0*(1+.35*F('chinWidth')),cz=cz0+.007*F('chinForward'),cy=cy0-.008*F('chinDrop');
   const lower=1-SS(y,.06,.12),upper=SS(y,.15,.21),mid=1-lower-upper,chin=(1-SS(y,.03,.07))*(y<.01?.5:1);
   const base=lower*jaw+mid*cheek+upper*fore,k=base*(1+(ap.cheeks-.5)*.12*Math.exp(-(((y-.105)/.035)**2)));
   // Width takes the full shape and cheek fullness; depth only a gentle share of the shape, so the front
   // of the face stays a smooth curve (a full-strength depth change left a step and a shadow band).
   // Chin size (0..1, .5 neutral): a bigger chin is a little wider, reaches forward and drops lower.
   const cs=(ap.chinSize??.5)-.5;
   let width=w*k*(1+(cw-1+cs*.3)*chin);
   // Pontudo: the face keeps its shape down to below the mouth; only the very bottom of the jaw
   // closes in curved sides to a point that sits a little lower.
   if(ap.chin==='vshape'){const top=.06,wTop=.082*k,tip=.004+cs*.008,line=tip+(wTop-tip)*Math.pow(Math.max(0,y-.004)/(top-.004),.72);width+=(Math.min(width,line)-width)*(1-SS(y,.04,.065));}
   return [y-drop*(1-SS(y,0,.1))+(cy-cs*.008)*chin,width,d*(1+(base-1)*.25)*(1+.08*F('faceDepth')),z+(cz+cs*.014)*chin];
 };
 const rawHead:Ring[]=(HD
   // Lower rings are jaw, not skull: shallow and centred forward, so from the side the jaw line runs from
   // the chin back and up to below the ear instead of hanging low behind it. [y, halfWidth, halfDepth, z]
   ?[[.004,.024,.024,.036],[.014,.05,.042,.03],[.04,.073,.061,.023],[.065,.085,.073,.014],[.09,.091,.083,.006],[.115,.092,.088,.002],[.145,.091,.09],[.175,.088,.089,-.002],[.20,.082,.086,-.004],...crown]
   :[[.014,.05,.042,.03],[.04,.073,.061,.023],[.065,.085,.073,.014],[.09,.091,.083,.006],[.145,.091,.09],[.20,.082,.086,-.004],...crown]);
 const headRings=rawHead.map(shapeRing);
 // Built with vertical rings, then sheared forward by each height's z offset: letting the sweep follow
 // a slanted centre line tilts the rings and pushes the front of the lower face up into a step.
 const headShape=sweep('head-shape',headRings.map(([y,w,d])=>[y,w,d,0] as Ring),skin,head,[0,0,0],0,UHD?18:12);
 // Half-width, half-depth and z offset of the head surface at height y (for shells that hug the face).
 const headRows=refine(headRings.map(([y,w,d,z=0])=>[y,w,d,z]),STEPS,[0],[1,2]);
 const headAt=profileAt(headRows);
 {const pa=headShape.geometry.getAttribute('position') as THREE.BufferAttribute;
  for(let i=0;i<pa.count;i++)pa.setZ(i,pa.getZ(i)+headAt(pa.getY(i))[2]);
  pa.needsUpdate=true;if(HD)creaseNormals(headShape.geometry);else headShape.geometry.computeVertexNormals();}
 // How far the front of the face moved (in z) at height y after shaping. Eyes, nose, mouth and
 // everything worn on the face add it, so they stay on the skin for every face shape and chin.
 const baseAt=profileAt(refine(rawHead.map(([y,w,d,z=0])=>[y,w,d,z]),STEPS,[0],[1,2]));
 const fz=(y:number)=>{const [,d,c]=headAt(y),[,d0,c0]=baseAt(y);return d+c-(d0+c0);};
 // Facial landmarks derive from the upstream head-division canon.
 const headHeight=.257,eyeY=headHeight*(1-anatomy.faceLandmarks.eyeLine)+.023+.009*F('eyeHeight');
 const nh=.008*F('noseHeight'),noseY=headHeight*(1-anatomy.faceLandmarks.noseBase)+.023+nh,mouthY=headHeight*(1-anatomy.faceLandmarks.mouthLine)+.023+.008*F('mouthHeight');
 const mz=fz(mouthY);
 const skinShade=mat(darker(spec.appearance.skin,.72)),lip=mat('#'+new THREE.Color(spec.appearance.skin).lerp(new THREE.Color(ap.makeup?'#a8363a':'#8a4540'),ap.makeup?.82:.3).multiplyScalar(.9).getHexString(),0,ap.makeup?.42:.6);
 type MouthParts={upper:THREE.Mesh;lower:THREE.Mesh;line:THREE.Mesh;inner:THREE.Object3D;teeth:THREE.Object3D;base:Map<THREE.Mesh,Float32Array>};
 let mouthParts:MouthParts|null=null;
 // Parts of each eye moved by the facial animation in update().
 // Iris size from the advanced face mode; the gaze animation multiplies it every frame.
 const irisK=1+.35*F('irisSize');
 const face:{side:number;lid:THREE.Object3D;lower:THREE.Object3D;brow:THREE.Object3D;look:THREE.Object3D[];white:THREE.Object3D;bag:THREE.Object3D;rest:number}[]=[];
 for(const side of [-1,1]){
   const earX=headAt(.114)[0]+.001;
   // Ear frame: size, height and how far it stands out from the head.
   const earG=group('ear'+(side<0?'R':'L'),head,[side*earX,.114+.01*F('earHeight'),0]);earG.scale.setScalar(1+.3*F('earSize'));earG.rotation.y=side*.45*F('earAngle');
   ellipsoid('ear',[.021,.033,.018],skin,earG,[0,0,0],8);
   if(!HD){
     box('brow',[.043,ap.brows==='thick'?.014:ap.brows==='thin'?.006:.009,.011],hair,head,[side*.039*(1+.18*F('eyeSpacing')),eyeY+.02+.005*F('browHeight'),.084+fz(eyeY+.02)]);
     box('eye-white',[.034,.012,.008],white,head,[side*.039*(1+.18*F('eyeSpacing')),eyeY,.086+fz(eyeY)]);
     box('iris',[.011,.011,.009],eye,head,[side*.039*(1+.18*F('eyeSpacing')),eyeY,.092+fz(eyeY)]);
     continue;
   }
   ellipsoid('ear-inner',[.008,.018,.01],skinShade,earG,[side*.0125,-.002,.002],5);
   // Each eye sits in its own frame, turned to follow the curvature of the face.
   const socket=group('eye'+(side<0?'R':'L'),head,[side*.039*(1+.18*F('eyeSpacing')),eyeY,.078+fz(eyeY)+.004*F('eyeDepth')]);socket.rotation.y=side*.4;
   // Size and shape (almond = wider and shorter) scale the whole eye; tilt lifts the outer corner.
   {const k=1+.25*F('eyeSize'),w=1+.18*F('eyeWidth');socket.scale.set(k*w,k/w,1);socket.rotation.z=side*.22*F('eyeTilt');}
   const eyeWhite=ellipsoid('eye-white',[.0165,.0105,.008],white,socket,[0,0,0],7);
   const iris=ellipsoid('iris',[.0072,.0075,.0035],eye,socket,[0,0,.0062],5);
   const pupil=ellipsoid('pupil',[.0033,.0035,.002],dark,socket,[0,0,.0088],3);
   const lid=ellipsoid('eyelid',[.0192,.0078,.0098],skin,socket,[0,.0102,.0004],6);
   const lower=ellipsoid('lower-lid',[.0172,.0042,.0086],skin,socket,[0,-.0098,0],5);
   if(ap.makeup){
     // Winged liner along the rim of the upper lid, in the lid's frame so it closes with it; the wing lifts
     // past the outer corner. Points sit on the lid ellipsoid surface, a hair in front of it.
     // Lash line: where the lid surface meets the eyeball, found by scanning down from the top of the lid.
     const lidZ=(x:number,y:number)=>.0004+.0098*Math.sqrt(Math.max(0,1-(x/.0192)**2-((y-.0102)/.0078)**2));
     const ballZ=(x:number,y:number)=>.008*Math.sqrt(Math.max(0,1-(x/.0165)**2-(y/.0105)**2));
     const lash=(x:number)=>{let y=.017;while(y>0&&lidZ(x,y)>=ballZ(x,y))y-=.0002;return [y,Math.max(lidZ(x,y),ballZ(x,y))] as const;};
     const liner:Knot[]=[-.013,-.006,.002,.009,.0145].map((x,i)=>{const [y,z]=lash(x);return [side*x,y-.0102,z-.0004+.0007,.0015+i*.0002,.0013] as Knot;});
     liner.push([side*.021,-.0035,.0012,.0014,.0011],[side*.0265,-.0003,-.0006,.0007,.0006]);
     tube('eyeliner',liner,mat('#1d1512',0,.5),lid,[0,0,0],4,true);
   }
   // Brow shapes: [x (negative = inner end), y, z] and a radius per knot.
   const BROWS:Record<string,[number[][],number[]]>={
     natural:[[[-.021,.019,.003],[-.004,.0235,.007],[.019,.0205,.004]],[.0048,.0042,.0027]],
     thick:[[[-.022,.0185,.003],[-.004,.0225,.007],[.02,.0195,.004]],[.0072,.0066,.0045]],
     thin:[[[-.021,.02,.003],[-.004,.0245,.007],[.019,.021,.004]],[.0029,.0026,.0017]],
     arched:[[[-.021,.0175,.003],[-.002,.0268,.007],[.02,.018,.004]],[.0046,.004,.0025]],
     angled:[[[-.022,.017,.003],[.007,.0245,.007],[.021,.0192,.004]],[.0055,.0048,.003]],
     flat:[[[-.021,.0205,.003],[0,.021,.007],[.02,.0205,.004]],[.005,.0048,.0036]],
   };
   const [bp,br]=BROWS[ap.brows]??BROWS.natural;
   // Fine brows: length stretches, spacing slides outwards, height lifts, tilt drops the inner end, thickness scales.
   const bl=1+.25*F('browLength'),bs=.005*F('browSpacing'),bh=.005*F('browHeight'),bt=.35*F('browTilt'),bk=1+.45*F('browThickness');
   const brow=tube('brow',bp.map(([x,y,z],i)=>[side*(x*bl+bs),y+bh+x*bt,z,br[i]*bk,br[i]*bk] as Knot),hair,socket,[0,0,0],6);
   // Tired eyes: a darker, puffy crescent under the lower lid, hidden until an expression shows it.
   const bag=ellipsoid('eye-bag',[.018,.0068,.0082],mat(darker(spec.appearance.skin,.62)),socket,[0,-.0152,.0018],6);bag.visible=false;
   face.push({side,lid,lower,brow,look:[iris,pupil],white:eyeWhite,bag,rest:-.004*F('lidDrop')});
 }
 // Nose: width, extra length (tip lower), projection (tip forward) and tip size.
 const NOSES:Record<string,number[]>={medium:[1,0,0,1],wide:[1.35,0,-.002,1.15],narrow:[.78,.002,.002,.9],long:[.95,.009,.004,1],button:[.9,-.006,-.003,.85],small:[.7,-.009,-.005,.68]};
 const [nw0,nl0,np0,nt0]=NOSES[ap.nose]??NOSES.medium;
 const nw=nw0*(1+.3*F('noseWidth')),nl=nl0+.008*F('noseLength'),np=np0+.006*F('noseProjection'),nt=nt0*(1+.3*F('noseTip'));
 // Mouth: width and lip fullness.
 const MOUTHS:Record<string,number[]>={medium:[1,1],full:[1.03,1.5],thin:[1,.6],wide:[1.25,1],shaped:[1.22,1.25]};
 const [mw0,mr]=MOUTHS[ap.mouth]??MOUTHS.medium,mw=mw0*(1+.25*F('mouthWidth')),ul=1+.45*F('upperLip'),ll=1+.45*F('lowerLip');
 if(HD){
   tube('nose',[[0,.142+nh,.083+fz(.142+nh),.0065*nw,.0075*nw],[0,.12-nl*.5+nh,.093+np*.5+fz(.12-nl*.5+nh),.0085*nw,.009*nw],[0,.104-nl+nh,.1+np+fz(.104-nl+nh),.0105*nw,.0115*nw]],skin,head,[0,0,0],8,true);
   ellipsoid('nose-tip',[.0135*nw*nt,.0115*nt,.012*nt],skin,head,[0,noseY+.012-nl,.1+np+fz(noseY+.012-nl)],6);
   for(const side of [-1,1])ellipsoid('nostril',[.0092*nw*nt,.0072*nt,.0088*nt],skin,head,[side*.0115*nw,noseY+.007-nl,.095+np+fz(noseY+.007-nl)],5);
   const L=(k:number[][],f=1):Knot[]=>k.map(([x,y,z,a,b])=>[x*mw,y,z+mz,a*mr*f,b*mr*f] as Knot);
   // Desenhada: a cupid's bow on the upper lip (two peaks and a dip), a fuller lower lip and corners
   // that lift a little into a half smile; both lips taper to fine points at the corners.
   const drawn=ap.mouth==='shaped';
   const upperLip=drawn?tube('upper-lip',L([[-.021,mouthY+.0022,.0795,.0009,.0008],[-.0135,mouthY+.0038,.0838,.0022,.0019],[-.0058,mouthY+.0058,.0864,.0031,.0026],[0,mouthY+.0047,.0872,.003,.0026],[.0058,mouthY+.0058,.0864,.0031,.0026],[.0135,mouthY+.0038,.0838,.0022,.0019],[.021,mouthY+.0022,.0795,.0009,.0008]],ul),lip,head,[0,0,0],7)
     :tube('upper-lip',L([[-.021,mouthY+.0045,.081,.0033,.003],[0,mouthY+.0045+.0005*mr,.087,.0043,.0036],[.021,mouthY+.0045,.081,.0033,.003]],ul),lip,head,[0,0,0],6);
   const lowerLip=drawn?tube('lower-lip',L([[-.0185,mouthY+.0004,.0795,.0009,.0008],[-.0115,mouthY-.0038,.0838,.0031,.0027],[0,mouthY-.0056,.0868,.0043,.0038],[.0115,mouthY-.0038,.0838,.0031,.0027],[.0185,mouthY+.0004,.0795,.0009,.0008]],ll),lip,head,[0,0,0],7)
     :tube('lower-lip',L([[-.018,mouthY-.0045,.08,.0033,.003],[0,mouthY-.0045-.0007*mr,.0855,.0052,.0044],[.018,mouthY-.0045,.08,.0033,.003]],ll),lip,head,[0,0,0],6);
   const mouthLine=drawn?tube('mouth',[[-.0225*mw,mouthY+.0021,.0793+mz,.0011,.001],[-.011*mw,mouthY+.0003,.0845+mz,.0016,.0014],[0,mouthY-.0001,.0862+mz,.0018,.0015],[.011*mw,mouthY+.0003,.0845+mz,.0016,.0014],[.0225*mw,mouthY+.0021,.0793+mz,.0011,.001]],mat(darker(spec.appearance.skin,.36)),head,[0,0,0],5)
     :tube('mouth',[[-.022*mw,mouthY+.0005,.08+mz,.0018,.0016],[0,mouthY,.0858+mz,.0022,.0018],[.022*mw,mouthY+.0005,.08+mz,.0018,.0016]],mat(darker(spec.appearance.skin,.42)),head,[0,0,0],5);
   const inner=ellipsoid('mouth-inside',[.017*mw,.006,.006],mat('#5a2a28',0,.7),head,[0,mouthY-.001,.08+mz],8);inner.visible=false;
   const teeth=box('teeth',[.02*mw,.0035,.004],mat('#e8e2d6',0,.4),head,[0,mouthY+.0018,.0835+mz]);teeth.visible=false;
   mouthParts={upper:upperLip,lower:lowerLip,line:mouthLine,inner,teeth,base:new Map()};
   // Mouth corners: lift (or drop) the ends of the lips and the line between them before the rest pose is stored.
   if(F('mouthCorners'))for(const m of [upperLip,lowerLip,mouthLine]){const pa=m.geometry.getAttribute('position');for(let i=0;i<pa.count;i++){const u=Math.min(1,Math.abs(pa.getX(i))/(.022*mw));pa.setY(i,pa.getY(i)+.0035*F('mouthCorners')*u*u);}pa.needsUpdate=true;m.geometry.computeVertexNormals();}
   for(const m of [upperLip,lowerLip,mouthLine])mouthParts.base.set(m,Float32Array.from(m.geometry.getAttribute('position').array as ArrayLike<number>));
 }else{
   const nose=mesh('nose',new THREE.ConeGeometry(.018*nw,.048+nl*2,4),skin,head,[0,.113-nl+nh,.097+np+fz(.113-nl+nh)]);nose.rotation.x=.29;
   box('mouth',[.039*mw,.006*mr,.008],mat(darker(spec.appearance.skin,.61)),head,[0,mouthY,.081+fz(mouthY)]);
 }
 // Hair cap: asymmetric hairline, closed crown, no hidden model assets.
 function hairCap(kind:string,m:THREE.Material,hat=false){
   const positions:number[]=[],indices:number[]=[],n=HD?48:16,steps=HD?14:6;
   const long=kind==='bob'||kind==='long'||kind==='wavy',buzz=kind==='buzz',balding=kind==='balding'&&!hat,grow=HD&&!hat?1.06:1;
   for(let i=0;i<=steps;i++){
     const t=i/steps;
     for(let j=0;j<=n;j++){
       const a=j/n*Math.PI*2,front=Math.cos(a),bottom=hat?.156:long?(front>.45?.186:kind==='long'?-.1:.07):.115+.067*Math.max(0,front);
       const h=balding?bottom+(.19-bottom)*t:bottom+((hat?.287:buzz?.263:.280)-bottom)*Math.sin(t*Math.PI/2);
       const radius=balding?1-.12*t:Math.cos(t*Math.PI/2);
       const noise=kind==='messy'?(Math.sin(a*5+t*8)*.004):HD&&!hat&&!buzz?Math.sin(a*23+t*5)*.0012*radius:0;
       let x=Math.sin(a)*(.098+noise)*radius*grow,z=Math.cos(a)*(.10+noise)*radius*grow-.003;
       if(HD&&radius>.02){ // never dip under the scalp: push the vertex out to the head surface plus a margin
         const [w,d,c]=headAt(h),e=Math.hypot(x/(w+.005),(z-c)/(d+.005));
         if(e<1&&e>1e-6){x/=e;z=c+(z-c)/e;}
       }
       positions.push(x,h,z);
     }
   }
   for(let i=0;i<steps;i++)for(let j=0;j<n;j++){
     if(balding&&Math.cos((j+.5)/n*Math.PI*2)>.3)continue; // no hair on the front
     const a=i*(n+1)+j,b=a+n+1;indices.push(a,b,a+1,b,b+1,a+1);
   }
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();
   // Ring winding is checked below by outward-facing normals; render both sides at the open hairline.
   const o=mesh(hat?'hat-crown':'hair-cap',g,m,head,[0,0,0],0,hat&&kind==='camo'?{tint:camo}:{});(m as THREE.MeshStandardMaterial).side=THREE.DoubleSide;
   if(kind==='side'||kind==='messy'||kind==='crop'){
     const locks=HD?7:5,span=.132,wide=HD?.03:.028,jitter=seededRandom(spec.seed+':hair');
     for(let i=0;i<locks;i++){
       const len=HD?.09+jitter()*.03:.10;
       const lock=sweep('hair-lock',HD?[[0,wide*.6,.026],[.045,wide,.024],[.075,wide*.7,.016],[len,0,0]]:[[0,wide*.57,.024],[.055,wide,.025],[.10,0,0]],i%2?hair:hairHi,head,[-.075+i*span/(locks-1),.214,.014],0,7);
       const k=(i-(locks-1)/2)/((locks-1)/2);
       lock.rotation.z=(kind==='side'?-.62:k*.4)+(HD?(jitter()-.5)*.25:0);lock.rotation.x=HD?1.12+jitter()*.2:.85;
     }
   }
   if(kind==='ponytail'){
     ellipsoid('hair-tie',[.035,.035,.035],dark,head,[0,.176,-.098]);
     sweep('ponytail',[[0,.021,.021],[.05,.036,.034],[.14,.028,.030],[.25,.008,.013]],hair,head,[0,.19,-.128],0,9).rotation.x=Math.PI-.28;
   }
 }
 // HD hair: a scalp shell with a per-style hairline, a few large irregular volumes, polygonal
 // tufts on the silhouette and broad planes of close browns. No strands: they vanish at game scale.
 // UHD strands. Like the forest leaves, thousands of tiny blades are instanced over the hair surface,
 // each oriented along the hairstyle's flow, with per-strand colour and a wind-like sway in the shader.
 const strandUniforms={uTime:{value:0},uWind:{value:.3}};
 const strandMaterial=()=>{
   const m=new THREE.MeshStandardMaterial({color:spec.appearance.hairColor,roughness:.62,side:THREE.DoubleSide});
   m.onBeforeCompile=shader=>{
     shader.uniforms.uTime=strandUniforms.uTime;shader.uniforms.uWind=strandUniforms.uWind;
     shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float uTime;\nuniform float uWind;\nattribute float aFlex;')
       .replace('#include <begin_vertex>',`#include <begin_vertex>
        #ifdef USE_INSTANCING
          float phase=dot(instanceMatrix[3].xyz,vec3(61.0,37.0,23.0));
        #else
          float phase=0.0;
        #endif
        float sway=sin(uTime*2.6+phase)*.6+sin(uTime*5.3+phase*1.7)*.4;
        transformed.x+=sway*uWind*aFlex*aFlex*.0035;
        transformed.y+=abs(sway)*uWind*aFlex*.08;`);
   };
   m.customProgramCacheKey=()=>'abrigo-hair-strand-v1';materials.add(m);return m;
 };
 const strandGeometry=()=>{
   // A curved blade along +Z (length 1), width along X, curling slightly toward -Y (the scalp).
   const p:number[]=[],flex:number[]=[],ix:number[]=[],S=4,w=.0011;
   for(let i=0;i<=S;i++){const t=i/S,half=w*(1-t*.92);p.push(-half,-.12*t*t,t,half,-.12*t*t,t);flex.push(t,t);}
   for(let i=0;i<S;i++){const a=i*2;ix.push(a,a+1,a+2,a+1,a+3,a+2);}
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('aFlex',new THREE.Float32BufferAttribute(flex,1));g.setIndex(ix);g.computeVertexNormals();geometries.add(g);return g;
 };
 const LEN:Record<string,[number,number,number]>={ // length, twist, lift off the scalp
   crop:[.022,0,.2],side:[.032,-.9,.15],messy:[.034,0,.6],buzz:[.006,0,0],fade:[.009,0,.1],bob:[.05,0,.05],long:[.075,0,.03],
   quiff:[.034,Math.PI,.5],spiky:[.03,Math.PI,1.1],fringe:[.042,0,.1],slicked:[.04,Math.PI,.05],wavy:[.06,0,.15],ponytail:[.03,0,.02],balding:[.02,0,.1],tousled:[.038,0,.55]};
 function hairStrands(kind:string,surf:(a:number,t:number)=>THREE.Vector3,normal:(a:number,t:number)=>THREE.Vector3,flow:(a:number,t:number,n:THREE.Vector3,tw:number)=>THREE.Vector3,wrap:(a:number)=>number){
   const [len,twist,lift]=LEN[kind]??LEN.crop,r=seededRandom(spec.seed+':strands:'+kind),count=kind==='buzz'||kind==='fade'?1800:2800;
   const mesh=new THREE.InstancedMesh(strandGeometry(),strandMaterial(),count);mesh.name='hair-strands';
   const M=new THREE.Matrix4(),X=new THREE.Vector3(),c=new THREE.Color();let n=0;
   for(let i=0;i<count*1.6&&n<count;i++){
     const a=(r()*2-1)*Math.PI,t=Math.sqrt(r())*.96,P=surf(a,t),nrm=normal(a,t);
     const f=flow(a,t,nrm,twist+(r()-.5)*(kind==='messy'||kind==='spiky'?1.6:.5)).add(nrm.clone().multiplyScalar(lift*(.6+r()*.8))).normalize();
     const l=len*(.6+r()*.8);
     if(Math.abs(wrap(a))<1.1&&P.y+f.y*l<eyeY+.03)continue; // keep the eyes clear, as the volumes do
     X.crossVectors(nrm,f).normalize();const Y=new THREE.Vector3().crossVectors(f,X);
     M.makeBasis(X,Y.multiplyScalar(l),f.clone().multiplyScalar(l)).setPosition(P.clone().sub(nrm.clone().multiplyScalar(.0008)));
     mesh.setMatrixAt(n,M);mesh.setColorAt(n,c.setScalar(.72+r()*.55));n++;
   }
   mesh.count=n;mesh.castShadow=true;mesh.receiveShadow=true;head.add(mesh);
 }
 function hairHD(kind:string,underHat:boolean){
   const S=THREE.MathUtils.smoothstep,V=THREE.Vector3,r=seededRandom(spec.seed+':hair:'+kind),TOP=.257;
   const tone=(k:number)=>mat(darker(spec.appearance.hairColor,k),0,.82);
   const tones=[tone(.72),tone(1),tone(1.14),tone(1.3)];
   // Hairline height by |azimuth| (0 = forehead, PI = nape): temples recede, sideburns drop in front of the ear.
   const line=(f:number,e:number,burn:number,nape:number):[number,number][]=>[[0,f],[.5,f+e*.3],[.8,f+e],[1.08,.172],[1.28,burn],[1.42,.14],[1.62,.152],[1.9,.14],[2.4,nape+.01],[Math.PI,nape]];
   const styles:Record<string,{line:[number,number][];th:number;lump:number}>={
     crop:{line:line(.205,.012,.12,.085),th:.009,lump:.15},
     side:{line:line(.2,.008,.12,.085),th:.011,lump:.2},
     messy:{line:line(.195,.006,.115,.075),th:.013,lump:.45},
     buzz:{line:line(.207,.014,.125,.09),th:.0035,lump:0},
     bob:{line:[[0,.2],[.6,.202],[.85,.15],[1.1,.062],[Math.PI,.056]],th:.013,lump:.15},
     ponytail:{line:line(.2,.01,.12,.1),th:.006,lump:.05},
     balding:{line:line(.2,.01,.12,.085),th:.008,lump:.25},
     long:{line:[[0,.2],[.55,.203],[.82,.15],[1.05,-.03],[1.35,-.1],[Math.PI,-.13]],th:.013,lump:.18},
     quiff:{line:line(.203,.012,.12,.085),th:.01,lump:.12},
     fade:{line:[[0,.2],[.42,.2],[.62,.186],[.82,.19],[1.08,.168],[1.28,.12],[1.42,.13],[1.62,.14],[1.9,.12],[2.4,.1],[Math.PI,.095]],th:.011,lump:.05},
     spiky:{line:line(.203,.01,.12,.085),th:.01,lump:.3},
     fringe:{line:line(.2,.004,.105,.07),th:.012,lump:.2},
     slicked:{line:line(.212,.016,.12,.085),th:.009,lump:.08},
     wavy:{line:[[0,.2],[.55,.2],[.82,.15],[1.05,.02],[1.35,-.02],[Math.PI,-.04]],th:.014,lump:.4},
     tousled:{line:[[0,.192],[.5,.196],[.85,.15],[1.1,.1],[1.5,.09],[2.3,.075],[Math.PI,.07]],th:.016,lump:.5},
   };
   const st=styles[kind]||styles.crop;
   const wrap=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a));
   const bottom=(a:number)=>{
     const x=Math.abs(wrap(a));let i=0;while(i<st.line.length-2&&st.line[i+1][0]<x)i++;
     const [a0,y0]=st.line[i],[a1,y1]=st.line[i+1];return y0+(y1-y0)*S(x,a0,a1)+(kind==='messy'?Math.sin(a*7)*.005:0);
   };
   // Balding: a horseshoe band on the sides and back (none in front), taller over the nape.
   const bald=kind==='balding',bandH=(a:number)=>{const x=Math.abs(wrap(a));return S(x,1.05,1.5)*(.068+.022*S(x,2,3));};
   const surf=(a:number,t:number)=>{
     const b=bottom(a),h=bald?b+(underHat?Math.min(bandH(a),Math.max(0,.152-b)):bandH(a))*t:underHat?b+Math.max(0,.152-b)*t:b+(TOP-b)*Math.sin(t*Math.PI/2);
     let [w,d,c]=headAt(Math.min(h,TOP));
     if(kind==='bob'||kind==='long'||kind==='wavy'){const k=S(Math.abs(wrap(a)),.75,1.1)*(1-S(h,.16,.21));w+=(Math.max(w,.121)-w)*k;d+=(Math.max(d,.108)-d)*k;}
     // Long hair falls as a curtain that flares over the shoulders and upper back below the jaw.
     if(kind==='long'||kind==='wavy'){const fall=Math.max(0,.06-h)*(kind==='wavy'?.45:1);w+=fall*.7*S(Math.abs(wrap(a)),.9,1.3);d+=fall*.55;}
     const lump=1+st.lump*Math.sin(a*3+1.3)*Math.sin(t*4+a);
     const th=st.th*lump*(.18+.82*S(t,0,underHat?.5:.3))*(bald?1-S(t,.55,1):1)*(kind==='fade'?.25+.75*S(t,.3,.6):1);
     return new V(Math.sin(a)*(w+th),h+(underHat||bald?0:th*t*t),c+Math.cos(a)*(d+th));
   };
   const normal=(a:number,t:number)=>{
     const tt=Math.min(t,.9),e=.01,n=new V().crossVectors(surf(a+e,tt).sub(surf(a-e,tt)),surf(a,tt+e).sub(surf(a,Math.max(0,tt-e)))).normalize();
     return n.dot(surf(a,tt).sub(new V(0,.14,0)))<0?n.negate():n;
   };
   const tie=new V(0,.176,-.108);
   const flow=(a:number,t:number,n:THREE.Vector3,twist:number)=>{
     const tt=Math.min(Math.max(t,.02),.9);
     const f=kind==='ponytail'?tie.clone().sub(surf(a,tt)):surf(a,tt-.02).sub(surf(a,tt+.02));
     f.sub(n.clone().multiplyScalar(f.dot(n))).normalize();return f.applyAxisAngle(n,twist);
   };
   // Scalp shell, thinning to nothing at the hairline so it melts into the skin instead of ending in a band.
   const capMat=kind==='buzz'?mat('#'+new THREE.Color(spec.appearance.hairColor).lerp(new THREE.Color(spec.appearance.skin),.3).getHexString(),0,.85):tone(1);
   capMat.side=THREE.DoubleSide;
   const n=UHD?96:56,steps=UHD?28:16,p:number[]=[],ix:number[]=[];
   for(let i=0;i<=steps;i++)for(let j=0;j<=n;j++){const v=surf(-Math.PI+2*Math.PI*j/n,i/steps);p.push(v.x,v.y,v.z);}
   for(let i=0;i<steps;i++)for(let j=0;j<n;j++){if(bald&&bandH(-Math.PI+2*Math.PI*(j+.5)/n)<.003)continue;const a=i*(n+1)+j,b=a+n+1;ix.push(a,b,a+1,b,b+1,a+1);}
   if(!underHat&&!bald){const pole=p.length/3,c=headAt(TOP)[2];p.push(0,TOP+st.th*1.05,c);for(let j=0;j<n;j++)ix.push(steps*(n+1)+j,pole,steps*(n+1)+j+1);}
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(ix);
   const band=(x:number,y:number,z:number)=>{const v=.86+.24*S(y,.16,.25)+.08*Math.sin(x*38+z*27+seedPhase)*Math.sin(y*45+1);return Math.round(v/.07)*.07;};
   mesh('hair-cap',g,capMat,head,[0,0,0],0,{tint:band});
   if(UHD&&!underHat)hairStrands(kind,(a,t)=>surf(a,t),normal,flow,wrap);
   if(kind==='buzz'||kind==='fade')return;
   // Large volumes: faceted, jittered lenses laid along the flow of the hairstyle.
   // [azimuth, height 0..1, across, thickness, along, twist, tone, overhang]
   type Clump=[number,number,number,number,number,number,number,number];
   const clumps:Clump[]=({
     crop:[[0,.3,.07,.018,.05,0,2,.004],[-.55,.38,.065,.016,.055,.25,1,0],[.55,.38,.065,.016,.055,-.25,1,0],[0,.72,.08,.018,.07,0,3,0],[-1.25,.45,.06,.014,.055,0,1,0],[1.25,.45,.06,.014,.055,0,1,0],[Math.PI,.45,.085,.014,.065,0,0,0]],
     side:[[-.25,.42,.075,.022,.085,-.9,2,.006],[.3,.4,.07,.02,.08,-1,1,.006],[.85,.4,.06,.018,.065,-.5,1,.004],[-.85,.52,.06,.016,.06,.3,0,0],[-.1,.72,.09,.022,.08,-.7,3,0],[2.4,.45,.075,.015,.07,0,1,0],[-2.4,.45,.075,.015,.07,0,1,0],[Math.PI,.35,.08,.015,.07,0,0,0]],
     bob:[[0,.42,.085,.018,.07,0,2,.002],[-.55,.4,.07,.018,.07,.1,1,.002],[.55,.4,.07,.018,.07,-.1,1,.002],[-1.35,.28,.065,.018,.13,0,1,0],[1.35,.28,.065,.018,.13,0,1,0],[-1.95,.28,.07,.018,.13,0,0,0],[1.95,.28,.07,.018,.13,0,0,0],[Math.PI,.3,.09,.018,.13,0,0,0],[0,.75,.09,.02,.075,0,3,0]],
     // Topete: a tall swept volume over the forehead, flowing back.
     quiff:[[0,.6,.075,.055,.07,Math.PI,3,0],[-.35,.55,.06,.04,.07,Math.PI-.3,2,0],[.35,.55,.06,.04,.07,Math.PI+.3,2,0],[0,.8,.1,.025,.08,Math.PI,1,0],[-1.3,.45,.06,.014,.055,0,1,0],[1.3,.45,.06,.014,.055,0,1,0],[Math.PI,.45,.085,.014,.065,0,0,0]],
     spiky:[[0,.4,.07,.018,.05,Math.PI,2,0],[-.6,.45,.065,.016,.05,Math.PI,1,0],[.6,.45,.065,.016,.05,Math.PI,1,0],[0,.78,.08,.018,.06,0,3,0],[Math.PI,.45,.085,.014,.065,0,0,0]],
     // Franja: strands falling over the forehead (kept above the brows) and over the temples.
     fringe:[[0,.32,.06,.018,.1,0,2,.012],[-.4,.32,.055,.018,.1,.25,1,.012],[.4,.32,.055,.018,.1,-.25,1,.012],[-.8,.35,.05,.016,.09,.2,2,.008],[.8,.35,.05,.016,.09,-.2,2,.008],[0,.72,.09,.02,.08,0,3,0],[-1.35,.35,.06,.016,.08,0,0,0],[1.35,.35,.06,.016,.08,0,0,0],[Math.PI,.4,.09,.016,.08,0,0,0]],
     // Para trás: combed back from the forehead in long flat volumes.
     slicked:[[0,.5,.09,.012,.09,Math.PI,3,0],[-.45,.38,.075,.015,.11,Math.PI-.15,2,0],[.45,.38,.075,.015,.11,Math.PI+.15,2,0],[-1,.4,.065,.013,.1,Math.PI-.5,1,0],[1,.4,.065,.013,.1,Math.PI+.5,1,0],[Math.PI,.4,.09,.014,.07,0,0,0]],
     // Médio ondulado: volumes alternating their twist, down to the jaw and the nape.
     wavy:[[-.35,.45,.08,.014,.08,.5,2,0],[.35,.45,.08,.014,.08,-.5,1,0],[-1.25,.25,.07,.022,.16,.35,1,0],[1.25,.25,.07,.022,.16,-.35,1,0],[-1.8,.25,.075,.022,.17,-.3,0,0],[1.8,.25,.075,.022,.17,.3,0,0],[-2.5,.3,.07,.02,.17,.3,2,0],[2.5,.3,.07,.02,.17,-.3,2,0],[Math.PI,.25,.1,.022,.18,0,0,0],[0,.8,.1,.014,.08,0,3,0]],
     long:[[-.35,.45,.08,.012,.08,.5,2,0],[.35,.45,.08,.012,.08,-.5,1,0],[-1.3,.22,.07,.02,.2,0,1,0],[1.3,.22,.07,.02,.2,0,1,0],[-1.9,.22,.075,.02,.22,0,0,0],[1.9,.22,.075,.02,.22,0,0,0],[Math.PI,.22,.1,.02,.24,0,0,0],[-2.5,.3,.07,.018,.2,0,2,0],[2.5,.3,.07,.018,.2,0,2,0],[0,.8,.1,.012,.08,0,3,0]],
     balding:[[Math.PI,.45,.09,.012,.05,0,1,0],[2.1,.45,.07,.011,.045,0,0,0],[-2.1,.45,.07,.011,.045,0,0,0],[1.55,.4,.05,.01,.04,0,1,0],[-1.55,.4,.05,.01,.04,0,1,0]],
     ponytail:[[0,.55,.08,.012,.08,0,3,0],[-.9,.5,.06,.012,.07,0,2,0],[.9,.5,.06,.012,.07,0,2,0],[Math.PI,.6,.07,.012,.06,0,1,0]],
   } as Record<string,Clump[]>)[kind]||[];
   if(kind==='messy'||kind==='tousled')for(let i=0;i<8;i++){const a=(r()*2-1)*Math.PI;clumps.push([a,(Math.abs(a)<.9?.42:.25)+r()*.45,.055+r()*.03,.015+r()*.008,.05+r()*.03,(r()-.5)*2.4,Math.floor(r()*4),i<3?.006:0]);}
   for(const [a0,t,sx,sy,sz,tw,tn,over] of clumps){
     const a=a0+(r()-.5)*.1,k=.85+r()*.3,nrm=normal(a,t),f=flow(a,t,nrm,tw+(r()-.5)*.4),P=surf(a,t);
     if(underHat&&P.y>.15)continue;
     const geo=new THREE.IcosahedronGeometry(1,1),pa=geo.getAttribute('position'),seedN=r()*100;
     for(let i=0;i<pa.count;i++){ // the same jitter for coincident vertices keeps the lens closed
       const x=pa.getX(i),y=pa.getY(i),z=pa.getZ(i),h=Math.sin(x*127.1+y*311.7+z*74.7+seedN)*43758.5,j=1+(h-Math.floor(h)-.5)*.34;pa.setXYZ(i,x*j,y*j,z*j);
     }
     geo.scale(sx*k,sy*k,sz*k);
     // Bend the lens around the skull (radius ~0.1) so long volumes hug the head instead of lifting at the ends.
     for(let i=0;i<pa.count;i++){const x=pa.getX(i),z=pa.getZ(i);pa.setY(i,pa.getY(i)-(x*x+z*z)/(2*.1));}
     const X=new V().crossVectors(nrm,f).normalize();
     geo.applyMatrix4(new THREE.Matrix4().makeBasis(X,nrm,f).setPosition(P.clone().add(nrm.clone().multiplyScalar(-sy*.15)).add(f.clone().multiplyScalar(over))));
     // Whatever its size and twist, a volume must not hang over the eyes: lift it, or drop it if it is too low.
     let low=1;for(let i=0;i<pa.count;i++)if(pa.getZ(i)>.045&&Math.abs(pa.getX(i))<.075)low=Math.min(low,pa.getY(i));
     const clear=eyeY+.028-low;
     if(clear>.025){geo.dispose();continue;}
     if(clear>0)geo.translate(0,clear,0);
     mesh('hair-volume',geo,tones[tn],head,[0,0,0],0,{crease:Math.PI*.1});
   }
   // Tufts break the outline: [count, azimuth from, to, height from, to, length, radius, outward, droop, tone, twist]
   type Tuft=[number,number,number,number,number,number,number,number,number,number,number];
   const around:Tuft=[10,1.2,2*Math.PI-1.2,0,.15,.02,.008,.5,.5,0,0];
   const tufts:Tuft[]=({
     quiff:[[7,-.45,.45,.45,.6,.035,.016,1.6,-.9,3,Math.PI],around,[4,-2,2,.7,.9,.016,.01,1.2,0,3,0]],
     spiky:[[20,-Math.PI,Math.PI,.35,.95,.042,.016,1.6,-.7,2,Math.PI],[8,-.7,.7,.15,.3,.03,.011,1.2,-.4,3,Math.PI],around],
     fringe:[[9,-.9,.9,.02,.12,.03,.01,.1,.7,1,0],[10,1.1,2*Math.PI-1.1,0,.12,.024,.009,.4,.6,0,0]],
     slicked:[[8,2.2,2*Math.PI-2.2,0,.1,.022,.009,.3,.5,0,0]],
     wavy:[[14,1,2*Math.PI-1,0,.04,.018,.012,-.1,1,0,0],[6,-.6,.6,0,.05,.016,.009,.15,.6,2,0],[6,1.2,2*Math.PI-1.2,.2,.5,.022,.011,1,.3,1,0]],
     long:[[16,1.1,2*Math.PI-1.1,0,.03,.02,.011,-.2,1,0,0],[6,-.6,.6,0,.05,.016,.009,.15,.6,2,0]],
     balding:[around,[12,1.3,2*Math.PI-1.3,.55,.85,.016,.007,1,0,1,0]],
     crop:[[5,-.5,.5,.02,.1,.022,.009,.3,.2,2,0],around,[4,-2,2,.55,.9,.016,.01,1.2,0,3,0]],
     side:[[6,-.3,.9,.08,.2,.026,.01,.35,0,2,-.9],around,[3,-2,2,.55,.9,.018,.01,1.2,0,3,0]],
     messy:[[22,-Math.PI,Math.PI,0,.9,.03,.011,.9,.2,1,0]],
     tousled:[[8,-Math.PI,Math.PI,.4,.95,.022,.01,.35,.1,2,0]],
     bob:[[16,.8,2*Math.PI-.8,0,.04,.03,.012,.1,1,0,0],[6,-.6,.6,0,.05,.016,.009,.15,.6,2,0]],
   } as Record<string,Tuft[]>)[kind]||[];
   for(const [count,a0,a1,t0,t1,len,rad,out,droop,tn,tw] of tufts)for(let i=0;i<count;i++){
     const a=a0+(a1-a0)*(i+.5+(r()-.5)*.8)/count,t=t0+(t1-t0)*r(),P=surf(a,t),nrm=normal(a,t);
     if(underHat&&P.y>.155)continue;
     const dir=flow(a,t,nrm,tw+(r()-.5)*.5).add(nrm.clone().multiplyScalar(out)).add(new V(0,-droop,0)).normalize();
     const l=len*(.7+r()*.6);
     if(Math.abs(wrap(a))<1&&P.y+dir.y*l<eyeY+.022)continue; // keep the eyes clear
     const geo=new THREE.ConeGeometry(rad*(.8+r()*.4),l,4,1);geo.translate(0,l/2,0);geo.rotateY(r()*Math.PI);
     geo.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new V(0,1,0),dir)).setPosition(P.clone().sub(nrm.clone().multiplyScalar(.002))));
     mesh('hair-tuft',geo,tones[Math.min(3,tn+(r()<.3?1:0))],head,[0,0,0],0,{crease:Math.PI*.1});
   }
   if(kind==='tousled'&&!underHat){
     // Repicado: broad faceted blades instead of round volumes. A side-swept fringe crosses the forehead,
     // chunky locks fall past the ears to the jaw and flick outwards, a few spikes stand up on the crown.
     // [azimuth, height 0..1, direction x,y,z, length, width, outward flick, tone]
     const blades:[number,number,number,number,number,number,number,number,number][]=[
       [-.3,.82,.6,-.6,.45,.14,.034,.08,2],[.15,.75,.75,-.5,.35,.1,.03,.12,1],[-.7,.65,.2,-.9,.35,.08,.028,.1,3],[.55,.62,.45,-.85,.25,.08,.026,.15,2],
       [0,.95,-.2,.7,-.6,.05,.02,-.1,3],[.35,.9,.5,.6,-.4,.045,.018,.15,2],[-.45,.9,-.5,.6,0,.045,.018,.15,1],
       [-1.3,.72,-.8,-.55,.1,.07,.032,.2,2],[1.3,.72,.8,-.55,.1,.07,.03,.22,1],
       [-1.1,.4,-.1,-.97,.25,.11,.03,.2,1],[1.1,.4,.1,-.97,.25,.105,.03,.22,2],
       [-1.6,.45,-.15,-.97,-.05,.12,.032,.25,0],[1.6,.45,.15,-.97,-.05,.115,.032,.25,1],
       [-2.1,.45,-.15,-.95,-.25,.11,.032,.22,1],[2.1,.45,.15,-.95,-.25,.11,.032,.22,0],
       [-2.6,.4,-.1,-.95,-.3,.09,.034,.15,0],[2.6,.4,.1,-.95,-.3,.09,.034,.15,1],[Math.PI,.4,0,-.95,-.35,.08,.036,.1,0],
     ];
     const bladeMats=tones.map(t=>{const m=t.clone();m.side=THREE.DoubleSide;materials.add(m);return m;});
     const centre=new V(0,.13,headAt(.13)[2]);
     for(const [a,t,dx,dy,dz,len,w,flick,tn] of blades){
       const P0=surf(a,t),dir=new V(dx,dy,dz).normalize(),N=6,pts:THREE.Vector3[]=[];
       for(let i=0;i<N;i++){
         const k=i/(N-1),P=P0.clone().addScaledVector(dir,len*k);
         // The end curls outwards (and a little up) from the head.
         const out=new V(P.x,0,P.z-centre.z).normalize();P.addScaledVector(out,flick*len*k**3).add(new V(0,Math.abs(flick)*len*.35*k**3,0));
         // Never inside the skull, the face or the ears: push out to the head surface plus a margin.
         const [hw,hd,hc]=headAt(THREE.MathUtils.clamp(P.y,.02,TOP)),m=.012+.01*k,e=Math.hypot(P.x/(hw+m),(P.z-hc)/(hd+m));
         if(e<1&&P.y>-.02){P.x/=e;P.z=hc+(P.z-hc)/e;}
         pts.push(P);
       }
       // Front locks stop at the brows.
       if(Math.abs(a)<1)for(const P of pts)if(P.z>.05&&Math.abs(P.x)<.07)P.y=Math.max(P.y,eyeY+.018);
       const vtx:number[]=[],idx:number[]=[];
       pts.forEach((P,i)=>{
         const k=i/(N-1),tan=pts[Math.min(N-1,i+1)].clone().sub(pts[Math.max(0,i-1)]).normalize(),n=P.clone().sub(centre).normalize();
         const across=new V().crossVectors(tan,n).normalize(),hw=w*(1-.85*k**1.6),th=.008*(1-k*.7);
         for(const q of [P.clone().addScaledVector(across,-hw),P.clone().addScaledVector(n,th),P.clone().addScaledVector(across,hw),P.clone().addScaledVector(n,-th*.4)])vtx.push(q.x,q.y,q.z);
       });
       for(let i=0;i<N-1;i++)for(let j=0;j<4;j++){const a0=i*4+j,a1=i*4+(j+1)%4;idx.push(a0,a1,a0+4,a1,a1+4,a0+4);}
       const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vtx,3));g.setIndex(idx);g.computeVertexNormals();
       mesh('hair-blade',g,bladeMats[tn],head,[0,0,0],0,{crease:Math.PI*.12});
     }
   }
   if(kind==='ponytail'){
     // The tail leaves the tie backwards, bulges, then falls along an S curve behind the neck,
     // tapering to a tip. Knots are [x,y,z,radius,radius] in head space (+Z is the face).
     const main:[number,number,number,number][]=[[0,.176,-.104,.015],[0,.172,-.124,.024],[0,.155,-.143,.03],[0,.12,-.152,.031],[0,.08,-.148,.028],[0,.04,-.137,.022],[0,.008,-.126,.014],[0,-.018,-.119,.005]];
     const lock=(name:string,dx:number,dz:number,scale:number,cut:number,tn:number)=>{
       const pts=main.slice(0,main.length-cut).map(([x,y,z,rad],i)=>[x+dx*Math.min(1,i/2),y,z+dz*Math.min(1,i/2),rad*scale,rad*scale*(.9+.1*Math.sin(i))] as Knot);
       return tube(name,pts,tones[tn],head,[0,0,0],7,true,0,{crease:Math.PI*.12});
     };
     lock('ponytail',0,0,1,0,1);
     lock('ponytail-lock',.017,-.006,.66,1,2);  // lighter lock on the outside
     lock('ponytail-lock',-.016,-.004,.64,2,0);   // darker, shorter lock underneath
     lock('ponytail-lock',.004,-.017,.52,3,3);   // highlight on the back
     const band=mesh('hair-tie',new THREE.TorusGeometry(.0165,.0055,6,14),dark,head,[0,.176,-.108]);band.rotation.x=.25;
   }
 }
 if(spec.appearance.hair!=='bald'&&spec.appearance.hair!=='lumber'){
   if(HD)hairHD(spec.appearance.hair,spec.outfit.hat!=='none');
   else if(spec.outfit.hat==='none')hairCap(spec.appearance.hair,hair);
 }
 // Facial hair is a partial shell over the jaw, with an open mouth region.
 const goatee=spec.appearance.beard==='goatee';
 if(HD&&(spec.appearance.beard==='stubble'||spec.appearance.beard==='full'||goatee)){
   // Shell offset from the actual head surface, with sideburns and an opening around the lips.
   const full=spec.appearance.beard==='full'||goatee,rows=UHD?28:18,cols=UHD?72:44,y0=goatee?.02:full?.006:.016,y1=.138,p:number[]=[],ix:number[]=[];
   const s=THREE.MathUtils.smoothstep,top=(a:number)=>.079+.012*s(Math.abs(a),.3,.9)+.05*s(Math.abs(a),1.05,1.45);
   for(let i=0;i<=rows;i++){
     const y=y0+(y1-y0)*i/rows,[w,d,z]=headAt(y),thick=full?.0045+.009*THREE.MathUtils.clamp(1-(y-.004)/.07,0,1):.0018;
     for(let j=0;j<=cols;j++){
       // Vertices outside the beard area slide onto its border, so the edges stay smooth.
       let a=-1.55+3.1*j/cols,yy=Math.min(y,top(a));
       const u=Math.sin(a)*w/.029,v=(yy-mouthY)/.0115,r=Math.hypot(u,v);
       if(r<1&&r>1e-6){yy=mouthY+v/r*.0115;a=Math.asin(THREE.MathUtils.clamp(u/r*.029/w,-1,1));}
       const [ww,dd,zz]=headAt(yy);
       p.push(Math.sin(a)*(ww+thick),yy-(i===0&&full&&!goatee?.014*Math.max(0,Math.cos(a)):0),Math.cos(a)*(dd+thick)+zz);
     }
   }
   for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){
     const y=y0+(y1-y0)*(i+.5)/rows,a=-1.55+3.1*(j+.5)/cols,x=Math.sin(a)*headAt(y)[0];
     if((x/.029)**2+((y-mouthY)/.0115)**2<1)continue; // rows above the border are already flattened onto it
     if(goatee&&(Math.abs(x)>.017+.006*(1-(y-y0)/(mouthY-y0))||y>mouthY-.009))continue; // chin tuft only
     const q=i*(cols+1)+j,r=q+cols+1;ix.push(q,q+1,r,r,q+1,r+1);
   }
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(ix);
   const beard=full?hair:mat('#'+new THREE.Color(spec.appearance.skin).lerp(new THREE.Color(spec.appearance.hairColor),.5).getHexString());beard.side=THREE.DoubleSide;mesh('beard',g,beard,head);
   if(UHD&&full){ // short strands rooted on the beard shell, pointing out and down
     const pa=g.getAttribute('position'),used=new Set(ix),roots=[...used],r=seededRandom(spec.seed+':beard'),count=Math.min(1400,roots.length*3);
     const inst=new THREE.InstancedMesh(strandGeometry(),strandMaterial(),count);inst.name='beard-strands';
     const M=new THREE.Matrix4(),X=new THREE.Vector3(),c=new THREE.Color();
     for(let i=0;i<count;i++){
       const k=roots[Math.floor(r()*roots.length)],P=new THREE.Vector3().fromBufferAttribute(pa,k);P.x+=(r()-.5)*.004;P.y+=(r()-.5)*.004;
       const [,,cz]=headAt(P.y),nrm=new THREE.Vector3(P.x,0,P.z-cz).normalize(),f=nrm.clone().multiplyScalar(.5).add(new THREE.Vector3(0,-1,0)).normalize();
       X.crossVectors(nrm,f).normalize();const Y=new THREE.Vector3().crossVectors(f,X),l=.008+r()*.008;
       inst.setMatrixAt(i,M.makeBasis(X,Y.multiplyScalar(l),f.multiplyScalar(l)).setPosition(P));inst.setColorAt(i,c.setScalar(.7+r()*.5));
     }
     inst.castShadow=true;head.add(inst);
   }
 }else if(goatee)box('goatee',[.032,.034,.012],hair,head,[0,.024,.072+fz(.024)]);
 else if(spec.appearance.beard==='stubble'||spec.appearance.beard==='full'){
   const full=spec.appearance.beard==='full',p:number[]=[],ix:number[]=[],seg=HD?30:12;
   for(let row=0;row<3;row++)for(let j=0;j<=seg;j++){
     const a=-1.6+(j/seg)*3.2;const y=row===0?(full?.003:.027):row===1?.05:.085;
     const w=row===0?.06:row===1?.082:.091,d=row===0?.060:row===1?.080:.09;
     p.push(Math.sin(a)*w,y-Math.cos(a)*(row===0&&full?.027:0),Math.cos(a)*(d+.003)+.008);
   }
   for(let r=0;r<2;r++)for(let j=0;j<seg;j++){const a=r*(seg+1)+j,b=a+seg+1;ix.push(a,a+1,b,b,a+1,b+1);}
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(ix);g.computeVertexNormals();
   const beard=full?hair:mat('#'+new THREE.Color(spec.appearance.skin).lerp(new THREE.Color(spec.appearance.hairColor),.57).getHexString());beard.side=THREE.DoubleSide;mesh('beard',g,beard,head);
 }
 if(spec.appearance.beard==='full'||spec.appearance.beard==='moustache')for(const side of [-1,1]){
   if(HD)tube('moustache',[[side*.003,mouthY+.017,.094+mz,.0055,.0065],[side*.018,mouthY+.013,.09+mz,.006,.007],[side*.03,mouthY+.004,.082+mz,.004,.0045]],hair,head,[0,0,0],7,true);
   else{const b=box('moustache',[.034,.013,.012],hair,head,[side*.015,.081,.087+fz(.081)]);b.rotation.z=side*.15;}
 }
 if(spec.outfit.glasses){
   for(const side of [-1,1]){
     const frame=mesh('glasses-frame',new THREE.TorusGeometry(.025,.004,HD?8:4,HD?28:8),dark,head,[side*.04,eyeY,.104+fz(eyeY)]);frame.scale.y=.75;
     box('glasses-arm',[.006,.006,.10],dark,head,[side*.09,eyeY,.05+fz(eyeY)]);
   }box('glasses-bridge',[.025,.006,.009],dark,head,[0,eyeY,.106+fz(eyeY)]);
 }
 if(spec.outfit.hat!=='none'){
   const camoCap=spec.outfit.hat==='camo',hatMat=camoCap?camoMat:cloth;
   hairCap(spec.outfit.hat,hatMat,true);
   sweep('hat-band',[[.158,.100,.103],[.190,.103,.106]],camoCap?camoMat:seam,head,[0,0,0],0,HD?24:10,camoCap?{tint:camo}:{});
   if(spec.outfit.hat==='cap'||camoCap){
     const brim=mesh('cap-brim',new THREE.SphereGeometry(1,HD?26:12,HD?16:7).scale(.12,.012,.092),hatMat,head,[0,.178,.10],0,camoCap?{tint:camo}:{});brim.rotation.x=.04;
   }
 }
 if(top==='fieldshirt'){
   // Button-up field shirt: pointed collar, placket with buttons, two chest pockets with camouflage
   // panels and flaps, a name tape and patches. Generic insignia only; no real logos are reproduced.
   const btn=mat('#d9d2c2',0,.5),tape=mat('#1d1f20'),patchA=mat('#8a2f2a'),patchB=mat('#2f4f6f'),patchC=mat('#c9a23a');
   const flat=(name:string,size:number[],m:THREE.Material,x:number,y:number,lift:number,opts:MeshOptions={})=>{
     const [z,yaw]=onChest(x,y,lift,.118*build+lift);
     // Camouflaged panels get extra vertices so the pattern, painted per vertex, can show.
     const [w,h,d]=size,g=opts.tint?new THREE.BoxGeometry(w,h,d,16,Math.max(2,Math.round(h/.006)),1):HD&&Math.min(w,h,d)>=.008?new RoundedBoxGeometry(w,h,d,2,Math.min(w,h,d)*.3):new THREE.BoxGeometry(w,h,d);
     const o=mesh(name,g,m,trunk,[x,y,z],wear,opts);o.rotation.y=yaw;if(HD)addChestPart(x,y,z,yaw,w,h,d);return o;
   };
   if(HD){
     tube('placket',chestBand(0,.011,.16,.49,.0012).map(([y,z])=>[0,y,z,.0016,.011] as Knot),seam,trunk,[0,0,0],6);
     const [bw,bd,bc]=torsoAt(.5);
     sweep('collar',[[.498,bw+.004,bd+.004,bc],[.515,(bw+.056)/2+.005,(bd+.058)/2+.005,bc/2],[.532,.057,.058]],cloth,trunk,[0,0,0],0,14);
     for(const side of [-1,1]){ // pointed collar leaves folded onto the chest
       const pts:[number,number][]=[[.018,.505],[.04,.487],[.062,.466],[.078,.447]];
       tube('collar-leaf',pts.map(([x,y],i)=>[side*x,y,onChest(side*x,y,.003,0)[0],.0025,.026-i*.006] as Knot),cloth,trunk,[0,0,0],6,true);
     }
   }else{
     box('placket',[.022,.33,.008],seam,trunk,[0,.322,.13*build]);
     for(const side of [-1,1]){const leaf=box('collar',[.08,.06,.018],cloth,trunk,[side*.055,.5,.085]);leaf.rotation.z=side*.5;}
   }
   for(const y of [.2,.26,.32,.38,.44])flat('button',[.009,.009,.005],btn,0,y,HD?.004:.006);
   for(const side of [-1,1]){
     const px=side*shoulder*(HD?.4:.46);
     // Right side of the wearer (-1): orange pocket with a camo flap; left (+1): camo pocket with an orange flap.
     flat('chest-pocket',[.088,.1,.012],side<0?cloth:camoMat,px,.355,.004,side<0?{}:{tint:camo});
     flat('pocket-flap',[.094,.028,.014],side<0?camoMat:cloth,px,.412,.008,side<0?{tint:camo}:{});
     flat('pocket-button',[.009,.009,.005],btn,px,.405,.016);
   }
   flat('name-tape',[.075,.016,.006],tape,shoulder*(HD?.4:.46),.445,.005);
   flat('patch',[.028,.028,.005],patchA,-shoulder*(HD?.4:.46),.448,.005);
   flat('patch',[.022,.022,.005],patchC,-shoulder*(HD?.4:.46)+.034,.448,.005);
 }
 if(top==='jacket'||top==='hoodie'){
   const zipMat=top==='jacket'?metal:seam;
   if(HD){
     // Zipper as a thin strip lying on the shirt at every height; knots are [x,y,z,depth,halfWidth].
     tube('zipper',chestBand(0,.004,.16,.49,.0015).map(([y,z])=>[0,y,z,.0018,.0042] as Knot),zipMat,trunk,[0,0,0],6);
     box('zipper-pull',[.009,.02,.004],zipMat,trunk,[0,.455,onChest(0,.455,.004,0)[0]]);
   }else box('zipper',[.009,.33,.008],zipMat,trunk,[0,.322,onChest(0,.322,.003,.13*build)[0]]);
   if(top==='jacket'&&HD){
     // Stand collar: hugs the base of the neck and settles on the shoulder slope instead of floating.
     const [bw,bd,bc]=torsoAt(.5);
     sweep('collar',[[.498,bw+.004,bd+.004,bc],[.52,(bw+.056)/2+.006,(bd+.058)/2+.006,bc/2],[.545,.058,.059],[.556,.056,.057]],seam,trunk,[0,0,0],0,14);
     // Lapels: flat bands folded down onto the chest, following its curve.
     for(const side of [-1,1]){
       const pts:[number,number][]=[[.03,.5],[.048,.482],[.064,.463],[.076,.448]];
       tube('lapel',pts.map(([x,y],i)=>[side*x,y,onChest(side*x,y,.003,0)[0],.0025,.024-i*.004] as Knot),seam,trunk,[0,0,0],6,true);
     }
   }
   if(top==='jacket')for(const side of [-1,1]){
     const px=side*shoulder*(HD?.4:.46),[pz,yaw]=onChest(px,.365,.004,.116*build);
     box('chest-pocket',[.085,.093,.018],seam,trunk,[px,.365,pz],wear).rotation.y=yaw;addChestPart(px,.365,pz,yaw,.085,.093,.018);
     const fz=onChest(px,.408,.007,.119*build)[0];
     box('pocket-flap',[.091,.023,.021],cloth,trunk,[px,.408,fz],wear).rotation.y=yaw;addChestPart(px,.408,fz,yaw,.091,.023,.021);
     if(!HD){const lapel=box('collar',[.09,.075,.02],seam,trunk,[side*.063,.497,.085]);lapel.rotation.z=side*.42;}
     const bz=onChest(px,.40,.016,.135*build)[0];
     box('pocket-button',[.012,.012,.01],metal,trunk,[px,.40,bz]).rotation.y=yaw;addChestPart(px,.40,bz,yaw,.012,.012,.01);
   }
   if(top==='hoodie'){
     if(HD){
       // Hood lying on the back: a shell hugging the torso (thick near the neck, tapering to a rounded
       // point), squashed flat under a backpack, plus a rolled rim around the neck that opens at the front.
       const flatten=spec.outfit.backpack?.3:1,y0=.33,y1=.515,rows=14,cols=16,p:number[]=[],ix:number[]=[];
       const at=(u:number,v:number,out:boolean)=>{
         const y=y0+(y1-y0)*v,half=.095*Math.sqrt(Math.max(0,v*(2-v))),x=u*half,[w,d,c]=torsoAt(y);
         const k=Math.min(.985,Math.abs(x)/w),back=c-d*Math.sqrt(1-k*k);
         const th=out?(.004+.026*Math.pow(Math.max(0,1-u*u),.6)*Math.sqrt(v))*flatten:.001;
         return [x,y,back-.003-th];
       };
       for(const out of [true,false])for(let i=0;i<=rows;i++)for(let j=0;j<=cols;j++)p.push(...at(-1+2*j/cols,i/rows,out));
       const N=(rows+1)*(cols+1),id=(o:number,i:number,j:number)=>o*N+i*(cols+1)+j;
       for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){
         const a=id(0,i,j),b=id(0,i+1,j),c=id(0,i,j+1),d=id(0,i+1,j+1);ix.push(a,c,b,b,c,d);
         const e=id(1,i,j),f=id(1,i+1,j),g=id(1,i,j+1),h=id(1,i+1,j+1);ix.push(e,f,g,f,h,g);
       }
       for(let j=0;j<cols;j++){const a=id(0,rows,j),b=id(0,rows,j+1),c=id(1,rows,j),d=id(1,rows,j+1);ix.push(a,b,c,b,d,c);} // closed top edge
       for(let i=0;i<rows;i++)for(const j of [0,cols]){const a=id(0,i,j),b=id(0,i+1,j),c=id(1,i,j),d=id(1,i+1,j);if(j)ix.push(a,b,c,b,d,c);else ix.push(a,c,b,b,c,d);}
       const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(ix);
       const fold=(_x:number,y:number)=>.9+.1*THREE.MathUtils.smoothstep(y,y0,y1); // the lower tip sits in its own shade
       const shell=mesh('hood',g,cloth,trunk,[0,0,0],wear,{tint:fold});(shell.material as THREE.MeshStandardMaterial).side=THREE.DoubleSide;
       const rim:Knot[]=[];
       for(let k=0;k<=16;k++){
         const a=.36+(2*Math.PI-.72)*k/16,y=.482+.036*(1-Math.cos(a))/2,[w,d,c]=torsoAt(Math.min(y,.52));
         const r=Math.max(w,.06)+.006,rz=Math.max(d,.058)+.006;rim.push([Math.sin(a)*r,y,c+Math.cos(a)*rz,.0095,.0095]);
       }
       tube('hood-rim',rim,cloth,trunk,[0,0,0],7,true,wear,{roundStart:true});
     }else ellipsoid('hood',[.102,.12,.076],cloth,trunk,[0,.50,-.074]);
     for(const side of [-1,1]){
       if(HD)tube('drawstring',[.495,.47,.44,.41,.38].map((y,i)=>[side*(.042+i*.002),y,onChest(side*(.042+i*.002),y,.0035,0)[0],.003,.003] as Knot),stitch,trunk,[0,0,0],6,true);
       else box('drawstring',[.006,.13,.009],stitch,trunk,[side*.054,.432,.112]);
     }
   }
 }
 if(top==='tank'&&!HD){
   // Skin patches create an open neckline and armhole impression without transparent geometry.
   ellipsoid('neckline',[.060,.064,.018],skin,trunk,[0,.494,.067]);
 }
 if(tankHD)for(const side of [-1,1]){
   // Straps run up the chest, over the shoulder and down the back, hugging the torso surface.
   const x=side*shoulder*.4,surface=(y:number,back:number)=>{const [w,d,c]=torsoAt(y),u=Math.min(.97,Math.abs(x)/w);return c+back*(d*Math.sqrt(1-u*u)+.004);};
   const front=[.44,.475,.50].map(y=>[x,y,surface(y,1),.005,.017] as Knot);
   tube('tank-strap',[...front,[x,.522,0,.005,.017],...front.reverse().map(([x,y]):Knot=>[x,y,surface(y,-1),.005,.017])],cloth,trunk,[0,0,0],6);
 }
 // Half-width, half-depth and centre of a built mesh at height y (its own frame), for parts that wrap it.
 const hug=(o:THREE.Mesh,y:number,tol=.012):[number,number,number]=>{
   const p=o.geometry.getAttribute('position');let w=0,z0=Infinity,z1=-Infinity;
   for(let i=0;i<p.count;i++)if(Math.abs(p.getY(i)-y)<tol){w=Math.max(w,Math.abs(p.getX(i)));z0=Math.min(z0,p.getZ(i));z1=Math.max(z1,p.getZ(i));}
   return z1>z0?[w,(z1-z0)/2,(z1+z0)/2]:[.05,.05,0];
 };
 // Tall laced boots: the shaft follows the trouser leg up to just under the knee and ends in a folded
 // cuff with a big buckle; laces cross all the way up the front through brass eyelets.
 const tallBoot=(suffix:string,shin:THREE.Object3D,laceTone:THREE.Material)=>{
   const leg=shin.children.find(o=>o.name==='shin'+suffix) as THREE.Mesh,top=-.08,rings:Ring[]=[];
   for(const y of [-legLower-.012,-legLower+.03,-legLower+.09,-legLower+.15,-.2,-.14,top]){const [w,d,c]=hug(leg,y);rings.push([y,w+.007,d+.007,c]);}
   sweep('boot-shaft'+suffix,rings,shoe,shin,[0,0,0],wear,HD?10:8);
   const [w,d,c]=hug(leg,top),cuffMat=mat(darker(spec.outfit.shoeColor,1.1)),brass=mat('#c29a48',.55,.45);
   sweep('boot-cuff'+suffix,[[top-.012,w+.006,d+.006,c],[top-.004,w+.017,d+.016,c],[top+.05,w+.027,d+.024,c+.002],[top+.058,w+.02,d+.018,c+.002]],cuffMat,shin,[0,0,0],wear,HD?10:8);
   if(!HD)return;
   // Buckle on the front of the cuff: a strap and an oval brass frame.
   box('boot-cuff-strap',[.022,.05,.006],shoe,shin,[0,top+.022,c+d+.028]);
   const frame=mesh('boot-cuff-buckle',new THREE.TorusGeometry(.013,.0028,5,12),brass,shin,[0,top+.024,c+d+.032]);frame.scale.set(1,1.3,1);
   box('boot-cuff-pin',[.002,.03,.004],brass,shin,[0,top+.024,c+d+.034]);
   // Zig-zag lacing: two tubes out of phase cross between the eyelet rows.
   const front=(x:number,y:number)=>{const [lw,ld,lc]=hug(leg,y);return lc+(ld+.007)*Math.sqrt(Math.max(0,1-(x/(lw+.007))**2))+.002;};
   const y0=-legLower+.03,y1=top-.02,rows=9,X=.011;
   for(const phase of [0,1]){
     const knots:Knot[]=[];
     for(let i=0;i<=rows;i++){const y=y0+(y1-y0)*i/rows,x=((i+phase)%2?1:-1)*X;knots.push([x,y,front(x,y),.0017,.0017]);}
     tube('boot-lace'+suffix,knots,laceTone,shin,[0,0,0],4);
   }
   for(let i=0;i<=rows;i++)for(const x of [-X-.004,X+.004]){const y=y0+(y1-y0)*i/rows;ellipsoid('boot-eyelet'+suffix,[.0028,.0028,.0018],brass,shin,[x,y,front(x,y)],4);}
   // Bow at the top: two loops and two hanging ends.
   for(const sx of [-1,1]){
     const loop=mesh('boot-lace-bow'+suffix,new THREE.TorusGeometry(.009,.0016,4,10),laceTone,shin,[sx*.011,y1+.004,front(0,y1)+.003]);loop.rotation.set(0,sx*.3,sx*.5);
     tube('boot-lace-end'+suffix,[[sx*.003,y1,front(0,y1)+.002,.0016,.0016],[sx*.012,y1-.03,front(sx*.012,y1-.03)+.004,.0014,.0014]],laceTone,shin,[0,0,0],4);
   }
 };
 const gloves=!!spec.outfit.gloves,glove=gloves?mat('#3d2b23',0,.78):skin,gloveDark=gloves?mat('#2e211b',0,.8):skin,handSkin=gloves?glove:skin;
 const legs:any[]=[],arms:any[]=[];
 const upperLen=.30,foreLen=.265,legUpper=.44,legLower=.40;
 for(const side of [-1,1]){
   const suffix=side<0?'R':'L';
   const thigh=group('upperLeg'+suffix,body,[side*hipX,0,0]),shin=group('lowerLeg'+suffix,thigh,[0,-legUpper,0]),foot=group('foot'+suffix,shin,[0,-legLower,0]);
   const wide=legWide,shorts=spec.outfit.pants==='shorts',hipTop:Ring[]=HD?[[.05,wide*.88,.084*build],[0,wide*.95,.088*build]]:[];
   sweep('thigh'+suffix,[...hipTop,...(shorts?[[0,wide,.090*build],[-.10,wide*1.03,.090*build],[-.29,wide*.80,.075*build],[-.32,wide*.79,.074*build]]:[[0,wide,.090*build],[-.10,wide*1.03,.090*build],[-.30,wide*.76,.071*build],[-legUpper,wide*.67,.063*build]]).slice(HD?1:0)] as Ring[],briefs?skin:pants,thigh,[0,0,0],briefs?0:wear);
   // Briefs: the leg openings wrap the top of each thigh, a little wider than it.
   if(briefs)sweep('briefs-leg'+suffix,[[.05,wide*1.01,.093*build],[0,wide*1.05,.096*build],[-.045,wide*1.06,.095*build]],pants,thigh,[0,0,0],0,HD?12:10);
   // Hip joint: a ball that turns with the thigh and fills the seam with the pelvis at any stride.
   if(HD)ellipsoid('hip-joint'+suffix,[wide*.9,wide*1.02,.088*build],pants,thigh,[side*.002,-.006,-.004],7);
   // The top of the thigh and the joint ball stay a little inside the pelvis: equal widths made the two
   // surfaces coincide at the sides of the hips and flicker in a jagged band.
   const bareLeg=shorts||briefs;
   ellipsoid('knee'+suffix,[wide*.68,.063,.063*build],bareLeg?skin:pants,shin,[0,0,0],HD?7:10);
   sweep('shin'+suffix,HD
     ?[[0,wide*.67,.06*build],[-.09,wide*.74,.066*build,-.006],[-.2,wide*.62,.056*build,-.003],[-.30,.049,.049],[-legLower,.045,.044]]
     :[[0,wide*.67,.06*build],[-.11,wide*.74,.062*build],[-.30,.049,.049],[-legLower,.045,.044]],bareLeg?skin:pants,shin,[0,0,0],bareLeg?0:wear);
   if(shorts){ // End the shorts above the knee; exposed lower thigh is a separate visible surface.
     sweep('shorts-hem'+suffix,[[-.29,wide*.82,.076*build],[-.32,wide*.79,.074*build]],seam,thigh);
     sweep('exposed-knee'+suffix,[[-.29,wide*.74,.068*build],[-.44,wide*.70,.065*build]],skin,thigh);
   }
   if(spec.outfit.pants==='cargo'){
     // HD: a thin pocket lying on the side of the thigh (the thigh is ~0.9 of its top width there).
     const pw=HD?wide*.9:wide;
     box('cargo-pocket'+suffix,HD?[.016,.11,.085]:[.042,.125,.105],pants,thigh,[side*(pw+(HD?.006:.004)),-.19,.005],wear);
     box('cargo-flap'+suffix,HD?[.02,.022,.09]:[.05,.024,.11],seam,thigh,[side*(pw+(HD?.009:.008)),-.137,.005]);
   }
   const tall=spec.outfit.shoes==='tallboots',heels=spec.outfit.shoes==='heels',boots=spec.outfit.shoes==='boots'||spec.outfit.shoes==='wornBoots'||tall,socks=spec.outfit.shoes==='socks';
   const barefoot=spec.outfit.shoes==='barefoot'||(spec.outfit.shoes==='singleSneakerLeft'&&side<0)||(spec.outfit.shoes==='singleSneakerRight'&&side>0);
   const wornSock=spec.profession==='zumbi'&&(barefoot||socks),sockMaterial=wornSock?mat('#92917c'):shoe;
   if(barefoot&&!wornSock){
     tube('bare-foot'+suffix,[[0,-.027,-.035,.036,.031],[0,-.035,.015,.045,.033],[0,-.043,.065,.055,.027],[0,-.047,.113,.061,.025],[0,-.052,.145,.057,.02]],skin,foot,[0,0,0],8,true,0,{lateral:true,roundStart:true});
     for(let toe=0;toe<5;toe++)ellipsoid('bare-toe'+suffix,[.013-toe*.0013,.019,.027-toe*.002],skin,foot,[side*(toe-2)*.020,-.070,.163-toe*.005],HD?8:6);
   }else if(heels){
     // A compact pump: visible heel stem, raised sole and a low vamp that leaves the ankle exposed.
     // Every part is parented to the foot, so the shoe bends cleanly with walk and run animation.
     const heelSole=mat('#17151d',0,.7),heelTrim=mat('#9b4555',.1,.52);
     const sole=box('heel-sole'+suffix,[.081,.012,.205],heelSole,foot,[0,-.079,.058]);
     sole.rotation.x=-.05;
     ellipsoid('heel-vamp'+suffix,[.043,.024,.091],shoe,foot,[0,-.052,.069],HD?8:6);
     ellipsoid('heel-toe'+suffix,[.036,.018,.040],shoe,foot,[0,-.066,.158],HD?8:6);
     // The narrow vertical stem sits behind the ankle, ending on the same ground line as the sole.
     sweep('heel-stem'+suffix,[[-.081,.011,.014],[-.024,.013,.016]],heelSole,foot,[0,0,-.052],0,HD?8:6);
     ellipsoid('heel-tip'+suffix,[.016,.007,.018],heelSole,foot,[0,-.083,-.052],HD?6:5);
     sweep('heel-ankle-strap'+suffix,[[-.006,.050,.049],[.012,.052,.051]],heelTrim,shin,[0,-legLower,0],0,HD?10:8);
   }else if(socks||wornSock){
     const ground=-.0895,S=THREE.MathUtils.smoothstep;
     // A socked foot: the trainer's profile (same heel, which keeps the sweep upright), but lower,
     // narrower and a little shorter, resting straight on the ground.
     const shoeLine:[number,number,number][]=[[-.046,.018,.024],[-.036,.024,.038],[-.024,.027,.045],[-.008,.027,.047],[.01,.022,.048],[.03,.013,.05],[.06,-.003,.055],[.09,-.016,.058],[.12,-.025,.059],[.145,-.031,.056],[.165,-.036,.049],[.178,-.041,.037]];
     const bottom=ground+.002,sockFoot=shoeLine.map(([z,t,w]):[number,number,number]=>[z*.93,Math.max(t-.022,bottom+.022),w*.86]);
     const knot=([z,t,w]:[number,number,number]):Knot=>[0,(t+bottom)/2,z,w,(t-bottom)/2];
     const dirt=(_x:number,y:number)=>1-.42*(1-S(y,ground+.004,ground+.02));
     if(HD)tube('sock'+suffix,sockFoot.map(knot),sockMaterial,foot,[0,0,0],8,true,wornSock?wear:0,{tint:dirt,lateral:true,roundStart:true});
     else box('sock'+suffix,[.09,.1,.21],sockMaterial,foot,[0,-.04,.05],wornSock?wear:0);
     // Clearly outside the shin at every height, so the two surfaces never fight.
     sweep('sock-cuff'+suffix,HD?[[-.012,.05,.049],[.05,.053,.052],[.1,.056,.055],[.112,.0565,.0555]]:[[-.01,.05,.049],[.11,.055,.054]],sockMaterial,shin,[0,-legLower,0],wornSock?wear:0,8);
     if(HD)sweep('sock-rib'+suffix,[[.1,.0575,.0565],[.114,.0575,.0565]],wornSock?sockMaterial:mat(darker(spec.outfit.shoeColor,.9)),shin,[0,-legLower,0],0,8);
   }else if(HD){
     // Cartoon low-poly footwear in separate chunky parts: thick two-layer sole, robust upper with a
     // round toe box, toe cap, contrasting heel counter and tongue, and 3-4 wide raised lace bars.
     // The foot's origin is the ankle; +Z is forward and the ground sits at y = -0.0895.
     const facet={crease:Math.PI*.14},ground=-.0895;
     const accent=mat(boots?darker(spec.outfit.shoeColor,.62):'#b3a584');
     const midsole=mat(boots?'#3b342c':'#c9bd9c',0,.95),outsole=mat(boots?'#1f1c19':'#8c8166',0,.95),laceTone=mat(tall?'#7a2330':boots?'#8f7c5c':'#d4cab0');
     // Footprint half-width along the foot: defined heel, narrower arch, wide ball, round toe.
     // The heel ends flush with the back of the ankle, so nothing sticks out behind the leg.
     const plan:[number,number][]=[[-.047,.02],[-.043,.034],[-.034,.042],[-.02,.045],[0,.044],[.03,.049],[.08,.06],[.125,.062],[.155,.057],[.176,.046],[.19,.03],[.197,.012],[.199,0]];
     const slab=(name:string,m:THREE.Material,y0:number,h:number,grow:number,outline=plan)=>{
       const shape=new THREE.Shape(),pts=[...outline.map(([z,w])=>[w+grow,z]),...[...outline].reverse().map(([z,w])=>[-(w+grow),z])];
       pts.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));
       const b=Math.min(.003,h/4),g=new THREE.ExtrudeGeometry(shape,{depth:h-2*b,bevelEnabled:true,bevelThickness:b,bevelSize:b,bevelSegments:1,curveSegments:1});
       g.rotateX(-Math.PI/2);g.translate(0,y0+b,0);return mesh(name,g,m,foot,[0,0,0],wear*.6,facet);
     };
     const outH=boots?.011:.007,midH=boots?.014:.02,soleTop=ground+outH+midH;
     slab('outsole'+suffix,outsole,ground,outH,.004);
     slab('sole'+suffix,midsole,ground+outH-.001,midH+.001,.002);
     // Upper: [z, top y, half-width]; the bottom is buried in the midsole so the widest part meets the sole.
     const upper:[number,number,number][]=[[-.046,.018,.024],[-.036,.024,.038],[-.024,.027,.045],[-.008,.027,.047],[.01,.022,.048],[.03,.013,.05],[.06,-.003,.055],[.09,-.016,.058],[.12,-.025,.059],[.145,-.031,.056],[.165,-.036,.049],[.178,-.041,.037]];
     const bottom=soleTop-.018,knot=([z,t,w]:[number,number,number],grow=0):Knot=>[0,(t+bottom)/2,z,w+grow,(t-bottom)/2+grow];
     // Heel sections keep a nearly level centre line: a steep one tilts the end ring and pushes it out behind.
     // A smooth oval upper: no ridges and no painted tongue, only a slightly lighter toe cap.
     const topAt=(z:number)=>{let k=0;while(k<upper.length-2&&upper[k+1][0]<z)k++;const [z0,y0]=upper[k],[z1,y1]=upper[k+1];return y0+(y1-y0)*(z-z0)/(z1-z0);};
     const toeCap=(_x:number,_y:number,z:number)=>1+THREE.MathUtils.smoothstep(z,.1,.12)*.14;
     const shoeMesh=tube('shoe'+suffix,upper.map(u=>knot(u)),shoe,foot,[0,0,0],8,true,wear,{tint:toeCap,lateral:true});
     // Actual height of the built upper along its centre line (the smoothed sweep sits above the design line).
     const sp=shoeMesh.geometry.getAttribute('position'),ridge:[number,number][]=[];
     for(let i=0;i<sp.count;i++)if(Math.abs(sp.getX(i))<.006)ridge.push([sp.getZ(i),sp.getY(i)]);
     const surfaceAt=(z:number)=>{let best=-1;for(const [rz,ry] of ridge)if(Math.abs(rz-z)<.006)best=Math.max(best,ry);return best>-1?best:topAt(z);};
     // Lace bars lie flat on the instep, following its slope.
     const onInstep=(name:string,size:number[],m:THREE.Material,z:number,lift:number)=>{
       const tilt=Math.atan2(surfaceAt(z-.01)-surfaceAt(z+.01),.02),o=box(name,size,m,foot,[0,surfaceAt(z)+lift*Math.cos(tilt),z+lift*Math.sin(tilt)]);o.rotation.x=tilt;return o;
     };
     for(let j=0;j<3;j++)onInstep('lace'+suffix,[.05,.004,.012],laceTone,.02+j*.024,.0015);
     if(boots){
       // Ankle joint: the lower cuff belongs to the foot and the shaft to the shin; both are round around
       // the ankle pivot, so when the foot turns relative to the leg they slide over each other without gaps.
       sweep('boot-ankle'+suffix,[[-.035,.045,.045],[0,.047,.046],[.014,.046,.045]],shoe,foot,[0,0,0],wear,8);
       if(tall)tallBoot(suffix,shin,laceTone);
       else{
       sweep('boot-shaft'+suffix,[[-.012,.0505,.0495],[.03,.053,.052],[.09,.06,.058],[.14,.062,.058]],shoe,shin,[0,-legLower,0],wear,8);
       sweep('boot-collar'+suffix,[[.126,.066,.063],[.152,.066,.063]],accent,shin,[0,-legLower,0],0,8);
       // Lacing continues up the front of the shaft, parented to the shin so it follows the leg.
       for(let j=0;j<3;j++){const l=box('lace'+suffix,[.046,.008,.012],laceTone,shin,[0,-legLower+.035+j*.03,.063]);l.rotation.x=.12;}
       }
     }
   }else{
     box('shoe'+suffix,[.126,.125,.25],shoe,foot,[0,-.014,.053],wear);
     box('sole'+suffix,[.133,.027,.261],sole,foot,[0,-.076,.053]);
     if(boots)sweep('boot-shaft'+suffix,tall?[[-.04,.066,.064],[.14,.060,.057],[.27,.068,.066],[.31,.075,.072]]:[[-.04,.066,.064],[.14,.060,.057]],shoe,shin,[0,-legLower,0],wear);
     else box('sneaker-toe'+suffix,[.128,.032,.073],stitch,foot,[0,-.012,.15]);
     for(let j=0;j<3;j++)box('lace'+suffix,[.06,.005,.009],boots?seam:stitch,foot,[0,.052,.015+j*.027]);
   }
   // Ankle ball on the shin fills the gap above the shoe opening when the foot turns.
   if(HD)ellipsoid('ankle'+suffix,boots?[.046,.046,.045]:socks||wornSock?[.048,.047,.047]:[.043,.045,.043],wornSock?sockMaterial:barefoot?skin:boots||socks?shoe:bareLeg?skin:pants,shin,[0,-legLower,0],6);
   legs.push({thigh,shin,foot,side});
   const arm=group('upperArm'+suffix,trunk,[side*armX,armY,0]);
   const elbow=group('lowerArm'+suffix,arm,[0,-upperLen,0]);
   const wrist=group('hand'+suffix,elbow,[0,-foreLen,0]);
   const armR=.063*build;
   const zombieSleeve=spec.profession==='zumbi'&&['jacket','hoodie','fieldshirt'].includes(top),cutSleeve=top==='tshirt'||zombieSleeve;
   // HD: the deltoid is the domed top of the arm itself, so there is no ball or crease at the shoulder.
   const dome:Ring[]=HD?[[.05,armR*.3,armR*.34],[.04,armR*.74,armR*.78],[.022,armR*.97,armR*.99],[0,armR*1.04,armR*1.04]]:[];
   if(!HD)ellipsoid('shoulder'+suffix,[armR,.074,armR],sleeve,arm,[0,0,0]);
   const bicep:Ring[]=HD?[...dome,[-.09,armR*1.01,armR*1.02,.003],[-.19,armR*.88,armR*.89],[-upperLen,armR*.73,armR*.76]]:[[0,armR,armR],[-.13,armR*.96,armR*.94],[-upperLen,armR*.73,armR*.76]];
   sweep('upper-arm'+suffix,cutSleeve?[...(HD?dome:[[0,armR,armR] as Ring]),[-.10,armR*.98,armR*.98],[-.14,armR*.96,armR*.95],[-.155,armR*.95,armR*.94]]:bicep,sleeve,arm,[0,0,0],top==='tank'?0:wear);
   const shortSleeve=cutSleeve||top==='tank'||bare||painter||engineer||nightshift||top==='lumber';
   if(painter)sweep('painter-rolled-cuff'+suffix,[[-upperLen+.045,armR*.96,armR*.98],[-upperLen+.005,armR*.99,armR],[-upperLen-.022,armR*.91,armR*.93]],ivory,arm);
   if(cutSleeve)sweep('bare-upper-arm'+suffix,HD?[[-.125,armR*.90,armR*.90],[-.21,armR*.84,armR*.85],[-upperLen,armR*.78,armR*.79]]:[[-.125,armR*.90,armR*.90],[-upperLen,armR*.78,armR*.79]],skin,arm);
   const foreMat=shortSleeve?skin:cloth;
   // Engenheira: sleeves rolled to just below the elbow in a thick cuff that turns with the forearm.
   if(engineer)sweep('rolled-sleeve'+suffix,[[.03,armR*.8,armR*.82],[.012,armR*.95,armR*.97],[-.028,armR*.98,armR],[-.056,armR*.9,armR*.92],[-.066,armR*.78,armR*.8]],ivory,elbow,[0,0,0],0);
   if(nightshift)sweep('nightshift-sleeve-cuff'+suffix,[[-upperLen+.025,armR*.78,armR*.8],[-upperLen-.006,armR*.84,armR*.86]],mat('#7d2c3d'),arm,[0,0,0],0,HD?10:8);
   ellipsoid('elbow'+suffix,[armR*.78,.048,armR*.8],foreMat,elbow,[0,0,0],HD?7:10);
   // HD wrist: [halfWidth X, halfDepth Z]. Bare forearms taper to the wrist the hand starts from;
   // sleeves stay a little looser and end in a cuff that covers the joint.
   const wristW=.021,wristD=.03;
   const forearm:Ring[]=!HD?[[0,armR*.77,armR*.80],[-.09,armR*.78,armR*.8],[-foreLen,.035,.039]]
     :shortSleeve?[[0,armR*.77,armR*.8],[-.07,armR*.8,armR*.83],[-.16,armR*.6,armR*.68],[-foreLen+.02,wristW*1.08,wristD*1.04],[-foreLen+.004,wristW,wristD]]
     :[[0,armR*.77,armR*.8],[-.07,armR*.8,armR*.83],[-.16,armR*.66,armR*.72],[-foreLen,wristW+.011,wristD+.009]];
   sweep('forearm'+suffix,forearm,foreMat,elbow,[0,0,0],shortSleeve?0:wear);
   if(!shortSleeve)sweep('cuff'+suffix,HD?[[-foreLen+.022,wristW+.013,wristD+.011],[-foreLen+.002,wristW+.013,wristD+.011]]:[[-foreLen+.025,.039,.043],[-foreLen,.039,.043]],seam,elbow);
   if(HD){
     // Palm faces the thigh, thumb forward; fingers curl toward the palm (inward = -side).
     // The hand is sculpted in its own frame, scaled up for readability; its first ring is divided
     // by the scale so that, once scaled, it still matches the forearm's wrist exactly.
     const HS=1.15,hand=new THREE.Group();hand.name='hand-shape';hand.scale.setScalar(HS);wrist.add(hand);
     const fingersGroup=group('hand-fingers'+suffix,hand,[0,0,0]);
     // Knots are [x,y,z,halfDepth Z,halfWidth X]: the first matches the wrist, then the palm widens.
     tube('hand-mesh'+suffix,[[0,.012,0,wristD/HS,wristW/HS],[0,0,.001,wristD/HS*1.03,wristW/HS*.98],[0,-.022,.002,.035,.018],[0,-.045,.003,.04,.0165],[0,-.054,.002,.039,.0145],[0,-.064,.002,.032,.0112],[0,-.07,.002,.026,.009]],handSkin,hand,[0,0,0],8);
     // Fingers: three phalanges that bend a little more at each joint (the pinky curls most),
     // start inside the palm with its thickness and sit side by side. Back of the hand = +side X.
     // [z, length, half-width Z, half-thickness X, curl]
     const nail=mat('#'+new THREE.Color(spec.appearance.skin).lerp(new THREE.Color('#f0cfc4'),.22).getHexString(),0,.45);
     const fingers:[number,number,number,number,number][]=[[.0245,.058,.0088,.0108,.9],[.0085,.065,.0092,.0115,1],[-.0075,.06,.0089,.011,1.1],[-.0225,.049,.0079,.0098,1.3]];
     const handSide=side<0?'right':'left';
     for(const [fingerIndex,[z,len,w,t,c]] of fingers.entries()){
       const y0=-.064,bend=(k:number)=>-side*k*c;
       // A closed hand is modelled as four curved digits wrapping forward over a
       // handle, not as the former rigid hand-scale trick that left fingers dangling.
       // A real arc around the palm: unlike a linear X displacement, this preserves
       // the digit's apparent length while successively turning each phalanx inward.
       const radius=len/2.42,arc=(angle:number,depth:number):Knot=>[-side*radius*(1-Math.cos(angle))*c,-.057-radius*Math.sin(angle),z+depth,w*.9,t*.84];
       const closedKnots:Knot[]=[[0,-.057,z,w*1.02,t*1.04],arc(.34,.001),arc(.92,.003),arc(1.62,.004),arc(2.42,.004)];
       const openKnots:Knot[]=[[0,-.057,z,w*1.02,t*1.04],[bend(.0005),y0-len*.3,z,w*.98,t*.95],[bend(.003),y0-len*.58,z*.99,w*.93,t*.88],[bend(.008),y0-len*.8,z*.97,w*.87,t*.8],[bend(.0135),y0-len*.93,z*.96,w*.82,t*.74]];
       const curl=spec.items.grip[handSide][fingerIndex+1],knots=openKnots.map((row,i)=>row.map((v,j)=>v+(closedKnots[i][j]-v)*curl) as Knot);
       tube('finger'+suffix,knots,handSkin,fingersGroup,[0,0,0],6,true);
       // Knuckle on the back of the hand and a flat nail near the fingertip.
       ellipsoid('knuckle'+suffix,[t*.5,.009,w*.85],handSkin,fingersGroup,[side*t*.42,-.062,z],6);
       const [nx,ny,nz]=knots[knots.length-1],[px,py]=knots[knots.length-2],tilt=Math.atan2(nx-px,py-ny);
       if(!gloves){const n=ellipsoid('nail'+suffix,[.0018,.0065,w*.6],nail,fingersGroup,[nx+side*t*.6,ny+.003,nz],5);n.rotation.z=-tilt;}
     }
     // The thumb has its own subtle inward slide. It must not coil or mimic the
     // finger curl: the slider merely settles it a little closer to the palm.
     const openThumb:Knot[]=[[-side*.004,-.012,.021,.0118,.0118],[-side*.008,-.03,.036,.0108,.0104],[-side*.01,-.046,.047,.0095,.009],[-side*.008,-.061,.055,.0085,.0078],[-side*.006,-.066,.059,.0076,.0068]];
     const closedThumb:Knot[]=[[-side*.004,-.012,.021,.0118,.0118],[-side*.009,-.029,.037,.0108,.0104],[-side*.012,-.042,.049,.0095,.009],[-side*.014,-.052,.058,.0085,.0078],[-side*.013,-.056,.062,.0076,.0068]];
     const thumb=openThumb.map((row,i)=>row.map((v,j)=>v+(closedThumb[i][j]-v)*spec.items.grip[handSide][0]) as Knot);
     tube('thumb'+suffix,thumb,handSkin,fingersGroup,[0,0,0],6,true);
   }else{
     ellipsoid('hand-mesh'+suffix,[.037,.068,.024],handSkin,wrist,[0,-.044,.003]);
     ellipsoid('thumb'+suffix,[.016,.036,.019],handSkin,wrist,[-side*.029,-.022,.013],8);
   }
   if(gloves){
     // Leather gloves: the cuff is wrapped in three slanted straps over the wrist.
     for(let k=0;k<(HD?3:1);k++){
       const g=group('glove-wrap'+suffix,elbow,[0,-foreLen+.005+k*.011,0]);g.rotation.x=(k%2?-1:1)*.12;
       sweep('glove-wrap'+suffix,[[.0055,wristW+.004+k*.002,wristD+.004+k*.002],[-.0055,wristW+.0045+k*.002,wristD+.0045+k*.002]],k%2?glove:gloveDark,g,[0,0,0],0,HD?10:8);
     }
   }
   if(top==='fieldshirt'&&side>0){ // shoulder patch on the left sleeve
     const p=box('sleeve-patch',[.006,.042,.036],mat('#2f4f6f'),arm,[side*(armR*1.0),-.08,.004]);p.rotation.z=side*.06;
   }
   const socket=group('socket-hand'+suffix,wrist,[0,HD?-.069:-.060,0]);sockets['hand'+suffix]=socket;
   arms.push({arm,elbow,wrist,side});
 }
 const back=group('socket-back',trunk,[0,.35,-depth-.035]);sockets.back=back;
 sockets.head=group('socket-head',head,[0,.28,0]);sockets.belt=group('socket-belt',trunk,[hip,.14,0]);
 if(spec.items.object!=='none'&&spec.items.object!=='invisible'){
   const source=spec.items.object==='custom'?spec.items.recipe!:presetObject(spec.items.object);
   const interaction=source.interaction!;
   // A two-handed item is rooted in the right hand, giving the tool one stable
   // transform while the pose brings the other hand onto the same handle.
   const host=sockets[spec.items.placement==='left'?'handL':'handR'];
   const linked=createObject(source,{detail:detail==='low'?'low':'high'});
   if(spec.items.object==='axe')linked.root.traverse(o=>{if(o instanceof THREE.Mesh&&o.name==='Lâmina')o.userData.woodCuttingBlade=true;});
   const item=group('item-'+spec.items.object,host,[.0+spec.items.offset[0],.012+spec.items.offset[1],.004+spec.items.offset[2]]);
   item.userData.interaction={object:spec.items.object,placement:spec.items.placement,action:interaction.action};
   item.add(linked.root);
   const grip=linked.sockets.grip;
   linked.root.scale.setScalar(spec.items.scale);
   // Scale around the actual grip so changing size never pulls the handle away
   // from the hand socket.
   if(grip)linked.root.position.copy(grip.position).multiplyScalar(-spec.items.scale);
   // The object's grip socket is placed exactly at the hand. The axe shaft then
   // passes through the palm instead of floating below it; its diagonal is chosen
   // to run naturally from the right hand to the left one in a two-hand hold.
   if(spec.items.object==='axe')item.rotation.set(0,0,spec.items.placement==='both'?-1.05:spec.items.placement==='left'?.38:-.38);
   else if(spec.items.object==='lantern'){item.rotation.set(Math.PI,0,0);linked.root.position.y-=.02;}
   else if(spec.items.object==='canteen'){item.rotation.set(0,0,.35);linked.root.position.y-=.10;}
   item.rotation.x+=spec.items.rotation[0]*Math.PI/180;item.rotation.y+=spec.items.rotation[1]*Math.PI/180;item.rotation.z+=spec.items.rotation[2]*Math.PI/180;
   linkedItemDisposers.push(linked.dispose);
 }
 if(spec.outfit.backpack){
   bevelBox('backpack',[.26,.34,.16],pack,back,[0,0,-.055]);
   bevelBox('backpack-pocket',[.21,.18,.044],seam,back,[0,-.052,-.154]);
   box('pack-lid',[.275,.04,.166],pack,back,[0,.169,-.055]);
   const packFront=-depth-.01,packTop=.35+.17,packBottom=.35-.17;
   for(const side of [-1,1]){
     box('pack-webbing',[.025,.28,.018],dark,back,[side*.078,-.016,-.18]);
     if(!HD){
       const sx=side*.13;
       box('backpack-strap',[.036,.32,.018],dark,trunk,[sx,.35,.13*build]);
       box('strap-buckle',[.041,.023,.022],metal,trunk,[sx,.31,.143*build]);
       continue;
     }
     // Shoulder strap: a band lying on the torso that climbs the chest, rolls over the shoulder
     // and runs down the back into the top of the pack. Knots are [x,y,z,thickness,halfWidth].
     const sx=side*.105,lift=.006,T=.0045,W=.017;
     const onSurface=(y:number,back:number):Knot=>{const [w,d,c]=torsoAt(y),u=Math.min(.985,Math.abs(sx)/(w+lift));return [sx,y,c+back*(d+lift)*Math.sqrt(1-u*u),T,W];};
     let crest=.47;while(crest<.534&&torsoAt(crest+.002)[0]+lift>Math.abs(sx)*1.02)crest+=.002;
     // Front run: follows the chest, the bust and any pocket under the strap, sampled every centimetre.
     const frontRun=chestBand(sx,W*.9,.25,crest-.012,lift+T*.5);
     const up=frontRun.map(([y,z])=>[sx,y,z,T,W] as Knot);
     const strapZ=(y:number)=>{let i=0;while(i<frontRun.length-2&&frontRun[i+1][0]<y)i++;const [y0,z0]=frontRun[i],[y1,z1]=frontRun[i+1];return z0+(z1-z0)*(y-y0)/(y1-y0);};
     const over:Knot[]=[onSurface(crest-.006,1),[sx,crest+lift+.004,torsoAt(crest)[2],T,W],onSurface(crest-.006,-1)];
     const down=[.46,.43].filter(y=>y<crest-.012).map(y=>onSurface(y,-1));
     const [,dy,dz]=down[down.length-1];
     tube('backpack-strap',[...up,...over,...down,[sx*.96,dy-.02,Math.min(dz-.012,packFront-.015),T,W]],dark,trunk,[0,0,0],6);
     // Lower strap: from the chest buckle around the ribs, under the arm, to the bottom of the pack.
     const [w0,d0,c0]=torsoAt(.25),a0=Math.asin(Math.min(.985,Math.abs(sx)/(w0+lift)));
     const lower:Knot[]=[];
     for(let k=0;k<=6;k++){
       const t=k/6,a=a0+(Math.PI*.82-a0)*t,y=.25-.05*t,[w,d,c]=torsoAt(y);
       lower.push([side*Math.sin(a)*(w+lift),y,c+Math.cos(a)*(d+lift),T,W*.85]);
     }
     const [lx,ly]=lower[lower.length-1];
     tube('strap-lower',[...lower,[lx*.9,Math.max(ly-.01,packBottom+.02),packFront-.02,T,W*.85]],dark,trunk,[0,0,0],6);
     const byaw=onChest(sx,.255,0,0)[1];
     const buckle=box('strap-buckle',[.041,.026,.012],metal,trunk,[sx,.255,strapZ(.255)+.006]);buckle.rotation.y=byaw;
     box('strap-adjuster',[.038,.012,.008],metal,trunk,[sx,.37,strapZ(.37)+.006]).rotation.y=onChest(sx,.37,0,0)[1];
   }
 }
 // Tailored polygon panels follow the shirt surface instead of floating in front of it.
 const panel=(name:string,points:number[][],material:THREE.Material,lift=.009)=>{
   const contour=points.map(([x,y])=>new THREE.Vector2(x,y)),indices=THREE.ShapeUtils.triangulateShape(contour,[]).flat();
   const vertices:number[]=[];
   const triangle=(a:THREE.Vector2,b:THREE.Vector2,c:THREE.Vector2,n:number)=>{
     if(n){const ab=a.clone().lerp(b,.5),bc=b.clone().lerp(c,.5),ca=c.clone().lerp(a,.5);triangle(a,ab,ca,n-1);triangle(ab,b,bc,n-1);triangle(ca,bc,c,n-1);triangle(ab,bc,ca,n-1);}
     else for(const p of [a,b,c])vertices.push(p.x,p.y,chestFront(p.x,p.y)+lift);
   };
   for(let i=0;i<indices.length;i+=3)triangle(contour[indices[i]],contour[indices[i+1]],contour[indices[i+2]],HD?3:2);
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.computeVertexNormals();
   (material as THREE.MeshStandardMaterial).side=THREE.DoubleSide;return mesh(name,g,material,trunk);
 };
 // Open shirt collar: a V of skin down to `bottom` (half-width `half` halfway down) between pointed collar
 // leaves spread over the chest, a darker rim to outline them and a collar standing behind the neck.
 const openCollar=(bottom:number,half:number)=>{
   const neckSkin=skin.clone();materials.add(neckSkin);
   panel('open-neckline',[[-.058,.537],[.058,.537],[half,(bottom+.537)/2+.012],[0,bottom],[-half,(bottom+.537)/2+.012]],neckSkin,.0025);
   // The top of the torso in front of the neck (the shoulder slope the V cannot reach) is skin too,
   // from the edge of the V up into the neck, between the two ends of the collar stand.
   {
     const rows=[.5,.51,.52,.53,.537,.546],na=HD?14:6,a0=1.2,v:number[]=[],ix:number[]=[];
     for(const y of rows)for(let i=0;i<=na;i++){
       const a=-a0+2*a0*i/na,[w,d,c]=y<=.535?torsoAt(y):[.0465,.0475,-.003];
       v.push(Math.sin(a)*(w+.0025),y,c+Math.cos(a)*(d+.0025));
     }
     for(let j=0;j<rows.length-1;j++)for(let i=0;i<na;i++){const a=j*(na+1)+i,b=a+na+1;ix.push(a,a+1,b,a+1,b+1,b);}
     const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setIndex(ix);g.computeVertexNormals();
     mesh('open-neck-skin',g,neckSkin,trunk);
   }
   const collarMat=mat('#f4efe6'),collarEdge=mat('#b9b0a1');
   for(const side of [-1,1]){
     const leaf=[[side*.046,.548],[side*.08,.535],[side*.114,.458],[side*.074,.47],[side*.046,.438],[side*.05,.49]];
     panel('open-collar',leaf,collarMat,.01);
     if(HD)tube('open-collar-edge',leaf.slice(1,5).map(([x,y]):Knot=>[x,y,chestFront(x,y)+.0105,.0012,.0012]),collarEdge,trunk,[0,0,0],4);
   }
   const v:number[]=[],ix:number[]=[],n=HD?16:8,a0=1.0;
   for(let i=0;i<=n;i++){const a=a0+(2*Math.PI-2*a0)*i/n;for(const [y,r] of [[.52,.056],[.552,.061]] as const)v.push(Math.sin(a)*r,y,-.004+Math.cos(a)*r);}
   for(let i=0;i<n;i++){const a=i*2;ix.push(a,a+2,a+1,a+1,a+2,a+3);}
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setIndex(ix);g.computeVertexNormals();
   mesh('open-collar-stand',g,collarMat,trunk);
 };
 if(painter){
   // Loosened tie: a shallow V opening that ends behind the knot.
   openCollar(.45,.03);
   const leather=mat('#503725'),gold=mat('#b8995c',.45,.6),tie=mat('#284746');
   const backVertices:number[]=[],backIndices:number[]=[];
   for(let j=0;j<=8;j++){const y=.16+j*.039,[w,d,c]=torsoAt(y);for(let i=0;i<=12;i++){const a=Math.PI/2+i*Math.PI/12;backVertices.push(Math.sin(a)*(w+.009),y,c+Math.cos(a)*(d+.009));}}
   for(let j=0;j<8;j++)for(let i=0;i<12;i++){const a=j*13+i;backIndices.push(a,a+13,a+1,a+1,a+13,a+14);}
   const backVest=new THREE.BufferGeometry();backVest.setAttribute('position',new THREE.Float32BufferAttribute(backVertices,3));backVest.setIndex(backIndices);backVest.computeVertexNormals();mesh('painter-waistcoat-back',backVest,cloth,trunk);
   for(const side of [-1,1]){
     const w=shoulder*.78;
     // Close the side seam with a curved gusset. Its scooped upper edge leaves
     // an armhole, while the lower edge joins the front and back above the belt.
     const sideVertices:number[]=[],sideIndices:number[]=[],ny=HD?12:6,na=HD?12:6;
     for(let j=0;j<=ny;j++)for(let i=0;i<=na;i++){
       const t=i/na,a=.85+t*(Math.PI-1.70),rim=.444-.102*Math.sin(t*Math.PI),y=.153+(rim-.153)*j/ny;
       const [rw,rd,rc]=torsoAt(y),x=side*(rw+.010)*Math.sin(a),z=rc+(rd+.014)*Math.cos(a);
       sideVertices.push(x,y,z);
     }
     for(let j=0;j<ny;j++)for(let i=0;i<na;i++){const a=j*(na+1)+i;sideIndices.push(a,a+1,a+na+1,a+1,a+na+2,a+na+1);}
     const sidePanel=new THREE.BufferGeometry();sidePanel.setAttribute('position',new THREE.Float32BufferAttribute(sideVertices,3));sidePanel.setIndex(sideIndices);sidePanel.computeVertexNormals();mesh('painter-waistcoat-side',sidePanel,cloth,trunk);
     panel('painter-waistcoat',[[0,.30],[side*.065,.49],[side*w,.465],[side*w,.35],[side*waist*1.045,.21],[side*waist*1.06,.158],[side*.034,.135],[0,.166]],cloth,.013);
     panel('painter-pocket',[[side*.075,.225],[side*.14,.232],[side*.14,.218],[side*.075,.211]],leather,.018);
     // A surface ribbon follows both sides of the vest all the way to the belt.
     // Unlike a free-path tube, its broad face cannot twist away from the clothing.
     const strapX=(y:number)=>side*(waist*.60+(shoulder*.43-waist*.60)*THREE.MathUtils.clamp((y-.15)/.35,0,1));
     const surface=(x:number,y:number,back:boolean)=>{
       const [w,d,c]=torsoAt(y),u=Math.min(.98,Math.abs(x)/w);
       if(y<.157)return (back?-1:1)*.118*build*Math.sqrt(1-(x/(waist*1.055))**2)+(back?-.004:.004);
       return back?c-(d+.009)*Math.sqrt(1-u*u)-.003:chestFront(x,y)+.017;
     };
     const rows:number[][]=[];
     const strapSteps=HD?24:12;
     for(let i=0;i<=strapSteps;i++){const y=.145+i*.355/strapSteps;rows.push([strapX(y),y,1]);}
     // Project the shoulder bridge onto the actual torso envelope, including its
     // neck slope. A fixed-height arc cut through the shoulder when viewed above.
     const shoulderTop=(x:number,z:number)=>{
       let top=.50;
       for(let y=.50;y<=.535;y+=.0005){const [w,d,c]=torsoAt(y);if((x/w)**2+((z-c)/d)**2<=1)top=y;}
       return top;
     };
     const band=(name:string,width:number,material:THREE.Material,isVest:boolean)=>{
       const verts:number[]=[],inds:number[]=[],run=isVest?rows.filter(r=>r[1]>=.455):rows;
       const offset=isVest?0:.006,across=HD?4:2,stride=across+1;
       const row=(x:number,y:number,back:boolean)=>{for(let j=0;j<=across;j++){const xx=x+(j/across-.5)*width;verts.push(xx,y,surface(xx,y,back)+(back?-offset:offset));}};
       for(const [x,y] of run)row(x,y,false);
       for(let i=1;i<16;i++){const a=i*Math.PI/16,x=strapX(.50);for(let j=0;j<=across;j++){
         const xx=x+(j/across-.5)*width,front=surface(xx,.50,false),back=surface(xx,.50,true),z=(front+back)/2+(front-back)/2*Math.cos(a);
         verts.push(xx,shoulderTop(xx,z)+.006+offset,z);
       }}
       for(const [x,y] of [...run].reverse())row(x,y,true);
       for(let i=0;i<verts.length/(stride*3)-1;i++)for(let j=0;j<across;j++){const a=i*stride+j;inds.push(a,a+1,a+stride,a+1,a+stride+1,a+stride);}
       const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setIndex(inds);g.computeVertexNormals();(material as THREE.MeshStandardMaterial).side=THREE.DoubleSide;mesh(name,g,material,trunk);
     };
     band('painter-waistcoat-shoulder',.090,cloth,true);
     band('painter-shoulder-strap',.026,leather,false);
     const x=strapX(.435),z=surface(x,.435,false),frame=group('painter-buckle-'+side,trunk,[x,.435,z+.010]);
     frame.rotation.y=Math.atan2(surface(x-.002,.435,false)-surface(x+.002,.435,false),.004);
     for(const dx of [-.015,.015])box('painter-strap-buckle',[.003,.029,.004],gold,frame,[dx,0,0]);
     for(const dy of [-.013,.013])box('painter-strap-buckle',[.033,.003,.004],gold,frame,[0,dy,0]);
     box('painter-buckle-pin',[.026,.002,.005],gold,frame,[0,0,.001]);
   }
   panel('painter-tie-knot',[[-.018,.483],[.018,.483],[.012,.46],[-.010,.46]],tie,.028);
   panel('painter-tie',[[-.009,.46],[.012,.46],[.026,.388],[0,.353],[-.023,.385]],tie,.023);
   for(const y of [.19,.227,.264,.30])mesh('painter-gold-button',new THREE.CylinderGeometry(.009,.009,.008,6).rotateX(Math.PI/2),gold,trunk,[.007,y,chestFront(.007,y)+.023]);
   const buckle=mesh('painter-round-buckle',new THREE.TorusGeometry(.026,.005,5,10),gold,trunk,[0,.14,.137*build]);
   root.traverse((o:any)=>{if(o.isMesh&&o.name==='buckle')o.visible=false;if(o.isMesh&&o.name==='belt')o.material=leather;});
   const satchel=group('painter-satchel-anchor',body,[hipW+.010,.025,0]);satchel.rotation.y=Math.PI/2;
   bevelBox('painter-satchel',[.105,.16,.026],leather,satchel,[0,0,0]);
   bevelBox('painter-satchel-flap',[.108,.056,.008],cloth,satchel,[0,.055,.017]);
   box('painter-satchel-clasp',[.012,.025,.005],gold,satchel,[0,.038,.023]);
   for(const z of [-.032,.032])box('painter-satchel-belt-loop',[.017,.049,.009],leather,satchel,[z,.092,-.008]);
   // Voluminous breeches narrow into a folded cuff; every surface remains on its original joint.
   for(const suffix of ['L','R']){
     root.traverse((o:any)=>{if(!o.isMesh)return;
       if(o.name==='thigh'+suffix||o.name==='shin'+suffix){const p=o.geometry.getAttribute('position');for(let i=0;i<p.count;i++){const y=p.getY(i),k=o.name.startsWith('thigh')?1+.09*Math.sin(Math.min(1,Math.max(0,-y/.44))*Math.PI):1+.40*Math.max(0,1-Math.abs(y+.09)/.15);p.setX(i,p.getX(i)*k);p.setZ(i,p.getZ(i)*k);}o.geometry.computeVertexNormals();}
     });
     sweep('painter-trouser-cuff'+suffix,[[-.205,.066,.061],[-.235,.066,.061]],pants,nodes['lowerLeg'+suffix]);
     sweep('painter-sock'+suffix,[[-.24,.049,.049],[-.28,.049,.049]],dark,nodes['lowerLeg'+suffix]);
     sweep('painter-sock-band'+suffix,[[-.247,.050,.050],[-.262,.050,.050]],mat('#646352'),nodes['lowerLeg'+suffix]);
   }
 }
 const brass=mat('#c29a48',.55,.45),belting=mat('#5b3a27');
 // Square brass buckle frame lying on a surface: `yaw` turns it to follow the curve under it.
 const squareBuckle=(name:string,parent:THREE.Object3D,pos:number[],yaw:number,w=.03,h=.026)=>{
   const frame=group(name,parent,pos);frame.rotation.y=yaw;
   for(const dx of [-w/2,w/2])box(name+'-bar',[.0032,h+.003,.004],brass,frame,[dx,0,0]);
   for(const dy of [-h/2,h/2])box(name+'-bar',[w,.0032,.004],brass,frame,[0,dy,0]);
   box(name+'-pin',[.0022,h,.005],brass,frame,[0,0,.001]);
   return frame;
 };
 if(engineer){
   const seamTone=mat(darker(spec.outfit.topColor,.72)),clasp=mat('#2b2522',.5,.5);
   openCollar(.392,.041);
   // Fine gold chain with a small pendant in the neckline.
   const chain:Knot[]=[];
   for(let i=0;i<=8;i++){const t=i/4-1,x=.044*t,y=.447+.068*t*t;chain.push([x,y,chestFront(x,y)+.0048,.0013,.0013]);}
   tube('engineer-necklace',chain,brass,trunk,[0,0,0],4);
   ellipsoid('engineer-pendant',[.0055,.0075,.0028],brass,trunk,[0,.437,chestFront(0,.437)+.007],6);
   // Underbust corset: a band wrapped around the shirt from the waist to just under the bust, with a
   // pointed front bottom, a thicker turned edge, two columns of brass buttons joined by dark clasps.
   const cloth2=cloth as THREE.MeshStandardMaterial;cloth2.side=THREE.DoubleSide;
   const off=.0075,S=THREE.MathUtils.smoothstep;
   const yBot=(a:number)=>.17-.032*Math.max(0,Math.cos(a))**10,yTop=(a:number)=>.35+.007*(1-Math.cos(a))-.017*Math.max(0,Math.cos(a))**6;
   const at=(a:number,y:number,o:number)=>{
     const [w,d,c]=torsoAt(y),x=Math.sin(a)*(w+o),z=c+Math.cos(a)*(d+o);
     return [x,y,z+Math.max(0,chestFront(x,y)+o-z)*S(Math.cos(a),.2,.5)];
   };
   const na=HD?40:20,rows:[number,number][]=[[0,off-.0045],...Array.from({length:(HD?9:4)+1},(_,j)=>[j/(HD?9:4),off] as [number,number]),[1,off-.0045]];
   const cv:number[]=[],ci:number[]=[];
   for(const [t,o] of rows)for(let i=0;i<=na;i++){const a=-Math.PI+2*Math.PI*i/na;cv.push(...at(a,yBot(a)+(yTop(a)-yBot(a))*t,o));}
   for(let j=0;j<rows.length-1;j++)for(let i=0;i<na;i++){const a=j*(na+1)+i,b=a+na+1;ci.push(a,a+1,b,a+1,b+1,b);}
   const cg=new THREE.BufferGeometry();cg.setAttribute('position',new THREE.Float32BufferAttribute(cv,3));cg.setIndex(ci);cg.computeVertexNormals();
   mesh('engineer-corset',cg,cloth,trunk,[0,0,0],wear*.5,{crease:Math.PI*.2});
   const onCorset=(x:number,y:number,lift:number):[number,number]=>{const [w]=torsoAt(y),a=Math.asin(THREE.MathUtils.clamp(x/(w+off),-.99,.99)),p=at(a,y,off);return [p[2]+lift,a*.8];};
   // Boning seams run up the front panels.
   if(HD)for(const x of [-.075,.075,-.118,.118]){
     const pts:Knot[]=[];for(let k=0;k<=6;k++){const a=Math.asin(x/(torsoAt(.25)[0]+off)),y=yBot(a)+.004+(yTop(a)-yBot(a)-.008)*k/6;pts.push([x,y,onCorset(x,y,.0008)[0],.0016,.0016]);}
     tube('engineer-corset-seam',pts,seamTone,trunk,[0,0,0],4);
   }
   for(const y of [.2,.235,.27,.305]){
     for(const x of [-.027,.027]){const [z,yaw]=onCorset(x,y,.003),b=mesh('engineer-corset-button',new THREE.CylinderGeometry(.0068,.0068,.006,HD?8:6).rotateX(Math.PI/2),brass,trunk,[x,y,z]);b.rotation.y=yaw;}
     box('engineer-corset-clasp',[.034,.0045,.004],clasp,trunk,[0,y,onCorset(0,y,.003)[0]]);
   }
   // Leather harness: two straps from the corset over the shoulders and down the back, laid on the
   // shirt surface as ribbons (they cannot twist away from it), with a square brass buckle on the chest.
   const shoulderTop=(x:number,z:number)=>{let top=.50;for(let y=.50;y<=.535;y+=.0005){const [w,d,c]=torsoAt(y);if((x/w)**2+((z-c)/d)**2<=1)top=y;}return top;};
   for(const side of [-1,1]){
     const sx=(y:number)=>side*(.09+(shoulder*.5-.09)*S(y,.38,.5));
     const surface=(x:number,y:number,back:boolean)=>{const [w,d,c]=torsoAt(y),u=Math.min(.98,Math.abs(x)/w);return back?c-d*Math.sqrt(1-u*u)-.0045:chestFront(x,y)+.0045;};
     const width=.024,across=HD?3:1,stride=across+1,steps=HD?16:6,verts:number[]=[],inds:number[]=[];
     const run:number[]=[];for(let i=0;i<=steps;i++)run.push(.33+i*.17/steps);
     const row=(x:number,y:number,back:boolean)=>{for(let j=0;j<=across;j++){const xx=x+(j/across-.5)*width;verts.push(xx,y,surface(xx,y,back));}};
     for(const y of run)row(sx(y),y,false);
     for(let i=1;i<12;i++){const a=i*Math.PI/12,x=sx(.5);for(let j=0;j<=across;j++){
       const xx=x+(j/across-.5)*width,front=surface(xx,.5,false),back=surface(xx,.5,true),z=(front+back)/2+(front-back)/2*Math.cos(a);
       verts.push(xx,shoulderTop(xx,z)+.0065,z);
     }}
     for(const y of [...run].reverse())row(sx(y),y,true);
     for(let i=0;i<verts.length/(stride*3)-1;i++)for(let j=0;j<across;j++){const a=i*stride+j;inds.push(a,a+1,a+stride,a+1,a+stride+1,a+stride);}
     const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setIndex(inds);g.computeVertexNormals();
     const strap=belting.clone();strap.side=THREE.DoubleSide;materials.add(strap);mesh('engineer-harness',g,strap,trunk);
     const x=sx(.425);squareBuckle('engineer-harness-buckle'+side,trunk,[x,.425,surface(x,.425,false)+.003],Math.atan2(surface(x-.002,.425,false)-surface(x+.002,.425,false),.004));
  }
 }
 if(nightshift){
   // Original night-service uniform: wine inset, fitted dark corset and a fine collar chain.
   // Each panel samples the chest, so it stays attached while the character animates.
   const wine=mat('#762d43',0,.76),corset=mat('#191923',0,.66),piping=mat('#9b4555',0,.62),silver=mat('#d8d0cd',.45,.34),stocking=mat('#403642',0,.84);
   panel('nightshift-wine-inset',[[-.054,.492],[.054,.492],[.082,.412],[.057,.356],[0,.338],[-.057,.356],[-.082,.412]],wine,.010);
   panel('nightshift-corset',[[-.115,.365],[.115,.365],[.128,.255],[.112,.176],[.055,.158],[0,.142],[-.055,.158],[-.112,.176],[-.128,.255]],corset,.014);
   for(const side of [-1,1]){
     const knots:Knot[]=[];
     for(let i=0;i<=6;i++){const y=.18+i*.16/6,x=side*(.09-.012*i/6);knots.push([x,y,chestFront(x,y)+.016,.0016,.0016]);}
     tube('nightshift-corset-seam',knots,piping,trunk,[0,0,0],4);
   }
   for(const y of [.185,.222,.259,.296,.333]){
     const b=mesh('nightshift-corset-button',new THREE.CylinderGeometry(.0058,.0058,.0045,HD?8:6).rotateX(Math.PI/2),silver,trunk,[0,y,chestFront(0,y)+.019]);
     b.rotation.y=Math.PI;
   }
   const chain:Knot[]=[];
   for(let i=0;i<=10;i++){const t=i/5-1,x=.047*t,y=.472+.043*t*t;chain.push([x,y,chestFront(x,y)+.011,.00115,.00115]);}
   tube('nightshift-necklace',chain,silver,trunk,[0,0,0],4);
   ellipsoid('nightshift-pendant',[.005,.007,.0025],silver,trunk,[0,.463,chestFront(0,.463)+.014],6);
   // Opaque low-poly hosiery starts below the shorts and disappears into the boot shaft.
   for(const {thigh,shin,side} of legs){
     const suffix=side<0?'R':'L';
     sweep('nightshift-thigh-high'+suffix,[[-.305,legWide*.80+.007,.076*build+.007],[-.44,legWide*.67+.007,.063*build+.007]],stocking,thigh,[0,0,0],0,HD?12:8);
     sweep('nightshift-stocking'+suffix,[[.004,legWide*.675+.007,.061*build+.007],[-.12,legWide*.68+.007,.062*build+.007],[-.25,.054+.007,.052+.007]],stocking,shin,[0,0,0],0,HD?12:8);
     ellipsoid('nightshift-knee-cover'+suffix,[legWide*.69+.008,.064,.064*build+.008],stocking,shin,[0,0,0],HD?8:7);
     sweep('nightshift-garter'+suffix,[[-.298,legWide*.815+.010,.078*build+.010],[-.310,legWide*.81+.010,.078*build+.010]],piping,thigh,[0,0,0],0,HD?12:8);
   }
 }
 if(spec.outfit.toolBelt){
   // Tool belt: leather belt with a round brass gear buckle, a second belt slung diagonally across the
   // hips, two riveted pouches at the sides and a strap with a buckle around each thigh.
   root.traverse((o:any)=>{if(o.isMesh&&o.name==='buckle')o.visible=false;if(o.isMesh&&o.name==='belt')o.material=belting;});
   const gear=group('tool-belt-gear',trunk,[0,.135,.118*build+.006]);
   mesh('gear-rim',new THREE.TorusGeometry(.02,.0042,5,HD?18:10),brass,gear);
   mesh('gear-hub',new THREE.CylinderGeometry(.0065,.0065,.006,8).rotateX(Math.PI/2),brass,gear);
   for(let k=0;k<(HD?12:8);k++){const a=k*Math.PI*2/(HD?12:8),t=box('gear-tooth',[.0065,.006,.005],brass,gear,[Math.sin(a)*.0255,Math.cos(a)*.0255,0]);t.rotation.z=-a;}
   if(HD)for(let k=0;k<6;k++){const s=box('gear-spoke',[.0026,.03,.003],brass,gear,[0,0,0]);s.rotation.z=k*Math.PI/6;}
   const pelvis=body.children.find(o=>o.name==='pelvis') as THREE.Mesh;
   const around=(a:number,y:number,o:number)=>{const [w,d,c]=hug(pelvis,y,.02);return new THREE.Vector3(Math.sin(a)*(w+o),y,c+Math.cos(a)*(d+o));};
   // Slung belt: a flat strip, higher on the right hip than on the left.
   {
     const n=HD?48:20,h=.024,v:number[]=[],ix:number[]=[],yAt=(a:number)=>.078-.026*Math.sin(a);
     for(let i=0;i<=n;i++){const a=-Math.PI+2*Math.PI*i/n,P=around(a,yAt(a),.009);v.push(P.x,P.y-h/2,P.z,P.x,P.y+h/2,P.z);}
     for(let i=0;i<n;i++){const a=i*2;ix.push(a,a+2,a+1,a+1,a+2,a+3);}
     const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setIndex(ix);g.computeVertexNormals();
     const m=belting.clone();m.side=THREE.DoubleSide;materials.add(m);mesh('tool-belt-slung',g,m,body);
     const a=-.55,P=around(a,yAt(a),.013);squareBuckle('tool-belt-buckle',body,[P.x,P.y,P.z],a,.028,.03);
   }
   for(const side of [-1,1]){
     const a=side*1.05,P=around(a,.03,.013),pouch=group('tool-pouch-anchor'+side,body,[P.x,P.y-.035,P.z]);pouch.rotation.y=a;
     // Long, slim pouches: they run down the thigh but stay flat against the hip, so the swinging arms clear them.
     bevelBox('tool-pouch',[.056,.155,.015],belting,pouch,[0,0,0]);
     bevelBox('tool-pouch-flap',[.06,.045,.006],mat(darker('#5b3a27',.82)),pouch,[0,.058,.0095]);
     for(const y of [.05,-.045])mesh('tool-pouch-stud',new THREE.CylinderGeometry(.005,.005,.004,8).rotateX(Math.PI/2),brass,pouch,[0,y,y>0?.0145:.0095]);
     box('tool-pouch-loop',[.02,.032,.006],belting,pouch,[0,.086,-.004]);
     // Thigh strap with its buckle on the outer front.
     const suffix=side<0?'R':'L',thigh=nodes['upperLeg'+suffix],leg=thigh.children.find(o=>o.name==='thigh'+suffix) as THREE.Mesh,y=-.15,[w,d,c]=hug(leg,y);
     sweep('thigh-strap'+suffix,[[y-.011,w+.005,d+.005,c],[y+.011,w+.005,d+.005,c]],belting,thigh,[0,0,0],0,HD?14:8);
     const b=side*.75;squareBuckle('thigh-strap-buckle'+suffix,thigh,[Math.sin(b)*(w+.008),y,c+Math.cos(b)*(d+.008)],b,.024,.026);
   }
   // A brass key ring hangs from the belt on the right.
   const ring=mesh('tool-belt-ring',new THREE.TorusGeometry(.012,.0022,4,12),brass,body,[0,0,0]);const R=around(-.75,.07,.016);ring.position.copy(R).add(new THREE.Vector3(0,-.012,0));ring.rotation.y=-.75;
 }
 if(spec.profession==='pintor'&&spec.appearance.hair==='messy'&&spec.outfit.hat==='none'){
   // Broad angular locks, not a cluster of rounded spikes. The cap stays underneath.
   const lock=(a:number[],b:number[],w:number)=>{
     const mid=new THREE.Vector3().fromArray(a).lerp(new THREE.Vector3().fromArray(b),.38);
     const vertices=[a[0]-w,a[1],a[2],a[0]+w,a[1],a[2],mid.x,mid.y,mid.z+.023,b[0],b[1],b[2],a[0],a[1]+.02,a[2]-.024];
     const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex([0,1,2,0,2,3,2,1,3,0,4,1,0,3,4,1,4,3]);g.computeVertexNormals();mesh('painter-hair-lock',g,hair,head);
   };
   lock([-.018,.275,.061],[.001,.158,.098],.036);lock([-.065,.27,.027],[-.105,.17,.064],.033);lock([.047,.267,.050],[.088,.185,.075],.031);
   lock([-.06,.275,0],[-.119,.254,.018],.035);lock([.067,.26,-.005],[.119,.213,.005],.030);lock([.018,.28,-.018],[-.01,.326,-.01],.031);
   for(const side of [-1,1]){lock([side*.075,.18,-.047],[side*.094,.086,-.06],.021);if(nodes['eye'+(side<0?'R':'L')])nodes['eye'+(side<0?'R':'L')].scale.multiply(new THREE.Vector3(1.26,1.40,1));}
 }
 // Engenheira: large almond eyes, like the reference portrait.
 if(spec.profession==='engineer')for(const k of ['eyeR','eyeL'])nodes[k]?.scale.multiply(new THREE.Vector3(1.2,1.28,1));
 addLumberDetails({spec,root,nodes,geometries,materials,torsoAt,headAt});
 addZombieDetails({spec,nodes,geometries,materials,torsoAt});
 root.userData.sculptRuntime={nodes,sockets,colliders:{},destructionGroups:{}};
 root.userData.characterSpec=spec;root.userData.detail=detail;
 root.userData.rig={kind:'procedural-rigid-hierarchy',nodes,bound:false};
 // Facial animation: deterministic per seed, so every survivor blinks and frowns on its own rhythm.
 // Time is split into slots; each slot draws its own event from a hash of (seed, slot).
 const hash=(n:number)=>{const h=Math.sin(n*127.1+seedPhase*311.7)*43758.5453;return h-Math.floor(h);};
 const blinkCurve=(dt:number)=>dt<0||dt>.2?0:dt<.07?THREE.MathUtils.smootherstep(dt,0,.07):1-THREE.MathUtils.smootherstep(dt,.07,.2);
 const blinkAt=(t:number)=>{
   const slot=4,k=Math.floor(t/slot);let b=0;
   for(const n of [k-1,k]){ // a blink every 2-6 s, sometimes doubled
     const at=n*slot+.4+hash(n)*3.2;b=Math.max(b,blinkCurve(t-at));
     if(hash(n+.5)<.2)b=Math.max(b,blinkCurve(t-at-.28));
   }
   return b;
 };
 const drift=(t:number,period:number,salt:number,hold=.55)=>{ // piecewise-held random value in [-1,1]
   const k=Math.floor(t/period),f=t/period-k,e=THREE.MathUtils.smootherstep(f,hold,1);
   const v=(n:number)=>hash(n*1.37+salt)*2-1;return v(k)+(v(k+1)-v(k))*e;
 };
 // Gaze: fixations held for a while, joined by quick saccades (~70 ms), mostly small and often back
 // to the centre, plus the occasional brief glance aside that returns. [x, y] offsets on the eye.
 const gazeTarget=(n:number):[number,number]=>hash(n*2.1+5)<.35?[0,0]:[(hash(n+7.7)*2-1)*.0026,(hash(n+9.3)*2-1)*.0011];
 const gazeAt=(t:number):[number,number]=>{
   const slot=2.4,k=Math.floor(t/slot),at=(n:number)=>n*slot+.5+hash(n+.3)*1.4;
   const from=gazeTarget(k-1+(t<at(k)?-1:0)),to=gazeTarget(k+(t<at(k)?-1:0)),start=t<at(k)?at(k-1):at(k);
   const e=THREE.MathUtils.smootherstep(t-start,0,.07);
   let x=from[0]+(to[0]-from[0])*e,y=from[1]+(to[1]-from[1])*e;
   const g=k+(t<at(k)?-1:0);
   if(hash(g+.71)<.22){ // a quick look aside and back
     const t0=start+.6+hash(g+.9)*.5,dir=hash(g+.13)<.5?-1:1;
     x+=dir*.0024*(THREE.MathUtils.smootherstep(t-t0,0,.07)-THREE.MathUtils.smootherstep(t-t0,.45,.52));
   }
   return [THREE.MathUtils.clamp(x,-.0032,.0032),y];
 };
 // Expression channels. brow: lift (m) and angle (+ inner ends down = anger, - inner ends up = sadness);
 // lid: + closes the upper lid, - retracts it; lower: squint; wide: bigger eye opening; smile: + corners
 // up, - corners down; open: jaw; bags: tired eyes; head: pitch (+ looks down).
 type Face={browLift:number;browAngle:number;lid:number;lower:number;wide:number;smile:number;open:number;bags:number;head:number};
 const FACE:Record<Expression,Face>={
   neutral:{browLift:0,browAngle:0,lid:0,lower:0,wide:0,smile:0,open:0,bags:0,head:0},
   happy:{browLift:.0016,browAngle:-.06,lid:.1,lower:.8,wide:0,smile:1,open:.18,bags:0,head:-.02},
   angry:{browLift:-.0028,browAngle:.34,lid:.28,lower:.35,wide:0,smile:-.35,open:0,bags:0,head:.04},
   sad:{browLift:.0012,browAngle:-.32,lid:.32,lower:0,wide:0,smile:-.9,open:0,bags:.25,head:.1},
   tired:{browLift:-.0008,browAngle:-.1,lid:.55,lower:.1,wide:0,smile:-.15,open:.08,bags:1,head:.06},
   surprised:{browLift:.0048,browAngle:-.1,lid:-1,lower:-.2,wide:1,smile:0,open:.85,bags:0,head:-.05},
 };
 const faceNow:Face={...FACE.neutral};let faceTarget:Face={...FACE.neutral},lastFaceTime:number|null=null;
 const setExpression=(name:Expression,intensity=1,immediate=false)=>{
   const e=FACE[name]??FACE.neutral,k=THREE.MathUtils.clamp(intensity,0,1);
   faceTarget=Object.fromEntries(Object.entries(e).map(([key,v])=>[key,v*k])) as Face;
   if(immediate){Object.assign(faceNow,faceTarget);mouthShaped=false;}
 };
 const shapeMouth=(smile:number,open:number)=>{
   if(spec.profession==='zumbi'){open=Math.max(open,.32);smile-=.12;}
   if(!mouthParts)return;
   for(const [m,base] of mouthParts.base){
     const pa=m.geometry.getAttribute('position') as THREE.BufferAttribute,isLower=m===mouthParts.lower,isUpper=m===mouthParts.upper;
     for(let i=0;i<pa.count;i++){
       const x=base[i*3],y=base[i*3+1],u=Math.min(1,Math.abs(x)/(.022*mw));
       // Corners follow the smile curve; the jaw drops the lower lip and lifts the upper one a little.
       const dy=smile*.0095*(u*u-.3)+(isLower?-open*.014:isUpper?open*.002:-open*.005)*(1-u*u*.6);
       pa.setXYZ(i,x*(1+Math.max(0,smile)*.08+open*.05),y+dy,base[i*3+2]);
     }
     pa.needsUpdate=true;
   }
   mouthParts.inner.visible=mouthParts.teeth.visible=open>.05;
   mouthParts.inner.scale.set(1+open*.15,.2+open*1.9,1);mouthParts.inner.position.y=mouthY-.001-open*.0055+smile*.002;
   mouthParts.teeth.position.y=mouthY+.0018+open*.001;
 };
 const animateFace=(t:number)=>{
   // Ease the expression toward its target (about a quarter of a second).
   const dt=lastFaceTime===null?0:THREE.MathUtils.clamp(t-lastFaceTime,0,.1);lastFaceTime=t;
   const ease=1-Math.exp(-dt*12);
   let mouthMoved=false;
   for(const key of Object.keys(faceNow) as (keyof Face)[]){const d=faceTarget[key]-faceNow[key];if(Math.abs(d)>1e-6){faceNow[key]+=d*ease;if(key==='smile'||key==='open')mouthMoved=true;}}
   const e=faceNow;
   if(mouthMoved||!mouthShaped){shapeMouth(e.smile,e.open);mouthShaped=true;}
   const blink=blinkAt(t);
   const raise=drift(t,2.6,11),tilt=drift(t,3.4,23),solo=drift(t,5.3,37);
   const [lookX,lookY]=gazeAt(t);
   for(const f of face){
     // Brows: mostly subtle, sometimes one side only; they dip a little with each blink.
     const lift=THREE.MathUtils.clamp(raise*.0024+(solo>.45&&f.side>0?.0022:0)-blink*.0012,-.002,.004);
     f.brow.position.y=lift*(1-Math.abs(e.browAngle))+e.browLift;f.brow.rotation.z=f.side*(tilt*.07*(1-Math.abs(e.browAngle))+e.browAngle);
     // Upper lid slides down and stretches over the eyeball; the lower lid rises a touch.
     // The upper lid also follows the gaze a little.
     const hold=Math.max(0,e.lid),retract=Math.max(0,-e.lid),close=hold+(1-hold)*blink;
     f.lid.position.y=.0102+f.rest+e.wide*.0022+retract*.0018-close*.0085+lookY*.35;f.lid.scale.set(1,1+close*.75,1+close*.15);
     f.lower.position.y=-.0098-e.wide*.0018+blink*.0015+Math.max(0,e.lower)*.0032;
     f.white.scale.set(1+e.wide*.08,1+e.wide*.32,1);
     f.bag.visible=e.bags>.02;f.bag.scale.set(1,.4+e.bags*.6,.6+e.bags*.4);
     for(const [i,o] of f.look.entries()){o.position.set(lookX,lookY,(i?.0088:.0062)-(lookX*lookX+lookY*lookY)*18);o.scale.setScalar((1-e.wide*.12)*irisK);} // stay on the eyeball
   }
 };
 // Actions are looping keyframe sequences of a full-body pose. Legs are solved with the same two-bone IK
 // as walking, from ankle targets [z, height, foot pitch in world]; arms are [pitch, spread, elbow].
 // Index 0 is the right side (side -1), index 1 the left.
 type Pose={y:number;z:number;lift:number;trunk:number;head:number;legs:number[][];arms:number[][];twist:number};
 const P=(y:number,z:number,trunk:number,head:number,legs:number[][],arms:number[][],lift=0,twist=0):Pose=>({y,z,lift,trunk,head,legs,arms,twist});
 const flat=[[0,.09,0],[0,.09,0]],hang=[[0,.1,-.13],[0,.1,-.13]];
 const STAND=P(.92,0,0,0,flat,hang);
 const kneelLegs=[[-.4,.06,2.85],[-.4,.06,2.85]];
 // Mirror the chopping arm according to the equipped hand. Two-handed items use both arms;
 // the object remains on its hand socket, so its saved local transform survives the entire strike.
 const attackArms=(pitch:number,spread:number,elbow:number):number[][]=>{
   const both=spec.items.object!=='none'&&spec.items.placement==='both';
   const left=spec.items.object!=='none'&&spec.items.placement==='left';
   return [-1,1].map(side=>both?[pitch,-.40,elbow]:side===(left?1:-1)?[pitch,spread,elbow]:[-.28,.20,-.5]);
 };
 const attackRest=P(.92,0,.03,0,flat,attackArms(-.48,.32,-.54));
 const attackSide=spec.items.object!=='none'&&spec.items.placement==='left'?-1:1;
 const lateralArms=(spread:number,yaw:number,elbow:number):number[][]=>{
   const both=spec.items.object!=='none'&&spec.items.placement==='both';
   return [-1,1].map(side=>both||side===-attackSide?[-.95,both?-.35:spread,elbow,yaw*attackSide]:[-.35,.24,-.6,0]);
 };
 const lateralRest=P(.92,0,.03,0,flat,lateralArms(.3,0,-.65));
 // Prefer the free hand when carrying a one-handed item; otherwise signal with the right.
 const waveSide=spec.items.object!=='none'&&spec.items.placement==='right'?1:-1;
 const wavingArms=()=>[-1,1].map(side=>side===waveSide?[-.12,2.55,-.25]:[0,.1,-.13]);
 const ACTIONS:Record<string,{loop:number;keys:[number,Pose][];sway?:[number,number];hold?:boolean}>={
   wave:{loop:3.6,keys:[
     [0,STAND],
     [.65,P(.92,0,0,0,flat,wavingArms())],
     [2.85,P(.92,0,0,0,flat,wavingArms())],
     [3.5,STAND],[3.6,STAND]]},
   // Lower into a squat and hold it while selected. Flat ankle targets keep both soles
   // planted; the pelvis moves slightly back to balance the bent knees and forward torso.
   crouch:{loop:.85,hold:true,keys:[
     [0,STAND],
     [.85,P(.58,-.11,.32,-.10,flat,[[-.50,.22,-.65],[-.50,.22,-.65]])]]},
   // A chest-height horizontal sweep: wind up to the outside, rotate across the body,
   // follow through and recover. The pitch stays level throughout the strike.
   attackLateral:{loop:1.9,keys:[
     [0,lateralRest],
     [.52,P(.90,-.015,.04,0,flat,lateralArms(.85,-.70,-.65),0,-.32*attackSide)],
     [.67,P(.90,-.01,.04,0,flat,lateralArms(.80,-.65,-.60),0,-.30*attackSide)],
     [.92,P(.88,.015,.08,0,flat,lateralArms(-.55,.80,-.40),0,.38*attackSide)],
     [1.12,P(.89,.01,.06,0,flat,lateralArms(-.60,.85,-.50),0,.40*attackSide)],
     [1.65,lateralRest],[1.9,lateralRest]]},
   attack:{loop:1.9,keys:[
     [0,attackRest],
     [.52,P(.91,-.025,-.10,-.06,flat,attackArms(-1.95,.25,-1.10))],
     [.67,P(.90,-.015,-.06,-.03,flat,attackArms(-1.85,.23,-.95))],
     [.92,P(.85,.025,.28,.08,flat,attackArms(-.30,.22,-.18))],
     [1.12,P(.86,.02,.20,.04,flat,attackArms(-.22,.24,-.25))],
     [1.65,attackRest],[1.9,attackRest]]},
   pickup:{loop:4.2,keys:[
     [0,STAND],
     [.7,P(.52,-.11,.95,-.4,[[-.06,.09,0],[.09,.09,0]],[[-1.2,.14,-.08],[-.7,.16,-.95]])],
     [1.35,P(.52,-.11,.97,-.45,[[-.06,.09,0],[.09,.09,0]],[[-1.22,.12,-.25],[-.7,.16,-.95]])],
     [2.1,P(.8,-.04,.25,-.1,[[-.03,.09,0],[.05,.09,0]],[[-.8,.12,-1.4],[-.2,.12,-.4]])],
     [2.8,P(.92,0,0,0,flat,[[-.45,.12,-1.25],[0,.1,-.13]])],
     [3.6,STAND],[4.2,STAND]]},
   jump:{loop:2.6,keys:[
     [0,STAND],
     [.45,P(.72,-.05,.4,-.1,flat,[[.75,.18,-.3],[.75,.18,-.3]])],
     [.62,P(.93,0,-.04,-.1,flat,[[-2.5,.2,-.2],[-2.5,.2,-.2]])],
     [.92,P(.93,0,.05,0,[[.02,.21,.35],[.05,.19,.35]],[[-2.2,.3,-.35],[-2.2,.3,-.35]],.3)],
     [1.2,P(.93,0,.05,0,[[.02,.1,.1],[.02,.1,.1]],[[-1.2,.35,-.4],[-1.2,.35,-.4]])],
     [1.36,P(.74,-.05,.35,-.05,flat,[[-.7,.25,-.5],[-.7,.25,-.5]])],
     [1.95,STAND],[2.6,STAND]]},
   pray:{loop:9,sway:[2.4,6.4],keys:[
     [0,STAND],
     [.8,P(.6,-.06,.35,-.1,flat,[[-.5,.12,-.6],[-.5,.12,-.6]])],
     [1.5,P(.505,0,.05,0,kneelLegs,[[-.35,.1,-1],[-.35,.1,-1]])],
     [2.4,P(.505,0,-.08,-.42,kneelLegs,[[-2.85,.32,-.15],[-2.85,.32,-.15]])],
     [6.4,P(.505,0,-.08,-.42,kneelLegs,[[-2.85,.32,-.15],[-2.85,.32,-.15]])],
     [7.1,P(.505,0,.05,0,kneelLegs,[[-.35,.1,-1],[-.35,.1,-1]])],
     [7.8,P(.6,-.06,.35,-.1,flat,[[-.5,.12,-.6],[-.5,.12,-.6]])],
     [8.6,STAND],[9,STAND]]},
 };
 const holdItemPose=(motion:Motion)=>{
   if(spec.items.armMotion[motion])return;
   // OFF must always be a real lock for a carried object, including the
   // "Natural" pose. Previously it only locked the special ready pose.
   if(spec.items.object!=='none'&&spec.items.placement!=='both'){
     const holding=spec.items.placement==='left'?1:-1,a=arms.find(arm=>arm.side===holding);
     // Carry arm opens away from the ribs, avoiding the hand-held object clipping
     // into the torso while preserving the configured hand socket transform.
     if(a){a.arm.rotation.set(-.48,0,a.side*.32);a.elbow.rotation.x=-.54;}
   }
   if(spec.items.placement!=='both')return;
   // Both shoulders roll toward the centre and the elbows bend forward. This puts
   // the palms on separate points of the diagonal shaft in the resting pose.
   arms.forEach(a=>{a.arm.rotation.set(-.72,0,a.side*-.12);a.elbow.rotation.x=-.92;a.wrist.rotation.set(0,0,0);});
 };
 const applyArmAdjustment=()=>{
   for(const arm of arms){
     const config=spec.items.arms[arm.side<0?'right':'left'];
     // A modest shoulder-only adjustment keeps the entire arm chain attached.
     // Forward travel is deliberately broader than backward travel.
     arm.arm.rotation.x+=config.swing*(config.swing<0?.22:.70);
     arm.arm.rotation.z+=arm.side*config.spread*.35;
     if(spec.items.object!=='none'&&spec.items.placement==='both')arm.arm.rotation.z+=arm.side*(spec.items.twoHandSpread??.65)*.65;
     arm.arm.rotation.y+=config.twist*.14;
   }
 };
 const poseAt=(name:string,time:number):Pose=>{
   if(name==='attack'||name==='attackLateral')time*=ATTACK_SPEED;
   const act=ACTIONS[name],t=act.hold?THREE.MathUtils.clamp(time,0,act.loop):time%act.loop,keys=act.keys;
   let i=0;while(i<keys.length-2&&keys[i+1][0]<=t)i++;
   const [t0,a]=keys[i],[t1,b]=keys[i+1],k=THREE.MathUtils.smootherstep(t,t0,t1),L=(x:number,y:number)=>x+(y-x)*k;
   const pose=P(L(a.y,b.y),L(a.z,b.z),L(a.trunk,b.trunk),L(a.head,b.head),a.legs.map((l,j)=>l.map((v,n)=>L(v,b.legs[j][n]))),a.arms.map((r,j)=>r.map((v,n)=>L(v,b.arms[j][n]))),L(a.lift,b.lift),L(a.twist,b.twist));
   if(act.sway&&t>act.sway[0]&&t<act.sway[1]){ // a slow, gentle sway while holding the pose
     const w=Math.sin((t-act.sway[0])*1.6)*THREE.MathUtils.smoothstep(t,act.sway[0],act.sway[0]+.6)*(1-THREE.MathUtils.smoothstep(t,act.sway[1]-.6,act.sway[1]));
     pose.trunk+=w*.03;pose.head+=w*.05;for(const r of pose.arms){r[1]+=w*.05;}
   }
   return pose;
 };
 const applyPose=(p:Pose,motion:Motion,time:number)=>{
   // A forward bend is shared: the pelvis tilts (thighs compensate, so feet stay put) and the spine bends
   // at the waist, not at the hip joints. Bending the whole torso from the hips opened a gap at the back.
   const tilt=p.trunk*.5,bend=p.trunk-tilt,waistY=.14;
   body.position.set(0,p.y+p.lift,p.z);body.rotation.set(tilt,0,0);
   trunk.rotation.set(bend,p.twist,0);trunk.position.set(0,waistY*(1-Math.cos(bend)),-waistY*Math.sin(bend));head.rotation.set(p.head,0,0);
   legs.forEach((l,i)=>{
     const [fz,fy,fp]=p.legs[i],dy=p.y+p.lift-(fy+p.lift),dz=fz-p.z;
     const r=THREE.MathUtils.clamp(Math.hypot(dy,dz),Math.abs(legUpper-legLower)+.001,legUpper+legLower-.0005);
     const knee=Math.acos(THREE.MathUtils.clamp((r*r-legUpper*legUpper-legLower*legLower)/(2*legUpper*legLower),-1,1));
     const hipAngle=Math.atan2(-dz,dy)-Math.atan2(legLower*Math.sin(knee),legUpper+legLower*Math.cos(knee));
     l.thigh.rotation.x=hipAngle-tilt;l.shin.rotation.x=knee;l.foot.rotation.x=fp-hipAngle-knee;
   });
   arms.forEach((a,i)=>{const [x,z,e,yaw=0]=p.arms[i];a.arm.rotation.set(x,yaw,a.side*z);a.elbow.rotation.x=e;a.wrist.rotation.set(0,0,0);});
   holdItemPose(motion);applyArmAdjustment();
   if(motion==='wave'){
     const t=((time%3.6)+3.6)%3.6;
     const weight=THREE.MathUtils.smoothstep(t,.35,.75)*(1-THREE.MathUtils.smoothstep(t,2.7,3.2));
     const holding=spec.items.object!=='none'&&(spec.items.placement==='both'||spec.items.placement===(waveSide<0?'right':'left'));
     if(!holding||spec.items.armMotion.wave){
       const a=arms.find(a=>a.side===waveSide)!;
       a.wrist.rotation.y=-a.side*THREE.MathUtils.degToRad(-60)*weight;
       a.arm.rotation.z+=a.side*Math.sin((t-.65)*6.5)*THREE.MathUtils.degToRad(10)*weight;
     }
   }
   if(motion==='attackLateral'&&spec.items.armMotion.attackLateral){
     for(const a of arms)if(spec.items.placement==='both'||a.side===-attackSide){
       a.wrist.rotation.y=-a.side*THREE.MathUtils.degToRad(-20);
     }
   }
 };
 // Soft hips: the top of each thigh (and whatever is sewn onto it) blends back toward the pelvis as the
 // leg swings, like skin over the hip joint, instead of the rigid thigh turning out of the pelvis.
 // Weights by rest height in the thigh frame: 0.6 at the hip (the thigh still turns), 0 from 13 cm down.
 type HipSkin={pos:THREE.BufferAttribute;nrm:THREE.BufferAttribute|null;p0:Float32Array;n0:Float32Array|null;w:Float32Array};
 let hipSkins:{thigh:THREE.Object3D;parts:HipSkin[]}[]|null=null;
 const skinHips=()=>{
   hipSkins??=legs.map(l=>({thigh:l.thigh,parts:(l.thigh.children as THREE.Mesh[]).filter(o=>o.isMesh&&!(o as any).isInstancedMesh).map(o=>{
     const pos=o.geometry.getAttribute('position') as THREE.BufferAttribute,nrm=(o.geometry.getAttribute('normal') as THREE.BufferAttribute)??null,w=new Float32Array(pos.count);
     for(let i=0;i<pos.count;i++)w[i]=.6*THREE.MathUtils.smoothstep(pos.getY(i),-.13,.04);
     return {pos,nrm,p0:Float32Array.from(pos.array as ArrayLike<number>),n0:nrm?Float32Array.from(nrm.array as ArrayLike<number>):null,w};
   }).filter(q=>q.w.some(v=>v>.01))}));
   for(const {thigh,parts} of hipSkins){
     // Undo the thigh's swing (a rotation about X at its pivot) by each vertex's weight.
     const a=-thigh.rotation.x,c=Math.cos(a),sn=Math.sin(a);
     for(const {pos,nrm,p0,n0,w} of parts){
       const P=pos.array as Float32Array,N=nrm?nrm.array as Float32Array:null;
       for(let i=0;i<w.length;i++){
         const k=w[i];if(k<=0)continue;
         const j=i*3,y=p0[j+1],z=p0[j+2];P[j+1]=y+k*(y*c-z*sn-y);P[j+2]=z+k*(y*sn+z*c-z);
         if(N&&n0){const ny=n0[j+1],nz=n0[j+2],yy=ny+k*(ny*c-nz*sn-ny),zz=nz+k*(ny*sn+nz*c-nz),l=Math.hypot(n0[j],yy,zz)||1;N[j]=n0[j]/l;N[j+1]=yy/l;N[j+2]=zz/l;}
       }
       pos.needsUpdate=true;if(nrm)nrm.needsUpdate=true;
     }
   }
 };
 let mouthShaped=false;
 const update=(time:number,motion:Motion='idle')=>{
   moveBody(time,motion);skinHips();
   strandUniforms.uTime.value=time;strandUniforms.uWind.value=motion==='sprint'||motion==='jumpSprint'?1.6:motion==='run'||motion==='jumpRun'||motion==='runAttackLateral'?1.2:motion==='walk'||motion==='crouchWalk'||motion==='walkAttackLateral'||motion==='backwardAttackLateral'||motion==='backward'||motion==='jumpWalk'||motion==='jump'?.7:.3;
   if(face.length){animateFace(time);head.rotation.x+=faceNow.head;}
 };
 const moveBody=(time:number,motion:Motion)=>{
   if(ACTIONS[motion]){applyPose(poseAt(motion,time),motion,time);return;}
   body.position.z=0;body.rotation.set(0,0,0);trunk.position.set(0,0,0);
   // Sprint is a faster run: quicker cadence, longer stride, higher knees, stronger lean and arm drive.
   const jumping=motion==='jumpWalk'||motion==='jumpRun'||motion==='jumpSprint';
   const lateralAttack=motion==='walkAttackLateral'||motion==='runAttackLateral'||motion==='backwardAttackLateral';
   const backward=motion==='backward'||motion==='backwardAttackLateral',direction=backward?-1:1;
   const crouched=motion==='crouchWalk';
   const sprint=motion==='sprint'||motion==='jumpSprint',moving=crouched||lateralAttack||backward||motion==='walk'||motion==='jumpWalk'||motion==='run'||motion==='jumpRun'||sprint,run=motion==='run'||motion==='jumpRun'||motion==='runAttackLateral'||sprint;
   const phase=time*(sprint?13:run?10:crouched?4.5:backward?5.2:6),stride=sprint?.36:run?.28:crouched?.11:backward?.14:.18;
   // Freeze a split-leg pose during flight, with one bent leg forward and the other behind.
   // Blend into it before take-off and out after landing; cadence only drives grounded steps.
   const cycle=sprint?2.05:run?2.35:2.8,t=((time%cycle)+cycle)%cycle;
   const flightPose=jumping?THREE.MathUtils.smoothstep(t,.50,.62)*(1-THREE.MathUtils.smoothstep(t,1.3,1.45)):0;
   const flight=jumping?THREE.MathUtils.clamp((t-.62)/.68,0,1):0;
   const airborne=jumping&&t>.62&&t<1.3?Math.sin(Math.PI*flight):0;
   const lift=airborne*(sprint?.36:run?.30:.23);
   const crouch=jumping?(t>=.35&&t<=.62?Math.sin(Math.PI*(t-.35)/.27)*.07:t>=1.3&&t<=1.65?Math.sin(Math.PI*(t-1.3)/.35)*.06:0):0;
   const bobAmount=sprint?.022:run?.016:crouched?.004:.009;
   const gaitBob=moving?Math.abs(Math.sin(phase))*bobAmount:Math.sin(time*1.9)*.002;
   const takeoffBob=Math.abs(Math.sin(.62*(sprint?13:run?10:6)))*bobAmount;
   const bob=THREE.MathUtils.lerp(gaitBob,takeoffBob,flightPose);
   const gaitHeight=crouched?.61:moving?.09+Math.sqrt((legUpper+legLower-.004)**2-stride**2):.92;
   body.position.y=gaitHeight+bob+lift-crouch;
   if(crouched)body.position.z=-.09;
   trunk.rotation.set((crouched?.26:sprint?.22:run?.11:0)+crouch*1.8,0,moving?Math.sin(phase)*(crouched?.015:.025):Math.sin(time*1.3)*.009);
   head.rotation.set(crouched?-.08:0,moving?0:Math.sin(time*.55)*.07,0);
   for(const l of legs){
     const p=phase+(l.side<0?Math.PI:0);
     // Reverse the horizontal travel for retreat, keeping the lifted and planted phases intact.
     const footZ=(moving?-Math.cos(p)*stride*direction:0)-body.position.z;
     const footY=.09+(moving?Math.max(0,Math.sin(p))*(sprint?.22:run?.16:crouched?.035:backward?.06:.085):0)+lift+airborne*.08;
     const dy=body.position.y-footY,r=Math.min(legUpper+legLower-.0005,Math.hypot(dy,footZ));
     const knee=Math.acos(THREE.MathUtils.clamp((r*r-legUpper*legUpper-legLower*legLower)/(2*legUpper*legLower),-1,1));
     const hipAngle=Math.atan2(-footZ,dy)-Math.atan2(legLower*Math.sin(knee),legUpper+legLower*Math.cos(knee));
     l.thigh.rotation.x=hipAngle;l.shin.rotation.x=knee;l.foot.rotation.x=-hipAngle-knee;
     if(flightPose>0){
       const front=l.side<0,z=front?.26:-.25,y=.09+(front?.22:.08);
       const dy=gaitHeight+takeoffBob-y,r=THREE.MathUtils.clamp(Math.hypot(dy,z),Math.abs(legUpper-legLower)+.001,legUpper+legLower-.0005);
       const bend=Math.acos(THREE.MathUtils.clamp((r*r-legUpper*legUpper-legLower*legLower)/(2*legUpper*legLower),-1,1));
       const hip=Math.atan2(-z,dy)-Math.atan2(legLower*Math.sin(bend),legUpper+legLower*Math.cos(bend));
       l.thigh.rotation.x=THREE.MathUtils.lerp(hipAngle,hip,flightPose);
       l.shin.rotation.x=THREE.MathUtils.lerp(knee,bend,flightPose);
       l.foot.rotation.x=THREE.MathUtils.lerp(-hipAngle-knee,(front?-.12:.08)-hip-bend,flightPose);
     }
   }
   for(const a of arms){
     // When the equipped arm is allowed to animate during idle, keep a visible
     // carry sway so ON is clearly distinct from the locked OFF pose.
     const heldIdle=motion==='idle'&&spec.items.armMotion.idle&&spec.items.object!=='none';
     const gaitSwing=moving?-Math.cos(phase+(a.side<0?Math.PI:0))*(sprint?.95:run?.7:crouched?.17:backward?.28:.40)*direction:Math.sin(time*1.7)*(heldIdle?.10:.025);
     // One small, slow balancing cycle over the whole flight, independent of running cadence.
     // The same take-off/landing blend as the legs keeps the transition smooth.
     // Oppose the split legs: right arm back, left arm forward, with a small balancing sway.
     const flightSwing=(a.side<0?.65:-.75)+(a.side<0?1:-1)*Math.sin(flight*Math.PI*2)*.08;
     const swing=THREE.MathUtils.lerp(gaitSwing,flightSwing,flightPose);
     const gaitElbow=sprint?-1.35:run?-1.1:crouched?-.6:-.13;
     const elbow=THREE.MathUtils.lerp(gaitElbow,a.side<0?-.60:-.95,flightPose);
     // HD arms hang closer to the body, so they open up while moving to clear the thighs.
     a.arm.rotation.set(swing-(crouched?.4:0),0,a.side*(motion==='pose'?.9:HD&&sprint?.24:HD&&run?.2:HD&&moving?.13:.10));a.elbow.rotation.x=elbow;a.wrist.rotation.set(0,0,0);
   }
   if(lateralAttack){
     // Layer the strike on the torso and equipped arm only. The feet keep their original
     // walking/running IK targets, and the free arm continues its balancing swing.
     const p=poseAt('attackLateral',time);
     trunk.rotation.y=p.twist;trunk.rotation.x+=p.trunk;
     if(spec.items.armMotion[motion])arms.forEach((a,i)=>{
       if(spec.items.placement!=='both'&&a.side!==-attackSide)return;
       const [pitch,spread,elbow,yaw=0]=p.arms[i];
       a.arm.rotation.set(pitch,yaw,a.side*spread);a.elbow.rotation.x=elbow;
       a.wrist.rotation.y=-a.side*THREE.MathUtils.degToRad(-20);
     });
   }
   holdItemPose(motion);applyArmAdjustment();
 };
 update(0);
 let triangles=0,count=0;root.traverse(o=>{if((o as THREE.Mesh).isMesh){const g=(o as THREE.Mesh).geometry;triangles+=(g.index?.count??g.attributes.position.count)/3*((o as THREE.InstancedMesh).isInstancedMesh?(o as THREE.InstancedMesh).count:1);count++;}});
 return {root,nodes,sockets,detail,stats:{triangles,meshes:count},update,setExpression,dispose(){linkedItemDisposers.forEach(dispose=>dispose());geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());root.removeFromParent();}};
}
