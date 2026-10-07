# Fauna Procedural — SDF

Nome da **base de integração do ABRIGO**, não um novo nome ou fork do projeto original.
Identificador estável: `fauna-procedural-sdf`. Revisão da integração: **1**.

Para pedir outra criatura: **“Integre [espécie] usando Fauna Procedural — SDF, seguindo docs/FAUNA-PROCEDURAL-SDF.md e preservando o visual original.”**

## Origem e identificação

- Repositório original: [threejs-procedural-animals](https://github.com/majidmanzarpour/threejs-procedural-animals).
- Pacote original: `procedural-animals`, versão `0.1.0`.
- Commit fixado: `c95ae49346aa8e140a924376cec6cf0073d99512`.
- Licença MIT; autoria de Majid Manzarpour e colaboradores preservada.
- Cópia canônica: `vendor/threejs-procedural-animals/`. Não editar esses arquivos.
- Manual original: `vendor/threejs-procedural-animals/docs/AUTHORING.md`.
- Registro executável: `src/creature-builds.ts` (fonte única da identidade usada pela interface e API).

**Javali (`boar`), Lobo — Fauna SDF (`wolfSdf`), Rato — Fauna SDF (`ratSdf`), Caranguejeira — Fauna SDF (`tarantulaSdf`) e Lobisomem — Fauna SDF (`werewolfSdf`) usam esta base.** Lobo (`wolf`), Rato (`rat`) e Lobisomem (`werewolf`) anteriores continuam separados e intactos. Ver os relatórios `docs/INTEGRACAO-LOBO-SDF.md`, `docs/INTEGRACAO-RATO-SDF.md`, `docs/INTEGRACAO-CARANGUEJEIRA-SDF.md` e `docs/INTEGRACAO-LOBISOMEM-SDF.md`. Lobisomem SDF é uma espécie autoral ABRIGO: usa o pipeline desta base, mas não tem espécie/motor bípede prontos no upstream.

A etiqueta aparece na lista e no cabeçalho da criatura. Presets, variações, rascunhos e JSON exportados recebem `generator`; o modelo recebe `root.userData.generator`. O registro informa nome, identificador, revisão local, pacote, versão, commit, URL e licença. `getCreatureBuild(species)` também está disponível na API pública.

JSON antigos de Javali sem etiqueta continuam funcionando: a validação acrescenta os dados canônicos. Dados `generator` importados não escolhem um renderer e não podem falsificar a origem de outra espécie: a etiqueta corresponde ao gerador efetivamente registrado nesta versão do ABRIGO. Revisão local não é versão upstream; ao atualizar o pacote, revisar commit, versão, manifesto, compatibilidade e documentação juntos.

## O que reaproveitamos

**Lobo — Fauna SDF Low Poly (`wolfLowpolySdf`, 06/10/2026)** é uma sexta entrada nesta base. Usa a escultura, seed, rig e movimentos do `wolfSdf`, com LOD nativo `crowd`, sombreamento facetado e sem camadas extras de pelos. Não substitui o lobo original. Relatório: `docs/INTEGRACAO-LOBO-LOW-POLY-SDF.md`.

SDF (Signed Distance Field / campo de distância com sinal) une volumes de maneira contínua, evitando corpos compostos por peças soltas. O pacote reúne escultura, malha por regiões, pesos de pele, skinning dual-quaternion, pelagem/escamas/penas, olhos, cinemática inversa, marchas e ações. Preservar esse conjunto, não reconstruir o animal com primitivas do gerador humano.

Segundo o manual original, uma espécie reúne `index.js`, `rig.js`, `sculpt.js`, `regions.js`, `coat.js` e `motion.js`. O plano corporal determina o motor de animação. O adaptador quadrúpede do Javali **não** serve automaticamente para aves, cobras, aranhas ou peixes.

## Roteiro obrigatório para a próxima integração

1. **Definir a espécie e o escopo.** Verificar se ela existe no commit local; distinguir integrar uma espécie pronta de criar uma espécie nova. Não trocar geradores existentes nem publicar sem pedido. Copiar `docs/templates/INTEGRACAO-FAUNA-SDF.md` para o relatório da nova espécie.
2. **Ler a fonte.** Consultar README, AUTHORING, módulo da espécie, rig e o motor do plano corporal. Registrar variante, sexo, seed, marchas e ações disponíveis. Comparar com o showcase original antes de adaptar.
3. **Verificar proveniência.** Rodar `node scripts/verify-boar-vendor.mjs`: apesar do nome histórico, verifica todo o pacote. O manifesto é `docs/boar-vendor-lock.json`. Não usar `--record` para esconder diferenças. Nova versão exige revisão explícita e novo registro de origem; conservar MIT nos bundles.
4. **Adaptar fora de vendor.** Usar um módulo `src/<especie>-detail.ts` e, se necessário, worker próprio. Referência: `src/boar-detail.ts` e `src/boar-worker.ts`. Manter rig, materiais, olhos, pelos e ações originais. Valores neutros devem produzir os mesmos buffers e ossos do pipeline original.
5. **Respeitar coordenadas e movimento.** Metros, +Y para cima, +Z para frente; conferir esquerda +X no upstream. O jogo controla root, orientação, colisão e dano. Não somar deslocamento virtual do motor ao deslocamento mundial. Adaptar tempo absoluto do ABRIGO para o motor e tratar troca de ação, reinício e seek. Ataque deve ser único, com impacto, duração e cooldown documentados.
6. **Expor somente controles válidos.** Mapear escala no root e anatomia às variações/deformações nativas. Não escalar ossos ou superfícies isolados. Preservar seed determinística, separar cores de buffers compartilhados e impedir mutação do cache. Campos sem suporte não devem prometer efeitos visuais inexistentes.
7. **Integrar todas as rotas.** Atualizar schema/preset/validação/variação, factory, editor, ícone, anatomia, aparência, ações, arena/waves e API. Adicionar a espécie a `CREATURE_BUILD_BY_SPECIES` somente quando sua factory usar esta base. Marcação passa automaticamente para interface e JSON.
8. **Manter todos os ambientes.** Gerar em worker, limitar e reaproveitar cache; preparar antes da factory síncrona. Testar worker no Vite, HTML offline e subdiretório do GitHub Pages. Preservar fallback sem WebGL, bounds animados, sockets e descarte idempotente. Documentar diferenças do fallback (por exemplo, sem pelo no SVG).
9. **Verificar antes de concluir.** Comparar superfície/rig neutros diretamente com upstream; seeds, tiers, cores, seis variações e vistas frontal/lateral/3/4. Exercitar toda ação disponível, recuperação, chão, bounds, root sem deriva, sockets, cache e dispose. Rodar testes específicos, `npm run test:creatures`, `node scripts/test.mjs --game-combat`, verificador e `npm run build`; antes de publicar, bateria completa. Quando disponíveis, executar também os checks/metrics/renders do manual upstream. Não declarar inspeções não executadas como aprovadas.
10. **Registrar e entregar.** Preencher relatório, limites de qualidade/performance, diferenças aceitas, comandos executados e pendências. Atualizar `docs/HANDOFF_LLM.md`. Nenhum teste de buffers substitui a inspeção do material no navegador. Publicação é uma etapa separada.

## Lições do Javali

- HD corresponde a `high`, não a `hero`. Pelagem GPU adiciona custo além dos triângulos base exibidos.
- Worker deve estar incorporado no build offline, sem caminhos absolutos de deploy.
- CPU skinning mantém bounds e fallback coerentes com a pose GPU; não modificar normais ou cores compartilhadas do cache.
- Deslocamento virtual local é necessário para marcha, mas não pode mover o root do jogo.
- Dano por alcance/direção não é colisão real de presas. Documentar essa diferença.

Relatório do piloto: `docs/INTEGRACAO-JAVALI.md`. Esta é documentação local reutilizável; não constitui instalação de skill nem recibo de admissão do Game Development Studio.

## Navegação separada

As espécies desta build ficam na aba completa **Criaturas SDF** (`?mode=creatures-sdf`), separada de **Criaturas** (`?mode=creatures`). A classificação usa `CREATURE_BUILD_BY_SPECIES`; cada aba preserva seu rascunho e histórico. O rascunho legado migra somente para a categoria correspondente, sem ser apagado.

Terreno e Efeitos da arena: ver `docs/INTEGRACAO-EDITOR-MAPA.md`.
