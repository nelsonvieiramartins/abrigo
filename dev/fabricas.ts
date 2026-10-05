// Development-only viewer for Three.js "factories": modules exporting createXModel(options?) that return a
// THREE.Group (or {root}). This is the contract of img2threejs and of the img2threejs-showcase gallery.
// Factories are read from the local factories/ folder, which is never bundled into the editor build.
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {analyzeImage,silhouetteIoU,type Mask} from '../src/object-analysis';

const modules=import.meta.glob('/factories/**/*.{ts,js}');
const refs=import.meta.glob('/factories/**/*.{png,jpg,jpeg,webp}',{query:'?url',import:'default',eager:true}) as Record<string,string>;
const $=(s:string)=>document.querySelector<HTMLElement>(s)!;
const base=(p:string)=>p.split('/').pop()!.replace(/\.[^.]+$/,'').toLowerCase();
const key=(s:string)=>s.replace(/^create/,'').replace(/model$/,'').replace(/[^a-z0-9]/g,'');
// A reference matches by file name: machado.ts ↔ machado.png, or createMachadoModel.ts ↔ machado.jpg.
const refFor=(path:string)=>Object.entries(refs).find(([p])=>key(base(p))===key(base(path)))?.[1];

const host=$('#view'),renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.shadowMap.enabled=true;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;renderer.outputColorSpace=THREE.SRGBColorSpace;host.append(renderer.domElement);
const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,.01,1000),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;
scene.add(new THREE.HemisphereLight('#eef1da','#3c494b',2));
const sun=new THREE.DirectionalLight('#fff0d8',2.5);sun.position.set(-3,5,4);scene.add(sun);
const fill=new THREE.DirectionalLight('#a6c8cc',1.2);fill.position.set(3,2,-4);scene.add(fill);
// referenceView: camera direction of the reference photo, exported by the factory module (like the
// showcase's pinned capture camera). Default: straight front.
let model:THREE.Object3D|null=null,span=1,centre=new THREE.Vector3(),viewName='iso',refUrl:string|undefined,refView:[number,number,number]=[0,0,1];
const resize=()=>{const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h);const a=w/h;camera.left=-span*a;camera.right=span*a;camera.top=span;camera.bottom=-span;camera.updateProjectionMatrix();};
new ResizeObserver(resize).observe(host);
const view=(n:string)=>{
  viewName=n;const d:Record<string,number[]>={iso:[1,.7,1.2],front:[0,0,1],side:[1,0,0],ref:refView};
  camera.position.copy(centre).add(new THREE.Vector3(...d[n] as [number,number,number]).normalize().multiplyScalar(span*20));
  controls.target.copy(centre);camera.far=span*60;camera.updateProjectionMatrix();controls.update();
};
const clock=new THREE.Clock();
renderer.setAnimationLoop(()=>{
  const dt=clock.getDelta(),t=clock.elapsedTime;
  // Showcase factories animate through userData.tick(dt, elapsed); objects without it stay still.
  model?.traverse(o=>{const tick=(o.userData as any).tick;if(typeof tick==='function')tick(dt,t);});
  controls.update();renderer.render(scene,camera);
});

async function load(path:string){
  document.querySelectorAll<HTMLElement>('#list button').forEach(b=>b.classList.toggle('on',b.dataset.path===path));
  if(model){scene.remove(model);model.traverse((o:any)=>{o.geometry?.dispose();for(const m of [].concat(o.material??[]))(m as any).dispose?.();});model=null;}
  const t0=performance.now();let mod:any;
  try{mod=await modules[path]();}catch(e){$('#stats').textContent='Erro ao importar: '+(e as Error).message;return;}
  refView=Array.isArray(mod.referenceView)?mod.referenceView:[0,0,1];
  const entry=Object.entries(mod).find(([k,v])=>/^create.*Model$/.test(k)&&typeof v==='function');
  if(!entry){$('#stats').textContent='Nenhuma função createXModel() exportada.';return;}
  let out:any;try{out=(entry[1] as Function)();}catch(e){$('#stats').textContent='Erro ao construir: '+(e as Error).message;return;}
  model=out?.isObject3D?out:out?.root;
  if(!model){$('#stats').textContent='A função não retornou um THREE.Object3D.';return;}
  const buildMs=performance.now()-t0;scene.add(model);
  const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3());centre=box.getCenter(new THREE.Vector3());span=Math.max(size.x,size.y,size.z)*.8||1;resize();view(viewName);
  let meshes=0,tris=0,instanced=0,ticking=false;const mats=new Set<unknown>(),textures=new Set<unknown>();
  model.traverse((o:any)=>{
    if(typeof o.userData.tick==='function')ticking=true;
    if(!o.isMesh)return;meshes++;tris+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);if(o.isInstancedMesh)instanced++;
    for(const m of [].concat(o.material)){mats.add(m);for(const v of Object.values(m as any))if((v as any)?.isTexture)textures.add(v);}
  });
  // Rule of this project: code only. Flag any loader or network call inside the factory.
  const src=String(entry[1]),loaders=['GLTFLoader','OBJLoader','FBXLoader','TextureLoader','fetch('].filter(w=>src.includes(w));
  $('#title').textContent=entry[0];
  const rows:[string,string][]=[['Arquivo',path.replace('/factories/','')],['Tamanho (m)',[size.x,size.y,size.z].map(v=>v.toFixed(3)).join(' × ')],['Malhas',meshes+(instanced?` (${instanced} instanciadas)`:'')],
    ['Triângulos',Math.round(tris).toLocaleString('pt-BR')],['Materiais',String(mats.size)],['Texturas (geradas em código)',String(textures.size)],['Animação (userData.tick)',ticking?'sim':'não'],
    ['Tempo de construção',buildMs.toFixed(0)+' ms'],['Carrega arquivos?',loaders.length?'⚠ '+loaders.join(', '):'não']];
  $('#info').innerHTML=rows.map(([k,v])=>`<div><span>${k}</span><b>${v}</b></div>`).join('');
  $('#stats').textContent=`${Math.round(tris).toLocaleString('pt-BR')} triângulos · ${meshes} malhas`;
  refUrl=refFor(path);
  $('#ref').innerHTML=refUrl?`<img src="${refUrl}" alt="referência">`:'<p class="hint">Sem imagem de referência com o mesmo nome em <code>factories/</code>.</p>';
  ($('#compare') as HTMLButtonElement).disabled=!refUrl;$('#score').innerHTML='';$('#diff').style.display='none';
}
// Silhouette review, like img2threejs' vision gate but computed: the model's front view vs the image,
// both cropped to their outline, compared pixel by pixel.
async function compare(){
  if(!model||!refUrl)return;
  const img=new Image();img.src=refUrl;await img.decode();
  const k=Math.min(1,480/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);
  const ctx=c.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(img,0,0,c.width,c.height);const ref=analyzeImage(ctx.getImageData(0,0,c.width,c.height)).mask;
  // Look along the reference direction and frame the model's outline in that camera's space.
  model.updateMatrixWorld(true);const centreW=new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());
  const cam=new THREE.OrthographicCamera(-1,1,1,-1,.01,1000);cam.position.copy(centreW).add(new THREE.Vector3(...refView).normalize().multiplyScalar(50));cam.lookAt(centreW);cam.updateMatrixWorld(true);
  const box=new THREE.Box3(),v=new THREE.Vector3();model.traverse((o:any)=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i+=3){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld).applyMatrix4(cam.matrixWorldInverse);box.expandByPoint(v);}});
  cam.left=box.min.x;cam.right=box.max.x;cam.top=box.max.y;cam.bottom=box.min.y;cam.near=.01;cam.far=200;cam.updateProjectionMatrix();
  const target=new THREE.WebGLRenderTarget(ref.width,ref.height),white=new THREE.MeshBasicMaterial({color:'#fff',side:THREE.DoubleSide}),flat=new THREE.Scene();
  // Render the model itself (clone() fails on factories with circular userData) in a flat white pass.
  scene.remove(model);flat.add(model);flat.overrideMaterial=white;
  renderer.setRenderTarget(target);renderer.setClearColor('#000',1);renderer.clear();renderer.render(flat,cam);
  const px=new Uint8Array(ref.width*ref.height*4);renderer.readRenderTargetPixels(target,0,0,ref.width,ref.height,px);
  renderer.setRenderTarget(null);renderer.setClearColor('#000',0);target.dispose();white.dispose();flat.remove(model);scene.add(model);
  const got:Mask={width:ref.width,height:ref.height,data:new Uint8Array(ref.width*ref.height)};
  for(let y=0;y<ref.height;y++)for(let x=0;x<ref.width;x++)got.data[(ref.height-1-y)*ref.width+x]=px[(y*ref.width+x)*4]>127?1:0;
  const score=silhouetteIoU(ref,got),size=box.getSize(new THREE.Vector3()),aspect=(size.x/size.y)/(ref.width/ref.height);
  view('ref');
  $('#score').innerHTML=`${Math.round(score*100)}%<small>sobreposição da silhueta no ângulo da referência (IoU, ambas enquadradas pelo contorno) · proporção ${aspect.toFixed(2)}× a da imagem</small>`;
  const d=$('#diff') as HTMLCanvasElement;d.width=ref.width;d.height=ref.height;d.style.display='block';
  const dc=d.getContext('2d')!,out=dc.createImageData(ref.width,ref.height);
  for(let i=0;i<ref.data.length;i++){const a=ref.data[i],b=got.data[i],col=a&&b?[190,205,145]:a?[214,120,96]:b?[110,160,210]:[28,34,33];out.data.set([...col,255],i*4);}
  dc.putImageData(out,0,0);
}
const paths=Object.keys(modules).filter(p=>!p.endsWith('.d.ts')).sort();
$('#list').innerHTML=paths.length?paths.map(p=>`<button data-path="${p}">${p.replace('/factories/','')}<small>${refFor(p)?'com referência':'sem referência'}</small></button>`).join(''):'<p class="hint">Nenhum arquivo em <code>factories/</code>.</p>';
document.addEventListener('click',e=>{
  const b=(e.target as HTMLElement).closest('button');if(!b)return;
  if(b.dataset.path)load(b.dataset.path);if(b.dataset.v)view(b.dataset.v);if(b.id==='compare')compare();
  if(b.id==='snap'){const a=document.createElement('a');a.href=renderer.domElement.toDataURL('image/png');a.download='fabrica.png';a.click();}
});
const wanted=new URLSearchParams(location.search).get('f');
if(paths.length)load(wanted?paths.find(p=>p.includes(wanted))??paths[0]:paths[0]);
(window as any).__FABRICAS__={load,compare};
