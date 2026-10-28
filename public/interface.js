const originalMostrarTela=mostrarTela;
mostrarTela=function(tela) {
  originalMostrarTela(tela);
  document.getElementById('documentsScreen').classList.toggle('screen-hidden',tela!=='documentos');
  if(tela==='documentos' || tela==='dashboard') document.getElementById('escalaScreen').classList.add('screen-hidden');
  document.getElementById('dashboardScreen').classList.toggle('screen-hidden',tela!=='dashboard');
  document.querySelectorAll('.side-link').forEach(el => el.classList.remove('active'));
  document.getElementById({escala:'tabEscala',configuracoes:'tabConfiguracoes',documentos:'tabDocumentos',dashboard:'tabDashboard'}[tela]).classList.add('active');
  const titles={escala:['Escala de plantões','Clique no dia para marcar feriado; no nome, para editar o plantão.'],configuracoes:['Equipe e regras','Pessoas, períodos e critérios para uma escala bem organizada.'],documentos:['Documentos e backups','Exporte a escala, proteja seus dados e consulte versões anteriores.'],dashboard:['Dashboard','Acompanhe a distribuição anual de plantões por funcionário e por ciclo.']};
  document.getElementById('pageTitle').textContent=titles[tela][0]; document.getElementById('pageDescription').textContent=titles[tela][1];
  if(tela==='dashboard')atualizarDashboard();
  if(tela==='documentos') carregarHistorico();
};
window.atualizarResumo=function() {
  const start=`${anoAtual}-${String(mesAtualIndex+1).padStart(2,'0')}-01`, end=formatarDataISO(new Date(anoAtual,mesAtualIndex+1,0));
  const shifts=Object.entries(escalaAtual).filter(([day]) => day>=start && day<=end);
  atualizarDashboard();
  let warnings=document.getElementById('calendarWarnings');
  if(!warnings) { warnings=document.createElement('p'); warnings.id='calendarWarnings'; warnings.className='calendar-warning'; warnings.setAttribute('role','status'); document.querySelector('.calendar-hint').after(warnings); }
  const consecutive=shifts.filter(([day,shift]) => { const previous=new Date(day+'T12:00:00'); previous.setDate(previous.getDate()-1); return shift.funcionario && escalaAtual[formatarDataISO(previous)]?.funcionario?.registro===shift.funcionario.registro; });
  const unavailable=shifts.filter(([day,shift]) => shift.funcionario && (!funcionarioAtivoNaData(shift.funcionario,day) || estaEmFerias(shift.funcionario,day)));
  warnings.hidden=!consecutive.length && !unavailable.length;
  warnings.textContent=[consecutive.length ? `${consecutive.length} plantão(ões) consecutivo(s) para revisar` : '',unavailable.length ? `${unavailable.length} atribuição(ões) fora da disponibilidade` : ''].filter(Boolean).join(' · ')+'. As atribuições manuais foram mantidas.';
};

function obterResumoAnual() {
  const inicio=`${anoAtual}-01-01`,fim=`${anoAtual}-12-31`;
  const rows=funcionarios.map(funcionario=>({funcionario,semana:0,fimSemana:0,feriado:0,fimDeAno:0,total:0}));
  const byRecord=new Map(rows.map(row=>[row.funcionario.registro,row]));
  const totais={semana:0,fimSemana:0,feriado:0,fimDeAno:0,total:0};
  for(const [day,shift] of Object.entries(escalaAtual)){
    if(day<inicio || day>fim || !shift.funcionario)continue;
    const row=byRecord.get(shift.funcionario.registro);if(!row)continue;
    const tipo=shift.tipo;if(!Object.hasOwn(totais,tipo) || tipo==='total')continue;
    row[tipo]++;row.total++;totais[tipo]++;totais.total++;
  }
  const ativos=funcionarios.filter(f=>(f.dataInicio || '1900-01-01')<=fim && (!f.dataFim || f.dataFim>inicio)).length;
  return {ano:anoAtual,totalDias:(Date.UTC(anoAtual+1,0,1)-Date.UTC(anoAtual,0,1))/86400000,ativos,media:ativos?totais.total/ativos:0,rows,totais};
}
function atualizarDashboard() {
  const data=obterResumoAnual();
  document.getElementById('metricDays').textContent=data.totalDias.toLocaleString('pt-BR');
  document.getElementById('metricTeam').textContent=data.ativos.toLocaleString('pt-BR');
  document.getElementById('metricAverage').textContent=data.media.toLocaleString('pt-BR',{maximumFractionDigits:1});
  document.getElementById('metricShifts').textContent=data.totais.total.toLocaleString('pt-BR');
  document.getElementById('dashboardPeriod').textContent=`Período: Ano ${data.ano}`;
  document.getElementById('dashboardYear').textContent=data.ano;
  const body=document.getElementById('dashboardRows');body.replaceChildren();
  function addRow(values,{total=false}={}){
    const tr=document.createElement('tr');if(total)tr.className='dashboard-total';
    for(const value of values){const td=document.createElement('td');td.textContent=value;tr.append(td);}
    (total?document.getElementById('dashboardTotals'):body).append(tr);return tr;
  }
  for(const row of data.rows){
    const percentage=data.totais.total?row.total/data.totais.total*100:0;
    const tr=addRow([row.funcionario.nome,formatarRF(row.funcionario.registro),row.semana,row.fimSemana,row.feriado,row.fimDeAno,row.total,`${percentage.toLocaleString('pt-BR',{maximumFractionDigits:1})}%`]);
    tr.dataset.registro=row.funcionario.registro;
    const bar=document.createElement('span');bar.className='proportion-bar';bar.setAttribute('aria-hidden','true');
    const fill=document.createElement('span');fill.style.width=`${percentage}%`;bar.append(fill);tr.lastChild.append(bar);
  }
  if(!data.rows.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=8;td.className='dashboard-empty';td.textContent='Cadastre funcionários para acompanhar a distribuição dos plantões.';tr.append(td);body.append(tr);}
  document.getElementById('dashboardTotals').replaceChildren();
  if(data.rows.length)addRow(['Total','',data.totais.semana,data.totais.fimSemana,data.totais.feriado,data.totais.fimDeAno,data.totais.total,data.totais.total?'100%':'0%'],{total:true});
  document.getElementById('dashboardNote').textContent=`${data.totalDias-data.totais.total} dia(s) sem responsável no ano. A proporção considera os plantões atribuídos; cores personalizadas não alteram a contagem dos ciclos.`;
}
function irParaHoje() { salvarEstadoAno(anoAtual); anoAtual=new Date().getFullYear(); mesAtualIndex=new Date().getMonth(); carregarEstadoAno(anoAtual); preencherSelects(); gerarEscala(); atualizarCalendario(); atualizarListaFeriados(); atualizarListaFerias(); salvarDados(); }
async function baixarBackup() { try { await persistencia.flush(); if(persistencia.pendente) throw new Error('Há alterações pendentes. Resolva o salvamento antes de baixar o backup do banco.'); const data=await persistencia.request('/api/backup'); baixarJSON(data,`escala-backup-${formatarDataISO(new Date())}.json`); } catch(error) { showAlert(error.message,'Backup'); } }
async function carregarHistorico() {
  const list=document.getElementById('versionList'); list.textContent='Carregando versões…';
  try {
    await persistencia.flush(); const {versions}=await persistencia.request('/api/history'); list.replaceChildren();
    if(!versions.length) { list.textContent='As versões aparecerão após o primeiro salvamento.'; return; }
    versions.forEach(version => {
      const row=document.createElement('div'); row.className='version-row';
      const label=document.createElement('div'); const title=document.createElement('strong'); title.textContent=`Versão ${version.id}`; const subtitle=document.createElement('small'); subtitle.textContent=`${new Date(version.createdAt).toLocaleString('pt-BR')} · ${version.reason}`; label.append(title,subtitle);
      const button=document.createElement('button'); button.className='text-action'; button.textContent=version.id===persistencia.revision ? 'Atual' : 'Restaurar'; button.disabled=version.id===persistencia.revision;
      button.onclick=() => {if(persistencia.canEdit===false){window.solicitarEdicao?.();return;}showConfirm(`Restaurar a versão ${version.id}? O estado atual continuará disponível no histórico.`,async ok => { if(ok) try { await persistencia.restaurar(version.id); } catch(error) { showAlert(error.message); } });};
      row.append(label,button); list.append(row);
    });
  } catch(error) { list.textContent=error.message; }
}
window.abrirDia=function(day) {
  const shift=escalaAtual[day];
  const overlay=document.createElement('div'); overlay.className='day-overlay'; overlay.setAttribute('role','dialog'); overlay.setAttribute('aria-modal','true'); overlay.setAttribute('aria-label',`Plantão de ${formatarData(day)}`);
  const card=document.createElement('div'); card.className='day-card';
  const title=document.createElement('h2'); title.textContent=new Date(day+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'});
  const label=document.createElement('label'); label.textContent='Responsável pelo plantão'; label.htmlFor='dayEmployee';
  const select=document.createElement('select'); select.id='dayEmployee';
  const empty=document.createElement('option'); empty.value=''; empty.textContent='Sem responsável'; select.append(empty);
  funcionarios.filter(f => funcionarioAtivoNaData(f,day) && !estaEmFerias(f,day)).forEach(f => { const option=document.createElement('option'); option.value=f.registro; option.textContent=`${f.nome} · RF ${formatarRF(f.registro)}`; select.append(option); });
  select.value=shift?.funcionario?.registro || '';
  const note=document.createElement('p'); note.className='hint'; note.textContent='A lista inclui pessoas ativas e disponíveis nesta data. Alterações manuais ficam registradas na escala.';
  const holidayLabel=document.createElement('label'); holidayLabel.className='holiday-checkbox'; const checkbox=document.createElement('input'); checkbox.type='checkbox'; checkbox.checked=Boolean(feriados[day]); holidayLabel.append(checkbox,document.createTextNode(' Considerar este dia um feriado'));
  const holidayName=document.createElement('input'); holidayName.type='text'; holidayName.maxLength=300; holidayName.setAttribute('aria-label','Nome do feriado'); holidayName.placeholder='Nome do feriado'; holidayName.value=feriados[day] || ''; holidayName.hidden=!checkbox.checked; checkbox.onchange=() => { holidayName.hidden=!checkbox.checked; };
  const colors=document.createElement('fieldset');colors.className='day-colors';
  const legend=document.createElement('legend');legend.textContent='Cor deste dia';colors.append(legend);
  for(const [value,text] of [['','Automática, conforme o ciclo'],['fimSemana','Verde · Final de semana'],['feriado','Vermelho · Feriado'],['semana','Azul · Segunda a sexta'],['outros','Roxo · Outros / Fim de ano']]){
    const option=document.createElement('label');option.className='color-choice';
    const radio=document.createElement('input');radio.type='radio';radio.name='dayColor';radio.value=value;radio.checked=value===(coresDias[day] || '');
    const swatch=document.createElement('span');swatch.className='color-swatch';swatch.dataset.cor=value || obterCorAutomatica(day);swatch.setAttribute('aria-hidden','true');
    option.append(radio,swatch,document.createTextNode(text));colors.append(option);
  }
  const colorNote=document.createElement('p');colorNote.className='hint';colorNote.textContent='A cor personaliza o calendário. O ciclo e o responsável continuam definidos pelas regras acima.';
  const actions=document.createElement('div'); actions.className='button-row'; const cancel=document.createElement('button'); cancel.className='soft-button'; cancel.textContent='Cancelar'; const save=document.createElement('button'); save.className='solid-button'; save.textContent='Salvar alterações';
  const previous=document.activeElement; const close=() => { overlay.remove(); previous?.focus(); }; cancel.onclick=close;
  save.onclick=() => {
    if(window.persistencia?.canEdit===false)return;
    definirFeriado(day,checkbox.checked?(holidayName.value.trim() || 'Feriado'):null);
    const employee=funcionarios.find(f => f.registro===select.value) || null;
    const chosen=colors.querySelector('input:checked').value;
    if(chosen)coresDias[day]=chosen;else delete coresDias[day];
    // Reclassifying a day recalculates its automatic assignment; only an explicit selection pins it.
    if(select.value !== (shift?.funcionario?.registro || '')) {
      if(isFimAno(day)) { if(employee) escalaFimAno[day]={funcionario:employee,data:day}; else delete escalaFimAno[day]; }
      else trocasManuais[day]=employee;
    }
    gerarEscala(); atualizarCalendario(); atualizarListaFeriados(); salvarDados(); close();
  };
  actions.append(cancel,save); card.append(title,label,select,note,holidayLabel,holidayName,colors,colorNote,actions); overlay.append(card); document.body.append(overlay); select.focus();
  overlay.addEventListener('keydown',event => { if(event.key==='Escape') close(); if(event.key==='Tab') { const focusable=[...card.querySelectorAll('button,select,input')].filter(el => !el.hidden && !el.disabled); const first=focusable[0], last=focusable.at(-1); if(event.shiftKey && document.activeElement===first) { event.preventDefault(); last.focus(); } else if(!event.shiftKey && document.activeElement===last) { event.preventDefault(); first.focus(); } } });
};

(() => {
  const toggle=document.getElementById('sidebarToggle'),sidebar=document.getElementById('sidebar'),shade=document.getElementById('sidebarShade');
  const preference='escala-sidebar-collapsed';
  function setCollapsed(collapsed){
    document.body.classList.toggle('sidebar-collapsed',collapsed);
    toggle.setAttribute('aria-expanded',String(!collapsed));toggle.setAttribute('aria-label',collapsed?'Expandir menu lateral':'Recolher menu lateral');toggle.title=toggle.getAttribute('aria-label');
    const mobile=window.matchMedia?.('(max-width:850px)').matches;
    sidebar.inert=Boolean(collapsed && mobile);shade.hidden=collapsed || !mobile;
  }
  let saved=null;try{saved=localStorage.getItem(preference);}catch{}
  setCollapsed(saved===null?Boolean(window.matchMedia?.('(max-width:850px)').matches):saved==='true');
  toggle.onclick=()=>{const collapsed=!document.body.classList.contains('sidebar-collapsed');setCollapsed(collapsed);try{localStorage.setItem(preference,String(collapsed));}catch{}};
  const closeMobile=()=>{if(window.matchMedia?.('(max-width:850px)').matches){setCollapsed(true);toggle.focus();}};
  shade.onclick=closeMobile;sidebar.querySelectorAll('.side-link').forEach(button=>button.addEventListener('click',closeMobile));
  document.addEventListener('keydown',event=>{if(event.key==='Escape' && !document.body.classList.contains('sidebar-collapsed'))closeMobile();});
  window.addEventListener('resize',()=>setCollapsed(document.body.classList.contains('sidebar-collapsed')));
})();
document.addEventListener('DOMContentLoaded',async () => {
  try {
    await persistencia.iniciar(); inicializarEscalas(); atualizarResumo(); document.getElementById('appContent').inert=false;
    document.getElementById('backupInput').addEventListener('change',async event => {
      const file=event.target.files[0]; event.target.value=''; if(!file) return;
      try { if(file.size>5_000_000) throw new Error('O backup deve ter até 5 MB.'); const backup=JSON.parse(await file.text()); if(backup.format!=='escala-backup' || backup.schemaVersion!==1 || !backup.state) throw new Error('Arquivo de backup incompatível.');
        showConfirm('Restaurar este backup completo? Os dados atuais serão preservados no histórico.',async ok => { if(ok) try { await persistencia.importar(backup.state); } catch(error) { showAlert(error.message,'Restauração'); } });
      } catch(error) { showAlert(error.message,'Backup inválido'); }
    });
  } catch(error) {
    const banner=document.getElementById('connectionError'); banner.classList.remove('hidden'); banner.textContent=`Não foi possível abrir o banco de dados. ${error.message}`;
    const retry=document.createElement('button'); retry.textContent='Tentar novamente'; retry.onclick=() => location.reload(); banner.append(retry); document.getElementById('saveStatus').textContent='Banco indisponível';
  }
});

