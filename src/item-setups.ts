import {DEFAULT,clone,validateSpec,type CharacterSpec} from './schema';
import {objectInteraction,type ObjectSpec} from './object-schema';

export const ITEM_SETUP_STORE='abrigo-item-setups-v1';
type StorageAccess=Pick<Storage,'getItem'|'setItem'>;
type Items=CharacterSpec['items'];

// Presets have their own keys. Workshop objects use a durable identity, not the shared
// "custom" selector value or their editable display name.
export function itemSetupKey(object:string,recipe?:ObjectSpec){
  return object==='custom'?`custom:${recipe?.id??recipe?.parts[0]?.id??recipe?.name??'unknown'}`:object;
}
function readSetups(storage:StorageAccess):Record<string,unknown>{
  const raw=storage.getItem(ITEM_SETUP_STORE);
  if(!raw)return {};
  const parsed=JSON.parse(raw);
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('Armazenamento de ajustes inválido.');
  return parsed;
}
export function saveItemSetup(storage:StorageAccess,spec:CharacterSpec){
  const items=validateSpec(spec).items;
  if(items.object==='none')throw new Error('Escolha um objeto primeiro.');
  const setups=readSetups(storage);
  setups[itemSetupKey(items.object,items.recipe)]=clone(items);
  storage.setItem(ITEM_SETUP_STORE,JSON.stringify(setups));
}
export function loadItemSetup(storage:StorageAccess,spec:CharacterSpec,object:string,recipe?:ObjectSpec):Items{
  const interaction=object==='custom'?recipe?.interaction:object==='none'?undefined:objectInteraction(object);
  const base={...clone(DEFAULT).items,object,...(recipe?{recipe}:{}),placement:interaction?(interaction.hands.includes('right')?'right':interaction.hands[0]):'none'};
  if(object==='none')return base as Items;
  try{
    const setups=readSetups(storage),key=itemSetupKey(object,recipe);
    let saved=setups[key];
    // Claim the old shared custom setup once, so existing adjustments survive migration
    // without being reused for every new workshop object.
    if(!saved&&object==='custom'&&setups.custom){
      saved=setups.custom;setups[key]={...(saved as object),object,recipe};delete setups.custom;
      storage.setItem(ITEM_SETUP_STORE,JSON.stringify(setups));
    }
    if(!saved||typeof saved!=='object'||Array.isArray(saved))return validateSpec({...spec,items:base}).items;
    const merged={...base,...saved,object,...(recipe?{recipe}:{} as object)} as Items;
    if(!interaction?.hands.includes(merged.placement as any))merged.placement=base.placement as Items['placement'];
    // Validation fills new motion flags and missing nested settings from older saves.
    return validateSpec({...spec,items:merged}).items;
  }catch{return validateSpec({...spec,items:base}).items;}
}
export function restoreItemSetup(storage:StorageAccess,spec:CharacterSpec):CharacterSpec{
  if(spec.items.object==='none')return spec;
  try{
    const setups=readSetups(storage),key=itemSetupKey(spec.items.object,spec.items.recipe);
    if(!setups[key]&&!(spec.items.object==='custom'&&setups.custom))return spec;
    return {...spec,items:loadItemSetup(storage,spec,spec.items.object,spec.items.recipe)};
  }catch{return spec;}
}
