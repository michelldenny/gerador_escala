import { createApplication } from '../src/server.js';
import { openFirestoreStore } from '../src/firestore-store.js';

export function createVercelHandler({store:providedStore,passwordHash:providedHash,publicOrigin,clientAddress}={}) {
  let server;
  return function handler(req,res) {
    try {
      const url=new URL(req.url,'https://vercel.local');
      const route=url.searchParams.get('route');
      if((url.pathname==='/api/index' || url.pathname==='/api') && route!==null){
        if(!/^[a-z]+(?:\/[a-z]+)*$/.test(route)){res.statusCode=404;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:'Operação não encontrada.'}));return;}
        req.url=`/api/${route}`;
      }
      if(!server){
        const store=providedStore || openFirestoreStore();
        const passwordHash=(providedHash ?? process.env.ESCALA_EDITOR_PASSWORD_HASH)?.trim();
        server=createApplication({store,passwordHash,securityStore:store,hosted:true,publicOrigin:publicOrigin || process.env.PUBLIC_ORIGIN || undefined,clientAddress:clientAddress || (request=>String(request.headers['x-forwarded-for'] || request.socket?.remoteAddress || 'unknown').split(',')[0].trim())});
      }
      return new Promise(resolve=>{res.once('finish',resolve);res.once('close',resolve);server.emit('request',req,res);});
    } catch {
      res.statusCode=503;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify({error:'Confira as variáveis de servidor da Vercel: FIREBASE_SERVICE_ACCOUNT_JSON e ESCALA_EDITOR_PASSWORD_HASH. Depois faça um novo deploy.'}));
    }
  };
}
export default createVercelHandler();
