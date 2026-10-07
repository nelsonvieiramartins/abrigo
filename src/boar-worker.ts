import {buildBoarData} from './boar-detail';
import {validateCreatureSpec} from './creature-schema';
import {transferables} from '../vendor/threejs-procedural-animals/src/core/build/pipeline.js';
self.onmessage=e=>{
  try{const data=buildBoarData(validateCreatureSpec(e.data.spec),e.data.detail);self.postMessage({data},{transfer:transferables(data)});}
  catch(error){self.postMessage({error:(error as Error).message});}
};
