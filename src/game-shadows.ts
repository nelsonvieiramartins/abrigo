import * as THREE from 'three';

/** Cover the visible terrain plus nearby off-screen shadow casters, not just
 * the player. Height layers also cover raised ground and tall vegetation. */
export function fitGameShadows(light:THREE.DirectionalLight,camera:THREE.OrthographicCamera,size:number,direction=new THREE.Vector3(-3,5,4)){
 camera.updateMatrixWorld(true);
 const half=size/2,bounds=new THREE.Box3(),ray=new THREE.Raycaster();
 for(const x of [-1,1])for(const y of [-1,1]){
  ray.setFromCamera(new THREE.Vector2(x,y),camera);
  for(const height of [-20,35]){
   const distance=(height-ray.ray.origin.y)/ray.ray.direction.y;
   if(!Number.isFinite(distance)||distance<0)continue;
   const point=ray.ray.at(distance,new THREE.Vector3());
   bounds.expandByPoint(new THREE.Vector3(THREE.MathUtils.clamp(point.x,-half,half),height,THREE.MathUtils.clamp(point.z,-half,half)));
  }
 }
 if(bounds.isEmpty())bounds.set(new THREE.Vector3(-half,-20,-half),new THREE.Vector3(half,35,half));
 bounds.min.x=Math.max(-half,bounds.min.x-20);bounds.max.x=Math.min(half,bounds.max.x+20);
 bounds.min.z=Math.max(-half,bounds.min.z-20);bounds.max.z=Math.min(half,bounds.max.z+20);
 const center=bounds.getCenter(new THREE.Vector3()),radius=bounds.getSize(new THREE.Vector3()).length()+20;
 light.target.position.copy(center);light.position.copy(center).addScaledVector(direction.clone().normalize(),radius);
 light.updateMatrixWorld(true);light.target.updateMatrixWorld(true);
 const shadow=light.shadow.camera;shadow.position.copy(light.position);shadow.lookAt(center);shadow.updateMatrixWorld(true);
 const local=new THREE.Box3();
 for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])local.expandByPoint(new THREE.Vector3(x,y,z).applyMatrix4(shadow.matrixWorldInverse));
 shadow.left=local.min.x-2;shadow.right=local.max.x+2;shadow.bottom=local.min.y-2;shadow.top=local.max.y+2;
 shadow.near=Math.max(.1,-local.max.z-10);shadow.far=-local.min.z+10;shadow.updateProjectionMatrix();
 return bounds;
}
