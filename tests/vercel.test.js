import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { createVercelHandler } from '../api/index.js';
import { hashPassword } from '../src/editor-access.js';
import { readDatabaseUrl } from '../src/postgres-store.js';

test('Vercel atende rewrites e JSON já processado; duas instâncias compartilham senha, sessão e revogação',async t=>{
  const sessions=new Map(),attempts=new Map();let revision=0, writes=0;
  const store={
    read:async()=>({revision,state:null}),history:async()=>[],close(){},
    save:async()=>{writes++;return {revision:++revision,updatedAt:new Date().toISOString()};},
    sessionGet:async id=>sessions.get(id),sessionPut:async(id,data)=>sessions.set(id,data),sessionDelete:async id=>sessions.delete(id),
    attemptClear:async id=>attempts.delete(id),attemptTake:async id=>{const count=attempts.get(id)||0;if(count>=5)throw Object.assign(new Error('Muitas tentativas'),{status:429});attempts.set(id,count+1);}
  };
  const passwordHash=await hashPassword('senha-local-de-teste');
  async function start(){
    const handler=createVercelHandler({store,passwordHash});
    const server=http.createServer(async(req,res)=>{
      if(req.method==='POST'||req.method==='PUT'){const chunks=[];for await(const chunk of req)chunks.push(chunk);req.body=JSON.parse(Buffer.concat(chunks).toString());}
      handler(req,res);
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));return `http://127.0.0.1:${server.address().port}`;
  }
  const first=await start(),second=await start();
  async function api(base,route,{method='GET',body,cookie='',token='',origin}={}){
    const response=await fetch(`${base}/api/index?route=${route}`,{method,body:body?JSON.stringify(body):undefined,headers:{'Content-Type':'application/json','X-App-Token':token,Cookie:cookie,...(origin?{Origin:origin}:{})}});
    return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')};
  }
  const session=(await api(first,'session')).body;assert.equal(session.canEdit,false);assert.equal((await api(second,'session')).body.token,session.token);
  assert.equal((await api(first,'state')).status,200);assert.equal((await api(first,'state',{method:'PUT',body:{revision:0,state:{}},token:session.token})).status,403);
  const unlocked=await api(first,'editor/unlock',{method:'POST',body:{password:'senha-local-de-teste'},token:session.token});assert.equal(unlocked.status,200);assert.match(unlocked.cookie,/Secure/);
  const cookie=unlocked.cookie.split(';')[0];assert.equal((await api(second,'session',{cookie})).body.canEdit,true);
  assert.equal((await api(second,'state',{method:'PUT',body:{revision:0,state:{}},cookie,token:session.token,origin:'https://untrusted.example'})).status,403);
  assert.equal((await api(second,'state',{method:'PUT',body:{revision:0,state:{}},cookie,token:session.token})).status,200);assert.equal(writes,1);
  assert.equal((await api(second,'editor/lock',{method:'POST',body:{},cookie,token:session.token})).status,200);assert.equal((await api(first,'session',{cookie})).body.canEdit,false);
  assert.equal((await api(first,'state',{method:'PUT',body:{revision:1,state:{}},cookie,token:session.token})).status,403);
  assert.equal((await api(first,'../src/server.js')).status,404);
});

test('conexão PostgreSQL reconhece variáveis da Vercel e nunca expõe o valor nos erros',()=>{
  assert.throws(()=>readDatabaseUrl({}),error=>error.status===503 && /DATABASE_URL/.test(error.message));
  assert.throws(()=>readDatabaseUrl({DATABASE_URL:'conteudo-privado-invalido'}),error=>error.status===503&&!error.message.includes('conteudo-privado'));
  assert.throws(()=>readDatabaseUrl({DATABASE_URL:'https://private.example/db'}),error=>error.status===503&&!error.message.includes('private.example'));
  const value='postgresql://fixture:secret@localhost/test';
  assert.equal(readDatabaseUrl({DATABASE_URL:` ${value}\n`}),value);
  assert.equal(readDatabaseUrl({POSTGRES_URL:value}),value);
  assert.equal(readDatabaseUrl({DATABASE_URL:value,POSTGRES_URL:'ignored'}),value);
});

test('configuração Vercel serve public e encaminha a API para uma função Node',()=>{
  const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
  assert.equal(config.framework,null);assert.equal(config.outputDirectory,'public');assert.equal(config.rewrites[0].source,'/api/:path*');assert.match(config.rewrites[0].destination,/route=/);
});

test('hash inválido informa a variável correta e mantém gravações bloqueadas sem expor valores',async t=>{
  let writes=0;
  const handler=createVercelHandler({store:{save:async()=>writes++},passwordHash:'senha-privada-de-exemplo'});
  const server=http.createServer(handler);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  for(const [path,method] of [['session','GET'],['state','PUT']]){
    const response=await fetch(`http://127.0.0.1:${server.address().port}/api/${path}`,{method});
    assert.equal(response.status,503);
    const body=await response.json();
    assert.equal(body.code,'EDITOR_PASSWORD_HASH_INVALID');
    assert.match(body.error,/ESCALA_EDITOR_PASSWORD_HASH/);
    assert.match(body.error,/editor-password\.hash/);
    assert.ok(!body.error.includes('senha-privada-de-exemplo'));
  }
  assert.equal(writes,0);
});
