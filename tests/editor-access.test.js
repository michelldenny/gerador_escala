import test from 'node:test';
import assert from 'node:assert/strict';
import { editorAccess,hashPassword } from '../src/editor-access.js';
test('senha é derivada com salt; tentativas são limitadas; sessão expira',async()=>{
  const password='apenas-teste-local-123';const hash=await hashPassword(password);assert.ok(!hash.includes(password));assert.notEqual(hash,await hashPassword(password));
  let clock=0;const access=editorAccess({passwordHash:hash,now:()=>clock});
  for(let i=0;i<5;i++)await assert.rejects(access.unlock('errada','ip1'),e=>e.status===401);
  await assert.rejects(access.unlock(password,'ip1'),e=>e.status===429);
  const token=await access.unlock(password,'ip2');const req={headers:{cookie:`escala_editor=${token}`}};assert.equal(access.canEdit(req),true);assert.equal(access.canEdit({headers:{}}),false);
  clock=8*60*60_000;assert.equal(access.canEdit(req),false);
  await access.unlock(password,'ip1');
});
test('sem senha configurada, edição permanece bloqueada',async()=>{const access=editorAccess();assert.equal(access.configured,false);await assert.rejects(access.unlock('qualquer','ip'),e=>e.status===503);});
