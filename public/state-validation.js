export class InputError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
export function validateState(state) {
  if (!object(state) || !Array.isArray(state.funcionarios) || state.funcionarios.length > 1000) throw new InputError('A equipe precisa ser uma lista válida (até 1.000 pessoas).');
  if (!Number.isInteger(state.anoAtual) || state.anoAtual < 1900 || state.anoAtual > 2200 || !Number.isInteger(state.mesAtualIndex) || state.mesAtualIndex < 0 || state.mesAtualIndex > 11) throw new InputError('Ano ou mês inválido.');
  const records = new Set();
  for (const f of state.funcionarios) {
    if (!object(f) || typeof f.nome !== 'string' || !f.nome.trim() || f.nome.length > 200 || typeof f.registro !== 'string' || !f.registro.trim() || f.registro.length > 80 || records.has(f.registro)) throw new InputError('Informe nome e registro único para cada funcionário.');
    if (typeof f.telefone !== 'string' || f.telefone.length > 80 || !date(f.dataInicio) || (f.dataFim && (!date(f.dataFim) || f.dataFim < f.dataInicio))) throw new InputError('Telefone ou vigência do funcionário inválidos.');
    records.add(f.registro);
  }
  const yearMap = (map, check) => { if (!object(map)) throw new InputError('Configuração anual inválida.'); for (const [year, value] of Object.entries(map)) { if (!/^\d{4}$/.test(year) || +year < 1900 || +year > 2200) throw new InputError('Ano de histórico inválido.'); check(value); } };
  const vacations = map => {
    if (!object(map)) throw new InputError('Férias inválidas.');
    for (const [record, periods] of Object.entries(map)) {
      if (!records.has(record) || !Array.isArray(periods)) throw new InputError('Férias vinculadas a funcionário inexistente.');
      for (const p of periods) if (!object(p) || !date(p.inicio) || !date(p.fim) || p.fim < p.inicio) throw new InputError('Período de férias inválido.');
      const sorted = [...periods].sort((a,b) => a.inicio.localeCompare(b.inicio));
      for (let i=1; i<sorted.length; i++) if (sorted[i].inicio <= sorted[i-1].fim) throw new InputError('Há períodos de férias sobrepostos.');
    }
  };
  const holidays = map => { if (!object(map)) throw new InputError('Feriados inválidos.'); for (const [day, name] of Object.entries(map)) if (!date(day) || typeof name !== 'string' || name.length > 300) throw new InputError('Feriado inválido.'); };
  const assignments = (map, endYear = false) => { if (!object(map)) throw new InputError('Trocas inválidas.'); for (const [day, item] of Object.entries(map)) { const employee = endYear ? item?.funcionario : item; if (!date(day) || (employee !== null && (!object(employee) || !records.has(employee.registro)))) throw new InputError('Plantão com data ou funcionário inválido.'); } };
  const cycles = value => { if (!object(value) || !['diaSemana','fimSemana','feriado'].every(key => Number.isInteger(value[key]) && value[key] >= 0 && value[key] <= Math.max(state.funcionarios.length-1,0))) throw new InputError('Ciclo inválido.'); };
  vacations(state.ferias); holidays(state.feriados); assignments(state.trocasManuais); assignments(state.escalaFimAno,true); cycles(state.ciclos);
  yearMap(state.feriasPorAno,vacations); yearMap(state.feriadosPorAno,holidays); yearMap(state.trocasPorAno,assignments); yearMap(state.fimAnoPorAno,value => assignments(value,true)); yearMap(state.ciclosPorAno,cycles);
  // Reject prototype keys throughout imported data, including nested annual maps.
  const inspect = value => { if (value && typeof value === 'object') for (const [key,item] of Object.entries(value)) { if (['__proto__','constructor','prototype'].includes(key)) throw new InputError('Chave inválida no arquivo.'); inspect(item); } }; inspect(state);
  return state;
}

