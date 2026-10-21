import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { openPostgresStore } from '../src/postgres-store.js';
import { editorAccess, hashPassword } from '../src/editor-access.js';

const fixture=()=>({funcionarios:[{nome:'Ana',registro:'001',telefone:'',dataInicio:'2026-01-01',dataFim:''}],anoAtual:2026,mesAtualIndex:9,ferias:{},feriados:{},trocasManuais:{},escalaFimAno:{},feriasPorAno:{},feriadosPorAno:{},trocasPorAno:{},fimAnoPorAno:{},ciclosPorAno:{},ciclos:{diaSemana:0,fimSemana:0,feriado:0}});

// Actual PostgreSQL in WASM; a single connection is queued like a pg.Pool with max:1.
async function testPool(t){
  const db=new PGlite();await db.waitReady;t.after(()=>db.close());
  let tail=Promise.resolve();
  const pool={
    failUpdate:false,
    async connect(){
      const previous=tail;let release;tail=new Promise(resolve=>release=resolve);await previous;
      return {release,query:async(text,values)=>{
        if(pool.failUpdate && text.startsWith('UPDATE escala_state'))throw new Error('simulated interrupted write');
        if(text.includes('CREATE TABLE'))return db.exec(text);
        return db.query(text,values);
      }};
    },
    async query(text,values){const client=await pool.connect();try{return await client.query(text,values);}finally{client.release();}},
    async end(){}
  };
  return pool;
}

test('PostgreSQL preserva estado, versões, restauração e rejeita revisão antiga entre instâncias',async t=>{
  const pool=await testPool(t),first=openPostgresStore({pool}),second=openPostgresStore({pool});
  assert.deepEqual(await first.read(),{revision:0,updatedAt:null,state:null});
  const state=fixture();await first.save(state,0,'Importação de arquivo');
  assert.deepEqual((await second.read()).state,state);
  const results=await Promise.allSettled([first.save({...state,anoAtual:2027},1),second.save({...state,anoAtual:2028},1)]);
  assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
  assert.equal(results.find(result=>result.status==='rejected').reason.status,409);
  assert.equal((await first.history()).length,2);
  await second.restore(1,2);assert.deepEqual((await first.read()).state,state);
  assert.equal((await first.read()).revision,3);
  assert.equal((await first.history())[0].reason,'Restauração da versão 1');
  await assert.rejects(first.restore(999,3),error=>error.status===404);
  await assert.rejects(first.save({...state,anoAtual:-1},3));
  assert.equal((await first.history()).length,3);
});

test('falha entre a versão e o estado executa rollback completo no PostgreSQL',async t=>{
  const pool=await testPool(t),store=openPostgresStore({pool});
  await store.save(fixture(),0);
  pool.failUpdate=true;await assert.rejects(store.save({...fixture(),anoAtual:2027},1));pool.failUpdate=false;
  assert.equal((await store.read()).revision,1);assert.equal((await store.history()).length,1);
  assert.equal((await store.read()).state.anoAtual,2026);
  await store.save(fixture(),1);assert.equal((await store.read()).revision,2);
});

test('sessão, revogação, expiração e tentativas são compartilhadas no PostgreSQL',async t=>{
  const pool=await testPool(t),first=openPostgresStore({pool}),second=openPostgresStore({pool});
  let time=Date.now();const passwordHash=await hashPassword('senha-de-teste-123');
  const access1=editorAccess({passwordHash,persistence:first,now:()=>time});
  const access2=editorAccess({passwordHash,persistence:second,now:()=>time});
  const token=await access1.unlock('senha-de-teste-123','visitor');const request={headers:{cookie:`escala_editor=${token}`}};
  assert.equal(await access2.canEdit(request),true);
  const changed=editorAccess({passwordHash:await hashPassword('outra-senha-456'),persistence:second,now:()=>time});
  assert.equal(await changed.canEdit(request),false);
  await access2.revoke(request);assert.equal(await access1.canEdit(request),false);
  const expiring=await access2.unlock('senha-de-teste-123','visitor');time+=8*60*60_000+1;
  assert.equal(await access1.canEdit({headers:{cookie:`escala_editor=${expiring}`}}),false);
  const attempts=await Promise.allSettled(Array.from({length:9},(_,index)=>(index%2?first:second).attemptTake('same-ip',time)));
  assert.equal(attempts.filter(result=>result.status==='fulfilled').length,5);
  assert.ok(attempts.filter(result=>result.status==='rejected').every(result=>result.reason.status===429));
  await second.attemptTake('same-ip',time+15*60_000);
  await first.attemptClear('same-ip');await second.attemptTake('same-ip',time+15*60_000);
});

test('configuração corrigida permite tentar novamente sem reiniciar a instância',async t=>{
  const environment={};const store=openPostgresStore({environment});
  await assert.rejects(store.read(),error=>error.status===503 && /DATABASE_URL/.test(error.message));
  // The failed initialization is not cached forever.
  environment.DATABASE_URL='valor-invalido';
  await assert.rejects(store.read(),error=>error.status===503 && /inválida/.test(error.message));
  await store.close();
});
