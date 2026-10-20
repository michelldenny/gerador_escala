import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import { InputError, validateState } from '../public/state-validation.js';
export { InputError, validateState };

export function openStore(filename) {
  mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS versions (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL, reason TEXT NOT NULL, payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS current_state (id INTEGER PRIMARY KEY CHECK(id=1), version INTEGER NOT NULL REFERENCES versions(id));
    CREATE TABLE IF NOT EXISTS employees (registration TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL, starts_on TEXT NOT NULL, ends_on TEXT);
    CREATE TABLE IF NOT EXISTS vacations (registration TEXT NOT NULL REFERENCES employees(registration), starts_on TEXT NOT NULL, ends_on TEXT NOT NULL, PRIMARY KEY(registration,starts_on,ends_on));
    PRAGMA user_version=1;`);
  const read = () => { const row = db.prepare('SELECT v.* FROM current_state c JOIN versions v ON v.id=c.version WHERE c.id=1').get(); return row ? { revision: row.id, updatedAt: row.created_at, state: JSON.parse(row.payload) } : { revision:0, updatedAt:null, state:null }; };
  function save(state, revision, reason = 'Salvamento automático') {
    validateState(state);
    db.exec('BEGIN IMMEDIATE');
    try {
      if (read().revision !== revision) throw new InputError('Outra aba salvou alterações. Baixe suas alterações pendentes e recarregue antes de continuar.',409);
      const now = new Date().toISOString();
      const id = Number(db.prepare('INSERT INTO versions(created_at,reason,payload) VALUES (?,?,?)').run(now,reason,JSON.stringify(state)).lastInsertRowid);
      db.prepare('INSERT INTO current_state(id,version) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET version=excluded.version').run(id);
      db.exec('DELETE FROM vacations; DELETE FROM employees;');
      const employee = db.prepare('INSERT INTO employees VALUES(?,?,?,?,?)');
      for (const f of state.funcionarios) employee.run(f.registro,f.nome,f.telefone,f.dataInicio,f.dataFim || null);
      const vacation = db.prepare('INSERT OR IGNORE INTO vacations VALUES(?,?,?)');
      const maps = [state.ferias,...Object.values(state.feriasPorAno)];
      for (const map of maps) for (const [record,periods] of Object.entries(map)) for (const p of periods) vacation.run(record,p.inicio,p.fim);
      db.exec('COMMIT');
      return { revision:id, updatedAt:now };
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  return { read, save, close:() => db.close(), history:() => db.prepare('SELECT id,created_at AS createdAt,reason FROM versions ORDER BY id DESC LIMIT 50').all(), restore(id, revision) { const row=db.prepare('SELECT payload FROM versions WHERE id=?').get(id); if(!row) throw new InputError('Versão não encontrada.',404); return save(JSON.parse(row.payload),revision,`Restauração da versão ${id}`); } };
}
