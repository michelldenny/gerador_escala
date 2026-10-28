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
  dom.window.HTMLElement.prototype.scrollIntoView=()=>{};
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
    assert.equal(d.getElementById('metricTeam').textContent,'5');
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
  try { assert.equal(d.querySelectorAll('#listaFuncionarios img').length,0); assert.equal(d.querySelectorAll('#listaFerias unsafe').length,0); const button=d.querySelector('#listaFerias button'); assert.doesNotThrow(() => button.click()); assert.equal(d.getElementById('funcionarioFerias').value,state.funcionarios[0].registro); } finally {dom.window.close();}
});

test('migração XML lê arquivos legados sem alterar o estado antes de validar',async () => {
  const {dom,window:w,execute}=await setup();
  try {
    const xml=`<?xml version="1.0"?><configuracao_escala><funcionarios><funcionario><nome>Ana &amp; Maria</nome><registro>42</registro><telefone>11999999999</telefone><data_inicio>2025-01-01</data_inicio></funcionario></funcionarios><ferias><funcionario_ferias registro="42"><inicio>2026-10-01</inicio><fim>2026-10-15</fim></funcionario_ferias></ferias><feriados><feriado data="2026-10-12">Teste</feriado></feriados><ano>2026</ano><trocas_manuais><troca data="2026-10-20" registro_funcionario="42"/></trocas_manuais></configuracao_escala>`;
    const state=w.lerConfiguracaoXML(xml); assert.equal(state.funcionarios[0].nome,'Ana & Maria'); assert.equal(state.trocasManuais['2026-10-20'].registro,'42'); assert.equal(state.feriasPorAno[2026]['42'][0].fim,'2026-10-15');
    assert.throws(() => w.lerConfiguracaoXML('<wrong/>')); assert.equal(execute('funcionarios.length'),5); assert.equal(w.saved,null);
  } finally {dom.window.close();}
});

test('regressão: rodízio base dos ciclos preserva o HTML original antes das correções de consecutivos',async () => {
  const originalHtml=readFileSync(new URL('../reference/original.html',import.meta.url),'utf8');
  let original=originalHtml.slice(originalHtml.lastIndexOf('<script>')+8,originalHtml.lastIndexOf('</script>'));
  original=original.replace("document.addEventListener('DOMContentLoaded', function() {",'window.inicializarEscalas = function() {').replace(/(mostrarTela\(funcionarios.length \? 'escala' : 'configuracoes'\);\s*)\}\);/,'$1};');
  for(const year of [2024,2026,2027]) {
    const state=structuredClone(base); state.anoAtual=year; state.ferias={'001':[{inicio:`${year}-10-01`,fim:`${year}-10-15`}]}; state.funcionarios.forEach(f => f.dataInicio=`${year}-01-01`); state.funcionarios[4].dataInicio=`${year}-05-01`; state.funcionarios[3].dataFim=`${year}-11-01`; state.escalaFimAno[`${year}-12-25`]={funcionario:state.funcionarios[1],data:`${year}-12-25`};
    const upgraded=await setup(state); const old=new JSDOM(originalHtml,{runScripts:'outside-only',url:'http://localhost/',pretendToBeVisual:true}); await new Promise(resolve => old.window.addEventListener('load',resolve));
    try {
      old.window.localStorage.setItem('escala-defesa-civil-v2',JSON.stringify(state)); new vm.Script(original).runInContext(old.getInternalVMContext()); old.window.inicializarEscalas();
      // The old conflict repair reordered holidays; the base rotation must still match.
      upgraded.execute('validarPlantõesConsecutivos=()=>{};gerarEscala()');
      new vm.Script('validarPlantõesConsecutivos=()=>{};gerarEscala()').runInContext(old.getInternalVMContext());
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

test('clique no quadrado alterna feriado e clique no nome abre somente a edição',async()=>{
  const state=structuredClone(base);state.ferias={};state.coresDias={'2026-10-05':'outros'};
  const {dom,window:w,document:d,execute}=await setup(state);
  try{
    const day='2026-10-05',cell=()=>d.querySelector(`[data-data="${day}"]`);
    let draggedDate;w.handleDragStart({target:cell().querySelector('.day-employee'),dataTransfer:{setData(type,value){draggedDate=value;}}});assert.equal(draggedDate,day);
    cell().click();assert.equal(w.saved.feriados[day],'Feriado');assert.equal(cell().dataset.cor,'feriado');assert.equal(d.querySelector('.day-overlay'),null);
    const revision=JSON.stringify(w.saved);cell().querySelector('.day-employee').click();
    assert.ok(d.querySelector('.day-overlay'));assert.equal(JSON.stringify(w.saved),revision,'Nome não marca/desmarca feriado');
    d.querySelector('.day-card .soft-button').click();
    cell().querySelector('.day-toggle').click();assert.equal(w.saved.feriados[day],undefined);assert.equal(cell().dataset.cor,'semana');
    execute("escalaAtual['2026-10-05'].funcionario=null;atualizarCalendario()");cell().querySelector('.day-employee').click();
    assert.ok(d.querySelector('.day-overlay'),'Sem responsável também permite abrir a atribuição');
    await new Promise(resolve=>setImmediate(resolve));
  }finally{dom.window.close();}
});

test('marcar feriado troca a atribuição manual pelo ciclo correto e persiste ao reabrir',async()=>{
  for(const [day,originalType,restoredRecord] of [['2026-01-05','semana','001'],['2026-01-10','fimSemana','002']]){
    const state=structuredClone(base);state.ferias={};state.mesAtualIndex=0;state.feriados={'2026-12-25':'Natal'};state.ciclos={diaSemana:0,fimSemana:1,feriado:2};
    state.trocasManuais={[day]:state.funcionarios[3],'2026-01-20':state.funcionarios[4]};state.trocasPorAno={2026:structuredClone(state.trocasManuais)};
    const {dom,window:w,document:d,execute}=await setup(state);
    try{
      assert.equal(execute(`escalaAtual['${day}'].funcionario.registro`),'004');
      d.querySelector(`[data-data="${day}"] .day-toggle`).click();
      assert.equal(execute(`escalaAtual['${day}'].tipo`),'feriado');assert.equal(execute(`escalaAtual['${day}'].funcionario.registro`),'003');
      assert.equal(w.saved.trocasManuais[day],undefined);assert.equal(w.saved.trocasPorAno[2026][day],undefined);assert.equal(w.saved.trocasManuais['2026-01-20'].registro,'005');
      const reopened=await setup(w.saved);assert.equal(reopened.execute(`escalaAtual['${day}'].funcionario.registro`),'003');reopened.dom.window.close();
      d.querySelector(`[data-data="${day}"] .day-toggle`).click();assert.equal(execute(`escalaAtual['${day}'].tipo`),originalType);assert.equal(execute(`escalaAtual['${day}'].funcionario.registro`),restoredRecord);
      await new Promise(resolve=>setImmediate(resolve));
    }finally{dom.window.close();}
  }
});

test('popup e cadastro de feriados também aplicam o ciclo ao alterar a classificação',async()=>{
  const state=structuredClone(base);state.ferias={};state.mesAtualIndex=0;state.feriados={'2026-12-25':'Natal'};state.ciclos={diaSemana:0,fimSemana:1,feriado:2};state.trocasManuais={'2026-01-05':state.funcionarios[3]};
  const {dom,window:w,document:d,execute}=await setup(state);
  try{
    w.abrirDia('2026-01-05');d.querySelector('.holiday-checkbox input').checked=true;d.querySelector('.day-card .solid-button').click();
    assert.equal(execute("escalaAtual['2026-01-05'].funcionario.registro"),'003');assert.equal(w.saved.trocasManuais['2026-01-05'],undefined);
    w.removerFeriado('2026-01-05');assert.equal(execute("escalaAtual['2026-01-05'].funcionario.registro"),'001');
    execute("trocasManuais['2026-01-05']=funcionarios[3]");d.getElementById('dataFeriado').value='2026-01-05';d.getElementById('nomeFeriado').value='Feriado de teste';w.adicionarFeriado();
    assert.equal(execute("escalaAtual['2026-01-05'].tipo"),'feriado');assert.equal(execute("escalaAtual['2026-01-05'].funcionario.registro"),'003');
    await new Promise(resolve=>setImmediate(resolve));
  }finally{dom.window.close();}
});

test('inserir 12/11 desloca toda a fila futura de feriados, incluindo atribuições importadas',async()=>{
  const state=structuredClone(base);state.ferias={};state.mesAtualIndex=10;
  state.funcionarios[0].nome='Drailton';state.funcionarios[1].nome='Gabriel';
  state.feriados={'2026-11-02':'Finados','2026-11-20':'Consciência Negra','2026-11-25':'Feriado A','2026-11-30':'Feriado B'};
  state.trocasManuais=Object.fromEntries(['2026-11-02','2026-11-20','2026-11-25','2026-11-30'].map((day,index)=>[day,state.funcionarios[index]]));
  state.trocasManuais['2026-11-13']=state.funcionarios[4];state.trocasPorAno={2026:structuredClone(state.trocasManuais),2027:{'2027-04-21':state.funcionarios[1]}};
  const {dom,window:w,document:d,execute}=await setup(state);
  const assigned=day=>execute(`escalaAtual['${day}'].funcionario?.registro`);
  try{
    assert.equal(assigned('2026-11-02'),'001');assert.equal(assigned('2026-11-20'),'002');
    d.querySelector('[data-data="2026-11-12"] .day-toggle').click();
    for(const [day,record] of [['2026-11-02','001'],['2026-11-12','002'],['2026-11-20','003'],['2026-11-25','004'],['2026-11-30','005']])assert.equal(assigned(day),record,day);
    assert.equal(w.saved.trocasManuais['2026-11-02'].registro,'001');assert.equal(w.saved.trocasManuais['2026-11-20'],undefined);assert.equal(w.saved.trocasPorAno[2026]['2026-11-30'],undefined);
    assert.equal(w.saved.trocasManuais['2026-11-13'].registro,'005');assert.equal(w.saved.trocasPorAno[2027]['2027-04-21'].registro,'002');
    const reopened=await setup(w.saved);assert.equal(reopened.execute("escalaAtual['2026-11-12'].funcionario.registro"),'002');assert.equal(reopened.execute("escalaAtual['2026-11-20'].funcionario.registro"),'003');reopened.dom.window.close();
    d.querySelector('[data-data="2026-11-12"] .day-toggle').click();
    for(const [day,record] of [['2026-11-02','001'],['2026-11-20','002'],['2026-11-25','003'],['2026-11-30','004']])assert.equal(assigned(day),record,`remover: ${day}`);
    await new Promise(resolve=>setImmediate(resolve));
  }finally{dom.window.close();}
});

test('a fila continua após o último feriado manual e não é reordenada para evitar consecutivos',async()=>{
  const state=structuredClone(base);state.ferias={};state.mesAtualIndex=10;state.feriados={'2026-11-02':'Finados','2026-11-20':'Consciência Negra'};
  state.trocasManuais={'2026-11-02':state.funcionarios[2],'2026-11-03':state.funcionarios[2],'2026-11-11':state.funcionarios[3]};
  const {dom,window:w,execute}=await setup(state);
  try{
    w.toggleFeriado('2026-11-12');
    assert.equal(execute("escalaAtual['2026-11-02'].funcionario.registro"),'003');
    assert.equal(execute("escalaAtual['2026-11-12'].funcionario.registro"),'004');
    assert.equal(execute("escalaAtual['2026-11-20'].funcionario.registro"),'005');
    assert.equal(execute("escalaAtual['2026-11-11'].funcionario.registro"),'004');
    assert.equal(execute("escalaAtual['2026-11-12'].tipo"),'feriado');
    await new Promise(resolve=>setImmediate(resolve));
  }finally{dom.window.close();}
});

test('dashboard anual reúne os cards e conta cada ciclo sem considerar a cor personalizada',async()=>{
  const state=structuredClone(base);state.anoAtual=2024;state.ferias={};state.funcionarios=state.funcionarios.slice(0,3);state.funcionarios.forEach(f=>f.dataInicio='2023-01-01');state.funcionarios[1].dataFim='2024-06-01';state.funcionarios[2].dataInicio='2025-01-01';
  const {dom,window:w,document:d,execute}=await setup(state);
  try{
    execute(`escalaAtual={
      '2024-01-02':{funcionario:funcionarios[0],tipo:'semana'},
      '2024-01-06':{funcionario:funcionarios[0],tipo:'fimSemana'},
      '2024-01-25':{funcionario:funcionarios[1],tipo:'feriado'},
      '2024-12-25':{funcionario:funcionarios[0],tipo:'fimDeAno'},
      '2024-12-26':{funcionario:null,tipo:'fimDeAno'},
      '2025-01-02':{funcionario:funcionarios[0],tipo:'semana'}
    };coresDias={'2024-01-02':'outros'};`);
    w.mostrarTela('dashboard');
    assert.equal(d.getElementById('escalaScreen').classList.contains('screen-hidden'),true);
    assert.equal(d.getElementById('dashboardScreen').classList.contains('screen-hidden'),false);
    assert.ok(d.querySelector('#dashboardScreen .metrics'));assert.equal(d.querySelector('#escalaScreen .metrics'),null);
    assert.equal(d.getElementById('metricDays').textContent,'366');assert.equal(d.getElementById('metricTeam').textContent,'2');
    assert.equal(d.getElementById('metricAverage').textContent,'2');assert.equal(d.getElementById('metricShifts').textContent,'4');
    assert.equal(d.querySelectorAll('#dashboardRows tr').length,3);
    const cells=[...d.querySelector('#dashboardRows tr[data-registro="001"]').cells].map(cell=>cell.textContent);
    assert.deepEqual(cells.slice(2),['1','1','0','1','3','75%']);
    assert.match(d.getElementById('dashboardNote').textContent,/362 dia/);
    w.proximoAno();await new Promise(resolve=>setImmediate(resolve));assert.equal(d.getElementById('dashboardYear').textContent,'2025');
    w.mostrarTela('escala');assert.ok(d.getElementById('dashboardScreen').classList.contains('screen-hidden'));assert.ok(!d.getElementById('escalaScreen').classList.contains('screen-hidden'));
  }finally{dom.window.close();}
});

test('dashboard sem funcionários mostra totais zerados sem divisão inválida',async()=>{
  const state=structuredClone(base);state.funcionarios=[];state.ferias={};
  const {dom,window:w,document:d}=await setup(state);
  try{
    w.mostrarTela('dashboard');assert.equal(d.getElementById('metricDays').textContent,'365');assert.equal(d.getElementById('metricTeam').textContent,'0');
    assert.equal(d.getElementById('metricAverage').textContent,'0');assert.equal(d.getElementById('metricShifts').textContent,'0');
    assert.match(d.getElementById('dashboardRows').textContent,/Cadastre funcionários/);assert.ok(!d.getElementById('dashboardScreen').textContent.includes('NaN'));
  }finally{dom.window.close();}
});

test('tabela de servidores mantém telefone, vigência, edição e desligamento sem apagar histórico',async()=>{
  const state=structuredClone(base);state.funcionarios[0].dataInicio='1900-01-01';
  const {dom,window:w,document:d}=await setup(state);
  try{
    assert.deepEqual([...d.querySelectorAll('.employee-table th')].map(el=>el.textContent),['Nome','RF','Telefone','Vigência','Status','Ações']);
    const row=d.querySelector('#listaFuncionarios tr');assert.equal(row.cells[0].textContent,'Pessoa 1');assert.equal(row.cells[2].textContent,state.funcionarios[0].telefone);assert.equal(row.cells[3].textContent,'Histórico');
    row.querySelector('button').click();assert.equal(d.getElementById('nomeFuncionario').value,'Pessoa 1');
    row.querySelectorAll('button')[1].click();assert.ok(!d.getElementById('desligamentoModal').classList.contains('hidden'));
    const hoje=w.formatarDataISO(new Date());d.getElementById('dataDesligamento').value=hoje;w.confirmarDesligamento();
    assert.equal(w.saved.funcionarios.length,5);assert.equal(w.saved.funcionarios[0].dataFim,hoje);assert.match(d.querySelector('#listaFuncionarios tr').textContent,/Inativo/);
    assert.match(d.getElementById('totalFuncionarios').textContent,/5 servidores/);await new Promise(resolve=>setImmediate(resolve));
  }finally{dom.window.close();}
});

test('tabela de feriados ordena e filtra o ano, classifica a lista padrão e remove o dia escolhido',async()=>{
  const state=structuredClone(base);state.feriados={'2026-12-25':'Natal','2026-01-25':'Aniversário de São Paulo','2026-02-17':'Carnaval','2026-07-07':'Feriado da equipe','2025-12-25':'Natal antigo'};
  const {dom,window:w,document:d}=await setup(state);
  try{
    const rows=[...d.querySelectorAll('#listaFeriados tr')];assert.equal(rows.length,4);assert.equal(rows[0].cells[0].textContent,'2026-01-25');
    assert.equal(rows[0].cells[2].textContent,'Municipal');assert.equal(rows[1].cells[2].textContent,'Móvel');assert.equal(rows[2].cells[2].textContent,'Personalizado');assert.equal(rows[3].cells[2].textContent,'Nacional');
    assert.equal(w.classificarFeriado('2026-11-20','Dia da Consciência Negra').tipo,'national');
    assert.equal(w.classificarFeriado('2026-12-25','Evento da equipe').tipo,'custom');
    rows[2].querySelector('button').click();assert.equal(w.saved.feriados['2026-07-07'],undefined);assert.equal(w.saved.feriados['2025-12-25'],'Natal antigo');
    assert.equal(d.getElementById('totalFeriados').textContent,'3 dias cadastrados');
    w.proximoAno();assert.match(d.getElementById('tituloFeriados').textContent,/2027/);await new Promise(resolve=>setImmediate(resolve));
  }finally{dom.window.close();}
});

test('tabela de férias conta dias inclusivos em ano bissexto e mantém edição e remoção por registro',async()=>{
  const state=structuredClone(base);state.funcionarios.forEach(f=>f.dataInicio='1900-01-01');state.ferias={'001':[{inicio:'2024-02-28',fim:'2024-03-01'}]};
  const {dom,window:w,document:d}=await setup(state);
  try{
    assert.deepEqual([...d.querySelectorAll('.vacation-table th')].map(el=>el.textContent),['Funcionário','RF','Início','Fim','Dias','Situação','Ações']);
    d.getElementById('anoFerias').value='2024';w.atualizarListaFerias();const row=d.querySelector('#listaFerias tr');assert.equal(row.cells[0].textContent,'Pessoa 1');assert.equal(row.cells[1].textContent,'000.000-1');assert.equal(row.cells[4].textContent,'3 dias');
    row.querySelector('button').click();assert.equal(d.getElementById('funcionarioFerias').value,'001');assert.equal(d.getElementById('inicioFerias').value,'2024-02-28');
    row.querySelectorAll('button')[1].click();assert.equal(w.saved.ferias['001'],undefined);assert.equal(d.getElementById('totalFerias').textContent,'0 períodos');
    assert.equal(d.querySelector('#listaFerias tr td').colSpan,7);await new Promise(resolve=>setImmediate(resolve));
  }finally{dom.window.close();}
});

test('listas vazias preservam linhas válidas nas tabelas e mostram totais zerados',async()=>{
  const state=structuredClone(base);state.funcionarios=[];state.ferias={};
  const {dom,document:d,execute}=await setup(state);
  try{
    execute('feriados={};atualizarListaFeriados();atualizarResumo()');
    for(const [id,columns] of [['listaFuncionarios',6],['listaFerias',7],['listaFeriados',4]]){const body=d.getElementById(id);assert.equal(body.tagName,'TBODY');assert.equal(body.children.length,1);assert.equal(body.firstElementChild.tagName,'TR');assert.equal(body.querySelector('td').colSpan,columns);assert.equal(body.querySelector('p'),null);}
    assert.equal(d.getElementById('totalFeriados').textContent,'0 dias cadastrados');
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

test('configuração dos três ciclos preserva os primeiros plantões após corrigir consecutivos',async()=>{
  for(const year of [2026,2027,2028]) {
    const state=structuredClone(base);state.anoAtual=year;state.ferias={};
    state.feriados={[`${year}-01-06`]:'Teste'};
    state.ciclos={diaSemana:0,fimSemana:3,feriado:2};
    const {dom,execute,document:d,window:w}=await setup(state);
    try {
      for(const index of [0,2,4,1]) {
        d.getElementById('cicloDiaSemanaInicio').value=index;
        d.getElementById('cicloFimSemanaInicio').value=(index+3)%5;
        d.getElementById('cicloFeriadosInicio').value=(index+2)%5;
        execute('atualizarCiclos()');
        for(const tipo of ['semana','fimSemana','feriado']) {
          assert.equal(execute(`Object.values(escalaAtual).find(s=>s.tipo==='${tipo}').funcionario.registro`),state.funcionarios[tipo==='semana'?index:tipo==='fimSemana'?(index+3)%5:(index+2)%5].registro,`${year} ${tipo} início ${index}`);
        }
        assert.equal(w.saved.ciclos.diaSemana,index);
        await new Promise(resolve=>setTimeout(resolve,0));
      }
    } finally {dom.window.close();}
  }
});


test('reabrir prioriza os ciclos salvos para o ano atual',async()=>{
  const state=structuredClone(base);state.ferias={};
  state.ciclosPorAno[2026]={diaSemana:4,fimSemana:2,feriado:1};
  const {dom,document:d}=await setup(state);
  try {
    assert.equal(d.getElementById('cicloDiaSemanaInicio').value,'4');
    assert.equal(d.getElementById('cicloFimSemanaInicio').value,'2');
    assert.equal(d.getElementById('cicloFeriadosInicio').value,'1');
    await new Promise(resolve=>setTimeout(resolve,0));
  } finally {dom.window.close();}
});

test('férias separadas pelo início preservam virada do ano, edição e exclusão',async()=>{
 const state=structuredClone(base);state.ferias={'001':[{inicio:'2026-12-20',fim:'2027-01-15'},{inicio:'2027-07-01',fim:'2027-07-20'}]};
 state.feriasPorAno={2025:{'002':[{inicio:'2025-11-01',fim:'2025-11-10'}]}};
 const {dom,window:w,document:d,execute}=await setup(state);
 try {
  assert.equal(d.querySelectorAll('#listaFerias tr[data-registro]').length,1);
  d.getElementById('anoFerias').value='2027';w.atualizarListaFerias();
  assert.match(d.getElementById('listaFerias').textContent,/01\/07\/2027/);
  assert.doesNotMatch(d.getElementById('listaFerias').textContent,/20\/12\/2026/);
  assert.equal(execute("estaEmFerias(funcionarios[0],'2027-01-10')"),true);
  d.querySelector('#listaFerias button').click();assert.equal(d.getElementById('inicioFerias').value,'2027-07-01');
  w.removerFerias('001',1);assert.equal(w.saved.feriasPorAno[2027],undefined);assert.equal(w.saved.feriasPorAno[2025]['002'].length,1);
  const reopened=await setup(w.saved);try{assert.equal(reopened.execute("ferias['001'].length"),1);}finally{reopened.dom.window.close();}
 } finally {dom.window.close();}
});
test('mês final acompanha início e seletor dos ciclos guarda configurações por ano',async()=>{
 const {dom,window:w,document:d}=await setup();
 try {
  d.getElementById('inicioFerias').value='2027-08-20';w.sincronizarFimFerias();assert.equal(d.getElementById('fimFerias').value,'2027-08-20');
  d.getElementById('fimFerias').value='2027-08-30';w.sincronizarFimFerias();assert.equal(d.getElementById('fimFerias').value,'2027-08-30');
  w.selecionarAnoCiclos('2027');d.getElementById('cicloDiaSemanaInicio').value='3';w.atualizarCiclos();
  w.selecionarAnoCiclos('2026');assert.equal(d.getElementById('cicloDiaSemanaInicio').value,'0');
  w.selecionarAnoCiclos('2027');assert.equal(d.getElementById('cicloDiaSemanaInicio').value,'3');assert.equal(d.getElementById('anoCiclos').value,'2027');
  assert.equal(w.formatarRF('1234567'),'123.456-7');assert.equal(w.formatarRF('123.456-7'),'123.456-7');
  await new Promise(resolve=>setTimeout(resolve,0));
 } finally {dom.window.close();}
});
