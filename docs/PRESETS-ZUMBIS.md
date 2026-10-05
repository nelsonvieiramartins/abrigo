# Biblioteca de presets de zumbis

A guia **Personagem Zumbi** mantém os IDs internos e chaves de armazenamento antigos (`villains`) para preservar os rascunhos e configurações já existentes.

Na coluna esquerda, dê um nome e clique em **Salvar novo preset**. O preset guarda a receita completa validada: semente, proporções, aparência, roupas, desgaste, origem e configurações de itens/mãos/braços. A biblioteca é independente do rascunho automático.

Clique em um preset para carregá-lo. Após editar, clique em **Atualizar** para substituir explicitamente aquele preset. Para criar outra variação, use outro nome e **Salvar novo preset**. Nomes duplicados são rejeitados; a biblioteca aceita até 100 presets.

O armazenamento persistente é `localStorage`, na chave `abrigo-zombie-presets-v1`, com formato `{version:1,presets:[{id,name,updatedAt,spec}]}`. Está disponível ao jogo via `loadZombiePresets(storage)` e ao editor via `__ABRIGO__.getZombiePresets()`. Não há sincronização com GitHub, contas ou dispositivos. Localhost e o site publicado têm bibliotecas separadas. Limpar os dados do site remove os presets; exporte os personagens em JSON como cópia de segurança.

Bibliotecas inválidas ou falhas de armazenamento não são substituídas silenciosamente. A animação e a expressão temporárias da prévia não fazem parte da receita, seguindo o contrato dos demais personagens.

Testes: `node scripts/test.mjs --zombie` valida recarga, independência dos presets, atualização, validação, falhas de quota e preservação de dados corrompidos.
