import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
await build({entryPoints:[resolve(root,'client/validation-entry.js')],outfile:resolve(root,'public/validation.bundle.js'),bundle:true,format:'iife',platform:'browser',target:['es2022'],minify:true,legalComments:'external'});
console.log('Validação da aplicação empacotada; conexão PostgreSQL disponível somente no servidor.');
