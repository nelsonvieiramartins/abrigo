export const CELLS=100, SIZE=100, HALF=50;
export const SURFACES=[
 {name:'Base',color:null}, {name:'Grama',color:'#6e9451'},
 {name:'Terra',color:'#987453'}, {name:'Areia',color:'#c5ae77'},
 {name:'Pedra',color:'#828b89'}, {name:'Água',color:'#4a8baf'},
 {name:'Neve',color:'#dbe5df'}, {name:'Caminho',color:'#b79b78'},
 {name:'Rua de pedra medieval',color:'#898478'}
];
export function emptyTerrain(){return {version:1,size:SIZE,cells:CELLS,heights:Array((CELLS+1)**2).fill(0),surfaces:Array(CELLS**2).fill(0)};}
export function validateTerrain(t){
 if(t==null)return;
 if(t.waterPath!==undefined&&(!Array.isArray(t.waterPath)||t.waterPath.length>12||!t.waterPath.every(point=>Array.isArray(point)&&point.length===2&&point.every(value=>Number.isFinite(value)&&value>=-HALF&&value<=HALF))))throw Error('Trajetória da correnteza inválida.');
 for(const [key,max] of [['waterSpeed',3],['waterDirection',360]])if(t[key]!==undefined&&(!Number.isFinite(t[key])||t[key]<0||t[key]>max))throw Error('Ajuste de correnteza inválido.');
 for(const [key,min,max] of [['curbWidth',.08,.6],['roadDepth',.03,.5],['roadAngle',0,180],['roadBlockScale',.5,2.5]])if(t[key]!==undefined&&(!Number.isFinite(t[key])||t[key]<min||t[key]>max))throw Error('Ajuste de rua inválido.');
 if(t.roadEndCaps!==undefined&&typeof t.roadEndCaps!=='boolean')throw Error('Fechamento da rua inválido.');
 if(t.roadCaps!==undefined&&(!Array.isArray(t.roadCaps)||t.roadCaps.length!==CELLS**2||!t.roadCaps.every(value=>value===0||value===1)))throw Error('Pincel de fechamento da rua inválido.');
 if(t.roadPattern!==undefined&&!['brick','hex'].includes(t.roadPattern))throw Error('Textura da rua inválida.');
 if(t.roadLevel!==undefined&&(!Number.isFinite(t.roadLevel)||t.roadLevel< -21||t.roadLevel>30))throw Error('Nível da rua inválido.');
 if(t.waterDepth!==undefined&&(!Number.isFinite(t.waterDepth)||t.waterDepth<.04||t.waterDepth>1.15))throw Error('Nível da água inválido.');
 if(t.version!==1||t.size!==SIZE||t.cells!==CELLS||!Array.isArray(t.heights)||t.heights.length!==(CELLS+1)**2||!t.heights.every(v=>Number.isFinite(v)&&v>=-20&&v<=30)||!Array.isArray(t.surfaces)||t.surfaces.length!==CELLS**2||!t.surfaces.every(v=>Number.isInteger(v)&&v>=0&&v<SURFACES.length))throw Error('Dados do terreno inválidos.');
}
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
export function heightAt(t,x,z){
 if(x < -HALF||x > HALF||z < -HALF||z > HALF)return 0;
 const cells=t.cells,scale=cells/SIZE,u=clamp((x+HALF)*scale,0,cells),v=clamp((z+HALF)*scale,0,cells),ix=Math.min(cells-1,Math.floor(u)),iz=Math.min(cells-1,Math.floor(v)),fx=u-ix,fz=v-iz,i=iz*(cells+1)+ix;
 const a=t.heights[i],b=t.heights[i+1],c=t.heights[i+cells+1],d=t.heights[i+cells+2];
 // Match the two triangles used by the rendered cell (diagonal b-c).
 return fx+fz<=1?a+(b-a)*fx+(c-a)*fz:d+(c-d)*(1-fx)+(b-d)*(1-fz);
}
export function brush(t,x,z,{tool='paint',radius=2,strength=.35,level=0,surface=1}={}){
 let changed=false;const paint=['paint','erase'].includes(tool),offset=paint ? .5 : 0,n=paint?CELLS:CELLS+1;
 const source=tool==='smooth'?t.heights.slice():null;
 for(let j=Math.max(0,Math.floor(z+HALF-radius));j<=Math.min(n-1,Math.ceil(z+HALF+radius));j++)for(let i=Math.max(0,Math.floor(x+HALF-radius));i<=Math.min(n-1,Math.ceil(x+HALF+radius));i++){
  let distance=Math.hypot(i-HALF+offset-x,j-HALF+offset-z);
  // Small brushes must still affect the cell/vertex under the pointer.
  const nearest=paint?i===Math.floor(x+HALF)&&j===Math.floor(z+HALF):i===Math.round(x+HALF)&&j===Math.round(z+HALF);
  if(radius<.75&&nearest)distance=0;
  if(distance>radius)continue;
  const index=j*n+i;
  if(paint){const next=tool==='erase'?0:surface;if(t.surfaces[index]!==next){t.surfaces[index]=next;changed=true;}continue;}
  const old=t.heights[index],weight=Math.max(.12,1-distance/radius);let next=old;
  if(tool==='raise')next=old+strength*weight;
  if(tool==='lower')next=old-strength*weight;
  if(tool==='flatten'){const edge=clamp((1-distance/radius)*3,0,1),falloff=edge*edge*(3-2*edge);next=old+(level-old)*Math.min(1,strength*2)*falloff;}
  if(tool==='smooth'){let sum=0,count=0;for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){const a=i+dx,b=j+dz;if(a>=0&&a<n&&b>=0&&b<n){sum+=source[b*n+a];count++;}}next=old+(sum/count-old)*Math.min(1,strength*2);}
  next=Math.round(clamp(next,-20,30)*10000)/10000;
  if(next!==old){t.heights[index]=next;changed=true;}
 }
 return changed;
}
export function paintLine(t,a,b,options){const distance=Math.hypot(b.x-a.x,b.z-a.z),steps=Math.max(1,Math.ceil(distance/.4));let changed=false;for(let i=0;i<=steps;i++){const f=i/steps;changed=brush(t,a.x+(b.x-a.x)*f,a.z+(b.z-a.z)*f,{...options,tool:'paint'})||changed;}return changed;}
export function fillRegion(t,x,z,surface){const ix=Math.floor(x+HALF),iz=Math.floor(z+HALF);if(ix<0||ix>=CELLS||iz<0||iz>=CELLS)return false;const start=iz*CELLS+ix,old=t.surfaces[start];if(old===surface)return false;const stack=[start];t.surfaces[start]=surface;while(stack.length){const i=stack.pop(),cx=i%CELLS,cy=Math.floor(i/CELLS);for(const [nx,ny] of [[cx-1,cy],[cx+1,cy],[cx,cy-1],[cx,cy+1]]){if(nx<0||nx>=CELLS||ny<0||ny>=CELLS)continue;const k=ny*CELLS+nx;if(t.surfaces[k]===old){t.surfaces[k]=surface;stack.push(k);}}}return true;}
