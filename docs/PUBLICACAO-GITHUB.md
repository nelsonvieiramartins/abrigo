# Publicação do ABRIGO

Site: https://nelsonvieiramartins.github.io/abrigo/

O workflow `.github/workflows/pages.yml` instala as dependências, executa os testes, compila e publica somente `dist/` no GitHub Pages. `dist/index.html` é independente: JavaScript, CSS e Three.js são incorporados no HTML. Não depende de localhost nem de um servidor Node em produção.

Para atualizar, envie as alterações para a branch `main`. Acompanhe o workflow **Publicar ABRIGO** em Actions. O ambiente `github-pages` mostra o endereço publicado.

O editor usa armazenamento local do navegador. Os dados de localhost não são transferidos automaticamente para o site, e não há sincronização entre dispositivos. Exporte os JSONs no editor local e importe no site para transferir receitas/configurações suportadas.

O site é público. Não envie segredos nem informações privadas ao repositório. GitHub Pages não fornece banco de dados, autenticação de usuários ou servidor multiplayer.
