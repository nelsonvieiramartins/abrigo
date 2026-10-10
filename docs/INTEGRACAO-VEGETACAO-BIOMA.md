# Terreno e Vegetação — integração do Bioma

Origem: projeto local `../../src/main.js` e `../../src/world/water.js` (Bioma Floresta 0.33.0). O projeto original não foi modificado.

## Recursos reaproveitados

- `extras/bioma/forest-primitives.js`: as oito configurações EZ-Tree (preset, semente, altura, cor, quantidade e tamanho das folhas), vento de galhos e folhas, geometria das lâminas de grama, vento da grama e texturas de solo em canvas.
- `extras/bioma/water-primitives.js`: tabela única de ondas, altura e normal analítica, GLSL gerado dessa tabela e textura periódica de normais. A adaptação mantém o recorte do pincel existente, profundidade, velocidade, direção e rota da correnteza. Usa dupla amostragem de normais, material físico com IOR 1.333, espuma de margem e uma reflexão cúbica de 128 px, atualizada a cada 30 quadros.
- Pedras deformadas, musgo e mato em lâminas seguem as formas e cores do Bioma. A resolução das pedras foi reduzida para permitir sua distribuição em massa no editor.
- EZ-Tree está fixado na versão MIT 1.1.0, a mesma do projeto original. Suas texturas são embutidas no pacote; o HTML offline inclui a licença.

## Fluxo

A guia Vegetação fica ao lado de Terreno e Efeitos. Biblioteca e seleção de variações ficam à esquerda; ferramentas de distribuição, raio, quantidade, espaçamento, escalas e semente ficam à direita. Há pincel, apagador por tipo, distribuição pelo mapa inteiro e limpeza por tipo.

A distribuição é determinística para a mesma semente, ordem de aplicações, terreno e configurações. A semente gera posições, rotações, escala e escolha entre as oito variantes. Árvores reutilizam duas malhas instanciadas por variante; suas geometrias são geradas apenas quando necessárias e reutilizadas entre pinceladas. O limite manual é 1200 elementos por mapa, além dos detalhes automáticos do terreno.

Água, neve, ruas e caminhos são excluídos da vegetação visível; novas aplicações também evitam encostas íngremes. Repaintar uma superfície não apaga o registro de vegetação: ele fica oculto e reaparece se a superfície voltar a ser compatível. As raízes e o mato acompanham a altura renderizada do terreno; as pedras são assentadas usando seus limites inferiores.

No Teste de Jogo, os troncos das árvores e as pedras com diâmetro de pelo menos 1,2 m têm colisores circulares com limites verticais, usados também pelas criaturas do combate. Os troncos acompanham a geometria e a escala das árvores; arbustos, grama, pedrinhas do terreno e pedras menores permanecem atravessáveis. Os colisores são reconstruídos com a vegetação/relevo e somem junto aos elementos ocultos ou removidos. O botão Colisão ON/OFF continua controlando o bloqueio do jogador. A vegetação ainda não é alvo de corte.

## Compatibilidade

Mapas v1 antigos continuam válidos. Os novos campos opcionais `vegetation` e `visual` são validados, exportados em JSON, guardados no rascunho/biblioteca e restaurados no Teste de Jogo. Terreno, pincéis, meios-fios, correnteza, efeitos, referência por imagem, câmeras, grade, desfazer/refazer e mapas nomeados continuam disponíveis. O estilo clássico permanece selecionável; as configurações gráficas também são salvas com o mapa.

Não foram importados clima, áudio, combate ou a aplicação inteira do Bioma. A água usa a malha editável atual, não os lagos elípticos fixos do original.

## Verificação

`node scripts/test.mjs --game-map`: distribuição determinística, espaçamento, limites, variedades, geometria da grama, ondas/normais, JSON antigo e novo, assentamento de grama, mudanças de relevo, estilo gráfico, descarte e regressões de terreno/efeitos/armazenamento/física.

`npm run build`: gera o editor offline com EZ-Tree e licenças embutidos.

Validação visual no navegador: oito árvores instanciadas, água pintada com reflexos, guias e ferramentas, desfazer/refazer, recarregamento e mapa salvo no Teste de Jogo.
