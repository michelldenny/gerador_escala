# Escala: consulta pública e edição por senha

A aplicação abre sem login para consultar a escala e exportar relatórios. Para cadastrar, alterar, trocar plantões, importar XML ou restaurar backups, clique em **Liberar edição** e informe a senha compartilhada.

A senha é validada pelo servidor. Não existe senha embutida no HTML ou JavaScript público. O Firestore aceita leitura pública da escala, mas bloqueia qualquer gravação direta pelo navegador; somente o servidor pode gravar após autorizar a sessão de edição.

## Configurar

**Vai usar a Vercel?** Siga [VERCEL_SETUP.md](VERCEL_SETUP.md). A versão inclui função de API própria, credenciais por variáveis de ambiente e sessões compartilhadas entre instâncias.

1. Execute **npm ci** nesta pasta para instalar as dependências do servidor.
2. Abra **Definir Senha.cmd** e escolha sua senha. Ela será armazenada somente como hash com salt em data/editor-password.json. Nenhuma senha foi escolhida automaticamente.
3. Configure a credencial de servidor do Firebase conforme **FIREBASE_SETUP.md**. A configuração web fornecida anteriormente identifica o projeto, mas não substitui essa credencial de servidor.
4. Publique o arquivo **firestore.rules** atualizado: leitura da escala liberada, gravação direta bloqueada.
5. Abra **Iniciar Escala.cmd**. O endereço local é http://127.0.0.1:3210. Não abra public/index.html diretamente.

Quem apenas consulta não precisa de conta, e-mail ou senha. A senha só é solicitada ao clicar em Liberar edição. Use Bloquear edição ao terminar. A sessão dura até 8 horas, ou até o servidor reiniciar, e existe um limite de tentativas de senha.

Como a consulta é pública, os dados apresentados, incluindo os dados de funcionários e os relatórios, ficam disponíveis a quem acessar a aplicação. O bloqueio por senha protege alterações, não a leitura.

## Firebase

Projeto: gerador-de-escala-59952. Estado: escalas/penha. Histórico: escalas/penha/versoes. As gravações usam transações com revisão para impedir que uma aba sobrescreva alterações de outra.

O servidor usa o Firebase Admin SDK com credenciais que ficam fora de public/. Ele continua exigindo a senha em todas as rotas de alteração, mesmo que alguém tente chamar a API manualmente. A chave web do Firebase e o token público da aplicação não liberam edição. Na Vercel, sessões e tentativas são compartilhadas no Firestore; no servidor local, ficam em memória.

O backend antigo SQLite foi preservado para recuperação e desenvolvimento explícito. Ele só é usado se ESCALA_STORAGE=sqlite for definido no ambiente; não existe troca silenciosa de Firestore para SQLite quando o acesso ao banco falha.

## Funcionalidades

Calendário, regras de rodízio anual, funcionários, vigências, férias, feriados, trocas manuais, plantões de fim de ano, PDF, Word, XML, backup JSON e versões foram mantidos. A importação XML é validada antes de salvar, preserva outros anos e exige a sessão de edição.

## Desenvolvimento

npm ci
npm run build
npm run check
npm test

O frontend usa public/storage.js para acessar o servidor. public/editor.js controla a experiência de consulta e edição. src/editor-access.js confere a senha e gerencia sessões. src/firestore-store.js grava no Firestore. src/server.js protege todas as rotas de alteração.

A hospedagem no Firebase inclui uma função de servidor, não apenas os arquivos estáticos. Consulte FIREBASE_SETUP.md. Nada foi publicado no projeto remoto nesta entrega.
