import { randomBytes, createHash, createHmac, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt=promisify(scryptCallback);
export async function hashPassword(password) {
  if(typeof password!=='string' || password.length<8 || password.length>256) throw new Error('A senha precisa ter de 8 a 256 caracteres.');
  const salt=randomBytes(16).toString('hex');
  return `${salt}:${(await scrypt(password,salt,64)).toString('hex')}`;
}
export function editorAccess({passwordHash,now=Date.now,persistence}={}) {
  if(passwordHash && !/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(passwordHash)) throw Object.assign(new Error('ESCALA_EDITOR_PASSWORD_HASH está inválida. Execute Definir Senha.cmd no computador e cole somente a linha inteira do arquivo data/editor-password.hash nessa variável da Vercel. Depois faça Redeploy.'),{code:'EDITOR_PASSWORD_HASH_INVALID'});
  const sessions=new Map(), attempts=new Map();
  const version=createHash('sha256').update(passwordHash || '').digest('hex');
  const sessionId=req=>{const value=cookie(req);return /^[a-f0-9]{64}$/.test(value || '') ? createHash('sha256').update(value).digest('hex') : null;};
  const prune=map => {for(const [key,value] of map) if(value.expires<=now()) map.delete(key);};
  const cookie=req => {const raw=String(req.headers.cookie || '').split(';').map(s=>s.trim()).find(s=>s.startsWith('escala_editor=')); return raw?.slice(14);};
  function canEdit(req) {
    if(persistence){const id=sessionId(req);if(!id || !passwordHash)return false;return persistence.sessionGet(id).then(session=>Boolean(session && session.expires>now() && session.version===version));}
    prune(sessions);return Boolean(sessions.get(cookie(req)));
  }
  return {
    configured:Boolean(passwordHash), canEdit,
    revoke(req) {if(persistence){const id=sessionId(req);return id?persistence.sessionDelete(id):undefined;}sessions.delete(cookie(req));},
    async unlock(password,ip) {
      if(!passwordHash) throw Object.assign(new Error('A senha de edição ainda não foi configurada pelo responsável.'),{status:503});
      prune(attempts); prune(sessions);
      const attemptId=createHmac('sha256',passwordHash).update(String(ip)).digest('hex');
      if(persistence)await persistence.attemptTake(attemptId,now());
      if(!persistence){const attempt=attempts.get(ip) || {count:0,expires:now()+15*60_000};
        if(attempt.count>=5 || attempts.size>=1000 || sessions.size>=1000) throw Object.assign(new Error('Muitas tentativas. Aguarde 15 minutos e tente novamente.'),{status:429});
        attempt.count++;attempts.set(ip,attempt);
      }
      const [salt,expected]=passwordHash.split(':');
      const actual=await scrypt(typeof password==='string' ? password.slice(0,257) : '',salt,64);
      if(!timingSafeEqual(actual,Buffer.from(expected,'hex'))) throw Object.assign(new Error('Senha de edição incorreta.'),{status:401});
      attempts.delete(ip);if(persistence)await persistence.attemptClear(attemptId);
      const token=randomBytes(32).toString('hex');const session={expires:now()+8*60*60_000,version};
      if(persistence)await persistence.sessionPut(createHash('sha256').update(token).digest('hex'),session);else sessions.set(token,session);
      return token;
    }
  };
}
