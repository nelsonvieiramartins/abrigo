# Orçamento de renderização e práticas de desempenho

O orçamento visual não faz parte do mapa salvo. Nunca remover vegetação, modificar
colisões, reduzir danos ou mudar movimentos para atender a um perfil gráfico.

## Implementado

- Editor de mapa, incluindo edição no teste: até 30 FPS, DPR máximo 1,
  sombras 1024² atualizadas até 10 vezes/s, sem pós-processamento nem reflexos dinâmicos.
- Teste de jogo: perfis e controles individuais em `game-performance.ts`, persistência
  separada dos mapas. Equilibrado é o padrão; Máximo conserva a resolução anterior.
- Sombras do mundo atualizadas até 30 vezes/s no jogo. O movimento e a renderização
  principal continuam na frequência escolhida. Sombras cobrem a câmera visível.
- Reflexos cubemap atualizados no máximo uma vez/s. Reutilizam a sombra existente,
  sem gerar seis novos mapas de sombra. Estado do renderer restaurado em `finally`.
- Vegetação instanciada por espécie/variação e setores de 25 m. Geometria e material
  compartilhados; limites incluem margem de vento. Culling não altera dados ou colisões.
- Efeitos não atualizam a cena inteira para calcular matrizes dos emissores.
  Sem emissores, o sistema retorna antes de atualizar o lote de partículas.
- Uma atualização de vegetação por quadro. Prévia de criaturas pausada ao abrir
  o Teste de Jogo; renderização suspensa quando o documento está oculto.
- `renderer.info` agregado por quadro, incluindo reflexos e pós-processamento,
  em vez de informar apenas o último passe. FPS e ms/quadro são médias de cadência,
  não tempos GPU. Contadores de chamadas não medem custo individual de shader.

## Regras para próximas alterações

1. Comparar baseline e candidato no mesmo mapa, câmera, clima, janela, perfil,
   número/tipo de inimigos e navegador. Aquecer shaders/árvores antes de medir.
   Não afirmar ganho de FPS baseado somente em compilação ou testes sem GPU.
2. Testar pelo menos 30 segundos em área aberta, floresta densa, água com reflexos
   e combate. Registrar FPS, ms/quadro, chamadas e picos; usar o profiler do navegador
   para separar CPU/GPU, coleta de lixo e compilação de shaders.
3. Medir setores: reduzem vértices fora da tela, mas podem aumentar chamadas quando
   todo o mapa é visível. Manter tamanho configurado em uma constante e comparar
   antes de diminuir setores ou introduzir mais materiais.
4. Usar instancing para objetos repetidos. Reutilizar geometrias, materiais, vetores
   e buffers; evitar geração de árvore, rebuild de terreno ou criação de composer
   no loop de renderização. Atualizar apenas uniforms que realmente variaram.
5. Sombras, transparência, resolução física e passes extras precisam de orçamento.
   Não voltar a habilitar pós-processamento/4096²/reflexos automaticamente no editor.
6. Liberar recursos GPU ao substituir mapas/modelos. Pausar cenas ocultas; não manter
   prévias em segundo plano concorrendo com o jogo. Testar repetidas aberturas/fechamentos.
7. LOD e resolução adaptativa são candidatos futuros, não implementados aqui.
   Só introduzir com comparação visual, histerese e proteção contra popping/oscilação.
8. Renderização sob demanda é adequada para cenas estáticas. Neste editor há água,
   vento e partículas animados; por enquanto usa limite de 30 FPS, não demanda pura.

## Verificação disponível

`node scripts/test.mjs --game-map`: preservação de mapas, efeitos, colisões,
descarte espacial (fixture: 4 de 16 instâncias visíveis) e liberação de recursos.

`node scripts/test.mjs --game-controls`: perfis, migração de armazenamento,
movimentos, colisão, saltos e percurso. `npm run build`: integração compilável.

Esses testes não constituem benchmark de FPS em hardware real.

## Referências oficiais

- [Sombras: a cena é renderizada novamente para as luzes com sombra](https://threejs.org/manual/pages/shadows.html)
- [InstancedMesh: reduzir chamadas para geometria/material repetidos](https://threejs.org/docs/pages/InstancedMesh.html)
- [WebGLRenderer: contadores por múltiplos passes e controle de pixel ratio](https://threejs.org/docs/pages/WebGLRenderer.html)
- [Renderização sob demanda](https://threejs.org/manual/pages/rendering-on-demand.html)
- [Otimizar muitos objetos](https://threejs.org/manual/pages/optimize-lots-of-objects.html)
