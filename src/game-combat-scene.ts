import * as THREE from 'three';
import {createCreature,type CreatureModel} from './creature';
import {createCombatRuntime,type CombatConfig} from './game-combat';
import type {GameCourse} from './game-course';
import type {GameObstacle} from './game-collision';
import type {GameFrame} from './game-controls';

export function createCombatScene(config:CombatConfig,course:GameCourse,obstacles:readonly GameObstacle[],radius:number,compatible=false){
 const root=new THREE.Group();root.name='Combate por ondas';
 const runtime=createCombatRuntime(config,course,obstacles,radius),models=new Map<string,{model:CreatureModel;bar:THREE.Mesh;track:THREE.Mesh;height:number}>();
 const barGeo=new THREE.PlaneGeometry(.65,.055),barMat=new THREE.MeshBasicMaterial({color:'#e86957',side:THREE.DoubleSide}),trackMat=new THREE.MeshBasicMaterial({color:'#252b27',side:THREE.DoubleSide});
 const remove=(id:string)=>{const entry=models.get(id);if(entry){entry.model.dispose();root.remove(entry.bar,entry.track);models.delete(id);}};
 return {root,runtime,
  update(dt:number,player:GameFrame,reach:number,camera:THREE.Camera){runtime.update(dt,player,reach);
   const alive=new Set(runtime.enemies.filter(e=>e.health>0).map(e=>e.id));for(const id of models.keys())if(!alive.has(id))remove(id);
   for(const e of runtime.enemies){if(e.health<=0)continue;let entry=models.get(e.id);
    if(!entry){const model=createCreature(e.spec,{detail:'high',instancing:!compatible}),bar=new THREE.Mesh(barGeo,barMat),track=new THREE.Mesh(barGeo,trackMat),height=new THREE.Box3().setFromObject(model.root).max.y+.2;entry={model,bar,track,height};models.set(e.id,entry);root.add(model.root,track,bar);}
    entry.model.update(e.time,e.motion);entry.model.root.position.set(e.x,e.y,e.z);entry.model.root.rotation.y=e.yaw;entry.model.root.updateMatrixWorld(true);
    const top=e.y+entry.height;
    entry.track.position.set(e.x,top,e.z);entry.track.quaternion.copy(camera.quaternion);
    entry.bar.position.copy(entry.track.position).add(new THREE.Vector3(0,0,.002).applyQuaternion(camera.quaternion));entry.bar.quaternion.copy(camera.quaternion);entry.bar.scale.x=e.health/e.spec.behavior.health;
   }
  },
  dispose(){for(const id of [...models.keys()])remove(id);barGeo.dispose();barMat.dispose();trackMat.dispose();root.removeFromParent();},
 };
}
