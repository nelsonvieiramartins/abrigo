import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
await mkdir('.test',{recursive:true});
for(const suite of process.argv.includes('--game-map')?['game-map']:process.argv.includes('--creature-categories')?['creature-categories']:process.argv.includes('--wolf-lowpoly-sdf')?['wolf-lowpoly-sdf']:process.argv.includes('--werewolf-sdf')?['werewolf-sdf']:process.argv.includes('--tarantula-sdf')?['tarantula-sdf']:process.argv.includes('--rat-sdf')?['rat-sdf']:process.argv.includes('--wolf-sdf')?['wolf-sdf']:process.argv.includes('--boar')?['boar']:process.argv.includes('--game-combat')?['game-combat']:process.argv.includes('--creatures')?['creatures']:process.argv.includes('--objects')?['objects']:process.argv.includes('--zombie')?['zombie']:process.argv.includes('--items')?['items']:process.argv.includes('--game-controls')?['game-controls']:process.argv.includes('--game-wood')?['game-wood']:['objects','creatures','zombie','items','game-controls','game-wood','game-map','game-combat','core']){
  await build({entryPoints:[`tests/${suite}.ts`],outfile:`.test/${suite}.mjs`,bundle:true,platform:'node',format:'esm',external:['three']});
  process.stdout.write(execFileSync(process.execPath,[`.test/${suite}.mjs`],{encoding:'utf8'}));
}
