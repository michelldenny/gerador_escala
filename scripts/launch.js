import { createConfiguredApplication } from '../src/server.js';
import { spawn } from 'node:child_process';
const url='http://127.0.0.1:3210';
const open=() => {
  console.log(`\nAbra ${url}\nMantenha esta janela aberta enquanto usa a aplicação.\n`);
  if(process.platform==='win32') spawn('cmd.exe',['/c','start','',url],{windowsHide:true,stdio:'ignore'});
};
const server=createConfiguredApplication();
server.on('error',async error => {
  if(error.code==='EADDRINUSE') {
    try { const response=await fetch(url+'/api/session'); const data=await response.json(); if(!response.ok || !data.token) throw new Error(); open(); server.close(); return; } catch { console.error('A porta 3210 está em uso por outro programa. Encerre esse programa ou use PORT e npm start.'); }
  } else console.error('Não foi possível iniciar:',error.message);
  process.exitCode=1;
});
server.listen(3210,'127.0.0.1',open);
for(const signal of ['SIGINT','SIGTERM']) process.on(signal,() => server.close(() => process.exit(0)));
