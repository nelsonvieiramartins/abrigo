// Browser-side, credit-free version of img2threejs' intake + spec stages for simple objects:
// probe the image, cut the silhouette from the background, measure it row by row, split it into
// colour bands and propose a blockout (revolved, extruded or stacked blocks). Pure functions on
// RGBA pixels, so they run in the editor and in Node tests alike.
import {newPartId,validateObjectSpec,type ObjectPart,type ObjectSpec} from './object-schema';

export interface Pixels{width:number;height:number;data:Uint8ClampedArray|Uint8Array}
export interface Mask{width:number;height:number;data:Uint8Array}
// How much of the image is kept. Higher levels read more colours, more bands and tighter contours.
export type DetailLevel='low'|'medium'|'high';
export const DETAIL={
  low:   {resolution:320,colors:3,merge:48,maxBands:5, bandThreshold:60,minBand:.06, samples:8, epsilon:1.8,minRegion:.03, holes:false},
  medium:{resolution:480,colors:5,merge:36,maxBands:8, bandThreshold:44,minBand:.035,samples:16,epsilon:1,  minRegion:.012,holes:true},
  high:  {resolution:720,colors:7,merge:26,maxBands:14,bandThreshold:32,minBand:.018,samples:32,epsilon:.6, minRegion:.004,holes:true},
} as const;
export type DetailSettings=typeof DETAIL[DetailLevel];
export interface Band{y0:number;y1:number;color:[number,number,number]}
export interface Analysis{
  mask:Mask;                      // cropped to the silhouette bounds
  crop:{x:number;y:number;width:number;height:number}; // in the source image
  rows:{left:number;right:number}[]; // per mask row (top to bottom); left > right means empty
  axis:number;                    // vertical axis (px, in mask space)
  symmetry:number;                // 0..1, how mirror-symmetric the silhouette is about the axis
  bands:Band[];                   // colour bands, top to bottom (rows in mask space)
  palette:string[];               // dominant colours
  labels:Uint8Array;              // per mask pixel: palette index, 255 = background
  suggestion:'lathe'|'extrude'|'blocks';
}
const hex=(c:number[])=>'#'+c.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
const dist=(a:number[],b:number[])=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);

// Background removal: transparent pixels, or pixels close to the border's median colour.
export function silhouette(img:Pixels,tolerance=42):Mask{
  const {width:w,height:h,data}=img,mask=new Uint8Array(w*h),border:number[][]=[];
  let transparent=0;
  for(let x=0;x<w;x++)for(const y of [0,h-1]){const i=(y*w+x)*4;border.push([data[i],data[i+1],data[i+2]]);if(data[i+3]<20)transparent++;}
  for(let y=0;y<h;y++)for(const x of [0,w-1]){const i=(y*w+x)*4;border.push([data[i],data[i+1],data[i+2]]);if(data[i+3]<20)transparent++;}
  const useAlpha=transparent>border.length*.5;
  const med=[0,1,2].map(k=>border.map(c=>c[k]).sort((a,b)=>a-b)[border.length>>1]);
  for(let i=0;i<w*h;i++){const a=data[i*4+3];mask[i]=useAlpha?(a>60?1:0):(a>60&&dist([data[i*4],data[i*4+1],data[i*4+2]],med)>tolerance?1:0);}
  // Keep every sizeable region (a detached handle is part of the object) and drop specks.
  const label=new Int32Array(w*h),stack:number[]=[],sizes=[0];let id=0;
  for(let s=0;s<w*h;s++){if(!mask[s]||label[s])continue;id++;let n=0;stack.push(s);label[s]=id;
    while(stack.length){const i=stack.pop()!;n++;const x=i%w,y=(i/w)|0;for(const j of [x>0?i-1:-1,x<w-1?i+1:-1,y>0?i-w:-1,y<h-1?i+w:-1])if(j>=0&&mask[j]&&!label[j]){label[j]=id;stack.push(j);}}
    sizes.push(n);}
  const keep=Math.max(12,Math.max(0,...sizes)*.02);
  for(let i=0;i<w*h;i++)mask[i]=label[i]>0&&sizes[label[i]]>=keep?1:0;
  return {width:w,height:h,data:mask};
}
export function analyzeImage(img:Pixels,tolerance=42,d:DetailSettings=DETAIL.medium):Analysis{
  const full=silhouette(img,tolerance),W=full.width,H=full.height;
  let x0=W,x1=-1,y0=H,y1=-1;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(full.data[y*W+x]){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
  if(x1<0)throw new Error('Não encontrei o objeto na imagem. Use um fundo liso ou PNG transparente.');
  const w=x1-x0+1,h=y1-y0+1,mask:Mask={width:w,height:h,data:new Uint8Array(w*h)},rows:{left:number;right:number}[]=[];
  for(let y=0;y<h;y++){let l=w,r=-1;for(let x=0;x<w;x++)if(full.data[(y+y0)*W+x+x0]){mask.data[y*w+x]=1;l=Math.min(l,x);r=Math.max(r,x);}rows.push({left:l,right:r});}
  const filled=rows.filter(r=>r.right>=r.left),centres=filled.map(r=>(r.left+r.right)/2).sort((a,b)=>a-b),axis=centres[centres.length>>1];
  // Weighted by row width, so a wide asymmetric part (an axe head) counts more than a thin symmetric one.
  const symmetry=1-filled.reduce((s,r)=>s+Math.abs((axis-r.left)-(r.right-axis)),0)/Math.max(1,filled.reduce((s,r)=>s+r.right-r.left+1,0));
  // Row colour = mean of the silhouette pixels in that row; bands start where it changes clearly.
  const rowColor=rows.map((r,y)=>{let s=[0,0,0],n=0;for(let x=r.left;x<=r.right;x++)if(mask.data[y*w+x]){const i=((y+y0)*W+x+x0)*4;s[0]+=img.data[i];s[1]+=img.data[i+1];s[2]+=img.data[i+2];n++;}return n?s.map(v=>v/n) as [number,number,number]:null;});
  const minRows=Math.max(2,Math.round(h*d.minBand)),bands:Band[]=[];
  for(let y=0;y<h;y++){const c=rowColor[y];if(!c)continue;const b=bands[bands.length-1];
    if(b&&(y-b.y1<=1)&&(dist(b.color,c)<d.bandThreshold||y-b.y0<minRows)){const n=b.y1-b.y0+1;b.color=b.color.map((v,k)=>(v*n+c[k])/(n+1)) as [number,number,number];b.y1=y;}
    else bands.push({y0:y,y1:y,color:[...c]});}
  // Merge tiny bands into their most similar neighbour; keep at most 8.
  const merge=(i:number)=>{const b=bands[i],a=bands[i-1],c=bands[i+1],t=!a?c:!c?a:dist(a.color,b.color)<=dist(c.color,b.color)?a:c;if(!t)return;const n1=t.y1-t.y0+1,n2=b.y1-b.y0+1;t.color=t.color.map((v,k)=>(v*n1+b.color[k]*n2)/(n1+n2)) as [number,number,number];t.y0=Math.min(t.y0,b.y0);t.y1=Math.max(t.y1,b.y1);bands.splice(i,1);};
  for(let i=bands.length-1;i>=0;i--)if(bands.length>1&&bands[i].y1-bands[i].y0+1<minRows)merge(i);
  while(bands.length>d.maxBands){let k=0;for(let i=1;i<bands.length;i++)if(bands[i].y1-bands[i].y0<bands[k].y1-bands[k].y0)k=i;merge(k);}
  // Palette: simple k-means (k=4) on sampled silhouette pixels.
  const samples:number[][]=[];const step=Math.max(1,Math.floor(Math.sqrt(w*h/1500)));
  for(let y=0;y<h;y+=step)for(let x=0;x<w;x+=step)if(mask.data[y*w+x]){const i=((y+y0)*W+x+x0)*4;samples.push([img.data[i],img.data[i+1],img.data[i+2]]);}
  let centers=Array.from({length:d.colors},(_,k)=>samples[Math.floor((k+.5)/d.colors*samples.length)]??[128,128,128]);
  for(let it=0;it<8;it++){const acc=centers.map(()=>[0,0,0,0]);for(const s of samples){let bi=0;for(let k=1;k<centers.length;k++)if(dist(s,centers[k])<dist(s,centers[bi]))bi=k;acc[bi][0]+=s[0];acc[bi][1]+=s[1];acc[bi][2]+=s[2];acc[bi][3]++;}centers=acc.map((a,k)=>a[3]?[a[0]/a[3],a[1]/a[3],a[2]/a[3]]:centers[k]);}
  // Merge near-identical clusters (shading of one material), then label every silhouette pixel.
  const merged:number[][]=[];for(const c of centers)if(!merged.some(m=>dist(m,c)<d.merge))merged.push(c);
  const palette=merged.map(hex),labels=new Uint8Array(w*h).fill(255);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(mask.data[y*w+x]){const i=((y+y0)*W+x+x0)*4,c=[img.data[i],img.data[i+1],img.data[i+2]];let bi=0;for(let k=1;k<merged.length;k++)if(dist(c,merged[k])<dist(c,merged[bi]))bi=k;labels[y*w+x]=bi;}
  // One 3x3 majority pass removes speckles along material borders.
  const smooth=labels.slice();for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x;if(labels[i]===255)continue;const n=new Map<number,number>();for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const l=labels[i+dy*w+dx];if(l!==255)n.set(l,(n.get(l)??0)+1);}let best=labels[i],bc=0;for(const [l,c] of n)if(c>bc){bc=c;best=l;}smooth[i]=best;}
  labels.set(smooth);
  const aspect=w/h,suggestion=symmetry>.9&&aspect<1.6?'lathe':symmetry<.75||aspect>1.4?'extrude':'blocks';
  return {mask,crop:{x:x0,y:y0,width:w,height:h},rows,axis,symmetry,bands,palette,labels,suggestion};
}

// Colour regions: connected pixels of one palette colour. Small ones are absorbed by the silhouette of
// their neighbours (they stay covered by the region extruded around them).
export function colorRegions(a:Analysis,minFraction=.015){
  const {width:w,height:h}=a.mask,seen=new Uint8Array(w*h),out:{color:string;pixels:Uint8Array;area:number}[]=[];let total=0;
  for(const l of a.labels)if(l!==255)total++;
  for(let s=0;s<w*h;s++){const l=a.labels[s];if(l===255||seen[s])continue;const px=new Uint8Array(w*h),stack=[s];seen[s]=1;let n=0;
    while(stack.length){const i=stack.pop()!;px[i]=1;n++;const x=i%w,y=(i/w)|0;for(const j of [x>0?i-1:-1,x<w-1?i+1:-1,y>0?i-w:-1,y<h-1?i+w:-1])if(j>=0&&!seen[j]&&a.labels[j]===l){seen[j]=1;stack.push(j);}}
    if(n>=total*minFraction)out.push({color:a.palette[l],pixels:px,area:n});}
  return out.sort((p,q)=>q.area-p.area);
}
// Outer boundary of a binary region (Moore-neighbour tracing), simplified with Douglas-Peucker.
export function traceContour(px:Uint8Array,w:number,h:number,epsilon=1.2):[number,number][]{
  const on=(x:number,y:number)=>x>=0&&y>=0&&x<w&&y<h&&px[y*w+x]===1,D=[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
  let start=-1;for(let i=0;i<w*h;i++)if(px[i]){start=i;break;}if(start<0)return [];
  const sx=start%w,sy=(start/w)|0,pts:[number,number][]=[[sx,sy]];let x=sx,y=sy,back=4;
  for(let guard=0;guard<w*h*4;guard++){
    let moved=false;
    for(let k=1;k<=8;k++){const d=(back+k)%8,nx=x+D[d][0],ny=y+D[d][1];if(on(nx,ny)){const pd=(d+7)%8,bx=x+D[pd][0],by=y+D[pd][1];x=nx;y=ny;back=D.findIndex(v=>v[0]===bx-x&&v[1]===by-y);moved=true;break;}}
    if(!moved||(x===sx&&y===sy))break;pts.push([x,y]);
  }
  const dp=(p:[number,number][]):[number,number][]=>{if(p.length<3)return p;const [a,b]=[p[0],p[p.length-1]];let far=0,fi=0;const L=Math.hypot(b[0]-a[0],b[1]-a[1])||1;
    for(let i=1;i<p.length-1;i++){const d=Math.abs((b[0]-a[0])*(a[1]-p[i][1])-(a[0]-p[i][0])*(b[1]-a[1]))/L;if(d>far){far=d;fi=i;}}
    return far>epsilon?[...dp(p.slice(0,fi+1)).slice(0,-1),...dp(p.slice(fi))]:[a,b];};
  // Split the loop at its farthest point from the start so both halves simplify well.
  let fi=0,fd=0;for(let i=0;i<pts.length;i++){const d=Math.hypot(pts[i][0]-sx,pts[i][1]-sy);if(d>fd){fd=d;fi=i;}}
  if(pts.length<4)return pts;
  return [...dp(pts.slice(0,fi+1)).slice(0,-1),...dp([...pts.slice(fi),pts[0]]).slice(0,-1)];
}

// Holes of a region: pixels it encloses that are not part of it (a handle opening, or another colour
// region such as a label, which is then extruded separately inside the hole instead of overlapping).
export function regionHoles(px:Uint8Array,w:number,h:number,epsilon:number,area:number,max=12){
  const outside=new Uint8Array(w*h),stack:number[]=[];
  for(let x=0;x<w;x++)for(const y of [0,h-1]){const i=y*w+x;if(!px[i]&&!outside[i]){outside[i]=1;stack.push(i);}}
  for(let y=0;y<h;y++)for(const x of [0,w-1]){const i=y*w+x;if(!px[i]&&!outside[i]){outside[i]=1;stack.push(i);}}
  while(stack.length){const i=stack.pop()!,x=i%w,y=(i/w)|0;for(const j of [x>0?i-1:-1,x<w-1?i+1:-1,y>0?i-w:-1,y<h-1?i+w:-1])if(j>=0&&!px[j]&&!outside[j]){outside[j]=1;stack.push(j);}}
  const seen=new Uint8Array(w*h),holes:[number,number][][]=[];
  for(let s=0;s<w*h&&holes.length<max;s++){if(px[s]||outside[s]||seen[s])continue;const comp=new Uint8Array(w*h);let n=0;stack.push(s);seen[s]=1;
    while(stack.length){const i=stack.pop()!;comp[i]=1;n++;const x=i%w,y=(i/w)|0;for(const j of [x>0?i-1:-1,x<w-1?i+1:-1,y>0?i-w:-1,y<h-1?i+w:-1])if(j>=0&&!px[j]&&!outside[j]&&!seen[j]){seen[j]=1;stack.push(j);}}
    if(n>=Math.max(6,area*.002)){const c=traceContour(comp,w,h,epsilon);if(c.length>=3)holes.push(c);}}
  return holes;
}

// Turn the analysis into a recipe. The image's silhouette height becomes `heightMetres`.
export function blockout(a:Analysis,method:'lathe'|'extrude'|'blocks',heightMetres:number,name='Objeto da imagem',depthRatio=.3,d:DetailSettings=DETAIL.medium):ObjectSpec{
  const {mask:{height:h},rows,axis}=a,s=heightMetres/h,Y=(row:number)=>(h-row)*s;
  const parts:ObjectPart[]=[],half=(r:{left:number;right:number})=>r.right>=r.left?Math.max(0,((r.right-r.left+1)/2)*s):0;
  const sample=(b:Band,max:number)=>{const n=b.y1-b.y0+1,k=Math.max(1,Math.ceil(n/max)),out:number[]=[];for(let y=b.y0;y<=b.y1;y+=k)out.push(y);if(out[out.length-1]!==b.y1)out.push(b.y1);return out;};
  let maxW=0;for(const r of rows)maxW=Math.max(maxW,half(r)*2);
  // Bands are listed top to bottom; each band's rows cover [y0, y1+1) so neighbours share an edge.
  if(method==='extrude'){
    const regions=colorRegions(a,d.minRegion),depth=+Math.max(.004,maxW*depthRatio).toFixed(4);
    regions.forEach((r,i)=>{
      // Pixel centres sit half a pixel inside the edge; grow the contour back out by that half pixel.
      const c=traceContour(r.pixels,a.mask.width,h,d.epsilon);if(c.length<3)return;
      const cx=c.reduce((t,p)=>t+p[0],0)/c.length,cy=c.reduce((t,p)=>t+p[1],0)/c.length;
      const outline=c.map(([x,y])=>{const dx=x-cx,dy=y-cy,l=Math.hypot(dx,dy)||1;return [+(((x+.5+dx/l*.5)-axis)*s).toFixed(4),+(Y(y+.5+dy/l*.5)).toFixed(4)] as [number,number];});
      // Regions are disjoint, so they sit side by side in the same plane.
      parts.push({id:newPartId(),name:`Região ${i+1}`,shape:'extrude',position:[0,0,0],rotation:[0,0,0],size:[1,1,depth],color:r.color,roughness:.75,metalness:0,bevel:.15,outline,...(d.holes?{holes:regionHoles(r.pixels,a.mask.width,h,d.epsilon,r.area).map(hole=>hole.map(([x,y])=>[+((x+.5-axis)*s).toFixed(4),+Y(y+.5).toFixed(4)] as [number,number]))}:{})});
    });
    if(parts.length)return validateObjectSpec({kind:'object',schemaVersion:1,name,category:'misc',wear:.15,parts,sockets:[],source:{method:'imagem → extrusão',heightMetres}});
  }
  const rgb=(c:string)=>[1,3,5].map(k=>parseInt(c.slice(k,k+2),16));
  a.bands.forEach((b,i)=>{
    const color=hex(b.color),base={id:newPartId(),name:`Faixa ${i+1}`,position:[0,0,0] as [number,number,number],rotation:[0,0,0] as [number,number,number],color,roughness:.75,metalness:0,bevel:.15};
    const ys=sample(b,d.samples),edge=b.y1+1<h?b.y1+1:b.y1;
    // Open bands (rows with gaps, e.g. a handle loop) cannot be revolved: cut them out as a thin plate.
    let filled=0,span=0;for(let y=b.y0;y<=b.y1;y++){const r=rows[y];if(r.right<r.left)continue;span+=r.right-r.left+1;for(let x=r.left;x<=r.right;x++)filled+=a.mask.data[y*a.mask.width+x];}
    if(method==='lathe'&&span&&filled/span<.6){
      const W=a.mask.width,px=new Uint8Array(W*h);for(let y=b.y0;y<=b.y1;y++)for(let x=0;x<W;x++)px[y*W+x]=a.mask.data[y*W+x];
      const toWorld=([x,y]:[number,number])=>[+((x+.5-axis)*s).toFixed(4),+Y(y+.5).toFixed(4)] as [number,number];
      const c=traceContour(px,W,h,d.epsilon);
      if(c.length>=3)parts.push({...base,name:`Faixa ${i+1} (vazada)`,shape:'extrude',size:[1,1,+Math.max(.004,heightMetres*.035).toFixed(4)],outline:c.map(toWorld),holes:regionHoles(px,W,h,d.epsilon,filled).map(hole=>hole.map(toWorld))});
      return;
    }
    if(method==='lathe'){
      const prof:[number,number][]=[[0,Y(edge)],[half(rows[b.y1]),Y(edge)],...[...ys].reverse().map(y=>[half(rows[y]),Y(y)] as [number,number]),[0,Y(b.y0)]];
      // The profile must run bottom to top for LatheGeometry.
      parts.push({...base,shape:'lathe',size:[1,1,1],profile:prof.map(([r,y])=>[+r.toFixed(4),+y.toFixed(4)])});
    }else if(method==='extrude'){
      const left=ys.map(y=>[(rows[y].left-axis)*s,Y(y)] as [number,number]),right=ys.map(y=>[(rows[y].right+1-axis)*s,Y(y)] as [number,number]);
      left.push([(rows[b.y1].left-axis)*s,Y(edge)]);right.push([(rows[b.y1].right+1-axis)*s,Y(edge)]);
      // Contour: down the left side (top to bottom), then up the right side.
      const contour=[...left,...[...right].reverse()].map(([x,y])=>[+x.toFixed(4),+y.toFixed(4)] as [number,number]);
      parts.push({...base,shape:'extrude',size:[1,1,Math.max(.004,maxW*depthRatio)],outline:contour});
    }else{
      let l=Infinity,r=-Infinity;for(let y=b.y0;y<=b.y1;y++)if(rows[y].right>=rows[y].left){l=Math.min(l,rows[y].left);r=Math.max(r,rows[y].right+1);}
      const width=(r-l)*s,height=(edge-b.y0)*s;
      parts.push({...base,shape:'box',size:[+width.toFixed(4),+height.toFixed(4),+Math.max(.004,width*Math.max(depthRatio,.3)*1.6).toFixed(4)],position:[+(((l+r)/2-axis)*s).toFixed(4),+(Y(edge)+height/2).toFixed(4),0]});
    }
  });
  // Revolution only reads horizontal bands; colour regions that do not wrap the whole row (frames,
  // windows, labels seen from the front) become thin decals resting on the front of the revolved part.
  if(method==='lathe'&&d.holes)colorRegions(a,d.minRegion).forEach((r,i)=>{
    let x0=Infinity,x1=-1,y0=Infinity,y1=-1;const W=a.mask.width;
    for(let k=0;k<r.pixels.length;k++)if(r.pixels[k]){const x=k%W,y=(k/W)|0;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
    const mid=(y0+y1)>>1,band=a.bands.find(b=>mid>=b.y0&&mid<=b.y1),row=rows[mid];
    if(!band||row.right<row.left||dist(rgb(r.color),band.color)<d.merge*1.2)return;
    if((x1-x0+1)/(row.right-row.left+1)>.85)return;
    let rmin=Infinity;for(let y=y0;y<=y1;y++)rmin=Math.min(rmin,half(rows[y]));
    const xmax=Math.max(Math.abs(x0-axis),Math.abs(x1+1-axis))*s,z=Math.sqrt(Math.max(0,rmin*rmin-xmax*xmax))+.0015;
    const c=traceContour(r.pixels,W,h,d.epsilon);if(c.length<3)return;
    parts.push({id:newPartId(),name:`Detalhe ${i+1}`,shape:'extrude',position:[0,0,+z.toFixed(4)],rotation:[0,0,0],size:[1,1,.003],color:r.color,roughness:.7,metalness:0,bevel:0,
      outline:c.map(([x,y])=>[+((x+.5-axis)*s).toFixed(4),+Y(y+.5).toFixed(4)] as [number,number])});
  });
  return validateObjectSpec({kind:'object',schemaVersion:1,name,category:'misc',wear:.15,parts,sockets:[],source:{method:'imagem → '+({lathe:'revolução',extrude:'extrusão',blocks:'blocos'}[method]),heightMetres}});
}

// Silhouette agreement (intersection over union) between two masks of the same size.
export function silhouetteIoU(a:Mask,b:Mask){let i=0,u=0;for(let k=0;k<a.data.length;k++){const x=a.data[k]>0,y=b.data[k]>0;if(x&&y)i++;if(x||y)u++;}return u?i/u:0;}
