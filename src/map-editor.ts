import {createPreview} from './scene';
import {mountGameMapEditor} from './game-map-editor';
import {emptyGameMap,validateGameMap,type GameMapData} from './game-map-data';
import {loadMapLibrary,saveMap,MAP_DRAFT_STORE} from './map-library';

export function mountMapEditor(characterPreview:ReturnType<typeof createPreview>|null){
 const nav=document.querySelector('.creator-modes')!,header=document.querySelector('.topbar')!;
 const button=document.createElement('button');button.id='mode-map';button.textContent='Mapa';button.setAttribute('aria-pressed','false');nav.append(button);
 const workspace=document.createElement('main');workspace.className='workspace map-workspace';workspace.hidden=true;workspace.innerHTML=`<section class="map-stage"><div class="stage-heading"><div><span class="section-eyebrow">EDITOR DE MAPA / 100 × 100 M</span><h2 id="map-title">Novo mapa</h2></div><div class="game-test-actions"><button data-map-view="iso">Isométrica</button><button data-map-view="top">Superior</button><button data-map-view="front">Frente</button><button data-map-view="iso">Enquadrar</button><button id="map-grid-toggle" aria-pressed="true">Grade</button><button id="map-png">Salvar PNG</button></div></div><div id="game-arena" tabindex="0" aria-label="Cenário do editor de mapa"></div><p id="map-library-status" role="status">Os mapas salvos ficam disponíveis no Teste de Jogo.</p></section><aside class="game-bindings"><section class="map-library"><h3>Meus mapas</h3><label>Mapa salvo<select id="map-saved-list"><option value="">Escolha um mapa</option></select></label><label>Nome do mapa<input id="map-name" maxlength="80" value="Meu mapa"></label><div class="game-test-actions"><button id="map-new">Novo mapa</button><button id="map-save-copy">Salvar como novo</button><button id="map-open-saved">Abrir selecionado</button></div><p>Salvar substitui apenas o mapa atual. “Salvar como novo” cria outra entrada. Rascunhos não alteram os mapas salvos.</p></section></aside>`;
 nav.parentElement!.insertBefore(workspace,document.querySelector('#toast'));
 const toolbar=document.createElement('div');toolbar.className='map-floating-toolbar';toolbar.innerHTML='<strong id="map-active-tool">Pintar</strong><button type="button" data-map-history="undo" aria-label="Desfazer mapa" title="Desfazer (Ctrl+Z)">↶</button><button type="button" data-map-history="redo" aria-label="Refazer mapa" title="Refazer (Ctrl+Y)">↷</button><small>Alt + arrastar: orbitar</small>';workspace.querySelector('.map-stage')!.append(toolbar);
 workspace.querySelector('.map-library')!.classList.add('map-document-header');
 const cameraTools=workspace.querySelector('.stage-heading .game-test-actions')!;cameraTools.classList.add('map-camera-tools');workspace.querySelector('.map-stage')!.append(cameraTools);
 const $=<T extends HTMLElement=HTMLElement>(id:string)=>workspace.querySelector<T>('#'+id)!;
 let active=false,preview:ReturnType<typeof createPreview>|null=null,id='',initial=emptyGameMap(),dirty=false;
 const status=(s:string)=>$('map-library-status').textContent=s;
 try{const draft=localStorage.getItem(MAP_DRAFT_STORE);if(draft){const d=JSON.parse(draft);initial=validateGameMap(d.data);id=typeof d.id==='string'?d.id:'';$<HTMLInputElement>('map-name').value=String(d.name??'Meu mapa').slice(0,80);}else{const first=loadMapLibrary(localStorage)[0];if(first){initial=first.data;id=first.id;$<HTMLInputElement>('map-name').value=first.name;}}}catch{status('Não foi possível ler o rascunho. O armazenamento anterior foi preservado.');}
 const refresh=()=>{const list=loadMapLibrary(localStorage);$('map-saved-list').replaceChildren(new Option('Escolha um mapa',''),...list.map(m=>new Option(m.name,m.id)));$<HTMLSelectElement>('map-saved-list').value=id;};
 const draft=()=>{dirty=true;const name=$<HTMLInputElement>('map-name').value;$('map-title').textContent=name||'Novo mapa';try{localStorage.setItem(MAP_DRAFT_STORE,JSON.stringify({id,name,data:editor.data}));status('Rascunho automático · alterações ainda não publicadas no mapa salvo.');}catch{status('Sem espaço para rascunho. Exporte o mapa em JSON para não perder a edição.');}};
 const save=(data:GameMapData,newCopy=false)=>{const record=saveMap(localStorage,newCopy||!id?crypto.randomUUID():id,$<HTMLInputElement>('map-name').value,data);id=record.id;dirty=false;localStorage.setItem(MAP_DRAFT_STORE,JSON.stringify({id,name:record.name,data}));refresh();status('Mapa “'+record.name+'” salvo. Disponível no Teste de Jogo.');window.dispatchEvent(new Event('abrigo-maps-saved'));};
 const editor=mountGameMapEditor(workspace,{preview:()=>preview,stop:()=>{},changed:draft,standalone:true,initial,save:data=>save(data)});
 workspace.querySelectorAll<HTMLButtonElement>('[data-map-history]').forEach(b=>b.onclick=()=>workspace.querySelector<HTMLButtonElement>(`[data-map-action="${b.dataset.mapHistory}"]`)!.click());
 const saveButton=document.createElement('button');saveButton.id='map-save-current';saveButton.textContent='Salvar mapa';$('map-save-copy').before(saveButton);saveButton.onclick=()=>{try{save(editor.data);}catch(e){status((e as Error).message);}};
 workspace.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.code==='KeyS'){event.preventDefault();saveButton.click();}});
 $('map-save-copy').onclick=()=>{try{save(editor.data,true);}catch(e){status((e as Error).message);}};
 $('map-new').onclick=()=>{if(dirty&&!confirm('O rascunho atual será substituído. Salve ou exporte antes de continuar. Criar novo mapa?'))return;id='';$<HTMLInputElement>('map-name').value='Meu mapa';editor.replace(emptyGameMap());editor.setEditing(true);preview?.mapView('iso');refresh();};
 $('map-open-saved').onclick=()=>{try{const selected=loadMapLibrary(localStorage).find(m=>m.id===$<HTMLSelectElement>('map-saved-list').value);if(!selected){status('Escolha um mapa salvo.');return;}if(dirty&&!confirm('Substituir o rascunho atual pelo mapa salvo?'))return;id=selected.id;$<HTMLInputElement>('map-name').value=selected.name;editor.replace(selected.data);dirty=false;status('Mapa carregado. Edite e salve para substituir esta versão.');}catch(e){status((e as Error).message);}};
 $('map-name').oninput=draft;
 workspace.querySelectorAll<HTMLButtonElement>('[data-map-view]').forEach(b=>b.onclick=()=>{preview?.mapView(b.dataset.mapView!);workspace.querySelectorAll<HTMLElement>('[data-map-view]').forEach(v=>v.setAttribute('aria-pressed',String(v===b)));});
 let grid=true;$('map-grid-toggle').onclick=()=>{grid=!grid;preview?.mapGrid(grid);$('map-grid-toggle').setAttribute('aria-pressed',String(grid));};
 $('map-png').onclick=async()=>{if(!preview)return;const a=document.createElement('a');a.href=await preview.snapshot();a.download='abrigo-mapa.png';a.click();};
 const setActive=(on:boolean)=>{active=on;workspace.hidden=!on;button.setAttribute('aria-pressed',String(on));preview?.setActive(on);if(!on)return;
  (window as any).__ABRIGO_OBJECTS__?.setActive(false);(window as any).__ABRIGO_CREATURES__?.setMode(false);characterPreview?.setActive(false);
  document.querySelectorAll<HTMLElement>('.workspace').forEach(w=>w.hidden=w!==workspace);nav.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  const url=new URL(location.href);url.searchParams.set('mode','map');history.replaceState(null,'',url);header.querySelector('.brand small')!.textContent='MAPA';header.querySelector('.project-status')!.textContent='OFICINA DE MAPAS';header.querySelector('#export span')!.textContent='Exportar mapa';
  if(!preview){preview=createPreview($('game-arena'),()=>{});preview.setMapWorkspace(true);editor.open();editor.setEditing(true);preview.mapView('iso');}else{preview.setActive(true);preview.mapGrid(grid);}
  try{refresh();}catch(e){status((e as Error).message);}$('map-title').textContent=$<HTMLInputElement>('map-name').value;
 };
 button.onclick=()=>setActive(true);
 nav.querySelectorAll<HTMLButtonElement>('button').forEach(b=>{if(b!==button&&b.id!=='mode-game-test')b.addEventListener('click',()=>{if(active){setActive(false);const url=new URL(location.href);if(url.searchParams.get('mode')==='map'){const next={'mode-objects':'objects','mode-villains':'villains'}[b.id];if(next)url.searchParams.set('mode',next);else url.searchParams.delete('mode');history.replaceState(null,'',url);}}});});
 for(const action of ['import','export'])header.querySelector('#'+action)!.addEventListener('click',e=>{if(!active)return;e.stopImmediatePropagation();workspace.querySelector<HTMLButtonElement>(`[data-map-action="${action}"]`)!.click();},true);
 (window as any).__ABRIGO_MAPS__={setActive,pauseRendering:(paused:boolean)=>preview?.setActive(active&&!paused)};
 if(new URLSearchParams(location.search).get('mode')==='map')setActive(true);
}
