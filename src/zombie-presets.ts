import {clone,validateSpec,type CharacterSpec} from './schema';

export const ZOMBIE_PRESETS_STORE='abrigo-zombie-presets-v1';
export type ZombiePreset={id:string;name:string;updatedAt:string;spec:CharacterSpec};
type PresetStorage=Pick<Storage,'getItem'|'setItem'>;
export function loadZombiePresets(storage:Pick<Storage,'getItem'>):ZombiePreset[]{
 const raw=storage.getItem(ZOMBIE_PRESETS_STORE);if(!raw)return [];
 const data=JSON.parse(raw);
 if(data?.version!==1||!Array.isArray(data.presets)||data.presets.length>100)throw Error('Biblioteca de zumbis inválida. Os dados salvos foram preservados.');
 const ids=new Set<string>();
 return data.presets.map((entry:any)=>{
  if(!entry||typeof entry.id!=='string'||!/^zombie-[a-z0-9-]{1,80}$/i.test(entry.id)||ids.has(entry.id)||typeof entry.name!=='string'||!entry.name.trim()||entry.name.length>64||typeof entry.updatedAt!=='string'||!Number.isFinite(Date.parse(entry.updatedAt)))throw Error('Preset de zumbi inválido. Os dados salvos foram preservados.');
  const spec=validateSpec(entry.spec);if(spec.profession!=='zumbi')throw Error('A biblioteca aceita apenas zumbis.');
  ids.add(entry.id);return {id:entry.id,name:entry.name.trim(),updatedAt:entry.updatedAt,spec:clone(spec)};
 });
}
// Explicit save only: drafts never overwrite a library preset automatically.
export function saveZombiePreset(storage:PresetStorage,raw:CharacterSpec,name:string,id?:string):ZombiePreset{
 const spec=validateSpec(raw),label=name.trim();
 if(spec.profession!=='zumbi')throw Error('Escolha um personagem zumbi antes de salvar.');
 if(!label||label.length>64)throw Error('Dê um nome ao preset com até 64 caracteres.');
 const presets=loadZombiePresets(storage),index=id?presets.findIndex(p=>p.id===id):-1;
 if(id&&index<0)throw Error('Preset não encontrado. Carregue um preset salvo para atualizar.');
 if(presets.some(p=>p.id!==id&&p.name.toLocaleLowerCase('pt-BR')===label.toLocaleLowerCase('pt-BR')))throw Error('Já existe um preset com esse nome. Use Atualizar ou escolha outro nome.');
 if(index<0&&presets.length>=100)throw Error('A biblioteca comporta até 100 presets.');
 const entry:ZombiePreset={id:id??'zombie-'+crypto.randomUUID(),name:label,updatedAt:new Date().toISOString(),spec:clone(spec)};
 if(index<0)presets.push(entry);else presets[index]=entry;
 storage.setItem(ZOMBIE_PRESETS_STORE,JSON.stringify({version:1,presets}));
 return clone(entry);
}
