# img2threejs — pesquisa consolidada e plano de melhoria (IMAGEM → THREE.JS)

> **Para quem é este arquivo:** uma LLM (ou pessoa) que vai continuar o trabalho de **gerar modelos Three.js a partir de imagens** no projeto ABRIGO.
> Ele reúne tudo que já foi pesquisado, testado e decidido, o que funcionou, o que falhou e um plano de melhorias, inclusive com uso de API de IA.
> Última atualização: 28/09/2026.
>
> Leia também: `docs/HANDOFF_LLM.md` (regras gerais do projeto), `docs/OBJETOS.md` (aba Objetos), `docs/IMG2THREEJS_ANALISE.md` (primeira análise, 27/09) e `docs/img2threejs-prompts/` (os 4 prompts canônicos do img2threejs, copiados sem alteração).

---

## 1. Contexto do projeto (o mínimo para não quebrar nada)

- **ABRIGO** é um editor procedural em **Three.js 0.186 + TypeScript + Vite**, com três áreas: **Personagens**, **Criaturas** e **Objetos**. Será integrado a um jogo isométrico.
- Pasta: `ABRIGO-criador-personagem-v1/ABRIGO-v1`. Comandos:
  - `npm run dev` → http://localhost:5173 (editor), `/dev/fabricas.html` (visualizador de fábricas), `/dev/retrato.html` (inspeção de personagens)
  - `npm test` (objetos + criaturas + personagens; demora alguns minutos) · `npm run test:objects` · `npm run build` (gera `dist/ABRIR_EDITOR.html` e `dist/character.module.js`)
- **Regras do projeto que valem para qualquer modelo gerado a partir de imagem:**
  1. **Só código.** O jogo não carrega GLB, OBJ, texturas de arquivo, nem faz `fetch` em tempo de execução. Geometria e cor saem de funções TypeScript (cor por vértice ou textura desenhada em canvas).
  2. Estilo **low-poly facetado**, com níveis de detalhe `low` / `high` / `uhd`. Orçamento de personagem no `high`: < 60.000 triângulos.
  3. Contrato de fábrica: `export function createXModel(options?) → THREE.Group | {root}` (mesmo contrato do img2threejs e da galeria img2threejs-showcase).
  4. Comentários em linha própria; nunca `//` no meio de linha minificada (já quebrou código antes).
  5. Toda mudança passa por teste e build. Nada de "pronto" sem medir.

---

## 2. O que é o img2threejs

- Repositório: https://github.com/img2threejs/img2threejs — **Apache-2.0**. Site: https://img2threejs.io (galeria + "Prompt Kit").
- **Commit que usamos: `6e60b5e` (06/09/2026). Em 28/09/2026 ainda é o HEAD da `main`** (conferido com `git ls-remote`).
- É **um fluxo de trabalho para agentes de IA** (Claude Code, Codex etc.), não um conversor automático:
  1. `stage1_intake` — lê a imagem: recorte, marcos de anatomia, inventário de detalhes, cores, evidência de PBR.
  2. `stage2_spec` — o agente preenche uma avaliação (`preSpecAssessment`) e uma receita `ObjectSculptSpec` (JSON com árvore de componentes macro/meso/micro, materiais, primitivas: SDF com união suave, sweep, lathe, extrude…).
  3. **Portão de qualidade** `validate_sculpt_spec.py --strict-quality` — recusa receitas incompletas (ex.: cor de componente não derivada dos pixels).
  4. `stage3_build/generate_threejs_factory.py` — gera um `create<Nome>Model.ts` enorme (o do lobo tem ~4.000 linhas) com uma biblioteca de geometria embutida.
  5. `stage4_review` — render × referência, IoU de silhueta, diferença interna por faixa, ΔE00 de cor, penetração entre peças, cobertura etc.
  6. `stage5_rig` — skinning geodésico, rig, morph targets (Python, tempo de geração).
- Orquestração: `forge/state.py` (estado do fluxo), `forge/next.py` (diz o próximo passo), `forge/report.py`.
- Scripts Python 3.10 sem dependências obrigatórias; SAM2, Depth Anything e MediaPipe são **opcionais** (melhoram o recorte e a profundidade).
- **Limitação declarada por eles:** o molde de personagem tem **61 componentes de anatomia e nenhuma roupa**. Figuras "mais pano que corpo" (saia, capa, manga solta) devem ser recusadas no passo 0.

### Onde está no nosso projeto
| Caminho | O que é |
|---|---|
| `vendor/img2threejs/` | Cópia do `forge/` (commit `6e60b5e`) + `LICENSE` + `PROVENANCE.json` |
| `src/vendor/taperedSweep.ts` | `buildTaperedSweepGeometry` extraído do gerador. **Não editar** (código de terceiros); adaptar no chamador |
| `src/generated/anatomy.json` | Proporções canônicas de rosto/corpo geradas pelo img2threejs (`eyeLine`, `noseBase`, `mouthLine`…) |
| `scripts/extract-img2threejs.py` | Extrai funções TypeScript do gerador com proveniência |
| `docs/img2threejs-prompts/` | Os 4 prompts canônicos (build, glb-force-measured, polish, vfx) + README deles |
| `factories/` | Fábricas `createXModel()` para testar no `dev/fabricas.html` (fora do build) |
| `factories/lobo.ts` + `factories/lobo-img2threejs/` | Piloto real do fluxo (seção 4) com toda a evidência |

---

## 3. O que já construímos em volta dele

### 3.1 Aba Objetos (`?mode=objects`) — o fluxo feito localmente, sem IA
Arquivos: `src/object-analysis.ts`, `src/object-schema.ts`, `src/object.ts`, `src/object-editor.ts`. Detalhes em `docs/OBJETOS.md`.

1. Carregar imagem (fica só na memória).
2. `analyzeImage` (navegador): remove o fundo (transparência ou cor da borda), mede a silhueta por linha, eixo e simetria, separa faixas de cor e regiões 2D (k-means + filtro de maioria), sugere o método.
3. **GERAR OBJETO** com método (Auto / Revolução `lathe` / Extrusão por regiões `extrude` com contorno real e furos / Blocos) e nível (Baixo 320 px · 3 cores; Médio 480 px · 5 cores · furos e decalques; Alto 720 px · 7 cores).
4. Edição de peças (formas: box, cylinder, cone, sphere, capsule, torus, lathe, extrude, tube; até 64 peças; sockets como `grip`).
5. Revisão: **IoU da silhueta** na vista de frente.
6. Exportar: receita `.objeto.json`, **código TypeScript** `createXModel()` sem loaders, e um **"pedido econômico para IA"**: texto curto (esquema + receita + pedido) para qualquer LLM devolver **só o JSON** editado (centenas de tokens em vez de milhares com código).

Resultados medidos nos testes (imagens sintéticas): garrafa → Revolução **98%** de silhueta; machado → Extrusão **92%**.
Limites: uma vista só; profundidade estimada; fundo com textura, sombra forte ou perspectiva atrapalham; formas orgânicas (pedra, tronco, animal) não saem bem.

### 3.2 Visualizador de fábricas (`dev/fabricas.html`)
Abre qualquer `factories/*.ts` com `createXModel()`: mostra malhas, triângulos, materiais, texturas geradas em código, tempo de construção, **alerta se a fábrica usa loader/`fetch`**, roda `userData.tick`, e **compara a silhueta** com uma imagem de mesmo nome no ângulo da referência (`export const referenceView=[x,y,z]` na fábrica), com mapa de diferença (verde = coincide, vermelho = falta, azul = sobra).
Detalhe técnico: `clone()` falha em fábricas com `userData` circular; a comparação renderiza o próprio modelo com `overrideMaterial`.

### 3.3 Galeria img2threejs-showcase
https://github.com/hoainho/img2threejs-showcase — **sem licença publicada** (e com marcas/personagens de terceiros). Um baú da galeria rodou sem alteração no Three 0.186 (66 malhas, 29.672 triângulos), mas **nada foi copiado**. Só usar com autorização do autor.

---

## 4. Piloto real: o Lobo pelo fluxo completo (27/09/2026)

Referência: `factories/lobo.png` (lobo low-poly estilizado, 3/4 frontal-esquerda, 1315×1200). Evidência em `factories/lobo-img2threejs/`:
`image-analysis.md` (análise L1–L8), `assessment.json`, `author_spec.py` (script que escreve a receita a partir de definições compactas), `lobo.spec.json`, `state.json`, `revisao-passe4.png`.

Passos executados: `state.py init` → análise da imagem → `new_pre_spec_assessment.py` (preenchido à mão: classe, 8 notas de complexidade, contagens, 12 detalhes no inventário) → `author_spec.py` (corpo e cabeça como **SDF com união suave** decimada para facetar, cauda como sweep afunilado, focinho SDF, colar de pelos em cones, orelhas, olhos, dentes, pernas em cilindros + patas + 16 garras) → `new_sculpt_spec.py` → `validate_sculpt_spec.py` → `generate_threejs_factory.py`.

**Resultado:** ~**51% de IoU** de silhueta no ângulo da referência. Reconhecível como lobo, mas longe do original.

**O que deu errado / lições:**
1. **Usamos `--allow-nonstrict`.** O portão rígido bloqueava porque as cores eram "chapadas" (declaradas à mão), sem `colorMaterialRecipe` derivada dos pixels. O prompt canônico `build.md` diz explicitamente: **nunca** passe `--allow-nonstrict`; leia cada causa e responda (ex.: derive a cor de cada componente da imagem). → Refazer é a melhoria mais direta.
2. A fábrica gerada importa pós-processamento (`EffectComposer`, `Bokeh`, `Bloom`, `RoomEnvironment`, `OrbitControls`) — a prévia deles. Para o jogo, esse cabeçalho deve ser removido.
3. Uma vista só em 3/4: o lado direito, a barriga e a seção da cauda foram inferidos.
4. Erramos proporção de pernas e tivemos de "levantar" tudo (`LIFT=.12` no `author_spec.py`): medir alturas na imagem **antes** de escrever a receita.
5. O agente gastou muitas rodadas preenchendo campos da avaliação que o script só "andaima". O próprio README dos prompts explica: o portão rígido falha com ~89 causas numa receita recém-criada; **preencha o andaime antes de validar**.

Em paralelo, o **lobo do jogo** (`src/wolf-detail.ts`, área Criaturas) continua sendo o procedural feito à mão — melhor para animação (patas com IK, corrida) do que a fábrica gerada.

---

## 5. O "Prompt Kit" do site (análise de 28/09/2026)

Fonte: https://img2threejs.io/#/ (seção "Prompt Kit"), texto idêntico a `docs/standard-prompts/` do repositório. Cópia integral em `docs/img2threejs-prompts/`.

| Prompt | Uso | Ideias principais |
|---|---|---|
| `build.md` | Imagem → modelo | **Passo 0:** medir a silhueta (largura em quadril/joelho/tornozelo, área/altura²) e **parar** se a figura for mais pano que corpo. Intake com `probe_image.py`, `extract_landmarks.py` (atenção: as guias dividem a altura da **imagem**, não da figura; `styleHeads` padrão 6.0 — medir o real), `build_detail_inventory.py`. Avaliação preenchida pelo agente olhando a imagem. Portão rígido até sair 0; gerador é "fail-closed" (sai 2, `BLOCKED`, sem arquivo). Render e revisão um passe por vez. Relatório nunca diz "pronto" quando é "melhorou". |
| `glb-force-measured.md` | GLB como **régua**, nunca entregue | O resultado é TypeScript; cor por vértice amostrada da **textura** no UV (sRGB → linear). Normalizar por transform, nunca editando vértices. Se tiver skin: 1 nível de detalhe (não decimar), 1 malha, ossos por índice, `updateMatrixWorld(true)` antes do `Skeleton`. **Portões de paridade** numéricos: vértices, triângulos, caixa, cor, ossos, clipes, "binding delta" ≤ 2⁻²³. |
| `polish.md` | Refinar | **Um defeito por ciclo:** render → nomear o pior defeito numa frase (ordenar por impacto na identidade: silhueta > brilho) → **medir** (IoU, ΔE00, diferença por faixa) → atribuir a um componente e campo da receita → corrigir só esse campo → medir de novo → manter se melhorou, **desfazer** se não mudou ou piorou. Mesmo defeito por 2 ciclos → parar. Nunca editar a fábrica gerada à mão (editar a receita e regerar). |
| `vfx.md` | Efeitos | Medir os eventos reais das animações (onde o golpe para, onde o pé toca), montar efeitos na parada, hitstop, vocabulário de impactos que difere em movimento antes de cor, paleta do mundo do personagem, tudo em pool e invisível no início. |

**Regra comum:** "Um portão é uma pergunta. Responda com evidência ou diga que não conseguiu — nunca baixando a exigência."

### Conclusões para o ABRIGO
1. **Refazer o Lobo pelo portão rígido** (sem `--allow-nonstrict`), derivando a cor de cada componente dos pixels.
2. **Adotar o método do `polish.md`** no nosso trabalho: nos personagens, os ajustes foram feitos "no olho" e houve idas e vindas (ex.: queixo da Engenheira em 4 tentativas). Já temos o IoU no `dev/fabricas.html` e as vistas do `dev/retrato.html`; faltam ΔE00 por região e uma folha única "referência × render".
3. **Personagens com roupa ficam no gerador procedural** (`src/character.ts`): o molde de personagem do img2threejs não tem roupa. O img2threejs rende mais em **objetos e criaturas**.
4. **Rota GLB-como-régua** é promissora (ver 6.3): uma IA de imagem→3D gera um GLB; o GLB é só medido e o resultado vira código.

---

## 6. Plano de melhorias do sistema IMAGEM → THREE.JS (com API de IA quando necessário)

Princípio: **o navegador faz o barato e determinístico; a IA entra só onde é preciso visão/julgamento, e sempre devolve dados (JSON), nunca código livre.** Toda resposta de IA passa por validação (`validateObjectSpec`) e por uma medida (IoU/ΔE00) antes de ser aceita.

### 6.1 Camada de IA opcional na aba Objetos (menor esforço, maior ganho)
Hoje o "pedido econômico" é copiar/colar manual. Proposta:
- Botão **"Refinar com IA"**: envia **imagem reduzida (≤ 768 px) + receita JSON atual + esquema + IoU/mapa de diferença** para um modelo com visão (ex.: Claude `claude-sonnet-5`; `claude-opus-5-5` para casos difíceis). Pedido: devolver **somente** a receita JSON corrigida (formas simples, ids mantidos).
- **Loop do polish.md automatizado:** a IA aponta **um** defeito + a peça/campo; o editor aplica, **re-mede o IoU**, mantém se melhorou e **desfaz** se não. No máximo N ciclos (orçamento de créditos visível). Parar se o mesmo defeito resistir 2 ciclos.
- **Chave de API nunca no navegador nem no build.** Usar um proxy local de desenvolvimento (ex.: rota no servidor Vite ou script Node) lendo `ANTHROPIC_API_KEY` do ambiente. O `ABRIR_EDITOR.html` offline continua funcionando sem IA.
- Cache por hash da imagem + receita para não pagar duas vezes pela mesma pergunta.
- Saída estruturada: pedir JSON com esquema (tool use / structured output) em vez de texto livre.

### 6.2 Leitura da imagem melhor (antes de gastar IA)
- **Segmentação:** hoje é cor de borda/transparência. Opções: SAM2 (opcional no img2threejs) rodando fora do navegador, ou API de remoção de fundo; aceitar PNG com alfa como caminho recomendado.
- **Profundidade:** Depth Anything (opcional no img2threejs) para estimar volume por região → espessura da extrusão e raio do lathe por faixa, em vez de valores uniformes.
- **Segunda vista (lateral):** já listada em `OBJETOS.md`; com duas silhuetas dá para fazer o *visual hull* (`buildVisualHullGeometry` do img2threejs), com as máscaras **embutidas como dados** no código.
- **Cor por região derivada dos pixels** (o que o portão rígido exige): mediana em Lab por componente, e medir ΔE00 contra o render.

### 6.3 Rota "IA gera GLB → nós medimos → vira código"
Serviços de imagem→3D (ex.: Hyper3D Rodin, Tripo, Meshy; o conector Higgsfield disponível no ambiente tem `generate_3d` que devolve GLB) produzem malhas completas a partir de uma foto. Pela regra "só código", o GLB **não** entra no jogo; seguimos o `glb-force-measured.md`:
1. Gerar o GLB por API (tempo de desenvolvimento).
2. `probe_glb.py` → medir caixa, partes, cores (amostradas da textura por UV).
3. **Decimar para o estilo low-poly** (atenção: só se não houver skin) e emitir como dados TypeScript (posições quantizadas + cor por vértice) ou reconstruir com primitivas guiadas pelas medidas.
4. Portões de paridade + IoU contra a foto original.
Vantagem: resolve os lados escondidos e a profundidade que uma foto só não mostra. Custo: créditos da API e tamanho do código (dados de vértices); decidir pelo orçamento de triângulos.

### 6.4 Funções do img2threejs ainda não extraídas (prioridade)
Extrair com `scripts/extract-img2threejs.py` para `src/vendor/`, registrando proveniência:
1. `polygonizeSdf` + primitivas SDF + `smin` (união suave) — formas orgânicas numa malha só (pedras, troncos, cogumelos, corpos de criatura). Usado no piloto do lobo.
2. `decimateGeometry` — nível `low` automático a partir do `high`.
3. `subdivideCatmullClark` — suavizar para `uhd`.
4. `buildLatheGeometry`, `buildExtrudeGeometry` (com furos), `buildGroundBladeGeometry` (lâminas), `buildCurveSweepGeometry`/`buildTubeGeometry`, `buildWatertightCapsule`.
5. `applyVertexPaint`, `makeProceduralTextureSet`, `periodicValueNoise` — sujeira/desgaste sem arquivo.
6. Nos objetos: nova forma `sdf` na receita (lista de primitivas + raio de união), gerada pela IA como dados.

### 6.5 Métricas e testes (o "portão" do nosso lado)
- Já existe: IoU de silhueta (`silhouetteIoU`), testes de objetos com imagens sintéticas desenhadas em código.
- Adicionar: **ΔE00 por região de cor**, diferença interna por faixa de altura, contagem de triângulos por nível, "nenhuma peça atravessa outra" (ideia do `pairwise_penetration.py`), e uma **folha de comparação** (referência | render | mapa de diferença) salva a cada ciclo.
- Todo resultado de IA entra num teste de regressão com a imagem e a nota mínima atingida.

### 6.6 O que não fazer
- Não transformar a `ObjectSculptSpec` no formato do jogo (é pesada, cheia de histórico). Nossa receita `.objeto.json` é o formato de runtime.
- Não rodar o pipeline Python completo dentro do editor.
- Não usar o caminho de textura por imagem nem o pós-processamento que vem nas fábricas geradas.
- Não copiar nada da img2threejs-showcase (sem licença).
- Não aceitar resposta de IA sem medir; não baixar limiar para passar.

---

## 7. Ordem sugerida de execução

1. Extrair `polygonizeSdf`/`smin` + `decimateGeometry` (6.4) e adicionar a forma `sdf` à receita de objetos.
2. ΔE00 por região + folha de comparação no `dev/fabricas.html` e na aba Objetos (6.5).
3. Proxy local + botão "Refinar com IA" com o loop do polish (6.1), limitado por orçamento e com desfazer automático.
4. Refazer o Lobo pelo portão rígido e comparar com os 51% atuais (seção 4).
5. Piloto da rota GLB-como-régua (6.3) com um objeto simples (ex.: lampião) e depois uma criatura.
6. Profundidade/segunda vista (6.2).

Relatório esperado a cada etapa (no estilo dos prompts canônicos): o que foi medido antes e depois, o que foi mantido ou desfeito, o que ainda não bate — e nunca "pronto" quando é "melhorou".
