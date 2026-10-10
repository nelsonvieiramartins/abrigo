import {getCreatureBuild} from './creature-builds';
import {creatureDefaultKey,readCreatureDefault} from './creature-defaults';
import {presetCreature,validateCreatureSpec,type CreatureSpecies,type CreatureSpec} from './creature-schema';

export type CreatureCategory='normal'|'sdf';
export const creatureCategory=(species:CreatureSpecies):CreatureCategory=>getCreatureBuild(species)?'sdf':'normal';
export const creatureDraftKey=(category:CreatureCategory)=>category==='sdf'?'abrigo-creature-sdf-v1':'abrigo-creature-normal-v1';
export function readCreatureDraft(storage:Pick<Storage,'getItem'>,category:CreatureCategory):CreatureSpec{
  for(const key of [creatureDraftKey(category),'abrigo-creature-v1']){
    const raw=storage.getItem(key);if(!raw)continue;
    try{const spec=validateCreatureSpec(JSON.parse(raw));if(creatureCategory(spec.species)===category)return storage.getItem(creatureDefaultKey(spec.species))?readCreatureDefault(storage,spec.species):spec;}catch{/* Ignore invalid recipes without removing recoverable storage. */}
  }
  return readCreatureDefault(storage,category==='sdf'?'wolfSdf':'wolf');
}
