# Lenhador — 29/09/2026

Preset `presetCharacter('lenhador')`, construído a partir das duas referências fornecidas pelo usuário (retrato e corpo inteiro). Acesso direto: `http://localhost:5173/?preset=lenhador`.

O preset inicia com Estilo da malha Original, como os demais personagens; Facetado continua disponível como opção. A visualização Rosto permite zoom até 6 (demais vistas: 2,7), sem alterar a aproximação inicial.

O modo Facetado usa duas vezes mais anéis de forma e 25% mais lados nas seções que a malha leve. Mantém iluminação plana, para os novos polígonos aparecerem como planos esculpidos, não como suavização.

- Campo opcional `style: 'faceted'` na receita: mantém planos maiores, normais facetadas e reduz a subdivisão dos sweeps. Receitas anteriores mantêm o comportamento original. O estilo é preservado no JSON.
- Cabelo `lumber` (Topete esculpido), barba `lumber` (Barba esculpida) e roupa `lumber` (Flanela e jaqueta) disponíveis na biblioteca. Nenhuma opção nova entra no sorteio histórico.
- `src/lumber-detail.ts`: mechas sólidas trianguladas, barba com abertura para a boca, camisa xadrez por cores de vértice, gola aberta, mangas dobradas, jaqueta marrom curta sem mangas, com lapelas, bolsos, gola traseira, laterais e barra na cintura, suspensórios, fivela e bolsa.
- Jeans, botas, mãos, olhos, expressões e rig aproveitam a infraestrutura existente. Geometria e materiais são registrados no descarte do personagem.
- Não usa modelos ou imagens externas em runtime. A imagem fornecida é referência artística, não uma reconstrução geométrica exata. Perfil e costas foram interpretados.

Inspeção: `dev/retrato.html?preset=lenhador`, acrescentando `&motion=run&t=.37`, `&detail=low` ou `&detail=uhd`. A versão facetada preserva a linguagem de planos largos no UHD em vez de inserir fios finos.

Correção dos ombros: superfícies contínuas ligam frente e costas acima das cavas. As lapelas têm subdivisão projetada sobre o peito para impedir que os triângulos cortem a camisa, e a gola verde fica recolhida junto ao pescoço. Conferência aproximada: `&chest=1&close=1`, em repouso e corrida.

Refinamento de 30/09: barba mais cheia na parte inferior, com superfície fechando sob a mandíbula até o pescoço. Laterais e nuca recebem uma camada curta de cabelo rente à cabeça sob o topete, respeitando a cor do cabelo. Conferência: `&headback=1` e `&jaw=1`.

Corte lateral revisado pelas linhas marcadas pelo usuário: removida a expansão lateral arredondada, mantendo afastamento mínimo da mandíbula real e afunilando até o pescoço. Mechas laterais estreitadas; volume inferior preservado. Build e validação direcionada de geometria, JSON, expressões e orçamento nos três níveis concluídos.

Encaixes de roupa: cinto elíptico dimensionado pelo tronco, com fivela posicionada na superfície frontal. Pochete em suporte único junto ao cinto, presa por dois passadores contínuos; acompanha o mesmo nó do tronco. Dobras das mangas acompanham o braço superior e o raio da camisa, com sobreposição na borda para evitar folga quando o cotovelo dobra. Validado em Low/HD/UHD e constituição 0, 0,85 e 1.

Revisão de contato: botões e suspensórios projetados sobre os triângulos reais da flanela; suspensórios são faixas contínuas sob a jaqueta. Frente e ombros compartilham a borda de união; lapelas, bolsos e rebites usam a superfície da jaqueta como suporte. Removido o botão superior sobre o decote aberto. `tests/lenhador.ts` verifica contato com a camisa, transformação em movimento e orçamento nas seis combinações de estilo/detalhe. Inspeção visual em repouso e corrida. Low: 5.998 triângulos; Original HD: 38.424; Original UHD: 87.450.

A jaqueta substitui o sobretudo inicial conforme as novas referências de frente e costas. Toda a peça acompanha o tronco, sem abas sobre as pernas e sem simulação de tecido. O rosto, mãos e botas ainda usam a topologia base do editor e diferem das referências. As novas peças constituem uma primeira evolução procedural do padrão visual.
