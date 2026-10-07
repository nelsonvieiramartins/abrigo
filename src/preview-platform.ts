import type {Object3D} from 'three';

/** Resize the footprint only: the standing surface must stay at ground Y=0. */
export function resizePreviewPlatform(platform:Object3D,radiusScale:number){
  if(!Number.isFinite(radiusScale)||radiusScale<=0)throw new Error('Escala da base inválida.');
  platform.scale.set(radiusScale,1,radiusScale);
}
