import {icon} from './icons';
import {mountGameTest} from './game-test';
import {loadItemSetup,restoreItemSetup,saveItemSetup} from './item-setups';
import {mountCreatureEditor} from './creature-editor';
import {mountObjectEditor} from './object-editor';
import {categoryOf,categoryOptions,characterStorageKey,randomVillain,readCategoryDraft,type CharacterCategory} from './character-categories';
import {createPreview} from './scene';
import {EXPRESSIONS} from './character';
import type {Expression} from './character';
import {HAND_PLACEMENTS,OBJECT_ACTIONS,handItemOptions,objectInteraction,validateObjectSpec,type ObjectSpec} from './object-schema';
import {MOTIONS,FACE_TYPES,FACE_KEYS,FINE_FACE,FINE_KEYS,applyFace,type FaceType,DEFAULT,OPTIONS,SKINS,HAIR_COLORS,CLOTH_COLORS,TRAITS,clone,validateSpec,randomCharacter,presetCharacter,characterStats,CharacterSpec,Motion} from './schema';
const $=<T extends HTMLElement=HTMLElement>(s:string)=>document.querySelector<T>(s)!;
const esc=(s:any)=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
// Preview-only state (not part of the character file).
let expression:Expression='neutral',intensity=1;
// Advanced face mode is an editor preference (shows the fine sliders); the offsets themselves live in the character.
let advanced=false;try{advanced=localStorage.getItem('abrigo-face-advanced')==='1';}catch{}
const requestedPreset=new URLSearchParams(location.search).get('preset');
let category:CharacterCategory=requestedPreset==='zumbi'||new URLSearchParams(location.search).get('mode')==='villains'?'villains':'characters';
let spec=presetCharacter(category==='villains'?'zumbi':'ranger'),tab='body',preset='',storageAvailable=true;
try{spec=readCategoryDraft(localStorage,category);}catch{storageAvailable=false;}
const categoryStorage={getItem:(key:string)=>localStorage.getItem(category==='villains'?'villains:'+key:key),setItem:(key:string,value:string)=>localStorage.setItem(category==='villains'?'villains:'+key:key,value)};
const itemDraft=():ObjectSpec|undefined=>{try{const saved=localStorage.getItem('abrigo-object-v1');return saved?validateObjectSpec(JSON.parse(saved)):undefined;}catch{return undefined;}};
const itemInteraction=()=>spec.items.object==='custom'?spec.items.recipe?.interaction:objectInteraction(spec.items.object);

if(requestedPreset&&Object.hasOwn(OPTIONS.profession,requestedPreset)){if(requestedPreset!=='zumbi'||spec.profession!=='zumbi')spec=presetCharacter(requestedPreset);preset=requestedPreset;category=categoryOf(spec);}
try{spec=restoreItemSetup(categoryStorage,spec);}catch{}
let history:CharacterSpec[]=[],future:CharacterSpec[]=[],committed=clone(spec),saveTimer:number,preview:ReturnType<typeof createPreview>|null=null;
const categoryDrafts:Partial<Record<CharacterCategory,CharacterSpec>>={};
const app=$('#app');
app.innerHTML=`
<header class="topbar"><a class="brand" href="#" aria-label="Abrigo, criador de sobreviventes"><span class="brand-symbol">${icon('mountain',23)}</span><span>ABRIGO<span class="brand-divider">/</span><small>PERSONAGENS</small></span></a><span class="project-status"><i></i> OFICINA DE SOBREVIVENTES <span class="version">V1.0</span></span><div class="header-actions"><button id="import" class="button quiet">${icon('upload')}<span>Importar</span></button><button id="export" class="button primary">${icon('download')}<span>Exportar personagem</span></button></div></header>
<main class="workspace">
<aside class="archive"><div class="section-eyebrow">PONTO DE PARTIDA</div><h1>Todo mundo<br>tem uma história.</h1><p class="intro">Escolha uma base.<br>Faça dela alguém único.</p><div class="presets" aria-label="Modelos iniciais">${[
 ['zumbi','user','Zumbi','Ainda caminha pela floresta.'],['lenhador','mountain','Lenhador','Talhado pela floresta.'],['nightshift','user','Atendente noturna','Sabe ler qualquer ambiente.'],['pintor','user','Pintor','Um novo olhar para o mundo.'],['ranger','mountain','Guarda florestal','Conhece o caminho.'],['mechanic','wrench','Mecânico','Sempre dá um jeito.'],['medic','medical','Socorrista','Ainda cuida dos outros.'],['civilian','user','Civil','Uma vida interrompida.'],['legendario','flag','Legendário','Forjado na trilha.'],['explorer','compass','Exploradora','Vê primeiro, age depois.'],['pedepano','sock','Pé de Pano','Ninguém ouve chegar.'],['engineer','gear','Engenheira','Conserta o que o mundo quebrou.']
].map(([id,ic,name,desc],i)=>`<button class="preset ${preset===id?'selected':''}" data-preset="${id}"><span class="preset-icon">${icon(ic,23)}</span><span><strong>${name}</strong><small>${desc}</small></span><span class="preset-check">${icon('check',13)}</span></button>`).join('')}</div>
<div class="seed-card"><div class="section-eyebrow">GERAÇÃO PROCEDURAL ${icon('dice',15)}</div><label for="seed">Semente do personagem</label><div class="seed-row"><input id="seed" maxlength="64" value="${esc(spec.seed)}" spellcheck="false"><button id="apply-seed" title="Gerar personagem com esta semente" aria-label="Gerar personagem com esta semente">${icon('arrow')}</button></div><button class="button randomize" id="random">${icon('dice')} Novo sobrevivente</button><p>A mesma semente recria a mesma base.</p></div>
<div class="archive-footer"><span class="signal"></span> FEITO DE POSSIBILIDADES<small>Geometria e movimento procedurais</small><button id="about" class="text-button">Sobre este projeto ${icon('info',13)}</button></div></aside>
<section class="stage-column" aria-label="Visualização do personagem">
<div class="stage-heading"><div><span class="section-eyebrow">REGISTRO DE SOBREVIVENTE</span><h2 id="character-title"></h2><p id="character-subtitle"></p></div><div class="history-buttons"><button id="undo" class="icon-button" title="Desfazer" aria-label="Desfazer">${icon('undo')}</button><button id="redo" class="icon-button" title="Refazer" aria-label="Refazer">${icon('redo')}</button></div></div>
<div class="viewport-wrap"><div class="view-controls" aria-label="Ângulo de visão">${[['iso','Isométrica'],['front','Frente'],['side','Lado'],['back','Costas'],['portrait','Rosto']].map(([id,label])=>`<button data-view="${id}" class="${id==='iso'?'active':''}">${label}</button>`).join('')}</div><div id="viewport"></div><div class="viewport-tools"><button class="icon-button" id="rotate" title="Girar automaticamente" aria-label="Girar automaticamente" aria-pressed="false">${icon('rotate')}</button><button class="icon-button" id="grid" title="Grade" aria-label="Grade" aria-pressed="true">${icon('grid')}</button><button class="icon-button pixel-button" id="detail" title="Alta definição (desligue para a malha leve)" aria-label="Alta definição" aria-pressed="true">HD</button><button class="icon-button pixel-button" id="uhd" title="Ultra definição: malha densa, fios de cabelo e a renderização da floresta" aria-label="Ultra definição" aria-pressed="false">UHD</button><button class="icon-button pixel-button" id="pixel" title="Prévia em baixa resolução" aria-label="Prévia em baixa resolução" aria-pressed="false">PX</button><button class="icon-button" id="snapshot" title="Salvar imagem PNG" aria-label="Salvar imagem PNG">${icon('camera')}</button></div><div class="stage-coordinate"><span>8 DIREÇÕES</span><span>PRÉVIA 3D</span></div><div class="orbit-hint">ARRASTE PARA GIRAR <span>·</span> ROLE PARA APROXIMAR</div><div class="height-marker"><span id="height-label"></span><i></i></div></div>
<div class="playback"><div class="playback-label"><span class="live-dot"></span> MOVIMENTO</div><select id="motion-select" aria-label="Movimento do personagem">${[['Deslocamento',['idle','walk','crouchWalk','backward','run','sprint']],['Pulos',['jump','jumpWalk','jumpRun','jumpSprint']],['Combinações',['walkAttackLateral','runAttackLateral','backwardAttackLateral']],['Ações',['pose','wave','crouch','pickup','attack','attackLateral','pray']]].map(([label,ids])=>`<optgroup label="${label}">${(ids as Motion[]).map(id=>`<option value="${id}">${MOTIONS[id]}</option>`).join('')}</optgroup>`).join('')}</select><button class="icon-button" id="pause" title="Pausar animação" aria-label="Pausar animação" aria-pressed="false">${icon('pause',16)}</button></div>
<div class="stage-footer"><span id="mesh-stats">Construindo personagem…</span><button id="sprites" class="text-button">Exportar 8 direções ${icon('download',13)}</button></div>
</section>
<aside class="inspector"><div class="inspector-title"><span class="section-eyebrow">PERSONALIZAÇÃO</span><span id="save-state"><i></i> Rascunho local</span></div><div class="tabs" role="tablist" aria-label="Personalização">${[['body','user','Corpo'],['hair','face','Pelos'],['features','features','Feições'],['face','smile','Expressão'],['clothes','shirt','Roupas'],['gear','bag','Kit'],['items','bag','Itens'],['profile','medical','Origem']].map(([id,ic,label])=>`<button role="tab" aria-controls="panel" aria-selected="${id==='body'}" id="tab-${id}" data-tab="${id}" class="${id==='body'?'active':''}">${icon(ic,20)}<span>${label}</span></button>`).join('')}</div><div id="panel" role="tabpanel" aria-labelledby="tab-body"></div><div class="inspector-bottom"><button id="save" class="button save-button">${icon('save')} Salvar rascunho</button><span>Salvo neste navegador</span></div></aside>
</main><div id="toast" role="status" aria-live="polite"></div><input type="file" id="file-input" accept="application/json,.json" hidden>
<dialog id="about-dialog"><button class="icon-button close-dialog" aria-label="Fechar">${icon('close')}</button><span class="section-eyebrow">ABRIGO / V1.0</span><h2>Um sobrevivente.<br>Infinitas combinações.</h2><p>Criador procedural inspirado na leitura isométrica de jogos de sobrevivência. Projeto independente, sem vínculo com Project Zomboid.</p><h3>Base aberta</h3><p>Usa o construtor de superfícies e as proporções canônicas do <a href="https://github.com/img2threejs/img2threejs" target="_blank" rel="noopener">img2threejs</a>, com editor, roupas e animações criados para este projeto.</p><h3>Leve para o seu jogo</h3><p>O JSON guarda a receita completa do personagem. O pacote inclui o módulo Three.js e instruções de integração. A ficha de atributos contém metadados; os efeitos no jogo precisam ser ligados à lógica do seu projeto.</p><p class="subtle">Modelos e movimento gerados por código. Sem arquivos GLB, texturas externas ou animações importadas.</p></dialog>`;
function read(path:string){if(path==='ui.intensity')return intensity;if(path==='items.twoHandSpread')return spec.items.twoHandSpread??.65;const v=path.split('.').reduce((v:any,k)=>v?.[k],spec);return v===undefined&&path.startsWith('appearance.fine.')?0:v;}
function write(path:string,value:any){if(path==='style'&&!value){delete spec.style;return;}const keys=path.split('.'),last=keys.pop()!;const obj=keys.reduce((v:any,k)=>v[k]??=({}),spec);obj[last]=value;}
function heading(n:string,title:string,desc:string){return `<div class="panel-heading"><span class="number">${n}</span><div><h3>${title}</h3><p>${desc}</p></div></div>`;}
function range(path:string,label:string,min:number,max:number,step:number,ends?:string[]){const v=read(path);return `<div class="field"><label for="${path}">${label}<output data-output="${path}">${formatValue(path,v)}</output></label><input id="${path}" type="range" min="${min}" max="${max}" step="${step}" value="${v}" data-path="${path}" style="--fill:${(v-min)/(max-min)*100}%">${ends?`<div class="range-ends"><span>${ends[0]}</span><span>${ends[1]}</span></div>`:''}</div>`;}
function itemRange(path:string,label:string,min:number,max:number,step:number,unit:string){const v=Number(read(path));return `<div class="field"><label for="${path}">${label}<output data-output="${path}">${v.toFixed(unit==='°'?0:3).replace('.',',')}${unit}</output></label><input id="${path}" type="range" min="${min}" max="${max}" step="${step}" value="${v}" data-path="${path}" style="--fill:${(v-min)/(max-min)*100}%"></div>`;}
function select(path:string,label:string,options:Record<string,string>){
 if(path==='outfit.shoes'&&category==='villains')options={...options,barefoot:'Meias gastas — sem calçados',socks:'Meias gastas',singleSneakerLeft:'Tênis esquerdo + meia gasta direita',singleSneakerRight:'Tênis direito + meia gasta esquerda'};
 return `<div class="field"><label for="${path}">${label}</label><select id="${path}" data-path="${path}">${Object.entries(options).map(([id,label])=>`<option value="${id}" ${read(path)===id?'selected':''}>${label}</option>`).join('')}</select></div>`;
}
function palette(path:string,label:string,colors:string[]){return `<div class="field palette-field"><label>${label}<span>${esc(read(path))}</span></label><div class="palette">${colors.map((color,i)=>`<button class="swatch ${read(path).toLowerCase()===color.toLowerCase()?'selected':''}" style="--swatch:${color}" data-color-path="${path}" data-color="${color}" title="${label} ${i+1} (${color})" aria-label="${label} ${i+1} (${color})" aria-pressed="${read(path).toLowerCase()===color.toLowerCase()}">${read(path).toLowerCase()===color.toLowerCase()?icon('check',13):''}</button>`).join('')}<label class="custom-color" title="Cor personalizada">+<input type="color" data-path="${path}" value="${esc(read(path))}" aria-label="${label} personalizada"></label></div></div>`;}
function toggle(path:string,label:string,desc:string){return `<label class="toggle-row"><span><strong>${label}</strong><small>${desc}</small></span><input type="checkbox" data-path="${path}" ${read(path)?'checked':''}><span class="toggle"></span></label>`;}
function formatValue(path:string,v:number){if(path.startsWith('appearance.fine.')){const n=Math.round(v*100);return n>0?'+'+n:String(n);}if(path==='body.height')return Math.round(v*100)+' cm';if(path==='body.head'||path==='appearance.faceWidth')return Math.round(v*100)+'%';return Math.round(v*100)+'%';}
function renderPanel(){
 const panel=$('#panel');panel.setAttribute('aria-labelledby','tab-'+tab);
 if(tab==='body')panel.innerHTML=heading('01','Corpo e proporções','A silhueta começa aqui.')+`<div class="field"><label for="name">Nome do personagem</label><input id="name" data-path="name" maxlength="64" value="${esc(spec.name)}"></div>`+select('style','Estilo da malha',{'':'Original',faceted:'Facetado — planos esculpidos'})+palette('appearance.skin','Tom de pele',SKINS)+'<div class="section-line">ESTRUTURA</div>'+range('body.height','Altura',1.5,2,.01,['1,50 m','2,00 m'])+range('body.build','Constituição',0,1,.01,['Esbelta','Robusta'])+range('body.shoulders','Ombros',0,1,.01,['Estreitos','Largos'])+range('body.hips','Quadril',0,1,.01,['Estreito','Largo'])+range('body.bust','Busto',0,1,.01,['Nenhum','Volumoso'])+range('body.head','Proporção da cabeça',.85,1.15,.01);
 if(tab==='hair')panel.innerHTML=heading('02','Pelos','Cabelo, barba e olhos.')+select('appearance.hair','Corte de cabelo',OPTIONS.hair)+palette('appearance.hairColor','Cor do cabelo',HAIR_COLORS)+select('appearance.beard','Barba',OPTIONS.beard)+range('appearance.faceWidth','Largura do rosto',.85,1.15,.01,['Fino','Largo'])+palette('appearance.eyeColor','Cor dos olhos',['#3e5148','#665141','#4a5962','#292622','#8a5716'])+toggle('appearance.makeup','Delineado e batom','Traço alado nos olhos, lábios mais vermelhos.')+`<div class="panel-note">${icon('info',17)}<span>Use a vista <b>Rosto</b> para ver os detalhes.${spec.outfit.hat!=='none'?' O cabelo fica oculto sob o acessório.':''}</span></div>`;
 if(tab==='clothes')panel.innerHTML=heading('05','Camadas do dia a dia',category==='villains'?'Guarda-roupa dos vilões.':'Pronto para o que vier.')+select('outfit.top','Parte superior',categoryOptions(OPTIONS.top,category,'top'))+palette('outfit.topColor','Cor da roupa',CLOTH_COLORS)+'<div class="section-line">PARTE INFERIOR</div>'+select('outfit.pants','Calça ou bermuda',OPTIONS.pants)+palette('outfit.pantsColor','Cor da parte inferior',CLOTH_COLORS)+select('outfit.shoes','Calçados',OPTIONS.shoes)+palette('outfit.shoeColor','Cor dos calçados',['#302922','#4c4438','#535452','#aa9c82']);
 if(tab==='gear')panel.innerHTML=heading('06','O que você carrega','Pequenas escolhas. Novos caminhos.')+select('outfit.hat','Acessório de cabeça',OPTIONS.hat)+toggle('outfit.backpack','Mochila de campo','Com alças, bolsos e fivelas.')+toggle('outfit.glasses','Óculos','Armação discreta.')+toggle('outfit.gloves','Luvas de couro','Punhos enrolados em tiras.')+toggle('outfit.toolBelt','Cinto de ferramentas','Fivela de engrenagem, bolsas e tiras na coxa.')+'<div class="section-line">MARCAS DO CAMINHO</div>'+range('wear','Desgaste das roupas',0,1,.01,['Novas','Muito usadas'])+`<div class="panel-note">${icon('info',17)}<span>O equipamento acompanha o corpo durante as animações.</span></div>`;
 if(tab==='items'){
   const interaction=spec.items.object==='none'?undefined:itemInteraction();
   const draft=itemDraft(),itemOptions={none:'Nenhum',...handItemOptions(),...(draft?.interaction?.hands.length?{custom:`${draft.name} (rascunho)`}:{})};
   const placements=interaction?Object.fromEntries(interaction.hands.map(id=>[id,HAND_PLACEMENTS[id]])):{};
   panel.innerHTML=heading('07','Itens em mãos','Objetos configurados na oficina para interação com o personagem.')+select('items.object','Objeto',itemOptions)+(interaction?select('items.placement','Onde equipar',placements)+select('items.pose','Pose de empunhadura',{relaxed:'Natural',ready:'Pronta para usar',twoHanded:'Empunhadura com duas mãos'})+
     (spec.items.placement==='both'?range('items.twoHandSpread','Duas mãos · abertura dos braços',0,1,.01,['Mais juntas','Mais abertas']):'')+
     `<div class="section-line">AJUSTE NO SOQUETE</div>`+range('items.scale','Tamanho proporcional',.25,2.5,.01,['25%','250%'])+itemRange('items.offset.0','Lateral',-.15,.15,.001,' m')+itemRange('items.offset.1','Altura',-.15,.15,.001,' m')+itemRange('items.offset.2','Profundidade',-.15,.15,.001,' m')+itemRange('items.rotation.0','Inclinação',-180,180,1,'°')+itemRange('items.rotation.1','Giro',-180,180,1,'°')+itemRange('items.rotation.2','Ângulo lateral',-180,180,1,'°')+
     `<div class="section-line">MOVIMENTOS DO BRAÇO</div>`+(Object.keys(MOTIONS) as Motion[]).map(m=>toggle(`items.armMotion.${m}`,MOTIONS[m],spec.items.armMotion[m]?'ON — braço e objeto acompanham':'OFF — braço que segura permanece na pose')).join('')+`<div class="section-line">BRAÇOS</div>`+range('items.arms.left.spread','Esquerdo · abrir / fechar',-1,1,.01,['Para dentro','Para fora'])+range('items.arms.left.swing','Esquerdo · giro frente / trás',-1,1,.01,['Menos para trás','Mais para frente'])+range('items.arms.left.twist','Esquerdo · torção leve',-1,1,.01,['−','+'])+range('items.arms.right.spread','Direito · abrir / fechar',-1,1,.01,['Para dentro','Para fora'])+range('items.arms.right.swing','Direito · giro frente / trás',-1,1,.01,['Menos para trás','Mais para frente'])+range('items.arms.right.twist','Direito · torção leve',-1,1,.01,['−','+'])+`<div class="panel-note">${icon('info',15)}<span>Os controles giram somente nos ombros: os braços continuam presos ao corpo.</span></div><div class="section-line">MÃOS</div>`+select('items.hands.left','Mão esquerda',{open:'Aberta',closed:'Fechada'})+['Polegar','Indicador','Médio','Anelar','Mindinho'].map((name,i)=>range(`items.grip.left.${i}`,`Esquerda · ${name}`,0,1,.01,['Aberto','Fechado'])).join('')+select('items.hands.right','Mão direita',{open:'Aberta',closed:'Fechada'})+['Polegar','Indicador','Médio','Anelar','Mindinho'].map((name,i)=>range(`items.grip.right.${i}`,`Direita · ${name}`,0,1,.01,['Aberto','Fechado'])).join('')+`<button class="button save-button" data-save-item-setup>Salvar configuração do objeto</button><div class="panel-note">${icon('info',17)}<span>Ação: <b>${OBJECT_ACTIONS[interaction.action]}</b>. Ao salvar, os ajustes deste objeto ficam guardados neste navegador e são usados sempre que você o equipar. Salve novamente para substituir a configuração.</span></div>`:`<div class="panel-note">${icon('info',17)}<span>Na oficina de <b>Objetos</b>, defina a ação e as mãos permitidas para incluir novos itens aqui.</span></div>`);
 }
 if(tab==='features'){
   const types=faceTypes(),matches=(f:FaceType)=>FACE_KEYS.every(k=>(spec.appearance as any)[k]===(k==='chinSize'?f.chinSize??.5:f[k]))&&FINE_KEYS.every(k=>(f.fine?.[k]??0)===(spec.appearance.fine?.[k]??0));
   const current=selectedFace&&types[selectedFace]&&matches(types[selectedFace])?selectedFace:Object.entries(types).find(([,f])=>matches(f))?.[0];
   const target=types[selectedFace]?selectedFace:'',edited=!!target&&!matches(types[target]);
   panel.innerHTML=heading('03','Feições','Tipos de rosto e cada detalhe.')+`<div class="section-line" style="margin-top:0">TIPOS DE ROSTO</div><div class="face-types">${Object.entries(types).map(([id,f])=>`<button class="expression ${current===id?'selected':''} ${target===id&&edited?'edited':''}" data-face-type="${id}">${esc(f.label)}${faceStore.overrides[id]||faceStore.custom[id]?' •':''}${faceStore.custom[id]?`<span class="face-remove" data-face-remove="${id}" title="Excluir tipo">${icon('close',11)}</span>`:''}</button>`).join('')}</div>`
     +`<div class="face-save">${target?`<button class="button quiet" data-face-save="${target}" ${edited?'':'disabled'}>${icon('save',14)} Salvar em “${esc(types[target].label)}”</button>`:''}<div class="seed-row"><input id="face-name" maxlength="24" placeholder="Nome do novo tipo"><button data-face-new title="Salvar como novo tipo">${icon('check',15)}</button></div>${Object.keys(faceStore.overrides).length?'<button class="text-button" data-face-reset>Restaurar tipos originais</button>':''}</div>`
     +'<div class="section-line">AJUSTE FINO</div>'+select('appearance.faceShape','Formato do rosto',OPTIONS.faceShape)+select('appearance.chin','Queixo',OPTIONS.chin)+range('appearance.chinSize','Tamanho do queixo',0,1,.01,['Recuado','Marcado'])+range('appearance.cheeks','Bochechas',0,1,.01,['Magras','Cheias'])
     +select('appearance.brows','Sobrancelhas',OPTIONS.brows)+select('appearance.nose','Nariz',OPTIONS.nose)+select('appearance.mouth','Boca',OPTIONS.mouth)
     // Advanced mode: every part of the face gets fine sliders on top of the presets above.
     +`<label class="toggle-row advanced-row"><span><strong>MODO AVANÇADO</strong><small>Regulagem fina de cada parte do rosto, somada aos presets acima.</small></span><input type="checkbox" data-advanced ${advanced?'checked':''}><span class="toggle"></span></label>`
     +(advanced?FINE_FACE.map(g=>`<div class="section-line">${g.group.toUpperCase()}</div>`+g.items.map(([k,label,lo,hi])=>range('appearance.fine.'+k,label,-1,1,.01,[lo,hi])).join('')).join('')
       +`<button class="text-button" data-fine-reset ${spec.appearance.fine?'':'disabled'}>Zerar ajustes finos</button>`:'');
   return;
 }
 if(tab==='face'){
   panel.innerHTML=heading('04','Expressões','Teste o humor do sobrevivente.')+`<div class="expressions">${Object.entries(EXPRESSIONS).map(([id,label])=>`<button class="expression ${expression===id?'selected':''}" data-expression="${id}">${label}</button>`).join('')}</div>`+range('ui.intensity','Intensidade',0,1,.01,['Sutil','Forte'])+`<div class="panel-note">${icon('info',15)}<span>Piscar, olhar e sobrancelhas continuam animados em todas as expressões. <b>A expressão é só da prévia</b>: não entra no arquivo do personagem.</span></div>`;
   return;
 }
 if(tab==='profile'){
   const stats=characterStats(spec),labels:Record<string,string>={vigor:'Vigor',strength:'Força',stealth:'Furtividade',craft:'Técnica'};
   panel.innerHTML=heading('08','Antes de tudo mudar','Defina a origem do personagem.')+select('profession','Profissão',categoryOptions(OPTIONS.profession,category,'profession'))+`<div class="section-line">ATRIBUTOS INICIAIS</div><div class="stats">${Object.entries(stats.values).map(([k,v])=>`<div><span>${labels[k]}</span><div class="stat-dots">${Array.from({length:6},(_,i)=>`<i class="${i<v?'lit':''}"></i>`).join('')}</div><b>${v}</b></div>`).join('')}</div><div class="traits-heading"><span class="section-line">TRAÇOS</span><span class="points ${stats.remaining<0?'negative':''}">${stats.remaining} pontos livres</span></div><div class="traits">${TRAITS.map(t=>`<button class="trait ${spec.traits.includes(t.id)?'selected':''}" data-trait="${t.id}" aria-pressed="${spec.traits.includes(t.id)}"><span class="trait-check">${spec.traits.includes(t.id)?icon('check',12):''}</span><span><strong>${t.name}</strong><small>${t.description}</small></span><b>${t.cost>0?'−':'+'}${Math.abs(t.cost)}</b></button>`).join('')}</div><div class="panel-note">${icon('info',17)}<span>Ficha para integração. Os efeitos no jogo são definidos pelo seu projeto.</span></div>`;
 }
}
function status(message:string){$('#save-state').innerHTML='<i></i> '+esc(message);}
function persist(show=false){try{if(show&&spec.items.object!=='none')saveItemSetup(categoryStorage,spec);localStorage.setItem(characterStorageKey(category),JSON.stringify(spec));status('Rascunho salvo');storageAvailable=true;if(show)toast(spec.items.object==='none'?'Rascunho salvo neste navegador.':'Rascunho e configuração definitiva do objeto salvos.');}catch{storageAvailable=false;status('Exporte para salvar');if(show)toast('Não foi possível salvar no navegador. Use Exportar personagem para guardar uma cópia.');}}
function scheduleSave(){status('Alterações…');clearTimeout(saveTimer);saveTimer=window.setTimeout(()=>persist(),400);}
function summary(){
 categoryChrome();
 $('#character-title').textContent=spec.name;$('#character-subtitle').textContent=(OPTIONS.profession as any)[spec.profession]+'  /  '+Math.round(spec.body.height*100)+' cm';$('#height-label').textContent=spec.body.height.toFixed(2).replace('.',',')+' m';
 $('#seed').setAttribute('value',spec.seed);$('#undo').toggleAttribute('disabled',!history.length);$('#redo').toggleAttribute('disabled',!future.length);
 document.querySelectorAll('[data-preset]').forEach(el=>el.classList.toggle('selected',el.getAttribute('data-preset')===preset));
}
function update(rebuild=true){summary();if(rebuild)preview?.setCharacter(spec);scheduleSave();}
function commit(){if(JSON.stringify(committed)!==JSON.stringify(spec)){history.push(clone(committed));history=history.slice(-30);future=[];committed=clone(spec);summary();}}
function replace(next:CharacterSpec,presetId=''){if(categoryOf(next)!==category)switchCategory(categoryOf(next));spec=next;preset=presetId;commit();renderPanel();($('#seed') as HTMLInputElement).value=spec.seed;update();}
function categoryChrome(){
 const villains=category==='villains',workspace=$('.workspace');workspace.dataset.characterCategory=category;
 document.querySelectorAll<HTMLElement>('[data-preset]').forEach(el=>el.hidden=(el.dataset.preset==='zumbi')!==villains);
 $('.seed-card label').textContent=villains?'Semente do vilão':'Semente do personagem';
 $('#random').innerHTML=icon('dice')+(villains?' Novo vilão':' Novo sobrevivente');
 $('.archive h1').innerHTML=villains?'Cada ameaça<br>tem uma origem.':'Todo mundo<br>tem uma história.';
 $('.stage-heading .section-eyebrow').textContent=villains?'REGISTRO DE VILÃO':'REGISTRO DE SOBREVIVENTE';
 if(!workspace.hidden){
   $('.topbar .brand small').textContent=villains?'PERSONAGENS VILÕES':'PERSONAGENS';
   $('.topbar .project-status').innerHTML='<i></i> '+(villains?'OFICINA DE VILÕES':'OFICINA DE SOBREVIVENTES')+' <span class="version">V1.1</span>';
   $('#export span').textContent='Exportar personagem';
   $('#mode-characters')?.setAttribute('aria-pressed',String(!villains));$('#mode-villains')?.setAttribute('aria-pressed',String(villains));
 }
}
function switchCategory(next:CharacterCategory){
 if(category!==next){
   clearTimeout(saveTimer);categoryDrafts[category]=clone(spec);persist();category=next;
   try{spec=categoryDrafts[category]?clone(categoryDrafts[category]!):restoreItemSetup(categoryStorage,readCategoryDraft(localStorage,category));}catch{spec=categoryDrafts[category]?clone(categoryDrafts[category]!):presetCharacter(category==='villains'?'zumbi':'ranger');}
   history=[];future=[];committed=clone(spec);preset='';selectedFace='';loadFaces();
 }
 (window as any).__ABRIGO_CREATURES__?.setMode(false);
 const url=new URL(location.href);url.searchParams.delete('preset');if(category==='villains')url.searchParams.set('mode','villains');else url.searchParams.delete('mode');window.history.replaceState(null,'',url);
 categoryChrome();renderPanel();summary();$<HTMLInputElement>('#seed').value=spec.seed;preview?.setCharacter(spec);
}
let toastTimer:number;
 // Face types: the built-in ones, overridden or extended by the user's own (saved in this browser).
const FACE_STORE='abrigo-face-types-v1';
type FaceStore={overrides:Record<string,FaceType>;custom:Record<string,FaceType>};
let faceStore:FaceStore={overrides:{},custom:{}},selectedFace='';
function loadFaces(){faceStore={overrides:{},custom:{}};try{const raw=categoryStorage.getItem(FACE_STORE);if(raw)faceStore={...faceStore,...JSON.parse(raw)};}catch{}}
loadFaces();
const faceTypes=():Record<string,FaceType>=>({...Object.fromEntries(Object.entries(FACE_TYPES).map(([id,f])=>[id,faceStore.overrides[id]??f])),...faceStore.custom});
const saveFaces=()=>{try{categoryStorage.setItem(FACE_STORE,JSON.stringify(faceStore));return true;}catch{toast('O navegador bloqueou o armazenamento local.');return false;}};
const currentFace=():FaceType=>({label:'',...Object.fromEntries(FACE_KEYS.map(k=>[k,(spec.appearance as any)[k]])),...(spec.appearance.fine&&Object.values(spec.appearance.fine).some(v=>v)?{fine:{...spec.appearance.fine}}:{})} as FaceType);
function toast(message:string){const t=$('#toast');t.textContent=message;t.classList.add('visible');clearTimeout(toastTimer);toastTimer=window.setTimeout(()=>t.classList.remove('visible'),3200);}
function download(url:string,filename:string){const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();}
const safeName=()=>spec.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9_-]+/gi,'-').replace(/^-|-$/g,'').toLowerCase()||'sobrevivente';
function exportJson(){const payload=validateSpec(spec);const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));download(url,safeName()+'.personagem.json');setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Receita do personagem exportada.');}
renderPanel();summary();
try{preview=createPreview($('#viewport'),s=>{$('#mesh-stats').textContent=Math.round(s.triangles).toLocaleString('pt-BR')+' triângulos · '+s.meshes+' peças';});preview.setCharacter(spec);if(preview.compatible){$('.stage-coordinate').innerHTML='<span>8 DIREÇÕES</span><span>MODO COMPATÍVEL</span>';}}catch(e){$('#viewport').innerHTML=`<div class="webgl-error">${icon('info',32)}<h3>A prévia precisa de WebGL 2.</h3><p>Ative a aceleração gráfica do navegador ou tente abrir no Chrome ou Edge atualizado.</p><p>A ficha ainda pode ser editada e exportada.</p></div>`;console.error(e);for(const id of ['snapshot','sprites','rotate','pixel','grid','pause','detail','uhd'])$('#'+id).setAttribute('disabled','');}
$('#panel').addEventListener('input',event=>{
 const el=event.target as HTMLInputElement;if(!el.dataset.path)return;
 if(el.dataset.path==='ui.intensity'){intensity=Number(el.value);preview?.setExpression(expression,intensity);$('[data-output="ui.intensity"]').textContent=Math.round(intensity*100)+'%';el.style.setProperty('--fill',intensity*100+'%');return;}
 let value:any=el.type==='checkbox'?el.checked:el.type==='range'?Number(el.value):el.value;
 if(el.dataset.path==='name'&&!value.trim())value='Sem nome';
 if(el.dataset.path==='items.object'){
   const recipe=value==='custom'?itemDraft():undefined,interaction=value==='custom'?recipe?.interaction:value==='none'?undefined:objectInteraction(value);
   if(value==='custom'&&!interaction){toast('Configure a interação do objeto na oficina antes de equipá-lo.');return;}
   spec.items=loadItemSetup(categoryStorage,spec,value,recipe);
 }else if(el.dataset.path==='items.hands.left'||el.dataset.path==='items.hands.right'){
   write(el.dataset.path,value);const side=el.dataset.path.endsWith('left')?'left':'right';spec.items.grip[side]=[value==='closed'?1:0,value==='closed'?1:0,value==='closed'?1:0,value==='closed'?1:0,value==='closed'?1:0];
 }else write(el.dataset.path,value);
 preset='';
 const output=document.querySelector(`[data-output="${el.dataset.path}"]`);if(output)output.textContent=formatValue(el.dataset.path,value);
 if(el.type==='range')el.style.setProperty('--fill',String((value-Number(el.min))/(Number(el.max)-Number(el.min))*100)+'%');
 update(el.dataset.path!=='name'&&el.dataset.path!=='profession');
 if(tab==='features'&&el.dataset.path.startsWith('appearance.'))for(const q of document.querySelectorAll('[data-face-save]'))q.removeAttribute('disabled');
});
$('#panel').addEventListener('change',e=>{const el=e.target as HTMLInputElement;
 if(el.dataset.advanced!==undefined){advanced=el.checked;try{localStorage.setItem('abrigo-face-advanced',advanced?'1':'0');}catch{}renderPanel();return;}
if(el.dataset.path&&el.dataset.path!=='ui.intensity'){commit();if(el.tagName==='SELECT'||el.type==='color'||el.dataset.path.startsWith('items.armMotion.'))renderPanel();}});
$('#motion-select').addEventListener('change',e=>preview?.setMotion((e.target as HTMLSelectElement).value as Motion));
app.addEventListener('click',event=>{
 const b=(event.target as HTMLElement).closest<HTMLElement>('button');if(!b)return;
 if(b.dataset.faceType&&!(event.target as HTMLElement).closest('[data-face-remove]')){selectedFace=b.dataset.faceType;const next=clone(spec);applyFace(next,faceTypes()[selectedFace]);spec=next;preset='';commit();renderPanel();update();}
 const removeEl=(event.target as HTMLElement).closest<HTMLElement>('[data-face-remove]');
 if(removeEl){const id=removeEl.dataset.faceRemove!;delete faceStore.custom[id];if(selectedFace===id)selectedFace='';saveFaces();renderPanel();toast('Tipo de rosto excluído.');}
 if(b.dataset.faceSave){const id=b.dataset.faceSave,f={...currentFace(),label:faceTypes()[id].label};if(faceStore.custom[id])faceStore.custom[id]=f;else faceStore.overrides[id]=f;if(saveFaces())toast(`Tipo “${f.label}” atualizado.`);renderPanel();}
 if(b.dataset.saveItemSetup!==undefined){try{saveItemSetup(categoryStorage,spec);persist();toast('Configuração definitiva deste objeto salva. Será usada ao equipá-lo novamente.');}catch(e){toast((e as Error).message==='Escolha um objeto primeiro.'?(e as Error).message:'Não foi possível salvar a configuração neste navegador. Exporte o personagem para guardar uma cópia.');}}
 if(b.dataset.faceNew!==undefined){const input=$('#face-name') as HTMLInputElement,label=input.value.trim();if(!label){toast('Dê um nome ao novo tipo de rosto.');input.focus();return;}
   const id='custom-'+Date.now().toString(36);faceStore.custom[id]={...currentFace(),label};selectedFace=id;if(saveFaces())toast(`Tipo “${label}” criado.`);renderPanel();}
 if(b.dataset.fineReset!==undefined){delete spec.appearance.fine;preset='';commit();renderPanel();update();toast('Ajustes finos zerados.');}
 if(b.dataset.faceReset!==undefined){faceStore.overrides={};saveFaces();renderPanel();toast('Tipos originais restaurados.');}
 if(b.dataset.expression){expression=b.dataset.expression as Expression;preview?.setExpression(expression,intensity);document.querySelectorAll('[data-expression]').forEach(el=>el.classList.toggle('selected',el===b));}
 if(b.dataset.tab){if((b.dataset.tab==='face'||b.dataset.tab==='features')&&preview){preview.view('portrait');document.querySelectorAll('[data-view]').forEach(el=>el.classList.toggle('active',el.getAttribute('data-view')==='portrait'));}tab=b.dataset.tab;document.querySelectorAll('[data-tab]').forEach(el=>{const active=el.getAttribute('data-tab')===tab;el.classList.toggle('active',active);el.setAttribute('aria-selected',String(active));});renderPanel();$('#panel').scrollTop=0;}
 if(b.dataset.preset)replace(presetCharacter(b.dataset.preset),b.dataset.preset);
 if(b.dataset.colorPath){write(b.dataset.colorPath,b.dataset.color);preset='';commit();renderPanel();update();}
 if(b.dataset.view){preview?.view(b.dataset.view);document.querySelectorAll('[data-view]').forEach(el=>el.classList.toggle('active',el===b));}
 if(b.dataset.motion){preview?.setMotion(b.dataset.motion as Motion);document.querySelectorAll('[data-motion]').forEach(el=>el.classList.toggle('active',el===b));}
 if(b.dataset.trait){
   const id=b.dataset.trait,opposites:Record<string,string>={fit:'unfit',unfit:'fit',strong:'weak',weak:'strong'};
   if(spec.traits.includes(id)){const next=clone(spec);next.traits=next.traits.filter(t=>t!==id);if(characterStats(next).remaining<0){toast('Remova primeiro um traço positivo para liberar pontos.');return;}spec=next;}
   else{
     const next=clone(spec);next.traits=next.traits.filter(t=>t!==opposites[id]);next.traits.push(id);
     if(characterStats(next).remaining<0){toast('Pontos insuficientes. Remova um traço ou adicione uma limitação.');return;}spec=next;
   }preset='';commit();renderPanel();update(false);
 }
});
$('#random').onclick=()=>{const a=new Uint32Array(1);crypto.getRandomValues(a);replace(category==='villains'?randomVillain(String(a[0])):randomCharacter(String(a[0])));toast(category==='villains'?'Um novo vilão foi criado.':'Um novo sobrevivente chegou.');};
$('#apply-seed').onclick=()=>{const seed=$<HTMLInputElement>('#seed').value.trim();if(!seed){toast('Digite uma semente.');return;}replace(category==='villains'?randomVillain(seed):randomCharacter(seed));toast('Personagem gerado com a semente '+seed+'.');};
$('#seed').onkeydown=e=>{if(e.key==='Enter')$('#apply-seed').click();};
$('#save').onclick=()=>persist(true);$('#export').onclick=()=>{try{exportJson();}catch(e){toast((e as Error).message);}};
$('#import').onclick=()=>$<HTMLInputElement>('#file-input').click();
$('#file-input').onchange=async()=>{const input=$<HTMLInputElement>('#file-input'),file=input.files?.[0];if(!file)return;try{if(file.size>100000)throw new Error('O JSON deve ter até 100 KB.');replace(validateSpec(JSON.parse(await file.text())));toast('Personagem importado.');}catch(e){toast(e instanceof SyntaxError?'O arquivo não contém um JSON válido.':(e as Error).message);}finally{input.value='';}};
$('#undo').onclick=()=>{if(!history.length)return;future.push(clone(spec));spec=history.pop()!;committed=clone(spec);preset='';renderPanel();update();($('#seed') as HTMLInputElement).value=spec.seed;};
$('#redo').onclick=()=>{if(!future.length)return;history.push(clone(spec));spec=future.pop()!;committed=clone(spec);preset='';renderPanel();update();($('#seed') as HTMLInputElement).value=spec.seed;};
for(const [id,method] of [['rotate','rotate'],['grid','grid'],['pixel','pixelate'],['detail','detail'],['uhd','uhd']] as const)$('#'+id).onclick=()=>{if(!preview)return;try{const active=preview[method]();if(method==='detail'||method==='uhd'){const lv=preview.detailLevel;for(const [b,on] of [['detail',lv!=='low'],['uhd',lv==='uhd']] as const){$('#'+b).classList.toggle('active',on);$('#'+b).setAttribute('aria-pressed',String(on));}return;}$('#'+id).classList.toggle('active',active);$('#'+id).setAttribute('aria-pressed',String(active));}catch(e){toast((e as Error).message);}};
$('#pause').onclick=()=>{if(!preview)return;const paused=preview.pause();$('#pause').innerHTML=icon(paused?'play':'pause',16);$('#pause').setAttribute('aria-pressed',String(paused));$('#pause').setAttribute('aria-label',paused?'Retomar animação':'Pausar animação');};
$('#snapshot').onclick=async()=>{if(preview){try{download(await preview.snapshot(),safeName()+'.png');toast('Imagem PNG exportada.');}catch(e){toast('Não foi possível exportar a imagem: '+(e as Error).message);}}};
$('#sprites').onclick=async()=>{if(preview){try{download(await preview.spriteSheet(),safeName()+'.8-direcoes.png');toast('8 direções exportadas em PNG transparente.');}catch(e){toast('Não foi possível exportar as direções: '+(e as Error).message);}}};
$('#about').onclick=()=>$<HTMLDialogElement>('#about-dialog').showModal();$('.close-dialog').onclick=()=>$<HTMLDialogElement>('#about-dialog').close();
$('.brand').onclick=e=>e.preventDefault();
if(!storageAvailable)status('Exporte para salvar');
(window as any).__ABRIGO__={getSpec:()=>clone(spec),setSpec:(s:CharacterSpec)=>replace(validateSpec(s)),getPreview:()=>preview,randomCharacter,validateSpec};
mountCreatureEditor(preview);
const villainButton=document.createElement('button');villainButton.id='mode-villains';villainButton.textContent='Personagens Vilões';villainButton.setAttribute('aria-pressed','false');
$('#mode-characters').after(villainButton);
villainButton.addEventListener('click',()=>switchCategory('villains'));
$('#mode-characters').addEventListener('click',()=>switchCategory('characters'));
categoryChrome();
mountObjectEditor(preview);
mountGameTest(()=>clone(spec),preview);
// Deep link to a tab, e.g. ?tab=face opens the expressions.
{if(new URLSearchParams(location.search).get('detail')==='uhd')$('#uhd').click();const t=new URLSearchParams(location.search).get('tab');if(t)document.querySelector<HTMLElement>(`[data-tab="${t}"]`)?.click();}
