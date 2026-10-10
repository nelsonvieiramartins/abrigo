export const ENVIRONMENT_WEATHERS={clear:'☀️ Céu limpo',rain:'🌧️ Chuva',snow:'❄️ Neve',fog:'🌫️ Neblina'};
export type EnvironmentSettings={wind:number;hour:number;weather:keyof typeof ENVIRONMENT_WEATHERS;intensity:number;volume:number;strength:number;atmosphere:boolean};
export const defaultEnvironment=():EnvironmentSettings=>({wind:.45,hour:10.08,weather:'clear',intensity:.65,volume:.55,strength:.55,atmosphere:true});
export function validateEnvironment(raw:any):EnvironmentSettings{
 if(!raw||!Object.hasOwn(ENVIRONMENT_WEATHERS,raw.weather)||typeof raw.atmosphere!=='boolean')throw Error('Ambiente inválido.');
 for(const [key,max] of [['wind',1],['hour',24],['intensity',1],['volume',1],['strength',1]] as const)if(!Number.isFinite(raw[key])||raw[key]<0||raw[key]>max)throw Error('Ajuste de ambiente inválido: '+key);
 return {wind:raw.wind,hour:raw.hour,weather:raw.weather,intensity:raw.intensity,volume:raw.volume,strength:raw.strength,atmosphere:raw.atmosphere};
}
