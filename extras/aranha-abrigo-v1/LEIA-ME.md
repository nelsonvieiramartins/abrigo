# Aranha procedural para ABRIGO — complemento v1

Implementação feita sobre os arquivos enviados nesta conversa. Toda a geometria da aranha é criada por código; não há GLB, OBJ ou modelo externo. A referência é a aranha low poly criada nesta conversa: abdômen volumoso, cabeça menor, dois olhos escuros, oito patas angulares e duas presas curtas.

## Instalação

1. Faça backup de `creature.ts` e `creature-schema.ts` no projeto.
2. Coloque `spider-detail.ts` na mesma pasta dos geradores atuais.
3. Aplique as alterações do arquivo `integracao.patch` ou substitua `creature.ts` e `creature-schema.ts` pelas cópias incluídas, se seus arquivos ainda forem os mesmos enviados. Não aplique as duas opções.
4. Importe `aranha-da-mata.criatura.json` no editor de criaturas.
5. Se a interface mantém uma lista própria de espécies, acrescente `spider` a essa lista. Se usa `CREATURE_SPECIES`, a entrada já está incluída. Eventuais mapas tipados de todas as espécies em outros arquivos também precisam de uma entrada para aranha.
6. Use `createCreature(receita, {detail: 'high'})`. O despacho para aranha acontece antes dos outros construtores em ambos os modos de detalhe.

Os módulos existentes (`schema`, `wolf-gait`, outros geradores e Three.js) continuam sendo os do projeto. O pacote não contém o projeto ABRIGO completo.

## Conferir a geometria antes de integrar

Abra `visualizador-aranha.html` em Chrome ou Edge, inclusive com duplo clique. Ele inclui Three.js e a geometria no próprio arquivo, sem depender de CDN. Arraste para girar, use a roda para zoom e os botões para andar ou mostrar a malha. Requer WebGL.

`aranha-render-real.png` mostra a malha produzida pelo código usando o SVGRenderer do Three.js. Sua iluminação é simplificada e sem sombras; o visualizador usa WebGL. Esta imagem não foi criada por IA. A captura permite conferir a silhueta, mas não é uma verificação do renderizador do ABRIGO.

## Formato e compatibilidade

Mantém `kind: 'creature'` e `schemaVersion: 1`. O bloco opcional `spider` é uma extensão do esquema nesta versão modificada; um ABRIGO sem este complemento não reconhece a espécie.

Para `spider`, os controles básicos de `CREATURE_FIELDS` são:

| Campo | Significado | Intervalo |
|---|---|---|
| anatomy.legs | Comprimento das patas | 0,7–1,3 |
| anatomy.spread | Abertura lateral | 0,7–1,3 |
| anatomy.thickness | Espessura das patas | 0,7–1,3 |

Todos são multiplicadores: 1 é a referência. `legs` não é a quantidade de patas; o construtor cria sempre oito.

O bloco opcional `spider` admite os controles abaixo, todos entre 0,7 e 1,3:

| Campo | Ajuste |
|---|---|
| abdomenWidth / abdomenHeight / abdomenLength | Largura, altura e comprimento do abdômen |
| headWidth / headHeight / headLength | Proporções da cabeça |
| bodyHeight | Altura do corpo e joelhos |
| legLength | Comprimento da extensão horizontal das patas |
| legSpread | Abertura lateral |
| legThickness | Espessura |
| eyeSize | Tamanho dos olhos |

Quando fornecidos, `spider.legLength`, `spider.legSpread` e `spider.legThickness` prevalecem sobre os correspondentes em `anatomy`. Para usar os sliders básicos sem conflito, omita esses três campos do bloco `spider` ou sincronize ambos na interface. Os controles avançados não ganham sliders automaticamente: edite o JSON ou adicione campos à interface.

`body.scale` dimensiona o modelo inteiro; `body.bulk` altera o volume lateral. As cores vêm de `appearance`. `markings` controla a variação discreta por face. A semente é preservada para compatibilidade, mas não altera aleatoriamente a silhueta da aranha.

## Movimento e integração

Orientação +Z, eixo vertical +Y, unidades em metros. O deslocamento global pertence ao jogo.

`update(time, 'idle'|'move'|'run'|'attack')` usa o contrato atual. A marcha alterna grupos de patas e calcula o joelho por cinemática inversa de dois segmentos. `attack` anima a cabeça; dano, veneno e colisões continuam sob controle do jogo. Não adiciona física nem hitboxes.

Sockets: `head`, `mouth`, `back`, `target`. Nodes das patas: `legL1` a `legL4`, `legR1` a `legR4`, mais sufixos `Femur`, `Tibia` e `Knee`. Os recursos entram nos conjuntos de descarte existentes.

## Validação e limites

- TypeScript estrito: esquema e gerador da aranha passaram.
- Modos low/high: 1.224 / 1.704 triângulos da aranha, respectivamente.
- Contagem de oito patas e posições finitas verificadas.
- Quatro movimentos amostrados por 120 quadros, nas proporções padrão e numa combinação extrema.
- Apoio das pontas das patas em repouso acima do plano Y=0 verificado.
- Valores fora do intervalo rejeitados; JSON sem bloco spider recebe padrões.
- Malha inspecionada em renderização estática.

A aplicação completa do ABRIGO não foi executada porque seus demais módulos e interface não foram enviados. O visualizador foi empacotado, mas seu WebGL não pôde ser executado aqui: não havia navegador disponível. A forma é uma aproximação explícita da referência e ainda exige comparação visual dentro do jogo para validar fidelidade. Iluminação, câmera e materiais do projeto podem mudar a aparência.

A licença MIT de Three.js, usado pelo visualizador, está em `THREE-LICENSE.txt`.
