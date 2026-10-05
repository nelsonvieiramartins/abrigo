import {OPTIONS,clone,presetCharacter,randomCharacter,seededRandom,validateSpec,type CharacterSpec} from './schema';

export type CharacterCategory='characters'|'villains';
export const categoryOf=(spec:CharacterSpec):CharacterCategory=>spec.profession==='zumbi'?'villains':'characters';
export const characterStorageKey=(category:CharacterCategory)=>category==='villains'?'abrigo-villain-character-v1':'abrigo-character-v1';
export const categoryOptions=(options:Record<string,string>,category:CharacterCategory,kind:'profession'|'top')=>Object.fromEntries(
  Object.entries(options).filter(([id])=>kind==='profession'?(category==='villains'?id==='zumbi':id!=='zumbi'):
    category==='villains'?true:id!=='zombie')
);
// Separate seed namespace and wardrobe pool: historical survivor seeds stay unchanged.
export function randomVillain(seed:string):CharacterSpec{
  const variation=randomCharacter('villains:zumbi:'+seed),s=presetCharacter('zumbi'),rng=seededRandom('villains:wardrobe:'+seed);
  const pick=<T>(values:T[]):T=>values[Math.floor(rng()*values.length)];
  s.seed=seed;s.body=variation.body;
  s.appearance={...variation.appearance,skin:pick(['#a0aa82','#8e9a79','#abb193','#949784']),hairColor:pick(['#30312b','#48483d','#5e6250']),eyeColor:'#e8dfb7',beard:'none'};
  s.outfit={...s.outfit,top:pick(['zombie','jacket','tshirt','tank','hoodie','fieldshirt','none']),topColor:pick(['#73533b','#4e5940','#55564b','#4c4140']),pants:pick(['jeans','cargo','shorts']),pantsColor:pick(['#354457','#424839','#494b44']),shoes:pick(['wornBoots','wornSneakers','singleSneakerLeft','singleSneakerRight','barefoot']),shoeColor:pick(['#654a34','#302922'])};
  s.wear=.65+rng()*.35;
  return validateSpec(s);
}

// Legacy zombies saved in the survivor slot are migrated without overwriting survivor drafts.
export function readCategoryDraft(storage:Pick<Storage,'getItem'|'setItem'>,category:CharacterCategory):CharacterSpec{
  const legacy=storage.getItem('abrigo-character-v1');
  let old:CharacterSpec|undefined;try{if(legacy)old=validateSpec(JSON.parse(legacy));}catch{}
  if(old&&categoryOf(old)==='villains'&&!storage.getItem(characterStorageKey('villains')))
    storage.setItem(characterStorageKey('villains'),JSON.stringify(old));
  const saved=storage.getItem(characterStorageKey(category));
  try{if(saved){const s=validateSpec(JSON.parse(saved));if(categoryOf(s)===category)return clone(s);}}catch{}
  return presetCharacter(category==='villains'?'zumbi':'ranger');
}
