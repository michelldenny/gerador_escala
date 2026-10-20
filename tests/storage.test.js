import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
test('falha de rede preserva alterações e uma nova tentativa confirma o salvamento',async () => {
  const dom=new JSDOM('<div id="appContent"></div><div id="connectionError" class="hidden"></div><span id="saveStatus"></span>',{runScripts:'outside-only',url:'http://127.0.0.1:3210'});
  try {
    const w=dom.window; w.structuredClone=structuredClone; let fail=true, writes=[];
    w.fetch=async (path,options) => {
      if(path==='/api/session') return {ok:true,json:async () => ({token:'test',canEdit:true})};
      if(options.method==='PUT') { writes.push(JSON.parse(options.body)); if(fail) throw new Error('offline'); return {ok:true,json:async () => ({revision:1,updatedAt:new Date().toISOString()})}; }
      return {ok:true,json:async () => ({revision:0,state:null})};
    };
    new vm.Script(readFileSync(new URL('../public/storage.js',import.meta.url),'utf8')).runInContext(dom.getInternalVMContext());
    await w.persistencia.iniciar(); w.persistencia.salvar({funcionarios:[{nome:'Teste'}]}); await w.persistencia.flush();
    assert.equal(w.persistencia.pendente,true); assert.equal(w.document.getElementById('appContent').inert,true); assert.equal(w.document.getElementById('saveStatus').dataset.kind,'error');
    fail=false; w.document.querySelector('#connectionError button:last-child').click(); await w.persistencia.flush();
    assert.equal(w.persistencia.pendente,false); assert.equal(w.persistencia.revision,1); assert.equal(w.document.getElementById('saveStatus').dataset.kind,'saved'); assert.deepEqual(writes[0].state,writes[1].state);
  } finally {dom.window.close();}
});

test('modo consulta não salva navegação e exige senha para importar ou restaurar',async () => {
  const dom=new JSDOM('<div id="appContent"></div><div id="connectionError" class="hidden"></div><span id="saveStatus"></span>',{runScripts:'outside-only',url:'http://127.0.0.1:3210'});
  try {
    const w=dom.window; w.structuredClone=structuredClone; const calls=[];
    w.fetch=async (path,options={}) => {calls.push([path,options.method]);return {ok:true,json:async()=>path==='/api/session'?{token:'test',canEdit:false}:{revision:0,state:null}};};
    new vm.Script(readFileSync(new URL('../public/storage.js',import.meta.url),'utf8')).runInContext(dom.getInternalVMContext());
    await w.persistencia.iniciar(); w.persistencia.salvar({example:true}); await w.persistencia.flush();
    assert.equal(w.persistencia.canEdit,false);assert.equal(w.persistencia.pendente,false);assert.equal(calls.length,2);
    await assert.rejects(w.persistencia.importar({}),/senha/);await assert.rejects(w.persistencia.restaurar(1),/senha/);assert.equal(calls.length,2);
  } finally {dom.window.close();}
});
