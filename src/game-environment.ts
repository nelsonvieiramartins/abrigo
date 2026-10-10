import * as THREE from 'three';
import {createWeatherSystem} from '../extras/bioma/weather.js';
import {ForestAmbience} from '../extras/bioma/ambience.js';
import {defaultEnvironment,type EnvironmentSettings} from './environment-data';

/** Adapter for the original Bioma systems. A single owner composes time and weather. */
export function createGameEnvironment(scene:THREE.Scene,renderer:THREE.WebGLRenderer,sun:THREE.DirectionalLight,hemisphere:THREE.HemisphereLight,fill:THREE.DirectionalLight,follow:()=>THREE.Vector3){
 const audio=new ForestAmbience(),sunDirection=new THREE.Vector3(-3,5,4);
 let weather:ReturnType<typeof createWeatherSystem>|null=null,material:THREE.Material|null=null,settings=defaultEnvironment(),active=false;
 const oldBackground=scene.background,oldFog=scene.fog;
 const fallback=new THREE.MeshStandardMaterial();
 return {
  sunDirection,
  update(dt:number,time:number,next:EnvironmentSettings,terrainMaterial?:THREE.Material){
   settings=next;active=true;
   const wanted=terrainMaterial??fallback;
   if(material!==wanted){weather?.dispose();material=wanted;scene.background=new THREE.Color('#8caa92');scene.fog=new THREE.FogExp2('#8caa92',0);weather=createWeatherSystem({scene,sun,renderer,terrainMaterial:wanted,follow,baseFogDensity:0});}
   // Preserve the source dawn/day/dusk curve, extending its ends to a true night.
   const p=THREE.MathUtils.clamp((settings.hour-5.5)/13.5,0,1),day=Math.max(0,Math.sin(p*Math.PI));
   const daylight=settings.hour>=5.5&&settings.hour<=19;
   const angle=THREE.MathUtils.lerp(-1.1,1.05,p);
   sunDirection.set(Math.cos(angle)*72,36+day*54,Math.sin(angle)*60);
   hemisphere.intensity=daylight?.45+day*1.65:.16;fill.intensity=daylight?.3+day*1.4:.12;
   weather!.set(settings.weather,settings.intensity);
   weather!.setBase({sky:daylight?new THREE.Color('#354c58').lerp(new THREE.Color('#8caa92'),day):new THREE.Color('#101924'),sunIntensity:daylight?1.25+day*2.2:.16,exposure:daylight?.76+day*.4:.6,daylight:p});
   weather!.setPixelRatio(renderer.getPixelRatio());weather!.update(dt,time);
   // This editor moves its orthographic camera back to avoid near-plane clipping.
   // Account for that extra distance instead of fogging out the whole map.
   (scene.fog as THREE.FogExp2).density*=.15;
   if(!daylight){(scene.background as THREE.Color).multiplyScalar(.18);scene.fog!.color.copy(scene.background as THREE.Color);}
   const wind=THREE.MathUtils.clamp(settings.wind+weather!.windBias,0,1);
   audio.setWind(wind);audio.setVolume(settings.volume);
   return wind;
  },
  async toggleAudio(){if(audio.active)audio.stop();else{audio.setVolume(settings.volume);await audio.start();audio.setWind(settings.wind);}return audio.active;},
  get audioActive(){return audio.active;},
  stopAudio(){audio.stop();},
  clear(){weather?.dispose();weather=null;material=null;audio.stop();if(active){scene.background=oldBackground;scene.fog=oldFog;sun.intensity=3;hemisphere.intensity=2.1;fill.intensity=1.7;renderer.toneMappingExposure=1.3;}active=false;},
 };
}
