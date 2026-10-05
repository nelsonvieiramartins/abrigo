import assert from 'node:assert/strict';
import {createObject,objectToTypeScript} from '../src/object';
import {OBJECT_PRESETS,OBJECT_SHAPES,defaultPart,presetObject,validateObjectSpec} from '../src/object-schema';
import {analyzeImage,blockout,silhouetteIoU,DETAIL,type Pixels} from '../src/object-analysis';
const checks:string[]=[];
// Synthetic reference images (no files): a bottle on white and an axe-like L shape.
const image=(w:number,h:number,inside:(x:number,y:number)=>string|null):Pixels=>{const data=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const c=inside(x,y)??'#f4f3ef',i=(y*w+x)*4;data[i]=parseInt(c.slice(1,3),16);data[i+1]=parseInt(c.slice(3,5),16);data[i+2]=parseInt(c.slice(5,7),16);data[i+3]=255;}return {width:w,height:h,data};};
const bottle=image(120,200,(x,y)=>{const r=y<40?10:y<70?10+(y-40)*.9:37;return y>20&&y<190&&Math.abs(x-60)<=r?(y<70?'#2f6b3a':'#3d8a4b'):null;});
const axe=image(160,200,(x,y)=>x>70&&x<82&&y>20&&y<190?'#7a5733':x>=82&&x<140&&y>25&&y<70?'#8f9391':null);
for(const [label,img,expect] of [['bottle',bottle,'lathe'],['axe',axe,'extrude']] as const){
  const a=analyzeImage(img);assert.equal(a.suggestion,expect,`${label}: suggestion`);assert(a.bands.length>=1&&a.bands.length<=8);assert(a.palette.length>=1);
  for(const m of ['lathe','extrude','blocks'] as const){const spec=blockout(a,m,.3);const o=createObject(spec);assert(o.stats.triangles>0);let top=0;o.root.traverse((q:any)=>{if(q.isMesh){q.geometry.computeBoundingBox();top=Math.max(top,q.geometry.boundingBox.max.y+q.position.y);}});assert(Math.abs(top-.3)<.03,`${label}/${m}: height ${top}`);o.dispose();}
}
checks.push('image analysis: silhouette, colour bands, suggestion and three blockout methods at real height');
// Detail levels: a label cut as a hole in the extruded body; a detached handle is kept; high reads more.
{const can=image(200,260,(x,y)=>{if(y>18&&y<40&&x>70&&x<130&&!(y>24&&x>80&&x<120))return '#333333';if(y>50&&y<250&&x>50&&x<150)return y>110&&y<180&&x>60&&x<140?'#d8c070':'#b03a2e';return null;});
 const a=analyzeImage(can,42,DETAIL.high);assert(a.mask.height>=225,'detached handle kept');
 const ext=blockout(a,'extrude',.3,'Lata',.3,DETAIL.high);assert(ext.parts.some(p=>p.holes?.length),'label cut as a hole');createObject(ext).dispose();
 const lat=blockout(a,'lathe',.3,'Lata',.3,DETAIL.high);assert(lat.parts.some(p=>p.name.includes('vazada')),'open handle band becomes a plate');assert(lat.parts.some(p=>p.name.startsWith('Detalhe')),'front label becomes a decal');createObject(lat).dispose();
 const low=analyzeImage(can,42,DETAIL.low);assert(low.palette.length<=a.palette.length);}
checks.push('detail levels: holes, detached parts, open bands as plates and front decals');
assert.equal(silhouetteIoU({width:2,height:1,data:new Uint8Array([1,1])},{width:2,height:1,data:new Uint8Array([1,0])}),.5);
for(const id of Object.keys(OBJECT_PRESETS))for(const detail of ['low','high'] as const){const o=createObject(presetObject(id),{detail});assert(o.stats.triangles>0&&o.stats.triangles<20000);o.dispose();}
for(const shape of Object.keys(OBJECT_SHAPES) as (keyof typeof OBJECT_SHAPES)[]){const s=presetObject('crate');s.parts=[defaultPart(shape)];const o=createObject(s);o.root.traverse((q:any)=>{if(q.isMesh)for(const v of q.geometry.attributes.position.array)assert(Number.isFinite(v));});o.dispose();}
checks.push('presets and every shape build finite geometry at both detail levels');
const code=objectToTypeScript(presetObject('axe'));assert(code.includes('export function createMachadoModel')&&!/Loader|\.glb|\.png|fetch\(/.test(code));
checks.push('TypeScript export is plain Three.js, no loaders or asset files');
assert.throws(()=>validateObjectSpec({kind:'object',schemaVersion:1,name:'x',parts:[]}));assert.throws(()=>validateObjectSpec({kind:'object',schemaVersion:1,name:'x',parts:[{shape:'teapot'}]}));
const round=validateObjectSpec(JSON.parse(JSON.stringify(presetObject('lantern'))));assert.deepEqual(round,validateObjectSpec(round));
checks.push('recipe validation and JSON round trip');
console.log(JSON.stringify({objects:Object.keys(OBJECT_PRESETS).length,checks},null,2));
