# Lobo Low Poly — Fauna Procedural — SDF

## Identidade

- ID ABRIGO: `wolfLowpolySdf`; upstream: `wolf`, variante `grey`, macho.
- Preset copia seed, anatomia, cores, comportamento e escala do `wolfSdf` existente. Original preservado.
- Base `fauna-procedural-sdf`, revisão 1; upstream 0.1.0, commit `c95ae49346aa8e140a924376cec6cf0073d99512`, MIT. Vendor e avisos preservados.

## Adaptação

- Compartilha `src/wolf-sdf-detail.ts`, worker e preparação do lobo SDF. Cache separa espécie e detalhe.
- Escultura e rig nativos intactos. HD usa exatamente o LOD nativo `crowd`; low altera apenas resolução de amostragem das regiões para 6, sem patches finos de olhos.
- HD neutro: 13.808 triângulos base / 6.976 vértices. Low: 6.708 / 3.406. Original HD: 149.992 triângulos. Os números variam com seed/anatomia.
- Material padrão facetado com cores por vértice; sem shells/fins de pelagem. CPU dual-quaternion nativa anima a superfície. Olhos preservam shader nativo em WebGL; SVG usa material padrão como no fallback antigo.
- Sem reconstrução por primitivas, deformações artísticas, clustering ou alteração das proporções. Não é a antiga Fauna Facetada rejeitada.
- Mantém controles de anatomia, aparência, ameaça, JSON, sockets, editor, arena e waves. Escala no root; root controlado pelo jogo, sem deslocamento virtual acumulado.
- Marchas: idle, caminhar e correr; mordida única nativa, duração .95 s, impacto .5 s, cooldown .65 s. Correr+ não disponível.
- Material simples não reproduz a microtextura do shader de pelagem nem seu cross-fade por fragmento no pescoço; a sobreposição nativa de regiões permanece. Bounds seguem a pose. CPU skinning tem custo por vértice: redução de triângulos não é benchmark de FPS.

## Evidências

- `node scripts/test.mjs --wolf-lowpoly-sdf`: aprovado. Buffers HD neutros iguais ao upstream crowd, ossos/juntas iguais ao original HD, proporções/configurações preservadas, JSON, seis variações nos dois tiers, superfície animada, ações, chão, root estável e descarte único.
- `node scripts/test.mjs --wolf-sdf`: aprovado; lobo original mantém paridade com upstream.
- `node scripts/verify-boar-vendor.mjs`: 271 arquivos originais verificados por SHA-256.
- `npm run test:creatures`: aprovado, 240 construções / 15 espécies / dois tiers / anatomia extrema, chão, root, recursos e regressões dos geradores anteriores.
- `node scripts/test.mjs --game-combat`: aprovado, waves, ataques, perseguição, dano e descarte.
- `npm run build`: aprovado, HTML offline e módulo gerados; `git diff --check` sem erros.
- Inspeção no Vite: seleção separada, comparação com original, frontal low, perfil, isométrica HD e corrida. Captura em `.test/lobo-fauna-low-poly.png`. Console sem erros; aviso preexistente sobre PCFSoftShadowMap removido no Three.js.
- CLI Game Development Studio indisponível: verificação feita com testes locais e navegador, sem recibo/GLB canônico ou benchmark upstream.
- Publicação não solicitada. Offline/subdiretório usam o worker incorporado existente; execução nesses ambientes não foi inspecionada nesta alteração.
