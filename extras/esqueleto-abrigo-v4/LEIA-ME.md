# Esqueleto procedural para o ABRIGO — v4

Complemento construído a partir da referência enviada. A geometria é gerada em Three.js, com ossos rígidos articulados, sem textura e sem modelo externo. As imagens PNG e o GIF foram renderizados a partir dessa mesma malha, usando rasterização com profundidade; não são conceitos gerados por IA.

## Revisão v4

O crânio foi encurtado em aproximadamente 25% na altura total em relação à v3: a calota deixou de ter o topo em ponta e recebeu uma coroa mais baixa, larga e arredondada. A face permanece na mesma posição do rig. A testa agora continua até a borda das órbitas, com fechamento das têmporas; as órbitas ficaram mais baixas, angulares e escuras. Também foram reduzidos o volume da mandíbula, dos arcos das maçãs do rosto e dos dentes.

`referencia-cranio.png` contém a referência de detalhe enviada nesta revisão. `comparacao-cranio-v4.png` compara recortes da referência e da malha renderizada, preservando as proporções de cada imagem. As escalas e a iluminação das duas imagens diferem; a comparação não representa uma recuperação da malha original.

As correções da v3 continuam presentes: palmas para as pernas, polegares para +Z, falanges curvadas para as palmas, avanço dos pés no ar (+Z) e recuo durante apoio (−Z). Caminhada, corrida e ataque mantêm o mesmo funcionamento.

Para atualizar qualquer versão anterior do esqueleto, substitua **apenas `skeleton-detail.ts`**. A receita, o schema e o despachante continuam compatíveis. `atualizacao-v3-v4.patch` contém as mudanças em relação à v3.

O visualizador oferece a opção **Avançar (+Z)**, ativada por padrão, uma grade de chão e uma seta de direção. Esse deslocamento pertence exclusivamente à demonstração; desative a opção para examinar a animação no lugar. O GIF `esqueleto-caminhada-frente.gif` mostra a malha avançando, vista pelo lado esquerdo.

## Começar

Abra `visualizador-esqueleto.html` em um navegador com WebGL. Ele contém o Three.js, o gerador, a receita e a referência, e funciona sem baixar arquivos. Use as vistas, giro, zoom, malha, caminhada, corrida e ataque. Ao selecionar uma vista do crânio, o painel de referência mostra automaticamente o detalhe enviado nesta revisão.

As vistas estáticas também estão disponíveis em `esqueleto-vistas.png` e `esqueleto-detalhes.png`. O ataque está em `esqueleto-ataque.gif`.

## Integrar no projeto

Esta entrega usa como base os arquivos da versão **lobo-fidelidade-abrigo-v5**. O gerador de lobo, aranha e escorpião continua sendo o que já existe no projeto. Se esses arquivos tiveram outras alterações desde aquela versão, aplique apenas as mudanças indicadas em `integracao.patch`.

1. Adicione `skeleton-detail.ts` ao lado dos outros geradores.
2. Incorpore as mudanças de `creature-schema.ts` e `creature.ts`, ou use as cópias completas incluídas se sua base ainda for a v5.
3. Importe a receita `esqueleto-referencia.criatura.json` pelo fluxo de receitas existente.

A nova espécie é `skeleton`, exibida como **Esqueleto**. O seletor que utiliza `CREATURE_SPECIES` automaticamente passa a receber essa opção. Se a interface tiver uma lista própria de espécies ou opções de movimento, adicione nela `skeleton` e `run`; os arquivos da interface não foram fornecidos.

Trecho que despacha o gerador, antes dos outros casos:

```ts
import {buildDetailedSkeleton} from './skeleton-detail';

if (spec.species === 'skeleton') {
  animate = buildDetailedSkeleton(spec, {
    body, nodes, sockets, geometries, materials
  }, detail);
} else if (spec.species === 'wolf' && spec.wolf) {
  // Gerador de lobo da versão anterior.
}
```

Uso pela API já existente:

```ts
const model = createCreature(receita, {detail: 'high'});
scene.add(model.root);
model.update(tempoEmSegundos, 'idle');
// Também aceita 'move', 'run' e 'attack'.
// Ao remover definitivamente a criatura:
model.dispose();
```

## O que foi modelado

| Elemento | Construção |
| --- | --- |
| Crânio | Calota compacta e arredondada, facetada, face com furos, paredes internas e fundo escuro das órbitas e nariz; sem olhos ou pupilas |
| Mandíbula | Arco separado, dentes superiores e inferiores e pivô próprio |
| Tórax | Seis pares de costelas com espaços reais, esterno, clavículas e escápulas |
| Coluna | Vértebras separadas no pescoço, tórax e região lombar |
| Bacia | Asas côncavas, sacro e arcos com aberturas |
| Braços | Úmero, cotovelo, rádio e ulna separados, punho e cinco dedos por mão |
| Pernas | Fêmur, joelho com patela, tíbia e fíbula separadas |
| Pés | Tornozelo, calcanhar, metatarsos e cinco dedos por pé |

Convenção: metros, Y para cima, frente +Z. A altura nominal é aproximadamente 2,03 m antes de aplicar `body.scale`. A geometria permanece estática durante a animação; apenas os grupos das articulações são transformados. Os ossos estáticos de cada articulação são unidos por material, conservando as aberturas e a separação visual entre ossos.

| Detalhe | Triângulos | Malhas | Materiais utilizados pela malha |
| --- | ---: | ---: | ---: |
| `high` | 7.945 | 21 | 3 |
| `low` | 5.549 | 21 | 3 |

Os níveis conservam seis pares de costelas, cinco dedos por mão e pé e as cavidades da cabeça. O nível reduzido usa menos lados nas seções dos ossos e dois segmentos nos quatro dedos longos das mãos. O dedo médio é o mais longo nas duas mãos; os polegares apontam para a frente e os dedos grandes dos pés ficam no lado medial. As falanges curvam para o lado da palma, com simetria entre as extremidades. Não houve medição de FPS no ABRIGO; os números acima são contagens da malha, sem chamadas extras de sombras.

## Proporções e cores

A receita incluída usa os valores neutros, que servem como ponto de comparação com a referência. O crânio, as costelas e os detalhes não recebem variação aleatória de forma nesta versão.

| Campo | Faixa validada | Efeito |
| --- | --- | --- |
| `body.scale` | 0,5–1,8 | Escala geral pelo `createCreature` |
| `body.bulk` | 0–1 | Pequena variação da largura e espessura |
| `anatomy.legs` | 0,85–1,15 | Comprimento das duas cadeias das pernas |
| `anatomy.spread` | 0,85–1,15 | Largura do tórax e posição dos ombros |
| `anatomy.thickness` | 0,8–1,2 | Espessura dos ossos |
| `appearance.primary` | Cor hexadecimal | Osso principal |
| `appearance.secondary` | Cor hexadecimal | Interior das cavidades e partes posteriores |
| `appearance.eyes` | Cor hexadecimal | Fundo escuro das órbitas e nariz |

Os demais campos de anatomia não alteram este esqueleto. `appearance.markings` não cria marcas neste gerador. Veneno permanece falso.

## Animação e ataque

- `idle`: balanço discreto do tronco, cabeça e braços.
- `move` e `run`: pernas com solução analítica de duas articulações; preserva o comprimento dos ossos e mantém os pés acima do chão. Os braços acompanham os passos.
- `attack`: golpe único do braço direito, com preparação, extensão, rotação do tórax, abertura discreta da mandíbula e recuperação até 0,9 s. Não usa arma.

`update` recebe segundos absolutos no mesmo relógio. Entrar em `attack` inicia um golpe. Ele não fica repetindo enquanto o estado continuar em `attack`. Para atacar de novo, saia desse estado e entre novamente; retornar o tempo para trás também reinicia o golpe. O visualizador faz isso no botão Atacar.

A animação não aplica dano ou deslocamento de mundo. A frente da criatura é **+Z local**. Se o jogo estiver deslocando o modelo em −Z, o ajuste deve ser feito no controlador do ABRIGO, que não foi fornecido. Para um controlador sem física, o avanço pode ser aplicado com `model.root.translateZ(velocidade * deltaEmSegundos)`; com Rapier, aplique a direção +Z local transformada pela rotação do personagem ao controlador físico. Não desloque simultaneamente por esses dois caminhos.

O ciclo da demonstração utiliza aproximadamente 0,339 m/s para caminhar e 0,831 m/s para correr, para acompanhar o passo visual. O jogo define a velocidade real e pode ajustar o passo para reduzir deslizamento dos pés. O jogo deve resolver o acerto próximo de 0,38 s após iniciar o ataque, usando colisões e alcance próprios; esse instante é uma referência de animação, não um sistema de combate implementado. Há um avanço visual local de até 0,075 m que retorna à origem. A posição de mundo continua sob controle do jogo.

Sockets: `head`, `mouth`, `back`, `target`, `handL`, `handR`, `footL`, `footR`. Nós principais: `pelvis`, `chest`, `neck`, `head`, `jaw`, `shoulderL/R`, `elbowL/R`, `handL/R`, `hipL/R`, `kneeL/R`, `footL/R`. L e R representam os lados anatômicos da criatura.

## Validação e limites

Verificado com Three.js r186 e TypeScript estrito: receitas das oito espécies, orientação das palmas e polegares no espaço de mundo, avanço do pé no ar e recuo durante apoio, espelhamento geométrico das mãos e dos pés, curvatura palmar das falanges, recursos registrados, números finitos, proporção compacta da cabeça e cavidades das órbitas em vários pontos por raycast, comprimentos constantes das pernas, contato com o chão, ataque repetido, retorno do ataque, imutabilidade da geometria e orçamento de malhas. O despachante `createCreature` foi testado para o esqueleto nos dois detalhes, incluindo escala, estatísticas e descarte idempotente. Os módulos das outras criaturas foram substituídos por stubs apenas nesse teste isolado; a aplicação ABRIGO completa não foi executada.

As PNGs usam projeção ortográfica e um rasterizador CPU com teste de profundidade e iluminação simples. O HTML usa WebGL e materiais físicos; a iluminação pode diferir. O visualizador foi compilado, mas não foi executado com WebGL neste ambiente.

Esta é uma reconstrução procedural a partir de uma única imagem, não uma reprodução exata da malha original. Laterais, costas, profundidades e articulações ocultas foram inferidas. A bacia, o contorno do crânio, a curvatura das costelas e o formato dos dedos ainda podem ser ajustados comparando estas vistas com novas referências.

## Reproduzir testes e vistas

O diretório `render` contém um ambiente isolado. O seu `schema.ts` tem apenas `seededRandom` para permitir testar receitas; **não substitua o `schema.ts` do ABRIGO por esse arquivo**.

A partir da pasta principal extraída:

```sh
cd render
npm install
npm run check
npm run verify
npm run project
cd ..
python3 render/raster_geometry.py frente lateral tres-quartos traseira cranio cranio-frente cranio-lateral torax mao mao-L bacia pe
```

Python requer `numpy` e `Pillow`. O script de projeção também produz os quadros `attack-0` a `attack-11`, que podem ser rasterizados pelo mesmo comando. A versão do Three.js está fixada no `package.json` do ambiente de testes.
