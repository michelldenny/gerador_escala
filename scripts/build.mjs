import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
await build({entryPoints:[resolve(root,'client/firebase-entry.js')],outfile:resolve(root,'public/firebase.bundle.js'),bundle:true,format:'iife',platform:'browser',target:['es2022'],minify:true,legalComments:'external'});
console.log('Validação da aplicação empacotada em public/firebase.bundle.js; credenciais ficam apenas no servidor.');
