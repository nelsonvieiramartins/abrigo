# Aranha procedural — integração

O complemento fornecido pelo usuário foi copiado integralmente para `extras/aranha-abrigo-v1`. Origem: `C:/Users/nelso/Downloads/aranha-abrigo-complemento-v1/aranha-abrigo`. O visualizador, referência PNG, receita, patch e licença do Three.js permanecem nessa pasta como recebidos; não substituem o editor.

O gerador original permanece intacto em `extras/aranha-abrigo-v1/spider-detail.ts`, SHA-256: `6C1E4FF078B943C1A8D50EE30E719B5AC5941908562B9D2DC4CBB3168B5BAEC6`. A geometria em `src/spider-detail.ts` permanece idêntica: o teste compara toda a construção de malhas, materiais e landmarks com o original.

Após a integração, a pedido do usuário, apenas a animação do ataque foi alterada. A versão atual segue a sequência do complemento v2-ataque fornecido em Downloads: preparação, golpe único e retorno. Os dois pares dianteiros levantam e avançam (o primeiro com maior amplitude), junto com ambas as pinças/presas, enquanto os dois pares traseiros mantêm apoio. A frente do corpo sobe levemente. A cinemática inversa preserva o comprimento dos segmentos. Clicar Atacar reinicia o golpe na prévia; repouso e marcha conservam o comportamento original, e sair do ataque restaura a postura.

As demais adaptações ficam fora do gerador:

- Despacho de `species: spider` antes das demais espécies, nos modos leve e HD.
- Validação do bloco opcional `spider`, presets e geração por semente.
- Receita padrão igual a `aranha-da-mata.criatura.json`.
- Botão Aranha em Criaturas; repouso, caminhada, corrida e ataque.
- Controles básicos de comprimento, abertura e espessura das patas, sincronizados com os campos correspondentes de `spider`; overrides do JSON são preservados e refletidos em `anatomy`.
- Oito controles adicionais para abdômen, cabeça, altura corporal e olhos.
- Cores, veneno, salvar, importar/exportar JSON e exportação de imagens usam o fluxo existente.

O pacote é código-fonte fornecido pelo usuário, não um pacote canônico do Game Development Studio; não possui receipt de admissão desse sistema. O CLI `game-dev` não estava disponível. A integração foi feita diretamente como extensão de código, com cópia original preservada e verificação de integridade. A licença MIT do Three.js está preservada no complemento; nenhuma licença adicional para o código gerado foi presumida.

Validação: identidade da geometria e receita, 1.224 triângulos em low / 1.704 em high, oito patas, avanço dos membros dianteiros e pinças, apoio traseiro, segmentos sem alongamento, golpe único com retorno e reinício, quatro animações, sockets, JSON, parâmetros e descarte. Execute `node scripts/test.mjs --creatures`.
