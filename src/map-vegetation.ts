import * as THREE from 'three';
import {EZ_TREE_VARIANTS,addTreeWind,createAdvancedGrassGeometry,createGrassMaterial} from '../extras/bioma/forest-primitives.js';
import {validateVegetation,type VegetationInstance} from './map-vegetation-data';
import type {CourseCylinder} from './game-course';

// Small decorative stones stay passable; 1.2 m across is a large rock.
export const LARGE_ROCK_DIAMETER=1.2;
export const VEGETATION_CHUNK_SIZE=25;

export function createMapVegetation(parent:THREE.Group,heightAt:(x:number,z:number)=>number,allowed:(x:number,z:number)=>boolean){
 const root=new THREE.Group();root.name='Vegetação massiva — Bioma';parent.add(root);
 let records:VegetationInstance[]=[],disposed=false,revision=0,error='';
 let colliders:CourseCylinder[]=[];
 const uniforms={uTime:{value:0},uWind:{value:.45}},templates=new Map<number,Array<{geometry:THREE.BufferGeometry;material:THREE.Material;height:number;bottom:number}>>();
 const groundResources=new Set<THREE.BufferGeometry|THREE.Material>();
 const grassGeometry=createAdvancedGrassGeometry(),shrubGeometry=createAdvancedGrassGeometry(19);
 const grassMaterial=createGrassMaterial(uniforms);
 const rock=new THREE.IcosahedronGeometry(.72,3),p=rock.attributes.position;
 for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),d=1+Math.sin(x*8+y*5)*.075+Math.cos(z*9-y*4)*.055;p.setXYZ(i,x*d,y*d,z*d);}rock.computeVertexNormals();rock.computeBoundingBox();
 const rockMaterial=new THREE.MeshStandardMaterial({color:'#667064',roughness:.96}),moss=new THREE.SphereGeometry(.53,9,5,0,Math.PI*2,0,Math.PI*.48),mossMaterial=new THREE.MeshStandardMaterial({color:'#58733c',roughness:1});
 [grassGeometry,shrubGeometry,grassMaterial,rock,rockMaterial,moss,mossMaterial].forEach(r=>groundResources.add(r));
 const clearInstances=()=>{root.children.slice().forEach(o=>{if(o instanceof THREE.InstancedMesh)o.dispose();o.removeFromParent();});};
 const buildInstances=()=>{
  clearInstances();const transform=new THREE.Object3D();
  colliders=records.flatMap((v,index)=>{
   if(!allowed(v.x,v.z)||!['tree','rock'].includes(v.kind))return [];
   const bottom=heightAt(v.x,v.z);
   if(v.kind==='rock'){
    const box=rock.boundingBox!,diameter=Math.max(box.max.x-box.min.x,box.max.z-box.min.z)*v.scale;
    if(diameter<LARGE_ROCK_DIAMETER)return [];
    return [{id:`Pedra grande ${index+1}`,x:v.x,z:v.z,radius:diameter*.5,bottom,top:bottom+(box.max.y-box.min.y)*v.scale*.7-.025}];
   }
   const part=templates.get(v.variant)?.[0],height=EZ_TREE_VARIANTS[v.variant].targetHeight*v.scale;
   let radius=.28*v.scale;
   if(part){
    const points=part.geometry.getAttribute('position'),scale=height/part.height;let baseRadius=0;
    for(let i=0;i<points.count;i++)if(points.getY(i)<=part.bottom+part.height*.08)baseRadius=Math.max(baseRadius,Math.hypot(points.getX(i),points.getZ(i)));
    radius=Math.max(.04,baseRadius*scale);
   }
   return [{id:`Árvore ${index+1}`,x:v.x,z:v.z,radius,bottom,top:bottom+height}];
  });
  for(const kind of ['tree','grass','shrub','rock'] as const)for(let variant=0;variant<(kind==='tree'?8:1);variant++){
   const members=records.filter(v=>v.kind===kind&&(kind!=='tree'||v.variant===variant)&&allowed(v.x,v.z));if(!members.length)continue;
   const parts=kind==='tree'?templates.get(variant):kind==='rock'?[{geometry:rock,material:rockMaterial,height:1,bottom:rock.boundingBox!.min.y},{geometry:moss,material:mossMaterial,height:1,bottom:0}]:[{geometry:kind==='grass'?grassGeometry:shrubGeometry,material:grassMaterial,height:1,bottom:0}];if(!parts)continue;
   // Local bounds let Three.js reject off-screen sectors instead of drawing the whole forest.
   const chunks=new Map<string,VegetationInstance[]>();for(const v of members){const key=`${Math.floor(v.x/VEGETATION_CHUNK_SIZE)},${Math.floor(v.z/VEGETATION_CHUNK_SIZE)}`;if(!chunks.has(key))chunks.set(key,[]);chunks.get(key)!.push(v);}
   for(const [chunk,localMembers] of chunks)parts.forEach((part,partIndex)=>{const mesh=new THREE.InstancedMesh(part.geometry,part.material,localMembers.length);mesh.name=kind==='tree'?`EZ ${EZ_TREE_VARIANTS[variant].preset} ${variant+1} · ${partIndex?'folhas':'galhos'}`:`Bioma · ${kind} ${partIndex?'musgo':''}`;mesh.userData.chunk=chunk;
    localMembers.forEach((v,i)=>{const s=kind==='tree'?EZ_TREE_VARIANTS[variant].targetHeight/part.height*v.scale:v.scale;
     transform.position.set(v.x,heightAt(v.x,v.z)-part.bottom*s+(kind==='rock'&&partIndex===1?.62*s:kind==='tree'?-.025:.008),v.z);transform.rotation.set(0,v.rotation,0);transform.scale.setScalar(s);
     if(kind==='rock')transform.scale.set(s,s*(partIndex?.14:.7),s);if(kind==='rock'&&!partIndex)transform.position.y=heightAt(v.x,v.z)-part.bottom*transform.scale.y-.025;
     transform.updateMatrix();mesh.setMatrixAt(i,transform.matrix);mesh.setColorAt(i,new THREE.Color().setHSL(kind==='tree'?(partIndex?.26:.084):kind==='rock'?.29:.28,kind==='rock'?.12:.4,.78+(v.variant/7)*.13));
    });mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.castShadow=kind==='tree'||kind==='rock';mesh.receiveShadow=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();mesh.boundingBox!.expandByScalar(1);mesh.boundingSphere!.radius+=1;root.add(mesh);
   });
  }
 };
 const prepare=async(token:number)=>{try{
  if(!records.some(v=>v.kind==='tree'&&!templates.has(v.variant)))return;
  const {Tree,TreePreset}=await import('@dgreenheck/ez-tree');if(disposed||token!==revision)return;
  for(const index of new Set(records.filter(v=>v.kind==='tree').map(v=>v.variant))){if(templates.has(index))continue;const variant=EZ_TREE_VARIANTS[index],options=structuredClone(TreePreset[variant.preset]);
   options.seed=variant.seed;options.bark.textured=true;options.leaves.roundedNormals=true;options.leaves.count=Math.max(options.leaves.count,variant.preset.startsWith('Aspen')?18:12);options.leaves.size*=variant.preset.startsWith('Ash')?.82:.88;options.leaves.sizeVariance=Math.min(options.leaves.sizeVariance,.58);
   const generator=new Tree();generator.options.copy(options);generator.generate();const branch=generator.branchesMesh.geometry;branch.computeBoundingBox();const height=Math.max(1,branch.boundingBox!.max.y-branch.boundingBox!.min.y),bottom=branch.boundingBox!.min.y;
   const parts=[generator.branchesMesh,generator.leavesMesh].map((m,i)=>{const material=m.material.clone();if(i){material.color.set(variant.leafTint);material.alphaTest=.42;material.side=THREE.DoubleSide;}else material.color.multiply(new THREE.Color('#8a7259'));addTreeWind(material,uniforms,!!i);return {geometry:m.geometry.clone(),material,height,bottom};});templates.set(index,parts);
   [generator.branchesMesh,generator.leavesMesh].forEach(m=>{m.geometry.dispose();m.material.dispose();});
  }if(!disposed&&token===revision){error='';buildInstances();}
 }catch(e){error='Não foi possível gerar as árvores: '+(e as Error).message;}};
 return {root,get colliders(){return colliders;},get error(){return error;},set(value:VegetationInstance[]){records=validateVegetation(value);buildInstances();void prepare(++revision);},snapshot:()=>structuredClone(records),settle(){buildInstances();},update(time:number,wind=.45){uniforms.uTime.value=time;uniforms.uWind.value=wind;},dispose(){if(disposed)return;disposed=true;revision++;colliders=[];clearInstances();templates.forEach(parts=>parts.forEach(p=>{p.geometry.dispose();p.material.dispose();}));groundResources.forEach(r=>r.dispose());root.removeFromParent();}};
}
