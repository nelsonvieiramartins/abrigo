import {defaultEnvironment,ENVIRONMENT_WEATHERS,type EnvironmentSettings} from './environment-data';
import type {createPreview} from './scene';

export function mountEnvironmentControls(container:HTMLElement,preview:()=>ReturnType<typeof createPreview>|null,change?:(settings:EnvironmentSettings,commit:boolean)=>void){
 const root=document.createElement('section');root.className='environment-controls';root.innerHTML='<h3>Controles do Bioma</h3>'+[
  ['wind','Força do vento',0,1,.01],['hour','Hora do dia',0,24,.05],
 ].map(([key,label,min,max,step])=>`<label>${label} <output data-env-output="${key}"></output><input data-environment="${key}" type="range" min="${min}" max="${max}" step="${step}"></label>`).join('')+
 '<label>Clima<select data-environment="weather">'+Object.entries(ENVIRONMENT_WEATHERS).map(([id,label])=>`<option value="${id}">${label}</option>`).join('')+'</select></label>'+[
  ['intensity','Intensidade do clima'],['volume','Volume ambiente'],['strength','Retoque visual'],
 ].map(([key,label])=>`<label>${label} <output data-env-output="${key}"></output><input data-environment="${key}" type="range" min="0" max="1" step=".01"></label>`).join('')+
 '<button type="button" class="button" data-env-atmosphere></button><button type="button" class="button" data-env-audio aria-pressed="false">♫ Ativar som ambiente</button><p data-env-status role="status">Sons procedurais de vento, folhas e pássaros. O áudio só começa ao clicar.</p>';
 container.append(root);
 const sync=()=>{
  const settings=preview()?.environmentSettings??defaultEnvironment();
  root.querySelectorAll<HTMLInputElement|HTMLSelectElement>('[data-environment]').forEach(input=>{const key=input.dataset.environment as keyof EnvironmentSettings;input.value=String(settings[key]);input.disabled=key==='intensity'&&settings.weather==='clear';});
  root.querySelectorAll<HTMLOutputElement>('[data-env-output]').forEach(output=>{const key=output.dataset.envOutput as 'hour'|'wind'|'intensity'|'volume'|'strength';output.textContent=key==='hour'?`${String(Math.floor(settings.hour)%24).padStart(2,'0')}:${String(Math.floor((settings.hour%1)*60)).padStart(2,'0')}`:`${Math.round(settings[key]*100)}%`;});
  const atmosphere=root.querySelector<HTMLButtonElement>('[data-env-atmosphere]')!;atmosphere.textContent=settings.atmosphere?'✦ Atmosfera visual: ativa':'○ Atmosfera visual: neutra';atmosphere.setAttribute('aria-pressed',String(settings.atmosphere));
  const audio=root.querySelector<HTMLButtonElement>('[data-env-audio]')!,on=preview()?.environmentAudioActive??false;audio.textContent=on?'■ Desativar som ambiente':'♫ Ativar som ambiente';audio.setAttribute('aria-pressed',String(on));
 };
 const apply=(settings:EnvironmentSettings,commit:boolean)=>{if(change)change(settings,commit);else preview()?.setEnvironment(settings);sync();};
 const read=(event:Event)=>{const input=event.target as HTMLInputElement;if(!input.dataset.environment)return;const settings=preview()?.environmentSettings??defaultEnvironment(),key=input.dataset.environment as keyof EnvironmentSettings;apply({...settings,[key]:key==='weather'?input.value:Number(input.value)},event.type==='change');};
 root.addEventListener('input',read);root.addEventListener('change',read);
 root.querySelector<HTMLButtonElement>('[data-env-atmosphere]')!.onclick=()=>{const settings=preview()?.environmentSettings??defaultEnvironment();apply({...settings,atmosphere:!settings.atmosphere},true);};
 root.querySelector<HTMLButtonElement>('[data-env-audio]')!.onclick=async()=>{try{await preview()?.toggleEnvironmentAudio();sync();}catch(e){root.querySelector('[data-env-status]')!.textContent=(e as Error).message;}};
 sync();return {root,sync};
}
