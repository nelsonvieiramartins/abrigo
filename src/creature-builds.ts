import type {CreatureSpecies} from './creature-schema';

// Integration identity is separate from the upstream package version.
export const FAUNA_PROCEDURAL_SDF = Object.freeze({
  id:'fauna-procedural-sdf',
  name:'Fauna Procedural — SDF',
  integrationVersion:1,
  source:'threejs-procedural-animals',
  sourcePackage:'procedural-animals',
  sourceVersion:'0.1.0',
  sourceCommit:'c95ae49346aa8e140a924376cec6cf0073d99512',
  sourceUrl:'https://github.com/majidmanzarpour/threejs-procedural-animals',
  license:'MIT',
} as const);
export type CreatureBuild = typeof FAUNA_PROCEDURAL_SDF;
export const CREATURE_BUILDS = Object.freeze({[FAUNA_PROCEDURAL_SDF.id]:FAUNA_PROCEDURAL_SDF});
// Register only species actually routed through this generator, not similar animals.
export const CREATURE_BUILD_BY_SPECIES:Readonly<Partial<Record<CreatureSpecies,CreatureBuild['id']>>> = Object.freeze({werewolfSdf:FAUNA_PROCEDURAL_SDF.id,tarantulaSdf:FAUNA_PROCEDURAL_SDF.id,boar:FAUNA_PROCEDURAL_SDF.id,ratSdf:FAUNA_PROCEDURAL_SDF.id,wolfLowpolySdf:FAUNA_PROCEDURAL_SDF.id,wolfSdf:FAUNA_PROCEDURAL_SDF.id});
export function getCreatureBuild(species:CreatureSpecies):CreatureBuild|undefined {
  const id=CREATURE_BUILD_BY_SPECIES[species];
  return id?CREATURE_BUILDS[id]:undefined;
}
export function creatureBuildStamp(species:CreatureSpecies):CreatureBuild|undefined {
  const build=getCreatureBuild(species);
  return build?{...build}:undefined;
}
