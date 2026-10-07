import {buildWerewolfSdfData} from './werewolf-sdf-detail';
import {validateCreatureSpec} from './creature-schema';
import {transferables} from '../vendor/threejs-procedural-animals/src/core/build/pipeline.js';
self.onmessage=e=>{try{const spec=validateCreatureSpec(e.data.spec);if(spec.species!=='werewolfSdf')throw Error('Espécie SDF inválida.');const data=buildWerewolfSdfData(spec,e.data.detail);self.postMessage({data},{transfer:transferables(data)});}catch(error){self.postMessage({error:(error as Error).message});}};
