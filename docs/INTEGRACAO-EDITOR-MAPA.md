# Guia Mapa e mapas salvos no Teste de Jogo

Origem local: `C:/Users/nelso/OneDrive/_ANTIGRAVITY/CRIADORES DE MAPA/MAPA 3D/editor-isometrico`.
Terreno, Efeitos e Referência por imagem foram integrados; biblioteca externa de modelos, construções, personagens rigados e Rapier do editor original não foram trazidos. A pasta original não foi modificada.

## Uso

Layout acompanha o editor original: paleta de superfícies/biblioteca VFX na coluna esquerda; cena central; ferramentas de terreno, pincel e propriedades dos efeitos na coluna direita. Referência e cor base ficam abaixo no inspetor direito. Água e rua mostram ajustes apenas quando sua superfície é escolhida. Histórico fica sobre a cena, câmeras no canto inferior direito; nome, mapas salvos e ações de arquivo ficam no topo. Painéis laterais têm rolagem independente e, em telas estreitas, empilham sem ocultar controles.

Abra a guia principal **Mapa** (`?mode=map`). Use **Meus mapas** para nomear, salvar, salvar como novo, abrir ou criar um mapa. A edição acontece nesta guia, não no Teste de Jogo. Alt + arrastar gira a câmera, botão direito desloca e rolagem aproxima. Vistas Isométrica/Superior/Frente, Enquadrar, Grade e exportação PNG estão disponíveis.

Em **Teste de Jogo → Mapa salvo**, escolha um mapa salvo ou o circuito original. O teste não usa o rascunho nem altera a versão salva. O renderer do mapa é pausado enquanto o diálogo de teste está aberto.

- Terreno de 100 × 100 m: nove superfícies, relevo, caminhos, água/correnteza, neve e rua de pedra.
- Efeitos nativos: fogueira, fumaça, névoa, brasas, tocha e energia arcana; posição, altura relativa, escala, emissão, vida, intensidade, turbulência, agrupamento e presets Quarks JSON.
- Referência: PNG/JPG/WebP até 30 MB, reduzida até 2048 px e 3 MB codificados; opacidade, dimensões, X/Z, rotação e visibilidade. A malha acompanha o relevo sem participar da seleção/colisão. O arquivo original não é alterado.
- Cor base, limpar efeitos, duplicar/agrupar/desagrupar/remover, desfazer/refazer (20 estados). Ctrl+Z, Ctrl+Y/Ctrl+Shift+Z, Ctrl+D, Delete e Ctrl+S; campos de texto/número conservam a edição normal dos seus valores.
- `abrigo-map-library-v1` guarda até 30 mapas nomeados, com IDs e datas; salvar substitui somente o ID atual. `abrigo-map-draft-v1` guarda automaticamente o rascunho separado. `abrigo-game-map-v1` é lido como mapa legado quando ainda não existe biblioteca, e não é apagado. Erros de cota de armazenamento são informados; exporte JSON como backup. Armazenamento é deste navegador/origem, não GitHub nem sincronização entre dispositivos.
- Jogador, personagens de colisão e inimigos de ondas acompanham a altura renderizada. Encostas íngremes bloqueiam a subida direta; saltos e gravidade usam o mesmo chão. Editar encerra o combate ativo para evitar física com cenário alterado.

## Integração e diferenças

Fontes copiadas em `extras/editor-isometrico/`: `terrain-data.js`, `terrain.js`, `effects-v2.js`. A lógica visual nativa de terreno/partículas foi conservada. Adaptações: descarte idempotente de recursos, seleção e controles próprios, limites/validação de importação e ajuste de emissão/vida/turbulência relativo ao valor nativo de cada camada, preservando o aspecto quando se salva/recarrega.

Adaptadores: `src/game-map-data.ts`, `src/game-map-scene.ts`, `src/game-map-editor.ts`, `src/map-editor.ts`, `src/map-library.ts`, `src/game-map-picker.ts`; ligação em `main.ts`, `scene.ts`, `game-test.ts`, `game-course.ts`. Efeitos são visuais, sem dano ou colisão; água não implementa natação. Vegetação/pedras decorativas não são obstáculos. O mapa salvo substitui, não sobrepõe, os obstáculos/tronco do circuito. A importação reconhece JSON `elemental-map` do editor original, mas extrai somente terreno, efeitos, cor base e referência, informando explicitamente que modelos/personagens externos não foram importados. O JSON próprio exporta essas mesmas áreas. Partículas/shaders requerem WebGL; fallback SVG não tem paridade visual.

Dependência fixada: `three.quarks@0.16.0`, MIT, copyright 2019 Forrest Sun. O build inclui integralmente sua licença no HTML offline. Nenhum modelo/textura externo foi baixado: texturas de efeitos são procedurais. Auditoria npm apontou um aviso alto preexistente em `source-map-js` da cadeia de desenvolvimento; nenhuma correção automática de dependências alheias foi aplicada.

## Verificação

A expansão gráfica do Bioma e a guia Vegetação estão documentadas em `INTEGRACAO-VEGETACAO-BIOMA.md`. O JSON v1 também admite os campos opcionais `vegetation` e `visual`, sem invalidar os mapas anteriores.

`node scripts/test.mjs --game-map`: pincéis, interpolação do chão/render, água/neve, efeitos nativos, persistência e validação, física com alturas negativas e descarte; migração do mapa legado, dois mapas independentes, sobrescrita sem duplicação, importação parcial do original e validação de referência.
Regressões: `--game-controls`, `--game-combat`, `--creature-categories`; build offline.
No navegador: pintura, fogueira, ajuste por incremento nativo, salvar/recarregar conservando escala, andar no mapa e console sem erros. Joystick físico, todas as combinações de pincéis e importações Quarks arbitrárias não foram verificados manualmente.

## Abas de criaturas

`?mode=creatures` mantém criaturas normais; `?mode=creatures-sdf` reúne as seis espécies Fauna SDF. Cada aba tem rascunho/histórico próprio, via `src/creature-categories.ts`, sem apagar o rascunho legado. Classificação vem do registro canônico de builds.
