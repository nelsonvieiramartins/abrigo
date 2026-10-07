import * as THREE from 'three';

/** Orthographic zoom changes framing, not distance. Keep the whole play area
 * in front of the camera, including when following a player at either edge. */
export function fitGameCameraDepth(camera:THREE.OrthographicCamera,target:THREE.Vector3,size:number){
 const radius=Math.hypot(size,size,80),direction=camera.position.clone().sub(target).normalize();
 const distance=Math.max(camera.position.distanceTo(target),radius+10);
 camera.position.copy(target).addScaledVector(direction,distance);
 camera.near=.01;camera.far=distance+radius+10;
 camera.lookAt(target);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
}
