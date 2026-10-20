import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { mkdir,writeFile } from 'node:fs/promises';
import { hashPassword } from '../src/editor-access.js';
let muted=false;
const output=new Writable({write(chunk,encoding,callback){if(!muted)process.stdout.write(chunk);callback();}});
const rl=createInterface({input:process.stdin,output,terminal:true});
async function ask(prompt){return new Promise(resolve=>{rl.question(prompt,value=>{muted=false;process.stdout.write('\n');resolve(value);});muted=true;});}
try {
  const password=await ask('Nova senha de edição (mínimo 8 caracteres): ');
  const confirmation=await ask('Repita a senha: ');
  if(password!==confirmation)throw new Error('As senhas não coincidem.');
  const passwordHash=await hashPassword(password);
  const data=new URL('../data/',import.meta.url);await mkdir(data,{recursive:true});
  await writeFile(new URL('editor-password.json',data),JSON.stringify({passwordHash}),{mode:0o600});
  await writeFile(new URL('editor-password.hash',data),passwordHash,{mode:0o600});
  console.log('Senha configurada. Reinicie o servidor para aplicar. A senha não foi salva em texto puro.');
}catch(error){console.error(error.message);process.exitCode=1;}finally{rl.close();}
