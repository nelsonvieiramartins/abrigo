import {buildWolfSdfData} from './wolf-sdf-detail';
import {validateCreatureSpec} from './creature-schema';
import {transferables} from '../vendor/threejs-procedural-animals/src/core/build/pipeline.js';
self.onmessage=e=>{
  try{const spec=validateCreatureSpec(e.data.spec);if(spec.species!=='wolfSdf'&&spec.species!=='wolfLowpolySdf')throw new Error('Espécie SDF inválida.');const data=buildWolfSdfData(spec,e.data.detail);self.postMessage({data},{transfer:transferables(data)});}
  catch(error){self.postMessage({error:(error as Error).message});}
};
