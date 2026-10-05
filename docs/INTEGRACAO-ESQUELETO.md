# Esqueleto v4 — integração

Origem: `C:/Users/nelso/Downloads/esqueleto-abrigo-v4 (1)/esqueleto-abrigo-v4`.

O pacote completo foi preservado em `extras/esqueleto-abrigo-v4`. O gerador original arquivado tem SHA256 `4D23F8DA3C92412236AEB15682EC5B3B8E093E851B0317F05313F5BB2E154070`. No gerador ativo `src/skeleton-detail.ts`, malhas, materiais, articulações e movimentos originais do v4 foram preservados; foi acrescentado somente Correr+ por solicitação do usuário. O ambiente render do pacote foi arquivado, sem instalar dependências nem substituir o schema principal.

Foi mesclada somente a integração da espécie skeleton; não substituímos os módulos atuais por cópias antigas do pacote.

- Esqueleto em Criaturas, com preset idêntico à receita de referência.
- Escala, volume, comprimento das pernas, espessura dos ossos e largura do tórax.
- Cores de ossos, partes internas e cavidades do crânio. O controle de marcas fica oculto pois não é utilizado pelo gerador; o veneno permanece desativado.
- Repouso, caminhada, corrida, Correr+ e golpe único, com reinício pelo botão Golpear. Correr+ é exclusivo do Esqueleto entre as criaturas: cadência de 13 rad/s, passada de 0,36 proporcional às pernas, braços alternados de 0,95 rad, cotovelos dobrados e tronco inclinado como nos personagens. As pernas usam IK rígida, sem alongar os ossos.
- Histórico, armazenamento local, importação/exportação JSON, PNG e sprites via fluxo existente.
- API createCreature e sockets head, mouth, back, target, handL/R e footL/R.

Testes: construção da geometria idêntica ao original, receita de referência, 5.549 triângulos low / 7.945 high, 21 malhas, orientação e simetria de mãos/pés, cavidades do crânio por raycast, comprimento rígido dos ossos, apoio no chão inclusive durante Correr+, inclinação e braços da corrida acelerada, retorno ao repouso, golpe/retorno/repetição, geometria imutável, recursos e regressão das oito espécies (128 construções). O teste anatômico do pacote foi adaptado nos imports e ampliado para verificar Correr+ em tests/skeleton.ts.

Execute `node scripts/test.mjs --creatures` e `npm run build`.

Integração direta de código fornecido pelo usuário, seguindo os complementos anteriores. game-dev não está disponível; não há receipt de admissão canônica Game Development Studio. A licença MIT do Three.js foi preservada, sem presumir licença adicional para o código procedural. A iluminação do editor é diferente das PNGs rasterizadas fornecidas. Dano e IA continuam sob responsabilidade do jogo, como nas outras fichas de criaturas.
