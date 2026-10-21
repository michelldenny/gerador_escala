# Escala: consulta pública e edição por senha

Gestão de plantões com **PostgreSQL conectado à Vercel**, histórico e edição por senha. A consulta e os relatórios abrem sem login. Cadastro, alterações, trocas, importação XML e restauração de backups exigem **Liberar edição** e a senha compartilhada.

## Publicar

Siga [VERCEL_SETUP.md](VERCEL_SETUP.md): conecte Neon PostgreSQL pelo painel Vercel, confirme `DATABASE_URL`, configure `ESCALA_EDITOR_PASSWORD_HASH` e faça Redeploy. As tabelas são criadas no primeiro acesso. Esta versão não utiliza credenciais Firebase.

O banco novo começa vazio. Libere a edição e importe seu XML ou backup JSON em **Documentos e backups**. O Firebase antigo não é alterado nem apagado.

## Usar no computador

1. Instale Node.js 22 e execute `npm ci` nesta pasta.
2. Copie `.env.example` para `.env` e preencha `DATABASE_URL` com seu banco de desenvolvimento. Mantenha essa conexão privada.
3. Abra **Definir Senha.cmd**. A senha fica somente como hash com salt em `data/editor-password.json` e `data/editor-password.hash`.
4. Execute `npm run build` e abra **Iniciar Escala.cmd**. Acesse `http://127.0.0.1:3210`, sem abrir o HTML diretamente.

SQLite permanece disponível somente para desenvolvimento/recuperação local com `ESCALA_STORAGE=sqlite`. Na Vercel usa-se PostgreSQL, nunca um arquivo local. Não existe troca silenciosa de banco após falhas.

## Funcionalidades e segurança

Calendário, rodízio anual, funcionários, vigências, férias, feriados, trocas, fim de ano, PDF, Word, XML, backup JSON e versões foram preservados. Importações são validadas antes de gravar. Revisões antigas são rejeitadas para impedir sobrescritas.

O calendário pinta o dia inteiro: azul (segunda a sexta), verde (fim de semana), vermelho (feriado) e roxo (fim de ano/outros). O nome permanece preto. No editor do dia, é possível escolher uma dessas cores ou voltar ao modo automático; a escolha é salva no banco e acompanha os backups JSON e XML, sem alterar o rodízio. O período de fim de ano vai da segunda-feira imediatamente anterior ao Natal até o primeiro domingo de janeiro, inclusive, e tem prioridade sobre os outros ciclos. Os responsáveis desse período continuam sendo definidos no calendário. A barra lateral recolhe pelo botão de menu e guarda a preferência no navegador.

A senha é verificada no servidor. Todas as alterações exigem sessão autorizada, origem válida e token da aplicação. Conhecer o token público não libera edição. As sessões duram 8 horas; **Bloquear edição** revoga a sessão. Alterar o hash invalida sessões anteriores.

A conexão PostgreSQL não é enviada ao navegador. Sessões e limites de tentativas são compartilhados entre instâncias. Apenas o hash do token de sessão e um identificador derivado do endereço de rede são armazenados. SQLite local utiliza sessões em memória.

Os dados exibidos e exportados, incluindo os de funcionários, são públicos para quem acessa a aplicação, conforme o modo de consulta solicitado.

## Desenvolvimento

```text
npm ci
npm run build
npm run check
npm test
```

`public/storage.js` acessa a API; `public/editor.js` controla consulta e edição; `src/editor-access.js` verifica a senha; `src/postgres-store.js` persiste dados e segurança; `src/server.js` protege as rotas; `api/index.js` adapta a API à Vercel.

Os testes usam PostgreSQL local em WASM (PGlite), sem credenciais reais, para conferir transações, rollback, concorrência, restauração e segurança compartilhada. Também cobrem a API, acesso público, XML, PDF, Word e o rodízio original. A conexão real precisa ser validada após criar e conectar o banco ao projeto.
