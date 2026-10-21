import { emitKeypressEvents } from 'node:readline';

export function askPassword(prompt,{input=process.stdin,output=process.stdout}={}) {
  if(!input.isTTY || typeof input.setRawMode!=='function')return Promise.reject(new Error('Abra Definir Senha.cmd em uma janela de terminal para digitar a senha.'));
  return new Promise((resolve,reject)=>{
    let value='';const wasRaw=Boolean(input.isRaw);
    emitKeypressEvents(input);
    function finish(error){
      input.removeListener('keypress',onKey);input.removeListener('end',onEnd);
      if(Boolean(input.isRaw)!==wasRaw)input.setRawMode(wasRaw);
      if(!wasRaw)input.pause();output.write('\n');
      if(error)reject(error);else resolve(value);
    }
    function onEnd(){finish(new Error('Entrada encerrada. Nenhuma senha foi alterada.'));}
    function onKey(text,key={}){
      if(key.ctrl && key.name==='c'){finish(new Error('Operação cancelada. Nenhuma senha foi alterada.'));return;}
      if(key.name==='return' || key.name==='enter'){finish();return;}
      if(key.name==='backspace'){
        if(value){value=Array.from(value).slice(0,-1).join('');output.write('\b \b');}
        return;
      }
      // Ignore navigation and control sequences; the password itself is never echoed.
      if(key.ctrl || key.meta || !text || /[\x00-\x1f\x7f\x1b]/.test(text))return;
      for(const character of text){if(value.length+character.length>256)break;value+=character;output.write('*');}
    }
    input.on('keypress',onKey);input.once('end',onEnd);
    output.write(prompt);if(!input.isRaw)input.setRawMode(true);input.resume();
  });
}
