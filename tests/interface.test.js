import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { validateState } from '../public/state-validation.js';
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const script=name => readFileSync(new URL(`../public/${name}`,import.meta.url),'utf8');
const base={funcionarios:[1,2,3,4,5].map(n => ({nome:`Pessoa ${n}`,registro:`00${n}`,telefone:`1190000000${n}`,dataInicio:'2025-01-01',dataFim:''})),anoAtual:2026,mesAtualIndex:9,ferias:{'001':[{inicio:'2026-10-01',fim:'2026-10-15'}]},feriados:{},trocasManuais:{},escalaFimAno:{},feriasPorAno:{},feriadosPorAno:{},trocasPorAno:{},fimAnoPorAno:{},ciclosPorAno:{},ciclos:{diaSemana:0,fimSemana:0,feriado:0}};
async function setup(initial=base) {
  const dom=new JSDOM(html,{runScripts:'outside-only',url:'http://127.0.0.1:3210/',pretendToBeVisual:true});
  await new Promise(resolve => dom.window.addEventListener('load',resolve));
  const context=dom.getInternalVMContext(); const execute=code => new vm.Script(code).runInContext(context);
  dom.window.structuredClone=structuredClone;
  dom.window.validarEstado=validateState;
  dom.window.TextDecoder=TextDecoder;
  dom.window.estadoInicial=structuredClone(initial); dom.window.saved=null;
  dom.window.persistencia={ iniciar:async () => {},salvar:state => {dom.window.saved=JSON.parse(JSON.stringify(state));},flush:async () => {},request:async () => ({versions:[]}),revision:0 };
  execute(script('app.js')); execute(script('schedule.js')); execute(script('exports.js')); execute(script('xml-import.js')); execute(script('interface.js')); dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
  await new Promise(resolve => setImmediate(resolve));
  return {dom,window:dom.window,document:dom.window.document,execute};
}
test('cadastro, edição de dia, férias, navegação anual e documentos',async () => {
  const {dom,window:w,document:d,execute}=await setup();
  try {
    assert.equal(d.getElementById('appContent').inert,false); assert.equal(d.querySelectorAll('#calendario [data-data]').length,31);
    assert.equal(d.querySelectorAll('#listaFuncionarios [data-index]').length,5);
    assert.equal(d.getElementById('metricVacation').textContent,'1');
    w.mostrarTela('configuracoes');
    d.getElementById('nomeFuncionario').value='Nova Pessoa'; d.getElementById('registroFuncionario').value='006'; d.getElementById('telefoneFuncionario').value='11900000006'; d.getElementById('inicioFuncionario').value='2026-11-01'; w.adicionarFuncionario();
    assert.equal(w.saved.funcionarios.length,6); assert.equal(w.saved.funcionarios[5].registro,'006');
    w.abrirDia('2026-10-05'); const select=d.getElementById('dayEmployee');
    assert.ok(![...select.options].some(option => option.value==='001'),'férias impedem atribuição'); assert.ok(![...select.options].some(option => option.value==='006'),'entrada futura impede atribuição');
    const selected=[...select.options].find(option => option.value && option.value!==select.value); select.value=selected.value;
    d.querySelector('.day-card .solid-button').click(); assert.equal(w.saved.trocasManuais['2026-10-05'].registro,selected.value); assert.equal(d.querySelector('.day-overlay'),null);
    w.proximoAno(); assert.equal(w.saved.anoAtual,2027); w.anoAnterior(); assert.equal(w.saved.anoAtual,2026); assert.equal(w.saved.ferias['001'][0].fim,'2026-10-15');
    w.mostrarTela('documentos'); await new Promise(resolve => setImmediate(resolve)); assert.equal(d.getElementById('documentsScreen').classList.contains('screen-hidden'),false); assert.equal(d.getElementById('escalaScreen').classList.contains('screen-hidden'),true);
    assert.equal(d.getElementById('escalaScreen').parentElement.id,'appContent'); assert.equal(d.getElementById('alertModal').parentElement.tagName,'BODY');
    assert.equal(execute('Object.keys(escalaAtual).length'),365);
  } finally { dom.window.close(); }
});
test('exportação PDF, Word e XML mantém equipe e dados do mês',async () => {
  const {dom,window:w,document:d}=await setup();
  try {
    const downloads=[]; const blobs=[];
    w.URL.createObjectURL=blob => {blobs.push(blob);return 'blob:test';}; w.URL.revokeObjectURL=() => {};
    w.HTMLAnchorElement.prototype.click=function(){ downloads.push(this.download); };
    w.HTMLCanvasElement.prototype.getContext=() => null;
    new vm.Script(script('vendor/jspdf.umd.min.js')).runInContext(dom.getInternalVMContext()); new vm.Script(script('vendor/jspdf.plugin.autotable.min.js')).runInContext(dom.getInternalVMContext());
    let pdfRows=0; const RealPDF=w.jspdf.jsPDF;
    w.jspdf.jsPDF=function(...args) { const pdf=new RealPDF(...args); pdf.save=()=> { const output=pdf.output(); assert.ok(output.startsWith('%PDF-')); assert.ok(output.length>2000); downloads.push('document.pdf'); }; const original=pdf.autoTable; pdf.autoTable=function(options){pdfRows=options.body.length;return original.call(this,options);}; return pdf; };
    d.getElementById('mesExportar').value='9'; d.getElementById('formatoExportar').value='pdf'; w.exportarDefesaCivil(); assert.equal(pdfRows,31); assert.ok(downloads.includes('document.pdf'));
    d.getElementById('formatoExportar').value='word'; w.exportarDiarioOficial(); assert.ok(downloads.some(name => name.endsWith('.doc')));
    w.exportarConfiguracaoXML(); assert.ok(downloads.some(name => name.endsWith('.xml'))); assert.ok(blobs.at(-1).size>1000);
  } finally { dom.window.close(); }
});
test('nomes e registros importados são escapados na interface',async () => {
  const state=structuredClone(base); state.funcionarios[0].nome='<img src=x onerror=alert(1)>'; state.funcionarios[0].registro="RF'\"<unsafe>"; state.ferias={ [state.funcionarios[0].registro]:[{inicio:'2026-10-01',fim:'2026-10-15'}] };
  const {dom,document:d,execute}=await setup(state);
  try { assert.equal(d.querySelectorAll('#listaFuncionarios img').length,0); assert.equal(d.querySelectorAll('#listaFerias unsafe').length,0); const button=d.querySelector('#listaFerias button'); assert.doesNotThrow(() => execute(button.getAttribute('onclick'))); assert.equal(d.getElementById('funcionarioFerias').value,state.funcionarios[0].registro); } finally {dom.window.close();}
});

test('migração XML lê arquivos legados sem alterar o estado antes de validar',async () => {
  const {dom,window:w,execute}=await setup();
  try {
    const xml=`<?xml version="1.0"?><configuracao_escala><funcionarios><funcionario><nome>Ana &amp; Maria</nome><registro>42</registro><telefone>11999999999</telefone><data_inicio>2025-01-01</data_inicio></funcionario></funcionarios><ferias><funcionario_ferias registro="42"><inicio>2026-10-01</inicio><fim>2026-10-15</fim></funcionario_ferias></ferias><feriados><feriado data="2026-10-12">Teste</feriado></feriados><ano>2026</ano><trocas_manuais><troca data="2026-10-20" registro_funcionario="42"/></trocas_manuais></configuracao_escala>`;
    const state=w.lerConfiguracaoXML(xml); assert.equal(state.funcionarios[0].nome,'Ana & Maria'); assert.equal(state.trocasManuais['2026-10-20'].registro,'42'); assert.equal(state.feriasPorAno[2026]['42'][0].fim,'2026-10-15');
    assert.throws(() => w.lerConfiguracaoXML('<wrong/>')); assert.equal(execute('funcionarios.length'),5); assert.equal(w.saved,null);
  } finally {dom.window.close();}
});

test('regressão: rodízio anual produz os mesmos plantões do HTML original',async () => {
  const originalHtml=readFileSync(new URL('../reference/original.html',import.meta.url),'utf8');
  let original=originalHtml.slice(originalHtml.lastIndexOf('<script>')+8,originalHtml.lastIndexOf('</script>'));
  original=original.replace("document.addEventListener('DOMContentLoaded', function() {",'window.inicializarEscalas = function() {').replace(/(mostrarTela\(funcionarios.length \? 'escala' : 'configuracoes'\);\s*)\}\);/,'$1};');
  for(const year of [2024,2026,2027]) {
    const state=structuredClone(base); state.anoAtual=year; state.ferias={'001':[{inicio:`${year}-10-01`,fim:`${year}-10-15`}]}; state.funcionarios.forEach(f => f.dataInicio=`${year}-01-01`); state.funcionarios[4].dataInicio=`${year}-05-01`; state.funcionarios[3].dataFim=`${year}-11-01`; state.escalaFimAno[`${year}-12-25`]={funcionario:state.funcionarios[1],data:`${year}-12-25`};
    const upgraded=await setup(state); const old=new JSDOM(originalHtml,{runScripts:'outside-only',url:'http://localhost/',pretendToBeVisual:true}); await new Promise(resolve => old.window.addEventListener('load',resolve));
    try {
      old.window.localStorage.setItem('escala-defesa-civil-v2',JSON.stringify(state)); new vm.Script(original).runInContext(old.getInternalVMContext()); old.window.inicializarEscalas();
      const snapshot=`JSON.stringify(Object.entries(escalaAtual).map(([date,shift]) => [date,shift.tipo,shift.funcionario?.registro || null]))`;
      assert.equal(upgraded.execute(snapshot),new vm.Script(snapshot).runInContext(old.getInternalVMContext()),`ano ${year}`);
    } finally {upgraded.dom.window.close();old.window.close();}
  }
});

test('importações XML de anos diferentes preservam histórico, equipe e pessoa inicial do ciclo',async () => {
  const {dom,window:w}=await setup();
  try {
    const existing=structuredClone(base); existing.ciclosPorAno[2026]={diaSemana:1,fimSemana:2,feriado:3}; existing.feriasPorAno[2026]=existing.ferias;
    const imported=structuredClone(base); imported.anoAtual=2027; imported.funcionarios=[{nome:'Novo registro anterior',registro:'000',telefone:'11999999999',dataInicio:'2027-01-01',dataFim:''},...imported.funcionarios]; imported.ciclos={diaSemana:1,fimSemana:2,feriado:3}; imported.ciclosPorAno={2027:imported.ciclos}; imported.ferias={}; imported.feriasPorAno={2027:{}};
    const merged=w.mesclarConfiguracaoXML(existing,imported); assert.equal(merged.funcionarios.length,6); assert.equal(merged.feriasPorAno[2026]['001'][0].fim,'2026-10-15'); assert.equal(merged.funcionarios[merged.ciclosPorAno[2026].diaSemana].registro,'002'); assert.equal(merged.funcionarios[merged.ciclosPorAno[2027].diaSemana].registro,'001');
  } finally {dom.window.close();}
});

test('recalcular preserva atribuições manuais e sinaliza plantões consecutivos',async () => {
  const state=structuredClone(base); state.ferias={}; state.trocasManuais={'2026-10-20':state.funcionarios[0],'2026-10-21':state.funcionarios[0]};
  const {dom,document:d,execute}=await setup(state);
  try { assert.equal(execute("escalaAtual['2026-10-20'].funcionario.registro"),'001'); assert.equal(execute("escalaAtual['2026-10-21'].funcionario.registro"),'001'); assert.equal(d.getElementById('calendarWarnings').hidden,false); assert.match(d.getElementById('calendarWarnings').textContent,/consecutivo/); } finally {dom.window.close();}
});

test('cores personalizadas são salvas, recuperadas, validadas e preservadas no XML',async()=>{
  const state=structuredClone(base);state.coresDias={'2025-04-01':'outros'};
  const {dom,window:w,document:d,execute}=await setup(state);
  try {
    const day='2026-10-05';const before=execute(`escalaAtual['${day}'].funcionario?.registro`);
    w.abrirDia(day);d.querySelector('input[name=dayColor][value=outros]').checked=true;d.querySelector('.day-card .solid-button').click();
    assert.equal(w.saved.coresDias[day],'outros');assert.equal(w.saved.coresDias['2025-04-01'],'outros');
    assert.equal(d.querySelector(`[data-data="${day}"]`).dataset.cor,'outros');
    assert.equal(execute(`escalaAtual['${day}'].funcionario?.registro`),before,'Cor não altera o rodízio');
    validateState(w.saved);
    const restored=await setup(w.saved);assert.equal(restored.document.querySelector(`[data-data="${day}"]`).dataset.cor,'outros');restored.dom.window.close();
    let content;w.Blob=class{constructor(parts){content=parts.join('');}};w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=()=>{};
    w.exportarConfiguracaoXML();assert.equal(w.lerConfiguracaoXML(content).coresDias[day],'outros');
    w.abrirDia(day);d.querySelector('input[name=dayColor][value=""]').checked=true;d.querySelector('.day-card .solid-button').click();
    assert.equal(w.saved.coresDias[day],undefined);assert.equal(d.querySelector(`[data-data="${day}"]`).dataset.cor,'semana');
    const invalid=structuredClone(w.saved);invalid.coresDias[day]='url(private)';assert.throws(()=>validateState(invalid),/Cor ou data/);
    await new Promise(resolve=>setImmediate(resolve));
  }finally{dom.window.close();}
});

test('os quatro ciclos pintam dias sem responsável e completam as linhas de todos os meses',async()=>{
  const state=structuredClone(base);state.funcionarios=[];state.ferias={};state.anoAtual=2026;state.mesAtualIndex=0;state.feriados={'2026-01-25':'Feriado'};
  const {dom,document:d,execute}=await setup(state);
  try{
    assert.equal(d.querySelector('[data-data="2026-01-01"]').dataset.cor,'outros');
    assert.equal(d.querySelector('[data-data="2026-01-05"]').dataset.cor,'semana');
    assert.equal(d.querySelector('[data-data="2026-01-10"]').dataset.cor,'fimSemana');
    assert.equal(d.querySelector('[data-data="2026-01-25"]').dataset.cor,'feriado');
    for(let month=0;month<12;month++){
      execute(`mesAtualIndex=${month};atualizarCalendario()`);
      const children=[...d.getElementById('calendario').children];
      assert.equal(children.length%7,0);assert.equal(children.filter(el=>el.dataset.data).length,new Date(2026,month+1,0).getDate());
      assert.ok(children.filter(el=>el.classList.contains('calendar-empty')).every(el=>!el.className.includes('h-20')));
    }
    await new Promise(resolve=>setImmediate(resolve));
  }finally{dom.window.close();}
});

test('fim de ano começa antes do Natal e termina no primeiro domingo, inclusive quando é dia 1',async()=>{
  const {dom,execute}=await setup();
  try{
    for(const [day,expected] of [['2023-01-01',true],['2023-01-02',false],['2023-12-17',false],['2023-12-18',true],['2024-01-07',true],['2024-01-08',false],['2026-12-20',false],['2026-12-21',true],['2027-01-03',true],['2027-01-04',false]])assert.equal(execute(`isFimAno('${day}')`),expected,day);
    assert.equal(execute('getPeriodosFimAno(2023).periodo2.fim'),'2024-01-07');
  }finally{dom.window.close();}
});

test('barra lateral retrai, expande e guarda a preferência visual',async()=>{
  const {dom,window:w,document:d}=await setup();
  try{
    const button=d.getElementById('sidebarToggle');assert.equal(button.getAttribute('aria-expanded'),'true');button.click();
    assert.ok(d.body.classList.contains('sidebar-collapsed'));assert.equal(button.getAttribute('aria-expanded'),'false');assert.equal(w.localStorage.getItem('escala-sidebar-collapsed'),'true');
    button.click();assert.equal(button.getAttribute('aria-expanded'),'true');assert.ok(!d.body.classList.contains('sidebar-collapsed'));
  }finally{dom.window.close();}
});

test('XML antigo por índice, datas brasileiras e períodos duplicados é normalizado sem alterar a ordem do rodízio',async () => {
  const {dom,window:w}=await setup();
  try {
    const xml=`<configuracao_escala><funcionarios><funcionario><nome>Primeiro no arquivo</nome><registro>20</registro><telefone></telefone></funcionario><funcionario><nome>Segundo no arquivo</nome><registro>10</registro><telefone>11900000000</telefone></funcionario></funcionarios><ferias><funcionario_ferias index="0"><inicio>01/10/2026</inicio><fim>15/10/2026</fim></funcionario_ferias><funcionario_ferias index="0"><inicio>01/10/2026</inicio><fim>15/10/2026</fim></funcionario_ferias></ferias><ciclos><diaSemanaInicio index="0"/><fimSemanaInicio index="1"/><feriadosInicio index="-1"/></ciclos><ano>2026</ano></configuracao_escala>`;
    const parsed=w.lerConfiguracaoXML(xml); assert.equal(parsed.funcionarios[0].registro,'10'); assert.equal(parsed.ferias['20'].length,1); assert.equal(parsed.ferias['20'][0].inicio,'2026-10-01'); assert.equal(parsed.funcionarios[parsed.ciclos.diaSemana].registro,'20'); assert.equal(parsed.funcionarios[parsed.ciclos.fimSemana].registro,'10');
    assert.throws(() => w.lerConfiguracaoXML(xml.replace('index="0"','index="99"')),/sem funcionário/);
  } finally {dom.window.close();}
});

test('leitura do XML usa FileReader quando File.text e arrayBuffer não estão disponíveis',async () => {
  const {dom,window:w}=await setup();
  try {
    const text='<?xml version="1.0" encoding="UTF-8"?><configuracao_escala><funcionarios/><ano>2026</ano></configuracao_escala>';
    const file=new w.File([text],'escala.xml',{type:'text/xml'});
    const read=await w.lerArquivoXML(file); assert.equal(read,text); assert.equal(w.lerConfiguracaoXML(read).anoAtual,2026);
    assert.match(w.traduzirErroImportacao(new TypeError('Failed to fetch')),/Os dados anteriores foram preservados/);
  } finally {dom.window.close();}
});

test('importação XML percorre confirmação, validação e gravação sem chamar a API local',async () => {
  const {dom,window:w}=await setup();
  try {
    let imported,expected; w.persistencia.revision=7; w.persistencia.request=async () => ({revision:7,state:null}); w.persistencia.importar=async (state,revision) => {imported=state;expected=revision;};
    const xml='<configuracao_escala><funcionarios><funcionario><nome>Teste Importação</nome><registro>1</registro><telefone>11999999999</telefone></funcionario></funcionarios><ano>2026</ano></configuracao_escala>';
    const file=new w.File([xml],'escala.xml',{type:'text/xml'});
    await w.handleFileUpload({target:{files:[file],value:'escala.xml'}}); assert.equal(imported,undefined);
    w.document.getElementById('confirmOkBtn').click(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(imported.funcionarios[0].nome,'Teste Importação'); assert.equal(expected,7);
    w.persistencia.request=async () => {throw new TypeError('Failed to fetch');}; imported=undefined;
    await w.handleFileUpload({target:{files:[file],value:'escala.xml'}}); w.document.getElementById('confirmOkBtn').click(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(imported,undefined); assert.match(w.document.getElementById('alertModalMessage').textContent,/Os dados anteriores foram preservados/);
  } finally {dom.window.close();}
});
