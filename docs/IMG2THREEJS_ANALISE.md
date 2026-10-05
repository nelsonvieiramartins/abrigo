# img2threejs — análise para criação de objetos

> Documento consolidado mais recente: `docs/IMG2THREEJS_PESQUISA.md` (28/09/2026).

Data: 27/09/2026. Repositório: https://github.com/img2threejs/img2threejs (Apache-2.0).

## 1. O que é

O img2threejs são **duas coisas** diferentes:

1. **Um fluxo de trabalho para agentes de IA** (Claude Code, Codex, OpenCode). Recebe **uma foto de referência** e reconstrói o objeto em etapas, com revisão visual de cada uma: blockout → estrutura → forma → material → superfície → iluminação → interação → otimização. O resultado é:
   - um arquivo **TypeScript** com uma função `createNomeDoObjetoModel()` que devolve um `THREE.Group`;
   - uma "receita" `ObjectSculptSpec` em JSON (árvore de componentes, materiais e histórico de revisão).

   Não gera malha (GLB/OBJ) nem textura em arquivo. Os scripts são Python 3.10 sem dependências; SAM2, Depth Anything e MediaPipe são opcionais. A versão 2.0 empacotou o fluxo como plugin, com uma CLI em Node.
2. **Uma biblioteca de geometria em Three.js** embutida no gerador (`forge/stage3_build/generate_threejs_factory.py`). Funções TypeScript que vão para dentro de cada modelo gerado e rodam no navegador.

**Nossa cópia** (`vendor/img2threejs/`) está no commit `6e60b5e` (06/09/2026), que ainda é o último da branch `main`. Não precisamos atualizar nada.

## 2. Encaixa na regra "só código Three.js, nenhum arquivo"?

**Sim, com três cuidados:**

| Ponto | Situação | O que fazer |
|---|---|---|
| Geometria | Gerada por código em tempo de execução | ✅ compatível |
| Texturas | Há dois caminhos: procedural (`makeProceduralTextureSet`, desenha num canvas) e por imagem (`createLoadedMapTexture`/`TextureLoader`, que carrega a foto de referência) | Usar **só o procedural**; remover o caminho por imagem |
| Visual hull (`buildVisualHullGeometry`) | Esculpe o volume a partir das silhuetas da foto | Aceitável só se as máscaras ficarem **embutidas como dados no código**; senão, não usar |
| Cabeçalho do modelo gerado | Importa `OrbitControls`, `EffectComposer`, `Bokeh`, `Bloom` e `RoomEnvironment` (a prévia deles) | Remover; a prévia é a nossa |

## 3. O que pode contribuir (em ordem de valor para nós)

### A. Peças de código reutilizáveis (maior ganho, baixo risco)
Já fizemos isso com o `buildTaperedSweepGeometry`: extrair a função original com `scripts/extract-img2threejs.py` e colocá-la em `src/vendor/`, com a proveniência registrada.

| Função | Para que serve aqui |
|---|---|
| `polygonizeSdf` + `sdfSphere/Capsule/Box/Cone/Ellipsoid` + `smin` | Formas **orgânicas fundidas numa malha só** (união suave). Resolve emendas: pedras, troncos, raízes, cogumelos, bolsas, corpos de criaturas e, no futuro, juntas do personagem. |
| `subdivideCatmullClark` | Suavizar malhas low-poly para o HD/UHD sem remodelar. |
| `decimateGeometry` | Gerar o nível **leve** (LOD) a partir do HD, automaticamente. |
| `buildLatheGeometry` | Objetos de revolução: cantil, lanterna, garrafa, lata, panela, barril. |
| `buildExtrudeGeometry` (com furos) | Placas e perfis: machado, pá, placas, portas, cercas, grades. |
| `buildGroundBladeGeometry` | Lâminas com fio e chanfro (facas, facões); conversa com a forja de armas do jogo. |
| `buildCurveSweepGeometry` / `buildTubeGeometry` | Cabos, alças, cordas, arames, mangueiras. |
| `buildWatertightCapsule` | Cápsula sem costura (o `CapsuleGeometry` do Three tem uma falha de emenda documentada por eles). |
| `applyVertexPaint`, `applyRootTipGradient` | Pintura por vértice (sujeira, desgaste, degradê) sem textura. |
| `makeProceduralTextureSet`, `periodicValueNoise` | Texturas desenhadas em canvas (madeira, metal, tecido) sem arquivo. |

### B. Fluxo para criar objetos a partir de foto (em tempo de desenvolvimento)
Rodar o fluxo numa sessão de agente com a foto de um objeto (machado, lampião, caixa, mochila). Ele gera o `createXModel()`, que então adaptamos para o nosso catálogo. O modelo gerado já traz `nodes`, `sockets`, `colliders` e `destructionGroups`: os mesmos conceitos da nossa API (sockets para a mão, colisores para o Rapier).

**Limites:**
- Não roda dentro do editor: precisa de um agente de IA com visão e de várias rodadas de revisão.
- É uma reconstrução por uma única vista: bom para objetos, aproximado para personagens.
- O código gerado é grande; cada modelo precisa ser enxugado e ajustado ao nosso estilo low-poly.

### C. Esqueleto e skinning (para o personagem)
`forge/stage5_rig/` (`geodesic_skinning.py`, `emit_rig.py`, `rig_spec.py`) calcula pesos de osso por distância geodésica e emite o rig. É exatamente o passo ⭐A1 do `HANDOFF_LLM.md` (malha única com `SkinnedMesh`). Está em Python e é de tempo de geração, então o algoritmo teria de ser **portado para TypeScript**, e não chamado direto.

### D. Outros
- `morph_targets.py`: morphs para expressões, útil no futuro para rostos em malha única.
- Portões de qualidade (`stage4_review`: autointerseção, penetração entre peças, cobertura): ideias para testes automáticos nossos (ex.: "nenhuma peça atravessa outra").

## 4. O que **não** recomendo

- Transformar a `ObjectSculptSpec` no formato de runtime do jogo: carrega histórico de revisão e muitos campos de fidelidade. Nosso formato de receita (como `personagem.json`) é mais simples e estável.
- Rodar o pipeline completo automaticamente dentro do editor.
- Usar o caminho de textura por imagem e as prévias com pós-processamento que vêm no modelo gerado.

## 5. Plano proposto

1. **Área "Objetos"** no editor, como Personagens e Criaturas, com a mesma API: `createObject(spec, {detail})` → `root`, `nodes`, `sockets` (ex.: `grip` para a mão), `stats` e `dispose`, mais uma receita `objeto.json` com semente.
2. **Extrair as funções da seção 3A** para `src/vendor/` com o script de extração e registrar em `THIRD_PARTY.md`: SDF + `smin`, Catmull-Clark, decimação, lathe, extrude, lâmina e capsule.
3. **Primeiro catálogo escrito à mão com essas funções:** cantil, lanterna, machado, facão, caixa de madeira e barril. Cada um com HD, com leve gerado pela decimação e com socket de empunhadura compatível com `handR` do personagem.
4. **Piloto do fluxo por foto:** pegar um objeto, gerar com o img2threejs numa sessão de agente, adaptar a função gerada para o catálogo e comparar esforço e qualidade com o feito à mão.
5. **Depois:** portar o skinning geodésico para o passo da malha única do personagem.
