import { mkdir,writeFile } from 'node:fs/promises';
import { hashPassword } from '../src/editor-access.js';
import { askPassword } from './password-prompt.mjs';
const wasRaw=Boolean(process.stdin.isRaw);
try {
  // Keep the same terminal mode across both prompts (Windows ConPTY).
  if(process.stdin.isTTY)process.stdin.setRawMode(true);
  console.log('Digite a senha: cada caractere aparecerá como *. Pressione Enter para continuar.');
  console.log('Use Backspace para corrigir ou Ctrl+C para cancelar.\n');
  const password=await askPassword('Nova senha de edição (mínimo 8 caracteres): ');
  const confirmation=await askPassword('Repita a senha: ');
  if(password!==confirmation)throw new Error('As senhas não coincidem.');
  const passwordHash=await hashPassword(password);
  const data=new URL('../data/',import.meta.url);await mkdir(data,{recursive:true});
  await writeFile(new URL('editor-password.json',data),JSON.stringify({passwordHash}),{mode:0o600});
  await writeFile(new URL('editor-password.hash',data),passwordHash,{mode:0o600});
  console.log('\nSenha configurada. A senha não foi salva em texto puro.');
  console.log('Na Vercel: abra data/editor-password.hash no Bloco de Notas e copie a linha inteira');
  console.log('para ESCALA_EDITOR_PASSWORD_HASH. Salve e faça Redeploy.');
  console.log('Para uso local, reinicie o servidor.');
}catch(error){console.error(error.message);process.exitCode=1;}
finally{
  if(process.stdin.isTTY && Boolean(process.stdin.isRaw)!==wasRaw)process.stdin.setRawMode(wasRaw);
  process.stdin.pause();
  // ConPTY can retain a pending keyboard read after raw mode ends.
  process.stdout.write('',()=>process.exit(process.exitCode || 0));
}
