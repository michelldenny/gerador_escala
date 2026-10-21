import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
test('aplicação abre para consulta sem login e só libera os formulários após validar a senha',async()=>{
  const dir=new URL('../public/',import.meta.url);const dom=new JSDOM(fs.readFileSync(new URL('index.html',dir),'utf8'),{runScripts:'outside-only',url:'http://127.0.0.1:3210/',pretendToBeVisual:true});
  try {
    await new Promise(resolve=>dom.window.addEventListener('load',resolve));const w=dom.window;w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;w.structuredClone=structuredClone;
    w.fetch=async(path,options={})=>({ok:true,json:async()=>path==='/api/session'?{token:'test',canEdit:false}:path==='/api/state'?{revision:0,state:null}:{canEdit:path==='/api/editor/unlock'}});
    for(const name of ['validation.bundle.js','storage.js','app.js','schedule.js','exports.js','xml-import.js','interface.js','editor.js'])new vm.Script(fs.readFileSync(new URL(name,dir),'utf8')).runInContext(dom.getInternalVMContext());
    w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await new Promise(resolve=>setImmediate(resolve));
    assert.equal(w.document.getElementById('loginPanel'),null);assert.equal(w.persistencia.canEdit,false);assert.equal(w.document.getElementById('nomeFuncionario').disabled,true);assert.equal(w.document.getElementById('appContent').inert,false);
    w.document.getElementById('editorToggle').click();assert.ok(w.document.getElementById('editorDialog'));
    w.document.getElementById('editorPassword').value='senha-apenas-de-teste';w.document.querySelector('#editorDialog form').dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(resolve=>setImmediate(resolve));
    assert.equal(w.persistencia.canEdit,true);assert.equal(w.document.getElementById('nomeFuncionario').disabled,false);assert.equal(w.document.getElementById('editorDialog'),null);
    await w.persistencia.bloquear();assert.equal(w.document.getElementById('nomeFuncionario').disabled,true);
  }finally{dom.window.close();}
});
