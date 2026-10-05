# Créditos e proveniência

## img2threejs — Apache-2.0

Repositório: https://github.com/img2threejs/img2threejs

Commit utilizado: `6e60b5e22419464b4853e01ddb6c0e6f6659a733`

Cópia dos módulos originais: `vendor/img2threejs/forge/`.
Licença original: `vendor/img2threejs/LICENSE`.
Manifesto e hash do gerador: `vendor/img2threejs/PROVENANCE.json`.

`src/vendor/taperedSweep.ts` contém a função `buildTaperedSweepGeometry` emitida pelo código original, com as alterações declaradas no cabeçalho (import de THREE e export da função). O script `scripts/extract-img2threejs.py` reproduz a extração com AST Python. Não há remoção ou simulação dos gates do pipeline: o editor reutiliza um construtor de geometria, e não executa uma reconstrução de imagem.

`src/generated/anatomy.json` foi produzido chamando `derive_anatomy(8)` do original `forge/stage2_spec/humanoid_proportions.py`. É uma referência canônica, não anatomia medida de uma pessoa. As dimensões adicionais do personagem são decisões estilísticas deste projeto.

Nenhum código ou modelo de `img2threejs-showcase` foi incorporado. O visualizador `dev/fabricas.html` apenas segue o mesmo contrato de função (`createXModel()`); o repositório não publica licença, então nada dele é distribuído.

## Three.js — MIT

Versão usada: 0.186.0. https://github.com/mrdoob/three.js

Usa a biblioteca, OrbitControls e SVGRenderer/Projector. Distribuída no HTML compilado. Licença em `vendor/THREE-LICENSE.txt`.

## Código próprio — Apache-2.0

Interface, catálogo, esquema, sementes, fábrica de personagem, articulações, movimentos e exportadores foram implementados para esta entrega. Licença em `LICENSE`.

O projeto é independente de The Indie Stone/Project Zomboid. Nomes de referência não implicam vínculo e nenhum asset do jogo é incluído.
