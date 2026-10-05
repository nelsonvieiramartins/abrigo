// Development-only inspection sheet for creatures: five views and three close-ups.
// Query: ?species=wolf|bat|swarm|snake  &detail=low|high  &motion=idle|move|attack|run  &t=seconds  &bg=light
import * as THREE from 'three';
import {createCreature} from '../src/creature';
import {presetCreature} from '../src/creature-schema';

const q=new URLSearchParams(location.search);
const spec=presetCreature((q.get('species')||'bat') as any);
const W=1600,H=900,renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setSize(W,H);renderer.setScissorTest(true);renderer.shadowMap.enabled=true;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.3;renderer.outputColorSpace=THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(q.get('bg')==='light'?'#e8e6df':'#27302c');
scene.add(new THREE.HemisphereLight('#eef1da','#3c494b',2.1));
const key=new THREE.DirectionalLight('#fff0d8',3);key.position.set(-3,5,4);scene.add(key);
const fill=new THREE.DirectionalLight('#a6c8cc',1.7);fill.position.set(3,3,-4);scene.add(fill);
const model=createCreature(spec,{detail:(q.get('detail')||'high') as any});scene.add(model.root);
model.update(Number(q.get('t')||0),(q.get('motion')||'idle') as any);model.root.updateMatrixWorld(true);
const box=new THREE.Box3().setFromObject(model.root),c=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()),R=Math.max(size.x,size.y,size.z)*.62*(q.get('zoom')?1/Number(q.get('zoom')):1);
const headP=(model.sockets.head??model.sockets.target).getWorldPosition(new THREE.Vector3());
const views:[number[],number[],THREE.Vector3,number][]=[
 [[0,0,320,560],[0,0,1],c,R],[[320,0,320,560],[1,.6,1.2],c,R],[[640,0,320,560],[1,0,0],c,R],[[960,0,320,560],[0,0,-1],c,R],[[1280,0,320,560],[0,1,.01],c,R],
 [[0,560,560,340],[0,.05,1],headP,spec.species==='werewolf'?.48:.12],[[560,560,520,340],[1,.2,.6],headP,spec.species==='werewolf'?.48:.12],[[1080,560,520,340],[0,-.3,1],c,R*.8],
];
const cam=new THREE.OrthographicCamera(-1,1,1,-1,.01,50);
for(const [[x,y,w,h],dir,target,half] of views){
 cam.left=-half*w/h;cam.right=half*w/h;cam.top=half;cam.bottom=-half;cam.updateProjectionMatrix();
 cam.position.copy(target).add(new THREE.Vector3(...dir as [number,number,number]).normalize().multiplyScalar(8));cam.lookAt(target);
 renderer.setViewport(x,H-y-h,w,h);renderer.setScissor(x,H-y-h,w,h);renderer.render(scene,cam);
}
document.getElementById('info')!.textContent=`${spec.name} · ${model.detail} · ${Math.round(model.stats.triangles).toLocaleString('pt-BR')} triângulos · ${model.stats.meshes} peças`;
