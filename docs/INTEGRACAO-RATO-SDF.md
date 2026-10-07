# Rato — Fauna Procedural — SDF

## Identidade

Nova espécie `ratSdf`, separada de `rat`. Herda a ficha, seed e dez controles de forma do Rato atual; não substitui modelos antigos. Registro em `src/creature-builds.ts`, identificado no editor, JSON e `root.userData.generator`.

Fonte: `threejs-procedural-animals`, pacote 0.1.0, commit `c95ae49346aa8e140a924376cec6cf0073d99512`, MIT. Nenhum arquivo de vendor alterado. Variante `wild`, macho, seed neutra `abrigo-rato-01` convertida por FNV. Plano quadrúpede plantígrado.

## Adaptação

- `src/rat-sdf-detail.ts`, `src/rat-sdf-worker.ts`; preparação assíncrona por `prepareFauna`. Worker incorporado no build offline e módulo público.
- Escala no root; volume neutro .35. Comprimento/largura/cabeça/patas usam warps contínuos nativos; orelhas, focinho, cauda e bigodes usam parâmetros originais. Dez controles de forma entre .7 e 1.3. Ajuste dos pés usa warps locais, sem esticar ossos isolados.
- Materiais e pelagem originais no preset neutro. Cores editadas afetam a pelagem sem repintar pele das patas, cauda, dentes ou nariz. Ventre representa contraste do pelo.
- Repouso, caminhar (.3 m/s virtual), correr (1.25), correr+ (1.75) e morder. Hooks nativos preservam movimento de orelhas, bigodes e cauda.
- Ataque explicitamente `bite`, evitando escolha aleatória de boxing upstream: duração .95 s, impacto .5 s, cooldown .65 s. Dano aplicado uma única vez pelo combate ABRIGO.
- Root mundial controlado pelo jogo; deslocamento virtual cancelado. Bounds CPU seguem pose, sockets expõem os anexos originais. Raio de colisão .12 m. Arena corre a 1.25 × comprimento das patas × escala.
- Cache isolado de oito receitas; variações determinísticas; descarte idempotente. SVG usa skinning DQ CPU e bigodes reais, mas sem as camadas de pelos WebGL.
- Prévia enquadrada para o pequeno porte, sem aumentar a anatomia do animal. HD neutro: 131.902 triângulos base / cinco peças; camadas de pelagem multiplicam o trabalho de renderização.
- Base da prévia redimensionada somente em X/Z, com topo fixo em Y=0, aro e marcações acompanhando o raio. Nunca reduzir a altura junto com o raio: isso deixava o Rato aparentemente suspenso. Teste de regressão cobre raios .1/.3/1/2/4. Viés de sombra menor para o porte do Rato, evitando sombra artificialmente afastada das patas. Fases aéreas da corrida original são preservadas.

## Verificações

`node scripts/verify-boar-vendor.mjs`: 271 arquivos originais verificados. `node scripts/test.mjs --rat-sdf`: paridade exata de buffers/rig no neutro, dez controles efetivos, seed/JSON, mordida/recuperação, todas as marchas, root preservado, cache e fallback animado. `--creatures`: 192 modelos de 12 espécies, HD/baixo, sementes e extremos de anatomia aprovados. `--game-combat`: todas as espécies constroem, animam e descartam; inclui sincronização da mordida do Rato SDF. `npm run build`: editor offline e API gerados.

Inspeção local do editor: HD, vistas, ações e modo baixo. Testes upstream completos e teste real file:// não executados. Publicação não solicitada.
