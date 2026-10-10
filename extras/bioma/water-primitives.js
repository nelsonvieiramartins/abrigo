import * as THREE from 'three';

// ------------------------------------------------------------
// ÁGUA
//
// Adaptação das técnicas de https://github.com/stas4000/luminous-lake
// para o bioma. Aquele projeto também não tem um único asset binário —
// céu, normais, brilhos e névoa são todos gerados em canvas — então ele
// é compatível com a regra 1 deste projeto sem precisar de exceção.
//
// O QUE VEIO DE LÁ
//
//   1. Campo de ondas soma-de-senos DETERMINÍSTICO, único, compartilhado
//      por tudo que flutua. É a mesma ideia que `terrainHeight(x,z)` já é
//      para o chão: uma fonte de verdade só. Um barco, um pato ou uma
//      folha boiando leem a MESMA função que a malha desloca, então não
//      existe objeto afundado num pico de onda.
//   2. Normal map de DUPLO SCROLL, duas amostras da mesma textura
//      correndo em escalas e velocidades diferentes. Mata o padrão
//      repetido que uma única camada sempre entrega.
//   3. Reflexão por CubeCamera viva, com atualização espaçada, em vez do
//      Reflector por espelho d'água.
//   4. Comportamento por PROFUNDIDADE: água calma e rasa deixa ver o
//      leito; água agitada fica leitosa, como um lago de verdade.
//
// O QUE É DAQUI
//
//   - o recorte irregular dos lagos, que já existia e que as margens de
//     lama continuam acompanhando;
//   - a espuma de beira, presa à profundidade e não a uma máscara;
//   - o acoplamento ao vento do painel;
//   - os anéis de impacto, que a chuva vai usar e que já servem para
//     flechas e objetos caindo na água.
// ------------------------------------------------------------

// ------------------------------------------------------------
// O CAMPO DE ONDAS
//
// Uma tabela só, em JS. O GLSL é GERADO a partir dela mais abaixo — não
// existe uma segunda cópia destes números dentro de uma string de
// shader, e portanto não existe como as duas discordarem. É o erro mais
// fácil de cometer num sistema assim e o mais difícil de enxergar: a
// malha ondula de um jeito e o barco sobe de outro.
//
// `dir` é a direção de propagação (normalizada), `freq` o número de onda
// em radianos por metro, `amp` a amplitude em metros com vento médio e
// `speed` a velocidade angular.
// ------------------------------------------------------------
const WAVES = [
  { dx:  1.000, dz:  0.160, freq: 0.62, amp: 0.074, speed: 0.95 },
  { dx: -0.420, dz:  0.910, freq: 0.94, amp: 0.046, speed: 1.31 },
  { dx:  0.730, dz: -0.680, freq: 1.71, amp: 0.022, speed: 1.86 },
  { dx: -0.880, dz: -0.470, freq: 2.95, amp: 0.010, speed: 2.54 },
];

/**
 * Quanto o vento pesa em cada onda.
 *
 * Não é um multiplicador único. Vento não levanta a ondulação longa e a
 * marulhada curta na mesma proporção — ele pica a superfície primeiro, e
 * só depois levanta o corpo da onda. Por isso o termo de frequência: as
 * ondas curtas ganham mais com vento do que as longas, que é o que faz
 * um lago passar de espelhado a rugoso antes de passar a ondulado.
 */
const windGain = (wave, wind) => (.34 + .66 * wind) * (1 + wind * wave.freq * .34);

/** A altura da superfície em (x, z) no instante t. Metros, mundo. */
export function waveAt(x, z, time, wind = .45) {
  let height = 0;
  for (const wave of WAVES) {
    height += wave.amp * windGain(wave, wind)
      * Math.sin((x * wave.dx + z * wave.dz) * wave.freq + time * wave.speed);
  }
  return height;
}

/** A normal da superfície no mesmo ponto — derivada exata, não diferença finita. */
export function waveNormalAt(x, z, time, wind = .45, out = new THREE.Vector3()) {
  let dx = 0;
  let dz = 0;
  for (const wave of WAVES) {
    const amplitude = wave.amp * windGain(wave, wind);
    const phase = (x * wave.dx + z * wave.dz) * wave.freq + time * wave.speed;
    const slope = amplitude * wave.freq * Math.cos(phase);
    dx += slope * wave.dx;
    dz += slope * wave.dz;
  }
  return out.set(-dx, 1, -dz).normalize();
}

// ------------------------------------------------------------
// GERAÇÃO DO GLSL A PARTIR DA MESMA TABELA
// ------------------------------------------------------------
const f = n => (Number.isInteger(n) ? n.toFixed(1) : String(n));

export const GLSL_WAVES = `
float windGain(float freq, float wind) {
  return (0.34 + 0.66 * wind) * (1.0 + wind * freq * 0.34);
}

float waveHeight(vec2 p, float t, float wind) {
  float h = 0.0;
${WAVES.map(w => `  h += ${f(w.amp)} * windGain(${f(w.freq)}, wind) * sin(dot(p, vec2(${f(w.dx)}, ${f(w.dz)})) * ${f(w.freq)} + t * ${f(w.speed)});`).join('\n')}
  return h;
}

vec3 waveNormal(vec2 p, float t, float wind) {
  float dx = 0.0;
  float dz = 0.0;
  float s;
${WAVES.map(w => `  s = ${f(w.amp)} * windGain(${f(w.freq)}, wind) * ${f(w.freq)} * cos(dot(p, vec2(${f(w.dx)}, ${f(w.dz)})) * ${f(w.freq)} + t * ${f(w.speed)});
  dx += s * ${f(w.dx)}; dz += s * ${f(w.dz)};`).join('\n')}
  return normalize(vec3(-dx, 1.0, -dz));
}
`;

// Quantos impactos simultâneos a superfície guarda. A chuva vai reciclar
// este mesmo anel de buffer; por ora já serve para flecha e objeto.
const MAX_DROPS = 14;

const GLSL_DROPS = `
uniform vec4 uDrops[${MAX_DROPS}];

// Um impacto é um anel que se afasta e morre. Duas exponenciais: uma no
// raio, porque a energia se espalha por um perímetro cada vez maior, e
// outra no tempo, porque a viscosidade come o resto.
float dropHeight(vec2 p, float t) {
  float h = 0.0;
  for (int i = 0; i < ${MAX_DROPS}; i++) {
    vec4 drop = uDrops[i];
    if (drop.w <= 0.0) continue;
    float age = t - drop.z;
    if (age < 0.0 || age > 2.2) continue;
    float d = distance(p, drop.xy);
    float ring = sin(d * 13.0 - age * 11.0);
    h += ring * exp(-d * 1.25) * exp(-age * 2.1) * drop.w * 0.055;
  }
  return h;
}
`;

// ------------------------------------------------------------
// TEXTURA DE NORMAIS
// ------------------------------------------------------------
export function createNormalTexture(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(size, size);

  // Campo de inclinações pseudo-aleatório mas PERIÓDICO: as senóides
  // usam múltiplos inteiros de 2π/size, então a textura fecha consigo
  // mesma e o RepeatWrapping não deixa costura visível.
  const k = (2 * Math.PI) / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const nx =
        Math.sin(x * k * 7 + Math.sin(y * k * 3) * 2.1) * .55 +
        Math.sin(x * k * 13 - y * k * 5) * .3 +
        Math.sin((x + y) * k * 19) * .15;
      const nz =
        Math.cos(y * k * 6 + Math.sin(x * k * 4) * 1.8) * .55 +
        Math.cos(y * k * 11 + x * k * 7) * .3 +
        Math.cos((y - x) * k * 17) * .15;
      image.data[i] = 128 + nx * 74;
      image.data[i + 1] = 128 + nz * 74;
      image.data[i + 2] = 255;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// ------------------------------------------------------------

