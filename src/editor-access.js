import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt=promisify(scryptCallback);
export async function hashPassword(password) {
  if(typeof password!=='string' || password.length<8 || password.length>256) throw new Error('A senha precisa ter de 8 a 256 caracteres.');
  const salt=randomBytes(16).toString('hex');
  return `${salt}:${(await scrypt(password,salt,64)).toString('hex')}`;
}
export function editorAccess({passwordHash,now=Date.now}={}) {
  if(passwordHash && !/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(passwordHash)) throw new Error('Hash da senha de edição inválido.');
  const sessions=new Map(), attempts=new Map();
  const prune=map => {for(const [key,value] of map) if(value.expires<=now()) map.delete(key);};
  const cookie=req => {const raw=String(req.headers.cookie || '').split(';').map(s=>s.trim()).find(s=>s.startsWith('escala_editor=')); return raw?.slice(14);};
  function canEdit(req) {prune(sessions); return Boolean(sessions.get(cookie(req)));}
  return {
    configured:Boolean(passwordHash), canEdit,
    revoke(req) {sessions.delete(cookie(req));},
    async unlock(password,ip) {
      if(!passwordHash) throw Object.assign(new Error('A senha de edição ainda não foi configurada pelo responsável.'),{status:503});
      prune(attempts); prune(sessions);
      const attempt=attempts.get(ip) || {count:0,expires:now()+15*60_000};
      if(attempt.count>=5 || attempts.size>=1000 || sessions.size>=1000) throw Object.assign(new Error('Muitas tentativas. Aguarde 15 minutos e tente novamente.'),{status:429});
      attempt.count++;attempts.set(ip,attempt);
      const [salt,expected]=passwordHash.split(':');
      const actual=await scrypt(typeof password==='string' ? password.slice(0,257) : '',salt,64);
      if(!timingSafeEqual(actual,Buffer.from(expected,'hex'))) throw Object.assign(new Error('Senha de edição incorreta.'),{status:401});
      attempts.delete(ip);
      const token=randomBytes(32).toString('hex');sessions.set(token,{expires:now()+8*60*60_000});
      return token;
    }
  };
}
