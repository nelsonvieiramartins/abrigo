# ABRIGO — Criador de sobreviventes · v1.0

## Usar online

Abra [ABRIGO no navegador](https://nelsonvieiramartins.github.io/abrigo/). A publicação é automática pelo GitHub Actions após cada envio para `main`. Veja [Publicação no GitHub](docs/PUBLICACAO-GITHUB.md).

Os dados são salvos neste navegador, não em uma conta online. Para transferir receitas do editor local, exporte e importe os JSONs.

**Novo: Criaturas da floresta.** A aba principal Criaturas abre um editor próprio para lobos, morcegos, enxames de vespas e cobras, com anatomia por espécie, cores, ficha de ameaça, animações, histórico, JSON e PNG. Veja [docs/CRIATURAS.md](docs/CRIATURAS.md) para a API de integração Three.js e os limites desta primeira versão.

Editor de personagens procedurais em Three.js, inspirado na apresentação isométrica de jogos como Project Zomboid. Projeto independente, com componentes reais reutilizados do [img2threejs](https://github.com/img2threejs/img2threejs).

## Abrir agora

1. Extraia o ZIP inteiro.
   Se baixou o código-fonte do GitHub, execute `npm ci` e `npm run build` primeiro para gerar o HTML offline.
2. Abra **ABRIR_EDITOR.html** no navegador. No Windows, também pode executar **INICIAR.bat**.
3. Escolha uma base na coluna esquerda, personalize nas abas da direita e exporte o personagem.

**Não é preciso instalar Node, Python ou baixar modelos para usar o editor.** O HTML já inclui o programa e o Three.js; pode funcionar offline. Para editar o código e recompilar, veja a seção Desenvolvimento.

## O que está implementado

### Criaturas da floresta

A área **Criaturas** mantém configuração, rascunho e histórico separados dos personagens. Ela inclui Lobo, Morcego, Enxame de vespas e Cobra, cada um com controles anatômicos, aparência e ficha de ameaça próprios. O modo HD recebeu detalhes inspirados no gerador de personagens: conexões contínuas, dedos e garras no lobo; asas membranosas curvas no morcego; insetos segmentados com antenas, pernas, ferrão e duas asas no enxame; escamas geométricas, placas ventrais, mandíbula, presas e língua bifurcada na cobra.

O enxame HD usa três `InstancedMesh` para todos os insetos e preserva uma rota sem instancing para SVG/compatibilidade. As métricas e verificações ficam em `docs/test-results.json`; a API está em `docs/CRIATURAS.md`.

- Corpo: altura, constituição, largura dos ombros, quadril, busto, cabeça e rosto (sem separação de gênero: busto, quadril, ombros e cabelo compõem qualquer silhueta); seis tons de pele e cores livres.
- Cabelo: curto, lateral, despenteado, raspado, chanel, comprido, topete, degradê, espetado, franja, para trás, médio ondulado, rabo de cavalo, careca e sem cabelo; quatro opções de barba.
- Roupas: jaqueta, camiseta, regata, moletom, camisa de campo (de botão, com bolsos camuflados e patches); cargo, jeans, bermuda; botas e tênis. Cores independentes.
- Acessórios: mochila, óculos, gorro, boné e boné camuflado. Desgaste procedural por cor dos vértices.
- Bases: guarda florestal, mecânico, socorrista, civil Exploradora (busto, quadril largo, cabelo comprido, jaqueta e mochila) e Legendário (camisa de campo laranja, boné camuflado, calça escura e tênis preto; insígnias genéricas, sem logotipos reais).
- Profissão e traços com atributos iniciais e pontos de criação.
- Prévia isométrica, frente, lado, costas, rosto, rotação livre e zoom.
- Animações por código: parado, caminhada, corrida, pose de inspeção e as ações em loop Pegar (agacha e pega do chão), Saltar e Orar (ajoelhado, com as mãos para o alto). Articulações e pontos para equipamento acompanham o movimento.
- Aba **Feições**: oito tipos de rosto prontos (Clássico, Forte, Alongado, Anguloso, Redondo, Rústico, Marcado e Suave) e ajuste fino de formato do rosto, queixo (tipo e tamanho), bochechas, sobrancelhas, nariz e boca. Cavanhaque nas opções de barba. Arquivos antigos abrem com o rosto clássico. Os ajustes podem ser salvos por cima de um tipo (“Salvar em …”) ou como um tipo novo com nome; ficam guardados neste navegador, e “Restaurar tipos originais” desfaz as alterações nos tipos de fábrica.
- Aba **Expressão**: Neutra, Feliz, Brava, Triste, Cansada e Surpresa, com intensidade ajustável e transição suave. As animações do rosto continuam por cima de todas. É só da prévia (não entra no JSON); no jogo, use `actor.setExpression('happy', 1)`.
- Animação facial leve (alta definição): piscadas a cada 2–6 s, às vezes duplas; sobrancelhas que sobem, descem e franzem, às vezes só de um lado; e olhar que fixa um ponto e salta discretamente para outro, às vezes com uma olhadela rápida para o lado. O ritmo vem da semente, então cada sobrevivente pisca no seu tempo. Com `update(0)` os olhos estão sempre abertos, o que vale para a folha de 8 direções.
- Dois níveis de malha: **alta definição** (padrão; rosto com olhos, pálpebras, nariz e lábios, mãos com dedos, calçados cartoon com sola grossa em duas camadas, biqueira, reforço no calcanhar e cadarços em tiras largas, barba que acompanha o rosto, cabelo em volumes facetados com linha do cabelo por penteado, tufos no contorno e planos de cor, sombreamento suave) e **leve** (a malha facetada original, para multidões). O botão **HD** da prévia alterna entre eles. O botão **UHD** liga a ultra definição: malha cerca de 2,5× mais densa (rosto incluído), relevo de poros na pele e trama no tecido, milhares de fios de cabelo e barba instanciados com balanço por shader — a mesma técnica das folhas das árvores do mapa — e a renderização da floresta (`src/postfx.ts`: HDR, bloom, cor, contraste, vinheta, ACES e SMAA, com os mesmos valores do jogo).
- Geração determinística por semente, desfazer/refazer, rascunho no navegador e importação/exportação JSON.
- Exportação PNG da prévia e folha transparente com oito direções.
- Renderização WebGL e um modo SVG compatível quando a aceleração gráfica não está disponível.

## Controles e arquivos exportados

Arraste a prévia para girar e use a rolagem para aproximar. Os botões acima do personagem restauram vistas fixas. “Rosto” aproxima a câmera; “PX” mostra baixa resolução quando WebGL está disponível.

**Exportar personagem:** gera `nome.personagem.json`, com a receita completa, sem malha binária. Importe esse arquivo para restaurar as escolhas. Exportar e importar não exige conta nem servidor.

**Semente:** “Gerar personagem com esta semente” reconstrói a mesma base aleatória para a mesma versão do gerador. Modificações manuais e modelos iniciais são escolhas adicionais; para preservá-los, salve o JSON completo. “Novo sobrevivente” sorteia uma nova semente.

**Salvar rascunho:** usa `localStorage` do navegador. Alguns navegadores restringem esse recurso em arquivos locais; se o editor avisar, salve o JSON. Um arquivo JSON é a maneira portátil de levar o personagem para outro computador.

**Exportar 8 direções:** PNG RGBA de **1024 × 640**, com oito quadros de **256 × 320**, em quatro colunas e duas linhas. Cada quadro mostra o personagem parado, sem o pedestal, em elevação isométrica aproximada de 35,3°. A rotação do personagem aumenta 45° por quadro: `0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°`. A primeira vista é frontal. A convenção do modelo é Y para cima e +Z para frente. É uma folha de direções estáticas, não uma folha de animação.

## Uso real do img2threejs

O projeto foi obtido do GitHub no commit `6e60b5e22419464b4853e01ddb6c0e6f6659a733`.

Reutilização específica:

1. **`buildTaperedSweepGeometry`** — extraído do gerador `forge/stage3_build/generate_threejs_factory.py`; constrói tronco, cabeça, membros, cabelo e partes de roupa em tempo de execução. Mantido com sua implementação original, acrescentando apenas importação de Three.js e exportação da função.
2. **`derive_anatomy(8)`** — executado a partir de `forge/stage2_spec/humanoid_proportions.py`; fornece a base canônica de proporções e as divisões do rosto. O design estilizado acrescenta seus próprios parâmetros e dimensões.
3. Estrutura de componentes e pontos de fixação exposta como `root.userData.sculptRuntime`.

**Acrescentado neste projeto:** interface, esquema de personagem, gerador por semente, opções visuais, articulações hierárquicas, movimento, equipamentos, arquivos e integração. Nenhum modelo do showcase foi copiado.

Esta é uma extensão com os componentes reutilizáveis do repositório. Não é o pipeline completo de reconstrução de imagens e não declara aprovação nos gates de fidelidade visual do upstream. Não há uma fotografia de referência para reconstruir.

O código original utilizado fica em `vendor/img2threejs/forge`, com licença e proveniência. Veja `THIRD_PARTY.md`.

## Desenvolvimento

Requisito: Node.js 22.12 ou superior.

```sh
npm ci
npm run dev
```

Abra o endereço informado pelo Vite. Para gerar os arquivos distribuíveis:

```sh
npm run build
npm test
```

O build gera `ABRIR_EDITOR.html`, uma cópia em `dist/`, e `dist/character.module.js` para integração. O módulo importa `three`; o HTML autônomo já inclui essa dependência.

Para reproduzir a extração do upstream, com Python 3.10 ou superior:

```sh
python scripts/extract-img2threejs.py
```

Não há dependências Python adicionais. Os arquivos extraídos já estão incluídos; esse comando não é necessário para usar ou compilar o editor.

## Arquitetura

| Arquivo | Responsabilidade |
|---|---|
| `src/schema.ts` | Receita validada, opções, sementes, modelos e atributos |
| `src/character.ts` | Geometria, materiais, acessórios, articulações e movimento |
| `src/vendor/taperedSweep.ts` | Construtor de superfícies do img2threejs |
| `src/generated/anatomy.json` | Proporções geradas pelo utilitário original |
| `src/scene.ts` | Câmera, iluminação, prévia e exportação de imagens |
| `src/main.ts` | Interface, histórico, rascunho e arquivos |
| `src/api.ts` | API para integração em outro projeto |
| `docs/OBJETOS.md` | Área Objetos: fluxo imagem → objeto Three.js sem IA, receita, API e limites |
| `docs/HANDOFF_LLM.md` | Estado completo do projeto, decisões, armadilhas e próximos passos (ponto de partida para continuar o trabalho) |
| `docs/INTEGRACAO.md` | Uso no jogo Three.js e orientação para Rapier |
| `tests/core.ts` | Determinismo, validação, geometria e movimento |
| `dev/retrato.html` | Folha de inspeção (só desenvolvimento): cinco vistas e close-ups de rosto, mão e pés. Parâmetros: `preset`, `seed`, `detail`, `motion`, `t`, `wire`, `headback`, `chest`, `feet`, e `hair`/`hat`/`beard`/`hairColor` para trocar o visual do modelo |

## Escopo desta versão

O personagem usa **peças articuladas rígidas**, sem arquivos GLB/FBX, sem animações importadas e sem `SkinnedMesh`. As juntas podem ficar perceptíveis de perto. A animação de caminhada ocorre no lugar; o jogo controla deslocamento, colisões e orientação. O apoio dos pés considera um piso plano na prévia.

Profissão e traços são **metadados**, com cálculo de atributos para a ficha. A lógica do seu jogo deve aplicar os efeitos. O editor não acrescenta inventário, combate, inteligência artificial ou colisores Rapier automaticamente.

A geração combina formas paramétricas e um catálogo de peças. Não transforma qualquer imagem em avatar nem cria roupas arbitrárias por IA. Esta primeira versão permite desenvolver o catálogo e o rig sem depender de modelos externos.

O modo compatível preserva a geometria e os controles, com iluminação simplificada, sem sombras WebGL nem efeito PX. Em cenas com muitos personagens, use o nível leve (`detail: 'low'`); a quantidade de peças ainda exige trabalho adicional de otimização.

## Verificações realizadas

- Build do HTML offline e do módulo de integração concluído.
- Testes passaram em **148 configurações × 2 níveis de malha** de personagens e **64 construções × 2 níveis** de criaturas, incluindo sementes, combinações visuais e proporções extremas.
- Geometria finita, movimentos válidos, sockets, apoio dos pés e descarte de recursos verificados. Máximo observado: personagens com **5.300 triângulos** (leve) e **58.158** (alta definição); criaturas com **9.600** (leve) e **55.200** (alta definição).
- Interface e mudanças de cabelo, barba, roupa, acessórios, vista e animação conferidas no navegador.
- JSON exportado, lido e importado de volta com sucesso.
- PNG exportado e inspecionado: 1024 × 640, transparência e oito quadros não vazios.
- A inspeção visual foi feita no **modo compatível**: o navegador de teste não disponibilizou WebGL. A aparência WebGL com sombras ainda precisa de conferência em uma máquina com aceleração gráfica.

## Licenças

Código próprio: Apache-2.0. Componentes img2threejs: Apache-2.0. Three.js: MIT. Licenças incluídas. Nenhum asset do Project Zomboid é distribuído.
