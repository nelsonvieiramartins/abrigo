# Engenheira

Base `engineer` ("Conserta o que o mundo quebrou."), feita a partir de duas referências: retrato do rosto e corpo inteiro em pose A.

## Peças novas na biblioteca

Todas podem ser usadas em qualquer personagem, não só na Engenheira.

| Onde no editor | Opção | O que gera |
|---|---|---|
| Roupas › Camisa | `engineer` — Camisa e corpete | Camisa marfim com decote em V, gola aberta com contorno e gola alta atrás, colar dourado com pingente, mangas dobradas logo abaixo do cotovelo; corpete abaixo do busto na **cor da roupa**, com ponta na frente, borda dobrada, costuras, duas colunas de botões dourados com fechos escuros; arreio de couro sobre os ombros com fivelas quadradas. |
| Roupas › Calçado | `tallboots` — Botas altas de cadarço | Cano que segue a perna até abaixo do joelho, dobra com fivela oval, cadarço em zigue-zague (vermelho) com ilhoses dourados e laço. |
| Pelos › Corte | `tousled` — Repicado | Lâminas facetadas: franja lateral até as sobrancelhas, mechas até a mandíbula com pontas viradas para fora, algumas pontas no topo. |
| Feições › Nariz | `small` — Pequeno | Nariz menor e mais curto. |
| Feições › Queixo | `vshape` — Pontudo | O rosto mantém o formato até abaixo da boca; só a base da mandíbula fecha com lados levemente curvos numa ponta um pouco mais baixa (formato "V"). O tamanho do queixo alarga ou afina a ponta. |
| Feições › Boca | `shaped` — Desenhada | Arco do cupido no lábio de cima (dois picos e uma leve depressão), lábio de baixo mais cheio, cantos finos levemente erguidos num meio sorriso. Funciona com todas as expressões. |
| Pelos | `appearance.makeup` — Delineado e batom | Delineado alado preso à pálpebra (fecha junto no piscar) e lábios mais vermelhos. |
| Kit | `outfit.gloves` — Luvas de couro | Mão e dedos em couro, sem unhas, punho com três tiras enroladas. |
| Kit | `outfit.toolBelt` — Cinto de ferramentas | Cinto de couro com fivela de engrenagem, segundo cinto na diagonal com fivela, duas bolsas com rebites, tiras nas coxas com fivela, argola de chaves. |

Os três campos booleanos são opcionais no JSON: arquivos antigos carregam com `false`.

## Regras respeitadas

- Nenhuma opção nova entra no sorteio (`randomCharacter`); o teste em `tests/core.ts` confere 300 sementes.
- Peças sobre o tronco usam `chestFront`/`torsoAt` (seguem busto e forma do corpo); bota e tiras da coxa usam `hug()`, que mede a malha real da perna.
- Alto detalhe: ~58,5 mil triângulos (limite de 60 mil). O orçamento está no limite; peças novas pesadas precisam compensar em outro lugar.

## Inspeção

`dev/retrato.html?preset=engineer` (corpo), `&portrait=1` (rosto grande), `&eye=1` (olho de perto), `&chest=1&close=1`, `&legs=1`, `&motion=run&t=4.3`, `&detail=uhd`.
