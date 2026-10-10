import * as THREE from 'three';
import {SVGRenderer} from 'three/addons/renderers/SVGRenderer.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createCharacter,CharacterModel,Detail,Expression} from './character';
import {createForestPostFX} from './postfx';
import {clone,DEFAULT,type CharacterSpec,type Motion} from './schema';
import {createCreature,type CreatureModel} from './creature';
import {prepareFauna} from './fauna-prepare';
import {resizePreviewPlatform} from './preview-platform';
import type {CreatureSpec,CreatureMotion} from './creature-schema';
import type {GameFrame} from './game-controls';
import type {GameObstacle} from './game-collision';
import type {GameCourse} from './game-course';
import {createCourseScene,animationJumpLift} from './game-course-scene';
import {createWoodTest} from './game-wood';
import {createCombatScene} from './game-combat-scene';
import type {CombatConfig} from './game-combat';
import {createGameMapScene} from './game-map-scene';
import type {GameMapData} from './game-map-data';
import {fitGameCameraDepth} from './game-camera';
import {fitGameShadows} from './game-shadows';
import {createGameEnvironment} from './game-environment';
import {defaultEnvironment,validateEnvironment,type EnvironmentSettings} from './environment-data';
import {validateGamePerformance,PERFORMANCE_PROFILES,MAP_EDITOR_PERFORMANCE,type GamePerformance} from './game-performance';

export function createPreview(host:HTMLElement,onStats:(s:{triangles:number;meshes:number})=>void){
 const scene=new THREE.Scene();
 let renderer:any,compatible=false;
 try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});}
 catch{compatible=true;renderer=new SVGRenderer();renderer.setPrecision(2);host.classList.add('compatible');}
 renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
 if(!compatible){renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.3;}
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.domElement.setAttribute('aria-label','Prévia 3D. Arraste para girar e use a rolagem para aproximar.');renderer.domElement.setAttribute('role','img');
 host.appendChild(renderer.domElement);
 const camera=new THREE.OrthographicCamera(-2,2,1.5,-1.5,.01,100);camera.position.set(4,3.3,5);
 const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.86,0);controls.enableDamping=true;controls.enablePan=false;controls.minZoom=.65;controls.maxZoom=4.5;controls.maxPolarAngle=Math.PI*.49;controls.minPolarAngle=.15;controls.update();
 const hemisphere=new THREE.HemisphereLight('#eef1da','#3c494b',2.1);scene.add(hemisphere);
 const key=new THREE.DirectionalLight('#fff0d8',3.0);key.position.set(-3,5,4);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-2;key.shadow.camera.right=2;key.shadow.camera.top=3;key.shadow.camera.bottom=-2;key.shadow.normalBias=.025;key.shadow.bias=-.0002;scene.add(key);
 if(compatible){scene.add(new THREE.AmbientLight('#e7e8d7',1.0));key.intensity=1.4;}
 const fill=new THREE.DirectionalLight('#a6c8cc',1.7);if(compatible)fill.intensity=.6;fill.position.set(3,3,-4);scene.add(fill);
 const stage=new THREE.Group();scene.add(stage);
 const platform=new THREE.Group();stage.add(platform);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({opacity:.22}));floor.rotation.x=-Math.PI/2;floor.position.y=-.061;floor.receiveShadow=true;floor.visible=!compatible;stage.add(floor);
 const plate=new THREE.Mesh(new THREE.CylinderGeometry(.83,.85,.055,64),new THREE.MeshStandardMaterial({color:'#373d37',roughness:1}));plate.position.y=-.0275;plate.receiveShadow=true;platform.add(plate);
 const ring=new THREE.Mesh(new THREE.TorusGeometry(.79,.003,4,100),new THREE.MeshBasicMaterial({color:'#7c8870'}));ring.rotation.x=Math.PI/2;ring.position.y=.002;platform.add(ring);
 const grid=new THREE.GridHelper(6,24,'#424d48','#303a37');grid.position.y=-.055;if(compatible)(grid.material as THREE.LineBasicMaterial).color.set('#354238');(grid.material as THREE.Material).transparent=true;(grid.material as THREE.Material).opacity=.44;stage.add(grid);
 const gameStage=new THREE.Group();gameStage.visible=false;scene.add(gameStage);
 const gameFloor=new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.MeshStandardMaterial({color:'#303c34',roughness:1}));gameFloor.rotation.x=-Math.PI/2;gameFloor.position.y=-.06;gameFloor.receiveShadow=true;gameStage.add(gameFloor);
 const gameGrid=new THREE.GridHelper(20,40,'#65705b','#414d41');gameGrid.position.y=-.057;gameStage.add(gameGrid);
 let gameObstacles:CharacterModel[]=[];
 const collisionAreas=new THREE.Group();gameStage.add(collisionAreas);
 const colliderMaterial=new THREE.MeshBasicMaterial({color:'#aac07b',side:THREE.DoubleSide,transparent:true,opacity:.8});
 let playerCollider:THREE.Mesh|null=null;
 let courseScene:ReturnType<typeof createCourseScene>|null=null;
 let woodTest:ReturnType<typeof createWoodTest>|null=null;
 let combatTest:ReturnType<typeof createCombatScene>|null=null;
 let gameMap:ReturnType<typeof createGameMapScene>|null=null;
 let mapEditing=false,mapWorkspace=false,gameAreaSize=100;
 const clearGameObstacles=()=>{gameObstacles.forEach(m=>m.dispose());gameObstacles=[];collisionAreas.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});collisionAreas.clear();playerCollider=null;};
 for(let i=0;i<32;i++){
   const a=i*Math.PI/16,geo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(Math.sin(a)*.81,.004,Math.cos(a)*.81),new THREE.Vector3(Math.sin(a)*(i%4===0?.74:.78),.004,Math.cos(a)*(i%4===0?.74:.78))]);
   platform.add(new THREE.Line(geo,new THREE.LineBasicMaterial({color:i%4===0?'#b2b99a':'#737d69'})));
 }
 let capturing=false;
 let expression:Expression='neutral',intensity=1,model:CharacterModel|CreatureModel|null=null,current:CharacterSpec|null=null,detail:Detail='high',motion:Motion|CreatureMotion='idle',time=0,paused=false,autoRotate=false,pixel=false,showGrid=true;
 let currentCreature:CreatureSpec|null=null,active=true,creatureSpan=1.38,creatureCenter=.86;
 let gameDriver:((dt:number)=>GameFrame)|null=null,gameX=0,gameZ=0,gameY=0;
 let testEnvironment=defaultEnvironment();
 let gamePerformance:GamePerformance={...PERFORMANCE_PROFILES.balanced.settings};
 const renderBudget=()=>mapWorkspace||mapEditing?MAP_EDITOR_PERFORMANCE:gameDriver?gamePerformance:null;
 let lastShadowUpdate=-Infinity;
 let measuredFrames=0,measuredSince=performance.now(),measuredFps=0,measuredMs=0;
 const environment=compatible?null:createGameEnvironment(scene,renderer,key,hemisphere,fill,()=>controls.target);
 const animateModel=(t:number,m:Motion|CreatureMotion)=>{if(model)(model.update as (t:number,m:string)=>void)(t,m);};
 let post:ReturnType<typeof createForestPostFX>|null=null,bypassPost=false;
 const resize=()=>{
   const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;
   renderer.setPixelRatio(pixel?Math.min(1,240/h):Math.min(window.devicePixelRatio,renderBudget()?.resolution??2));renderer.setSize(w,h);post?.setSize(w,h);
   const span=mapWorkspace?35:currentCreature?creatureSpan*Math.max(1,h/w):1.38;camera.left=-span*w/h;camera.right=span*w/h;camera.top=span;camera.bottom=-span;camera.updateProjectionMatrix();
 };
 new ResizeObserver(resize).observe(host);resize();
 // UHD renders through the forest post-processing chain; tone mapping then happens at the end of it.
 const setUHD=(on:boolean)=>{
   if(compatible)return;
   if(on&&!post){post=createForestPostFX(renderer,scene,camera);post.setSize(host.clientWidth,host.clientHeight);}
   if(!on&&post){post.dispose();post=null;}
   renderer.toneMapping=on?THREE.NoToneMapping:THREE.ACESFilmicToneMapping;key.shadow.mapSize.set(on?4096:2048,on?4096:2048);key.shadow.map?.dispose();key.shadow.map=null as any;
 };
 function render(dt=1/60){
  if(!compatible){renderer.info.autoReset=false;renderer.info.reset();}
  if(!compatible){
   const budget=renderBudget();
   const worldShadows=mapWorkspace||!!gameDriver;
   const settings=gameMap?.environment??testEnvironment;
   if(worldShadows){
    const wind=environment?.update(dt,performance.now()/1000,settings,gameMap?.terrain.mesh.material)??settings.wind;
    gameMap?.terrain.setVisual({...gameMap.visual,wind});
   }else environment?.clear();
   const usePost=(detail==='uhd'||worldShadows&&settings.atmosphere)&&(budget?.post??true);
   if(usePost&&!post){post=createForestPostFX(renderer,scene,camera);post.setSize(host.clientWidth,host.clientHeight);}
   if(!usePost&&post){post.dispose();post=null;}
   if(worldShadows&&post)post.configure(settings.strength,THREE.MathUtils.clamp((settings.hour-5.5)/13.5,0,1));
   renderer.toneMapping=post?THREE.NoToneMapping:THREE.ACESFilmicToneMapping;
   renderer.shadowMap.enabled=!budget||budget.shadows!==0;
   const resolution=budget?(budget.shadows||512):worldShadows||detail==='uhd'?4096:2048;
   if(key.shadow.mapSize.x!==resolution){key.shadow.mapSize.set(resolution,resolution);key.shadow.map?.dispose();key.shadow.map=null as any;}
   if(worldShadows){if(!key.target.parent)scene.add(key.target);fitGameShadows(key,camera,gameAreaSize,environment?.sunDirection);}
   else{key.position.set(-3,5,4);key.target.position.set(0,0,0);Object.assign(key.shadow.camera,{left:-2,right:2,top:3,bottom:-2,near:.5,far:500});key.shadow.camera.updateProjectionMatrix();}
   const now=performance.now();renderer.shadowMap.autoUpdate=!worldShadows;
   if(worldShadows&&renderer.shadowMap.enabled&&(!key.shadow.map||now-lastShadowUpdate>=(mapWorkspace||mapEditing?100:1000/30))){renderer.shadowMap.needsUpdate=true;lastShadowUpdate=now;}
   if(budget?.reflections??true)gameMap?.renderReflection(renderer,scene);
  }
  if(post&&!bypassPost)post.render(dt);else renderer.render(scene,camera);if(compatible)renderer.domElement.style.background='transparent';
 }
 let last=performance.now(),lastFrame=0;
 function frame(now:number){requestAnimationFrame(frame);if(!active||document.hidden){last=now;measuredSince=now;measuredFrames=0;return;}if(capturing)return;if(compatible&&now-lastFrame<66)return;const budget=renderBudget();if(budget?.fps&&now-lastFrame<1000/budget.fps-.8)return;lastFrame=now;const dt=Math.min((now-last)/1000,.1);last=now;
  if(gameDriver&&model){const state=gameDriver(dt);time=state.time;motion=state.motion;animateModel(time,motion);const y=state.y??0;model.root.position.set(state.x,y-(state.y===undefined?0:animationJumpLift(motion,time)*model.root.scale.y),state.z);model.root.rotation.y=state.yaw;
   woodTest?.update(dt,model.root,state.motion,state.time,state.playing??true);
   combatTest?.update(dt,state,current?.items.object!=='none'&&current?.items.placement!=='none'?1.6:.9,camera);
   if(playerCollider){playerCollider.position.set(state.x,y+(gameMap?.015:-.052),state.z);colliderMaterial.color.set(state.contacts?.length?'#e6a365':'#aac07b');}
   const dx=state.x-gameX,dz=state.z-gameZ;camera.position.x+=dx;camera.position.z+=dz;controls.target.x+=dx;controls.target.z+=dz;key.position.x+=dx;key.position.z+=dz;key.target.position.set(state.x,0,state.z);if(!key.target.parent)scene.add(key.target);gameX=state.x;gameZ=state.z;
   const dy=y-gameY;camera.position.y+=dy;controls.target.y+=dy;gameY=y;
  }else{if(!paused)time+=dt;animateModel(time,motion);}
  gameMap?.update(now);
  controls.autoRotate=gameDriver?false:autoRotate;controls.autoRotateSpeed=1.4;controls.update();render(dt);
  measuredFrames++;const elapsed=now-measuredSince;if(elapsed>=750){measuredFps=measuredFrames*1000/elapsed;measuredMs=elapsed/measuredFrames;measuredFrames=0;measuredSince=now;}
 }
 requestAnimationFrame(frame);
 async function rasterize(){
   if(!compatible)return renderer.domElement;
   const svg=new XMLSerializer().serializeToString(renderer.domElement);
   const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
   try{const img=new Image();img.src=url;await img.decode();const c=document.createElement('canvas');c.width=Number(renderer.domElement.getAttribute('width'));c.height=Number(renderer.domElement.getAttribute('height'));c.getContext('2d')!.drawImage(img,0,0);return c;}finally{URL.revokeObjectURL(url);}
 }
 const view=(name:string)=>{
   controls.maxZoom=name==='portrait'?10:4.5;
   camera.zoom=name==='portrait'?1.85:1;controls.target.set(0,name==='portrait'?1.42:.86,0);
   const pos:Record<string,number[]>={iso:[4,3.3,5],front:[0,1.02,6],side:[6,1.02,0],back:[0,1.02,-6],portrait:[1,1.7,6]};
   camera.position.set(...(pos[name]||pos.iso) as [number,number,number]);camera.updateProjectionMatrix();controls.update();
   if(currentCreature){camera.zoom=name==='portrait'?1.3:1;controls.target.set(0,creatureCenter,0);camera.lookAt(controls.target);camera.updateProjectionMatrix();controls.update();}
   if(gameDriver)fitGameCameraDepth(camera,controls.target,gameAreaSize);
 };
 return {
   setCharacter(spec:CharacterSpec){current=spec;currentCreature=null;resizePreviewPlatform(platform,1);key.shadow.normalBias=.025;const next=createCharacter(spec,{detail});next.setExpression(expression,intensity,true);model?.dispose();model=next;scene.add(model.root);animateModel(time,motion);onStats(model.stats);},
   setCreature(spec:CreatureSpec){
     const next=createCreature(spec,{detail:detail==='low'?'low':'high',instancing:!compatible});currentCreature=spec;current=null;model?.dispose();model=next;scene.add(next.root);
     if(motion==='run'&&!['werewolfSdf','wolfLowpolySdf','wolfSdf','boar','wolf','werewolf','spider','tarantulaSdf','scorpion','skeleton','rat','ratSdf'].includes(spec.species))motion='idle';
     if(motion==='sprint'&&!['skeleton','werewolf'].includes(spec.species))motion='idle';
     if(motion==='runPlus'&&!['rat','ratSdf'].includes(spec.species))motion='idle';
     // Frame the motion envelope so folded wings or a compressed swarm never crop later.
     const envelopeMotions:CreatureMotion[]=['idle','move','attack'];if(['werewolfSdf','wolfLowpolySdf','wolfSdf','boar','wolf','werewolf','spider','tarantulaSdf','scorpion','skeleton','rat','ratSdf'].includes(spec.species))envelopeMotions.push('run');
     if(['skeleton','werewolf'].includes(spec.species))envelopeMotions.push('sprint');
     if(['rat','ratSdf'].includes(spec.species))envelopeMotions.push('runPlus');
     const samples=envelopeMotions.includes('run')?Array.from({length:24},(_,i)=>i/24):[0,.2,.5,1];
     const box=new THREE.Box3();for(const m of envelopeMotions)for(const t of samples){next.update(t,m);box.union(new THREE.Box3().setFromObject(next.root));}
next.update(0,'idle');animateModel(time,motion);const size=box.getSize(new THREE.Vector3());creatureCenter=box.getCenter(new THREE.Vector3()).y;creatureSpan=Math.max(size.length()*.6,['ratSdf','tarantulaSdf'].includes(spec.species)?.16:.65);controls.target.set(0,creatureCenter,0);resizePreviewPlatform(platform,Math.max(['ratSdf','tarantulaSdf'].includes(spec.species)?.3:1,Math.max(size.x,size.z)*.65));key.shadow.normalBias=['ratSdf','tarantulaSdf'].includes(spec.species)?.001:.025;resize();controls.update();onStats(model.stats);
   },
   setActive(value:boolean){active=value;if(value)resize();else environment?.stopAudio();},
   get environmentSettings(){return gameMap?.environment??{...testEnvironment};},
   setGamePerformance(value:GamePerformance){gamePerformance=validateGamePerformance(value);resize();},
   get gamePerformanceStats(){return {fps:measuredFps,frameMs:measuredMs,calls:renderer.info?.render.calls??0,triangles:renderer.info?.render.triangles??0};},
   setEnvironment(value:EnvironmentSettings){if(gameMap)gameMap.setEnvironment(value);else testEnvironment=validateEnvironment(value);},
   get environmentAudioActive(){return environment?.audioActive??false;},
   async toggleEnvironmentAudio(){if(!environment)throw Error('Som ambiente indisponível na prévia compatível.');return environment.toggleAudio();},
   setGameObstacles(spec:CharacterSpec,list:readonly GameObstacle[],radius:number){
    clearGameObstacles();const base=clone(spec);base.items=clone(DEFAULT.items);
    const ring=(r:number,x:number,z:number)=>{const m=new THREE.Mesh(new THREE.RingGeometry(r-.015,r+.015,48),colliderMaterial);m.rotation.x=-Math.PI/2;m.position.set(x,-.052,z);collisionAreas.add(m);return m;};
    for(const o of list){const npc=createCharacter(o.spec??base,{detail:'high'});npc.update(0,'idle');npc.root.position.set(o.x,0,o.z);npc.root.rotation.y=o.yaw;gameStage.add(npc.root);gameObstacles.push(npc);ring(o.radius,o.x,o.z);}
    playerCollider=ring(radius,0,0);camera.zoom=.40;camera.updateProjectionMatrix();controls.minZoom=.18;
   },
   setGameCourse(course:GameCourse){gameAreaSize=course.size;if(gameDriver)fitGameCameraDepth(camera,controls.target,gameAreaSize);courseScene?.dispose();woodTest?.dispose();courseScene=createCourseScene(course);gameStage.add(courseScene.root);const wood=course.boxes.find(b=>b.id==='Tronco de madeira');woodTest=wood?createWoodTest(wood):null;if(woodTest)gameStage.add(woodTest.root);gameFloor.visible=false;gameGrid.visible=false;},
   setGameMap(data:GameMapData){gameAreaSize=100;if(gameDriver)fitGameCameraDepth(camera,controls.target,gameAreaSize);gameMap?.dispose();gameMap=createGameMapScene(data);gameStage.add(gameMap.root);gameFloor.visible=false;gameGrid.visible=false;},
   setMapWorkspace(on:boolean){mapWorkspace=on;lastShadowUpdate=-Infinity;stage.visible=!on;gameStage.visible=on||!!gameDriver;controls.minZoom=on?.35:.65;controls.maxZoom=on?35:4.5;camera.far=on?500:100;resize();},
   mapView(name:string){controls.target.set(0,0,0);camera.zoom=name==='top'?.65:.75;camera.position.set(...(name==='top'?[0,120,.01]:name==='front'?[0,60,120]:[90,90,90]) as [number,number,number]);camera.updateProjectionMatrix();controls.update();},
   mapGrid(on:boolean){if(gameMap)gameMap.terrain.grid.visible=on;},
   setGameGridVisible(on:boolean){gameGrid.visible=on&&!gameMap&&!courseScene;if(courseScene)courseScene.grid.visible=on;if(gameMap)gameMap.terrain.grid.visible=on;},
   get gameMap(){return gameMap;},
   gameMapHit(event:PointerEvent){if(!gameMap)return null;const rect=renderer.domElement.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2),camera);return ray.intersectObject(gameMap.terrain.mesh)[0]?.point??null;},
   gameEffectHit(event:PointerEvent){if(!gameMap)return null;const rect=renderer.domElement.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2),camera);return ray.intersectObjects(gameMap.effects.items(),true).find(h=>h.object.userData.effectRoot)?.object.userData.effectRoot as THREE.Group|undefined;},
   setMapEditing(on:boolean){mapEditing=on;resize();controls.enableRotate=on;controls.enablePan=on;controls.mouseButtons.LEFT=THREE.MOUSE.ROTATE;},
   clearGameMap(){gameMap?.dispose();gameMap=null;mapEditing=false;controls.enablePan=false;controls.enableRotate=!gameDriver;},
   settleGameMap(){gameMap?.settleEffects();for(const npc of gameObstacles)npc.root.position.y=gameMap?.terrain.heightAt(npc.root.position.x,npc.root.position.z)??0;for(const ring of collisionAreas.children)ring.position.y=gameMap?gameMap.terrain.heightAt(ring.position.x,ring.position.z)+.015:-.052;},
   resetGameWood(){woodTest?.reset();},
   startGameCombat(config:CombatConfig,course:GameCourse,obstacles:readonly GameObstacle[],radius:number){combatTest?.dispose();combatTest=createCombatScene(config,course,obstacles,radius,compatible);gameStage.add(combatTest.root);},
   clearGameCombat(){combatTest?.dispose();combatTest=null;},
   get gameCombatStatus(){return combatTest?.runtime.status??'Combate desligado';},
   get gameCombatPhase(){return combatTest?.runtime.phase??'off';},
   get gameCombatColliders(){return combatTest?.runtime.colliders()??[];},
   get gameWoodStatus(){return woodTest?.status??'';},
   setGameSector(id:string){courseScene?.setSector(id);},
   clearGameCourse(){courseScene?.dispose();courseScene=null;woodTest?.dispose();woodTest=null;gameFloor.visible=!gameMap;gameGrid.visible=!gameMap;},
   showGameCollisionAreas(show:boolean){collisionAreas.visible=show;},
   clearGameObstacles,
   setGameDriver(driver:((dt:number)=>GameFrame)|null){gameDriver=driver;resize();if(driver)fitGameCameraDepth(camera,controls.target,gameAreaSize);stage.visible=!driver;gameStage.visible=!!driver;controls.enableRotate=mapEditing||!driver;gameX=gameZ=gameY=0;key.position.set(-3,5,4);key.target.position.set(0,0,0);},
   setMotion(m:Motion|CreatureMotion){if(currentCreature&&m==='runPlus'&&!['rat','ratSdf'].includes(currentCreature.species))return;if(currentCreature&&m==='sprint'&&!['skeleton','werewolf'].includes(currentCreature.species))return;if(currentCreature&&m==='run'&&!['werewolfSdf','wolfLowpolySdf','wolfSdf','boar','wolf','werewolf','spider','tarantulaSdf','scorpion','skeleton','rat','ratSdf'].includes(currentCreature.species))return;if(currentCreature&&['werewolfSdf','wolfLowpolySdf','wolfSdf','boar','snake','bat','wolf','werewolf','scorpion','spider','tarantulaSdf','skeleton','rat','ratSdf'].includes(currentCreature.species)&&m==='attack'){animateModel(time,'idle');animateModel(time,'attack');}motion=m;},view,
   setExpression(name:Expression,k=intensity){expression=name;intensity=k;if(model&&'setExpression' in model)model.setExpression(name,k);},
   pause(){paused=!paused;return paused;},rotate(){autoRotate=!autoRotate;return autoRotate;},
   pixelate(){if(compatible)throw new Error('A prévia em baixa resolução requer WebGL. Os demais controles continuam disponíveis.');pixel=!pixel;host.classList.toggle('pixelated',pixel);resize();return pixel;},
   detail(){detail=detail==='low'?'high':'low';setUHD(false);if(current)this.setCharacter(current);if(currentCreature){if(['boar','wolfLowpolySdf','wolfSdf','ratSdf','tarantulaSdf','werewolfSdf'].includes(currentCreature.species)){const spec=currentCreature,level=detail;void prepareFauna(spec,level==='low'?'low':'high').then(()=>{if(currentCreature===spec&&detail===level)this.setCreature(spec);}).catch(()=>{if(currentCreature===spec&&detail===level)host.dispatchEvent(new CustomEvent('creature-generation-error',{detail:'Não foi possível gerar o detalhe da criatura SDF. Tente novamente.'}));});}else this.setCreature(currentCreature);}return detail!=='low';},
   uhd(){detail=detail==='uhd'?'high':'uhd';setUHD(detail==='uhd');if(current)this.setCharacter(current);return detail==='uhd';},
   get detailLevel(){return detail;},
   grid(){showGrid=!showGrid;grid.visible=showGrid;return showGrid;},
   async snapshot(){capturing=true;try{render();return (await rasterize()).toDataURL('image/png');}finally{capturing=false;}},
   async spriteSheet(){
     if(!model)throw new Error('O personagem ainda não foi carregado.');
     const output=document.createElement('canvas');output.width=1024;output.height=640;const ctx=output.getContext('2d')!;
     const oldPos=camera.position.clone(),oldTarget=controls.target.clone(),oldZoom=camera.zoom,rotation=model.root.rotation.y;
     const oldFrustum=[camera.left,camera.right,camera.top,camera.bottom],oldPixel=compatible?1:renderer.getPixelRatio();
     try{
       capturing=true;bypassPost=true;stage.visible=false;renderer.setPixelRatio(1);renderer.setSize(256,320,false);camera.left=-1.04;camera.right=1.04;camera.top=1.3;camera.bottom=-1.3;camera.zoom=1;
       if(currentCreature){camera.left=-creatureSpan;camera.right=creatureSpan;camera.top=creatureSpan*1.25;camera.bottom=-creatureSpan*1.25;}
       controls.target.set(0,currentCreature?creatureCenter:.93,0);camera.position.set(0,controls.target.y+3.54,5);camera.lookAt(controls.target);camera.updateProjectionMatrix();animateModel(0,'idle');
       for(let i=0;i<8;i++){model.root.rotation.y=i*Math.PI/4;render();ctx.drawImage(await rasterize(),(i%4)*256,Math.floor(i/4)*320);}
       return output.toDataURL('image/png');
     }finally{
       stage.visible=true;model.root.rotation.y=rotation;animateModel(time,motion);camera.position.copy(oldPos);controls.target.copy(oldTarget);camera.zoom=oldZoom;
       [camera.left,camera.right,camera.top,camera.bottom]=oldFrustum;camera.updateProjectionMatrix();renderer.setPixelRatio(oldPixel);bypassPost=false;resize();controls.update();render();capturing=false;
     }
   },
   compatible,
   get model(){return model;},get motion(){return motion;},get camera(){return camera;},get renderer(){return renderer;},
 };
}
