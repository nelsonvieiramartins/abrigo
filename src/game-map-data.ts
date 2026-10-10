import {emptyTerrain,validateTerrain} from '../extras/editor-isometrico/terrain-data.js';
import {EFFECT_LIBRARY,validatePreset} from '../extras/editor-isometrico/effects-v2.js';
import {validateVegetation,type VegetationInstance} from './map-vegetation-data';
import {validateEnvironment,type EnvironmentSettings} from './environment-data';
export const GAME_MAP_STORE='abrigo-game-map-v1';
export type MapReference={image:string;name:string;visible:boolean;opacity:number;width:number;height:number;x:number;z:number;rotation:number};
export type GameMapData={version:1;terrain:ReturnType<typeof emptyTerrain>;effects:Array<{type:string;position:number[];options:Record<string,any>}>;reference?:MapReference|null;ground?:string;vegetation?:VegetationInstance[];environment?:EnvironmentSettings;visual?:{style:'forest'|'classic';wind:number}};
export function emptyGameMap():GameMapData{return {version:1,terrain:emptyTerrain(),effects:[]};}
export function validateGameMap(raw:any):GameMapData{
  if(!raw||raw.version!==1||!raw.terrain||!Array.isArray(raw.effects)||raw.effects.length>128)throw Error('Mapa inválido (máximo de 128 efeitos).');
  validateTerrain(raw.terrain);
  if(raw.ground!==undefined&&(typeof raw.ground!=='string'||!/^#[\da-f]{6}$/i.test(raw.ground)))throw Error('Cor base inválida.');
  if(raw.reference!=null)validateMapReference(raw.reference);
  if(raw.vegetation!==undefined)validateVegetation(raw.vegetation);
  if(raw.environment!==undefined)validateEnvironment(raw.environment);
  if(raw.visual!==undefined&&(!raw.visual||!['forest','classic'].includes(raw.visual.style)||!Number.isFinite(raw.visual.wind)||raw.visual.wind<0||raw.visual.wind>1))throw Error('Configuração gráfica inválida.');
  for(const effect of raw.effects){
    if(!effect||!(EFFECT_LIBRARY.some(e=>e.id===effect.type)||effect.type==='quarks')||!Array.isArray(effect.position)||effect.position.length!==3||!effect.position.every((n:any)=>Number.isFinite(n)&&Math.abs(n)<=100))throw Error('Posição ou tipo de efeito inválido.');
    if(!effect.options||typeof effect.options!=='object'||Array.isArray(effect.options))throw Error('Opções do efeito inválidas.');
    for(const [key,min,max] of [['scale',.1,10],['height',-20,30],['intensity',.05,5],['emission',.05,5],['life',.05,5],['turbulence',0,5]] as const){const n=effect.options[key];if(n!==undefined&&(!Number.isFinite(n)||n<min||n>max))throw Error('Ajuste de efeito inválido: '+key);}
    if(effect.type==='quarks')validatePreset(effect.options.preset);
    for(const key of ['groupId','groupName','name'])if(effect.options[key]!==undefined&&(typeof effect.options[key]!=='string'||effect.options[key].length>100))throw Error('Nome de efeito inválido.');
  }
  return JSON.parse(JSON.stringify({version:1,terrain:raw.terrain,effects:raw.effects,...(raw.reference?{reference:raw.reference}:{}),...(raw.ground?{ground:raw.ground}:{}),...(raw.vegetation!==undefined?{vegetation:validateVegetation(raw.vegetation)}:{}),...(raw.environment?{environment:validateEnvironment(raw.environment)}:{}),...(raw.visual?{visual:{style:raw.visual.style,wind:raw.visual.wind}}:{})}));
}
export function importGameMap(raw:any):GameMapData{return validateGameMap(raw?.format==='elemental-map'?{version:1,terrain:raw.terrain??emptyTerrain(),effects:raw.effects??[],reference:raw.reference,ground:raw.ground}:raw);}
export function loadGameMap(storage:Pick<Storage,'getItem'>){const raw=storage.getItem(GAME_MAP_STORE);return raw?validateGameMap(JSON.parse(raw)):emptyGameMap();}
export function validateMapReference(r:any):MapReference{
 if(!r||typeof r.image!=='string'||r.image.length>3000000||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(r.image)||typeof r.name!=='string'||r.name.length>200||typeof r.visible!=='boolean'||!['opacity','width','height','x','z','rotation'].every(k=>Number.isFinite(r[k]))||r.opacity<0||r.opacity>1||r.width<.1||r.height<.1||r.width>500||r.height>500||Math.abs(r.x)>50||Math.abs(r.z)>50||Math.abs(r.rotation)>360)throw Error('Imagem de referência inválida.');return r;
}
