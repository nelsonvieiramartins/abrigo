import {prepareBoar} from './boar-detail';
import {prepareWolfSdf} from './wolf-sdf-detail';
import {prepareRatSdf} from './rat-sdf-detail';
import {prepareWerewolfSdf} from './werewolf-sdf-detail';
import {prepareTarantulaSdf} from './tarantula-sdf-detail';
import type {CreatureSpec,CreatureDetail} from './creature-schema';
export function prepareFauna(spec:CreatureSpec,detail:CreatureDetail='high'):Promise<void>{
  if(spec.species==='boar')return prepareBoar(spec,detail);
  if((spec.species==='wolfSdf'||spec.species==='wolfLowpolySdf'))return prepareWolfSdf(spec,detail);
  if(spec.species==='ratSdf')return prepareRatSdf(spec,detail);
  if(spec.species==='werewolfSdf')return prepareWerewolfSdf(spec,detail);
  if(spec.species==='tarantulaSdf')return prepareTarantulaSdf(spec,detail);
  return Promise.resolve();
}
