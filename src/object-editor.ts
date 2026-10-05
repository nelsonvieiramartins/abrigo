// OBJETOS: img2threejs' way of working (reference → intake → blockout → parts → review → code),
// with the costly steps done locally: the image analysis and the silhouette review run in the
// browser, the object is a small JSON recipe, and an LLM is only asked (optionally) to edit JSON.
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {icon} from './icons';
import {createObject,objectToTypeScript,type ObjectModel,type ObjectDetail} from './object';
import {OBJECT_SHAPES,OBJECT_CATEGORIES,OBJECT_PRESETS,OBJECT_ACTIONS,HAND_PLACEMENTS,MAX_PARTS,defaultPart,newPartId,presetObject,validateObjectSpec,type ObjectSpec,type ObjectShape,type ObjectPart} from './object-schema';
import {analyzeImage,blockout,silhouetteIoU,DETAIL,type Analysis,type Mask,type DetailLevel} from './object-analysis';

const esc=(s:unknown)=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const clone=<T,>(v:T):T=>JSON.parse(JSON.stringify(v));
const STORE='abrigo-object-v1';

export function mountObjectEditor(characterPreview:{setActive(v:boolean):void}|null){
  const nav=document.querySelector<HTMLElement>('.creator-modes'),header=document.querySelector<HTMLElement>('.topbar')!;
  if(!nav)return;
  let spec=presetObject('lantern'),selected=spec.parts[0]?.id??'',tab='parts',active=false,detail:ObjectDetail='high',showRef=true;
  let method='auto',level:DetailLevel='high',refImage:HTMLImageElement|null=null;
  let past:ObjectSpec[]=[],future:ObjectSpec[]=[],committed=clone(spec),analysis:Analysis|null=null,refCanvas:HTMLCanvasElement|null=null,refHeight=.3,lastScore:number|null=null;
  try{const raw=localStorage.getItem(STORE);if(raw){spec=validateObjectSpec(JSON.parse(raw));selected=spec.parts[0]?.id??'';committed=clone(spec);}}catch{}
  spec.id??=spec.parts[0]?.id??newPartId();committed=clone(spec);

  const button=document.createElement('button');button.id='mode-objects';button.setAttribute('aria-pressed','false');button.innerHTML='Objetos <span>IMG2THREEJS</span>';nav.append(button);
  const workspace=document.createElement('main');workspace.className='workspace object-workspace';workspace.hidden=true;
  workspace.innerHTML=`<aside class="archive"><div class="section-eyebrow">OFICINA / OBJETOS</div><h1>Tudo pode<br>ser útil.</h1><p class="intro">Da imagem ao Three.js,<br>sem arquivos de modelo.</p>
    <div class="object-steps">
      <div class="object-step"><span class="object-step-n">1</span><div><strong>Imagem de referência</strong><small>Objeto de frente, fundo liso ou PNG transparente</small></div></div>
      <button class="button randomize" data-action="load-ref">${icon('upload')} Carregar imagem</button><canvas id="ref-thumb" width="190" height="120" hidden></canvas><p id="ref-info" class="object-hint" hidden></p>
      <div class="object-step"><span class="object-step-n">2</span><div><strong>Como gerar</strong><small>Tudo roda no navegador, sem IA</small></div></div>
      <div class="field"><label>Método</label><div class="object-methods four">${[['auto','Auto'],['lathe','Revolução'],['extrude','Extrusão'],['blocks','Blocos']].map(([id,l])=>`<button class="expression ${id==='auto'?'selected':''}" data-method="${id}" title="${{auto:'Usa a sugestão da análise',lathe:'Objetos redondos: garrafa, lata, lampião',extrude:'Objetos chatos: machado, faca, placa',blocks:'Caixas e móveis'}[id]}">${l}</button>`).join('')}</div></div>
      <div class="field"><label>Nível de detalhe</label><div class="object-methods">${[['low','Baixo'],['medium','Médio'],['high','Alto']].map(([id,l])=>`<button class="expression ${id==='high'?'selected':''}" data-level="${id}">${l}</button>`).join('')}</div></div>
      <div class="field"><label for="ref-height">Altura real do objeto <output id="ref-height-out">0,30 m</output></label><input id="ref-height" type="range" min=".05" max="2.5" step=".01" value=".3" style="--fill:10%"></div>
      <div class="field"><label for="ref-depth">Espessura (extrusão) <output id="ref-depth-out">30%</output></label><input id="ref-depth" type="range" min=".05" max="1" step=".01" value=".3" style="--fill:26%"></div>
      <div class="object-step"><span class="object-step-n">3</span><div><strong>Gerar</strong><small>Cria as peças e compara com a imagem</small></div></div>
      <button class="button primary object-generate" data-action="generate" disabled>GERAR OBJETO</button>
      <div id="generate-result" class="object-result" hidden></div>
    </div>
    <div class="section-eyebrow" style="margin:22px 0 10px">MODELOS INICIAIS</div><div class="object-presets">${Object.entries(OBJECT_PRESETS).map(([id,p])=>`<button class="expression" data-preset-object="${id}">${p.label}</button>`).join('')}</div>
    <input id="ref-file" type="file" accept="image/*" hidden><input id="object-file" type="file" accept="application/json,.json" hidden></aside>
  <section class="stage-column" aria-label="Visualização do objeto"><div class="stage-heading"><div><span class="section-eyebrow">REGISTRO DE OBJETO</span><h2 id="object-title"></h2><p id="object-subtitle"></p></div><div class="history-buttons"><button class="icon-button" data-action="undo" aria-label="Desfazer">${icon('undo')}</button><button class="icon-button" data-action="redo" aria-label="Refazer">${icon('redo')}</button></div></div>
    <div class="viewport-wrap"><div class="view-controls">${[['iso','Isométrica'],['front','Frente'],['side','Lado'],['top','Topo']].map(([id,l])=>`<button data-object-view="${id}" class="${id==='iso'?'active':''}">${l}</button>`).join('')}</div><div id="object-viewport"></div>
      <div class="viewport-tools"><button class="icon-button" data-action="grid" aria-pressed="true" aria-label="Grade">${icon('grid')}</button><button class="icon-button pixel-button" data-action="ref" aria-pressed="true" title="Mostrar a referência atrás do objeto (vista de frente)">REF</button><button class="icon-button pixel-button" data-action="detail" aria-pressed="true" title="Alta definição">HD</button><button class="icon-button" data-action="snapshot" aria-label="Salvar PNG">${icon('camera')}</button></div>
      <div class="stage-coordinate"><span>OBJETOS PROCEDURAIS</span><span>CLIQUE PARA SELECIONAR PEÇA</span></div></div>
    <div class="stage-footer"><span id="object-stats"></span><span id="object-score"></span></div></section>
  <aside class="inspector"><div class="inspector-title"><span class="section-eyebrow">CONSTRUÇÃO DO OBJETO</span><span id="object-save-state">Rascunho local</span></div>
    <div class="tabs" role="tablist">${[['parts','Peças'],['object','Objeto'],['review','Revisão'],['export','Exportar']].map(([id,l])=>`<button role="tab" data-object-tab="${id}" class="${id==='parts'?'active':''}">${l}</button>`).join('')}</div>
    <div id="object-panel" role="tabpanel"></div><div class="inspector-bottom"><button class="button save-button" data-action="save">${icon('save')} Salvar rascunho do objeto</button><span>Separado de personagens e criaturas</span></div></aside>`;
  (document.querySelector('.creature-workspace')??document.querySelector('.workspace')!).after(workspace);
  const $=<T extends HTMLElement=HTMLElement>(s:string)=>workspace.querySelector<T>(s)!;
  const notify=(t:string)=>{const el=document.querySelector<HTMLElement>('#toast')!;el.textContent=t;el.classList.add('visible');window.setTimeout(()=>el.classList.remove('visible'),4000);};

  // ---- viewer --------------------------------------------------------------------------------
  const host=$('#object-viewport'),renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;renderer.outputColorSpace=THREE.SRGBColorSpace;host.append(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,.01,100),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;
  scene.add(new THREE.HemisphereLight('#eef1da','#3c494b',2));const key=new THREE.DirectionalLight('#fff0d8',2.6);key.position.set(-3,5,4);key.castShadow=true;key.shadow.mapSize.set(1024,1024);scene.add(key);const fill=new THREE.DirectionalLight('#a6c8cc',1.4);fill.position.set(3,2,-4);scene.add(fill);
  const grid=new THREE.GridHelper(4,40,'#4a554f','#2f3936');(grid.material as THREE.Material).transparent=true;(grid.material as THREE.Material).opacity=.5;scene.add(grid);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.ShadowMaterial({opacity:.25}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
  const selectionBox=new THREE.BoxHelper(new THREE.Object3D(),'#c3cd9b');selectionBox.visible=false;scene.add(selectionBox);
  let model:ObjectModel|null=null,refPlane:THREE.Mesh|null=null,viewName='iso',span=.3,centre=new THREE.Vector3(0,.15,0);
  const resize=()=>{const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h);const a=w/h;camera.left=-span*a;camera.right=span*a;camera.top=span;camera.bottom=-span;camera.updateProjectionMatrix();};
  new ResizeObserver(resize).observe(host);
  const view=(name:string)=>{viewName=name;const d:Record<string,number[]>={iso:[1,.8,1.2],front:[0,0,1],side:[1,0,0],top:[0,1,.001]};const v=new THREE.Vector3(...d[name] as [number,number,number]).normalize().multiplyScalar(6);
    controls.target.copy(centre);camera.position.copy(centre).add(v);camera.zoom=1;camera.updateProjectionMatrix();controls.update();if(refPlane)refPlane.visible=showRef&&name==='front';};
  const frameAll=()=>{const box=new THREE.Box3();if(model)box.setFromObject(model.root);if(refPlane&&showRef)box.expandByObject(refPlane);if(box.isEmpty())box.set(new THREE.Vector3(-.1,0,-.1),new THREE.Vector3(.1,.2,.1));
    centre=box.getCenter(new THREE.Vector3());const size=box.getSize(new THREE.Vector3());span=Math.max(size.x,size.y,size.z)*.8+.02;grid.scale.setScalar(Math.max(.25,span));resize();};
  const rebuild=(reframe=false)=>{
    const next=createObject(spec,{detail});model?.dispose();model=next;scene.add(next.root);
    $('#object-stats').textContent=Math.round(next.stats.triangles).toLocaleString('pt-BR')+' triângulos · '+next.stats.meshes+' peças';
    highlight();if(reframe){frameAll();view(viewName);}
  };
  const highlight=()=>{const obj=model?.nodes[selected];selectionBox.visible=!!obj;if(obj){selectionBox.setFromObject(obj);}};
  let raf=0;const loop=()=>{raf=requestAnimationFrame(loop);if(!active)return;controls.update();renderer.render(scene,camera);};
  // Click (not drag) selects a part.
  let down:[number,number]|null=null;
  renderer.domElement.addEventListener('pointerdown',e=>down=[e.clientX,e.clientY]);
  renderer.domElement.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>4||!model)return;const r=renderer.domElement.getBoundingClientRect(),ray=new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);const hit=ray.intersectObjects(model.root.children,false)[0];
    if(hit){selected=(hit.object.userData.partId as string)??selected;tab='parts';tabs();panel();highlight();}});

  // ---- reference image -------------------------------------------------------------------------
  const setReference=(img:HTMLImageElement)=>{
    refImage=img;const max=DETAIL[level].resolution,k=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.max(8,Math.round(img.width*k));c.height=Math.max(8,Math.round(img.height*k));
    const ctx=c.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(img,0,0,c.width,c.height);
    analysis=analyzeImage(ctx.getImageData(0,0,c.width,c.height),42,DETAIL[level]);
    // Cut-out of the object only (background cleared), used as the overlay texture.
    const {crop,mask}=analysis,cut=document.createElement('canvas');cut.width=crop.width;cut.height=crop.height;const cc=cut.getContext('2d')!,src=ctx.getImageData(crop.x,crop.y,crop.width,crop.height);
    for(let i=0;i<mask.data.length;i++)if(!mask.data[i])src.data[i*4+3]=0;cc.putImageData(src,0,0);refCanvas=cut;
    const th=$<HTMLCanvasElement>('#ref-thumb'),tc=th.getContext('2d')!;th.hidden=false;tc.clearRect(0,0,th.width,th.height);const s=Math.min(th.width/cut.width,th.height/cut.height);tc.drawImage(cut,(th.width-cut.width*s)/2,(th.height-cut.height*s)/2,cut.width*s,cut.height*s);
    const names={lathe:'Revolução',extrude:'Extrusão',blocks:'Blocos'};
    const info=$('#ref-info');info.hidden=false;info.innerHTML=`Silhueta ${crop.width}×${crop.height}px · simetria ${Math.round(analysis.symmetry*100)}% · ${analysis.palette.length} cores · ${analysis.bands.length} faixas.<br>Método sugerido: <b>${names[analysis.suggestion]}</b>.`;
    $('[data-action="generate"]').removeAttribute('disabled');
    placeReference();
  };
  const placeReference=()=>{
    if(refPlane){scene.remove(refPlane);refPlane.geometry.dispose();((refPlane.material as THREE.MeshBasicMaterial).map as THREE.Texture).dispose();(refPlane.material as THREE.Material).dispose();refPlane=null;}
    if(!analysis||!refCanvas)return;const {mask,axis}=analysis,s=refHeight/mask.height,tex=new THREE.CanvasTexture(refCanvas);tex.colorSpace=THREE.SRGBColorSpace;
    refPlane=new THREE.Mesh(new THREE.PlaneGeometry(mask.width*s,refHeight),new THREE.MeshBasicMaterial({map:tex,transparent:true,opacity:.55,depthWrite:false}));
    const box=model?new THREE.Box3().setFromObject(model.root):null;refPlane.position.set((mask.width/2-axis)*s,refHeight/2,box&&!box.isEmpty()?box.min.z-.02:-.1);refPlane.renderOrder=-1;scene.add(refPlane);refPlane.visible=showRef&&viewName==='front';
  };
  // Review: render the object's front silhouette at the reference's framing and compare the masks.
  const review=():number|null=>{
    if(!analysis||!model)return null;const {mask,axis}=analysis,s=refHeight/mask.height;
    const cam=new THREE.OrthographicCamera(-axis*s,(mask.width-axis)*s,refHeight,0,.01,50);cam.position.set(0,0,20);cam.lookAt(0,0,0);cam.position.set(0,0,20);
    const target=new THREE.WebGLRenderTarget(mask.width,mask.height),flat=new THREE.Scene(),white=new THREE.MeshBasicMaterial({color:'#fff',side:THREE.DoubleSide});
    const copy=model.root.clone(true);copy.traverse(o=>{if((o as THREE.Mesh).isMesh)(o as THREE.Mesh).material=white;});flat.add(copy);
    renderer.setRenderTarget(target);renderer.setClearColor('#000',1);renderer.clear();renderer.render(flat,cam);
    const px=new Uint8Array(mask.width*mask.height*4);renderer.readRenderTargetPixels(target,0,0,mask.width,mask.height,px);renderer.setRenderTarget(null);renderer.setClearColor('#000',0);target.dispose();white.dispose();
    const rendered:Mask={width:mask.width,height:mask.height,data:new Uint8Array(mask.width*mask.height)};
    for(let y=0;y<mask.height;y++)for(let x=0;x<mask.width;x++)rendered.data[(mask.height-1-y)*mask.width+x]=px[(y*mask.width+x)*4]>127?1:0;
    const score=silhouetteIoU(mask,rendered);drawReview(mask,rendered);return score;
  };
  let reviewCanvas:HTMLCanvasElement|null=null;
  const drawReview=(ref:Mask,got:Mask)=>{const c=document.createElement('canvas');c.width=ref.width;c.height=ref.height;const ctx=c.getContext('2d')!,img=ctx.createImageData(ref.width,ref.height);
    for(let i=0;i<ref.data.length;i++){const a=ref.data[i],b=got.data[i],o=i*4;const col=a&&b?[190,205,145]:a?[214,120,96]:b?[110,160,210]:[28,34,33];img.data[o]=col[0];img.data[o+1]=col[1];img.data[o+2]=col[2];img.data[o+3]=255;}
    ctx.putImageData(img,0,0);reviewCanvas=c;};

  // ---- state ---------------------------------------------------------------------------------
  const summary=()=>{$('#object-title').textContent=spec.name;$('#object-subtitle').textContent=OBJECT_CATEGORIES[spec.category]+' / '+spec.parts.length+' peças'+(spec.source?.method?' / '+spec.source.method:'');
    $('[data-action="undo"]').toggleAttribute('disabled',!past.length);$('[data-action="redo"]').toggleAttribute('disabled',!future.length);
    $('#object-score').textContent=lastScore===null?'':`Fidelidade da silhueta: ${Math.round(lastScore*100)}%`;};
  let saveTimer=0;const persist=()=>{try{localStorage.setItem(STORE,JSON.stringify(spec));$('#object-save-state').textContent='Rascunho salvo';}catch{$('#object-save-state').textContent='Exporte para salvar';}};
  const commit=()=>{if(JSON.stringify(spec)!==JSON.stringify(committed)){past.push(clone(committed));past=past.slice(-40);future=[];committed=clone(spec);}summary();};
  const change=(next:ObjectSpec,{reframe=false,renderPanel=true}={})=>{spec=validateObjectSpec(next);spec.id??=spec.parts[0]?.id??newPartId();if(!spec.parts.some(p=>p.id===selected))selected=spec.parts[0]?.id??'';lastScore=null;rebuild(reframe);if(renderPanel)panel();summary();clearTimeout(saveTimer);$('#object-save-state').textContent='Alterações…';saveTimer=window.setTimeout(persist,450);};
  const replace=(next:ObjectSpec)=>{change(next,{reframe:true});commit();placeReference();};

  // ---- panels ----------------------------------------------------------------------------------
  const tabs=()=>workspace.querySelectorAll<HTMLElement>('[data-object-tab]').forEach(b=>b.classList.toggle('active',b.dataset.objectTab===tab));
  const numRow=(label:string,path:string,v:number[],step:number)=>`<div class="field"><label>${label}</label><div class="object-vec">${v.map((x,i)=>`<input type="number" step="${step}" value="${+x.toFixed(4)}" data-part="${path}.${i}">`).join('')}</div></div>`;
  function panel(){
    const p=$('#object-panel'),heading=(t:string,d:string)=>`<div class="panel-heading"><div><h3>${t}</h3><p>${d}</p></div></div>`;
    if(tab==='parts'){
      const part=spec.parts.find(q=>q.id===selected);
      p.innerHTML=heading('Peças','Formas simples compõem o objeto.')+`<div class="object-list">${spec.parts.map(q=>`<button class="${q.id===selected?'selected':''}" data-select="${q.id}"><span>${esc(q.name)}</span><small>${OBJECT_SHAPES[q.shape]}${q.mirrorX?' · espelhada':''}</small></button>`).join('')}</div>
        <div class="object-add"><select id="add-shape">${Object.entries(OBJECT_SHAPES).map(([id,l])=>`<option value="${id}">${l}</option>`).join('')}</select><button class="button quiet" data-action="add">+ Peça</button></div>`+
        (part?`<div class="section-line">PEÇA SELECIONADA</div><div class="field"><label>Nome</label><input data-part="name" value="${esc(part.name)}" maxlength="48"></div>`+
        numRow('Posição (m)','position',part.position,.005)+numRow('Rotação (graus)','rotation',part.rotation,5)+numRow(part.shape==='lathe'?'Escala do perfil (raio, altura, -)':part.shape==='extrude'?'Escala (x, y, espessura)':part.shape==='tube'?'Raio (m)':'Tamanho (m)','size',part.size,.005)+
        `<div class="field creature-color"><label>Cor</label><input type="color" data-part="color" value="${part.color}"></div>`+
        [['roughness','Aspereza'],['metalness','Metal'],['bevel','Chanfro']].map(([k,l])=>`<div class="field"><label>${l}<output>${(part as any)[k]}</output></label><input type="range" min="0" max="1" step=".01" data-part="${k}" value="${(part as any)[k]}" style="--fill:${(part as any)[k]*100}%"></div>`).join('')+
        `<label class="toggle-row"><span><strong>Espelhar em X</strong><small>Cria a cópia do outro lado</small></span><input type="checkbox" data-part="mirrorX" ${part.mirrorX?'checked':''}><span class="toggle"></span></label>`+
        (part.profile||part.outline||part.path?`<div class="field"><label>${part.profile?'Perfil [raio, altura]':part.outline?'Contorno [x, y]':'Caminho [x, y, z]'}</label><textarea data-part-points rows="4">${esc(JSON.stringify(part.profile??part.outline??part.path))}</textarea></div>`:'')+
        `<div class="object-actions"><button class="button quiet" data-action="duplicate">Duplicar</button><button class="button quiet" data-action="delete">Excluir</button></div>`:'');
    }
    if(tab==='object')p.innerHTML=heading('Objeto','Identidade e pontos de encaixe.')+`<div class="field"><label>Nome</label><input id="object-name" value="${esc(spec.name)}" maxlength="64"></div>
      <div class="field"><label>Categoria</label><select id="object-category">${Object.entries(OBJECT_CATEGORIES).map(([id,l])=>`<option value="${id}" ${spec.category===id?'selected':''}>${l}</option>`).join('')}</select></div>
      <div class="field"><label>Desgaste<output>${spec.wear}</output></label><input id="object-wear" type="range" min="0" max="1" step=".01" value="${spec.wear}" style="--fill:${spec.wear*100}%"></div>
      <div class="section-line">INTERAÇÃO COM PERSONAGEM</div>
      <div class="field"><label>Ação ao equipar</label><select id="object-action">${Object.entries(OBJECT_ACTIONS).map(([id,l])=>`<option value="${id}" ${(spec.interaction?.action??'none')===id?'selected':''}>${l}</option>`).join('')}</select></div>
      <div class="field" id="object-hands" ${(spec.interaction?.action??'none')==='none'?'hidden':''}><label>Mãos permitidas</label>${Object.entries(HAND_PLACEMENTS).map(([id,l])=>`<label class="toggle-row"><span><strong>${l}</strong></span><input type="checkbox" data-object-hand="${id}" ${(spec.interaction?.hands??[]).includes(id as any)?'checked':''}><span class="toggle"></span></label>`).join('')}</div>
      <div class="field"><label>Pontos de encaixe (JSON)</label><textarea id="object-sockets" rows="4">${esc(JSON.stringify(spec.sockets))}</textarea></div>
      <div class="panel-note">${icon('info',15)}<span>Somente objetos com ação e mão permitida aparecem em <b>Itens</b>. Use <b>grip</b> para o ponto onde a mão segura.</span></div>`;
    if(tab==='review'){
      p.innerHTML=heading('Revisão','Como o img2threejs: compara a silhueta com a referência.')+(analysis?`<button class="button save-button" data-action="review">Comparar com a referência</button>
        ${lastScore!==null?`<div class="object-score"><strong>${Math.round(lastScore*100)}%</strong><span>de sobreposição (IoU) na vista de frente</span></div>`:''}<div id="review-slot"></div>
        <p class="object-hint"><span style="color:#becd91">■</span> coincide · <span style="color:#d67860">■</span> falta no modelo · <span style="color:#6ea0d2">■</span> sobra no modelo</p>`:'<p class="object-hint">Carregue uma imagem de referência na coluna da esquerda para comparar.</p>');
      if(reviewCanvas&&lastScore!==null){const slot=$('#review-slot'),c=reviewCanvas;c.className='review-canvas';slot.append(c);}
    }
    if(tab==='export')p.innerHTML=heading('Exportar','Receita, código Three.js ou pedido curto para IA.')+`<div class="object-actions column"><button class="button quiet" data-action="export-json">${icon('download')} Receita .objeto.json</button><button class="button quiet" data-action="export-ts">${icon('download')} Código TypeScript (Three.js)</button><button class="button quiet" data-action="import">${icon('upload')} Importar receita</button></div>
      <div class="section-line">PEDIDO ECONÔMICO PARA IA</div><p class="object-hint">A IA só edita o JSON (poucas centenas de tokens), em vez de escrever código.</p>
      <div class="field"><label>O que mudar</label><textarea id="ai-request" rows="3" placeholder="Ex.: deixe o cabo mais longo e a lâmina mais larga"></textarea></div><button class="button quiet" data-action="copy-prompt">Copiar pedido</button>
      <div class="field" style="margin-top:14px"><label>Colar resposta (JSON)</label><textarea id="ai-answer" rows="4"></textarea></div><button class="button save-button" data-action="apply-answer">Aplicar resposta</button>`;
  }
  const prompt=(request:string)=>[
    'Você edita receitas JSON de objetos 3D low-poly para Three.js (projeto ABRIGO). Responda SOMENTE com o JSON completo e válido, sem comentários.',
    'Esquema: {kind:"object",schemaVersion:1,name,category(tool|weapon|container|light|furniture|nature|misc),wear 0..1,interaction?:{action:none|carry|use|swing,hands:[left|right|both]},parts[],sockets[{name,position,rotation}]}.',
    'Peça: {id,name,shape,position[x,y,z] m,rotation[x,y,z] graus,size[x,y,z],color "#rrggbb",roughness,metalness,bevel 0..1,mirrorX?}.',
    'Formas e size: box [larg,alt,prof]; cylinder/cone/capsule [raio,altura,raio]; sphere [raios]; torus [raio,espessura,0] (anel no plano XY; rotation [90,0,0] deita); lathe: profile [[raio,altura]...] de baixo para cima, size escala; extrude: outline [[x,y]...] contorno fechado, size [escala,escala,espessura]; tube: path [[x,y,z]...], size[0]=raio.',
    'Metros, +Y para cima, +Z frente, base em y=0. Máximo 64 peças. Mantenha ids existentes. Formas simples, poucas peças.',
    'Pedido: '+(request.trim()||'melhore a forma mantendo o estilo simples.'),
    'Receita atual: '+JSON.stringify(spec)].join('\n');

  // ---- events ----------------------------------------------------------------------------------
  const download=(url:string,name:string)=>{const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();};
  const fileName=()=>spec.name.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9_-]+/gi,'-').toLowerCase()||'objeto';
  const exportBlob=(text:string,type:string,name:string)=>{const url=URL.createObjectURL(new Blob([text],{type}));download(url,name);setTimeout(()=>URL.revokeObjectURL(url),1000);};
  const editPart=(fn:(p:ObjectPart)=>void)=>{const next=clone(spec),part=next.parts.find(q=>q.id===selected);if(!part)return;fn(part);return next;};
  workspace.addEventListener('input',e=>{
    const el=e.target as HTMLInputElement;
    try{
      if(el.id==='ref-height'||el.id==='ref-depth'){const v=Number(el.value);el.style.setProperty('--fill',(v-Number(el.min))/(Number(el.max)-Number(el.min))*100+'%');if(el.id==='ref-height'){refHeight=v;$('#ref-height-out').textContent=v.toFixed(2).replace('.',',')+' m';placeReference();}else $('#ref-depth-out').textContent=Math.round(v*100)+'%';return;}
      if(el.dataset.part){const path=el.dataset.part,[k,i]=path.split('.');const next=editPart(part=>{
          const v=el.type==='checkbox'?el.checked:el.type==='range'||el.type==='number'?Number(el.value):el.value;
          if(i!==undefined)((part as any)[k] as number[])[Number(i)]=Number(v);else (part as any)[k]=v;});
        if(!next)return;if(el.type==='range'){el.style.setProperty('--fill',Number(el.value)*100+'%');const o=el.previousElementSibling?.querySelector('output');if(o)o.textContent=el.value;}
        change(next,{renderPanel:el.type==='checkbox'});return;}
      if(el.id==='object-name'&&el.value.trim()){change({...clone(spec),name:el.value.trim()},{renderPanel:false});return;}
      if(el.id==='object-wear'){el.style.setProperty('--fill',Number(el.value)*100+'%');change({...clone(spec),wear:Number(el.value)},{renderPanel:false});return;}
    }catch(err){notify((err as Error).message);}
  });
  workspace.addEventListener('change',e=>{
    const el=e.target as HTMLInputElement&HTMLTextAreaElement;
    try{
      if(el.dataset.partPoints!==undefined){const pts=JSON.parse(el.value);const next=editPart(part=>{if(part.profile)part.profile=pts;else if(part.outline)part.outline=pts;else part.path=pts;});if(next)change(next);}
      if(el.id==='object-category')change({...clone(spec),category:el.value as any},{renderPanel:false});
      if(el.id==='object-action'){const next=clone(spec),action=el.value as any;next.interaction=action==='none'?{action,hands:[]}: {action,hands:next.interaction?.hands.length?next.interaction.hands:['right']};change(next);}
      if(el.dataset.objectHand){const next=clone(spec),hands=new Set(next.interaction?.hands??[]);el.checked?hands.add(el.dataset.objectHand as any):hands.delete(el.dataset.objectHand as any);next.interaction={action:next.interaction?.action==='none'||!next.interaction?.action?'carry':next.interaction.action,hands:[...hands] as any};if(!next.interaction.hands.length)throw new Error('Escolha ao menos uma mão ou desative a ação.');change(next);}
      if(el.id==='object-sockets')change({...clone(spec),sockets:JSON.parse(el.value)});
      commit();
    }catch(err){notify('Não aplicado: '+(err as Error).message);panel();}
  });
  workspace.addEventListener('click',async e=>{
    const b=(e.target as HTMLElement).closest<HTMLElement>('button');if(!b)return;
    try{
      if(b.dataset.objectTab){tab=b.dataset.objectTab;tabs();panel();return;}
      if(b.dataset.objectView){view(b.dataset.objectView);workspace.querySelectorAll('[data-object-view]').forEach(q=>q.classList.toggle('active',q===b));return;}
      if(b.dataset.select){selected=b.dataset.select;panel();highlight();return;}
      if(b.dataset.presetObject){analysis=null;placeReference();$('#ref-thumb').hidden=true;replace(presetObject(b.dataset.presetObject));selected=spec.parts[0].id;panel();highlight();return;}
      if(b.dataset.method){method=b.dataset.method;workspace.querySelectorAll('[data-method]').forEach(q=>q.classList.toggle('selected',q===b));return;}
      if(b.dataset.level){level=b.dataset.level as DetailLevel;workspace.querySelectorAll('[data-level]').forEach(q=>q.classList.toggle('selected',q===b));return;}
      const a=b.dataset.action;
      if(a==='load-ref'){$('#ref-file').click();return;}
      if(a==='generate'){
        if(!refImage){notify('Carregue primeiro uma imagem de referência.');return;}
        b.setAttribute('disabled','');b.textContent='GERANDO…';await new Promise(r=>setTimeout(r,30));
        try{
          setReference(refImage); // re-read at the chosen detail level
          const m=(method==='auto'?analysis!.suggestion:method) as 'lathe'|'extrude'|'blocks',t0=performance.now();
          const next=blockout(analysis!,m,refHeight,spec.source?.method?.startsWith('imagem')?spec.name:'Objeto da imagem',Number($<HTMLInputElement>('#ref-depth').value),DETAIL[level]);
          replace(next);selected=spec.parts[0].id;lastScore=review();
          if(lastScore!==null)spec={...spec,source:{...spec.source!,silhouetteScore:+lastScore.toFixed(3)}};
          summary();panel();viewName='iso';view('iso');workspace.querySelectorAll('[data-object-view]').forEach(q=>q.classList.toggle('active',q.getAttribute('data-object-view')==='iso'));
          const names={lathe:'Revolução',extrude:'Extrusão',blocks:'Blocos'},res=$('#generate-result');res.hidden=false;
          res.innerHTML=`<strong>${lastScore!==null?Math.round(lastScore*100)+'%':'—'}</strong><span>fidelidade da silhueta</span><small>${names[m]} · detalhe ${({low:'baixo',medium:'médio',high:'alto'})[level]} · ${spec.parts.length} peças · ${Math.round(model!.stats.triangles).toLocaleString('pt-BR')} triângulos · ${Math.round(performance.now()-t0)} ms</small>`;
        }finally{b.removeAttribute('disabled');b.textContent='GERAR OBJETO';}
        return;
      }
      if(a==='undo'||a==='redo'){const from=a==='undo'?past:future,to=a==='undo'?future:past;if(from.length){to.push(clone(spec));spec=from.pop()!;committed=clone(spec);change(spec);}return;}
      if(a==='add'){if(spec.parts.length>=MAX_PARTS)throw new Error(`Máximo de ${MAX_PARTS} peças.`);const part=defaultPart($<HTMLSelectElement>('#add-shape').value as ObjectShape);const box=model?new THREE.Box3().setFromObject(model.root):null;if(box&&!box.isEmpty()&&part.shape!=='lathe'&&part.shape!=='tube')part.position=[0,+(box.max.y+.05).toFixed(3),0];selected=part.id;change({...clone(spec),parts:[...spec.parts,part]});commit();return;}
      if(a==='duplicate'){const src=spec.parts.find(q=>q.id===selected);if(!src)return;const copy={...clone(src),id:newPartId(),name:src.name+' (cópia)'};copy.position[0]+=.03;selected=copy.id;change({...clone(spec),parts:[...spec.parts,copy]});commit();return;}
      if(a==='delete'){if(spec.parts.length<2)throw new Error('O objeto precisa de ao menos uma peça.');change({...clone(spec),parts:spec.parts.filter(q=>q.id!==selected)});commit();return;}
      if(a==='grid'){grid.visible=!grid.visible;b.setAttribute('aria-pressed',String(grid.visible));return;}
      if(a==='ref'){showRef=!showRef;b.setAttribute('aria-pressed',String(showRef));if(refPlane)refPlane.visible=showRef&&viewName==='front';return;}
      if(a==='detail'){detail=detail==='high'?'low':'high';b.setAttribute('aria-pressed',String(detail==='high'));rebuild();return;}
      if(a==='snapshot'){renderer.render(scene,camera);download(renderer.domElement.toDataURL('image/png'),fileName()+'.png');return;}
      if(a==='save'){persist();notify('Rascunho do objeto salvo.');return;}
      if(a==='review'){lastScore=review();if(lastScore!==null)spec={...spec,source:{...(spec.source??{method:'manual'}),silhouetteScore:+lastScore.toFixed(3)}};summary();panel();return;}
      if(a==='export-json'){exportBlob(JSON.stringify(validateObjectSpec(spec),null,2),'application/json',fileName()+'.objeto.json');notify('Receita exportada.');return;}
      if(a==='export-ts'){exportBlob(objectToTypeScript(spec),'text/typescript',fileName()+'.ts');notify('Código Three.js exportado.');return;}
      if(a==='import'){$('#object-file').click();return;}
      if(a==='copy-prompt'){const text=prompt($<HTMLTextAreaElement>('#ai-request').value);await navigator.clipboard.writeText(text).catch(()=>{throw new Error('Não consegui copiar; permita a área de transferência.');});notify(`Pedido copiado (~${Math.round(text.length/4)} tokens).`);return;}
      if(a==='apply-answer'){const raw=$<HTMLTextAreaElement>('#ai-answer').value,json=raw.slice(raw.indexOf('{'),raw.lastIndexOf('}')+1);replace(validateObjectSpec(JSON.parse(json)));notify('Resposta aplicada.');return;}
    }catch(err){notify((err as Error).message);}
  });
  $('#ref-file').addEventListener('change',async()=>{const input=$<HTMLInputElement>('#ref-file'),file=input.files?.[0];if(!file)return;
    try{const url=URL.createObjectURL(file),img=new Image();img.src=url;await img.decode();setReference(img);URL.revokeObjectURL(url);notify('Imagem carregada. Ajuste as opções e clique em GERAR OBJETO.');}catch(err){notify((err as Error).message);}finally{input.value='';}});
  $('#object-file').addEventListener('change',async()=>{const input=$<HTMLInputElement>('#object-file'),file=input.files?.[0];if(!file)return;try{if(file.size>200000)throw new Error('O JSON deve ter até 200 KB.');replace(validateObjectSpec(JSON.parse(await file.text())));notify('Objeto importado.');}catch(err){notify((err as Error).message);}finally{input.value='';}});

  // ---- mode switching (third mode next to Personagens and Criaturas) ---------------------------------
  const creatures=()=>(window as any).__ABRIGO_CREATURES__;
  const setActive=(on:boolean)=>{
    active=on;workspace.hidden=!on;button.setAttribute('aria-pressed',String(on));
    if(on){creatures()?.setMode(false);characterPreview?.setActive(false);document.querySelector<HTMLElement>('.workspace:not(.creature-workspace):not(.object-workspace)')!.hidden=true;
      nav.querySelectorAll('button').forEach(q=>{if(q!==button)q.setAttribute('aria-pressed','false');});
      header.querySelector('.brand small')!.textContent='OBJETOS';header.querySelector('#export span')!.textContent='Exportar objeto';header.querySelector('.project-status')!.innerHTML='<i></i> OFICINA DE OBJETOS <span class="version">IMG2THREEJS</span>';
      requestAnimationFrame(()=>{frameAll();view(viewName);});}
  };
  button.addEventListener('click',()=>setActive(true));
  nav.querySelectorAll('button').forEach(q=>{if(q!==button)q.addEventListener('click',()=>{if(active){active=false;workspace.hidden=true;button.setAttribute('aria-pressed','false');}});});
  for(const id of ['import','export'])header.querySelector('#'+id)?.addEventListener('click',e=>{if(!active)return;e.stopImmediatePropagation();if(id==='export')exportBlob(JSON.stringify(validateObjectSpec(spec),null,2),'application/json',fileName()+'.objeto.json');else $('#object-file').click();},true);

  rebuild(true);panel();summary();loop();
  (window as any).__ABRIGO_OBJECTS__={getSpec:()=>clone(spec),setSpec:(s:unknown)=>replace(validateObjectSpec(s)),setActive,loadReference:setReference,review:()=>{lastScore=review();summary();return lastScore;}};
  if(new URLSearchParams(location.search).get('mode')==='objects')setActive(true);
}
