# Publicar na Vercel

O projeto agora inclui `vercel.json` e `api/index.js`. A página é servida como arquivos estáticos da pasta `public`, e as rotas `/api/*` são atendidas por uma função Node.js 22. Não é necessário executar `npm start` na Vercel nem publicar Firebase Functions para usar essa hospedagem.

## Ajustes no projeto Vercel

Em **Settings → Build and Deployment**, confira:

| Configuração | Valor |
| --- | --- |
| Framework Preset | Other |
| Root Directory | Raiz do repositório, sem subpasta |
| Build Command | npm run build |
| Output Directory | public |
| Install Command | npm ci |
| Node.js | 22.x |

O arquivo `vercel.json` já declara o build, a pasta pública e o encaminhamento da API. As versões anteriores do projeto tinham configuração somente para Firebase Hosting.

## Variáveis de ambiente obrigatórias

Em **Settings → Environment Variables**, adicione em **Production** (e também em **Preview**, se for usar as prévias):

### FIREBASE_SERVICE_ACCOUNT_JSON

Cole o **conteúdo completo do JSON da conta de serviço** do projeto `gerador-de-escala-59952`.

No console Firebase: Configurações do projeto → Contas de serviço → Firebase Admin SDK → Gerar nova chave privada. Guarde a chave de forma privada. A aplicação valida o projeto e os campos `project_id`, `client_email` e `private_key` antes de usar a credencial.

Essa variável é de servidor. Não use prefixos `NEXT_PUBLIC_` ou `VITE_`, não a coloque na pasta public e não envie a chave ao GitHub ou nesta conversa. A configuração web com apiKey, projectId e appId não substitui essa conta de serviço.

### ESCALA_EDITOR_PASSWORD_HASH

1. No computador, abra **Definir Senha.cmd** e escolha a senha compartilhada.
2. Abra o arquivo **data/editor-password.hash**, gerado por esse programa.
3. Copie a linha inteira `salt:hash` para o valor desta variável na Vercel.

Use o hash, não o conteúdo do arquivo JSON e não a senha em texto puro. A senha continua sendo digitada somente por quem deseja liberar a edição. Alterar o hash e fazer novo deploy invalida as sessões anteriores.

Se aparecer `EDITOR_PASSWORD_HASH_INVALID`, a variável da senha foi preenchida em formato inválido. O valor correto tem 161 caracteres: 32 antes dos dois-pontos e 128 depois. Copie somente a linha do arquivo `.hash`, sem aspas, sem `{ }` e sem o nome `passwordHash`. Salve a variável e faça Redeploy. Esse erro ocorre antes da conexão com o Firebase; ele não indica, por si só, que a credencial do banco está errada.

### PUBLIC_ORIGIN (opcional)

Na Vercel, a origem HTTPS é detectada a partir do domínio atendido pela plataforma, incluindo domínios de prévia. Se definir essa variável, use exatamente o endereço público permitido, por exemplo `https://gerador-escala-irqp.vercel.app`, sem barra final. Uma origem antiga do Firebase Hosting impedirá as gravações por outro domínio.

## Fazer novo deploy

Depois de salvar as variáveis, abra **Deployments → Redeploy** no commit mais recente. As variáveis só passam a valer nas novas implantações.

Para verificar:

- `/`: deve exibir a aplicação sem login.
- `/api/session`: deve retornar JSON; `canEdit` será false para visitantes. `passwordConfigured` deve ser true após configurar o hash.
- `/api/state`: deve retornar JSON com a escala, ou estado vazio se ainda não houver dados.
- **Liberar edição**: aceita a senha e permite alterar dados; **Bloquear edição** revoga a liberação.

Se a página abre mas o banco informa erro 503, revise a conta de serviço, as permissões do Firestore e a existência do banco padrão `(default)`. Isso é diferente do erro `FUNCTION_INVOCATION_FAILED`, que indica que a função não iniciou ou falhou antes de responder.

## Funcionamento das sessões

A Vercel pode atender requisições por instâncias diferentes. Por isso, as sessões e os limites de tentativas ficam compartilhados no Firestore, em `_escala_sessions` e `_escala_attempts`, sem acesso público pelas regras fornecidas. O token da sessão é aleatório e somente seu hash é armazenado; a senha nunca é enviada ao navegador pelo servidor.

As sessões expiram após 8 horas. O bloqueio é respeitado por todas as instâncias. Para limpeza automática dos documentos expirados, o administrador pode habilitar TTL no campo `expiresAt` dessas duas coleções; a validação de expiração funciona mesmo sem TTL.

O Firestore continua sem aceitar gravações diretas do navegador. A função verifica senha, sessão, origem e revisão antes de alterar a escala.

Referências: [funções Node.js na Vercel](https://vercel.com/docs/functions/runtimes/node-js), [configuração do projeto](https://vercel.com/docs/project-configuration/vercel-json), [variáveis de ambiente](https://vercel.com/docs/environment-variables).
