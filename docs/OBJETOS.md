# Objetos — protótipo com o fluxo do img2threejs

Terceira área do editor, ao lado de Personagens e Criaturas (`?mode=objects`). Segue a forma de trabalho do [img2threejs](https://github.com/img2threejs/img2threejs) (referência → leitura da imagem → blockout → peças → revisão → código Three.js), com **uma diferença de propósito: as etapas caras rodam no navegador, sem IA**. O objetivo é criar objetos de formas simples gastando o mínimo de créditos.

## Fluxo de trabalho (painel da esquerda, em 3 passos)

1. **Imagem de referência** → *Carregar imagem*.
2. **Como gerar** → *Método* (Auto usa a sugestão; Revolução, Extrusão, Blocos), *Nível de detalhe* (Baixo, Médio, Alto), *Altura real* e *Espessura*.
3. **GERAR OBJETO** → relê a imagem no nível escolhido, cria as peças, compara com a silhueta e mostra o resultado (nota, peças, triângulos, tempo). Escolher opções não gera nada; só o botão gera.

| Nível | Resolução | Cores | Faixas | Contorno | Furos e decalques |
|---|---|---|---|---|---|
| Baixo | 320 px | 3 | até 5 | simplificado | não |
| Médio | 480 px | 5 | até 8 | fiel | sim |
| Alto | 720 px | 7 | até 14 | muito fiel | sim |

No nível Médio/Alto: **furos** recortados nas extrusões (uma alça vazada; um rótulo vira peça dentro do recorte, sem sobreposição); na Revolução, **faixas vazadas** (alça em arco) viram placa recortada em vez de cúpula, e **decalques** finos na frente mostram regiões que não dão a volta (moldura, janela, rótulo). Partes soltas da silhueta (alça separada do corpo) são mantidas.

### Detalhes de cada etapa


1. **Referência:** "Carregar imagem". O ideal é o objeto de frente, sobre fundo liso ou PNG transparente. A imagem fica **só na memória** (não é salva nem exportada).
2. **Leitura automática** (`src/object-analysis.ts`, equivalente leve do *stage1 intake* do img2threejs):
   - remove o fundo (transparência ou cor da borda) e mantém a maior região;
   - mede a silhueta linha a linha, o eixo e a simetria (ponderada pela largura);
   - separa **faixas de cor** horizontais e **regiões de cor** 2D (k-means + filtro de maioria);
   - sugere o método.
3. **Blockout automático** com três métodos:
   - **Revolução:** uma peça `lathe` por faixa de cor. Para objetos redondos: garrafa, lata, lampião, barril.
   - **Extrusão:** uma peça `extrude` por região de cor, com o **contorno real** (rastreamento de borda + simplificação). Para objetos chatos: machado, faca, placa, ferramenta.
   - **Blocos:** uma caixa por faixa. Para móveis e caixotes.

   A **altura real** (m) define a escala; a **profundidade** vale para a extrusão.
4. **Peças:** lista, seleção por clique na prévia, posição/rotação/tamanho, cor, aspereza, metal, chanfro, espelhamento em X e edição dos pontos (perfil, contorno ou caminho) em JSON. Dá para adicionar, duplicar e excluir peças, com desfazer/refazer.
5. **Revisão** (equivalente ao *vision review* do img2threejs, mas sem IA): renderiza a silhueta do modelo na vista de frente com o mesmo enquadramento da referência e calcula a sobreposição (IoU). Um mapa mostra o que coincide, o que falta e o que sobra. A nota fica em `source.silhouetteScore`.
6. **Exportar:**
   - receita `.objeto.json`;
   - **código TypeScript** com uma função `createXModel()` em Three.js puro, sem loaders nem arquivos, como o `generate_threejs_factory` do img2threejs;
   - **pedido econômico para IA:** copia um texto curto (esquema + receita + seu pedido) para qualquer LLM responder **só com o JSON**. A resposta é colada e aplicada. Gasta centenas de tokens em vez de milhares com código.

Modelos iniciais (escritos como dados, não como código): lampião, cantil, caixa de madeira, machado e barril.

## Receita (`src/object-schema.ts`)

```json
{"kind":"object","schemaVersion":1,"name":"Machado","category":"tool","wear":0.4,
 "parts":[{"id":"…","name":"Cabo","shape":"tube","position":[0,0,0],"rotation":[0,0,0],"size":[0.013,0,0],
           "color":"#7a5733","roughness":0.8,"metalness":0,"bevel":0.2,"path":[[0,0,0],[0,0.42,0]]}],
 "sockets":[{"name":"grip","position":[0,0.12,0],"rotation":[0,0,0]}]}
```

- **Formas:** `box`, `cylinder`, `cone`, `sphere`, `capsule`, `torus`, `lathe` (`profile`), `extrude` (`outline`) e `tube` (`path`). O significado de `size` por forma está em comentário no esquema e no texto do pedido para IA.
- **Unidades e eixos:** metros, +Y para cima, +Z para a frente, base em y=0. Máximo de 64 peças.
- **`sockets`:** `grip` é o ponto da mão, compatível com `handR` do personagem.

## API (em `dist/character.module.js`)

`createObject(spec, {detail:'low'|'high'})` → `{root, nodes, sockets, stats, detail, update, dispose}`. Também exporta `objectToTypeScript`, `validateObjectSpec`, `presetObject`, `OBJECT_PRESETS` e `analyzeImage`/`blockout`/`silhouetteIoU` (funções puras sobre pixels RGBA).

## Testes

`npm run test:objects`. As imagens de teste são **sintéticas, desenhadas em código** (uma garrafa e um machado). O teste confere a sugestão de método, os três blockouts na altura certa, a IoU, todos os modelos e formas nos dois níveis, que o código exportado não tem loaders nem arquivos, a validação e a ida e volta do JSON. `npm test` roda objetos, criaturas e personagens.

Resultados medidos: garrafa → Revolução com **98%** de silhueta; machado → Extrusão por regiões com **92%**.

## Limites do protótipo

- A leitura usa **uma vista** (de frente). A profundidade é estimada: redonda na revolução, uniforme na extrusão.
- Fundos com textura, sombras fortes ou objeto em perspectiva prejudicam o recorte.
- O desgaste é só pintura por vértice; o código exportado não inclui o desgaste.
- Ainda não usa as funções extraídas do img2threejs (SDF com união suave, Catmull-Clark, decimação). Elas são o próximo passo para formas orgânicas e LOD automático (ver `docs/IMG2THREEJS_ANALISE.md`).

## Próximos passos sugeridos

1. Segunda vista (lateral) para estimar a profundidade por região.
3. Vendorizar `polygonizeSdf` + `smin` para objetos orgânicos (pedra, tronco, cogumelo) e `decimateGeometry` para o nível leve.
4. Catálogo de objetos salvos (como os tipos de rosto) e integração com a mão do personagem pelo socket `grip`.

## Fábricas Three.js e o img2threejs-showcase (27/09/2026)

`dev/fabricas.html` (só desenvolvimento) abre qualquer módulo em `factories/` que exporte `createXModel()` — o contrato do img2threejs e da galeria [img2threejs-showcase](https://github.com/hoainho/img2threejs-showcase): mostra o modelo, mede malhas/triângulos/materiais/tempo, alerta se usar loaders ou `fetch`, roda `userData.tick` e compara a silhueta com uma imagem de mesmo nome. Ver `factories/README.md`.

- Verificado: um modelo da galeria (baú) rodou **sem alterações** no Three.js 0.186 (66 malhas, 29.672 triângulos, sem arquivos). A cópia usada no teste foi apagada.
- **A galeria não tem licença publicada**: nenhum código dela foi copiado para o projeto. `factories/` fica fora do build e do versionamento.
- As exportações da aba Objetos (`Exportar → Código TypeScript`) seguem o mesmo contrato; `factories/exemplo-*` são dois exemplos nossos.
