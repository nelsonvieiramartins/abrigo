import * as T from 'three';
import {CELLS,HALF,SURFACES,emptyTerrain,validateTerrain,heightAt,brush,paintLine,fillRegion} from './terrain-data.js';
export function createTerrain(scene){
 let data=emptyTerrain(),bed=data,renderBed=data,base='#526b57';
 const waterTime={value:0};
 const waterFlow={value:new T.Vector2(.8,0)};
 const waterPhase={value:0},waterPathCount={value:0};let lastWaterFrame=null;
 const waterPathPoints={value:Array.from({length:12},()=>new T.Vector2())};
 const waterFlowPixels=new Uint8Array(CELLS*CELLS*4),waterFlowMap=new T.DataTexture(waterFlowPixels,CELLS,CELLS,T.RGBAFormat);
 waterFlowMap.minFilter=waterFlowMap.magFilter=T.LinearFilter;
 const roadAngle={value:0};
 const roadBlockScale={value:1},roadPattern={value:0};
 const resolution=CELLS*2;
 const geometry=new T.BufferGeometry(),positions=new Float32Array((resolution+1)**2*3),colors=new Float32Array(positions.length);
 const indices=[];for(let z=0;z<resolution;z++)for(let x=0;x<resolution;x++){const a=z*(resolution+1)+x,b=a+1,c=a+resolution+1,d=c+1;indices.push(a,c,b,b,c,d);}geometry.setIndex(indices);
 geometry.setAttribute('position',new T.BufferAttribute(positions,3));geometry.setAttribute('color',new T.BufferAttribute(colors,3));
 // Keep the editable cell grid, but render continuous, gently irregular borders.
 const surfacePixels=new Uint8Array(CELLS*CELLS*4);
 const surfaceMap=new T.DataTexture(surfacePixels,CELLS,CELLS,T.RGBAFormat);
 surfaceMap.minFilter=surfaceMap.magFilter=T.NearestFilter;
 const surfacePalette=SURFACES.map(s=>new T.Color(s.color||base));
 const material=new T.MeshStandardMaterial({roughness:1,flatShading:false});
 material.onBeforeCompile=shader=>{
  shader.uniforms.surfaceMap={value:surfaceMap};shader.uniforms.surfacePalette={value:surfacePalette};
  shader.uniforms.waterPass={value:shader.waterPass||0};shader.uniforms.waterTime=waterTime;
  shader.uniforms.roadAngle=roadAngle;
  shader.uniforms.roadBlockScale=roadBlockScale;shader.uniforms.roadPattern=roadPattern;
  shader.uniforms.waterFlow=waterFlow;
  shader.uniforms.waterPhase=waterPhase;shader.uniforms.waterPathCount=waterPathCount;shader.uniforms.waterPathPoints=waterPathPoints;
  shader.uniforms.waterFlowMap={value:waterFlowMap};
  shader.vertexShader='varying vec2 terrainXZ;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nterrainXZ = position.xz;');
  shader.fragmentShader=`
   varying vec2 terrainXZ;
   uniform sampler2D surfaceMap;
   uniform vec3 surfacePalette[${SURFACES.length}];
   uniform float waterPass;
   uniform float waterTime;
   uniform vec2 waterFlow;
   uniform float waterPhase;
   uniform float waterPathCount;
   uniform vec2 waterPathPoints[12];
   uniform sampler2D waterFlowMap;
   uniform float roadAngle;
   uniform float roadBlockScale;
   uniform float roadPattern;
   vec2 waterDirectionAt(vec2 p){
    vec2 fallback=normalize(waterFlow);if(length(waterFlow)<.0001)fallback=vec2(1.0,0.0);
    if(waterPathCount<2.0)return fallback;
    vec2 encoded=texture2D(waterFlowMap,(p+vec2(50.0))/100.0).rg*2.0-1.0;
    return length(encoded)>.05?normalize(encoded):fallback;
   }
   vec2 waterCoordinatesAt(vec2 p){
    if(waterPathCount<2.0){vec2 direction=waterDirectionAt(p);return vec2(dot(p,direction),dot(p,vec2(-direction.y,direction.x)));}
    vec4 field=texture2D(waterFlowMap,(p+vec2(50.0))/100.0);
    return vec2(field.b*200.0,(field.a-.5)*100.0);
   }
   // World-space waves keep the current stable when the camera orbits.
   vec3 waterWave(vec2 p){
    vec2 a=vec2(1.25,.65),b=vec2(-.8,1.7),c=vec2(3.1,2.4);
    vec2 flowCoordinates=waterCoordinatesAt(p);p=vec2(flowCoordinates.x-waterPhase,flowCoordinates.y);
    float u=dot(p,a),v=dot(p,b),w=dot(p,c);
    return vec3(.055*sin(u)+.035*sin(v)+.012*sin(w),
     .055*a*cos(u)+.035*b*cos(v)+.012*c*cos(w));
   }
   float terrainHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   float terrainNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(terrainHash(i),terrainHash(i+vec2(1,0)),f.x),mix(terrainHash(i+vec2(0,1)),terrainHash(i+vec2(1,1)),f.x),f.y);}
   vec3 medievalPaving(vec2 point){
    float c=cos(roadAngle),s=sin(roadAngle);point=mat2(c,-s,s,c)*point;
    vec2 stone;vec2 direction;float edge;
    if(roadPattern>.5){
     vec2 p=point/(.18*roadBlockScale),spacing=vec2(1.0,1.732),halfSpacing=spacing*.5;
     vec2 a=mod(p,spacing)-halfSpacing,b=mod(p-halfSpacing,spacing)-halfSpacing;
     vec2 local=dot(a,a)<dot(b,b)?a:b;stone=floor((p-local)*8.0+.5);direction=-local;
     edge=.5-max(abs(local.y),abs(local.x)*.866025+abs(local.y)*.5);
    }else{
     vec2 p=point/(vec2(.24,.14)*roadBlockScale);p.x+=mod(floor(p.y),2.0)*.5;
     stone=floor(p);vec2 f=fract(p);direction=.5-f;edge=min(min(f.x,1.0-f.x),min(f.y,1.0-f.y));
    }
    float aa=max(fwidth(edge),.008),stoneMask=smoothstep(.045-aa,.045+aa,edge);
    float bevel=smoothstep(.04,.19,edge),variation=terrainHash(stone);
    vec3 rock=mix(vec3(.19,.18,.15),vec3(.36,.34,.29),variation);
    rock*=.73+.27*bevel+.12*dot(direction,vec2(-.6,.8));
    rock*=.97+.06*terrainNoise(point*24.0);
    return mix(vec3(.065,.062,.045),rock,stoneMask);
   }
  `+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`
   vec2 p=terrainXZ+vec2(50.0);
   p+=vec2(terrainNoise(p*.8),terrainNoise(p*.8+19.3))*.55-.275;
   vec2 cell=floor(p-.5),f=fract(p-.5);
   f=f*f*(3.0-2.0*f);
   float ids[4];float weights[4];
   ids[0]=texture2D(surfaceMap,(cell+vec2(.5,.5))/100.0).r*255.0;
   ids[1]=texture2D(surfaceMap,(cell+vec2(1.5,.5))/100.0).r*255.0;
   ids[2]=texture2D(surfaceMap,(cell+vec2(.5,1.5))/100.0).r*255.0;
   ids[3]=texture2D(surfaceMap,(cell+vec2(1.5,1.5))/100.0).r*255.0;
   weights[0]=(1.0-f.x)*(1.0-f.y);weights[1]=f.x*(1.0-f.y);
   weights[2]=(1.0-f.x)*f.y;weights[3]=f.x*f.y;
   vec3 surfaceColor=vec3(0.0);float total=0.0;
   float roadCell=texture2D(surfaceMap,(floor(terrainXZ+50.0)+.5)/100.0).r*255.0;
   for(int s=0;s<${SURFACES.length};s++){
    float coverage=0.0;
    for(int n=0;n<4;n++)coverage+=weights[n]*(1.0-step(.5,abs(ids[n]-float(s))));
    coverage=pow(coverage,16.0);
    if(s==8&&abs(roadCell-8.0)>.5)coverage=0.0;
    vec3 surfaceTone=surfacePalette[s];
    if(s==8&&coverage>.000001)surfaceTone=medievalPaving(terrainXZ);
    surfaceColor+=surfaceTone*coverage;total+=coverage;
   }
   diffuseColor.rgb*=surfaceColor/max(total,1e-12);
   if(abs(roadCell-8.0)<.5)diffuseColor.rgb=medievalPaving(terrainXZ);
   // A restrained shaded lip makes the thin snow layer readable from above.
   float snowCover=0.0;for(int n=0;n<4;n++)snowCover+=weights[n]*(1.0-step(.5,abs(ids[n]-6.0)));
   float snowLip=smoothstep(.48,.54,snowCover)*(1.0-smoothstep(.58,.78,snowCover));
   diffuseColor.rgb*=1.0-.14*snowLip;
   if(waterPass>.5){
    float wet=0.0;for(int n=0;n<4;n++)wet+=weights[n]*(1.0-step(.5,abs(ids[n]-5.0)));
    float edgeWidth=max(fwidth(wet),.018);
    float shore=smoothstep(.5-edgeWidth,.5+edgeWidth,wet);if(shore<.015)discard;
    float wave=waterWave(terrainXZ).x;
    float shallows=1.0-smoothstep(.52,.9,wet);
    float crest=smoothstep(.025,.095,wave);
    vec2 flowCoordinates=waterCoordinatesAt(terrainXZ);
    float foam=(1.0-smoothstep(.52,.73,wet))*smoothstep(.25,.7,
     terrainNoise(vec2(flowCoordinates.x-waterPhase,flowCoordinates.y)*5.0));
    vec2 direction=waterDirectionAt(terrainXZ);
    vec2 streamUV=vec2((flowCoordinates.x-waterPhase)*.7,flowCoordinates.y*5.0);
    float streak=smoothstep(.64,.84,terrainNoise(streamUV))*smoothstep(.50,.75,wet);
    diffuseColor.rgb=mix(vec3(.025,.19,.25),vec3(.10,.38,.36),shallows);
    diffuseColor.rgb+=vec3(.055,.095,.10)*crest;
    diffuseColor.rgb+=vec3(.10,.16,.15)*streak;
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.65,.82,.77),foam*.65);
    diffuseColor.a=shore*mix(.68,.48,shallows)+foam*shore*.12;
   }
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   if(waterPass>.5){
    vec2 slope=waterWave(terrainXZ).yz;
    vec2 direction=waterDirectionAt(terrainXZ),side=vec2(-direction.y,direction.x),worldSlope=direction*slope.x+side*slope.y;
    vec3 rippleNormal=mat3(viewMatrix)*vec3(-worldSlope.x,0.0,-worldSlope.y);
    normal=normalize(normal+rippleNormal);
   }
  `);
 };
 const mesh=new T.Mesh(geometry,material);mesh.receiveShadow=true;scene.add(mesh);
 const curbGeometry=new T.BoxGeometry(1,1,1),cornerGeometry=new T.CylinderGeometry(.09,.09,.202,12),curbMaterial=new T.MeshStandardMaterial({color:'#a5a69f',roughness:.9});let curbs=null,curbCorners=null;
 function rebuildCurbs(){
  if(curbs){scene.remove(curbs);curbs.dispose();curbs=null;}
  if(curbCorners){scene.remove(curbCorners);curbCorners.dispose();curbCorners=null;}
 const blocks=[],road=(x,z)=>x>=0&&z>=0&&x<CELLS&&z<CELLS&&data.surfaces[z*CELLS+x]===8;
  const endCap=(x,z,ox,oz)=>{const opened=data.roadCaps?data.roadCaps[z*CELLS+x]===1:data.roadEndCaps===false;if(!opened)return false;const ix=-ox,iz=-oz,tx=-oz,tz=ox;let depth=0,span=1;while(road(x+ix*depth,z+iz*depth))depth++;for(const sign of [-1,1])for(let step=1;road(x+tx*step*sign,z+tz*step*sign);step++)span++;return depth>=span;};
  for(let z=0;z<CELLS;z++)for(let x=0;x<CELLS;x++)if(road(x,z)){
   if(!road(x,z-1)&&!endCap(x,z,0,-1))blocks.push([x+.5,z,false]);if(!road(x,z+1)&&!endCap(x,z,0,1))blocks.push([x+.5,z+1,false]);
   if(!road(x-1,z)&&!endCap(x,z,-1,0))blocks.push([x,z+.5,true]);if(!road(x+1,z)&&!endCap(x,z,1,0))blocks.push([x+1,z+.5,true]);
  }
  if(!blocks.length)return;
  const width=data.curbWidth??.18,depth=data.roadDepth??.155,top=data.roadLevel+.155,bodyHeight=depth+.045,center=top-bodyHeight/2;
  curbs=new T.InstancedMesh(curbGeometry,curbMaterial,blocks.length);curbs.name='Meio-fio da rua';curbs.castShadow=true;curbs.receiveShadow=true;
  const joints=new Map(),transform=new T.Object3D();blocks.forEach(([x,z,vertical],i)=>{transform.position.set(x-HALF,center,z-HALF);transform.rotation.set(0,vertical?Math.PI/2:0,0);transform.scale.set(1,bodyHeight,width);transform.updateMatrix();curbs.setMatrixAt(i,transform.matrix);for(const sign of [-1,1]){const px=x+(vertical?0:sign*.5),pz=z+(vertical?sign*.5:0);joints.set(px+','+pz,[px,pz]);}});
  curbCorners=new T.InstancedMesh(cornerGeometry,curbMaterial,joints.size);curbCorners.name='Junções arredondadas do meio-fio';curbCorners.castShadow=true;curbCorners.receiveShadow=true;
  transform.rotation.set(0,0,0);transform.scale.set(width/.18,(bodyHeight+.002)/.202,width/.18);let index=0;for(const [x,z] of joints.values()){transform.position.set(x-HALF,center,z-HALF);transform.updateMatrix();curbCorners.setMatrixAt(index++,transform.matrix);}curbCorners.computeBoundingSphere();scene.add(curbCorners);
  curbs.computeBoundingSphere();scene.add(curbs);
 }
 const waterGeometry=new T.BufferGeometry(),waterPositions=new Float32Array(positions.length);
 waterGeometry.setIndex(indices);
 waterGeometry.setAttribute('position',new T.BufferAttribute(waterPositions,3));
 const waterMaterial=new T.MeshStandardMaterial({transparent:true,depthWrite:false,roughness:.22,metalness:.12,side:T.DoubleSide});
 waterMaterial.onBeforeCompile=shader=>{shader.waterPass=1;material.onBeforeCompile(shader);};
 const water=new T.Mesh(waterGeometry,waterMaterial);water.renderOrder=2;scene.add(water);
 water.onBeforeRender=()=>{const now=performance.now()/1000,delta=lastWaterFrame===null?0:Math.min(.1,Math.max(0,now-lastWaterFrame));lastWaterFrame=now;waterTime.value=now;waterPhase.value+=waterFlow.value.length()*delta;};
 const waterPathGeometry=new T.BufferGeometry(),waterPathMaterial=new T.LineBasicMaterial({color:0x63e6ff,depthTest:false,transparent:true,opacity:.9});
 waterPathGeometry.setAttribute('position',new T.BufferAttribute(new Float32Array(128*3),3));waterPathGeometry.setDrawRange(0,0);
 const waterPathLine=new T.Line(waterPathGeometry,waterPathMaterial);waterPathLine.renderOrder=25;waterPathLine.visible=false;scene.add(waterPathLine);
 const gridGeometry=new T.BufferGeometry(),gridPoints=new Float32Array(CELLS*(CELLS+1)*12);gridGeometry.setAttribute('position',new T.BufferAttribute(gridPoints,3));
 const grid=new T.LineSegments(gridGeometry,new T.LineBasicMaterial({color:0xb8c8a0,transparent:true,opacity:.18}));scene.add(grid);
 const cursorGeometry=new T.BufferGeometry();cursorGeometry.setAttribute('position',new T.BufferAttribute(new Float32Array(65*3),3));
 const cursor=new T.Line(cursorGeometry,new T.LineBasicMaterial({color:0xe6ffc2,depthTest:false}));cursor.renderOrder=20;cursor.visible=false;scene.add(cursor);
 const lineGeometry=new T.BufferGeometry();const line=new T.Line(lineGeometry,new T.LineDashedMaterial({color:0xffdea4,dashSize:.5,gapSize:.3,depthTest:false}));line.renderOrder=20;line.visible=false;scene.add(line);
 // Lightweight, deterministic ground scatter: instances add real silhouette and
 // volume without turning every blade, flower and pebble into a separate object.
 const tuftGeometry=new T.ConeGeometry(.055,.38,5);tuftGeometry.translate(0,.19,0);
 const stoneGeometry=new T.IcosahedronGeometry(.12,1);stoneGeometry.translate(0,.1,0);
 const flowerGeometry=new T.OctahedronGeometry(.065,0);flowerGeometry.translate(0,.34,0);
 const detailMaterial=new T.MeshStandardMaterial({color:0xffffff,roughness:1,metalness:0});
 const tufts=new T.InstancedMesh(tuftGeometry,detailMaterial,5000);tufts.name='Detalhes · Grama e matinhos';tufts.receiveShadow=true;tufts.count=0;scene.add(tufts);
 const stones=new T.InstancedMesh(stoneGeometry,detailMaterial,1800);stones.name='Detalhes · Pedrinhas';stones.receiveShadow=true;stones.count=0;scene.add(stones);
 const flowers=new T.InstancedMesh(flowerGeometry,detailMaterial,800);flowers.name='Detalhes · Flores';flowers.receiveShadow=true;flowers.count=0;scene.add(flowers);
 const scatterTransform=new T.Object3D(),scatterColor=new T.Color();
 const scatterHash=(x,z,salt)=>{const value=Math.sin(x*127.1+z*311.7+salt*74.7)*43758.5453123;return value-Math.floor(value);};
 function finishScatter(mesh,count){mesh.count=count;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();}
 function rebuildDetails(){
  let tuftCount=0,stoneCount=0,flowerCount=0;
  for(let z=0;z<CELLS;z++)for(let x=0;x<CELLS;x++){
   const surface=data.surfaces[z*CELLS+x];if(surface!==0&&surface!==1)continue;
   const grass=surface===1,px=x-HALF+.12+scatterHash(x,z,1)*.76,pz=z-HALF+.12+scatterHash(x,z,2)*.76,y=heightAt(renderBed,px,pz);
   if(scatterHash(x,z,3)<(grass?.52:.075)&&tuftCount<tufts.instanceMatrix.count){
    const height=(grass?.42:.28)+scatterHash(x,z,4)*(grass?.46:.3),width=.48+scatterHash(x,z,5)*.56;
    scatterTransform.position.set(px,y+.012,pz);scatterTransform.rotation.set(0,scatterHash(x,z,6)*Math.PI*2,(scatterHash(x,z,7)-.5)*.18);scatterTransform.scale.set(width,height,width);scatterTransform.updateMatrix();
    tufts.setMatrixAt(tuftCount,scatterTransform.matrix);scatterColor.set(grass?(scatterHash(x,z,8)>.72?'#4f8b3d':'#326b35'):'#4d7141');tufts.setColorAt(tuftCount++,scatterColor);
   }
   if(scatterHash(x,z,9)<(grass?.025:.055)&&stoneCount<stones.instanceMatrix.count){
    const sx=.55+scatterHash(x,z,10)*1.25,sy=.45+scatterHash(x,z,11)*.55,sz=.55+scatterHash(x,z,12)*1.15;
    scatterTransform.position.set(px+(scatterHash(x,z,13)-.5)*.35,y+.005,pz+(scatterHash(x,z,14)-.5)*.35);scatterTransform.rotation.set(scatterHash(x,z,15)*.35,scatterHash(x,z,16)*Math.PI*2,scatterHash(x,z,17)*.35);scatterTransform.scale.set(sx,sy,sz);scatterTransform.updateMatrix();
    stones.setMatrixAt(stoneCount,scatterTransform.matrix);scatterColor.set(scatterHash(x,z,18)>.5?'#777a6e':'#5f655b');stones.setColorAt(stoneCount++,scatterColor);
   }
   if(grass&&scatterHash(x,z,19)<.045&&flowerCount<flowers.instanceMatrix.count){
    scatterTransform.position.set(px+(scatterHash(x,z,20)-.5)*.3,y,pz+(scatterHash(x,z,21)-.5)*.3);scatterTransform.rotation.set(0,scatterHash(x,z,22)*Math.PI*2,0);const size=.7+scatterHash(x,z,23)*.7;scatterTransform.scale.set(size,size,size);scatterTransform.updateMatrix();
    flowers.setMatrixAt(flowerCount,scatterTransform.matrix);const tint=scatterHash(x,z,24);scatterColor.set(tint>.68?'#fff0a0':tint>.34?'#e9d85d':'#e8d9ef');flowers.setColorAt(flowerCount++,scatterColor);
   }
  }
  finishScatter(tufts,tuftCount);finishScatter(stones,stoneCount);finishScatter(flowers,flowerCount);
 }
 // Interpolating subdivision preserves authored heights and avoids overshoot.
 function interpolate(source,u,v){
  const x=Math.min(CELLS-1,Math.floor(u)),z=Math.min(CELLS-1,Math.floor(v));
  const fx=u-x,fz=v-z,h=source.heights;
  const sample=(i,j)=>h[Math.max(0,Math.min(CELLS,j))*(CELLS+1)+Math.max(0,Math.min(CELLS,i))];
  const cubic=(a,b,c,d,t)=>b+.5*t*(c-a+t*(2*a-5*b+4*c-d+t*(3*(b-c)+d-a)));
  const rows=[];for(let j=-1;j<=2;j++)rows.push(cubic(sample(x-1,z+j),sample(x,z+j),sample(x+1,z+j),sample(x+2,z+j),fx));
  const corners=[sample(x,z),sample(x+1,z),sample(x,z+1),sample(x+1,z+1)];
  return Math.max(Math.min(...corners),Math.min(Math.max(...corners),cubic(...rows,fz)));
 }
 function rebuild(){
  syncWaterFlow();
  roadAngle.value=(data.roadAngle??0)*Math.PI/180;
  roadBlockScale.value=data.roadBlockScale??1;roadPattern.value=data.roadPattern==='hex'?1:0;
  // Capture once: terrain sculpting must not move an existing street plane.
  if(data.surfaces.includes(8)&&data.roadLevel===undefined){const index=data.surfaces.indexOf(8),x=index%CELLS,z=Math.floor(index/CELLS);data.roadLevel=heightAt(data,x+.5-HALF,z+.5-HALF)-.12;}
  let k=0;const palette=SURFACES.map(s=>new T.Color(s.color||base));
  palette.forEach((color,i)=>surfacePalette[i].copy(color));
  surfacePalette[5].set('#716d4c');
  // Derive the basin from paint, so repainting or undo restores the original relief.
  bed={...data,heights:data.heights.map((height,index)=>{
   const x=index%(CELLS+1),z=Math.floor(index/(CELLS+1));let wet=0,snow=0,road=0,count=0;
   for(let dz=-1;dz<=0;dz++)for(let dx=-1;dx<=0;dx++){const i=x+dx,j=z+dz;if(i>=0&&j>=0&&i<CELLS&&j<CELLS){count++;if(data.surfaces[j*CELLS+i]===5)wet++;if(data.surfaces[j*CELLS+i]===6)snow++;if(data.surfaces[j*CELLS+i]===8)road++;}}
   // A thin, deterministic accumulation; authored ground stays intact underneath.
   const cover=snow/Math.max(1,count),drift=.24+.025*Math.sin(x*.83+z*.31)+.015*Math.cos(z*1.07-x*.27);
   const lip=Math.max(0,Math.min(1,(cover-.05)/.55));
   if(road>0)return data.roadLevel+.155-(data.roadDepth??.155);
   return height-1.2*wet/Math.max(1,count)+drift*lip*lip*(3-2*lip);
  })};
  data.surfaces.forEach((surface,i)=>{surfacePixels[i*4]=surface;surfacePixels[i*4+3]=255;});surfaceMap.needsUpdate=true;
  renderBed={cells:resolution,heights:new Float32Array((resolution+1)**2)};
  for(let z=0;z<=resolution;z++)for(let x=0;x<=resolution;x++){
   const u=x/2,v=z/2,h=interpolate(bed,u,v),idx=z*(resolution+1)+x;
   renderBed.heights[idx]=h;
   waterPositions[k]=positions[k]=u-HALF;k++;
   waterPositions[k]=interpolate(data,u,v)-(data.waterDepth??.04);positions[k]=h;k++;
   waterPositions[k]=positions[k]=v-HALF;k++;
  }
  waterGeometry.attributes.position.needsUpdate=true;waterGeometry.computeVertexNormals();waterGeometry.computeBoundingSphere();water.visible=data.surfaces.includes(5);
  geometry.attributes.position.needsUpdate=true;geometry.attributes.color.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();
  k=0;for(let j=0;j<=CELLS;j++)for(let i=0;i<CELLS;i++)for(const [x,z] of [[i,j],[i+1,j],[j,i],[j,i+1]]){gridPoints[k++]=x-HALF;gridPoints[k++]=bed.heights[z*(CELLS+1)+x]+.014;gridPoints[k++]=z-HALF;}
  gridGeometry.attributes.position.needsUpdate=true;gridGeometry.computeBoundingSphere();
  rebuildDetails();
  rebuildCurbs();
  syncWaterPath();
 }
 function set(value){validateTerrain(value);data=value?{...value,heights:value.heights.slice(),surfaces:value.surfaces.slice(),roadCaps:value.roadCaps?.slice(),waterPath:value.waterPath?.map(point=>point.slice())}:emptyTerrain();rebuild();}
 function paintRoadCaps(point,radius,closed){
  if(!data.roadCaps){data.roadCaps=Array(CELLS**2).fill(0);if(data.roadEndCaps===false)for(let i=0;i<data.surfaces.length;i++)if(data.surfaces[i]===8)data.roadCaps[i]=1;delete data.roadEndCaps;}
  let changed=false;for(let z=Math.max(0,Math.floor(point.z+HALF-radius));z<=Math.min(CELLS-1,Math.ceil(point.z+HALF+radius));z++)for(let x=Math.max(0,Math.floor(point.x+HALF-radius));x<=Math.min(CELLS-1,Math.ceil(point.x+HALF+radius));x++){
   if(Math.hypot(x+.5-HALF-point.x,z+.5-HALF-point.z)>radius||data.surfaces[z*CELLS+x]!==8)continue;const next=closed?0:1,index=z*CELLS+x;if(data.roadCaps[index]!==next){data.roadCaps[index]=next;changed=true;}
  }return changed;
 }
 function setCursor(point,radius){cursor.visible=!!point;if(!point)return;const a=cursorGeometry.attributes.position;for(let i=0;i<=64;i++){const angle=i/64*Math.PI*2,x=point.x+Math.cos(angle)*radius,z=point.z+Math.sin(angle)*radius;a.setXYZ(i,x,Math.max(heightAt(data,x,z),heightAt(renderBed,x,z))+.07,z);}a.needsUpdate=true;cursorGeometry.computeBoundingSphere();}
 function previewLine(a,b){line.visible=!!a&&!!b;if(!line.visible)return;const vertices=[];for(let i=0;i<=80;i++){const f=i/80,x=a.x+(b.x-a.x)*f,z=a.z+(b.z-a.z)*f;vertices.push(x,Math.max(heightAt(data,x,z),heightAt(renderBed,x,z))+.08,z);}lineGeometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));lineGeometry.computeBoundingSphere();line.computeLineDistances();}
 function syncWaterFlow(){const angle=(data.waterDirection??0)*Math.PI/180,speed=data.waterSpeed??.8;waterFlow.value.set(Math.cos(angle)*speed,Math.sin(angle)*speed);}
 function syncWaterPath(){
  const path=data.waterPath||[],positions=waterPathGeometry.attributes.position;waterPathCount.value=Math.min(12,path.length);
  for(let i=0;i<12;i++)waterPathPoints.value[i].set(...(path[i]||[0,0]));
  const curve=path.length>1?new T.CatmullRomCurve3(path.map(([x,z])=>new T.Vector3(x,0,z)),false,'centripetal',.5):null;
  const sampleCount=curve?Math.min(121,Math.max(17,(path.length-1)*12+1)):path.length,curveLength=curve?.getLength()||0;
  const samples=curve?Array.from({length:sampleCount},(_,i)=>{const t=i/(sampleCount-1),point=curve.getPoint(t),tangent=curve.getTangent(t).normalize();return {point,tangent,along:t*curveLength};}):path.map(([x,z])=>({point:new T.Vector3(x,0,z),tangent:new T.Vector3(1,0,0),along:0}));
  samples.forEach(({point},i)=>positions.setXYZ(i,point.x,heightAt(renderBed,point.x,point.z)+.16,point.z));positions.needsUpdate=true;waterPathGeometry.setDrawRange(0,samples.length);waterPathGeometry.computeBoundingSphere();waterPathLine.computeLineDistances();waterPathLine.visible=waterPathLine.visible&&path.length>0;
  for(let z=0;z<CELLS;z++)for(let x=0;x<CELLS;x++){
   const world=new T.Vector3(x+.5-HALF,0,z+.5-HALF);let nearest=null,distance=Infinity;
   for(const sample of samples){const next=world.distanceToSquared(sample.point);if(next<distance){distance=next;nearest=sample;}}
   const index=(z*CELLS+x)*4;if(!nearest){waterFlowPixels.set([128,128,0,128],index);continue;}
   const side=Math.max(-50,Math.min(50,(world.x-nearest.point.x)*-nearest.tangent.z+(world.z-nearest.point.z)*nearest.tangent.x));
   waterFlowPixels[index]=Math.round((nearest.tangent.x*.5+.5)*255);waterFlowPixels[index+1]=Math.round((nearest.tangent.z*.5+.5)*255);waterFlowPixels[index+2]=Math.round(Math.min(1,nearest.along/200)*255);waterFlowPixels[index+3]=Math.round((side/100+.5)*255);
  }
  waterFlowMap.needsUpdate=true;
 }
 let disposed=false;
 function dispose(){if(disposed)return;disposed=true;const geometries=new Set(),materials=new Set();for(const o of [mesh,water,waterPathLine,grid,cursor,line,tufts,stones,flowers,curbs,curbCorners]){if(!o)continue;o.removeFromParent();geometries.add(o.geometry);materials.add(o.material);if(o.isInstancedMesh)o.dispose();}geometries.add(curbGeometry);geometries.add(cornerGeometry);materials.add(curbMaterial);geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());surfaceMap.dispose();waterFlowMap.dispose();}
 rebuild();return {mesh,grid,cursor,line,rebuild,set,setCursor,previewLine,dispose,
  heightAt:(x,z)=>heightAt(renderBed,x,z),snapshot:()=>({...data,heights:data.heights.slice(),surfaces:data.surfaces.slice(),roadCaps:data.roadCaps?.slice(),waterPath:data.waterPath?.map(point=>point.slice())}),
  setBase:color=>{base=color;rebuild();},
  waterDepth:()=>data.waterDepth??.04,
  waterSettings:()=>({waterSpeed:data.waterSpeed??.8,waterDirection:data.waterDirection??0}),
  setWaterSetting:(key,value)=>{const limits={waterSpeed:[0,3],waterDirection:[0,360]};if(!limits[key]||!Number.isFinite(value)||value<limits[key][0]||value>limits[key][1])return;data[key]=value;syncWaterFlow();},
  waterPath:()=>data.waterPath?.map(point=>point.slice())||[],
  addWaterPathPoint:point=>{const path=data.waterPath||(data.waterPath=[]);if(path.length>=12)return false;path.push([Math.max(-HALF,Math.min(HALF,point.x)),Math.max(-HALF,Math.min(HALF,point.z))]);syncWaterPath();return true;},
  clearWaterPath:()=>{data.waterPath=[];syncWaterPath();},setWaterPathVisible:value=>{waterPathLine.visible=Boolean(value)&&(data.waterPath?.length??0)>0;},
  roadSettings:()=>({curbWidth:data.curbWidth??.18,roadDepth:data.roadDepth??.155,roadAngle:data.roadAngle??0,roadBlockScale:data.roadBlockScale??1,roadPattern:data.roadPattern??'brick'}),
  setRoadSetting:(key,value)=>{if(key==='roadEndCaps'){if(typeof value==='boolean')data[key]=value;return;}if(key==='roadPattern'){if(['brick','hex'].includes(value))data[key]=value;return;}const limits={curbWidth:[.08,.6],roadDepth:[.03,.5],roadAngle:[0,180],roadBlockScale:[.5,2.5]};if(!limits[key]||!Number.isFinite(value)||value<limits[key][0]||value>limits[key][1])return;data[key]=value;},
  setWaterDepth:value=>{if(!Number.isFinite(value)||value<.04||value>1.15)return;data.waterDepth=value;rebuild();},
  apply:(point,options)=>options.tool==='curb'?paintRoadCaps(point,options.radius,options.capClosed):brush(data,point.x,point.z,options),
  path:(a,b,options)=>paintLine(data,a,b,options),fill:(p,surface)=>fillRegion(data,p.x,p.z,surface),
  stats:()=>({min:Math.min(...data.heights),max:Math.max(...data.heights),painted:data.surfaces.filter(v=>v!==0).length})
 };
}
