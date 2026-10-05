# Escorpião procedural para ABRIGO — complemento v1

Gerador feito sobre os arquivos fornecidos e o complemento da aranha v2. Geometria 100% criada por código, com oito patas, dois pedipalpos com pinças, sete seções de carapaça e cinco segmentos de cauda com ferrão. Formas facetadas, tons terrosos e silhueta baseados na referência do escorpião desta conversa. É uma aproximação a validar dentro do jogo, não uma reconstrução exata da imagem.

## Instalar

Se já instalou a aranha v2:

1. Acrescente `scorpion-detail.ts` à pasta dos geradores.
2. Aplique `integracao-sobre-aranha-v2.patch` aos arquivos atuais, ou substitua `creature.ts` e `creature-schema.ts` pelas cópias incluídas, se ainda coincidirem com a aranha v2. Não faça as duas opções.
3. Importe `escorpiao-da-mata.criatura.json`.

Se ainda usa os arquivos originais enviados nesta conversa:

1. Acrescente `scorpion-detail.ts` e `spider-detail.ts` à pasta dos geradores.
2. Aplique `integracao-sobre-original.patch` ou use as duas cópias atualizadas de `creature.ts` e `creature-schema.ts`.
3. Importe o JSON do escorpião.

Faça backup antes de substituir arquivos. Se a interface tiver uma lista própria de espécies, acrescente `scorpion`; se usar `CREATURE_SPECIES`, a entrada já está incluída. Mapas tipados que enumeram todas as espécies em outros arquivos precisam da nova entrada. O restante do ABRIGO não está incluído: os módulos e a versão de Three.js continuam sendo os do seu projeto.

```ts
const model = createCreature(receita, {detail: 'high'});
scene.add(model.root);
model.update(tempoDoJogo, 'idle');
```

O gerador aceita low e high; ambos usam faces planas. Não altera a aranha v2 nem os geradores existentes.

## Visualizador

Abra `visualizador-escorpiao.html` com duplo clique em Chrome ou Edge. Three.js, geometria e controles estão incluídos; não usa CDN. Arraste para girar, roda para zoom, botões para andar, atacar ou mostrar a malha. Requer WebGL.

`escorpiao-render-real.png` e `escorpiao-ataque.gif` vêm da geometria real renderizada pelo SVGRenderer do Three.js, com luz simplificada e sem sombras. Não são imagens geradas por IA. O visualizador usa WebGL e pode apresentar iluminação diferente.

## JSON

Mantém kind `creature`, schemaVersion `1`, espécie `scorpion`. Este esquema estendido precisa do complemento para reconhecer a espécie.

Controles básicos em `anatomy`: `legs` (comprimento), `spread` (abertura), `thickness` (espessura das patas) e `tail` (comprimento vertical da cauda). Todos entre 0,7 e 1,3; 1 corresponde às proporções de referência. A quantidade de patas é fixa em oito.

Bloco opcional `scorpion`, com todos os valores entre 0,7 e 1,3:

| Campo | Função |
|---|---|
| bodyWidth | Largura da carapaça |
| bodyLength | Comprimento do corpo |
| bodyHeight | Altura do corpo e articulações |
| legLength | Extensão horizontal das patas |
| legSpread | Abertura lateral |
| legThickness | Espessura das patas |
| clawSize | Tamanho das pinças |
| clawReach | Alcance dos braços das pinças |
| clawOpening | Abertura geométrica das pinças |
| tailLength | Extensão vertical da cauda |
| tailThickness | Espessura dos segmentos da cauda |
| stingerSize | Tamanho do ferrão |

Valores explícitos em `scorpion` prevalecem sobre os básicos correspondentes. Para usar apenas os sliders de anatomia, remova `legLength`, `legSpread`, `legThickness` e `tailLength` do bloco avançado ou sincronize esses valores na interface. Os controles avançados são editados pelo JSON; não foram acrescentados sliders à interface que não foi enviada.

`body.scale` dimensiona tudo, `bulk` altera volume lateral, `appearance` define cores e variação discreta por face. A seed é preservada, mas não deforma aleatoriamente a silhueta.

## Marcha e ataque

+Z para frente, +Y vertical, unidades em metros. O root e deslocamento global pertencem ao jogo. Recursos são registrados nos conjuntos existentes para descarte.

`idle`, `move`, `run` e `attack` seguem o contrato atual. A marcha alterna grupos de quatro patas com joelhos calculados por cinemática inversa. O ataque dura aproximadamente 1,05 s: preparação, pinças fechando, golpe de cauda para a frente e retorno. O body avança localmente até 6,5 cm; root não se desloca.

```ts
// Início do ataque: entrar neste estado e avançar um relógio local.
model.update(tempoDesdeInicioDoAtaque, 'attack');
// Ao completar 1,05 s:
model.update(tempoDoJogo, 'idle');
```

Um golpe é disparado ao entrar em attack. Para repetir, passe por outro estado. Recuar o tempo reinicia o golpe para edição de timeline.

Sockets: `head`, `mouth`, `back`, `target`, `stinger`. Use o socket `stinger` para consultar posição mundial do ferrão. Janela visual de impacto: aproximadamente 0,40–0,48 s. Dano, veneno, alcance, alvo, colisões e física são responsabilidade do jogo. Este complemento não aplica dano.

## Verificações

- TypeScript estrito do esquema e de ambos os geradores passou.
- 1.872 triângulos em low e 4.208 em high.
- Oito patas, duas pinças e socket do ferrão verificados.
- Geometria e matrizes finitas em 120 amostras de cada um dos quatro movimentos, nas proporções padrão e numa combinação extrema.
- Apoio das pontas das patas em repouso verificado acima do plano Y=0.
- Ataque verificado: avanço do ferrão, retorno da cauda, novo disparo e limpeza das transformações ao sair do estado.
- Presets e receitas aleatórias das sete espécies passam pelo validador. Valores avançados inválidos são rejeitados; bloco scorpion ausente recebe padrões.
- Renderizações reais em repouso e durante o golpe inspecionadas.

Não foi possível executar o ABRIGO completo: faltam os outros módulos e a interface. O HTML foi empacotado, mas seu WebGL não foi executado aqui porque o navegador não está disponível. A fidelidade e o comportamento devem ser conferidos dentro do projeto, inclusive em combinações de parâmetros não cobertas pelas verificações.

Licença MIT do Three.js usado no visualizador: `THREE-LICENSE.txt`.
