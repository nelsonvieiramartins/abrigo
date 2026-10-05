# Teste de combate por ondas

Em **Teste de jogo**, o painel **Combate por ondas** permite configurar até 10 ondas. Cada onda tem contadores para Lobo, Lobisomem, Morcego, Enxame, Cobra, Aranha, Escorpião e Esqueleto, com total de 1 a 20 criaturas. Quantidade zero exclui aquele tipo.

Configure vida do jogador, dano por golpe e intervalo entre ondas. **Salvar ondas** grava a receita em `abrigo-combat-waves-v1` no armazenamento deste navegador. Mudanças entram em vigor no próximo reinício; a sessão em andamento usa uma cópia validada. A gravação não altera personagens ou presets.

**Iniciar / reiniciar combate** leva o jogador para o setor Combate, inicia uma contagem de dois segundos e habilita teclado/joystick. As criaturas usam os modelos HD e as animações existentes, perseguem o jogador, colidem com os corpos e obstáculos e atacam por proximidade. A onda seguinte começa quando todos os inimigos vivos forem derrotados. Vitória encerra a última onda; vida zero encerra com derrota. **Jogar/Pausar**, Esc, perda de foco e fechamento da janela interrompem o avanço da simulação. Há controles de reinício e encerramento também no HUD de tela cheia.

R/F (ou os vínculos de ataque configurados) causam dano na janela ativa da animação, uma vez por inimigo por golpe. O teste usa alcance frontal e diferença de altura: 0,9 m sem item e 1,6 m com item equipado, acrescidos do raio do alvo. Não é uma colisão física precisa da lâmina; isso fica separado do teste de madeira. O dano das criaturas usa o preset; não há efeitos de veneno, navegação com busca de caminhos ou animação de morte nesta versão. Inimigos derrotados são removidos e seus recursos liberados.

Módulos: `src/game-combat.ts` (validação, ondas, IA e dano), `src/game-combat-scene.ts` (modelos/barras/recursos), integração em `src/game-test.ts` e `src/scene.ts`. Testes: `node scripts/test.mjs --game-combat`, incluídos em `npm test`.
