# ABRIGO — Criador de personagens: estado atual e próximos passos

Documento de passagem de contexto. Serve para continuar o trabalho em outra sessão ou em outro modelo sem precisar reconstruir o histórico. Leia inteiro antes de mexer no código: a seção **Armadilhas conhecidas** registra erros que já aconteceram mais de uma vez.

Última atualização: 26/09/2026.

**Lenhador (29/09/2026):** preset `lenhador`, peças `lumber` em cabelo/barba/roupa e estilo opcional `faceted`. Ver `docs/LENHADOR.md` e `src/lumber-detail.ts`. A aba Corpo permite escolher o estilo da malha. Opções novas continuam fora do sorteio histórico. Referência interpretada por geometria procedural, com jaqueta curta e xadrez por vértices.

**Extensão de criaturas (26/09/2026):** agora há uma área separada de Criaturas no editor, com lobo, morcego, enxame de vespas e cobra. Antes de alterar essa área, leia `docs/CRIATURAS.md`: contém esquema, API, animações, testes e limitações. Os arquivos novos são `src/creature-schema.ts`, `src/creature.ts`, `src/creature-editor.ts` e `tests/creatures.ts`. A prévia de `src/scene.ts` é compartilhada entre os dois editores. O formato original dos personagens e seu gerador foram preservados.

**Refinamento HD das quatro espécies:** geradores próprios em `wolf-detail.ts`, `bat-detail.ts`, `swarm-detail.ts` e `snake-detail.ts`. O enxame HD utiliza três InstancedMesh; a prévia SVG precisa de `instancing: false`, selecionado em `scene.ts`. Ao contabilizar triângulos, multiplicar por `InstancedMesh.count`; ao descartar, liberar também `InstancedMesh.dispose()`. Os limites e números medidos estão em `docs/CRIATURAS.md`.

**Pintor (27/09/2026, feito no GPT):** base `pintor` e roupa `painter` (colete, suspensórios, bolsa), pescoço corrigido para todos os personagens. Ver `docs/PINTOR.md`. Corrigido depois: `painter` e `pintor` estavam no sorteio e mudavam o que as sementes antigas geram; agora ficam fora (teste de semente fixa em `tests/core.ts`). **Regra: opção nova nunca entra no sorteio principal.**

**Engenheira (27/09/2026):** base `engineer` com peças novas na biblioteca: roupa `engineer` (camisa marfim aberta + corpete), calçado `tallboots`, cabelo `tousled`, nariz `small`, e os campos opcionais `outfit.gloves`, `outfit.toolBelt` e `appearance.makeup` (arquivos antigos carregam com `false`). Todos fora do sorteio. Ver `docs/ENGENHEIRA.md`.

**Imagem → Three.js (28/09/2026):** toda a pesquisa sobre o img2threejs (o que é, o que já usamos, o piloto do lobo, o Prompt Kit do site e o plano de melhorias com API de IA) está em `docs/IMG2THREEJS_PESQUISA.md`; os 4 prompts canônicos estão em `docs/img2threejs-prompts/`. Comece por lá antes de mexer na aba Objetos ou em `factories/`.

**Modo avançado do rosto (28/09/2026):** caixa "MODO AVANÇADO" na aba Feições mostra 34 ajustes finos (rosto, queixo, olhos, sobrancelhas, nariz, boca, orelhas), gravados em `appearance.fine` (opcional, cada valor de -1 a 1, 0 = preset puro). A lista fica em `FINE_FACE` (`src/schema.ts`); cada chave é lida com `F('chave')` em `src/character.ts`. Os dropdowns continuam como presets e os ajustes somam por cima. Tipos de rosto salvos guardam os ajustes; escolher um tipo sem ajustes zera `fine`. Para acrescentar um ajuste: item em `FINE_FACE` + uso de `F()`; o teste em `tests/core.ts` exige que cada chave mude o rosto nos dois extremos. `dev/retrato.html?fine=eyeSize:1,noseTip:-.5` mostra combinações.

**Área Objetos (27/09/2026):** terceira área do editor (`?mode=objects`) com o fluxo do img2threejs feito localmente: imagem → silhueta/cores → blockout automático (revolução, extrusão por regiões, blocos) → edição de peças → revisão por IoU da silhueta → JSON / código TypeScript / pedido curto para IA. Arquivos `src/object-schema.ts`, `src/object.ts`, `src/object-analysis.ts`, `src/object-editor.ts`, `tests/objects.ts`. Leia `docs/OBJETOS.md` e `docs/IMG2THREEJS_ANALISE.md`.

**Morcego reconstruído (27/09/2026):** novo `src/bat-detail.ts` baseado em referência fotográfica (asa em “M” com quatro dedos e bordas recortadas, corpo e orelhas menores). Folha de inspeção de criaturas em `dev/criatura.html` (`?species=wolf|bat|swarm|snake&motion=&t=&zoom=&bg=light&detail=`).

**Relatório atualizado:** `docs/test-results.json` registra 922 instâncias de personagens, 64 construções de criaturas, métricas por espécie e os testes de anatomia refinada. Ao modificar um gerador, atualize o relatório somente após executar `npm test`.

---

## 1. Contexto do projeto

- **O que é:** editor de personagens procedurais em Three.js para um jogo isométrico de sobrevivência, com visual inspirado em Project Zomboid (low-poly estilizado, legível de cima).
- **Onde fica:** `ABRIGO-criador-personagem-v1/ABRIGO-v1/`, dentro da pasta do jogo (`_PROJETO JOGO ISOMETRICO TESTE`).
- **Situação:** desenvolvido **isolado** do jogo. A integração ao mapa é o objetivo final, mas ainda não foi feita. As decisões técnicas já levam isso em conta: mesma versão do Three.js do jogo, API de módulo e pontos de fixação.
- **O jogo** (raiz da pasta, `bioma-floresta-isometrica`) usa Three.js 0.186, Rapier (física), `anima3d` (animação), `@dgreenheck/ez-tree` (árvores) e `postprocessing` (pós-processamento da floresta).
- **Idioma:** o usuário escreve em português. Interface, textos e documentação ficam em português; comentários no código ficam em inglês, seguindo o padrão existente.

### Como rodar

```sh
cd ABRIGO-criador-personagem-v1/ABRIGO-v1
npm ci
npm run dev      # http://localhost:5173/
npm test         # bateria completa (~920 personagens; leva alguns minutos)
npm run build    # gera ABRIR_EDITOR.html (offline, autônomo) e dist/character.module.js
```

Requisito: Node 22.12 ou superior (usado: 24.13). Não há repositório git nesta pasta.

---

## 2. Arquitetura

| Arquivo | Linhas | Papel |
|---|---|---|
| `src/character.ts` | ~1130 | **Tudo que gera o personagem**: geometria, materiais, cabelo, rosto, roupas, rig, animações, expressões. É o arquivo principal. |
| `src/schema.ts` | ~125 | Tipos, opções (`OPTIONS`), validação/migração de JSON (`validateSpec`), bases (`presetCharacter`), tipos de rosto (`FACE_TYPES`), sorteio por semente. |
| `src/scene.ts` | ~95 | Prévia: câmera ortográfica, luzes, sombras, níveis de detalhe, UHD com pós-processamento, captura PNG e folha de 8 direções. |
| `src/main.ts` | ~145 | Interface: abas, controles, histórico, rascunho, tipos de rosto salvos, expressões. HTML gerado por template string. |
| `src/postfx.ts` | ~20 | Cópia da cadeia de pós-processamento da floresta do jogo (`src/postfx.js` da raiz), com os mesmos valores. Usada só no UHD. |
| `src/api.ts` | 4 | Exportações públicas para integração. |
| `src/vendor/taperedSweep.ts` | — | `buildTaperedSweepGeometry` extraído do img2threejs (Apache-2.0). **Não editar**: é código de terceiros; adapte no chamador. |
| `src/generated/anatomy.json` | — | Proporções canônicas geradas pelo img2threejs (`eyeLine`, `noseBase`, `mouthLine`, larguras). |
| `dev/retrato.html` + `dev/retrato.ts` | ~75 | **Folha de inspeção** só de desenvolvimento (ver seção 5). |
| `tests/core.ts` | ~130 | Testes de regressão (ver seção 6). |
| `docs/INTEGRACAO.md` | — | Como usar o módulo no jogo. |

### Coordenadas e escala

- Metros; **+Y para cima, +Z para a frente** do personagem. Direita/esquerda são as do personagem.
- O modelo é construído com cerca de 1,75 m e escalado pela altura em `root.scale`.
- A cabeça tem espaço próprio: y de 0 (queixo) a ~0,26 (topo); o rosto olha para +Z.

### Hierarquia (rig rígido)

```
root
└ hips (body) ─ spine (trunk) ─ head ─ eyeR/eyeL (grupos de olho)
   │             ├ upperArmR/L ─ lowerArmR/L ─ handR/L ─ hand-shape (escala 1,15 no HD)
   ├ upperLegR/L ─ lowerLegR/L ─ footR/L
sockets: handR, handL, back, head, belt
```

- **Não é SkinnedMesh.** Cada peça é uma malha filha de um grupo-junta. As emendas (joelho, cotovelo, quadril, tornozelo) são disfarçadas com esferas de articulação e sobreposição.
- `root.userData.rig.kind === 'procedural-rigid-hierarchy'`.

### Construtores de geometria (dentro de `createCharacter`)

| Função | Uso | Formato |
|---|---|---|
| `sweep(name, rings, …)` | Formas verticais (tronco, cabeça, membros) | `Ring = [y, halfWidth, halfDepth, zOffset?]` |
| `tube(name, knots, …, opts)` | Caminhos livres (dedos, alças, calçados, cabelo) | `Knot = [x, y, z, rx, rz]` |
| `ellipsoid`, `box`, `bevelBox` | Peças simples | `box` vira `RoundedBoxGeometry` no HD |
| `mesh(name, geo, mat, parent, pos, wear, opts)` | Finaliza: cor por vértice (desgaste), normais suaves no HD, registra para `dispose` | `opts: {crease, tint, lateral, roundStart}` |
| `refine(rows, steps, lock, radii)` | Subdivide estações com Catmull-Rom (é o que dá densidade no HD/UHD) | — |
| `creaseNormals(geo, angle)` | Normais suavizadas soldando costuras, com quebra acima do ângulo | — |
| `profileAt(rows)` | Amostra uma lista de anéis numa altura → `[halfWidth, halfDepth, z]` | — |

### Superfícies de referência (para peças "coladas")

- `headAt(y)`: superfície real da cabeça **depois** do formato do rosto. Usada por cabelo, barba e boné.
- `fz(y)`: quanto a frente do rosto avançou ou recuou em relação ao rosto clássico. **Tudo que fica no rosto soma `fz`**: olhos, sobrancelhas, nariz, boca, bigode, cavanhaque e óculos. `mz = fz(mouthY)`.
- `torsoAt(y)` e `onChest(x, y, lift)`: superfície do tronco, incluindo o busto, e a rotação para uma peça plana assentar no peito.
- `chestParts` / `chestFront` / `chestBand`: bolsos, abas e patches se registram como obstáculos; alças e zíperes passam **por cima** deles.

### Níveis de detalhe (`createCharacter(spec, { detail })`)

| Nível | Triângulos | Características |
|---|---|---|
| `low` | até ~5,3 mil | Malha facetada original, para multidões. Rosto de blocos. |
| `high` (padrão) | ~45–58 mil | Normais suaves, Catmull-Rom (STEPS=3), rosto completo, animação facial. |
| `uhd` | ~120–150 mil | STEPS=5, mais divisões, relevo de poros e trama (`bumpMap` via `DataTexture`), até 2.800 fios de cabelo e 1.400 de barba **instanciados** com balanço por shader (mesma técnica das folhas do EZ-Tree no jogo) e pós-processamento da floresta na prévia. |

Os três níveis têm **os mesmos nós e sockets**, então dá para trocar por distância (LOD).

---

## 3. Funcionalidades implementadas

### Editor (abas na ordem atual)
**Corpo · Pelos · Feições · Expressão · Roupas · Kit · Origem**

- **Corpo:** nome, pele, altura, constituição, ombros, quadril e **busto** (sem separação de gênero).
- **Pelos:** corte (15 estilos), cor, barba (5 opções), largura do rosto e cor dos olhos.
  - Cortes: curto, lateral, despenteado, raspado, chanel, comprido, topete, degradê, espetado, franja, para trás, médio ondulado, rabo de cavalo, careca (ferradura) e sem cabelo.
  - Barbas: sem barba, por fazer, cheia, bigode e cavanhaque.
- **Feições:** 8 tipos de rosto prontos, mais ajuste fino.
  - Formato: oval, quadrado, redondo, alongado ou coração.
  - Queixo: tipo (arredondado, quadrado, fino ou proeminente) e **tamanho**.
  - Bochechas, sobrancelhas (6), nariz (5) e boca (4).
  - **Tipos salvos pelo usuário** (sobrescrever ou criar), em `localStorage` (`abrigo-face-types-v1`).
- **Expressão** (só prévia, fora do JSON): neutra, feliz, brava, triste, cansada e surpresa, com intensidade. `actor.setExpression(nome, k)`.
- **Roupas:**
  - Parte de cima: jaqueta, camiseta, regata, moletom (capuz caído nas costas), camisa de campo e sem camisa.
  - Parte de baixo: cargo, jeans, bermuda e cueca.
  - Calçados: botas, tênis e só meias.
- **Kit:** gorro, boné, boné camuflado, mochila (alças contornando o corpo), óculos e desgaste.
- **Origem:** profissão e traços com pontos.

### Bases prontas (`presetCharacter`)
Guarda florestal, Mecânico, Socorrista, Civil, **Legendário** (camisa laranja com camuflagem, sem logotipos reais), **Exploradora** (busto, cabelo comprido) e **Pé de Pano** (cueca e meias). As bases usam os tipos de rosto **de fábrica**, nunca os salvos pelo usuário.

### Animação (`update(tempoAbsoluto, movimento)`)
- Movimentos com IK de duas juntas nas pernas:
  - Contínuos: `idle`, `walk`, `run`, `sprint` (Correr+), `pose`.
  - Ações em loop: `pickup` (pegar do chão), `jump` (saltar), `pray` (orar ajoelhado com as mãos para o alto).
- A inclinação para a frente é dividida entre a pelve e a cintura, para não abrir as costas.
- **Rosto sempre vivo** (HD/UHD), com ritmo determinístico pela semente:
  - piscar com intervalos aleatórios, às vezes duplo;
  - sobrancelhas que se movem;
  - olhar com fixação e sacadas.
- Olhos sempre abertos em `t=0` (a folha de 8 direções depende disso).

### Barra da prévia
Girar, grade, **HD**, **UHD**, **PX** (baixa resolução) e foto. Vistas: isométrica, frente, lado, costas e rosto. Atalhos de URL: `?tab=features`, `?detail=uhd`.

---

## 4. Decisões de projeto (e por quê)

1. **Tudo procedural, sem GLB nem texturas externas.** Mantém o editor leve, offline e determinístico, e facilita a variedade.
2. **Receita JSON, não malha.** O personagem é salvo como `nome.personagem.json`. Campos novos são **opcionais na validação** e recebem valor padrão (busto 0, rosto clássico, `chinSize` 0,5). Opções removidas são migradas: `block` vira `square`, `flat` vira `square`.
3. **Sorteio estável:** opções novas não entram no sorteio principal. Elas vêm de um fluxo separado (`seed + ':face'`), para que **sementes antigas continuem gerando o mesmo personagem**. Mantenha essa regra.
4. **Expressão e tipos de rosto salvos são estado da prévia/navegador**, não da receita.
5. **Peças planas sempre "assentadas":** qualquer coisa sobre o corpo usa `onChest`/`chestBand`/`headAt`/`fz`. Posição fixa em Z deixa a peça flutuar ou afundar quando o corpo muda.
6. **Nada de logotipos reais** (Legendários ou Project Zomboid). Insígnias genéricas.

### O que foi tentado e **desfeito** (não repetir)
- **Deformar os vértices da parte de trás da cabeça** para afinar a mandíbula larga: gerou vincos e papada. O usuário pediu para reverter e simplificar.
- **Formato "Mandíbula larga" e queixo "Reto":** deformavam o rosto inteiro. Foram removidos.
- **Última seção da cabeça no tamanho do pescoço:** alterou demais a silhueta.
- O que funcionou para a mandíbula: seções de baixo da cabeça **rasas e com o centro mais à frente**. A cabeça é montada com seções **verticais** e depois deslocada em Z por altura (cisalhamento), o que eliminou a faixa de sombra no meio do rosto.

---

## 5. Ferramentas de desenvolvimento

### Folha de inspeção `dev/retrato.html`
Renderiza cinco vistas de corpo inteiro e quatro closes numa imagem de 1600 × 900. Parâmetros de URL:

| Parâmetro | Efeito |
|---|---|
| `preset=`, `seed=` | base ou personagem sorteado |
| `detail=low\|high\|uhd` | nível de malha |
| `motion=`, `t=` | movimento e instante (segundos) |
| `expr=happy&k=1` | expressão e intensidade |
| `face=strong` | tipo de rosto |
| `hair= beard= hairColor= skin= faceShape= chin= brows= nose= mouth= cheeks= chinSize=` | sobrescrever aparência |
| `top= hat= bust= backpack=0\|1` | sobrescrever roupa |
| `headback=1` | troca o close da mão pelo topo da cabeça |
| `chest=1` (`&close=1`) | closes do peito |
| `feet=1` (`&top=1`) | closes dos pés (vistos de cima) |
| `legs=1` | quadril por trás e tornozelo |
| `jaw=1` | parte de baixo da mandíbula, de lado e por trás |
| `palm=1` | mão aproximada pelo lado de fora |
| `wire=1` | wireframe |

### Captura sem abrir o navegador
O Chrome headless com SwiftShader renderiza WebGL de verdade:

```sh
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --use-angle=swiftshader \
  --enable-unsafe-swiftshader --hide-scrollbars --window-size=1600,900 --virtual-time-budget=15000 \
  --screenshot="C:/caminho/saida.png" "http://localhost:5173/dev/retrato.html?preset=ranger&face=round"
```

- **Erros de console:** troque `--screenshot` por `--enable-logging=stderr --dump-dom` e filtre por `CONSOLE`. Uma prévia que mostra "precisa de WebGL 2" quase sempre é **exceção de JavaScript**, não falta de WebGL.
- **Testar cliques na interface:** use o protocolo DevTools (`--remote-debugging-port`) com o `WebSocket` nativo do Node e `Runtime.evaluate`. Foi assim que o fluxo de salvar tipos de rosto foi validado.
- **Comparar variações:** recorte e monte as capturas lado a lado com Pillow (Python).

---

## 6. Testes (`tests/core.ts`, via `npm test`)

Compilado com esbuild e executado no Node (Three.js roda sem DOM). O que cobre:

- Geração determinística, ida e volta de JSON e rejeição de entrada inválida.
- Todas as bases, 60 sementes e todas as combinações de roupa × calça × cabelo, **em `low` e `high`**: geometria finita, sockets, animações, pés no chão, limite de triângulos (6 mil `low`, 60 mil `high`).
- UHD: bem mais denso que o HD, com fios, mesmo rig e abaixo de 400 mil triângulos.
- Caminhar/correr/Correr+ vão **para a frente** (+Z), e os cotovelos dobram.
- Ações não atravessam o chão; ao orar, os joelhos tocam o chão; ao pegar, a mão chega perto do chão.
- Cabedal do calçado com a largura da sola (não pontudo).
- Alças da mochila não atravessam bolsos, com qualquer busto.
- Rosto: piscadas, sobrancelhas, sacadas, ritmo por semente, 6 expressões e transição suave.
- Todas as feições são válidas, arquivos antigos migram, e o **nariz fica colado ao rosto** em todas as combinações de formato × queixo × nariz.

**Orçamento:** o `high` está em ~58 mil triângulos, perto do limite de 60 mil. Novos detalhes no HD exigem otimizar outra parte ou subir o limite conscientemente.

---

## 7. Armadilhas conhecidas (já aconteceram)

1. **Código minificado em uma linha + comentário `//` no meio.** O comentário engole o resto da linha. Aconteceu **três vezes**: cotovelo sem dobrar na corrida, pálpebra sem piscar e ordem de redimensionamento. Sempre ponha comentários **em linha própria**. Os testes de cotovelo e de piscar existem por causa disso.
2. **`tube` e a orientação da seção.** O sweep do img2threejs escolhe o referencial pela direção do **primeiro segmento**. Se ele fica mais íngreme, a seção gira 90° e largura e altura se trocam. Isso deixou o calçado pontudo. Para caminhos ao longo de Z, use `opts.lateral: true`.
3. **Seções inclinadas no `sweep`.** Um `zOffset` que varia muito entre anéis inclina as seções e cria degraus. Na cabeça, a solução foi montar com seções verticais e cisalhar depois.
4. **Superfícies coincidentes piscam (z-fighting).** Peças sobrepostas precisam de folga (ex.: cano da meia maior que a canela, reforço do calçado).
5. **Peças do rosto sem `fz`** flutuam quando o formato do rosto muda (o caso do nariz).
6. **Ordem de declarações em `scene.ts`:** `resize` roda na criação; variáveis usadas nele precisam ser declaradas antes.
7. **Traços acima de 6 pontos** fazem `validateSpec` lançar erro, e a prévia fica em branco.
8. **Edições grandes via `python -c`/heredoc no Git Bash** quebram com aspas. Grave o script num arquivo e execute.
9. **`pa.needsUpdate`** e o recálculo de normais (`creaseNormals`) são obrigatórios depois de mexer em vértices.

---

## 8. Próximos passos sugeridos

Organizados por impacto no realismo. Os marcados com ⭐ destravam os outros.

### A. Estrutura (base para tudo)
1. ⭐ **Malha única com `SkinnedMesh`.** Maior salto de qualidade possível: acaba com as emendas visíveis em pulso, joelho, quadril, tornozelo e nuca e permite dobras suaves. Caminho sugerido:
   - gerar as mesmas formas e fundi-las em uma malha (ou em poucas: corpo, cabeça, roupas);
   - calcular pesos por distância aos ossos;
   - criar um `THREE.Skeleton` com os mesmos nomes de `nodes`.
   Manter a API (`nodes`, `sockets`, `update`). Depois disso, as correções de "papada" e as esferas de junta deixam de ser necessárias.
2. ⭐ **Compatibilidade com `anima3d`** (usado no jogo): mapear os ossos para o esqueleto do anima3d, para reaproveitar clipes do jogo. Veja `docs/ANIMA_INTEGRACAO.md` na raiz.
3. **Pés em terreno irregular:** IK por pé com amostragem da altura do chão (hoje só há chão plano) e rotação do pé na passada. Resolve o degrau atrás da bota ao correr.
4. **Blend shapes (morph targets) para o rosto:** substituir o deslocamento de peças por morphs na malha única, para expressões mais orgânicas (sorriso que mexe as bochechas, olhos que fecham com as pálpebras integradas).

### B. Rosto e cabeça (realismo)
5. **Topologia de rosto dedicada:** hoje a cabeça é um sweep de elipses. Uma malha com loops em volta de olhos e boca (estilo box-modeling) permite maçãs do rosto, arco superciliar, sulco nasolabial e mandíbula definida sem deformações globais.
6. **Olhos:** esclera com leve cor, íris com anéis e reflexo especular (`MeshPhysicalMaterial` com clearcoat), cílios como tiras finas e pálpebras que acompanham a curva do globo.
7. **Orelhas esculpidas** (hélice, antélice, lóbulo) no lugar do elipsoide.
8. **Dentes e língua completos** para expressões com a boca aberta.
9. **Pele:** subsurface aproximado (`transmission`/sheen ou shader próprio), variação de cor por região (nariz, bochechas e orelhas mais avermelhados), sardas e manchas opcionais, rugas por idade.
10. **Idade e peso** como controles: flacidez, papada controlada, rugas e cabelo grisalho.
11. **Cabelo UHD:** mais fios no topo (hoje os volumes cobrem), fios em mechas agrupadas (clumps de strands), sobrancelhas e cílios com fios, e um shader com anisotropia (brilho em faixa, estilo Kajiya-Kay).

### C. Corpo e roupas
12. **Mãos com articulações** (poses de segurar item no socket `handR`, punho fechado, apontar).
13. **Roupas como camada sobre o corpo** (offset da superfície do corpo) em vez de substituir o tronco. Permite combinar camiseta por baixo da jaqueta aberta, e rugas/dobras procedurais nos cotovelos, joelhos e cintura.
14. **Mais peças:** calça rasgada, colete tático, cinto de utilidades com bolsas, joelheiras, luvas, bandana, máscara, capacete, relógio e cantil.
15. **Desgaste realista:** sujeira, sangue e rasgos por máscara procedural (hoje só escurece por vértice).
16. **Tipos de corpo mais extremos** (muito magro, obeso e musculoso) com massa muscular visível.

### D. Renderização e desempenho
17. **Orçamento do HD:** o `high` está perto de 60 mil triângulos. Opções: LOD automático por distância, fundir malhas estáticas por material (reduz draw calls; hoje são ~140–180 peças) e instanciar peças repetidas (botões, cadarços).
18. **Texturas geradas** (canvas/DataTexture) com mapa de cores + normal map para tecido e pele, bake opcional para o jogo.
19. **Folha de sprites animada** (hoje só 8 direções estáticas) para uso 2D no mapa.
20. **Teste rápido vs. completo:** a bateria de 920 personagens leva minutos; separar um `npm run test:quick` para o dia a dia.

### E. Integração ao jogo (quando o usuário pedir)
21. Usar `dist/character.module.js` no jogo com `detail` por distância da câmera (`low` para multidões, `high` para o jogador, `uhd` para menus e retratos).
22. Ligar `setExpression` a estados do jogo (dano → brava/triste, fôlego → cansada) e as ações (`pickup`, `pray`, `jump`) aos comandos.
23. Colisor Rapier por altura (a receita não cria colisores; ver `docs/INTEGRACAO.md`).

---

## 9. Como o usuário gosta de trabalhar

- Pede mudanças visuais com **capturas de tela marcadas em vermelho**. Reproduza o problema na folha de inspeção **antes** de corrigir e **confira com capturas depois** (o usuário percebe regressões visuais rápido).
- Prefere soluções **simples e estáveis** a deformações complexas; quando algo "estraga o rosto inteiro", ele pede para reverter.
- Quer tudo **em português** na interface e nas respostas.
- Aprova mudanças incrementais e costuma pedir o próximo ajuste em seguida; mantenha testes passando e o build atualizado a cada entrega (`npm test` e `npm run build`).
