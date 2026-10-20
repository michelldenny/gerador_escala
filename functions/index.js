import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { createApplication } from '../src/server.js';
import { openFirestoreStore } from '../src/firestore-store.js';
const passwordHash=defineSecret('ESCALA_EDITOR_PASSWORD_HASH');
let server;
export const escalaApi=onRequest({secrets:[passwordHash],maxInstances:1,concurrency:40,region:'us-central1'},(req,res)=>{
  server ||= createApplication({store:openFirestoreStore(),passwordHash:passwordHash.value().trim(),publicOrigin:process.env.PUBLIC_ORIGIN || 'https://gerador-de-escala-59952.web.app'});
  server.emit('request',req,res);
});
