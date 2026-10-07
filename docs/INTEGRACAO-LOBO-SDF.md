# Lobo — Fauna SDF

Nova criatura `wolfSdf`, separada de `wolf` / Lobo. O gerador anterior, os presets antigos e as ondas existentes não são substituídos.
Base: **Fauna Procedural — SDF**, revisão local 1. Seguir `docs/FAUNA-PROCEDURAL-SDF.md`.

## Identidade e referência

- Registro: `CREATURE_BUILD_BY_SPECIES.wolfSdf`, etiqueta no editor, `generator` no JSON e `root.userData.generator`.
- Fonte: `threejs-procedural-animals`, pacote `procedural-animals` 0.1.0, commit `c95ae49346aa8e140a924376cec6cf0073d99512`.
- MIT; copyright de Majid Manzarpour e colaboradores preservado. Nenhum arquivo vendor modificado.
- Plano quadrúpede; espécie upstream `wolf`, variante `grey`, adulto macho.
- Preset herda seed `floresta-2407`, cores de controle, escala e ficha do Lobo atual: vida 80, dano 18, velocidade 4, percepção 12, territorial, não venenoso.
- Essa herança é do esquema/configurações, não a cópia da malha rígida antiga. A superfície, esqueleto, olhos, mandíbula e pelagem são os do Lobo original SDF.

## Adaptação

- `src/wolf-sdf-detail.ts`: factory, buffers com cache de até oito indivíduos, cores isoladas, skinning DQ, bounds animados e descarte idempotente.
- `src/wolf-sdf-worker.ts`: geração fora da thread principal. Worker incorporado no build offline; Vite usa worker de módulo.
- `src/fauna-prepare.ts`: preparação por espécie. API: `await prepareFauna(spec, detail)` antes de `createCreature(spec, {detail})`; `prepareWolfSdf` também é exportado.
- Anatomia: patas 0.7–1.3, cauda 0.5–1.5, orelhas 0.7–1.4; comprimento/largura corporal 0.85–1.15. Patas/comprimento usam warps originais; orelhas/cauda usam parâmetros nativos; volume/largura usam warp de girth contínuo aplicado a malha e rig, não peças soltas.
- Controles neutros preservam exatamente os buffers, coat e ossos produzidos pelo pipeline original, com a mesma seed/variante/sexo. Cores neutras deixam a pelagem grisalha e os olhos âmbar originais; alterar as cores aplica tint sem repintar nariz, dentes ou garras. `markings` controla contraste da tintagem, não cria novas manchas de textura.
- HD = upstream `high`, detalhe baixo = `low`. Contagem da interface é de triângulos base, sem multiplicar pelas camadas GPU de pelo. Não equiparar orçamento ao gerador antigo.
- Funções oferecidas: alerta, caminhar (1.1 m/s virtual), correr/trotar (2.5 m/s virtual), mordida única `bite-lunge`. Mantém hooks originais de linguagem corporal, orelhas e pelos eriçados.
- Mordida: duração 0.95 s, impacto 0.5 s, cooldown de combate 0.65 s. Não reaproveita o relógio de ataque rápido do Lobo antigo. Mais ações upstream existem, mas não estão expostas nesta integração.
- Escala no root; animação local não altera posição/orientação mundial. O jogo mantém controle de deslocamento e colisão. Sockets upstream: boca, cabeça, costas; target/origin usam proxy de costas.
- Arena/waves aceita `wolfSdf` independentemente de `wolf`; preparação assíncrona antes do combate. Dano usa alcance/altura da arena, não colisão geométrica de dentes.
- Fallback sem WebGL: mesma superfície animada por DQ na CPU, material padrão por vértices, sem pelagem GPU. Aparência SVG não é equivalente à HD.

## Verificação

Testes reproduzíveis:

```sh
node scripts/verify-boar-vendor.mjs
node scripts/test.mjs --wolf-sdf
node scripts/test.mjs --creatures
node scripts/test.mjs --game-combat
npm run build
```

`tests/wolf-sdf.ts` verifica paridade de buffers/rig com upstream, seed e JSON, identidade, isolamento do Lobo anterior, mordida/recuperação, root, limites animados, cores/cache, fallback e descarte. A regressão de criaturas inclui seis seeds e anatomias extremas em low/high. `tests/game-combat.ts` verifica o impacto em 0.5 s e um único dano por mordida.

Resultados em 05/10/2026: testes específicos, combate e regressão de 176 modelos passaram, incluindo seis seeds e extremos anatômicos nos dois detalhes. Maior superfície observada na bateria: 154.692 triângulos. Preset Lobo SDF: 149.992 triângulos base em high, 26.704 em low, cinco meshes (o custo real inclui pelo GPU).

Inspeção no navegador local: vistas isométrica, frontal e lateral, alerta/caminhada/corrida/mordida em HD e geração em low. Sem erros de console registrados. Build autônomo aberto em `/dist/index.html?mode=creatures`: worker Blob incorporado gerou o Lobo com pelo em subdiretório, sem erros. `file://` e GitHub Pages não foram testados nesta alteração. Teste Node cobre fallback animado sem WebGL; não houve inspeção SVG no navegador.

Build e verificação de integridade dos 271 arquivos originais passaram. Métricas/renders/showcase do upstream não foram executados. Integração local: publicação no GitHub não solicitada. O CLI game-dev está indisponível; não se trata de um recibo de admissão Game Development Studio.
