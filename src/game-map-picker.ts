import {loadMapLibrary} from './map-library';
import type {createPreview} from './scene';
export function mountGameMapPicker(dialog:HTMLElement,api:{preview:()=>ReturnType<typeof createPreview>|null;stop:()=>void;changed:()=>void}){
 const panel=document.createElement('section');panel.className='game-map-picker';panel.innerHTML='<h3>Mapa do teste</h3><label>Mapa salvo<select id="game-map-choice"><option value="">Circuito de testes original</option></select></label><p>Edite e salve os mapas na guia Mapa do editor principal. O teste utiliza apenas a versão salva.</p><p id="game-map-choice-status" role="status"></p>';dialog.querySelector('.game-bindings')!.prepend(panel);
 const select=panel.querySelector<HTMLSelectElement>('select')!,status=panel.querySelector('#game-map-choice-status')!;let enabled=false;
 const refresh=()=>{const value=select.value;try{select.replaceChildren(new Option('Circuito de testes original',''),...loadMapLibrary(localStorage).map(m=>new Option(m.name,m.id)));select.value=value;}catch(e){status.textContent=(e as Error).message;}};
 const open=()=>{refresh();try{const saved=loadMapLibrary(localStorage).find(m=>m.id===select.value);enabled=!!saved;if(saved){api.preview()?.setGameMap(saved.data);status.textContent='Usando a versão salva de “'+saved.name+'”.';}else{api.preview()?.clearGameMap();status.textContent='Circuito original: obstáculos, rampas e corte de madeira.';}}catch(e){enabled=false;api.preview()?.clearGameMap();status.textContent=(e as Error).message;}};
 select.onchange=()=>{api.stop();open();api.changed();};
 return {open,get enabled(){return enabled;},setEditing(_on:boolean){},close(){api.preview()?.clearGameMap();}};
}
