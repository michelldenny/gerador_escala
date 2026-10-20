import { getApps, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { validateState, InputError } from '../public/state-validation.js';
export function openFirestoreStore({db:providedDb}={}) {
  if(providedDb)return createStore(providedDb);
  let ready;
  const initialize=async()=>{
    const credential=applicationDefault();
    // Validate credentials before creating a gRPC client, so missing ADC cannot terminate the HTTP server.
    await credential.getAccessToken();
    return createStore(getFirestore(getApps()[0] || initializeApp({credential,projectId:'gerador-de-escala-59952'})));
  };
  return Object.fromEntries(['read','save','history','restore'].map(method=>[method,async(...args)=>{ready ||= initialize();const store=await ready;return store[method](...args);}]).concat([['close',()=>{}]]));
}
function createStore(db) {
  const current=db.doc('escalas/penha'), versions=current.collection('versoes');
  const decode=snap => {if(!snap.exists)return {revision:0,updatedAt:null,state:null}; const data=snap.data(); if(data.schemaVersion!==1)throw new InputError('Formato incompatível no Firestore.');const state=JSON.parse(data.payload);validateState(state);return {revision:data.revision,updatedAt:data.updatedAt?.toDate().toISOString() || null,state};};
  return {
    async read(){return decode(await current.get());},
    async save(state,revision,reason='Salvamento automático') {
      validateState(state);
      const payload=JSON.stringify(state);if(Buffer.byteLength(payload)>850_000)throw new InputError('O estado excede o limite de 850 KB.');
      const next=revision+1;
      await db.runTransaction(async tx=>{const snap=await tx.get(current);if((snap.exists?snap.data().revision:0)!==revision)throw new InputError('Outra pessoa ou aba alterou a escala. Baixe suas alterações pendentes e recarregue.',409);const data={schemaVersion:1,payload,revision:next,updatedAt:FieldValue.serverTimestamp(),updatedBy:'editor-com-senha',reason};tx.set(current,data);tx.create(versions.doc(String(next)),data);});
      return {revision:next,updatedAt:new Date().toISOString()};
    },
    async history(){return (await versions.orderBy('revision','desc').limit(50).get()).docs.map(s=>({id:s.data().revision,createdAt:s.data().updatedAt?.toDate().toISOString(),reason:s.data().reason}));},
    async restore(id,revision){const snap=await versions.doc(String(id)).get();if(!snap.exists)throw new InputError('Versão não encontrada.',404);return this.save(decode(snap).state,revision,`Restauração da versão ${id}`);},
    close(){}
  };
}
