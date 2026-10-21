# PostgreSQL na Vercel

A aplicação utiliza PostgreSQL conectado pela Vercel. A opção indicada é **Neon**, no painel Storage/Marketplace. Não precisa mais de conta de serviço Firebase. A consulta continua pública e alterações exigem a senha compartilhada.

## 1. Conectar o banco

1. Abra **gerador-escala-irqp** no painel Vercel.
2. Entre em **Storage → Create Database** (ou **Marketplace**) e escolha **Neon / Postgres**.
3. Escolha a região e um plano adequado ao uso, confira as condições exibidas pelo provedor e crie o banco.
4. Conecte-o ao projeto **gerador-escala-irqp** e habilite **Production**.
5. Em **Settings → Environment Variables**, confirme `DATABASE_URL`. A integração normalmente adiciona essa variável automaticamente. `POSTGRES_URL` também é aceita. Se escolher um prefixo personalizado, copie a conexão para `DATABASE_URL`.

Escolha PostgreSQL, não Blob nem Edge Config. Use a conexão com pooling da integração, mantendo as opções de SSL. A URL contém a senha do banco: não a coloque em arquivos públicos, no GitHub ou na conversa.

As tabelas são criadas automaticamente no primeiro acesso, em transação coordenada entre instâncias. Não é necessário executar SQL manualmente. O usuário da conexão deve poder criar tabelas e consultar/gravar dados nesse banco.

## 2. Senha de edição

Preserve `ESCALA_EDITOR_PASSWORD_HASH` se já estiver correta. Para criar ou corrigir:

1. No computador, abra **Definir Senha.cmd** e escolha uma senha com pelo menos 8 caracteres.
2. Abra **data/editor-password.hash** no Bloco de Notas.
3. Cole a linha inteira em `ESCALA_EDITOR_PASSWORD_HASH`, no ambiente **Production** da Vercel.

São 161 caracteres: 32 antes de `:` e 128 depois. Cole sem aspas, sem `{ }` e sem o nome `passwordHash`. Não use a senha em texto puro nem o conteúdo do arquivo JSON. Se aparecer `EDITOR_PASSWORD_HASH_INVALID`, corrija a variável e faça Redeploy.

Sem hash configurado, a consulta funciona e alterações ficam bloqueadas. Um hash inválido informa o erro específico. Alterar o hash invalida as sessões anteriores.

## 3. Publicar

| Configuração | Valor |
| --- | --- |
| Framework Preset | Other |
| Root Directory | Raiz do repositório, sem subpasta |
| Build Command | npm run build |
| Output Directory | public |
| Install Command | npm ci |
| Node.js | 22.x |

Depois de conectar o banco e salvar as variáveis, abra **Deployments → Redeploy** no commit mais recente. As variáveis só passam a valer nas novas implantações.

`PUBLIC_ORIGIN` é opcional. Se existir, use o domínio público exato, como `https://gerador-escala-irqp.vercel.app`, sem barra final. Remova um valor antigo do Firebase Hosting, que bloquearia as alterações pelo novo domínio.

`FIREBASE_SERVICE_ACCOUNT_JSON` e `GOOGLE_APPLICATION_CREDENTIALS` não são utilizadas por esta versão e podem ser removidas do ambiente Vercel. Isso não altera nem apaga os dados no Firebase.

## 4. Importar XML ou backup

O banco novo começa vazio. A aplicação não copia automaticamente dados do Firebase nem apaga o banco antigo.

1. Abra a aplicação e clique em **Liberar edição**.
2. Digite a senha escolhida no computador.
3. Em **Documentos e backups**, importe seu XML ou backup JSON e confirme.
4. Aguarde a confirmação e recarregue para conferir os dados recuperados do banco.
5. Guarde o arquivo original como cópia de segurança.

Os formatos e as validações foram mantidos. Uma importação válida cria uma versão no histórico. As contas Vercel/Neon são utilizadas somente pelo administrador para configurar a hospedagem; a aplicação não exige login dos visitantes.

## Conferir e resolver erros

- `/`: interface pública.
- `/api/session`: JSON com `canEdit: false` para visitantes; `passwordConfigured: true` após configurar o hash.
- `/api/state`: JSON com `revision: 0` e `state: null` em um banco novo, ou o estado salvo.
- Erro solicitando `DATABASE_URL`: conecte o banco, habilite **Production** e faça Redeploy.
- Erro genérico PostgreSQL: confira a URL completa, a disponibilidade do banco e as permissões do usuário. Os logs registram apenas códigos, nunca a conexão ou senha.
- Erro de origem ao editar: confira `PUBLIC_ORIGIN`.

## Dados e segurança

A conexão fica somente no servidor. As rotas de alteração verificam senha, sessão, origem e revisão. As tabelas são `escala_state`, `escala_versions`, `escala_sessions` e `escala_attempts`. Estado e versão são gravados na mesma transação, com bloqueio da revisão atual para evitar sobrescritas.

Sessões e tentativas são compartilhadas entre instâncias. Sessões duram 8 horas; o limite é de 5 tentativas por endereço em 15 minutos. Somente o hash do token de sessão é armazenado. Entradas expiradas são limpas durante novas liberações e tentativas.

Para prévias, use um banco ou branch separado, conectado somente a **Preview**.

Referências: [Postgres na Vercel](https://vercel.com/docs/postgres), [Neon no Marketplace](https://vercel.com/marketplace/neon), [conexões PostgreSQL](https://node-postgres.com/features/connecting).
