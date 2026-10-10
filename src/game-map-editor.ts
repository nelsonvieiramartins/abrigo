import {SURFACES} from '../extras/editor-isometrico/terrain-data.js';
import {EFFECT_LIBRARY,EFFECT_TAGS,previewCanvas,validatePreset} from '../extras/editor-isometrico/effects-v2.js';
import {GAME_MAP_STORE,emptyGameMap,loadGameMap,validateGameMap,importGameMap,validateMapReference,type GameMapData} from './game-map-data';
import type {createPreview} from './scene';
import {scatterVegetation,VEGETATION_KINDS,VEGETATION_LIMIT,type VegetationKind} from './map-vegetation-data';
import {EZ_TREE_VARIANTS} from '../extras/bioma/forest-primitives.js';
import {mountEnvironmentControls} from './environment-controls';

type Preview=ReturnType<typeof createPreview>;
export function mountGameMapEditor(dialog:HTMLElement,api:{preview:()=>Preview|null;stop:()=>void;changed:()=>void;standalone?:boolean;initial?:GameMapData;save?:(data:GameMapData)=>void}){
 let data:GameMapData=emptyGameMap(),enabled=false,editing=false,tab='terrain',selected:number[]=[],preset:any=null;
 let past:GameMapData[]=[],future:GameMapData[]=[],before:GameMapData|null=null;
 try{data=api.initial??loadGameMap(localStorage);}catch{/* Preserve invalid storage for recovery via export. */}
 if(api.standalone)enabled=editing=true;
 const panel=document.createElement('section');panel.className='game-map-editor';
 panel.innerHTML=`<h3>Editor de mapa</h3><label><input id="map-enabled" type="checkbox"> Usar mapa editável (100 × 100 m)</label><p>Desmarque para voltar ao circuito original. O mapa salvo permanece separado.</p>
 <div class="game-test-actions"><button type="button" data-map-tab="terrain" aria-pressed="true">Terreno</button><button type="button" data-map-tab="effects" aria-pressed="false">Efeitos</button><button type="button" data-map-tab="vegetation" aria-pressed="false">Vegetação</button><button type="button" data-map-tab="environment" aria-pressed="false">Ambiente</button></div>
 <label><input id="map-editing" type="checkbox"> Editar no cenário (pausa os controles)</label><p>Clique/arraste para editar. Alt + arrastar gira, botão direito desloca e rolagem aproxima. Desative a edição para jogar.</p>
 <div id="map-terrain-panel"><div id="map-surfaces" class="game-map-library">${SURFACES.map((s,i)=>`<button type="button" data-map-surface="${i}" aria-pressed="${i===1}" style="--surface:${s.color??'#526b57'}">${s.name}</button>`).join('')}</div>
 <label>Ferramenta<select id="map-tool">${Object.entries({cursor:'Cursor / navegar',paint:'Pintar',erase:'Apagar cor',path:'Caminho (arraste)',raise:'Elevar',lower:'Rebaixar',flatten:'Nivelar',smooth:'Suavizar',fill:'Preencher',curb:'Pintar fechamento da rua',waterPath:'Marcar trajetória da água'}).map(([id,label])=>`<option value="${id}" ${id==='paint'?'selected':''}>${label}</option>`).join('')}</select></label>
 <label>Raio do pincel (m)<input id="map-radius" type="range" min=".5" max="12" step=".5" value="2"></label>
 <label>Intensidade<input id="map-strength" type="range" min=".05" max="1" step=".05" value=".35"></label>
 <label>Altura para nivelar (m)<input id="map-level" type="number" min="-20" max="30" step=".1" value="0"></label>
 <details><summary>Água e correnteza</summary><label>Profundidade visual<input data-map-water="waterDepth" type="number" min=".04" max="1.15" step=".01" value=".04"></label><label>Velocidade (m/s)<input data-map-water="waterSpeed" type="number" min="0" max="3" step=".1" value=".8"></label><label>Direção (graus)<input data-map-water="waterDirection" type="number" min="0" max="360" value="0"></label><button type="button" data-map-action="route-done">Concluir rota</button><button type="button" data-map-action="route-clear">Limpar rota</button></details>
 <details><summary>Rua de pedra medieval</summary><label>Largura do meio-fio<input data-map-road="curbWidth" type="number" min=".08" max=".6" step=".01" value=".18"></label><label>Profundidade<input data-map-road="roadDepth" type="number" min=".03" max=".5" step=".01" value=".155"></label><label>Direção<input data-map-road="roadAngle" type="number" min="0" max="180" value="0"></label><label>Tamanho dos blocos<input data-map-road="roadBlockScale" type="number" min=".5" max="2.5" step=".1" value="1"></label><label>Textura<select data-map-road="roadPattern"><option value="brick">Retangulares</option><option value="hex">Hexágonos</option></select></label><label><input id="map-cap-closed" type="checkbox" checked> Fechar extremidade (pincel)</label></details></div>
 <div id="map-effects-panel" hidden><div class="game-test-actions">${[['all','Todos'],...EFFECT_TAGS].map(([id,label])=>`<button type="button" data-effect-tag="${id}" aria-pressed="${id==='all'}">${label}</button>`).join('')}</div><div id="map-effect-library" class="game-map-library"></div><label>Modo<select id="map-effect-tool"><option value="place">Colocar efeito no clique</option><option value="select">Selecionar / arrastar</option></select></label><label>Efeitos no mapa (Ctrl para vários)<select id="map-effect-list" multiple size="5"></select></label><div id="map-effect-fields">${[['x','X',-50,50],['z','Z',-50,50],['height','Altura relativa',-20,30],['scale','Escala',.1,10],['intensity','Intensidade',.05,5],['emission','Emissão',.05,5],['life','Vida das partículas',.05,5],['turbulence','Turbulência',0,5]].map(([id,label,min,max])=>`<label>${label}<input data-effect-field="${id}" type="number" min="${min}" max="${max}" step=".1"></label>`).join('')}</div><div class="game-test-actions">${[['duplicate','Duplicar'],['group','Agrupar'],['ungroup','Desagrupar'],['remove','Remover']].map(([id,label])=>`<button type="button" data-map-action="${id}">${label}</button>`).join('')}<button type="button" data-map-action="quarks">Importar preset Quarks JSON</button></div></div>
 <div class="game-test-actions"><button type="button" data-map-action="undo">Desfazer</button><button type="button" data-map-action="redo">Refazer</button><button type="button" data-map-action="save">Salvar mapa em definitivo</button><button type="button" data-map-action="export">Exportar mapa JSON</button><button type="button" data-map-action="import">Abrir mapa JSON</button><button type="button" data-map-action="clear">Limpar terreno</button></div><p id="map-status" role="status">Mapa guardado neste navegador; exporte JSON para cópia de segurança.</p><input id="map-file" type="file" accept="application/json,.json" hidden><input id="map-quarks-file" type="file" accept="application/json,.json" hidden>`;
 dialog.querySelector('.game-bindings')!.prepend(panel);
 if(api.standalone){panel.querySelector('#map-enabled')!.closest('label')!.hidden=true;panel.querySelector('#map-enabled')!.closest('label')!.nextElementSibling!.textContent='Edite aqui e salve um mapa nomeado. No Teste de Jogo, escolha somente mapas salvos.';const toggle=panel.querySelector('#map-editing') as HTMLInputElement;toggle.checked=true;toggle.closest('label')!.lastChild!.textContent=' Pincéis ativos (desative para navegar)';toggle.closest('label')!.nextElementSibling!.textContent='Clique/arraste para editar. Alt + arrastar gira, botão direito desloca e rolagem aproxima. Use o Teste de Jogo para experimentar um mapa salvo.';}
 const tabs=panel.querySelector('[data-map-tab]')!.parentElement!,refButton=document.createElement('button');refButton.type='button';refButton.dataset.mapTab='reference';refButton.textContent='Referência';refButton.setAttribute('aria-pressed','false');tabs.append(refButton);
 const referencePanel=document.createElement('div');referencePanel.id='map-reference-panel';referencePanel.hidden=true;referencePanel.innerHTML='<h4>Mapa de referência</h4><p>PNG, JPG ou WebP no chão, acompanhando o relevo. Imagem reduzida até 2048 px, sem alterar o arquivo original.</p><button type="button" data-map-action="reference-import">Importar imagem</button><input id="map-reference-file" type="file" accept="image/png,image/jpeg,image/webp" hidden><div id="map-reference-fields"><label><input data-reference="visible" type="checkbox"> Mostrar imagem</label>'+[['opacity','Opacidade',0,1,.05],['width','Largura (m)',.1,500,.5],['height','Comprimento (m)',.1,500,.5],['x','Posição X',-50,50,.5],['z','Posição Z',-50,50,.5],['rotation','Rotação (graus)',-360,360,1]].map(([id,label,min,max,step])=>`<label>${label}<input data-reference="${id}" type="number" min="${min}" max="${max}" step="${step}"></label>`).join('')+'<button type="button" data-map-action="reference-remove">Remover referência</button></div>';panel.querySelector('#map-effects-panel')!.after(referencePanel);
 const stats=document.createElement('p');stats.id='map-terrain-stats';panel.append(stats);
 const baseLabel=document.createElement('label');baseLabel.innerHTML='Cor base do terreno<input id="map-ground-color" type="color" value="#526b57">';panel.querySelector('#map-terrain-panel')!.append(baseLabel);
 const vegetationPanel=document.createElement('section');vegetationPanel.id='map-vegetation-panel';vegetationPanel.hidden=true;vegetationPanel.innerHTML='<h3>Vegetação</h3><p>Mesmas oito variações EZ-Tree do Bioma, com galhos, folhas e vento.</p><div class="game-map-library">'+Object.entries(VEGETATION_KINDS).map(([id,label])=>`<button type="button" data-vegetation-kind="${id}" aria-pressed="${id==='tree'}">${label}</button>`).join('')+'</div><label>Variação de árvore<select id="map-vegetation-variant"><option value="-1">Misturar as 8 variações</option>'+EZ_TREE_VARIANTS.map((v,i)=>`<option value="${i}">${i+1} · ${v.preset} (${v.targetHeight} m)</option>`).join('')+'</select></label>';panel.append(vegetationPanel);
 const vegetationInspector=document.createElement('section');vegetationInspector.id='map-vegetation-inspector';vegetationInspector.hidden=true;vegetationInspector.innerHTML=`<h3>Distribuição em massa</h3><label>Ferramenta<select id="map-vegetation-tool"><option value="paint">Pintar vegetação</option><option value="erase">Apagar vegetação no raio</option></select></label><label>Raio (m)<input id="map-vegetation-radius" type="range" min="1" max="25" step="1" value="8"></label><label>Quantidade por aplicação<input id="map-vegetation-count" type="number" min="1" max="300" value="20"></label><label>Espaçamento mínimo (m)<input id="map-vegetation-spacing" type="number" min=".2" max="12" step=".2" value="3.5"></label><label>Escala mínima<input id="map-vegetation-min" type="number" min=".25" max="2" step=".05" value=".75"></label><label>Escala máxima<input id="map-vegetation-max" type="number" min=".25" max="2" step=".05" value="1.2"></label><label>Semente da distribuição<input id="map-vegetation-seed" maxlength="80" value="floresta-abrigo"></label><button type="button" data-map-action="vegetation-fill">Distribuir pelo mapa inteiro</button><button type="button" data-map-action="vegetation-clear">Limpar este tipo de vegetação</button><p id="map-vegetation-status" role="status"></p><p>Evita água, neve, caminhos, ruas e encostas íngremes. Limite de ${VEGETATION_LIMIT} elementos manuais. Desfazer restaura a distribuição.</p>`;panel.append(vegetationInspector);
 const graphics=document.createElement('section');graphics.className='map-graphics';graphics.innerHTML='<h4>Gráficos do Bioma</h4><label>Visual<select id="map-visual-style"><option value="forest">Floresta aprimorada</option><option value="classic">Clássico</option></select></label><label>Vento<input id="map-visual-wind" type="range" min="0" max="1" step=".05" value=".45"></label><p>Ondas, reflexos, grama em lâminas e vegetação instanciada, sem alterar o relevo salvo.</p>';panel.append(graphics);
 const $=<T extends HTMLElement=HTMLElement>(id:string)=>panel.querySelector<T>('#'+id)!;
 let surface=1,effectType='fire';
 let vegetationKind:VegetationKind='tree',stroke=0;
 const runtime=()=>api.preview()?.gameMap;
 const environmentIntro=document.createElement('section');environmentIntro.hidden=true;environmentIntro.innerHTML='<h3>Ambiente</h3><p>Clima, dia/noite, atmosfera e sons do Bioma. Salve o mapa para reutilizar no Teste de Jogo.</p>';panel.append(environmentIntro);
 const environmentControls=mountEnvironmentControls(panel,api.preview,(settings,done)=>{const map=runtime();if(!map)return;if(!before)begin();map.setEnvironment(settings);if(done)commit();});environmentControls.root.hidden=true;
 const message=(s:string)=>{$('map-status').textContent=s;if(api.standalone)dialog.querySelector<HTMLElement>('#map-library-status')!.textContent=s;};
 const snapshot=()=>runtime()?.snapshot()??structuredClone(data);
 const begin=()=>{before=snapshot();};
 const commit=()=>{const next=snapshot();if(before&&JSON.stringify(before)!==JSON.stringify(next)){past.push(before);past=past.slice(-20);future=[];}before=null;data=next;api.changed();syncFields();message('Mapa alterado. Clique em Salvar mapa em definitivo.');};
 const syncFields=()=>{
  const map=runtime(),terrain=map?.terrain.snapshot()??data.terrain;
  environmentControls.sync();
  const visual=map?.visual??data.visual??{style:'forest',wind:.45};$<HTMLSelectElement>('map-visual-style').value=visual.style;$<HTMLInputElement>('map-visual-wind').value=String(visual.wind);
  $('map-vegetation-status').textContent=map?.vegetation.error||`${map?.vegetation.snapshot().length??data.vegetation?.length??0} / ${VEGETATION_LIMIT} elementos · ${VEGETATION_KINDS[vegetationKind]}`;
  for(const input of panel.querySelectorAll<HTMLInputElement>('[data-map-water],[data-map-road]')){const key=input.dataset.mapWater??input.dataset.mapRoad!;input.value=String(terrain[key]??({waterDepth:.04,waterSpeed:.8,waterDirection:0,curbWidth:.18,roadDepth:.155,roadAngle:0,roadBlockScale:1,roadPattern:'brick'} as any)[key]);}
  const items=map?.effects.items()??[];
  selected=selected.filter(i=>i<items.length);
  const terrainStats=map?.terrain.stats();stats.textContent=terrainStats?`${items.length} efeitos · ${terrainStats.painted} células pintadas · altura ${terrainStats.min.toFixed(2)} a ${terrainStats.max.toFixed(2)} m`:'';
  $<HTMLInputElement>('map-ground-color').value=snapshot().ground??'#526b57';
  const ref=snapshot().reference;$('map-reference-fields').hidden=!ref;
  for(const input of panel.querySelectorAll<HTMLInputElement>('[data-reference]')){const key=input.dataset.reference!;if(ref){if(input.type==='checkbox')input.checked=ref.visible;else input.value=String((ref as any)[key]);}}
  $('map-effect-list').replaceChildren(...items.map((item,i)=>{const option=document.createElement('option');option.value=String(i);option.selected=selected.includes(i);option.textContent=`${i+1} · ${item.name}${item.userData.options.groupId?' · grupo':''}`;return option;}));
  const item=items[selected.at(-1)??-1];
  for(const input of panel.querySelectorAll<HTMLInputElement>('[data-effect-field]')){const key=input.dataset.effectField!;input.disabled=!item;input.value=item?String(key==='x'?item.position.x:key==='z'?item.position.z:item.userData.options[key]??1):'';}
 };
 const setEditing=(on:boolean)=>{editing=enabled&&on;$<HTMLInputElement>('map-editing').checked=editing;api.stop();api.preview()?.setMapEditing(editing);runtime()?.terrain.setCursor(null,0);runtime()?.terrain.setWaterPathVisible(editing&&$<HTMLSelectElement>('map-tool').value==='waterPath');};
 const open=()=>{if(enabled)api.preview()?.setGameMap(data);else api.preview()?.clearGameMap();api.preview()?.setMapEditing(editing);syncFields();};
 $('map-enabled').addEventListener('change',()=>{if(enabled)data=snapshot();enabled=$<HTMLInputElement>('map-enabled').checked;setEditing(false);open();api.changed();});
 $('map-editing').addEventListener('change',()=>{if(!enabled){$<HTMLInputElement>('map-enabled').checked=enabled=true;open();api.changed();}setEditing($<HTMLInputElement>('map-editing').checked);});
 const library=$('map-effect-library');for(const def of EFFECT_LIBRARY){const button=document.createElement('button');button.type='button';button.dataset.effectType=def.id;button.title=def.description;button.setAttribute('aria-pressed',String(def.id===effectType));button.append(previewCanvas(def));button.append(document.createTextNode(def.name));library.append(button);}
 panel.addEventListener('click',async event=>{const button=(event.target as HTMLElement).closest<HTMLButtonElement>('button');if(!button)return;
  try{
   if(button.dataset.mapTab){tab=button.dataset.mapTab;environmentIntro.hidden=environmentControls.root.hidden=tab!=='environment';panel.querySelectorAll<HTMLElement>('[data-map-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));$('map-terrain-panel').hidden=tab!=='terrain';$('map-effects-panel').hidden=tab!=='effects';vegetationPanel.hidden=vegetationInspector.hidden=tab!=='vegetation';runtime()?.terrain.setCursor(null,0);runtime()?.terrain.setWaterPathVisible(tab==='terrain'&&editing&&$<HTMLSelectElement>('map-tool').value==='waterPath');if(api.standalone){$('map-terrain-inspector').hidden=tab!=='terrain';$('map-effects-inspector').hidden=tab!=='effects';dialog.querySelector<HTMLElement>('#map-active-tool')!.textContent=tab==='terrain'?$<HTMLSelectElement>('map-tool').selectedOptions[0].textContent:tab==='vegetation'?'Vegetação':tab==='environment'?'Ambiente':'Efeitos';}else $('map-reference-panel').hidden=tab!=='reference';return;}
   if(button.dataset.vegetationKind){vegetationKind=button.dataset.vegetationKind as VegetationKind;panel.querySelectorAll<HTMLElement>('[data-vegetation-kind]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));$<HTMLInputElement>('map-vegetation-spacing').value=vegetationKind==='tree'?'3.5':vegetationKind==='rock'?'1.5':'.4';$('map-vegetation-variant').closest('label')!.hidden=vegetationKind!=='tree';syncFields();return;}
   if(button.dataset.mapSurface){surface=Number(button.dataset.mapSurface);panel.querySelectorAll<HTMLElement>('[data-map-surface]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));return;}
   if(button.dataset.mapTool){$<HTMLSelectElement>('map-tool').value=button.dataset.mapTool;$('map-tool').dispatchEvent(new Event('change',{bubbles:true}));return;}
   if(button.dataset.effectTag){const tag=button.dataset.effectTag;panel.querySelectorAll<HTMLElement>('[data-effect-tag]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));library.querySelectorAll<HTMLElement>('[data-effect-type]').forEach(b=>b.hidden=tag!=='all'&&!EFFECT_LIBRARY.find(d=>d.id===b.dataset.effectType)!.tags.includes(tag));return;}
   if(button.dataset.effectType){effectType=button.dataset.effectType;preset=null;library.querySelectorAll<HTMLElement>('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));$<HTMLSelectElement>('map-effect-tool').value='place';return;}
   const action=button.dataset.mapAction;if(!action)return;
   if(action==='reference-import'){$('map-reference-file').click();return;}
   if(action==='import'||action==='quarks'){$(action==='import'?'map-file':'map-quarks-file').click();return;}
   if(action==='export'){data=snapshot();const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='abrigo-mapa-teste.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return;}
   if(action==='save'){data=snapshot();if(api.save)api.save(data);else localStorage.setItem(GAME_MAP_STORE,JSON.stringify(data));message('Mapa salvo em definitivo neste navegador.');return;}
   if(action==='undo'||action==='redo'){const from=action==='undo'?past:future,to=action==='undo'?future:past;if(!from.length)return;to.push(snapshot());data=from.pop()!;selected=[];open();api.changed();return;}
   const map=runtime();if(!map)throw Error('Ative Usar mapa editável primeiro.');api.stop();begin();
   if(action==='clear')map.terrain.set(null);
   if(action==='vegetation-fill'){paintVegetation({x:0,z:0},true);}
   if(action==='vegetation-clear'){map.vegetation.set(map.vegetation.snapshot().filter(v=>v.kind!==vegetationKind));}
   if(action==='reference-remove')map.setReference(null);
   if(action==='effects-clear'){map.effects.items().forEach(item=>map.effects.remove(item));selected=[];}
   if(action==='route-clear')map.terrain.clearWaterPath();
   if(action==='route-done'){$<HTMLSelectElement>('map-tool').value='cursor';$('map-tool').dispatchEvent(new Event('change',{bubbles:true}));map.terrain.setWaterPathVisible(false);}
   const items=map.effects.items(),targets=selected.map(i=>items[i]).filter(Boolean);
   if(action==='remove'){targets.forEach(item=>map.effects.remove(item));selected=[];}
   if(action==='duplicate'){if(items.length+targets.length>128)throw Error('Limite de 128 efeitos.');const groups=new Map<string,string>();for(const item of targets){const options=structuredClone(item.userData.options);if(options.groupId){if(!groups.has(options.groupId))groups.set(options.groupId,crypto.randomUUID());options.groupId=groups.get(options.groupId);}const copy=map.effects.add(item.userData.effect,[Math.min(49,item.position.x+1.5),item.position.y,Math.min(49,item.position.z+1.5)],options);map.effects.configure(copy,options);}}
   if(action==='group'){if(targets.length<2)throw Error('Selecione ao menos dois efeitos.');const id=crypto.randomUUID();targets.forEach(item=>Object.assign(item.userData.options,{groupId:id,groupName:'Grupo de efeitos'}));}
   if(action==='ungroup')targets.forEach(item=>{delete item.userData.options.groupId;delete item.userData.options.groupName;});
   map.settleEffects();map.syncReference();commit();
  }catch(e){before=null;message((e as Error).message);}
 });
 panel.addEventListener('change',event=>{const input=event.target as HTMLInputElement;
  if(input.id==='map-effect-list'){selected=Array.from(($<HTMLSelectElement>('map-effect-list')).selectedOptions,o=>Number(o.value));syncFields();return;}
  const map=runtime();if(!map)return;
  if(input.id==='map-ground-color'){begin();map.setGround(input.value);commit();return;}
  if(input.id==='map-visual-style'||input.id==='map-visual-wind'){begin();map.setVisual({style:$<HTMLSelectElement>('map-visual-style').value as 'forest'|'classic',wind:Number($<HTMLInputElement>('map-visual-wind').value)});commit();return;}
  if(input.dataset.reference){try{const ref=snapshot().reference;if(!ref)return;begin();map.setReference(validateMapReference({...ref,[input.dataset.reference]:input.type==='checkbox'?input.checked:Number(input.value)}));commit();}catch(e){before=null;syncFields();message((e as Error).message);}return;}
  if(input.id==='map-tool'){map.terrain.setWaterPathVisible(editing&&input.value==='waterPath');return;}
  if(!input.dataset.mapWater&&!input.dataset.mapRoad&&!input.dataset.effectField)return;
  try{api.stop();begin();
   if(input.dataset.mapWater){const key=input.dataset.mapWater;key==='waterDepth'?map.terrain.setWaterDepth(Number(input.value)):map.terrain.setWaterSetting(key,Number(input.value));}
   if(input.dataset.mapRoad){map.terrain.setRoadSetting(input.dataset.mapRoad,input.dataset.mapRoad==='roadPattern'?input.value:Number(input.value));map.terrain.rebuild();}
   if(input.dataset.effectField){const item=map.effects.items()[selected.at(-1)??-1];if(item){const key=input.dataset.effectField,n=Number(input.value);if(!Number.isFinite(n)||n<Number(input.min)||n>Number(input.max))throw Error('Valor do efeito fora do limite.');if(key==='x'||key==='z')item.position[key]=n;else map.effects.configure(item,{[key]:n});}}
   map.settleEffects();commit();
  }catch(e){if(before){data=before;open();}before=null;message((e as Error).message);}
 });
 for(const id of ['map-file','map-quarks-file'])$(id).addEventListener('change',async()=>{const input=$<HTMLInputElement>(id),file=input.files?.[0];if(!file)return;try{if(file.size>10*1024*1024)throw Error('JSON excede 10 MB.');const raw=JSON.parse(await file.text());
  if(id==='map-quarks-file'){preset=validatePreset(raw);effectType='quarks';$<HTMLSelectElement>('map-effect-tool').value='place';message('Preset carregado. Ative edição e clique no terreno.');}
  else{const next=importGameMap(raw);past.push(snapshot());future=[];data=next;enabled=true;$<HTMLInputElement>('map-enabled').checked=true;selected=[];open();api.changed();message(raw?.format==='elemental-map'?'Terreno, efeitos e referência importados do editor original. Modelos e personagens externos não foram importados. Salve para manter.':'Mapa importado. Salve para manter.');}
 }catch(e){message((e as Error).message);}finally{input.value='';}});
 let dragging=false,start:any=null,last:any=null,moving=false,pointerId=-1;
 const arena=dialog.querySelector<HTMLElement>('#game-arena')!;
 const options=()=>({tool:$<HTMLSelectElement>('map-tool').value,radius:Number($<HTMLInputElement>('map-radius').value),strength:Number($<HTMLInputElement>('map-strength').value),level:Number($<HTMLInputElement>('map-level').value),surface,capClosed:$<HTMLInputElement>('map-cap-closed').checked});
 const vegetationRadius=()=>Number($<HTMLInputElement>('map-vegetation-radius').value);
 const paintVegetation=(point:{x:number;z:number},whole=false)=>{const map=runtime();if(!map)return;const old=map.vegetation.snapshot(),radius=whole?71:vegetationRadius();
  if(!whole&&$<HTMLSelectElement>('map-vegetation-tool').value==='erase'){map.vegetation.set(old.filter(v=>v.kind!==vegetationKind||Math.hypot(v.x-point.x,v.z-point.z)>radius));return;}
  const minScale=Number($<HTMLInputElement>('map-vegetation-min').value),maxScale=Number($<HTMLInputElement>('map-vegetation-max').value),count=Number($<HTMLInputElement>('map-vegetation-count').value),spacing=Number($<HTMLInputElement>('map-vegetation-spacing').value);
  if(![minScale,maxScale,count,spacing].every(Number.isFinite)||minScale<.25||maxScale>2||minScale>maxScale||count<1||count>300||spacing<.2||spacing>12)throw Error('Confira a quantidade, o espaçamento e as escalas da vegetação.');
  map.vegetation.set(scatterVegetation(old,{kind:vegetationKind,variant:Number($<HTMLSelectElement>('map-vegetation-variant').value),seed:$<HTMLInputElement>('map-vegetation-seed').value+':'+stroke++,count,x:point.x,z:point.z,radius,spacing,minScale,maxScale},(x,z)=>{
   if([5,6,7,8].includes(map.terrain.surfaceAt(x,z)))return false;
   const y=map.terrain.heightAt(x,z);return Math.max(Math.abs(map.terrain.heightAt(x+.4,z)-y),Math.abs(map.terrain.heightAt(x-.4,z)-y),Math.abs(map.terrain.heightAt(x,z+.4)-y),Math.abs(map.terrain.heightAt(x,z-.4)-y))<.4;
  }));
 };
 const sculpt=(point:any)=>{const map=runtime();if(!map)return;const opts=options();if(opts.tool==='fill')map.terrain.fill(point,surface);else if(opts.tool==='waterPath')map.terrain.addWaterPathPoint(point);else map.terrain.apply(point,opts);map.terrain.rebuild();map.settleEffects();map.syncReference();};
 arena.addEventListener('pointerdown',event=>{if(!editing||tab==='reference'||tab==='environment'||event.button!==0||event.altKey||(event.target as HTMLElement).closest('.game-arena-hud'))return;const point=api.preview()?.gameMapHit(event),map=runtime();if(!point||!map||(tab==='terrain'&&options().tool==='cursor'))return;event.preventDefault();event.stopImmediatePropagation();api.stop();begin();start=last=point;dragging=true;pointerId=event.pointerId;arena.setPointerCapture(pointerId);
  try{if(tab==='terrain'){if(options().tool!=='path')sculpt(point);}
  else if(tab==='vegetation'){paintVegetation(point);moving=false;}
  else if($<HTMLSelectElement>('map-effect-tool').value==='place'){if(map.effects.items().length>=128)throw Error('Limite de 128 efeitos.');const item=map.effects.add(effectType,point.toArray(),preset?{preset,name:'Preset Quarks'}:{});selected=[map.effects.items().indexOf(item)];syncFields();moving=false;}
  else{const item=api.preview()?.gameEffectHit(event);if(item){const items=map.effects.items(),index=items.indexOf(item);if(event.shiftKey)selected=selected.includes(index)?selected.filter(i=>i!==index):[...selected,index];else selected=event.ctrlKey?[index]:items.flatMap((e,i)=>e===item||(item.userData.options.groupId&&e.userData.options.groupId===item.userData.options.groupId)?[i]:[]);moving=true;syncFields();}else{selected=[];moving=false;syncFields();}}}catch(e){message((e as Error).message);dragging=false;before=null;}
 },true);
 let pending:any=null,raf=0;
 const flush=()=>{raf=0;const point=pending;pending=null;const map=runtime();if(!point||!map||!dragging)return;
  if(tab==='terrain'){if(!['path','fill','waterPath'].includes(options().tool))sculpt(point);if(options().tool==='path')map.terrain.previewLine(start,point);}
  else if(tab==='vegetation'){if(last.distanceTo(point)>Math.max(.5,vegetationRadius()*.35)){try{paintVegetation(point);}catch(e){message((e as Error).message);}last=point;}return;}
  else if(moving){for(const index of selected){const item=map.effects.items()[index];item.position.x=Math.max(-50,Math.min(50,item.position.x+point.x-last.x));item.position.z=Math.max(-50,Math.min(50,item.position.z+point.z-last.z));}map.settleEffects();}last=point;
 };
 arena.addEventListener('pointermove',event=>{if(!editing)return;const point=api.preview()?.gameMapHit(event);runtime()?.terrain.setCursor(tab==='terrain'||tab==='vegetation'?point:null,tab==='vegetation'?vegetationRadius():options().radius);if(!dragging||!point)return;event.preventDefault();event.stopImmediatePropagation();pending=point;if(!raf)raf=requestAnimationFrame(flush);},true);
 const end=(event:PointerEvent)=>{if(!dragging)return;event.stopImmediatePropagation();if(raf)cancelAnimationFrame(raf);flush();const map=runtime();if(tab==='terrain'&&options().tool==='path'&&map){map.terrain.path(start,last,options());map.terrain.rebuild();map.terrain.previewLine(null,null);}dragging=false;moving=false;if(arena.hasPointerCapture(pointerId))arena.releasePointerCapture(pointerId);commit();};
 arena.addEventListener('pointerup',end,true);arena.addEventListener('pointercancel',end,true);
 $('map-reference-file').addEventListener('change',async()=>{const input=$<HTMLInputElement>('map-reference-file'),file=input.files?.[0];if(!file)return;try{if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>30*1024*1024)throw Error('Use PNG, JPG ou WebP até 30 MB.');const bitmap=await createImageBitmap(file),ratio=Math.min(1,2048/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();let image=canvas.toDataURL('image/webp',.85);if(image.length>3000000)image=canvas.toDataURL('image/jpeg',.65);const ref=validateMapReference({image,name:file.name.slice(0,200),visible:true,opacity:.6,width:40,height:Math.max(.1,Math.min(100,40*canvas.height/canvas.width)),x:0,z:0,rotation:0});begin();runtime()?.setReference(ref);commit();}catch(e){before=null;message((e as Error).message);}finally{input.value='';}});
 const clearEffects=document.createElement('button');clearEffects.type='button';clearEffects.dataset.mapAction='effects-clear';clearEffects.textContent='Limpar efeitos';$('map-effects-panel').append(clearEffects);
 if(api.standalone){
  panel.classList.add('map-docked-controls');
  const left=document.createElement('aside');left.className='map-left-dock';left.setAttribute('aria-label','Biblioteca do mapa');
  const right=document.createElement('aside');right.className='map-right-dock';right.setAttribute('aria-label','Configurações do mapa');
  const top=document.createElement('div');top.className='map-top-controls';
  panel.append(top,left,right);
  const title=document.createElement('h3');title.textContent='Terreno';$('map-terrain-panel').prepend(title);
  const effectsTitle=document.createElement('h3');effectsTitle.textContent='Efeitos';$('map-effects-panel').prepend(effectsTitle);
  const terrainInspector=document.createElement('section');terrainInspector.id='map-terrain-inspector';terrainInspector.innerHTML='<h3>Construção do terreno</h3><h4>Ferramentas</h4>';
  right.append(terrainInspector);
  const toolButtons=document.createElement('div');toolButtons.className='map-tool-buttons';
  for(const id of ['cursor','paint','path','raise','lower','flatten','smooth','fill','erase']){const option=Array.from($<HTMLSelectElement>('map-tool').options).find(o=>o.value===id)!;const b=document.createElement('button');b.type='button';b.dataset.mapTool=option.value;b.textContent=id==='cursor'?'Cursor':id==='path'?'Caminho':option.textContent;b.setAttribute('aria-pressed',String(option.selected));toolButtons.append(b);}
  terrainInspector.append(toolButtons);
  for(const child of Array.from($('map-terrain-panel').children))if(child!==title&&child.id!=='map-surfaces')terrainInspector.append(child);
  $<HTMLSelectElement>('map-tool').closest('label')!.hidden=true;
  const effectsInspector=document.createElement('section');effectsInspector.id='map-effects-inspector';effectsInspector.hidden=true;effectsInspector.innerHTML='<h3>Configurações do efeito</h3>';
  right.append(effectsInspector);
  for(const child of Array.from($('map-effects-panel').children))if(child!==effectsTitle&&child.id!=='map-effect-library'&&!child.querySelector('[data-effect-tag]'))effectsInspector.append(child);
  const editingLabel=$('map-editing').closest('label')!,hint=editingLabel.nextElementSibling!;
  top.append(tabs,editingLabel);refButton.hidden=true;
  const sceneSettings=document.createElement('section');sceneSettings.className='map-scene-settings';sceneSettings.innerHTML='<h3>Cena</h3>';sceneSettings.append(baseLabel);
  sceneSettings.append(graphics);right.append(terrainInspector,effectsInspector,vegetationInspector,environmentControls.root,referencePanel,sceneSettings,hint);referencePanel.hidden=false;
  left.append($('map-terrain-panel'),$('map-effects-panel'),vegetationPanel,environmentIntro,stats);
  const actions=panel.querySelector('[data-map-action="undo"]')!.parentElement!;
  $('map-terrain-panel').append(panel.querySelector('[data-map-action="clear"]')!);
  top.append(actions);panel.querySelectorAll<HTMLElement>('[data-map-action="undo"],[data-map-action="redo"],[data-map-action="save"]').forEach(b=>b.hidden=true);
  panel.querySelector('h3')!.hidden=true;panel.querySelector('#map-enabled')!.closest('label')!.nextElementSibling!.remove();
  panel.append(top,left,right);right.append($('map-status'));
  const syncTools=()=>{const value=$<HTMLSelectElement>('map-tool').value;toolButtons.querySelectorAll<HTMLElement>('[data-map-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mapTool===value)));dialog.querySelector<HTMLElement>('#map-active-tool')!.textContent=$<HTMLSelectElement>('map-tool').selectedOptions[0].textContent;};
  $('map-tool').addEventListener('change',syncTools);
  const water=terrainInspector.querySelectorAll<HTMLDetailsElement>('details')[0],road=terrainInspector.querySelectorAll<HTMLDetailsElement>('details')[1];
  for(const [target,tool,label] of [[water,'waterPath','Marcar pontos'],[road,'curb','Pintar fechamentos']] as const){const b=document.createElement('button');b.type='button';b.dataset.mapTool=tool;b.textContent=label;target.append(b);}
  const syncSurface=()=>{water.hidden=surface!==5;road.hidden=surface!==8;water.open=road.open=true;};syncSurface();panel.addEventListener('click',e=>{if((e.target as HTMLElement).closest('[data-map-surface]'))syncSurface();});
 }
 dialog.addEventListener('keydown',event=>{if((event.target as HTMLElement).closest('input,select,textarea'))return;const action=(event.ctrlKey||event.metaKey)?event.code==='KeyZ'?(event.shiftKey?'redo':'undo'):event.code==='KeyY'?'redo':event.code==='KeyD'?'duplicate':null:event.code==='Delete'?'remove':null;if(action){event.preventDefault();panel.querySelector<HTMLButtonElement>(`[data-map-action="${action}"]`)?.click();}});
 return {open,replace(next:GameMapData){data=validateGameMap(next);past=[];future=[];selected=[];open();api.changed();},get enabled(){return enabled;},get editing(){return editing;},setEditing,close(){data=snapshot();setEditing(false);api.preview()?.clearGameMap();},get data(){return snapshot();}};
}
