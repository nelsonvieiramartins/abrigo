# Rato procedural v4

Pacote fornecido pelo usuário: `ratos-abrigo-v4/ratos-abrigo-v4`, copiado integralmente para `extras/ratos-abrigo-v4`.

Os 50 arquivos do manifesto foram verificados por tamanho e SHA-256 antes da cópia. Os testes verificam novamente todos os arquivos copiados e que `src/rat-detail.ts` é idêntico ao original (SHA-256 `07213bd846348e09325000e4a19741bd4eeae55437ff7333b83efc2b98c9b6ae`).

A integração é manual, autorizada pelo usuário após informar a indisponibilidade de `game-dev` e a ausência de licença explícita do código procedural. Não existe recibo canônico de admissão do Game Development Studio. A licença MIT do Three.js foi preservada; a autorização de integração não atribui uma nova licença ao pacote.

Não foram substituídos os esquemas antigos fornecidos no pacote. O esquema atual recebeu a espécie `rat`, os dez controles de forma e sincronização com `anatomy`. Geometria, materiais e movimentos do gerador v4 permanecem inalterados.

Movimentos: repouso, caminhar, correr, Correr+ (`runPlus`) e mordida única. HD: 2.586 triângulos/37 malhas; baixo detalhe: 1.652 triângulos/33 malhas. As receitas marrom, cinza e preto são importáveis. Nas ondas, a velocidade nominal de corrida acompanha o passo e a mordida causa dano uma vez no instante de impacto.

Testes: `npm run test:creatures` e `node scripts/test.mjs --game-combat`. A suíte reaproveita as verificações anatômicas fornecidas no pacote, com imports adaptados ao projeto.
