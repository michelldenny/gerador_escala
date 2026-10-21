import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough, Writable } from 'node:stream';
import { askPassword } from '../scripts/password-prompt.mjs';

function terminal(){
  const input=new PassThrough();input.isTTY=true;input.isRaw=false;
  input.setRawMode=value=>{input.isRaw=value;};
  let text='';const output=new Writable({write(chunk,encoding,done){text+=chunk.toString();done();}});
  return {input,output,get text(){return text;}};
}

test('senha mostra asteriscos, aceita correção e confirmação sem exibir caracteres privados',async()=>{
  const terminal1=terminal();
  const first=askPassword('Senha: ',terminal1);terminal1.input.write('abcX\x7fd\r');
  assert.equal(await first,'abcd');assert.equal(terminal1.input.isRaw,false);
  assert.match(terminal1.text,/\*\*\*\*/);assert.ok(!terminal1.text.includes('abc'));
  const second=askPassword('Repita: ',terminal1);terminal1.input.write('abcd\r');
  assert.equal(await second,'abcd');assert.equal(terminal1.input.listenerCount('keypress'),0);
  assert.ok(!terminal1.text.includes('abcd'));
});

test('Ctrl+C cancela a entrada e restaura o terminal; navegação não vira senha',async()=>{
  const terminal1=terminal();const password=askPassword('Senha: ',terminal1);
  terminal1.input.write('private\x03');await assert.rejects(password,/cancelada/);
  assert.equal(terminal1.input.isRaw,false);assert.equal(terminal1.input.listenerCount('keypress'),0);
  assert.ok(!terminal1.text.includes('private'));
  const next=askPassword('Senha: ',terminal1);terminal1.input.write('a\x1b[Db\r');assert.equal(await next,'ab');
});

test('janela sem entrada interativa informa como abrir o programa',async()=>{
  await assert.rejects(askPassword('Senha: ',{input:new PassThrough(),output:new PassThrough()}),/Definir Senha.cmd/);
});
