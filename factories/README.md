# factories/ — fábricas Three.js para testar

Coloque aqui arquivos `.ts` ou `.js` que exportem uma função `createXModel()` e abra
**http://localhost:5173/dev/fabricas.html** com `npm run dev` rodando.

Esse é o formato do [img2threejs](https://github.com/img2threejs/img2threejs) (Apache-2.0) e da galeria
[img2threejs-showcase](https://github.com/hoainho/img2threejs-showcase):

```ts
import * as THREE from 'three';
export function createMeuObjetoModel(options = {}): THREE.Group { /* só código, sem arquivos */ }
```

Também é aceito o retorno `{root}`, que é o que a aba **Objetos → Exportar → Código TypeScript** gera.

- **Referência:** uma imagem com o mesmo nome (`machado.ts` + `machado.png`, ou `createMachadoModel.ts` + `machado.jpg`), com o objeto de frente e fundo liso, habilita **Comparar silhueta**.
- **Animação:** se algum objeto tiver `userData.tick(dt, elapsed)`, ele é chamado a cada quadro, como na galeria.
- **Verificações:** o visualizador mostra tamanho, malhas, triângulos, materiais, texturas geradas em código, tempo de construção e se a função usa loaders ou `fetch` (o que viola a regra "só código").

Esta pasta **não entra no build** do editor (`ABRIR_EDITOR.html`) e fica fora do controle de versão. A exceção são este README e os arquivos `exemplo-*`, que são nossos.

## Direitos

O img2threejs-showcase **não tem licença** publicada (checado em 27/09/2026). Sem licença, o código é de uso reservado aos autores. Vários modelos também reproduzem marcas e personagens de terceiros. Coloque aqui só o que você tiver direito de usar:
- modelos que você gerou com o img2threejs a partir das suas próprias fotos;
- exportações da aba Objetos;
- código que você escreveu;
- arquivos com autorização do autor.

Para trazer algum modelo da galeria para o jogo, peça antes uma licença ao autor.
