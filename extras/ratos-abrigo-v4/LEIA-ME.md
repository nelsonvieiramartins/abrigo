# Ratos procedurais para o ABRIGO — v4

Nova espécie `rat`, construída em Three.js no mesmo formato dos complementos de aranha, escorpião e esqueleto. Corpo e cabeça facetados, focinho afilado, orelhas arredondadas com interior rosado, olhos escuros, bigodes, quatro patas com dedos separados e cauda afilada articulada. A postura é baixa, com membros dianteiros e traseiros de proporções diferentes.

As imagens e os GIFs incluídos foram renderizados a partir da geometria emitida por `rat-detail.ts`. Não são imagens de conceito. Não foi fornecida uma referência específica de rato nesta etapa: esta versão estabelece a base visual para as próximas revisões.

## Ver o resultado

Abra **`visualizador-ratos.html`** em um navegador com WebGL. O arquivo contém Three.js, o gerador e as três receitas; não depende de downloads externos. Use giro, zoom, vistas frontal, lateral, traseira, superior, cabeça, pata e cauda, além das animações de andar, correr, **CORRER+** e morder.

O seletor de velocidade permite inspecionar a corrida a 1×, 0,5× e 0,25×.

O painel permite trocar entre marrom, cinza e preto, escolher o detalhe e ajustar escala, orelhas e comprimento da cauda. **Baixar JSON** exporta a receita correspondente. **Avançar (+Z)** aplica deslocamento de demonstração, com a câmera acompanhando o rato; desative para inspecionar o passo no lugar.

`rato-vistas.png`, `rato-detalhes.png` e `rato-variantes.png` mostram as malhas. `rato-ataque.gif` mostra uma mordida; `rato-caminhada.gif` mostra avanço para a frente. `rato-corrida.gif` mostra a corrida em velocidade normal, com a câmera acompanhando o modelo e repetição contínua. `rato-corrida-fases.png` separa quatro momentos do ciclo. `rato-correr-mais.gif` mostra CORRER+ em velocidade normal e `rato-correr-mais-fases.png` mostra seus quatro momentos.

## Integração

**Se já instalou a v3, aplique `atualizacao-v3-v4.patch` aos três arquivos: `rat-detail.ts`, `creature-schema.ts` e `creature.ts`.** O novo valor `runPlus` precisa existir no tipo de movimento e na validação do dispatcher. O patch inclui os três arquivos. Também pode usar os três arquivos completos se não houver modificações locais. Atualize o visualizador para acessar a opção **CORRER+**; no painel próprio do ABRIGO, associe esse rótulo ao valor `runPlus`.

Este complemento usa os arquivos `creature.ts` e `creature-schema.ts` entregues com **esqueleto-abrigo-v4** como base. As implementações das outras criaturas continuam externas a este pacote e são reutilizadas do ABRIGO.

1. Adicione **`rat-detail.ts`** ao lado dos outros geradores.
2. Aplique **`integracao.patch`** em `creature-schema.ts` e `creature.ts`. Se sua cópia ainda corresponde à base indicada, também pode usar os dois arquivos completos incluídos. Preserve outras alterações que existam no seu projeto.
3. Importe uma receita: `rato-marrom.criatura.json`, `rato-cinza.criatura.json` ou `rato-preto.criatura.json`.

O schema registra `rat: 'Rato'`, seus campos, preset, receita aleatória e validação. O dispatcher passa a executar o rato nos níveis `high` e `low`, e admite `run` para essa espécie. Se a interface tiver uma lista própria de criaturas ou movimentos, inclua `rat` e `run` nela; os arquivos dessa interface não foram fornecidos.

```ts
import {buildDetailedRat} from './rat-detail';

if (spec.species === 'rat') {
  animate = buildDetailedRat(spec, {
    body, nodes, sockets, geometries, materials
  }, detail);
} else if (spec.species === 'skeleton') {
  // Despacho já existente.
}
```

Pela API existente:

```ts
const rato = createCreature(receita, {detail: 'high'});
scene.add(rato.root);
rato.update(tempoEmSegundos, 'move');
// Também aceita 'idle', 'run', 'runPlus' e 'attack'.
// Quando remover definitivamente a criatura:
rato.dispose();
```

## Forma e orçamento

Y aponta para cima, +Z é a frente, unidades em metros. A escala global é `body.scale`, entre 0,5 e 1,8. A base representa um rato grande, com cerca de 0,70 m incluindo a cauda e 0,20 m de altura; reduza a escala para ratos menores.

| Detalhe | Triângulos | Malhas | Materiais usados |
| --- | ---: | ---: | ---: |
| `high` | 2.586 | 37 | 5 |
| `low` | 1.652 | 33 | 5 |

Os números são do rato isolado, sem sombra ou cenário. O dispatcher herdado também cria seis materiais genéricos que não são usados pela malha do rato e são descartados por `dispose`. Os dois níveis mantêm a mandíbula, as patas e a cauda articuladas. O detalhe alto tem dez segmentos de cauda; o baixo tem sete. Os bigodes passam de três para dois por lado no nível baixo e os reflexos minúsculos dos olhos são omitidos.

Os triângulos são agrupados por articulação e material. A animação transforma apenas grupos; não recria a geometria. Não foi medido FPS no ABRIGO.

## Parâmetros

O bloco opcional `rat` possui multiplicadores entre **0,7 e 1,3**:

| Campo | Efeito |
| --- | --- |
| `bodyLength` | Comprimento do corpo e posições dos quadris, cabeça e raiz da cauda |
| `bodyWidth` | Largura do tronco e afastamento das patas |
| `headSize` | Escala da cabeça, incluindo focinho, olhos, orelhas e bigodes |
| `muzzleLength` | Comprimento do focinho e posição do nariz e dos incisivos |
| `earSize` | Tamanho das orelhas |
| `legLength` | Comprimento dos membros e altura do tronco |
| `pawSize` | Tamanho das patas e altura dos tornozelos |
| `tailLength` | Comprimento da cadeia de cauda |
| `tailThickness` | Espessura e afilamento da cauda |
| `whiskerLength` | Abertura dos bigodes |

Quando o bloco não é fornecido, `anatomy.length`, `spread`, `legs`, `ears`, `tail` e `thickness` controlam seus equivalentes. Campos explícitos de `rat` prevalecem; se editar uma receita que já contém esse bloco, ajuste esses campos também.

`body.bulk` altera largura e altura do corpo. `appearance.primary` controla o pelo, `secondary` a barriga e o focinho, `eyes` os olhos e as linhas da boca. `markings` escurece discretamente o dorso. A pele das orelhas, patas, nariz e cauda usa a cor rosada definida no gerador. A semente determina a curva de repouso da cauda. As três receitas fornecidas diferem apenas nas cores e no nome.

## Movimento e mordida

`update` recebe segundos absolutos de um mesmo relógio. `move` mantém a caminhada com apoios diagonais alternados. `run` usa um galope estilizado, com ciclo de 0,30 s (40% mais ciclos por segundo que a v2):

| Fase do ciclo | Movimento |
| --- | --- |
| 0–30,5% | Apoio traseiro, extensão das pernas e impulso |
| 30,5–50% | Suspensão, com as quatro patas acima do chão |
| 50–80,5% | As dianteiras recebem o peso; traseiras voltam à frente |
| 80,5–100% | Recolhimento e breve suspensão para o próximo impulso |

Dentro de cada par, a pata esquerda toca 2,5% do ciclo depois da direita. Os apoios duram 28% do ciclo por pata. O tronco sobe apenas 6 mm entre mínimo e máximo na proporção neutra, em um arco contínuo, e inclina no máximo 1,43°. A cabeça compensa 65% da inclinação e a cauda acompanha discretamente o ciclo. As antigas subidas curtas de até 27 mm e a inclinação de 4,58° foram reduzidas. Isso mantém a corrida rápida sem sacudir a silhueta. Ombros e quadris acompanham o tronco; as pernas continuam com comprimentos fixos. A solução analítica posiciona os pés no chão durante o apoio e os recolhe durante o voo. As trajetórias das patas têm velocidade e aceleração contínuas na saída e na chegada ao apoio; o envelope de recolhimento também é suave. Não há deformação ou recriação de vértices.

**CORRER+ (`runPlus`)** é um modo adicional exclusivo dos ratos. Mantém as mesmas fases e as trajetórias suaves da v3, com parâmetros próprios:

| Movimento | Ciclo | Avanço de referência | Subida do corpo (mínimo–máximo) | Inclinação máxima |
| --- | ---: | ---: | ---: | ---: |
| Correr (`run`) | 0,30 s | 0,476 m/s | 6 mm | 1,43° |
| CORRER+ (`runPlus`) | 0,24 s | 0,714 m/s | 18 mm | 2,29° |

Valores na proporção e escala neutras. CORRER+ tem 25% mais ciclos por segundo, passos 20% mais largos e avanço 50% mais rápido. A subida é triplicada em um arco contínuo, com recolhimento maior das patas e a mesma compensação da cabeça. A corrida leve continua igual à v3. As exportações adicionais são `RAT_RUN_PLUS_PERIOD` e `RAT_RUN_PLUS_SPEED`.

```ts
import {RAT_RUN_PLUS_SPEED} from './rat-detail';
rato.update(tempoEmSegundos, 'runPlus');
const velocidadeMais = RAT_RUN_PLUS_SPEED * (receita.rat?.legLength ?? receita.anatomy.legs) * receita.body.scale;
rato.root.translateZ(velocidadeMais * deltaEmSegundos); // ou controlador físico
```

O gerador anima a pose; o ABRIGO aplica a velocidade de mundo. Se usa um seletor próprio de movimentos, acrescente `{label: 'CORRER+', value: 'runPlus'}`. Para outras espécies, o dispatcher rejeita esse modo com uma mensagem explícita.

A escolha foi informada por Gillis e Biewener (2001), que estudaram caminhada, trote e galope de **Rattus norvegicus** e distinguiram a pata traseira que toca primeiro da que toca depois: https://doi.org/10.1242/jeb.204.15.2717. Ratos usam mais de uma marcha. Este complemento implementa a corrida em saltos solicitada; duração, alturas e porcentagens são ajustes visuais do modelo, não medições extraídas do estudo.

Entrar em `attack` inicia **uma mordida**: preparação, abertura da mandíbula, avanço visual local de até 0,026 m, fechamento e recuperação em aproximadamente 0,68 s. Permanecer em `attack` não repete o golpe. Saia desse estado e entre novamente para repetir; voltar o relógio também reinicia o ataque.

O gerador não aplica dano nem deslocamento de mundo. O ABRIGO deve controlar movimento, colisão, terreno e acerto da mordida; um momento aproximado de acerto é 0,28 s após o início do golpe. Para deslocamento sem física, `rato.root.translateZ(velocidade * delta)` avança na frente local. Se usa Rapier, transforme essa direção pela rotação do rato e aplique pelo controlador físico.

Na demonstração, andar usa aproximadamente 0,132 m/s e correr usa 0,476 m/s, nas proporções e escala neutras. O gerador exporta `RAT_RUN_PERIOD` e `RAT_RUN_SPEED`. Para a corrida, a velocidade de referência é `RAT_RUN_SPEED * legLength * body.scale` em metros por segundo. Essa velocidade coincide com a velocidade de recuo dos pés durante o apoio, reduzindo deslizamento no piso plano. Se multiplicar o relógio da animação por uma taxa, multiplique a velocidade por essa mesma taxa.

```ts
import {RAT_RUN_SPEED} from './rat-detail';
const velocidade = RAT_RUN_SPEED * (receita.rat?.legLength ?? receita.anatomy.legs) * receita.body.scale;
rato.update(tempoEmSegundos, 'run');
rato.root.translateZ(velocidade * deltaEmSegundos); // ou pelo controlador físico
```

O gerador só altera a pose local. O controlador do jogo continua responsável pelo deslocamento de mundo. O GIF aplica esse avanço e acompanha o modelo com a câmera; a pose inteira, incluindo a cauda, repete continuamente sem teleporte visual.

Sockets: `head`, `mouth`, `back`, `target`, `tailTip`, `footfrontL`, `footfrontR`, `foothindL`, `foothindR`. L e R são os lados anatômicos. Nós: `torso`, `head`, `muzzle`, `jaw`, `earL/R`, `frontL/R`, `hindL/R`, `knee-frontL/R`, `knee-hindL/R`, `paw-frontL/R`, `paw-hindL/R` e `tail-0` em diante.

## Verificação e reprodução

Verificado com Three.js r186 e TypeScript estrito: receitas padrão e aleatórias das nove espécies, limites dos parâmetros de rato, espelhamento das patas, transformações finitas, comprimentos constantes dos membros e da cauda, apoio nivelado, folga em relação ao chão, sentido da marcha, apoios dianteiros/traseiros alternados, suspensão das quatro patas, salto do corpo, continuidade de todo o rig no ciclo, continuidade de velocidade nas transições de apoio, limite de oscilação do corpo e ausência de deslizamento no apoio à velocidade de referência, repetição e recuperação da mordida, geometria estática e recursos registrados. A corrida também foi verificada nas escalas globais 0,5 e 1,8, com contato e velocidade de referência proporcionais. Foram verificadas combinações de patas curtas com pés grandes, patas longas com cauda longa e cabeças pequenas e grandes.

As poses de `idle`, `move`, `run` e `attack` foram comparadas numericamente com a v3 e permanecem iguais, inclusive depois de sair de `runPlus`. Os dois modos de corrida foram verificados nas proporções e escalas extremas. O dispatcher aceita CORRER+ nos dois níveis do rato e rejeita esse movimento nas oito outras espécies.

O dispatcher foi testado para o rato nos dois detalhes, incluindo escala, estatísticas, movimentos e descarte idempotente. Os demais geradores foram substituídos por stubs apenas no teste isolado; esses stubs não são enviados como código de produção. A aplicação ABRIGO inteira não foi executada.

As PNGs usam um rasterizador CPU com projeção ortográfica, iluminação e teste de profundidade. O HTML usa WebGL com iluminação física; sua aparência pode diferir. O visualizador foi compilado, mas não executado com WebGL neste ambiente.

O diretório `render` contém código para reproduzir o modelo e suas verificações. Seu `schema.ts` contém somente `seededRandom` para esse ambiente isolado; **não substitua o `schema.ts` do ABRIGO por ele**.

```sh
cd render
npm install
npm run check
npm run verify
npm run project
cd ..
python3 render/raster_geometry.py tres-quartos frente lateral traseira superior cabeca pata cauda cinza preto
```

Python requer NumPy e Pillow. O projetor também exporta `attack-0` a `attack-16` e `walk-0` a `walk-23`, `run-0` a `run-35` , `gallop-0` a `gallop-3`, `runplus-0` a `runplus-47` e `gallopplus-0` a `gallopplus-3`; o mesmo rasterizador aceita esses nomes. `THREE-LICENSE.txt` contém a licença da dependência Three.js. Esta entrega é código procedural original produzido para este projeto, sem modelos ou texturas baixados.

Para reproduzir a corrida, após `npm run project`, na raiz do pacote:

```sh
python3 render/raster_geometry.py $(seq -f 'run-%g' 0 35)
python3 render/gerar-corrida-gif.py
```

Para reproduzir a prévia de CORRER+, após `npm run project`, na raiz do pacote:

```sh
python3 render/raster_geometry.py $(seq -f 'runplus-%g' 0 47)
python3 render/gerar-correr-mais-gif.py
```
