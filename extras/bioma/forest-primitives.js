import * as THREE from 'three';
export function createGroundTextures(random, anisotropy=8) {
  const rand=(min,max)=>min+random()*(max-min);
  const size = 768;
  const colorCanvas = document.createElement('canvas');
  const bumpCanvas = document.createElement('canvas');
  colorCanvas.width = colorCanvas.height = bumpCanvas.width = bumpCanvas.height = size;
  const colorCtx = colorCanvas.getContext('2d');
  const bumpCtx = bumpCanvas.getContext('2d');
  colorCtx.fillStyle = '#75865a'; colorCtx.fillRect(0,0,size,size);
  bumpCtx.fillStyle = '#777'; bumpCtx.fillRect(0,0,size,size);
  for (let i = 0; i < 16000; i++) {
    const x = rand(0,size), y = rand(0,size), radius = rand(.35,3.5);
    const green = Math.floor(rand(48,112));
    colorCtx.fillStyle = `rgba(${Math.floor(green*.72)},${green},${Math.floor(green*.5)},${rand(.08,.34)})`;
    colorCtx.beginPath(); colorCtx.arc(x,y,radius,0,Math.PI*2); colorCtx.fill();
    const gray = Math.floor(rand(65,190));
    bumpCtx.fillStyle = `rgba(${gray},${gray},${gray},${rand(.12,.5)})`;
    bumpCtx.beginPath(); bumpCtx.arc(x,y,radius*.7,0,Math.PI*2); bumpCtx.fill();
  }
  for (let i = 0; i < 340; i++) {
    const x = rand(0,size), y = rand(0,size);
    colorCtx.strokeStyle = `rgba(44,58,32,${rand(.12,.3)})`;
    colorCtx.lineWidth = rand(.5,2);
    colorCtx.beginPath(); colorCtx.moveTo(x,y); colorCtx.lineTo(x+rand(-12,12),y+rand(-12,12)); colorCtx.stroke();
  }
  const colorMap = new THREE.CanvasTexture(colorCanvas);
  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  for (const texture of [colorMap,bumpMap]) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(26,26);
    texture.anisotropy = anisotropy;
  }
  return { colorMap, bumpMap };
}

export function createGrassMaterial(uniforms){
const material = new THREE.MeshStandardMaterial({
  color: '#d8e5b5',
  vertexColors: true,
  roughness: 1,
  side: THREE.DoubleSide,
});
material.onBeforeCompile = shader => {
  shader.uniforms.uTime = uniforms.uTime;
  shader.uniforms.uWind = uniforms.uWind;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `
      #include <common>
      uniform float uTime;
      uniform float uWind;
      attribute float aBladeLevel;
      attribute float aBladePhase;
    `)
    .replace('#include <begin_vertex>', `
      vec3 transformed = vec3(position);
      float worldX = instanceMatrix[3].x;
      float worldZ = instanceMatrix[3].z;
      float fieldPhase = worldX * .135 + worldZ * .108 + aBladePhase;
      float broadWave = sin(uTime * 1.38 + fieldPhase);
      float crossWave = cos(uTime * 1.04 + worldX * .071 - worldZ * .164 + aBladePhase * .63);
      float gust = sin(uTime * .36 + worldX * .026 + worldZ * .021) * .5 + .5;
      float flexibility = pow(max(aBladeLevel, 0.0), 1.55);
      transformed.x += (broadWave * .15 + crossWave * .055) * uWind * flexibility * (0.65 + gust * .55);
      transformed.z += (crossWave * .09 + broadWave * .035) * uWind * flexibility;
      transformed.y -= abs(broadWave) * .025 * uWind * flexibility;
    `);
};

 material.customProgramCacheKey=()=> 'bioma-map-grass-v1';
 return material;
}
// Extracted from the local bioma project; geometry, presets and wind formulas preserved.
export const EZ_TREE_VARIANTS = [
  { preset: 'Oak Large', targetHeight: 9.0, seed: 23399, leafTint: '#88aa68' },
  { preset: 'Oak Large', targetHeight: 8.5, seed: 48117, leafTint: '#719454' },
  { preset: 'Oak Medium', targetHeight: 7.8, seed: 15473, leafTint: '#9bb878' },
  { preset: 'Ash Large', targetHeight: 9.7, seed: 29919, leafTint: '#86a969' },
  { preset: 'Ash Medium', targetHeight: 8.6, seed: 62011, leafTint: '#a3bd7d' },
  { preset: 'Ash Medium', targetHeight: 8.2, seed: 37139, leafTint: '#759b5d' },
  { preset: 'Aspen Large', targetHeight: 10.2, seed: 30631, leafTint: '#a8bf79' },
  { preset: 'Aspen Medium', targetHeight: 9.1, seed: 54721, leafTint: '#91ae68' },
];

export function addTreeWind(material, ezWindUniforms, canopy = false) {
  material.onBeforeCompile = shader => {
    shader.uniforms.uTime = ezWindUniforms.uTime;
    shader.uniforms.uWind = ezWindUniforms.uWind;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime;
        uniform float uWind;
      `)
      .replace('#include <begin_vertex>', `
        vec3 transformed = vec3(position);
        float treePhase = 0.0;
        #ifdef USE_INSTANCING
          treePhase = instanceMatrix[3].x * 0.127 + instanceMatrix[3].z * 0.173;
        #endif
        float heightFlex = pow(clamp(position.y / 52.0, 0.0, 1.0), 1.45);
        float gustEnvelope = 0.68 + 0.32 * sin(uTime * 0.31 + treePhase * 0.41);
        float broadWind = sin(uTime * 0.72 + treePhase) * 0.62;
        float branchWind = sin(uTime * 1.37 + treePhase * 1.61 + position.y * 0.075) * 0.25;
        ${canopy ? `
          float leafFlutter = sin(uTime * 5.8 + treePhase * 2.3 + position.x * 0.31 + uv.y * 5.0) * 0.13;
          transformed.x += (broadWind + branchWind + leafFlutter) * uWind * heightFlex * 2.4 * gustEnvelope;
          transformed.z += cos(uTime * 0.91 + treePhase * 0.73 + position.y * 0.052) * uWind * heightFlex * 1.25;
          transformed.y += leafFlutter * uWind * (0.11 + uv.y * 0.16);
        ` : `
          transformed.x += (broadWind + branchWind) * uWind * heightFlex * 1.35 * gustEnvelope;
          transformed.z += cos(uTime * 0.91 + treePhase * 0.73) * uWind * heightFlex * 0.62;
        `}
      `);
  };
  material.customProgramCacheKey = () => canopy ? 'ez-tree-canopy-v4' : 'ez-tree-bark-v4';
  material.needsUpdate = true;
}

export function createAdvancedGrassGeometry(bladeCount = 13) {
  const positions = [];
  const colors = [];
  const levels = [];
  const phases = [];
  const indices = [];
  const rootColor = new THREE.Color('#304b27');
  const middleColor = new THREE.Color('#668444');
  const tipColor = new THREE.Color('#a8ba64');

  for (let blade = 0; blade < bladeCount; blade++) {
    const angle = blade * 2.399963 + Math.sin(blade * 5.17) * .26;
    const radius = .035 + (blade % 5) * .032;
    const centerX = Math.cos(angle) * radius;
    const centerZ = Math.sin(angle) * radius;
    const width = .075 + (blade % 4) * .012;
    const height = .62 + (blade % 6) * .105 + Math.sin(blade * 2.4) * .06;
    const leftX = Math.cos(angle) * width * .5;
    const leftZ = Math.sin(angle) * width * .5;
    const bendAngle = angle + .8 + Math.sin(blade * 3.1) * .7;
    const bend = .08 + (blade % 3) * .035;
    const midX = centerX + Math.cos(bendAngle) * bend * .22;
    const midZ = centerZ + Math.sin(bendAngle) * bend * .22;
    const tipX = centerX + Math.cos(bendAngle) * bend;
    const tipZ = centerZ + Math.sin(bendAngle) * bend;
    const offset = positions.length / 3;

    positions.push(
      centerX + leftX, 0, centerZ + leftZ,
      centerX - leftX, 0, centerZ - leftZ,
      midX + leftX * .56, height * .52, midZ + leftZ * .56,
      midX - leftX * .56, height * .52, midZ - leftZ * .56,
      tipX, height, tipZ,
    );
    for (const color of [rootColor, rootColor, middleColor, middleColor, tipColor]) {
      colors.push(color.r, color.g, color.b);
    }
    levels.push(0, 0, .52, .52, 1);
    const phase = blade * 1.618 + Math.sin(blade * 4.3);
    phases.push(phase, phase, phase, phase, phase);
    indices.push(
      offset, offset + 1, offset + 2,
      offset + 1, offset + 3, offset + 2,
      offset + 2, offset + 3, offset + 4,
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('aBladeLevel', new THREE.Float32BufferAttribute(levels, 1));
  geometry.setAttribute('aBladePhase', new THREE.Float32BufferAttribute(phases, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
