import {createPreview} from './scene';
import {clone,DEFAULT,MOTIONS,type CharacterSpec} from './schema';
import {GAME_COMMANDS,GAME_CONTROL_STORE,createGameController,defaultGameControls,loadGameControls,validateGameControls,type GameCommand,type GameFrame} from './game-controls';
import {characterCollisionRadius,proceduralTestCharacters,type GameObstacle} from './game-collision';
import {createGameCourse} from './game-course';
import {CREATURE_SPECIES,type CreatureSpecies} from './creature-schema';
import {prepareFauna} from './fauna-prepare';
import {presetCreature} from './creature-schema';
import {COMBAT_STORE,loadCombatConfig,validateCombatConfig,type CombatConfig} from './game-combat';
import {mountGameMapPicker} from './game-map-picker';

const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const keyName=(key:string)=>key?({Space:'Espaço',ShiftLeft:'Shift esquerdo',ControlLeft:'Ctrl esquerdo',ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→'}[key]??key.replace(/^Key|^Digit/,'')):'Sem vínculo';
export function mountGameTest(getCharacter:()=>CharacterSpec,editorPreview:ReturnType<typeof createPreview>|null){
 const button=document.createElement('button');button.id='mode-game-test';button.textContent='Teste de jogo';document.querySelector('.creator-modes')!.append(button);
 const dialog=document.createElement('dialog');dialog.className='game-test';dialog.setAttribute('aria-label','Teste de jogo');
 dialog.innerHTML=`<header class="game-test-header"><div><span class="section-eyebrow">LABORATÓRIO DE MOVIMENTOS</span><h2>Teste de jogo</h2><p id="game-character"></p></div><div class="game-header-actions"><button class="button" id="game-fullscreen" aria-pressed="false">Tela cheia</button><button class="button quiet" id="game-close">Voltar ao editor</button></div></header>
 <div class="game-test-layout"><section class="game-arena-column"><div id="game-arena" tabindex="0" aria-label="Arena de teste. Clique em Jogar para usar teclado ou joystick."></div><div class="game-live"><strong id="game-motion">Parado</strong><span id="game-position">X 0,00 · Z 0,00</span></div><div class="game-test-actions"><button class="button primary" id="game-play">Jogar</button><button class="button" id="game-center">Reiniciar posição</button></div><p class="game-help">WASD para andar · Shift para correr · Ctrl para correr+ · Espaço para pular · C para agachar · F para ataque lateral. Solte e pressione novamente para repetir uma ação. Esc pausa os controles.</p><p class="game-help">Caminhar/correr + salto ou ataque lateral combinam automaticamente. O item segue os ajustes e o ON/OFF de cada movimento. Área livre de teste: sem colisões ou inimigos.</p><p id="game-pad-status" role="status"></p></section>
 <section class="game-bindings"><h3>Controles de movimento</h3><p>Altere a tecla ou escolha o número do botão. Também pode capturar o próximo botão do joystick. Shift/Ctrl são modificadores de velocidade; use junto com uma direção.</p><div class="game-device-settings" id="game-device-settings"></div><div class="game-binding-table" id="game-binding-table"></div><div class="game-test-actions"><button class="button save-button" id="game-save">Salvar controles em definitivo</button><button class="button quiet" id="game-default">Padrão</button></div><p id="game-control-message" role="status">Vínculos salvos neste navegador, separados do personagem.</p></section></div>`;
 document.body.append(dialog);
 const courseHelp=dialog.querySelectorAll('.game-help')[1];courseHelp.textContent='Circuito 48 × 48 m: rampas, vão, caixas, passagem baixa (C), corte de madeira e combate por ondas. Configure e inicie o combate no painel. Fora do combate, não há dano aos personagens.';
 const collisionPanel=document.createElement('div');collisionPanel.className='game-device-settings';collisionPanel.innerHTML='<label><input id="game-collision-enabled" type="checkbox" checked> Colisão ON/OFF</label><label><input id="game-collision-areas" type="checkbox" checked> Mostrar áreas de colisão</label>';
 dialog.querySelector('.game-bindings')!.insertBefore(collisionPanel,dialog.querySelector('#game-device-settings'));
 const collisionStatus=document.createElement('p');collisionStatus.id='game-collision-status';collisionStatus.className='game-help';collisionStatus.setAttribute('role','status');dialog.querySelector('.game-live')!.after(collisionStatus);
 const aimStatus=document.createElement('p');aimStatus.id='game-aim-status';aimStatus.className='game-help';aimStatus.setAttribute('role','status');aimStatus.textContent='Mira livre · segure V para travar e recuar';collisionStatus.after(aimStatus);
 const $=<T extends HTMLElement=HTMLElement>(id:string)=>dialog.querySelector<T>('#'+id)!;
 let course=createGameCourse(),bodyHeight=1.8,currentSector='start';
 const sectors=document.createElement('div');sectors.className='game-device-settings';sectors.innerHTML='<label>Ir para setor<select id="game-sector"></select></label><button class="button" id="game-random-npcs">Novos personagens HD</button>';collisionPanel.after(sectors);
 const woodControls=document.createElement('div');woodControls.className='game-test-actions';woodControls.innerHTML='<button class="button" id="game-wood-axe">Machado de teste</button><button class="button" id="game-wood-reset">Reiniciar tronco</button>';sectors.after(woodControls);
 const overlay=document.createElement('div');overlay.className='game-arena-hud';overlay.innerHTML='<strong id="game-sector-title">Circuito de testes</strong><span id="game-arena-state"></span><div class="game-arena-full-controls"><select id="game-quick-sector" aria-label="Ir para setor na tela cheia"></select><button class="button" id="game-quick-play">Jogar</button><button class="button" id="game-fullscreen-exit">Sair da tela cheia</button></div>';$('game-arena').append(overlay);
 const woodStatus=document.createElement('strong');woodStatus.id='game-wood-status';woodStatus.setAttribute('role','status');overlay.append(woodStatus);
 const woodQuick=document.createElement('div');woodQuick.className='game-arena-full-controls';woodQuick.innerHTML='<button class="button" id="game-quick-axe">Machado de teste</button><button class="button" id="game-quick-wood-reset">Reiniciar tronco</button>';overlay.append(woodQuick);
 const combatStatus=document.createElement('strong');combatStatus.id='game-combat-status';combatStatus.setAttribute('role','status');overlay.append(combatStatus);
 const combatPanel=document.createElement('section');combatPanel.className='game-combat-panel';combatPanel.innerHTML='<h3>Combate por ondas</h3><p class="game-help">Até 10 ondas, com 1–20 criaturas em cada uma. R/F atacam à frente; equipe o machado para maior alcance. Dano de teste por distância/direção, sem alterar os personagens salvos.</p><div id="game-combat-settings" class="game-device-settings"></div><div id="game-combat-waves"></div><div class="game-test-actions"><button class="button" id="game-wave-add">Adicionar onda</button><button class="button save-button" id="game-wave-save">Salvar ondas</button></div><div class="game-test-actions"><button class="button primary" id="game-combat-start">Iniciar / reiniciar combate</button><button class="button" id="game-combat-stop">Encerrar combate</button></div><p id="game-combat-message" class="game-help" role="status"></p>';woodControls.after(combatPanel);
 let combatConfig:CombatConfig=loadCombatConfig(localStorage);
 const renderCombat=()=>{
  $('game-combat-settings').innerHTML=`<label>Vida do jogador<input data-combat-setting="health" type="number" min="1" max="500" value="${combatConfig.health}"></label><label>Dano por golpe<input data-combat-setting="damage" type="number" min="1" max="100" value="${combatConfig.damage}"></label><label>Intervalo entre ondas (s)<input data-combat-setting="interval" type="number" min="0" max="30" value="${combatConfig.interval}"></label>`;
  $('game-combat-waves').innerHTML=combatConfig.waves.map((wave,index)=>`<fieldset class="game-wave"><legend>Onda ${index+1}</legend><div class="game-wave-types">${Object.entries(CREATURE_SPECIES).map(([id,label])=>`<label>${label}<input type="number" min="0" max="20" step="1" data-wave="${index}" data-enemy="${id}" value="${wave.enemies[id as CreatureSpecies]??0}"></label>`).join('')}</div><button class="button quiet" data-wave-remove="${index}" ${combatConfig.waves.length===1?'disabled':''}>Remover onda</button></fieldset>`).join('');
  $<HTMLButtonElement>('game-wave-add').disabled=combatConfig.waves.length>=10;
 };renderCombat();
 const readCombatFields=()=>{dialog.querySelectorAll<HTMLInputElement>('[data-combat-setting]').forEach(el=>(combatConfig as any)[el.dataset.combatSetting!]=Number(el.value));dialog.querySelectorAll<HTMLInputElement>('[data-wave][data-enemy]').forEach(el=>combatConfig.waves[Number(el.dataset.wave)]!.enemies[el.dataset.enemy as CreatureSpecies]=Number(el.value));return combatConfig;};
 const combatQuick=document.createElement('div');combatQuick.className='game-arena-full-controls';combatQuick.innerHTML='<button class="button" id="game-quick-combat-start">Reiniciar combate</button><button class="button" id="game-quick-combat-stop">Encerrar combate</button>';overlay.append(combatQuick);
 const renderSectors=()=>{const html=course.points.map(p=>`<option value="${p.id}" ${currentSector===p.id?'selected':''}>${p.label}</option>`).join('');$('game-sector').innerHTML=html;$('game-quick-sector').innerHTML=html;};renderSectors();
 let config;try{config=loadGameControls(localStorage);}catch{config=defaultGameControls();}
 let controller=createGameController(config),preview:ReturnType<typeof createPreview>|null=null,running=false,capture:{command:GameCommand;kind:'key'|'pad'}|null=null;
 let mapEditor:ReturnType<typeof mountGameMapPicker>;
 const keys=new Set<string>(),pendingKeys=new Set<string>();let priorPad:boolean[]=[],state:GameFrame={motion:'idle',time:0,x:0,z:0,yaw:0},padText='';
 let obstacles:GameObstacle[]=[],bodyRadius=.4;
 const setupCollisions=()=>{controller.setCollisions(obstacles,bodyRadius,$<HTMLInputElement>('game-collision-enabled').checked);controller.setCourse(course,bodyHeight);};
 const message=(text:string)=>$('game-control-message').textContent=text;
 let ownsFullscreen=false;
 const isFullscreen=()=>document.fullscreenElement===$('game-arena')||dialog.classList.contains('game-arena-fullscreen');
 const syncFullscreen=()=>{const on=isFullscreen();$('game-fullscreen').textContent=on?'Sair da tela cheia':'Tela cheia';$('game-fullscreen').setAttribute('aria-pressed',String(on));};
 const exitTestFullscreen=async()=>{dialog.classList.remove('game-arena-fullscreen');if(ownsFullscreen&&document.fullscreenElement===$('game-arena'))try{await document.exitFullscreen();}catch{}ownsFullscreen=false;syncFullscreen();};
 $('game-fullscreen').onclick=async()=>{
  if(isFullscreen())await exitTestFullscreen();
  else{
   dialog.classList.add('game-arena-fullscreen');
   try{if(!document.fullscreenEnabled)throw new Error('unavailable');await $('game-arena').requestFullscreen();ownsFullscreen=true;}
   catch{message('Área de jogo expandida no navegador. Este ambiente não permite tela cheia nativa.');}
   syncFullscreen();
  }
  if(running)$('game-arena').focus();
 };
 document.addEventListener('fullscreenchange',()=>{if(ownsFullscreen&&document.fullscreenElement!==$('game-arena')){ownsFullscreen=false;dialog.classList.remove('game-arena-fullscreen');}syncFullscreen();});
 $('game-fullscreen-exit').onclick=()=>{void exitTestFullscreen();if(running)$('game-arena').focus();};
 dialog.addEventListener('cancel',event=>{if(isFullscreen()){event.preventDefault();void exitTestFullscreen();}});
 dialog.addEventListener('close',()=>{void exitTestFullscreen();});
 const stop=()=>{running=false;keys.clear();pendingKeys.clear();capture=null;$('game-play').textContent=$('game-quick-play').textContent='Jogar';$('game-play').setAttribute('aria-pressed','false');};
 const renderSettings=()=>{
  const options=(selected:number,max:number,label:string,auto=false)=>(auto?`<option value="-1" ${selected===-1?'selected':''}>Automático</option>`:'')+Array.from({length:max},(_,i)=>`<option value="${i}" ${selected===i?'selected':''}>${label} ${i}</option>`).join('');
  $('game-device-settings').innerHTML=`<label>Joystick<select data-setting="gamepad">${options(config.gamepad,4,'Controle',true)}</select></label><label>Eixo horizontal<select data-setting="axisX">${options(config.axisX,8,'Eixo')}</select></label><label>Eixo vertical<select data-setting="axisY">${options(config.axisY,8,'Eixo')}</select></label><label>Zona morta<input data-setting="deadzone" type="number" min="0.05" max="0.8" step="0.05" value="${config.deadzone}"></label><label>Velocidade ×<input data-setting="speed" type="number" min="0.25" max="2" step="0.05" value="${config.speed}"></label><label><input data-setting="invertX" type="checkbox" ${config.invertX?'checked':''}> Inverter horizontal</label><label><input data-setting="invertY" type="checkbox" ${config.invertY?'checked':''}> Inverter vertical</label>`;
  $('game-binding-table').innerHTML=`<table><thead><tr><th>Movimento</th><th>Teclado</th><th>Joystick</th></tr></thead><tbody>${Object.entries(GAME_COMMANDS).map(([command,label])=>{
   const b=config.bindings[command as GameCommand];return `<tr><th scope="row">${label}</th><td><button class="button quiet" data-key="${command}" aria-label="Tecla para ${label}">${esc(keyName(b.key))}</button><button class="game-clear" data-clear="${command}" aria-label="Limpar tecla para ${label}">×</button></td><td><select data-pad="${command}" aria-label="Botão do joystick para ${label}"><option value="-1">Nenhum</option>${Array.from({length:32},(_,i)=>`<option value="${i}" ${b.button===i?'selected':''}>Botão ${i}</option>`).join('')}</select><button class="game-clear" data-capture-pad="${command}" aria-label="Capturar joystick para ${label}">◎</button></td></tr>`;
  }).join('')}</tbody></table>`;
 };
 const rebuild=()=>{config=validateGameControls(config);controller=createGameController(config);setupCollisions();state={motion:'idle',time:0,x:0,z:0,yaw:0};currentSector='start';renderSectors();keys.clear();pendingKeys.clear();};
 const driver=(dt:number):GameFrame=>{
  let pads:Gamepad[]=[];try{pads=Array.from(navigator.getGamepads?.()??[]).filter((p):p is Gamepad=>!!p&&p.connected);}catch{}
  const pad=config.gamepad<0?pads[0]:pads.find(p=>p.index===config.gamepad),pressed=pad?.buttons.map(b=>b.pressed)??[];
  const live=pad?`${pad.id} · botão(s): ${pressed.flatMap((on,i)=>on?[i]:[]).join(', ')||'nenhum'}`:'Nenhum joystick conectado. Conecte e pressione um botão para o navegador reconhecer.';
  if(live!==padText){padText=live;$('game-pad-status').textContent=live;}
  if(capture?.kind==='pad'){
   const index=pressed.findIndex((on,i)=>on&&!priorPad[i]);
   if(index>=0&&index<32){config.bindings[capture.command].button=index;capture=null;rebuild();renderSettings();message(`Botão ${index} vinculado. Salve para manter.`);}
  }
  priorPad=pressed;
  if(running&&(preview?.gameCombatPhase==='defeat'||preview?.gameCombatPhase==='victory'))stop();
  if(running){controller.setCollisions([...obstacles,...(preview?.gameCombatColliders??[])],bodyRadius,$<HTMLInputElement>('game-collision-enabled').checked);state=controller.update(dt,new Set([...keys,...pendingKeys]),pad?{axes:pad.axes,buttons:pressed}:undefined);pendingKeys.clear();}
  $('game-motion').textContent=(running?'':'Pausado · ')+MOTIONS[state.motion];$('game-position').textContent=`X ${state.x.toFixed(2).replace('.',',')} · Z ${state.z.toFixed(2).replace('.',',')}`;
  $('game-position').textContent+=` · altura ${(state.y??0).toFixed(2)} m`;
  $('game-sector-title').textContent=course.points.find(p=>p.id===currentSector)?.label??'Circuito';$('game-arena-state').textContent=`${running?'':'Pausado · '}${MOTIONS[state.motion]} · ${state.aimLocked?'Mira travada':'Mira livre'} · quedas ${state.falls??0}`;
  $('game-collision-status').textContent=!$<HTMLInputElement>('game-collision-enabled').checked?'Colisão OFF · passagem livre':state.contacts?.length?'Contato: '+state.contacts.join(', '):`${obstacles.length} personagens fixos · colisão ON`;
  $('game-aim-status').textContent=running&&state.aimLocked?'Mira TRAVADA · orientação mantida enquanto segura':`Mira livre · Travar mira: ${keyName(config.bindings.aimLock.key)} / botão ${config.bindings.aimLock.button??'sem vínculo'} (segurar)`;
  woodStatus.hidden=currentSector!=='wood';woodStatus.textContent=preview?.gameWoodStatus??'Use Machado de teste e aproxime a lâmina';
  combatStatus.textContent=preview?.gameCombatStatus??'Combate desligado';combatStatus.hidden=preview?.gameCombatPhase==='off'||!preview;
  return {...state,playing:running};
 };
 button.addEventListener('click',()=>{
  stop();preview?.clearGameCombat();rebuild();renderSettings();const spec=clone(getCharacter());$('game-character').textContent=spec.name+' · personagem atual e configurações de itens';
  bodyRadius=characterCollisionRadius(spec);bodyHeight=spec.body.height;course=createGameCourse(bodyHeight);currentSector='start';renderSectors();obstacles=proceduralTestCharacters(`${Date.now()}:${Math.random()}`);setupCollisions();
  dialog.showModal();editorPreview?.setActive(false);(window as any).__ABRIGO_MAPS__?.pauseRendering(true);
  try{if(!preview)preview=createPreview($('game-arena'),()=>{});preview.setActive(true);preview.setCharacter(spec);preview.view('iso');preview.setGameDriver(driver);preview.setGameObstacles(spec,obstacles,bodyRadius);preview.setGameCourse(course);mapEditor.open();applyMapCourse();preview.showGameCollisionAreas($<HTMLInputElement>('game-collision-areas').checked);}catch(e){message('Não foi possível abrir a prévia: '+(e as Error).message);}
 });
 $('game-close').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>{combatPreparation++;stop();mapEditor.close();preview?.clearGameCombat();preview?.setActive(false);preview?.clearGameObstacles();preview?.clearGameCourse();const normal=document.querySelector<HTMLElement>('.workspace:not(.creature-workspace):not(.object-workspace):not(.map-workspace)');editorPreview?.setActive(!!normal&&!normal.hidden);(window as any).__ABRIGO_MAPS__?.pauseRendering(false);button.focus();});
 $('game-collision-enabled').onchange=()=>{stop();setupCollisions();goToSector(currentSector);};
 $('game-collision-areas').onchange=()=>preview?.showGameCollisionAreas($<HTMLInputElement>('game-collision-areas').checked);
 $('game-play').onclick=()=>{if(running){stop();return;}if(!preview)return;mapEditor.setEditing(false);capture=null;keys.clear();running=true;$('game-play').textContent=$('game-quick-play').textContent='Pausar controles';$('game-play').setAttribute('aria-pressed','true');$('game-arena').focus();};
 $('game-quick-play').onclick=()=>$('game-play').click();
 $('game-arena').addEventListener('pointerdown',event=>{if(running&&!(event.target as HTMLElement).closest('button,select,input'))$('game-arena').focus();});
 const goToSector=(id:string)=>{const point=course.points.find(p=>p.id===id);if(!point)return;keys.clear();pendingKeys.clear();controller.teleport(point.x,point.z,point.yaw);state=controller.update(0,new Set());currentSector=id;renderSectors();preview?.setGameSector(id);if(running)$('game-arena').focus();};
 $('game-sector').onchange=event=>goToSector((event.target as HTMLSelectElement).value);$('game-quick-sector').onchange=event=>goToSector((event.target as HTMLSelectElement).value);
 $('game-random-npcs').onclick=()=>{stop();obstacles=proceduralTestCharacters(`${Date.now()}:${Math.random()}`);controller.setCollisions(obstacles,bodyRadius,$<HTMLInputElement>('game-collision-enabled').checked);preview?.setGameObstacles(getCharacter(),obstacles,bodyRadius);preview?.settleGameMap();goToSector('start');};
 $('game-center').onclick=()=>goToSector(currentSector);
 $('game-wood-reset').onclick=()=>{stop();preview?.resetGameWood();goToSector('wood');};
 $('game-quick-wood-reset').onclick=()=>$('game-wood-reset').click();
 $('game-wood-axe').onclick=()=>{
  stop();const spec=clone(getCharacter());
  if(spec.items.object!=='axe'||spec.items.placement==='none'){
   spec.items=clone(DEFAULT.items);spec.items.object='axe';spec.items.placement='right';spec.items.pose='ready';spec.items.hands.right='closed';spec.items.grip.right=[.18,.9,.9,.9,.9];
  }
  preview?.setCharacter(spec);goToSector('wood');message('Machado equipado somente nesta arena. O personagem e os ajustes salvos no editor permanecem intactos.');
 };
 $('game-quick-axe').onclick=()=>$('game-wood-axe').click();
 $('game-wave-add').onclick=()=>{readCombatFields();if(combatConfig.waves.length<10){combatConfig.waves.push({enemies:{skeleton:2}});renderCombat();}};
 combatPanel.addEventListener('click',event=>{const el=(event.target as HTMLElement).closest<HTMLElement>('[data-wave-remove]');if(el&&combatConfig.waves.length>1){readCombatFields();combatConfig.waves.splice(Number(el.dataset.waveRemove),1);renderCombat();}});
 combatPanel.addEventListener('change',event=>{const el=event.target as HTMLInputElement;if(el.dataset.enemy){combatConfig.waves[Number(el.dataset.wave)]!.enemies[el.dataset.enemy as CreatureSpecies]=Number(el.value);}else if(el.dataset.combatSetting){(combatConfig as any)[el.dataset.combatSetting]=Number(el.value);}else return;$('game-combat-message').textContent='Alterações aplicadas no próximo reinício. Salve para manter após recarregar.';});
 $('game-wave-save').onclick=()=>{try{combatConfig=validateCombatConfig(readCombatFields());localStorage.setItem(COMBAT_STORE,JSON.stringify(combatConfig));$('game-combat-message').textContent='Ondas salvas neste navegador.';}catch(e){$('game-combat-message').textContent=(e as Error).message;}};
 let combatPreparation=0;
 $('game-combat-start').onclick=async()=>{const id=++combatPreparation;try{const valid=validateCombatConfig(readCombatFields());if(!preview)throw Error('Abra a prévia primeiro.');stop();preview.clearGameCombat();for(const species of ['boar','wolfLowpolySdf','wolfSdf','ratSdf','tarantulaSdf','werewolfSdf'] as const)if(valid.waves.some(w=>w.enemies[species])){$('game-combat-message').textContent='Preparando criaturas SDF em segundo plano…';await prepareFauna(presetCreature(species));}if(id!==combatPreparation)return;goToSector('combat');preview.startGameCombat(valid,course,obstacles,bodyRadius);$('game-combat-message').textContent='Combate iniciado. Ondas avançam após derrotar todas as criaturas. Jogar/Pausar também pausa os inimigos.';$('game-play').click();}catch(e){if(id===combatPreparation)$('game-combat-message').textContent=(e as Error).message;}};
 $('game-combat-stop').onclick=()=>{combatPreparation++;stop();preview?.clearGameCombat();setupCollisions();$('game-combat-message').textContent='Combate encerrado. O circuito continua disponível.';};
 $('game-quick-combat-start').onclick=()=>$('game-combat-start').click();$('game-quick-combat-stop').onclick=()=>$('game-combat-stop').click();
 $('game-save').onclick=()=>{try{localStorage.setItem(GAME_CONTROL_STORE,JSON.stringify(validateGameControls(config)));message('Controles salvos em definitivo neste navegador.');}catch{message('Não foi possível salvar os controles neste navegador.');}};
 $('game-default').onclick=()=>{stop();config=defaultGameControls();rebuild();renderSettings();message('Controles padrão restaurados. Clique em Salvar para manter.');};
 dialog.addEventListener('click',event=>{
  const el=(event.target as HTMLElement).closest<HTMLElement>('[data-key],[data-clear],[data-capture-pad]');if(!el)return;stop();
  if(el.dataset.clear){config.bindings[el.dataset.clear as GameCommand].key='';rebuild();renderSettings();message('Vínculo removido. Salve para manter.');return;}
  const command=(el.dataset.key??el.dataset.capturePad) as GameCommand;capture={command,kind:el.dataset.key?'key':'pad'};message(`Vincular ${GAME_COMMANDS[command]}: ${capture.kind==='key'?'pressione uma tecla (Esc cancela)':'solte e pressione o botão no joystick'}.`);
 });
 dialog.addEventListener('change',event=>{
  const el=event.target as HTMLInputElement;if(!el.dataset.pad&&!el.dataset.setting)return;stop();
  const old=clone(config);
  if(el.dataset.pad){const n=Number(el.value);config.bindings[el.dataset.pad as GameCommand].button=n<0?null:n;}
  else (config as any)[el.dataset.setting!]=el.type==='checkbox'?el.checked:Number(el.value);
  try{rebuild();message('Configuração alterada. Salve para manter.');}catch{config=old;message('Valor inválido. Configuração anterior mantida.');}renderSettings();
 });
 dialog.addEventListener('keydown',event=>{
  if(capture?.kind==='key'){event.preventDefault();event.stopPropagation();if(event.code!=='Escape'){config.bindings[capture.command].key=event.code;rebuild();renderSettings();message('Tecla vinculada. Salve para manter.');}else message('Captura cancelada.');capture=null;return;}
  if(!running)return;
  if(event.code==='Escape'){event.preventDefault();stop();if(isFullscreen())void exitTestFullscreen();return;}
  if((event.target as HTMLElement).closest('input,select,textarea,button'))return;
  if(Object.values(config.bindings).some(b=>b.key===event.code)){event.preventDefault();keys.add(event.code);if(!event.repeat)pendingKeys.add(event.code);}
 });
 dialog.addEventListener('keyup',event=>{keys.delete(event.code);});
 window.addEventListener('blur',()=>{if(dialog.open)stop();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&dialog.open)stop();});
 const applyMapCourse=()=>{
  stop();combatPreparation++;preview?.clearGameCombat();
  courseHelp.textContent=mapEditor.enabled?'Mapa editável 100 × 100 m: personagens e criaturas acompanham o relevo. Edite Terreno e Efeitos, salve e clique em Jogar. Água é visual; não há natação. O combate por ondas também funciona neste mapa.':'Circuito 48 × 48 m: rampas, vão, caixas, passagem baixa (C), corte de madeira e combate por ondas. Configure e inicie o combate no painel. Fora do combate, não há dano aos personagens.';
  woodControls.hidden=mapEditor.enabled;woodQuick.hidden=mapEditor.enabled;
  if(mapEditor.enabled&&preview?.gameMap){preview.clearGameCourse();course={size:100,boxes:[],ramps:[],pits:[],points:[{id:'start',label:'Mapa editável / início',x:0,z:0},{id:'combat',label:'Combate no mapa editável',x:0,z:16,yaw:Math.PI}],terrainHeight:(x,z)=>preview?.gameMap?.terrain.heightAt(x,z)??0};preview.settleGameMap();}
  else{course=createGameCourse(bodyHeight);preview?.setGameCourse(course);preview?.settleGameMap();}
  const x=state.x,z=state.z,yaw=state.yaw;setupCollisions();controller.teleport(x,z,yaw);state=controller.update(0,new Set());if(!course.points.some(p=>p.id===currentSector))currentSector='start';renderSectors();
 };
 mapEditor=mountGameMapPicker(dialog,{preview:()=>preview,stop,changed:applyMapCourse});
}
