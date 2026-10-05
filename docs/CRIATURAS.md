# Criaturas da floresta — primeira versão

O editor possui duas áreas: **Personagens** e **Criaturas**. Abra `ABRIR_EDITOR.html` e escolha Criaturas na barra superior. No servidor de desenvolvimento, `?mode=creatures` abre diretamente o bestiário.

## Catálogo e edição

| Espécie | Anatomia própria | Animações em loop |
| --- | --- | --- |
| Lobo | Patas, cauda, orelhas, volume e escala | Em alerta, caminhar, morder |
| Morcego | Envergadura, orelhas, volume e escala | Pairar, voar, investida |
| Enxame de vespas | 12–120 insetos, dispersão, volume e escala | Circular, deslocar, atacar |
| Cobra | Comprimento, espessura, volume e escala | Repouso, rastejar, bote |

As abas Corpo, Aparência e Ameaça exibem apenas controles pertinentes à espécie. Ameaça define temperamento, vida, dano, velocidade em m/s, percepção em metros e veneno (cobra/enxame). São **metadados**: não há IA, colisões nem dano automático.

Rascunhos de criaturas usam `abrigo-creature-v1`, separados dos personagens. Desfazer/refazer preserva até 30 alterações. Exportação: `nome.criatura.json`, PNG da prévia e folha transparente de 8 direções (1024 × 640, quadros de 256 × 320). A folha contém poses estáticas; não é uma animação. Os botões HD e vistas operam apenas sobre a prévia ativa. A renderização da área escondida fica suspensa.

## API Three.js

As exportações estão no mesmo `dist/character.module.js`; mantenha uma única versão de Three.js 0.186.0 no aplicativo.

```js
import {createCreature, presetCreature, validateCreatureSpec} from './character.module.js';

const recipe = presetCreature('wolf'); // wolf | bat | swarm | snake
// Para um arquivo importado: const recipe = validateCreatureSpec(json);
const creature = createCreature(recipe, {detail: 'high'}); // low | high
scene.add(creature.root);
creature.root.position.set(3, terrainHeight(3, 8), 8);

// Tempo absoluto em segundos, não delta. O jogo controla posição e orientação.
creature.update(elapsedSeconds, 'move'); // idle | move | attack; lobos também aceitam run

// Ponto para indicadores de vida, efeitos etc. Use getWorldPosition para coordenadas globais.
creature.sockets.target.add(marker);

// Ao remover: desprenda equipamentos externos que queira reutilizar.
creature.dispose();
```

`randomCreature(seed, species)` cria a mesma receita para a mesma espécie, semente e versão do gerador. `validateCreatureSpec` valida valores, limites e cores, normaliza campos de outras espécies e exige `kind: 'creature'` e `schemaVersion: 1`. Receitas de personagens continuam no formato anterior e têm seu importador próprio. Para alterações manuais, sempre salve a receita completa.

`CreatureModel` expõe `root`, `nodes`, `sockets`, `detail`, `stats`, `update` e `dispose`. Coordenadas: +Y para cima, +Z para frente, metros. A raiz fica no solo; morcegos e insetos têm uma altura visual de voo local. `update` não altera a posição, rotação ou escala da raiz. `attack` repete uma pose: o jogo decide quando causar dano e quando encerrar a ação.

### Caminhada e corrida dos lobos

`wolf` oferece **Caminhar** (`move`) e **Correr** (`run`). A caminhada tem quatro apoios em sequência lateral, com avanço da pata separado da fase de apoio. A corrida representa um galope rotatório: grupo traseiro, suspensão, grupo dianteiro e outra suspensão, com pequena defasagem entre as patas de cada par. Referência: [Canine Gaits — University of Minnesota](https://vanat.ahc.umn.edu/gaits/rotGallop.html). O ritmo procedural compartilhado fica em `src/wolf-gait.ts`.

O lobo HD resolve cotovelos/joelhos para alvos das patas relativos ao piso e compensa a inclinação do corpo nos tornozelos. Corpo, cabeça e cauda acompanham o ciclo. O lobo leve usa uma aproximação mais simples. `run` é rejeitado para as demais criaturas. A movimentação permanece no lugar: deslocamento no mundo e sincronização com velocidade são responsabilidade do jogo. O enquadramento considera o envelope da corrida. Testes amostram 200 pontos do ciclo, verificando apoio na caminhada, duas suspensões no galope, altura de apoio, limites do piso e restauração da pose em `idle`.

Sockets: `target` em todas as espécies; `head` e `mouth` em lobo, morcego e cobra; `back` em lobo/morcego; `origin` no enxame. `nodes` depende da espécie: não representa um esqueleto humano ou compatível com anima3d.

## Arquivos e manutenção

### Lobo HD refinado

O HD do lobo usa `src/wolf-detail.ts`: tronco e pescoço numa superfície triangular contínua derivada de um icosaedro deformado, transição de cor por vértice, volumes peitorais sob o pelo, juntas sobrepostas, joelhos e tornozelos articulados, 16 dedos com almofadas e garras, olhos com íris/pupila/reflexo e pálpebras que piscam, orelhas com cavidade interna e tufos, focinho com narinas, lábios e dentes, cauda contínua. Não há texturas ou modelos externos.

A remodelagem guiada pela referência low-poly usa planos largos com `flatShading` na pelagem, mechas fechadas em forma de cunha no pescoço e no peito, focinho alongado com nariz na extremidade, mandíbula alinhada, orelhas altas com interior rosado, olhos dourados com sobrancelhas espessas, patas claras com garras e cauda volumosa afilada. Crânio e bochechas usam volumes esféricos com sombreamento suave, assim como olhos e nariz. A juba possui mechas sólidas com espessura e faces triangulares grandes; os membros usam perfis retangulares chanfrados com faces alongadas. O eixo `+Z`, os controles de anatomia/cores, sockets, animações e a API de exportação para Three.js foram preservados; o modo leve mantém sua modelagem anterior. É uma reconstrução procedural orientada por uma única vista, não uma equivalência geométrica exata ao modelo da imagem.

O HD tem **20.540 triângulos e 48 meshes**, contra 48.184 triângulos e 45 meshes antes desta remodelagem. As peças fixas são fundidas por material e por articulação; os nomes originais das peças agrupadas ficam em `mesh.userData.parts`. Pálpebras, orelhas, mandíbula, patas e sockets preservam seus grupos animados. O modo leve mantém **1.676 triângulos e 41 meshes** e os mesmos sockets. A redução de triângulos não implica redução de chamadas de desenho. Testes limitam o HD a 55 mil triângulos e 50 meshes.

### Morcego, enxame e cobra HD

- **Morcego (reconstruído por referência, 27/09):** corpo pequeno com a cabeça afundada nos ombros, orelhas curtas e pontudas, olhos pequenos com pálpebras. Asa montada pela estrutura óssea real: braço do ombro ao cotovelo e ao **punho alto** (silhueta em “M”), garra do polegar no punho, **quatro dedos em leque** a partir do punho e membrana com bordas **recortadas em arcos** entre as pontas, presa ao tornozelo. A membrana é um leque de anéis com vértices internos, que infla entre os ossos e é mais escura perto deles. Batida com subida/descida e dobra leve das pontas. Cores padrão escuras (preto e cinza). `src/bat-detail.ts`: ~11.700 triângulos / 31 meshes; leve com as mesmas proporções. Folha de inspeção: `dev/criatura.html?species=bat` (`&motion=move&t=`, `&zoom=0.8`, `&bg=light`, `&detail=low`).
- **Enxame:** cada vespa tem cabeça, tórax, cintura, abdômen listrado, olhos, antenas, mandíbulas, seis pernas, ferrão e dois pares de asas. `src/swarm-detail.ts`: 460 triângulos por inseto; 22.080 para 48 insetos, 55.200 no máximo de 120. O HD usa **3 InstancedMesh** para o enxame inteiro, com matrizes independentes para corpos e asas. `stats.triangles` inclui todas as instâncias. `dispose()` libera também os buffers das instâncias.
- **Cobra:** malha contínua de 144 segmentos × 32 lados com relevo geométrico sutil de escamas, placas ventrais e padrão por vértice; cabeça com placas, fossas, narinas, pupilas verticais, mandíbula articulada, presas curvas e língua bifurcada retrátil. A seção do corpo acompanha a tangente da ondulação e as normais da costura são suavizadas. `src/snake-detail.ts`: 19.160 triângulos / 14 meshes.

Os três geradores compartilham `src/creature-detail-utils.ts` para perfis curvos, materiais e agrupamento de peças por articulação. Os modos leves e os sockets de cada espécie continuam disponíveis. Para um renderer sem suporte a instâncias, use `createCreature(recipe, {detail: 'high', instancing: false})`: o enxame usa a mesma geometria em três meshes por inseto. A prévia SVG seleciona essa alternativa automaticamente.

- `src/creature-schema.ts`: receita, validação, presets e sorteio.
- `src/creature.ts`: quatro geradores, recursos e animações procedurais.
- `src/creature-editor.ts`: área dedicada, histórico, rascunho e importação/exportação.
- `src/scene.ts`: prévia compartilhada, enquadramento por envelope de animação.
- `tests/creatures.ts`: sementes, JSON, limites de anatomia, geometria, animação, piso e descarte.

`npm run test:creatures` executa a bateria rápida de 64 construções; `npm test` também executa a bateria original de personagens. `npm run build` atualiza o HTML offline e o módulo de integração.

## Limitações e próximos passos

Esta versão usa anatomia estilizada procedural. Lobos/morcegos usam peças articuladas rígidas; cobras usam uma malha contínua deformada. O enxame HD usa três malhas instanciadas; o modo leve original ainda usa cinco meshes por inseto, e a alternativa HD para SVG usa três por inseto. Poucos triângulos não significam necessariamente menos chamadas de desenho: prefira o enxame HD instanciado para grupos grandes em WebGL e meça no jogo. Não há UHD de criaturas, skinning, retargeting anima3d, IK de terreno, física Rapier ou pathfinding. Pés de lobos têm animação simplificada e o piso é plano.

A integração futura deve aplicar a ficha de ameaça no controlador do jogo e escolher LOD por distância. As formas, tamanhos e movimentos específicos de cada espécie exigem colisores próprios; não reutilize automaticamente a cápsula do personagem humano.
