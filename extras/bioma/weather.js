import * as THREE from 'three';

// ------------------------------------------------------------
// CLIMA
//
// Técnicas adaptadas de https://github.com/new-tonAA/PCG (`js/weather.js`,
// MIT declarada no README). Aquele projeto é "pure frontend", sem
// `npm install` e sem asset nenhum — as partículas são geradas por
// código, então ele entra aqui sem exceção à regra 1.
//
// O QUE VEIO DE LÁ
//
//   1. Campo de partículas em `THREE.Points` com a queda inteira feita
//      no VERTEX SHADER e o laço fechado por `mod()`. A CPU nunca toca
//      numa gota: o atributo de posição é escrito uma vez e nunca mais.
//   2. Atributos por partícula (`aSpeed`, `aOffset`) para dessincronizar
//      a chuva — sem isso ela cai em fileiras.
//   3. Desvanecimento no topo e na base do volume, por `smoothstep`, em
//      vez de as gotas aparecerem e sumirem do nada.
//   4. Gota como retângulo (descarte por `gl_PointCoord`) e floco como
//      disco macio.
//   5. Névoa e cor do céu mudando com o estado.
//   6. Acúmulo no chão por mistura no shader do terreno.
//
// O QUE FOI MUDADO, E POR QUÊ
//
//   - A caixa de partículas deles é ESTÁTICA na origem. Aqui o jogador
//     anda por um mundo de 164 m: a caixa segue o jogador, e o laço é
//     fechado em MUNDO, não em espaço local, senão as gotas ficariam
//     presas à câmera como respingos num para-brisa.
//   - `clear()` deles faz `scene.fog = null`. Isto apagaria a névoa do
//     bioma e brigaria com o ciclo de horário. Aqui o clima SOMA sobre
//     uma base que o ciclo publica; ele nunca escreve o valor final
//     sozinho.
//   - Trocar de clima lá reconstrói a geometria. Aqui as duas malhas
//     nascem uma vez, no tamanho máximo, e a intensidade é um uniforme
//     — trocar de clima no meio do jogo não aloca nada.
//   - Transição contínua, para o controle funcionar como o de horário.
//
// O QUE É DAQUI
//
//   - o acoplamento à água (`setRain` e os anéis de impacto já
//     existiam, à espera disto desde a v0.25.0);
//   - o empurrão no vento, que move grama, árvores e o som ambiente;
//   - a neve acumulando pela normal do terreno.
// ------------------------------------------------------------

export const WEATHERS = [
  { id: 'clear', label: 'Céu limpo', icon: '☀️' },
  { id: 'rain', label: 'Chuva', icon: '🌧️' },
  { id: 'snow', label: 'Neve', icon: '❄️' },
  { id: 'fog', label: 'Neblina', icon: '🌫️' },
];

// Como cada clima desloca a atmosfera BASE que o ciclo de horário
// publica. Nada aqui é um valor final — são todos deslocamentos.
// `fallRain`/`fallSnow` são o que CAI DO CÉU. `water` é o quanto a
// superfície do lago é agitada — e são coisas diferentes: uma nevada
// deixa a água leitosa sem uma única gota de chuva. Usar o mesmo número
// para os dois fazia a neve acender o campo de chuva junto, e o que caía
// na tela era granizo.
const PROFILES = {
  clear: { fog: 0,    sky: null,     sun: 1,   wind: 0,    fallRain: 0, fallSnow: 0, water: 0,   wet: 0,   snow: 0, exposure: 1 },
  rain:  { fog: .016, sky: 0x55606b, sun: .52, wind: .35,  fallRain: 1, fallSnow: 0, water: 1,   wet: 1,   snow: 0, exposure: .78 },
  snow:  { fog: .013, sky: 0xc6cdd6, sun: .66, wind: .18,  fallRain: 0, fallSnow: 1, water: .25, wet: .2,  snow: 1, exposure: .94 },
  fog:   { fog: .034, sky: 0x8d9a94, sun: .58, wind: -.12, fallRain: 0, fallSnow: 0, water: 0,   wet: .25, snow: 0, exposure: .86 },
};

const MAX_RAIN = 7000;
const MAX_SNOW = 4500;
const BOUNDS = 46;

// ------------------------------------------------------------
// SHADERS
//
// A queda inteira acontece aqui. `uCenter` é onde o jogador está, e o
// laço é fechado em torno dele nos três eixos — é isso que mantém as
// gotas ancoradas no MUNDO enquanto a caixa acompanha quem anda.
// ------------------------------------------------------------
/**
 * QUANTO A PARTÍCULA JÁ CAIU desde que entrou pelo topo, em metros.
 *
 * Uma expressão só, usada pelos dois shaders — chuva e neve não podem
 * discordar sobre para que lado é baixo.
 *
 * O SINAL IMPORTA, e foi onde esteve o erro da v0.28.0. A primeira
 * versão escreveu:
 *
 *     float fall = mod(pos.y - uTime * velocidade, uBounds);
 *     pos.y = top - fall;
 *
 * `mod()` devolve sempre algo em [0, bounds). Com `- uTime` o argumento
 * DIMINUI, então `fall` diminui, e `top - fall` SOBE: chuva e neve
 * subindo do chão para o céu. (No original do PCG a conta fecha porque
 * lá a posição é `t - bounds*0.5`, somando em vez de subtrair — inverter
 * a referência para o topo sem inverter o sinal foi o que quebrou.)
 *
 * Com `+ uTime`, `fall` cresce, `top - fall` desce, e chove para baixo.
 */
const FALL_GLSL = 'mod(uTime * uFallSpeed + pos.y, uBounds)';

/** O mesmo cálculo em JS, para a suíte conseguir provar a direção. */
export function fallenBy(seedY, time, speed, bounds) {
  return (((time * speed + seedY) % bounds) + bounds) % bounds;
}

/** A altura da partícula: nasce no topo e desce. */
export const heightOfFall = (top, fallen) => top - fallen;

export const SHADER_FALL_EXPRESSION = FALL_GLSL;

const WRAP = `
  uniform float uTime;
  uniform float uBounds;
  uniform vec3 uCenter;
  uniform float uAmount;
  uniform float uWind;
  uniform float uPixelRatio;
  attribute float aSpeed;
  attribute float aOffset;
  varying float vAlpha;

  // Traz um ponto fixo do mundo para dentro da caixa que segue o
  // jogador. Sem isto, ou as gotas grudam na câmera (se a caixa for
  // local) ou some a chuva assim que se anda (se a caixa for fixa).
  float wrapAround(float v, float centre, float size) {
    return centre + mod(v - centre + size * .5, size) - size * .5;
  }
`;

const rainVertex = `
  ${WRAP}
  void main() {
    // A intensidade não reconstrói nada: as partículas de sobra são
    // jogadas para fora do frustum e o rasterizador nem as vê.
    if (aOffset > uAmount) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      vAlpha = 0.0;
      return;
    }

    vec3 pos = position;
    pos.x = wrapAround(pos.x, uCenter.x, uBounds);
    pos.z = wrapAround(pos.z, uCenter.z, uBounds);

    float top = uCenter.y + uBounds * .62;
    float uFallSpeed = 9.0 + aSpeed * 7.0;
    float fall = ${FALL_GLSL};
    pos.y = top - fall;

    // O vento inclina a chuva, e inclina mais quanto mais alto — é a
    // diferença entre chuva e chuveiro.
    float height = (pos.y - uCenter.y + uBounds * .38) / uBounds;
    pos.x += uWind * height * 9.0 + sin(uTime * .7 + aOffset * 6.28) * uWind * 1.6;

    vAlpha = smoothstep(0.0, .18, fall / uBounds) * smoothstep(1.0, .82, fall / uBounds);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    // Ortográfica: -mv.z não serve de distância como numa perspectiva.
    // O tamanho é fixo em pixels, que é o que uma gota deve ser.
    gl_PointSize = uPixelRatio * (3.0 + aSpeed * 2.0);
  }
`;

const rainFragment = `
  varying float vAlpha;
  uniform float uOpacity;
  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    // Risco vertical, não bolinha: é o rastro que o olho lê como chuva.
    if (abs(uv.x) > 0.16) discard;
    gl_FragColor = vec4(0.72, 0.80, 0.92, vAlpha * uOpacity * .55);
  }
`;

const snowVertex = `
  ${WRAP}
  attribute float aSize;
  void main() {
    if (aOffset > uAmount) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      vAlpha = 0.0;
      return;
    }

    vec3 pos = position;
    pos.x = wrapAround(pos.x, uCenter.x, uBounds);
    pos.z = wrapAround(pos.z, uCenter.z, uBounds);

    float top = uCenter.y + uBounds * .62;
    float uFallSpeed = 1.1 + aSpeed * 1.5;
    float fall = ${FALL_GLSL};
    pos.y = top - fall;

    // O floco não cai: ele vagueia. Duas senóides fora de fase em x e z
    // bastam para o olho ler flutuação em vez de queda.
    pos.x += sin(uTime * .8 + aOffset * 6.28) * 1.3 + uWind * fall * .22;
    pos.z += cos(uTime * .6 + aOffset * 3.14) * 1.1;

    vAlpha = smoothstep(0.0, .16, fall / uBounds) * smoothstep(1.0, .84, fall / uBounds);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixelRatio;
  }
`;

const snowFragment = `
  varying float vAlpha;
  uniform float uOpacity;
  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float a = 1.0 - d * 2.0;
    gl_FragColor = vec4(1.0, 1.0, 1.0, a * a * vAlpha * uOpacity * .85);
  }
`;

// Expostos para a suíte conseguir afirmar que os shaders usam MESMO a
// expressão de queda declarada acima, em vez de uma cópia divergente.
export const SHADER_SOURCES = { rainVertex, snowVertex };

// ------------------------------------------------------------
function buildField(count, { vertexShader, fragmentShader, sized = false }) {
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  const offsets = new Float32Array(count);
  const sizes = sized ? new Float32Array(count) : null;

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - .5) * BOUNDS;
    positions[i * 3 + 1] = Math.random() * BOUNDS;
    positions[i * 3 + 2] = (Math.random() - .5) * BOUNDS;
    speeds[i] = Math.random();
    // `aOffset` faz dois papéis: dessincroniza a queda E decide quais
    // partículas existem em cada intensidade. Como é uniforme em 0..1,
    // comparar com a intensidade dá exatamente a fração pedida.
    offsets[i] = Math.random();
    if (sizes) sizes[i] = 2.2 + Math.random() * 4.4;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
  geometry.setAttribute('aOffset', new THREE.BufferAttribute(offsets, 1));
  if (sizes) geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uBounds: { value: BOUNDS },
      uCenter: { value: new THREE.Vector3() },
      uAmount: { value: 0 },
      uOpacity: { value: 0 },
      uWind: { value: 0 },
      // `globalThis.devicePixelRatio` e não `devicePixelRatio` solto: a
      // suíte roda este módulo fora do navegador, e um identificador
      // global inexistente é ReferenceError, não `undefined`.
      uPixelRatio: { value: Math.min(globalThis.devicePixelRatio ?? 1, 2) },
    },
    transparent: true,
    depthWrite: false,
    fog: false,
  });

  const points = new THREE.Points(geometry, material);
  // A caixa acompanha o jogador e o wrap é feito no shader — o volume
  // real não é o da bounding box que o Three calcularia.
  points.frustumCulled = false;
  points.renderOrder = 5;
  points.visible = false;
  return points;
}

// ------------------------------------------------------------
export function createWeatherSystem({
  scene,
  sun,
  renderer,
  terrainMaterial,
  follow,
  water = null,
  onWind = null,
  baseFogDensity = .0075,
}) {
  const rain = buildField(MAX_RAIN, { vertexShader: rainVertex, fragmentShader: rainFragment });
  const snow = buildField(MAX_SNOW, { vertexShader: snowVertex, fragmentShader: snowFragment, sized: true });
  scene.add(rain, snow);

  // --- acúmulo no chão --------------------------------------------------
  // A ideia do PCG de misturar no shader do terreno, adaptada: em vez de
  // uma textura de neve, a mistura é pela NORMAL. Só o que aponta para
  // cima recebe neve, então barranco e beira de lago ficam limpos
  // sozinhos, sem ninguém pintar máscara.
  const groundUniforms = {
    uWet: { value: 0 },
    uSnow: { value: 0 },
  };
  const previousCompile=terrainMaterial.onBeforeCompile;
  terrainMaterial.onBeforeCompile = shader => {
    previousCompile.call(terrainMaterial,shader);
    Object.assign(shader.uniforms, groundUniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `
        #include <common>
        uniform float uWet;
        uniform float uSnow;
      `)
      .replace('#include <normal_fragment_maps>', `
        #include <normal_fragment_maps>
        float vFacingUp = clamp(inverseTransformDirection(normal, viewMatrix).y, 0.0, 1.0);
        // Molhado escurece e satura: é água preenchendo os poros da
        // terra, não uma camada cinzenta por cima.
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.52, 0.58, 0.60), uWet);
        float cobertura = uSnow * smoothstep(0.55, 0.92, vFacingUp);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.88, 0.91, 0.95), cobertura);
      `)
      .replace('#include <roughnessmap_fragment>', `
        #include <roughnessmap_fragment>
        // Chão molhado reflete. Neve fresca não.
        roughnessFactor = mix(roughnessFactor, 0.22, uWet * 0.8);
        roughnessFactor = mix(roughnessFactor, 0.85, uSnow);
      `);
  };
  terrainMaterial.needsUpdate = true;

  // --- estado -----------------------------------------------------------
  let current = 'clear';
  let wanted = 'clear';
  let intensity = 0;        // o que o jogador pediu
  let blend = 0;            // o que já chegou na tela
  const center = new THREE.Vector3();

  // A base publicada pelo ciclo de horário. O clima NUNCA escreve o
  // valor final sozinho — ele compõe sobre isto.
  const base = {
    sky: new THREE.Color('#8caa92'),
    sunIntensity: 2.4,
    exposure: 1.1,
    daylight: .5,
  };
  const skyOut = new THREE.Color();
  const weatherSky = new THREE.Color();

  function setBase({ sky, sunIntensity, exposure, daylight }) {
    if (sky) base.sky.copy(sky);
    if (sunIntensity !== undefined) base.sunIntensity = sunIntensity;
    if (exposure !== undefined) base.exposure = exposure;
    if (daylight !== undefined) base.daylight = daylight;
    compose();
  }

  /**
   * Compõe atmosfera = base do horário + deslocamento do clima.
   *
   * É aqui que mora a diferença em relação ao original: o PCG ATRIBUI
   * `scene.fog` e o nosso ciclo de horário também atribuiria. Dois donos
   * do mesmo valor significa que o último a escrever ganha, e o céu
   * passaria a piscar entre o horário e o clima a cada interação.
   */
  function compose() {
    const profile = PROFILES[current];
    const k = blend;

    skyOut.copy(base.sky);
    if (profile.sky !== null) {
      weatherSky.setHex(profile.sky);
      // O clima também obedece à hora: uma neblina às seis da tarde é
      // mais escura que a do meio-dia.
      weatherSky.multiplyScalar(.45 + Math.sin(base.daylight * Math.PI) * .55);
      skyOut.lerp(weatherSky, k);
    }
    scene.background.copy(skyOut);
    scene.fog.color.copy(skyOut);
    scene.fog.density = baseFogDensity + profile.fog * k;

    if (sun) sun.intensity = base.sunIntensity * THREE.MathUtils.lerp(1, profile.sun, k);
    if (renderer) renderer.toneMappingExposure = base.exposure * THREE.MathUtils.lerp(1, profile.exposure, k);

    groundUniforms.uWet.value = profile.wet * k;
    groundUniforms.uSnow.value = profile.snow * k;

    water?.setRain(profile.water * k);
    onWind?.(profile.wind * k);
  }

  /** Muda o clima. A transição é contínua, como a do horário. */
  function set(id, amount = 1) {
    wanted = PROFILES[id] ? id : 'clear';
    intensity = THREE.MathUtils.clamp(amount, 0, 1);
  }

  function setIntensity(amount) {
    intensity = THREE.MathUtils.clamp(amount, 0, 1);
  }

  // --- pingos na água ---------------------------------------------------
  let dropClock = 0;

  /**
   * A chuva pinga nos lagos.
   *
   * Os anéis de impacto já existiam em `src/world/water.js` desde a
   * v0.25.0, criados junto com a água justamente para este momento. O
   * clima não precisou de nenhuma linha nova do lado da água.
   */
  function rainOnWater(dt) {
    if (!water?.surfaces?.length) return;
    const profile = PROFILES[current];
    const força = profile.fallRain * blend;
    if (força < .05) return;

    dropClock -= dt;
    if (dropClock > 0) return;
    dropClock = .055 / força;

    const surface = water.surfaces[(Math.random() * water.surfaces.length) | 0];
    const raio = Math.sqrt(Math.random()) * .7;
    const angulo = Math.random() * Math.PI * 2;
    water.addDrop(
      surface.feature.x + Math.cos(angulo) * surface.feature.rx * raio,
      surface.feature.z + Math.sin(angulo) * surface.feature.rz * raio,
      .22 + Math.random() * .3,
    );
  }

  // --- laço -------------------------------------------------------------
  function update(dt, elapsed) {
    // A transição atravessa o zero ao trocar de clima: a chuva some
    // antes de a neve começar. Duas coisas caindo do céu ao mesmo tempo
    // não é transição, é bug.
    const alvo = wanted === current ? intensity : 0;
    const passo = dt * 1.1;
    if (Math.abs(blend - alvo) <= passo) {
      blend = alvo;
      if (wanted !== current && blend === 0) current = wanted;
    } else {
      blend += Math.sign(alvo - blend) * passo;
    }

    const profile = PROFILES[current];
    center.copy(follow());

    for (const [field, quantidade] of [[rain, profile.fallRain], [snow, profile.fallSnow]]) {
      const u = field.material.uniforms;
      const forca = quantidade * blend;
      field.visible = forca > .01;
      if (!field.visible) continue;
      u.uTime.value = elapsed;
      u.uCenter.value.copy(center);
      u.uAmount.value = forca;
      u.uOpacity.value = Math.min(1, forca * 1.4);
      u.uWind.value = .25 + profile.wind * blend;
    }

    rainOnWater(dt);
    compose();
  }

  function setPixelRatio(value) {
    rain.material.uniforms.uPixelRatio.value = value;
    snow.material.uniforms.uPixelRatio.value = value;
  }

  function dispose() {
    terrainMaterial.onBeforeCompile=previousCompile;terrainMaterial.needsUpdate=true;
    for (const field of [rain, snow]) {
      scene.remove(field);
      field.geometry.dispose();
      field.material.dispose();
    }
  }

  return {
    set,
    setIntensity,
    setBase,
    update,
    setPixelRatio,
    dispose,
    get weather() { return current; },
    get intensity() { return intensity; },
    get blend() { return blend; },
    get windBias() { return PROFILES[current].wind * blend; },
    get wetness() { return groundUniforms.uWet.value; },
    get snowCover() { return groundUniforms.uSnow.value; },
  };
}
