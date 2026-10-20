# Configuração: acesso público com alterações por senha

**Se a hospedagem for na Vercel**, siga [VERCEL_SETUP.md](VERCEL_SETUP.md). As instruções de Firebase Hosting abaixo são uma alternativa de hospedagem.

## Definir a senha

Na pasta do projeto, instale as dependências com npm ci e abra **Definir Senha.cmd**. A senha precisa ter de 8 a 256 caracteres. O programa pede confirmação e não exibe o que você digita.

São criados data/editor-password.json e data/editor-password.hash, contendo apenas a derivação scrypt com salt. Esses arquivos ficam fora da pasta pública e não são incluídos no pacote distribuído. Reinicie o servidor após mudar a senha; as sessões anteriores serão encerradas. A senha não precisa ser enviada na conversa.

## Executar localmente com Firestore

1. No console do projeto gerador-de-escala-59952, abra Configurações do projeto → Contas de serviço → Firebase Admin SDK.
2. Gere uma chave privada da conta de serviço e guarde o JSON fora de public/ e fora da pasta do projeto. Não compartilhe essa chave na conversa.
3. Copie .env.example para .env e preencha GOOGLE_APPLICATION_CREDENTIALS com o caminho absoluto desse arquivo. Não coloque o conteúdo da chave em firebase-config.js.
4. Abra Firestore Database → Rules, copie o conteúdo de firestore.rules e publique.
5. Defina a senha e abra Iniciar Escala.cmd. A consulta abre sem login. O botão Liberar edição pede somente a senha.

O banco deve existir no projeto como banco padrão (default). A credencial de servidor precisa de permissão para consultar e gravar os documentos do Firestore. Não é necessário habilitar Firebase Authentication nem criar membros/UID.

Se ainda não houver credencial válida, a aplicação informa que não conseguiu acessar o banco; não usa outro banco automaticamente. Para desenvolvimento local explícito, é possível definir ESCALA_STORAGE=sqlite no .env.

## Publicar no Firebase Hosting com backend

O pacote contém Firebase Hosting e a função HTTP escalaApi. A função usa a identidade de servidor fornecida pela plataforma, com permissão de acesso ao Firestore. Não envie a chave JSON local na publicação. A função usa um segredo contendo o hash da senha.

Depois de definir a senha localmente, o administrador do projeto pode executar com a CLI oficial do Firebase:

```powershell
npm ci
npm run build
firebase login
firebase functions:secrets:set ESCALA_EDITOR_PASSWORD_HASH --data-file data/editor-password.hash --project gerador-de-escala-59952
firebase deploy --only functions,firestore:rules,firestore:indexes,hosting --project gerador-de-escala-59952
```

O comando firebase login é para o administrador publicar o projeto; não cria login para os visitantes da aplicação. Functions pode exigir plano com faturamento habilitado. Esses comandos não foram executados nesta entrega.

A origem pública padrão é https://gerador-de-escala-59952.web.app. Se usar domínio próprio, defina PUBLIC_ORIGIN na configuração do servidor. O acesso de escrita deve usar HTTPS; os cookies de edição são HttpOnly, SameSite Strict e Secure na origem HTTPS.

A função está configurada para uma instância. As sessões ficam em memória: reinícios invalidam a liberação de edição e pedem a senha novamente. Uma implantação com várias instâncias precisará de armazenamento compartilhado para sessões e limites de tentativas.

## Regras e dados

As regras permitem ler somente escalas/penha e seu histórico. Nenhuma gravação pelo SDK do navegador é aceita. A API confere a senha e só então usa o SDK de servidor para gravar. As versões anteriores permanecem disponíveis, e uma restauração cria nova versão.

A consulta é pública: isso inclui as informações dos funcionários que fazem parte do estado compartilhado. A senha restringe alterações, não leitura. Nunca publique regras com gravação pública para tentar simplificar a senha.

## Migrar dados antigos

Para o HTML original, exporte Salvar Configuração e importe o XML após liberar a edição. Para o banco SQLite anterior, execute explicitamente com ESCALA_STORAGE=sqlite, baixe o backup completo em Documentos e backups e depois volte ao modo Firestore para restaurar o JSON após liberar edição. Preserve a pasta data ao atualizar.

## Verificação

Os testes locais verificam leitura pública sem sessão, recusa de gravação e restauração sem senha, senha errada, cookie de edição HttpOnly, revogação, expiração, limite de tentativas e ausência de senha em texto puro, além de cadastro, XML, relatórios e transações do Firestore com adaptador simulado.

Não foram publicadas regras, funções ou dados no projeto real. O acesso remoto depende da configuração e publicação pelo administrador.

Referências oficiais: https://firebase.google.com/docs/firestore/client/libraries e https://firebase.google.com/docs/admin/setup
