# Teste de jogo

Abra **Teste de jogo** na barra superior. A arena usa uma cópia do personagem ou vilão atualmente configurado, com roupa, item, soquete, mãos e movimentos ON/OFF preservados. Não modifica a receita do personagem e não tem inimigos ativos nem dano aos personagens. Há um teste de desgaste da madeira por contato com o machado.

## Teste de colisão

Oito personagens aleatórios e procedurais ficam parados ao redor da posição inicial, todos em HD, sem itens nas mãos. Cada um tem aparência, roupas e proporções próprias. **Novos personagens HD** gera outro grupo sem alterar o personagem controlado. Seus corpos bloqueiam o deslocamento; é possível deslizar pelas laterais. A colisão corporal usa círculos no chão dimensionados pelas proporções do corpo; não representa cada dedo, roupa ou arma.

**Colisão ON/OFF** permite comparar com passagem livre e reinicia a posição ao alternar. **Mostrar áreas de colisão** exibe os limites no chão; a cor laranja e o texto **Contato** indicam bloqueio. As opções do teste não alteram os controles salvos nem o personagem original. As cópias são liberadas ao voltar ao editor.

Clique em **Jogar** para capturar teclado/joystick. **Esc**, perda de foco ou mudança de aba pausam os controles. **Voltar ao editor** fecha a arena. O circuito ocupa 48 × 48 metros; a câmera acompanha a posição e a altura do personagem.

**Tela cheia**, no cabeçalho, amplia somente a área do jogo e esconde o painel de configurações. Um HUD permite jogar/pausar, trocar de setor e sair da tela cheia. Esc também sai. Em ambientes sem suporte nativo, somente a arena ocupa toda a área disponível do navegador.

## Circuito de testes

Use **Ir para setor** para começar diretamente em um desafio. **Reiniciar posição** retorna ao início do setor escolhido. As rampas têm altura real e levam a duas plataformas separadas por um vão de 1 metro. Use corrida + salto perto da borda para cruzá-lo. No modo teste, saltar durante caminhada, corrida e corrida+ decola no primeiro quadro após o comando, sem os 0,62 s de preparação da demonstração do editor. A animação começa na pose de decolagem e acompanha a física; segurar o botão não reinicia o salto. O salto parado mantém sua preparação. Cair no vão retorna ao ponto inicial desse setor; o HUD conta as quedas.

Há caixas de alturas diferentes para testar saltos e colisão, muros e um trajeto em zigue-zague. A passagem baixa ajusta a altura de seu teto à altura do personagem e bloqueia a entrada em pé. Segure C para andar agachado; dentro da passagem, não é possível levantar ou saltar até sair debaixo do teto. Colisão OFF desliga bloqueios corporais e dos obstáculos; o chão, rampas e gravidade continuam ativos. Este é um circuito de testes com física simplificada, não um sistema de combate com dano.

## Corte de madeira

Escolha o setor **Corte de madeira — machado**. Use seu machado configurado ou **Machado de teste**, que equipa um machado somente na cópia da arena, sem salvar ou sobrescrever o item do editor. Clique em **Jogar** e pressione R (vertical) ou F (lateral). Aproximação e orientação importam: a lâmina precisa atravessar o volume do tronco durante a fase de impacto, não na preparação ou recuperação. Uma entrada já aceita conta no máximo um acerto; apertar repetidamente não interrompe o golpe.

Cada acerto diminui a resistência, abre uma marca na madeira e solta lascas. Após seis acertos o tronco cai e sua colisão em pé é substituída pela do toco. **Reiniciar tronco** restaura madeira, marcas e contador, e retorna ao setor. Os botões também estão disponíveis em tela cheia. Pausar congela o teste. A detecção usa amostras da lâmina real transformadas pelo soquete e suas trajetórias entre quadros contra um volume cilíndrico simplificado; a madeira caída e as lascas são efeitos visuais, não corpos físicos. O desgaste dura somente nessa sessão da arena.

## Controles padrão

- WASD: deslocamento relativo à câmera: W para cima/afastando, S para baixo/aproximando, A para esquerda e D para direita. Sem mira travada, o personagem vira e caminha na direção escolhida. O analógico segue as mesmas direções.
- V (ou botão 10 do joystick): **Travar mira**, mantendo pressionado. Preserva a orientação atual do personagem. Andar no sentido oposto à mira usa **Recuar**, inclusive com ataque lateral. Ao soltar, a rotação livre e caminhada normal retornam imediatamente. O comando é remapeável e salvo com os demais controles. Não seleciona alvos automaticamente.
- Shift + direção: correr; Ctrl + direção: correr+.
- Espaço: salto; durante deslocamento seleciona o salto apropriado.
- C: agachar; C + direção: andar agachado.
- F: ataque lateral; com caminhada/corrida/recuo seleciona a combinação.
- Ataques verticais, laterais e suas combinações são 50% mais rápidos (ciclo de aproximadamente 1,27 s). Pressionar outro ataque durante um golpe não o reinicia nem o interrompe; essas entradas são ignoradas, sem acumular golpes. Pressione novamente após terminar. X continua sendo o cancelamento explícito.
- R: ataque vertical; E: acenar; G: pegar; H: orar; P: pose; X: parar/cancelar ação.
- Joystick padrão: analógico esquerdo para deslocar; botão 0 salto, 1 agachar, 2 lateral, 3 vertical, 4 correr, 5 correr+, 6 pegar, 7 acenar.

Todos os movimentos e quatro direções podem receber uma tecla e um botão. Clique na tecla e pressione a nova tecla; × remove o vínculo. Use o número do botão ou ◎ para capturar a próxima pressão do joystick. As combinações também aceitam vínculos diretos. Os modificadores de velocidade exigem deslocamento. Ações de salto, ataque e gestos terminam seu ciclo mesmo depois de soltar o botão; pressione novamente para repetir.

## Joystick e armazenamento

O navegador precisa reconhecer o dispositivo: conecte e pressione um botão. É possível escolher o índice do controle, os eixos, inversão, zona morta e velocidade. Os índices são os da Gamepad API; a numeração pode variar conforme o controle. A linha de estado mostra o dispositivo e os botões pressionados. Teclado funciona sem joystick.

**Salvar controles em definitivo** grava `abrigo-game-controls-v1` no armazenamento local do navegador. Novos vínculos substituem os anteriores apenas ao salvar. **Padrão** restaura os vínculos na tela; é necessário salvar para torná-los definitivos. Os controles não ficam no JSON do personagem. Apagar os dados do navegador remove esta configuração.

Validação automatizada: `node scripts/test.mjs --game-controls`. Inclui controles simulados, mira travada, persistência, personagens HD, subida da rampa, passagem agachada, bloqueio em pé, salto entre plataformas, aterrissagem e retorno após queda. A validação com hardware real exige um joystick conectado.
