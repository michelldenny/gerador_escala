import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApplication } from '../src/server.js';
import { openStore } from '../src/database.js';
import { hashPassword } from '../src/editor-access.js';

function fixture() { return { funcionarios:[{nome:'Ana Teste',registro:'001',telefone:'',dataInicio:'2026-01-01',dataFim:''}],ferias:{'001':[{inicio:'2026-10-05',fim:'2026-10-10'}]},feriados:{'2026-10-12':'Feriado de teste'},trocasManuais:{},escalaFimAno:{},feriasPorAno:{},feriadosPorAno:{},trocasPorAno:{},fimAnoPorAno:{},ciclosPorAno:{},anoAtual:2026,mesAtualIndex:9,ciclos:{diaSemana:0,fimSemana:0,feriado:0} }; }
test('persistência, validação atômica, concorrência, backup e restauração pela API',async t => {
  const directory=mkdtempSync(join(tmpdir(),'escala-test-')); const database=join(directory,'test.sqlite');
  const server=createApplication({store:openStore(database),passwordHash:await hashPassword('teste-local-1234')}); await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); rmSync(directory,{recursive:true,force:true}); });
  const base=`http://127.0.0.1:${server.address().port}`;
  const {token}=await (await fetch(base+'/api/session')).json();
  let cookie='';
  const api=async (path,method,body,extra={}) => { const response=await fetch(base+path,{method,body:body?JSON.stringify(body):undefined,headers:{'Content-Type':'application/json','X-App-Token':token,Cookie:cookie,...extra}}); return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')}; };
  assert.equal((await api('/api/state','GET')).body.revision,0);
  const state=fixture();
  assert.equal((await api('/api/state','PUT',{state,revision:0})).status,403,'Leitor não pode gravar mesmo conhecendo o token público');
  assert.equal((await api('/api/restore','POST',{id:1,revision:0})).status,403);
  assert.equal((await api('/api/editor/unlock','POST',{password:'errada'})).status,401);
  const unlocked=await api('/api/editor/unlock','POST',{password:'teste-local-1234'});assert.equal(unlocked.status,200);assert.match(unlocked.cookie,/HttpOnly/);cookie=unlocked.cookie.split(';')[0];
  assert.equal((await api('/api/state','PUT',{state,revision:0},{'X-App-Token':'invalid'})).status,403);
  assert.equal((await api('/api/state','PUT',{state,revision:0},{Origin:'https://untrusted.example'})).status,403);
  const saved=await api('/api/state','PUT',{state,revision:0}); assert.equal(saved.status,200); const revision=saved.body.revision;
  assert.equal((await api('/api/state','PUT',{state,revision:0})).status,409);
  const invalid=fixture(); invalid.funcionarios.push({...invalid.funcionarios[0]}); assert.equal((await api('/api/state','PUT',{state:invalid,revision})).status,400);
  const overlap=fixture(); overlap.ferias['001'].push({inicio:'2026-10-09',fim:'2026-10-15'}); assert.equal((await api('/api/state','PUT',{state:overlap,revision})).status,400);
  const badDate=fixture(); badDate.funcionarios[0].dataInicio='2026-02-30'; assert.equal((await api('/api/state','PUT',{state:badDate,revision})).status,400);
  const badMap=fixture(); badMap.trocasPorAno['2026']={'invalid':{registro:'001'}}; assert.equal((await api('/api/state','PUT',{state:badMap,revision})).status,400);
  assert.deepEqual((await api('/api/state','GET')).body.state,state);
  const backup=(await api('/api/backup','GET')).body; assert.equal(backup.format,'escala-backup'); assert.deepEqual(backup.state,state);
  const changed=fixture(); changed.funcionarios[0].nome='Nome alterado'; const second=await api('/api/state','PUT',{state:changed,revision}); assert.equal(second.status,200);
  const restored=await api('/api/restore','POST',{id:revision,revision:second.body.revision}); assert.equal(restored.status,200);
  assert.deepEqual((await api('/api/state','GET')).body.state,state); assert.equal((await api('/api/history','GET')).body.versions.length,3);
  const home=await fetch(base+'/'); assert.equal(home.status,200); assert.match(await home.text(),/Gestão de plantões/);
  for(const asset of ['/styles.css','/app.js','/storage.js','/interface.js','/vendor/tailwind.min.css','/vendor/jspdf.umd.min.js','/vendor/jspdf.plugin.autotable.min.js','/vendor/fontawesome/css/all.min.css','/vendor/fontawesome/webfonts/fa-solid-900.woff2']) assert.equal((await fetch(base+asset)).status,200,asset);
  const reopened=openStore(database); assert.deepEqual(reopened.read().state,state); reopened.close();
  assert.equal((await api('/api/editor/lock','POST',{})).status,200);
  assert.equal((await api('/api/state','PUT',{state,revision:restored.body.revision})).status,403,'Sessão revogada não pode editar');
});
test('arquivo de banco mantém o estado após fechar e reabrir',() => {
  const directory=mkdtempSync(join(tmpdir(),'escala-restart-')); const path=join(directory,'state.sqlite');
  try { const first=openStore(path); const saved=first.save(fixture(),0); first.close(); const second=openStore(path); assert.equal(second.read().revision,saved.revision); assert.deepEqual(second.read().state,fixture()); second.close(); } finally { rmSync(directory,{recursive:true,force:true}); }
});
