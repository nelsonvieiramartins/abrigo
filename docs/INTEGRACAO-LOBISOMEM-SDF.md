# Lobisomem — Fauna Procedural — SDF

## Identidade e referências

Nova espécie `werewolfSdf`, separada de `werewolf`. Preset **Lobisomem da mata — SDF**, mesma seed/ficha do Lobisomem antigo. Registro `CREATURE_BUILD_BY_SPECIES`, editor, JSON/API, arena e ondas de combate integrados.

**Espécie autoral ABRIGO**, não uma espécie pronta do upstream. O commit local não contém lobisomem ou motor bípede. Usa seu pipeline SDF, pesos harmônicos, skinning dual-quaternion, pelagem GPU, órbitas e olhos de lobo; rig e escultura bípedes são novos, com proporções e lógica de pose orientadas por `src/werewolf.ts`. Não transformar o lobo quadrúpede em humano por escala de ossos. Vendor permanece intacto.

Fonte técnica: `procedural-animals` 0.1.0, commit `c95ae49346aa8e140a924376cec6cf0073d99512`, MIT, Majid Manzarpour e colaboradores. A etiqueta Fauna SDF identifica a base técnica, não autoria upstream desta criatura.

Pesquisa visual em 05/10/2026:

- [Smithsonian — Gray wolf](https://nationalzoo.si.edu/animals/gray-wolf): referência natural para focinho canino, orelhas e pelagem. Lobisomem é ficcional; não alegar anatomia zoológica real.
- [Monika Zagrobelna — Werewolf Warrior model sheet, Tuts+](https://design.tutsplus.com/tutorials/design-and-draw-a-model-sheet-of-a-werewolf-warrior--cms-22834): estudo de silhueta híbrida humano/lobo em vistas diferentes.
- Busca visual de corpos completos e estudos de anatomia de lobisomem: orientação de mãos com garras, ombros largos e pernas digitígradas. Nenhuma fotografia ou ilustração foi baixada/incorporada; não copiar um personagem específico.

## Adaptação

- `src/werewolf-sdf-species.ts`: espécie própria, 20 ossos, torso/pelve/ombros unidos por SDF; bochechas finas integradas, oito dedos e dois polegares com garras voltadas para baixo, seis garras nos pés, cauda e orelhas. Mandíbula separada rigidamente; presas/órbitas/materiais independentes. Bermudas azuis com contorno rasgado pintado na superfície contínua; sem simulação de tecido ou camada solta de roupa.
- `src/werewolf-sdf-detail.ts` e worker: `buildSync`/`createAnimalObject` originais, cache de oito receitas, preparação por `prepareFauna`, worker incorporado no HTML compilado e API. Sem alterações de arquivos vendor.
- Metros, +Y para cima, +Z para frente. Altura neutra aproximadamente 2,8 m. Escala geral no root. Anatomia: pernas .7–1.3, cauda .5–1.5, orelhas .7–1.4, largura .85–1.15; dimensões do SDF e rig calculadas juntas, nunca esticar uma malha isolada. Cores/contraste e seed afetam o coat; cache inclui aparência para evitar contaminação.
- Motor de pose local bípede: marcha/corrida, IK das pernas e ataque reaproveitam a lógica do anterior. Não usa o motor quadrúpede upstream. Repouso, Caminhar, Correr e Golpear; sem Correr+ neste estágio.
- Golpe único: duas mãos levantadas acima da cabeça, descida com avanço do corpo e mordida. Duração .60 s, impacto .20 s, cooldown .25 s, sincronizados com `werewolf-attack.ts`. Dano por alcance/direção do combate, não colisão individual das garras.
- Root sob controle do jogo. Matrizes de pose locais alimentam DQ, sem somar movimento virtual. Sockets de cabeça/boca/mãos/costas/alvo, bounds CPU animados e descarte idempotente. Piso/base Y=0, sem escalar a altura da plataforma.
- Neutro final: HD 114.992 triângulos / 57.522 vértices; baixo 21.180 / 10.626. Cinco meshes principais, orçamento 160.000 triângulos base; camadas de pelos custam renderização adicional. Fallback CPU/SVG animado sem pelos shader.

## Evidências e limites

- `node scripts/verify-boar-vendor.mjs`: 271 arquivos intactos.
- `node scripts/test.mjs --werewolf-sdf`: repetibilidade dos buffers no pipeline próprio, rig/coat, mandíbula, mãos acima da cabeça e golpe descendente, recuperação, piso, root e fallback; neutro em ambos os tiers.
- `node scripts/test.mjs --creatures`: 224 modelos / 14 espécies, anatomias extremas, dois tiers, geometria/transformações finitas e descarte. Executado antes do refinamento final das sobrancelhas; teste específico repetido depois.
- `node scripts/test.mjs --game-combat`: todas as espécies e verificação específica de dano único no impacto .20 s para `werewolfSdf` passaram.
- `--werewolf-sdf` repetido após refinamento: cinco sementes e dois extremos de anatomia em HD/baixo passaram, além do neutro, pose/fallback e comparação de buffers. `npm run build` passou após integração final dos controles.
- Inspeção no Vite: repouso 3/4 e corrida lateral. Editor compilado: worker HD/baixo, repouso frontal/3/4, caminhada em baixo, retorno ao HD e console sem erros. Evidência `.test/lobisomem-fauna-sdf.png`. Ataque descendente e recuperação verificados por matrizes/sockets nos testes; captura rápida do navegador não isolou seu instante de impacto, portanto não alegar revisão visual completa desse frame.
- Não alegar paridade com lobisomem upstream inexistente; a paridade testada é com o pipeline direto da espécie autoral. A borda pintada da bermuda pode ficar mais áspera no tier baixo; não há simulação física de tecido.

Skill game-asset-production orientou proveniência e evidências. CLI `game-dev` indisponível; não há GLB/canonical-package receipt nem serviços pagos. Métricas/renders upstream completos não executados para a espécie autoral. Publicação não solicitada.
