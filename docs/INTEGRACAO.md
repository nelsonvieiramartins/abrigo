# Integração no jogo Three.js

## Usar a receita JSON

Copie `src/character.ts`, `src/schema.ts`, `src/vendor/` e `src/generated/` para seu projeto. Alternativamente, use o módulo compilado `dist/character.module.js`, mantendo `three` como dependência do projeto. Use uma única instância/versão de Three.js; esta entrega foi compilada com **0.186.0**.

```ts
import * as THREE from 'three';
import { createCharacter, validateSpec } from './character.module.js';
import characterJson from './alex.personagem.json';

let actor = createCharacter(validateSpec(characterJson));
scene.add(actor.root);
actor.root.position.set(0, terrainHeight(0, 0), 0);

// Dentro do loop já existente do jogo:
function animateCharacter(elapsedSeconds: number, speed: number, sprinting: boolean) {
  const motion = speed < 0.05 ? 'idle' : sprinting ? 'run' : 'walk';
  actor.update(elapsedSeconds, motion);
}
```

## Nível de malha

`createCharacter(spec, { detail })` aceita `'uhd'` (ultra, 120–150 mil triângulos, para close-ups e retratos), `'high'` (padrão, cerca de 30–36 mil triângulos) ou `'low'` (malha facetada original, até cerca de 3,7 mil). Os dois níveis têm os mesmos `nodes`, `sockets`, proporções e animação, então dá para trocar de nível pela distância da câmera (LOD) com `replaceAppearance`, sem mudar a lógica do jogo. `actor.detail` informa o nível criado.

`update` recebe **tempo absoluto em segundos**, não delta. Ele também anima o rosto no nível alto (piscar, sobrancelhas, olhar), em qualquer movimento; o ritmo é determinístico pela semente. A rotina não move `root.position` nem `root.rotation`; quem controla isso é o jogo. Pode sincronizar a velocidade da passada multiplicando o tempo passado a `update`.

## Expressões

`actor.setExpression(nome, intensidade = 1, imediato = false)` com `nome` em `EXPRESSIONS` (`neutral`, `happy`, `angry`, `sad`, `tired`, `surprised`). A transição leva cerca de 0,25 s dentro de `update`; piscar, olhar e sobrancelhas continuam ativos. Não faz parte da receita JSON: é estado de jogo.

## Trocar a aparência sem mudar o jogador

```ts
function replaceAppearance(nextRecipe) {
  const next = createCharacter(validateSpec(nextRecipe));
  next.root.position.copy(actor.root.position);
  next.root.quaternion.copy(actor.root.quaternion);
  scene.add(next.root);
  actor.dispose();
  actor = next;
}
```

`dispose()` remove a raiz da cena e libera geometrias/materiais do personagem. Cada instância possui seus próprios recursos. Objetos que você acrescentar nos pontos de fixação são de sua responsabilidade: retire-os antes de descartar o personagem se quiser reaproveitá-los.

Não copie a escala anterior ao trocar altura: ela é calculada pela nova receita.

## Equipamento

```ts
actor.sockets.handR.add(item);
item.position.set(0, 0, 0);
item.rotation.set(0, 0, 0);
```

Pontos disponíveis: `handR`, `handL`, `back`, `head`, `belt`. Direita e esquerda são as do personagem, não as da câmera. A orientação inicial é +Z para frente e +Y para cima.

`actor.nodes` expõe `hips`, `spine`, `head`, `upperArmR/L`, `lowerArmR/L`, `handR/L`, `upperLegR/L`, `lowerLegR/L` e `footR/L`. `root.userData.rig.kind` é `procedural-rigid-hierarchy`; não é uma `THREE.Skeleton` vinculada a uma malha.

## Rapier e terreno

Mantenha o corpo cinemático, colisores e o controlador Rapier no código de movimentação existente. Use esse personagem como representação visual.

1. A raiz visual deve acompanhar a posição do jogador no terreno.
2. Se o corpo físico estiver no centro de uma cápsula, aplique o deslocamento vertical necessário para deixar a raiz visual nos pés.
3. Ao mudar a altura, atualize a cápsula física segundo a convenção do seu projeto. O editor não modifica colisores automaticamente.
4. A prévia resolve o contato em piso plano. Para terrenos irregulares, acrescente amostragem separada da altura de cada pé ao alvo do solver em `src/character.ts`.
5. `root.userData.sculptRuntime.colliders` fica vazio intencionalmente: a geometria visual não define sozinha um colisor de gameplay.

## ANIMA

Este módulo é um gerador visual independente. Não é um preset de `anima3d` e não deve receber diretamente clips ou poses de um esqueleto ANIMA sem um mapeamento de juntas. Pode substituir temporariamente a representação visual do jogador, mantendo movimento, câmera e física externos. Para usar ANIMA como controlador de animação, será necessário mapear articulações ou construir uma versão com skinning compatível.

## Origem e atributos

`characterStats(recipe)` devolve `{ values, remaining }`. Os valores são uma regra inicial deste editor e podem ser alterados em `src/schema.ts`. O JSON guarda profissão e traços; seu jogo define seus efeitos reais.

## Estender o catálogo

1. Adicione a opção em `OPTIONS` e, quando necessário, na validação do esquema.
2. Gere a geometria em `createCharacter`, colocando cada peça no grupo da junta apropriada.
3. Registre recursos criados nos conjuntos usados por `dispose()`.
4. Mantenha coordenadas em metros e semente determinística.
5. Confira frente, lado, costas, caminhada e corrida. Peças sobrepostas precisam de folga geométrica, especialmente perto das juntas.

Para uma quebra de compatibilidade no JSON, incremente `schemaVersion` e acrescente uma migração explícita. A semente não substitui o arquivo completo de uma aparência personalizada.
