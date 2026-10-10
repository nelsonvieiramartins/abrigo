import {presetCreature,validateCreatureSpec,type CreatureSpecies,type CreatureSpec} from './creature-schema';
type Store=Pick<Storage,'getItem'|'setItem'>;
export const creatureDefaultKey=(species:CreatureSpecies)=>`abrigo-creature-default-v1:${species}`;
export function readCreatureDefault(storage:Pick<Store,'getItem'>,species:CreatureSpecies):CreatureSpec{
 const raw=storage.getItem(creatureDefaultKey(species));
 if(raw)try{const spec=validateCreatureSpec(JSON.parse(raw));if(spec.species===species)return spec;}catch{/* Keep invalid storage recoverable, but never load it. */}
 return presetCreature(species);
}
export function saveCreatureDefault(storage:Store,spec:CreatureSpec){
 const valid=validateCreatureSpec(spec),key=creatureDefaultKey(valid.species),raw=JSON.stringify(valid);
 storage.setItem(key,raw);
 if(storage.getItem(key)!==raw)throw Error('Não foi possível confirmar o padrão salvo. Exporte o JSON como backup.');
 return valid;
}
