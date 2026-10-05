# Escorpião — integração do complemento v1

O pacote fornecido pelo usuário foi preservado integralmente em `extras/escorpiao-abrigo-v1`. A geometria e os materiais de `src/scorpion-detail.ts` permanecem idênticos ao original. Posteriormente, a pedido do usuário, o ataque foi ajustado para projetar ambas as pinças para a frente por rotação dos braços nos pontos fixos de ligação ao corpo, sem alongar segmentos nem cruzar as pinças. Ao terminar o golpe elas retornam à posição inicial; a animação original da cauda foi preservada.

SHA256 do gerador original arquivado: `4CA5DB3993A629DD1D583AE4D866E9F3A6D9F272C1F7A1242E42FDFEC0526DA2`.

Foi mesclado o patch sobre Aranha, preservando as adaptações locais existentes. O preset Escorpião da mata corresponde exatamente ao JSON de referência incluído. O arquivo spider-detail.ts do novo pacote foi arquivado, mas não substituiu a Aranha ativa.

Adaptações de integração:

- Nova entrada em Criaturas, ícone, cores, ameaça e veneno.
- Controles avançados de corpo, pinças, cauda e ferrão, além dos básicos de patas e cauda.
- Sincronização entre anatomy e scorpion para os sliders e o JSON não divergirem. Valores explícitos do bloco scorpion prevalecem conforme o complemento.
- Corrida habilitada na prévia. O ataque original é um golpe único de cerca de 1,05 s; clicar Atacar inicia ou repete o golpe. A geração do enquadramento retorna a repouso antes de iniciar a prévia para não consumir o relógio do ataque.
- Mesmo salvamento local, histórico, importação/exportação e captura das outras criaturas.

Verificação: identidade do código e receita, 1.872 triângulos em low e 4.208 em high, oito patas, duas pinças, cinco articulações de cauda, socket stinger, ataque/retorno/reinício, transformações finitas, descarte de recursos e testes das sete espécies.

O pacote é código procedural fornecido pelo usuário, não um pacote canônico Game Development Studio; game-dev não está disponível neste ambiente. A integração direta segue o fluxo da Aranha, sem alegar admissão canônica nem presumir licença adicional para o código fornecido. A licença MIT do Three.js incluída no pacote foi preservada. O render de referência usa SVGRenderer com iluminação simplificada; o editor conserva sua iluminação existente.
