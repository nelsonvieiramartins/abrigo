# Zumbi e Personagens Vilões

O preset `zumbi` fica na guia **Personagens Vilões**, separado dos presets normais.
Acesse `/?mode=villains` ou `/?preset=zumbi`. Zumbis continuam sendo personagens
humanoides; a seção Criaturas não foi alterada.

## Corpo e editor compartilhados

O Zumbi usa diretamente `createCharacter` em `src/character.ts`, com as mesmas
proporções iniciais do Lenhador e a mesma modelagem arredondada de torso,
ombros, braços, mãos, quadril e pernas. Mantém pele esverdeada, olhos claros,
cabelo escuro e roupas gastas. A roupa `zombie` usa a jaqueta ajustada do
modelador humano, sem a antiga malha quadrada.

`src/zombie-detail.ts` recupera características do modelo anterior sobre essa
base: órbitas encovadas, bochecha assimétrica com ferida, boca entreaberta,
jaqueta aberta com camisa oliva, mangas desfiadas e rasgos na barra e na calça.
Os rasgos removem triângulos da roupa; uma camada interna de pele/camisa fica
no mesmo grupo articulado, acompanhando as animações sem peças flutuantes.

Corpo, cabelo, barba, feições, ajustes avançados, expressões, roupas, kit,
itens, dedos, soquetes, posições dos braços, todas as animações, estilos
Original/Facetado e níveis leve/HD/UHD são os mesmos do editor normal.
JSON, PNG e exportação de oito direções continuam disponíveis.
Todas as roupas podem ser escolhidas manualmente; a geração aleatória dos
vilões tem uma seleção própria de roupas e cores. Alterações no guarda-roupa
de uma guia não mudam o personagem da outra.

O módulo fornecido em `src/vendor/zumbi-procedural.mjs` e o adaptador antigo
`src/zombie.ts` foram preservados como referência, mas não são mais usados
pelo preset. Nenhum arquivo original em Downloads foi alterado.

## Sementes e armazenamento

`src/character-categories.ts` define a categoria e a geração independente.
`randomVillain(seed)` utiliza namespaces `villains:zumbi:` e
`villains:wardrobe:`; as sementes históricas de `randomCharacter` não mudam.

Os rascunhos usam chaves separadas no navegador:

- Personagens: `abrigo-character-v1`.
- Personagens Vilões: `abrigo-villain-character-v1`.
- Ajustes definitivos de itens e tipos de rosto dos vilões: prefixo `villains:`.
- Os ajustes e tipos de rosto normais mantêm suas chaves anteriores.

Um Zumbi antigo encontrado no rascunho normal é copiado para o rascunho de
vilões, se este ainda não existir. A troca de guia salva o rascunho anterior,
cancela o salvamento pendente e mantém uma cópia em memória para não perder
edições caso o navegador bloqueie armazenamento. Desfazer/refazer não cruza
categorias. Importar um JSON direciona o personagem à categoria correta.

O salvamento é local a este navegador/origem. Exportar o JSON continua
sendo a forma de fazer backup e levar o personagem para outro navegador.

## Verificação

`node scripts/test.mjs --zombie` cobre proporções iguais às do Lenhador,
geometria finita nos três níveis, expressões, todos os movimentos, soquetes,
geração determinística, separação de catálogos e migração de rascunhos.
`npm test` inclui as regressões dos personagens, objetos e criaturas.
