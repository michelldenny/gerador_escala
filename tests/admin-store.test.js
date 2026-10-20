import test from 'node:test';
import assert from 'node:assert/strict';
import { openFirestoreStore } from '../src/firestore-store.js';
const fixture=()=>({funcionarios:[],anoAtual:2026,mesAtualIndex:9,ferias:{},feriados:{},trocasManuais:{},escalaFimAno:{},feriasPorAno:{},feriadosPorAno:{},trocasPorAno:{},fimAnoPorAno:{},ciclosPorAno:{},ciclos:{diaSemana:0,fimSemana:0,feriado:0}});
test('adaptador de servidor grava estado e versão de forma atômica e rejeita revisão antiga',async()=>{
  const rows=new Map();const snapshot=path=>({exists:rows.has(path),data:()=>rows.get(path)});
  function ref(path){
    return {
      path,get:async()=>snapshot(path),
      collection(name){
        const get=async()=>({docs:[...rows].filter(([key])=>key.startsWith(path+'/'+name+'/')).map(([key])=>snapshot(key)).sort((a,b)=>b.data().revision-a.data().revision)});
        return {doc:id=>ref(`${path}/${name}/${id}`),orderBy:()=>({limit:()=>({get})})};
      }
    };
  }
  const db={doc:ref,runTransaction:async fn=>{const staged=[];await fn({get:async r=>snapshot(r.path),set:(r,data)=>staged.push([r.path,data]),create:(r,data)=>{assert.ok(!rows.has(r.path));staged.push([r.path,data]);}});for(const [path,data]of staged)rows.set(path,{...data,updatedAt:{toDate:()=>new Date('2026-10-20T12:00:00Z')}});}};
  const store=openFirestoreStore({db});assert.equal((await store.read()).revision,0);await store.save(fixture(),0);assert.equal(rows.size,2);assert.deepEqual((await store.read()).state,fixture());
  await assert.rejects(store.save(fixture(),0),e=>e.status===409);assert.equal(rows.size,2);
  await store.restore(1,1);assert.equal((await store.read()).revision,2);assert.equal((await store.history()).length,2);
  const invalid=fixture();invalid.anoAtual=-1;await assert.rejects(store.save(invalid,2));assert.equal(rows.size,3);
});
