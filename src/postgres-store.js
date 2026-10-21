import pg from 'pg';
import { InputError, validateState } from '../public/state-validation.js';

export function readDatabaseUrl(environment=process.env) {
  const value=(environment.DATABASE_URL || environment.POSTGRES_URL || '').trim();
  if(!value)throw new InputError('Conecte um banco Neon PostgreSQL ao projeto na Vercel e habilite DATABASE_URL em Production. Depois faça Redeploy.',503);
  try {
    const url=new URL(value);
    if(!['postgres:','postgresql:'].includes(url.protocol) || !url.hostname || url.pathname.length<2)throw new Error();
  } catch {throw new InputError('DATABASE_URL está inválida. Use a conexão PostgreSQL fornecida pela integração do banco na Vercel.',503);}
  return value;
}

const schema=`
  CREATE TABLE IF NOT EXISTS escala_state (
    id SMALLINT PRIMARY KEY CHECK (id=1), revision INTEGER NOT NULL CHECK (revision>=0),
    updated_at TIMESTAMPTZ, payload JSONB, schema_version SMALLINT NOT NULL DEFAULT 1 CHECK (schema_version=1)
  );
  CREATE TABLE IF NOT EXISTS escala_versions (
    revision INTEGER PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL, reason TEXT NOT NULL, payload JSONB NOT NULL
  );
  CREATE TABLE IF NOT EXISTS escala_sessions (
    id VARCHAR(64) PRIMARY KEY, expires BIGINT NOT NULL, version VARCHAR(64) NOT NULL
  );
  CREATE INDEX IF NOT EXISTS escala_sessions_expires ON escala_sessions(expires);
  CREATE TABLE IF NOT EXISTS escala_attempts (
    id VARCHAR(64) PRIMARY KEY, count INTEGER NOT NULL, expires BIGINT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS escala_attempts_expires ON escala_attempts(expires);
  INSERT INTO escala_state(id,revision) VALUES(1,0) ON CONFLICT(id) DO NOTHING;
`;

export function openPostgresStore({pool:providedPool,environment=process.env}={}) {
  let pool=providedPool,ready;
  async function initialize() {
    if(!pool){
      pool=new pg.Pool({connectionString:readDatabaseUrl(environment),max:3,idleTimeoutMillis:10_000,connectionTimeoutMillis:10_000,allowExitOnIdle:true});
      pool.on('error',error=>console.error('Conexão PostgreSQL interrompida:',error.code || 'DATABASE_CONNECTION_ERROR'));
    }
    const client=await pool.connect();
    try {
      await client.query('BEGIN');
      // Serializes schema initialization across cold starts without locking unrelated applications.
      await client.query('SELECT pg_advisory_xact_lock(731294105)');
      await client.query(schema);
      await client.query('COMMIT');
    } catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}
    finally {client.release();}
  }
  async function ensureReady(){ready ||= initialize().catch(error=>{ready=undefined;throw error;});await ready;}
  async function query(text,values){await ensureReady();return pool.query(text,values);}
  function decode(row){
    if(!row || !row.payload)return {revision:0,updatedAt:null,state:null};
    validateState(row.payload);
    return {revision:Number(row.revision),updatedAt:new Date(row.updated_at || row.created_at).toISOString(),state:row.payload};
  }
  async function save(state,revision,reason='Salvamento automático') {
    validateState(state);
    if(!Number.isInteger(revision) || revision<0)throw new InputError('Revisão inválida.');
    const payload=JSON.stringify(state);
    if(Buffer.byteLength(payload)>850_000)throw new InputError('O estado excede o limite de 850 KB.');
    await ensureReady();
    const client=await pool.connect();
    try {
      await client.query('BEGIN');
      const {rows:[current]}=await client.query('SELECT revision FROM escala_state WHERE id=1 FOR UPDATE');
      if(Number(current.revision)!==revision)throw new InputError('Outra pessoa ou aba alterou a escala. Baixe suas alterações pendentes e recarregue.',409);
      const next=revision+1;
      const {rows:[version]}=await client.query('INSERT INTO escala_versions(revision,created_at,reason,payload) VALUES($1,CURRENT_TIMESTAMP,$2,$3::jsonb) RETURNING created_at',[next,reason,payload]);
      await client.query('UPDATE escala_state SET revision=$1,updated_at=$2,payload=$3::jsonb WHERE id=1',[next,version.created_at,payload]);
      await client.query('COMMIT');
      return {revision:next,updatedAt:new Date(version.created_at).toISOString()};
    } catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}
    finally {client.release();}
  }
  return {
    async read(){return decode((await query('SELECT * FROM escala_state WHERE id=1')).rows[0]);},
    save,
    async history(){return (await query('SELECT revision,created_at,reason FROM escala_versions ORDER BY revision DESC LIMIT 50')).rows.map(row=>({id:Number(row.revision),createdAt:new Date(row.created_at).toISOString(),reason:row.reason}));},
    async restore(id,revision){const {rows:[row]}=await query('SELECT payload FROM escala_versions WHERE revision=$1',[id]);if(!row)throw new InputError('Versão não encontrada.',404);return save(row.payload,revision,`Restauração da versão ${id}`);},
    async sessionGet(id){const {rows:[row]}=await query('SELECT expires,version FROM escala_sessions WHERE id=$1',[id]);return row?{expires:Number(row.expires),version:row.version}:null;},
    async sessionPut(id,session){await query('DELETE FROM escala_sessions WHERE expires<=$1',[Date.now()]);await query('INSERT INTO escala_sessions(id,expires,version) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET expires=EXCLUDED.expires,version=EXCLUDED.version',[id,session.expires,session.version]);},
    async sessionDelete(id){await query('DELETE FROM escala_sessions WHERE id=$1',[id]);},
    async attemptClear(id){await query('DELETE FROM escala_attempts WHERE id=$1',[id]);},
    async attemptTake(id,now){
      await query('DELETE FROM escala_attempts WHERE expires<=$1',[now]);
      const result=await query(`INSERT INTO escala_attempts(id,count,expires) VALUES($1,1,$3)
        ON CONFLICT(id) DO UPDATE SET count=CASE WHEN escala_attempts.expires<=$2 THEN 1 ELSE escala_attempts.count+1 END,
        expires=CASE WHEN escala_attempts.expires<=$2 THEN $3 ELSE escala_attempts.expires END
        WHERE escala_attempts.expires<=$2 OR escala_attempts.count<5 RETURNING id`,[id,now,now+15*60_000]);
      if(!result.rows.length)throw new InputError('Muitas tentativas. Aguarde 15 minutos e tente novamente.',429);
    },
    async close(){if(pool)await pool.end();}
  };
}
