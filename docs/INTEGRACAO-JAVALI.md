# Javali procedural

Base **Fauna Procedural — SDF**, ID `fauna-procedural-sdf`, revisão local 1. Guia reutilizável: [FAUNA-PROCEDURAL-SDF.md](FAUNA-PROCEDURAL-SDF.md). O Javali tem etiqueta no editor, `generator` no JSON e `root.userData.generator` no modelo; presets antigos são identificados automaticamente na validação. Este nome identifica a adaptação do ABRIGO, não renomeia o pacote original.

Fonte: https://github.com/majidmanzarpour/threejs-procedural-animals

Versão fixa: `c95ae49346aa8e140a924376cec6cf0073d99512`. Licença MIT, copyright de Majid Manzarpour e colaboradores preservado no pacote e nos bundles. A cópia completa está em `vendor/threejs-procedural-animals`, sem alterações no código original. `docs/boar-vendor-lock.json` registra o roster fechado de arquivos, tamanhos e SHA-256. Verificar com `node scripts/verify-boar-vendor.mjs`.

Integração manual autorizada pelo pedido de integrar o Javali. O CLI `game-dev` não está disponível; este manifesto não é um recibo de admissão do Game Development Studio.

## Adaptação

- Espécie `boar` / Javali em Criaturas, presets, seeds, anatomia, aparência, JSON, rascunho e ondas de combate.
- `src/boar-detail.ts` mantém sculpt SDF, rig, presas, pelagem, olhos e investida originais. Base: adulto macho, com variação determinística por seed.
- Escala permanece no root do ABRIGO. Volume, comprimento e largura usam as deformações contínuas originais. Nenhuma outra criatura é substituída.
- HD usa o nível upstream `high`; detalhe baixo usa `low`. As estatísticas mostram triângulos da superfície base, sem multiplicar pelas camadas de pelo. Este modelo é mais pesado que os nossos geradores anteriores.
- Geração no editor em Web Worker, com cache limitado. O build inclui o worker no HTML offline; não depende de URL absoluta nem do caminho de publicação no GitHub Pages. A API síncrona `createCreature` continua disponível; chamar `await prepareBoar(spec, detail)` antes dela evita geração bloqueante no navegador.
- O jogo controla posição, orientação e colisão. A animação upstream acompanha uma velocidade local sem modificar o root. Bounds são calculados com o skinning DQ original na CPU para enquadramento e barras de vida.
- Repouso, caminhada, corrida/trote e ataque único de investida. Impacto em 0,55 s, duração 1,1 s, intervalo de combate 0,7 s. Dano ainda usa as regras de distância/direção da arena, não colisão geométrica das presas.
- Sem WebGL, o mesmo skinning DQ anima a superfície com material padrão e sem camadas de pelo; não há equivalência de pelagem no SVG.

## Verificação

`npm run test:creatures`, `node scripts/test.mjs --game-combat`, `npm run build`, `node scripts/verify-boar-vendor.mjs`.

Alteração local: a publicação no GitHub precisa ser solicitada separadamente.
