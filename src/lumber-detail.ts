import * as THREE from 'three';
import {CharacterSpec} from './schema';

// Broad, deliberately placed planes retain their silhouette at every detail level.
export function addLumberDetails(c:{spec:CharacterSpec;root:THREE.Group;nodes:Record<string,THREE.Object3D>;geometries:Set<THREE.BufferGeometry>;materials:Set<THREE.Material>;torsoAt:(y:number)=>number[];headAt:(y:number)=>number[]}){
 const {spec,root,nodes,geometries,materials,torsoAt,headAt}=c;
 if(spec.outfit.top!=='lumber'&&spec.appearance.hair!=='lumber'&&spec.appearance.beard!=='lumber')return;
 const material=(hex:string)=>{const m=new THREE.MeshStandardMaterial({color:hex,roughness:.88,flatShading:true,vertexColors:true,side:THREE.DoubleSide});materials.add(m);return m;};
 const leather=material('#75482b'),edge=material('#462c22'),gold=material('#bd9653'),hair=material(spec.appearance.hairColor),cuff=material('#969174');
 const mesh=(name:string,g:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Object3D)=>{
   const geo=g.index?g.toNonIndexed():g;if(geo!==g)g.dispose();
   const p=geo.getAttribute('position'),colors:number[]=[];
   for(let i=0;i<p.count;i+=3){const k=.91+.12*(.5+.5*Math.sin(i*17.31));for(let j=0;j<3;j++)colors.push(k,k,k);}
   geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();geometries.add(geo);
   const o=new THREE.Mesh(geo,m);o.name=name;o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;
 };
 const poly=(name:string,points:number[][],indices:number[],m:THREE.Material,parent:THREE.Object3D)=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));g.setIndex(indices);return mesh(name,g,m,parent);};
 const box=(name:string,size:number[],pos:number[],m:THREE.Material,parent:THREE.Object3D)=>{const o=mesh(name,new THREE.BoxGeometry(...size as [number,number,number]),m,parent);o.position.fromArray(pos);return o;};
 const lock=(name:string,a:number[],b:number[],w:number,d:number,parent:THREE.Object3D)=>{
   const mid=a.map((v,i)=>v*.55+b[i]*.45);
   return poly(name,[[a[0]-w,a[1],a[2]],[a[0]+w,a[1],a[2]],[mid[0],mid[1],mid[2]+d],b,[a[0],a[1]+.012,a[2]-.015]],[0,1,2,0,2,3,2,1,3,0,4,1,0,3,4,1,4,3],hair,parent);
 };
 const head=nodes.head;
 if(spec.style==='faceted'){
   const face=head.children.find(o=>o.name==='head-shape') as THREE.Mesh;
   if(face){const p=face.geometry.getAttribute('position');for(let i=0;i<p.count;i++){
     const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
     if(z>.025){const cheek=Math.exp(-(((Math.abs(x)-.061)/.024)**2)-(((y-.113)/.024)**2));p.setZ(i,z+.009*cheek);}
   }p.needsUpdate=true;face.geometry.computeVertexNormals();}
 }
 if(spec.appearance.hair==='lumber'&&spec.outfit.hat==='none'){
   // Close-cropped shell hugs temples and nape beneath the longer swept locks.
   const hp:number[][]=[],hi:number[]=[],hc=24,hr=4;
   const cropped=material('#'+new THREE.Color(spec.appearance.hairColor).lerp(new THREE.Color('#66666b'),.13).getHexString());
   for(let j=0;j<=hr;j++)for(let i=0;i<=hc;i++){
     const a=.79+i/hc*(Math.PI*2-1.58),bottom=.060+.106*Math.max(0,Math.cos(a))+.070*Math.pow(Math.abs(Math.sin(a)),4);
     const y=bottom+(.244-bottom)*j/hr,[w,d,z]=headAt(y);
     hp.push([Math.sin(a)*(w+.0045),y,z+Math.cos(a)*(d+.0045)]);
     if(j<hr&&i<hc){const k=j*(hc+1)+i;hi.push(k,k+1,k+hc+1,k+1,k+hc+2,k+hc+1);}
   }
   poly('lumber-cropped-hair',hp,hi,cropped,head);
   const cap=mesh('lumber-hair-cap',new THREE.SphereGeometry(1,12,6),hair,head);cap.scale.set(.093,.060,.09);cap.position.set(0,.239,-.020);
   for(let i=-3;i<=3;i++){
     const x=i*.025,y=.227+Math.abs(i)*.006;
     lock('lumber-swept-lock',[x,y,.084-Math.abs(i)*.006],[x-.038,.300+(.030-Math.abs(i)*.009),.010],.025,.035,head);
     for(const side of [-1,1])lock('lumber-side-lock',[side*.080,.243-i*.012,-.015],[side*(.108+Math.max(0,i)*.003),.214-i*.016,-.058],.018,.014,head);
   }
 }
 if(spec.appearance.beard==='lumber'){
   // Fuller lower beard wraps under the jaw toward the neck, preserving the mouth opening.
   const points:number[][]=[],idx:number[]=[];const rows=6,cols=16;
   for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
     const a=-Math.PI*.64+i/cols*Math.PI*1.28,t=j/rows,front=Math.max(0,Math.cos(a));
     const top=.035+.075*Math.pow(Math.abs(Math.sin(a)),.8),bottom=-.071*front-.014*(1-front),y=top*(1-t)+bottom*t;
     const [w,d,z]=headAt(Math.max(.040,y));const bulge=Math.sin(t*Math.PI)*.032;
     // Tapered barber line from the cheek to the neck; fullness remains in depth, not at the sides.
     const trimWidth=Math.max(.064+.030*THREE.MathUtils.clamp((y+.071)/.181,0,1),y>.01?headAt(y)[0]+.006:0);
     points.push([Math.sin(a)*trimWidth,y,z+Math.cos(a)*(d+.020+bulge)]);
     if(j<rows&&i<cols){const n=j*(cols+1)+i;idx.push(n,n+1,n+cols+1,n+1,n+cols+2,n+cols+1);}
   }
   poly('lumber-beard',points,idx,hair,head);
   const under:number[][]=[],ui:number[]=[];
   for(let i=0;i<=cols;i++){
     const a=-Math.PI*.64+i/cols*Math.PI*1.28;
     under.push(points[rows*(cols+1)+i],[Math.sin(a)*.042,-.027,.006+Math.cos(a)*.034]);
     if(i<cols){const k=i*2;ui.push(k,k+2,k+1,k+2,k+3,k+1);}
   }
   poly('lumber-beard-underjaw',under,ui,hair,head);
   for(const side of [-1,1]){
     const z=headAt(.07)[1]+headAt(.07)[2];
     lock('lumber-moustache',[side*.011,.078,z+.017],[side*.071,.049,z+.006],.020,.014,head);
     for(let i=0;i<4;i++){
       const tuft=lock('lumber-beard-lock',[side*(.028+i*.016),.026+i*.019,.111-i*.008],[side*(.021+i*.022),-.081+i*.024,.107-i*.014],.023,.022,head);
       tuft.scale.x=.80;
     }
   }
 }
 if(spec.outfit.top!=='lumber')return;
 // Plaid is sampled into subdivided surface cells: no image files or texture loaders.
 const plaid=material('#ffffff');
 for(const o of [...nodes.spine.children,...nodes.upperArmR.children,...nodes.upperArmL.children]){
   if(!(o instanceof THREE.Mesh)||!(o.name==='torso'||o.name.startsWith('upper-arm')))continue;
   const isTorso=o.name==='torso',rows=isTorso?16:10,cols=16,positions:number[]=[],colors:number[]=[];
   const base=new THREE.Color(spec.outfit.topColor);
   const point=(i:number,j:number)=>{
     const y=isTorso?.154+j/rows*.381:.04-j/rows*.32,a=i/cols*Math.PI*2;
     const dome=j===0?.20:j===1?.85:1;
     const [w,d,z]=isTorso?torsoAt(y):[.068*(.9+.3*spec.body.build)*(1-.23*j/rows)*dome,.069*(.9+.3*spec.body.build)*(1-.23*j/rows)*dome,0];
     return [Math.sin(a)*w,y,Math.cos(a)*d+z];
   };
   for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
     const a=point(i,j),b=point(i+1,j),d=point(i,j+1),e=point(i+1,j+1);
     const u=i%4,v=j%4,col=u===0&&v===0?new THREE.Color('#baaa50'):u===0||v===0?new THREE.Color('#858749'):base.clone().multiplyScalar(u===2||v===2?.64:1.08);
     for(const p of [a,b,d,b,e,d]){positions.push(...p);colors.push(col.r,col.g,col.b);}
   }
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
   g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();geometries.add(g);o.geometry=g;o.material=plaid;
 }
 // Query the actual triangulated cloth in spine-local space, not an ideal ellipse.
 const cloth=nodes.spine.children.find(o=>o.name==='torso') as THREE.Mesh;
 const clothSurface=new THREE.Mesh(cloth.geometry,plaid);
 const ray=new THREE.Raycaster();
 const surfaceZ=(surfaces:THREE.Mesh[],x:number,y:number,fallback:number)=>{
   ray.set(new THREE.Vector3(x,y,2),new THREE.Vector3(0,0,-1));
   return ray.intersectObjects(surfaces,false)[0]?.point.z??fallback;
 };
 const front=(x:number,y:number,lift=.003)=>{const [w,d,z]=torsoAt(y);return surfaceZ([clothSurface],x,y,z+d*Math.sqrt(Math.max(0,1-(x/w)**2)))+lift;};
 const jacketSurfaces:THREE.Mesh[]=[];
 const jacketPoint=(a:number,y:number)=>{
   const [w,d,z]=torsoAt(y),direction=new THREE.Vector3(Math.sin(a),0,Math.cos(a));
   ray.set(new THREE.Vector3(direction.x*2,y,z+direction.z*2),direction.clone().negate());
   const hit=ray.intersectObject(clothSurface,false)[0];
   return hit?hit.point.addScaledVector(direction,.006).toArray():[Math.sin(a)*(w+.006),y,z+Math.cos(a)*(d+.006)];
 };
 const jacketFront=(x:number,y:number,lift=.002)=>surfaceZ(jacketSurfaces,x,y,front(x,y,.006))+lift;
 const panel=(name:string,xy:number[][],m:THREE.Material,lift=.02)=>{
   const center=xy.reduce((a,p)=>a.map((v,i)=>v+p[i]/xy.length),[0,0]),pts:number[][]=[],ix:number[]=[];
   const triangle=(a:number[],b:number[],c:number[],depth:number)=>{
     if(depth){const ab=a.map((v,i)=>(v+b[i])/2),bc=b.map((v,i)=>(v+c[i])/2),ca=c.map((v,i)=>(v+a[i])/2);triangle(a,ab,ca,depth-1);triangle(ab,b,bc,depth-1);triangle(ca,bc,c,depth-1);triangle(ab,bc,ca,depth-1);return;}
     for(const [x,y] of [a,b,c]){ix.push(pts.length);pts.push([x,y,name==='lumber-lapel'||name.startsWith('lumber-jacket-pocket')?jacketFront(x,y,lift):front(x,y,lift)]);}
   };
   // Sample the curved chest inside each lapel, not only along its outline.
   for(let i=0;i<xy.length;i++)triangle(xy[i],xy[(i+1)%xy.length],center,name==='lumber-lapel'?2:1);
   return poly(name,pts,ix,m,nodes.spine);
 };
 const width=torsoAt(.43)[0];
 panel('lumber-open-neck',[[-.045,.535],[.045,.535],[.025,.483],[0,.451],[-.025,.483]],material(spec.appearance.skin),.001);
 for(const side of [-1,1]){
   const fp:number[][]=[],fi:number[]=[],heights=[.14,...Array.from({length:14},(_,j)=>.154+j/15*.381).filter(y=>y<.49),.49];
   for(let j=0;j<heights.length;j++)for(let i=0;i<=6;i++){
     const y=heights[j],start=Math.asin(Math.min(.94,.095/(torsoAt(y)[0]+.006)));
     fp.push(jacketPoint(side*(start+(Math.PI/2-start)*i/6),y));
     if(j<heights.length-1&&i<6){const k=j*7+i;fi.push(k,k+1,k+7,k+1,k+8,k+7);}
   }
   const jacket=poly('lumber-jacket-front',fp,fi,leather,nodes.spine);
   jacketSurfaces.push(new THREE.Mesh(jacket.geometry,leather));
   const lapel=panel('lumber-lapel',[[side*.095,.49],[side*.151,.442],[side*.112,.408],[side*.145,.379],[side*.095,.32]],leather,.0035);
   panel('lumber-shirt-collar',[[side*.025,.527],[side*.059,.514],[side*.065,.475],[side*.035,.489]],material('#7d873e'),.003);
   // Continuous shoulder saddle: the same surface wraps from chest to back above the armhole.
   const yp:number[][]=[],yi:number[]=[],shoulderRows=[.49,.5111875,.535];
   for(let j=0;j<shoulderRows.length;j++)for(let i=0;i<=12;i++){
     const y=shoulderRows[j],opening=.095-(y-.49)/.045*.05;
     const start=Math.asin(Math.min(.94,opening/(torsoAt(y)[0]+.006))),a=start+(Math.PI-2*start)*i/12;
     yp.push(jacketPoint(side*a,y));
     if(j<shoulderRows.length-1&&i<12){const k=j*13+i;yi.push(k,k+1,k+13,k+1,k+14,k+13);}
   }
   poly('lumber-jacket-shoulder',yp,yi,leather,nodes.spine);
   // This yoke bridges the torso and sleeve sockets.  It is evaluated against the
   // upper torso envelope instead of stopping at the armhole, so it remains a
   // solid leather surface when the character is viewed from above.
   const seam:number[][]=[],seamIndices:number[]=[];
   const shoulderTop=(x:number,z:number)=>{
     let top=.43;
     for(let y=.43;y<=.535;y+=.001){const [w,d,c]=torsoAt(y);if((x/w)**2+((z-c)/d)**2<=1)top=y;}
     return top;
   };
   const centerX=side*torsoAt(.43)[0]*.86;
   for(let i=0;i<=5;i++){
     const a=i/5*Math.PI,[w,d,c]=torsoAt(.455);
     for(const dx of [-.038,.038]){
       const x=centerX+side*dx,z=c+Math.cos(a)*d*Math.sqrt(Math.max(0,1-(x/w)**2));
       seam.push([x,shoulderTop(x,z)+.007,z]);
     }
   }
   for(let i=0;i<5;i++){const k=i*2;seamIndices.push(k,k+1,k+2,k+1,k+3,k+2);}
   poly('lumber-jacket-shoulder-yoke',seam,seamIndices,leather,nodes.spine);
   // A continuous fitted ribbon sits on the flannel, beneath the jacket opening.
   const strap:number[][]=[],strapIndices:number[]=[];
   for(let j=0;j<=8;j++){
     const y=.15401+j/8*.33999;
     for(const x of [side*.083-.0065,side*.083+.0065])strap.push([x,y,front(x,y,.0015)]);
     if(j<8){const k=j*2;strapIndices.push(k,k+1,k+2,k+1,k+3,k+2);}
   }
   poly('lumber-suspender',strap,strapIndices,edge,nodes.spine);
   // Cuff follows the sleeve's joint and its actual end radius, overlapping the cloth edge.
   const arm=nodes['upperArm'+(side<0?'R':'L')],sleeveScale=.9+.3*spec.body.build;
   const roll=mesh('lumber-rolled-cuff',new THREE.CylinderGeometry(1,1,.050,16,1,false),cuff,arm);
   roll.scale.set(.068*sleeveScale*.79+.003,1,.069*sleeveScale*.79+.003);roll.position.y=-.280;
   // Short jacket stays on the torso, ending just above the belt.
   panel('lumber-jacket-pocket',[[side*.110,.248],[side*.167,.258],[side*.170,.203],[side*.111,.194]],leather,.0015);
   const flap=panel('lumber-jacket-pocket-flap',[[side*.108,.259],[side*.170,.269],[side*.164,.240],[side*.132,.227],[side*.109,.235]],leather,.003);
   for(const [x,y,support] of [[.138,.245,flap],[.132,.431,lapel],[.112,.164,jacket]] as const){
     const stud=mesh('lumber-jacket-stud',new THREE.CylinderGeometry(.005,.005,.004,6).rotateX(Math.PI/2),gold,nodes.spine);
     const proxy=new THREE.Mesh(support.geometry,leather);
     stud.position.set(side*x,y,surfaceZ([proxy],side*x,y,jacketFront(side*x,y,0))+.0015);
     const dzdx=(jacketFront(side*x+.001,y,0)-jacketFront(side*x-.001,y,0))/.002;
     stud.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(-dzdx,0,1).normalize());
   }
   const sp:number[][]=[],si:number[]=[],levels=[.14,.22,.32];
   for(let j=0;j<levels.length;j++)for(let i=0;i<=4;i++){
     const y=levels[j],[w,d,z]=torsoAt(y),a=1.0+i/4*.75;
     sp.push([side*Math.sin(a)*(w+.006),y,z+Math.cos(a)*(d+.006)]);
     if(j<levels.length-1&&i<4){const n=j*5+i;si.push(n,n+1,n+5,n+1,n+6,n+5);}
   }
   poly('lumber-jacket-side',sp,si,leather,nodes.spine);
 }
 // Back yoke bridges the two front panels.
 const bp:number[][]=[],bi:number[]=[],ys=[.14,.17,.27,.39,.45,.49,.525];
 for(let j=0;j<ys.length;j++)for(let i=0;i<=8;i++){
   const y=ys[j],[w,d,z]=torsoAt(y),a=Math.PI/2+i/8*Math.PI;
   bp.push([Math.sin(a)*(w+.006),y,z+Math.cos(a)*(d+.006)]);
   if(j<ys.length-1&&i<8){const k=j*9+i;bi.push(k,k+1,k+9,k+1,k+10,k+9);}
 }
 poly('lumber-jacket-back',bp,bi,leather,nodes.spine);
 // Folded rear collar follows the nape, and a narrow hem finishes the waist.
 for(const [name,rows] of [['lumber-jacket-collar',[.493,.523,.550]],['lumber-jacket-hem',[.140,.155]]] as const){
   const p:number[][]=[],ix:number[]=[];
   for(let j=0;j<rows.length;j++)for(let i=0;i<=8;i++){
     const y=rows[j],[w,d,z]=torsoAt(Math.min(y,.525)),a=Math.PI/2+i/8*Math.PI;
     const fold=name.endsWith('collar')?(j===0?.007:j===1?.009:.006):.007;
     p.push([Math.sin(a)*(w+fold),y,z+Math.cos(a)*(d+fold)]);
     if(j<rows.length-1&&i<8){const k=j*9+i;ix.push(k,k+1,k+9,k+1,k+10,k+9);}
   }
   poly(name,p,ix,leather,nodes.spine);
 }
 for(const y of [.185,.26,.335,.41]){const b=mesh('lumber-shirt-button',new THREE.CylinderGeometry(.007,.007,.005,8).rotateX(Math.PI/2),gold,nodes.spine);b.position.set(0,y,front(0,y,.002));}
 for(const o of nodes.spine.children)if(o.name==='belt'||o.name==='buckle')o.visible=false;
 const [waistW,waistD,waistZ]=torsoAt(.154),beltW=waistW+.008,beltD=waistD+.010;
 const belt=mesh('lumber-belt',new THREE.CylinderGeometry(1,1,.036,32,1,true),edge,nodes.spine);
 belt.scale.set(beltW,1,beltD);belt.position.set(0,.134,waistZ);
 const buckleZ=waistZ+beltD+.009;
 for(const x of [-.026,.026])box('lumber-buckle',[.006,.044,.008],[x,.134,buckleZ],gold,nodes.spine);
 for(const y of [.114,.154])box('lumber-buckle',[.058,.006,.008],[0,y,buckleZ],gold,nodes.spine);
 box('lumber-buckle-pin',[.032,.004,.008],[-.008,.134,buckleZ+.004],gold,nodes.spine);
 const pouch=new THREE.Group();pouch.name='lumber-pouch-anchor';
 const angle=-.82;pouch.position.set(Math.sin(angle)*(beltW+.015),0,waistZ+Math.cos(angle)*(beltD+.015));
 pouch.rotation.y=angle;nodes.spine.add(pouch);
 box('lumber-pouch',[.078,.13,.035],[0,.013,.008],leather,pouch);
 box('lumber-pouch-flap',[.083,.039,.010],[0,.062,.031],edge,pouch);
 // Two continuous leather hangers overlap both belt and pouch rather than floating between them.
 for(const x of [-.025,.025]){
   box('lumber-pouch-loop',[.016,.083,.010],[x,.110,.005],leather,pouch);
   box('lumber-pouch-loop-return',[.016,.010,.042],[x,.150,-.011],leather,pouch);
 }
 const snap=mesh('lumber-pouch-snap',new THREE.CylinderGeometry(.005,.005,.004,6).rotateX(Math.PI/2),gold,pouch);snap.position.set(0,.059,.039);
}
