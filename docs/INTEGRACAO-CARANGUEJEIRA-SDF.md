# Caranguejeira — Fauna Procedural — SDF

## Identidade e referências

Espécie nova `tarantulaSdf`, sem substituir `spider`. Usa a variante nativa `spider / tarantula`, fêmea adulta; seed `aranha-referencia-01` reaproveitada da Aranha atual. Ficha de vida/dano/veneno herdada do preset anterior; seu corpo e movimentos não foram alterados.

Origem: pacote `procedural-animals` 0.1.0, commit `c95ae49346aa8e140a924376cec6cf0073d99512`, licença MIT e avisos preservados. Arquivos de vendor intactos. Registro `CREATURE_BUILD_BY_SPECIES.tarantulaSdf`, etiqueta no editor, API, JSON e userData.

Referências visuais pesquisadas em 05/10/2026:

- [Smithsonian — Goliath bird-eating tarantula](https://nationalzoo.si.edu/animals/goliath-bird-eating-tarantula): abdômen robusto, pelos, oito patas, pedipalpos e quelíceras com presas que golpeiam para baixo. Guia morfológico, não alegação de que o modelo reproduz exatamente Theraphosa blondi.
- [Smithsonian — Insect Zoo](https://naturalhistory.si.edu/visit/accessibility/audio-and-visual-description/insect-zoo-audio-description-tour): caranguejeira de joelhos alaranjados, quatro pares de patas saindo da carapaça e pedipalpos dianteiros.
- [Smithsonian — espécime de caranguejeira](https://www.si.edu/object/tarantula-baboon-spider%3Anmnheducation_10866428): fotografia dorsal localizada pela busca visual. Não incorporada ao jogo; tentativa de abrir imagem original não retornou conteúdo.

Escolha visual: preservar os três morfos já pintados pelo upstream (redknee, rosy, pinktoe) escolhidos pela seed, em vez de inventar novas texturas. Preset neutro é redknee. Corpo de seis centímetros aproximadamente no rig de referência; patas de sete segmentos, oito olhos pequenos no tubérculo ocular, pedipalpos separados e abdômen peludo. A Aranha ABRIGO orientou a identidade da ficha e o ataque de levantar a frente, projetar os apêndices e golpear, não a duplicação literal de sua malha facetada.

## Adaptação

`src/tarantula-sdf-detail.ts` + worker próprio. `prepareFauna` prepara HD/baixo em segundo plano; worker embutido no editor compilado/offline e API. Plano de animação `spider`, nunca o motor quadrúpede do Javali.

Escala no root; volume .5 neutro controla `abdK` nativo. Comprimento das patas via `legK`; abertura da postura via `stance.width` no IK nativo; volume do corpo/patas via warp contínuo `girth`. Três ajustes entre .7 e 1.3. Os onze controles específicos da Aranha antiga não são expostos nesta espécie: não prometer parâmetros que o novo rig não usa. Cores editadas tintam quitina/pelos; olhos/presas continuam materiais independentes. Cores sentinelas do preset deixam a pintura original intacta.

Repouso, caminhar (velocidade virtual .035 m/s), correr (.1 m/s) e ataque único nativo `threat-lunge`: ameaça .9 s, impacto 1.06 s, ação 1.9 s + fade .25 s; duração de combate 2.15 s, cooldown .8 s. Levanta patas dianteiras e frente do corpo, abre quelíceras/presas, avança e fecha golpeando para baixo; pares traseiros sustentam o corpo. Dano por alcance do combate, não colisão física individual de cada presa.

Root mundial permanece sob controle do jogo; deslocamento virtual cancelado. Bounds CPU animados, sockets upstream, cache de oito receitas isolado e descarte idempotente. Raio de colisão .09 m. Base de prévia varia só em X/Z com topo Y=0, sombra ajustada ao pequeno porte; nunca corrigir contato escalando a altura da base. Fallback SVG conserva pele/ossos animados, mas não os pelos shader. HD neutro: 146.118 triângulos base / quatro peças; pelos acrescentam custo de camadas.

## Evidências e limites

`verify-boar-vendor.mjs`: 271 arquivos intactos. `--tarantula-sdf`: superfície/coat/rig neutros iguais ao build direto, oito patas e duas presas, receitas determinísticas, anatomia efetiva, ataque/recuperação, root preservado e fallback CPU. `--creatures` passou com 208 modelos de 13 espécies, nos dois níveis de detalhe e anatomias extremas. `--game-combat` passou, incluindo o instante de impacto e dano único da Caranguejeira. `npm run build` passou. Editor compilado carregou o worker HD, exibiu 146.118 triângulos e não registrou erros de console; evidência `.test/caranguejeira-fauna-sdf.png`. Fotografias de referência não foram baixadas ou incorporadas; nenhum serviço pago foi usado.

A skill game-asset-production foi consultada para evidências e proveniência; o CLI game-dev não está instalado, portanto não há recibo de pacote canônico nem exportação GLB validada. Entrega é o gerador procedural integrado ao ABRIGO. Testes/renders upstream completos e file:// real não executados. Publicação não solicitada.

Medição de custo: HD neutro 146.118, baixo 28.002 triângulos base; seis sementes em HD entre 118.302 e 171.560; extremos de anatomia 111.002–182.180. Orçamento específico limitado a 220.000 (as outras espécies SDF mantêm 160.000), permitindo sete segmentos por pata sem simplificar o preset nativo. Camadas de pelos custam renderização adicional. Inspeção no Vite: repouso 3/4, ameaça/ataque lateral, caminhada e corrida no tier baixo; modelo apoiado na base.
