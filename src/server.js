import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { editorAccess } from './editor-access.js';
import { openFirestoreStore } from './firestore-store.js';
import { openStore, InputError } from './database.js';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mime = { '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8' };
export function createApplication({ database = resolve(root,'data/escala.sqlite'),store:providedStore,passwordHash,publicOrigin,now } = {}) {
  const store = providedStore || openStore(database);
  const access=editorAccess({passwordHash,now});
  const token = randomBytes(32).toString('hex');
  const server = http.createServer(async (req,res) => {
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','same-origin');
    res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Cache-Control','no-store');
    const json = (status,data) => { res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'}); res.end(JSON.stringify(data)); };
    try {
      const host = req.headers.host;
      if (!host || (!publicOrigin && !/^(127\.0\.0\.1|localhost):\d+$/.test(host))) throw new InputError('Host não autorizado.',403);
      if (req.headers.origin && req.headers.origin !== (publicOrigin || `http://${host}`)) throw new InputError('Origem não autorizada.',403);
      const path = new URL(req.url,`http://${host}`).pathname;
      if (path.startsWith('/api/')) {
        if (req.method === 'GET') {
          if (path === '/api/session') return json(200,{ token,canEdit:access.canEdit(req),passwordConfigured:access.configured });
          if (path === '/api/state') return json(200,await store.read());
          if (path === '/api/history') return json(200,{ versions:await store.history() });
          if (path === '/api/backup') { res.setHeader('Content-Disposition','attachment; filename="escala-backup.json"'); return json(200,{ format:'escala-backup',schemaVersion:1,exportedAt:new Date().toISOString(),...await store.read() }); }
        }
        if (req.method === 'PUT' || req.method === 'POST') {
          if(req.headers['x-app-token'] !== token) throw new InputError('Sessão inválida. Recarregue a página.',403);
          if(!['/api/editor/unlock','/api/editor/lock'].includes(path) && !access.canEdit(req)) throw new InputError('Informe a senha para liberar alterações.',403);
          if (!req.headers['content-type']?.startsWith('application/json')) throw new InputError('Envie dados JSON.',415);
          let size=0, chunks=[];
          if(Buffer.isBuffer(req.rawBody)){if(req.rawBody.length>5_000_000)throw new InputError('Arquivo maior que 5 MB.',413);chunks=[req.rawBody];}
          else for await (const chunk of req) { size+=chunk.length; if(size>5_000_000) throw new InputError('Arquivo maior que 5 MB.',413); chunks.push(chunk); }
          let body; try { body=JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new InputError('JSON inválido.'); }
          if(!body || typeof body!=='object' || Array.isArray(body))throw new InputError('Corpo JSON inválido.');
          const cookieSuffix=`; Path=/; HttpOnly; SameSite=Strict${publicOrigin?.startsWith('https:') ? '; Secure' : ''}`;
          if(path==='/api/editor/unlock' && req.method==='POST') {const session=await access.unlock(body.password,req.socket?.remoteAddress || 'unknown');res.setHeader('Set-Cookie',`escala_editor=${session}; Max-Age=28800${cookieSuffix}`);return json(200,{canEdit:true});}
          if(path==='/api/editor/lock' && req.method==='POST') {access.revoke(req);res.setHeader('Set-Cookie',`escala_editor=; Max-Age=0${cookieSuffix}`);return json(200,{canEdit:false});}
          if (!Number.isInteger(body.revision) || body.revision<0) throw new InputError('Revisão inválida.');
          if(path === '/api/state' && req.method === 'PUT') return json(200,await store.save(body.state,body.revision,body.reason==='Importação de arquivo' ? body.reason : 'Salvamento automático'));
          if(path === '/api/restore' && req.method === 'POST') { if(!Number.isInteger(body.id)) throw new InputError('Versão inválida.'); return json(200,await store.restore(body.id,body.revision)); }
        }
        return json(404,{error:'Operação não encontrada.'});
      }
      if(req.method !== 'GET' && req.method !== 'HEAD') throw new InputError('Método não permitido.',405);
      const name = path === '/' ? 'index.html' : decodeURIComponent(path).slice(1);
      const publicRoot=resolve(root,'public');
      const file=resolve(publicRoot,name);
      if(!file.startsWith(publicRoot + '/') && !file.startsWith(publicRoot + '\\')) throw new InputError('Acesso não permitido.',403);
      let data; try { data=await readFile(file); } catch { throw new InputError('Arquivo não encontrado.',404); }
      res.writeHead(200,{'Content-Type':mime[extname(file)] || 'application/octet-stream'}); res.end(req.method === 'HEAD' ? undefined : data);
    } catch(error) { if(error.status) json(error.status,{error:error.message}); else { console.error('Falha no banco:',error.code || error.name); json(503,{error:'Não foi possível acessar o banco. Verifique a conexão e a configuração da credencial de servidor do Firestore. Os dados anteriores foram preservados.'}); } }
  });
  server.on('close',() => store.close());
  return server;
}
export function createConfiguredApplication(options={}) {
  if(existsSync(resolve(root,'.env'))) loadEnvFile(resolve(root,'.env'));
  const passwordFile=resolve(root,'data/editor-password.json');
  const passwordHash=process.env.ESCALA_EDITOR_PASSWORD_HASH || (existsSync(passwordFile) ? JSON.parse(readFileSync(passwordFile,'utf8')).passwordHash : undefined);
  return createApplication({store:process.env.ESCALA_STORAGE==='sqlite' ? undefined : openFirestoreStore(),passwordHash,publicOrigin:process.env.PUBLIC_ORIGIN || undefined,...options});
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port=Number(process.env.PORT || 3210);
  const server=createConfiguredApplication({ database:process.env.ESCALA_DB || undefined });
  server.listen(port,'127.0.0.1',() => console.log(`Escala disponível em http://127.0.0.1:${port}`));
  for(const signal of ['SIGINT','SIGTERM']) process.on(signal,() => server.close(() => process.exit(0)));
}
