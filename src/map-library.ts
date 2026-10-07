import {GAME_MAP_STORE,validateGameMap,type GameMapData} from './game-map-data';
export const MAP_LIBRARY_STORE='abrigo-map-library-v1',MAP_DRAFT_STORE='abrigo-map-draft-v1';
export type SavedMap={id:string;name:string;updated:string;data:GameMapData};
type Store=Pick<Storage,'getItem'|'setItem'>;
export function loadMapLibrary(storage:Pick<Storage,'getItem'>):SavedMap[]{
 const raw=storage.getItem(MAP_LIBRARY_STORE);
 if(!raw){const old=storage.getItem(GAME_MAP_STORE);return old?[{id:'legacy',name:'Mapa de teste anterior',updated:'',data:validateGameMap(JSON.parse(old))}]:[];}
 const list=JSON.parse(raw);if(!Array.isArray(list)||list.length>30)throw Error('Biblioteca de mapas inválida.');const ids=new Set();
 return list.map(m=>{if(!m||typeof m.id!=='string'||m.id.length>80||ids.has(m.id)||typeof m.name!=='string'||!m.name.trim()||m.name.length>80||typeof m.updated!=='string')throw Error('Registro de mapa inválido.');ids.add(m.id);return {...m,data:validateGameMap(m.data)};});
}
export function saveMap(storage:Store,id:string,name:string,data:GameMapData):SavedMap{
 name=name.trim();if(!name||name.length>80||!id||id.length>80)throw Error('Informe um nome de mapa (até 80 caracteres).');
 const list=loadMapLibrary(storage),record={id,name,updated:new Date().toISOString(),data:validateGameMap(data)},index=list.findIndex(m=>m.id===id);
 if(index>=0)list[index]=record;else {if(list.length>=30)throw Error('Limite de 30 mapas salvos.');list.push(record);}
 storage.setItem(MAP_LIBRARY_STORE,JSON.stringify(list));return record;
}
