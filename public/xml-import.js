/* Legacy XML is parsed and validated before any network request or mutation. */
async function lerArquivoXML(file) {
  const buffer=typeof file.arrayBuffer==='function' ? await file.arrayBuffer() : await new Promise((resolve,reject) => {
    const reader=new FileReader(); reader.onload=() => resolve(reader.result); reader.onerror=() => reject(new Error('Não foi possível ler o arquivo XML.')); reader.readAsArrayBuffer(file);
  });
  const bytes=new Uint8Array(buffer);
  let encoding='utf-8';
  if(bytes[0]===0xff && bytes[1]===0xfe) encoding='utf-16le';
  else if(bytes[0]===0xfe && bytes[1]===0xff) encoding='utf-16be';
  else if(bytes[0]===0x3c && bytes[1]===0) encoding='utf-16le';
  else {
    const header=new TextDecoder('ascii').decode(bytes.slice(0,200));
    const declared=header.match(/<\?xml[^>]*encoding\s*=\s*["']([^"']+)/i)?.[1];
    if(declared) encoding=declared;
  }
  try { return new TextDecoder(encoding,{fatal:true}).decode(bytes).replace(/^\uFEFF/,''); }
  catch { throw new Error(`O arquivo não pôde ser lido com a codificação ${encoding}. Exporte o XML novamente ou salve como UTF-8.`); }
}

function lerConfiguracaoXML(text) {
  const xml=new DOMParser().parseFromString(text.trim().replace(/^\uFEFF/,''),'text/xml');
  const nodes=(node,tag) => [...node.getElementsByTagName('*')].filter(item => item.localName===tag);
  if(nodes(xml,'parsererror').length || xml.documentElement?.localName!=='configuracao_escala') throw new Error('XML inválido. Selecione o arquivo exportado em Salvar Configuração da aplicação antiga.');
  if(!nodes(xml,'funcionarios').length) throw new Error('O XML não contém a seção de funcionários.');
  const value=(node,tag,fallback='') => nodes(node,tag)[0]?.textContent?.trim() || fallback;
  const date=value => { const clean=String(value).trim(); const match=clean.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return match ? `${match[3]}-${match[2]}-${match[1]}` : clean; };
  const safe=key => { if(!key || ['__proto__','constructor','prototype'].includes(key)) throw new Error('Registro ou chave inválida no XML.'); return key; };
  const state={funcionarios:[],ferias:{},feriados:{},trocasManuais:{},escalaFimAno:{},feriasPorAno:{},feriadosPorAno:{},trocasPorAno:{},fimAnoPorAno:{},ciclosPorAno:{},anoAtual:Number(value(xml,'ano',String(new Date().getFullYear()))),mesAtualIndex:new Date().getMonth(),ciclos:{diaSemana:0,fimSemana:0,feriado:0}};
  for(const node of nodes(xml,'funcionario')) state.funcionarios.push({nome:value(node,'nome'),registro:safe(value(node,'registro',value(node,'rf'))),telefone:value(node,'telefone'),dataInicio:date(value(node,'data_inicio','1900-01-01')),dataFim:date(value(node,'data_fim'))});
  const source=[...state.funcionarios];
  state.funcionarios.sort(compararRegistroFuncional);
  const employeeFor=node => {
    const record=node.getAttribute('registro') || node.getAttribute('registro_funcionario');
    if(record!==null && record!=='') { const employee=source.find(f => f.registro===record.trim()); if(!employee) throw new Error(`O XML referencia o registro ${record}, que não consta na equipe.`); return employee; }
    const index=node.getAttribute('index') ?? node.getAttribute('funcionario_index');
    if(index!==null && /^\d+$/.test(index) && source[Number(index)]) return source[Number(index)];
    const name=node.getAttribute('nome_funcionario');
    const matches=source.filter(f => f.nome===name); if(matches.length===1) return matches[0];
    throw new Error('O XML contém férias ou plantão sem funcionário correspondente.');
  };
  for(const node of nodes(xml,'funcionario_ferias')) {
    const record=safe(employeeFor(node).registro); const period={inicio:date(value(node,'inicio')),fim:date(value(node,'fim'))};
    const periods=state.ferias[record] ||= [];
    if(!periods.some(item => item.inicio===period.inicio && item.fim===period.fim)) periods.push(period);
  }
  for(const node of nodes(xml,'feriado')) state.feriados[safe(date(node.getAttribute('data') || ''))]=node.textContent.trim();
  const cycleIndex=raw => {
    const originalIndex=raw==null || String(raw).trim()==='' || Number(raw)===-1 ? 0 : Number(raw);
    if(!Number.isInteger(originalIndex) || originalIndex<0 || originalIndex>=Math.max(1,source.length)) throw new Error(`Ciclo inválido no XML: posição ${raw} não corresponde à equipe.`);
    return Math.max(0,state.funcionarios.findIndex(f => f.registro===source[originalIndex]?.registro));
  };
  const cycles=nodes(xml,'ciclos')[0];
  if(cycles) for(const [field,tag] of Object.entries({diaSemana:'diaSemanaInicio',fimSemana:'fimSemanaInicio',feriado:'feriadosInicio'})) state.ciclos[field]=cycleIndex(nodes(cycles,tag)[0]?.getAttribute('index'));
  for(const node of nodes(xml,'ano_ciclos')) state.ciclosPorAno[safe(node.getAttribute('ano'))]={diaSemana:cycleIndex(node.getAttribute('dia_semana')),fimSemana:cycleIndex(node.getAttribute('fim_semana')),feriado:cycleIndex(node.getAttribute('feriado'))};
  for(const [tag,target] of [['troca','trocasManuais'],['plantao','escalaFimAno']]) for(const node of nodes(xml,tag)) {
    const employee=employeeFor(node); const day=safe(date(node.getAttribute('data') || ''));
    state[target][day]=tag==='plantao' ? {funcionario:employee,data:day} : employee;
  }
  state.ciclosPorAno[state.anoAtual]=state.ciclos;
  state.coresDias={};
  for(const node of nodes(xml,'cor_dia'))state.coresDias[safe(date(node.getAttribute('data') || ''))]=node.getAttribute('tipo');
  state.feriasPorAno[state.anoAtual]=structuredClone(state.ferias); state.feriadosPorAno[state.anoAtual]={...state.feriados}; state.trocasPorAno[state.anoAtual]={...state.trocasManuais}; state.fimAnoPorAno[state.anoAtual]={...state.escalaFimAno};
  window.validarEstado?.(state);
  return state;
}

async function handleFileUpload(event) {
  const file=event.target.files[0]; event.target.value=''; if(!file) return;
  try {
    if(file.size>5_000_000) throw new Error('O XML deve ter até 5 MB.');
    const state=lerConfiguracaoXML(await lerArquivoXML(file));
    showConfirm(`Importar ${state.funcionarios.length} funcionários e a configuração de ${state.anoAtual}? As regras desse ano serão substituídas. Os demais anos e funcionários serão preservados, e o estado anterior continuará no histórico.`,async ok => {
      if(!ok) return;
      try {
        await persistencia.flush(); if(persistencia.pendente) throw new Error('Resolva o salvamento pendente antes de importar.');
        const current=await persistencia.request('/api/state');
        // The merge must be committed against the exact revision that was read.
        if(current.revision!==persistencia.revision) throw new Error('Outra aba ou pessoa alterou a escala. Recarregue a página e importe novamente.');
        const merged=mesclarConfiguracaoXML(current.state,state); window.validarEstado?.(merged);
        await persistencia.importar(merged,current.revision);
      } catch(error) { showAlert(traduzirErroImportacao(error),'Importação XML'); }
    });
  } catch(error) { showAlert(traduzirErroImportacao(error),'Importação XML'); }
}
function traduzirErroImportacao(error) {
  return /failed to fetch/i.test(error.message || '') ? 'Não foi possível conectar ao banco. Confira sua internet e tente importar novamente. Os dados anteriores foram preservados.' : error.message;
}

function mesclarConfiguracaoXML(existing,imported) {
  if(!existing) return imported;
  const employees=new Map(existing.funcionarios.map(f => [f.registro,f]));
  imported.funcionarios.forEach(f => employees.set(f.registro,f));
  const merged={...existing,...imported,funcionarios:[...employees.values()].sort(compararRegistroFuncional)};
  merged.coresDias={...existing.coresDias,...imported.coresDias};
  for(const key of ['feriasPorAno','feriadosPorAno','trocasPorAno','fimAnoPorAno']) merged[key]={...existing[key],...imported[key]};
  const remap=(cycles,source) => Object.fromEntries(['diaSemana','fimSemana','feriado'].map(key => [key,Math.max(0,merged.funcionarios.findIndex(f => f.registro===source.funcionarios[cycles[key]]?.registro))]));
  merged.ciclosPorAno={};
  for(const source of [existing,imported]) for(const [year,cycles] of Object.entries(source.ciclosPorAno)) merged.ciclosPorAno[year]=remap(cycles,source);
  merged.ciclos=remap(imported.ciclos,imported); merged.ciclosPorAno[imported.anoAtual]=merged.ciclos;
  return merged;
}
