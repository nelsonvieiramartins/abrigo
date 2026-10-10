import {build} from 'esbuild';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
await mkdir('dist',{recursive:true});
// Inline worker source also works from the standalone file:// editor, without
// fetching a worker URL or depending on GitHub Pages' deployment base path.
const worker=await build({entryPoints:['src/boar-worker.ts'],bundle:true,write:false,format:'iife',target:'es2022',minify:true,legalComments:'inline',define:{__BOAR_WORKER_SOURCE__:'undefined'},logOverride:{'empty-import-meta':'silent'}});
const wolfWorker=await build({entryPoints:['src/wolf-sdf-worker.ts'],bundle:true,write:false,format:'iife',target:'es2022',minify:true,legalComments:'inline',define:{__WOLF_SDF_WORKER_SOURCE__:'undefined'},logOverride:{'empty-import-meta':'silent'}});
const ratWorker=await build({entryPoints:['src/rat-sdf-worker.ts'],bundle:true,write:false,format:'iife',target:'es2022',minify:true,legalComments:'inline',define:{__RAT_SDF_WORKER_SOURCE__:'undefined'},logOverride:{'empty-import-meta':'silent'}});
const werewolfWorker=await build({entryPoints:['src/werewolf-sdf-worker.ts'],bundle:true,write:false,format:'iife',target:'es2022',minify:true,legalComments:'inline',define:{__WEREWOLF_SDF_WORKER_SOURCE__:'undefined'},logOverride:{'empty-import-meta':'silent'}});
const tarantulaWorker=await build({entryPoints:['src/tarantula-sdf-worker.ts'],bundle:true,write:false,format:'iife',target:'es2022',minify:true,legalComments:'inline',define:{__TARANTULA_SDF_WORKER_SOURCE__:'undefined'},logOverride:{'empty-import-meta':'silent'}});
const define={__WEREWOLF_SDF_WORKER_SOURCE__:JSON.stringify(werewolfWorker.outputFiles[0].text),__TARANTULA_SDF_WORKER_SOURCE__:JSON.stringify(tarantulaWorker.outputFiles[0].text),__BOAR_WORKER_SOURCE__:JSON.stringify(worker.outputFiles[0].text),__WOLF_SDF_WORKER_SOURCE__:JSON.stringify(wolfWorker.outputFiles[0].text),__RAT_SDF_WORKER_SOURCE__:JSON.stringify(ratWorker.outputFiles[0].text)};
const result=await build({entryPoints:['src/main.ts'],bundle:true,write:false,format:'iife',target:'es2022',minify:true,legalComments:'inline',define,logOverride:{'empty-import-meta':'silent'}});
const quarksLicense=await readFile('node_modules/three.quarks/LICENSE','utf8');
const treeLicense=await readFile('node_modules/@dgreenheck/ez-tree/LICENSE','utf8');
const code=('/*! three.quarks 0.16.0\n'+quarksLicense+'\n*/\n/*! EZ-Tree 1.1.0\n'+treeLicense+'\n*/\n'+result.outputFiles[0].text).replaceAll('</script','<\\/script');
const css=await readFile('src/style.css','utf8');
const template=await readFile('index.html','utf8');
const html=template.replace('<link rel="stylesheet" href="./src/style.css">',()=>`<style>${css}</style>`).replace('<script type="module" src="./src/main.ts"></script>',()=>`<script>${code}</script>`);
await writeFile('dist/ABRIR_EDITOR.html',html);
await writeFile('dist/index.html',html);
await writeFile('ABRIR_EDITOR.html',html);
await build({entryPoints:['src/api.ts'],outfile:'dist/character.module.js',bundle:true,format:'esm',target:'es2022',external:['three'],sourcemap:true,define});
console.log('Editor offline: dist/ABRIR_EDITOR.html');
console.log('Módulo de integração: dist/character.module.js');
