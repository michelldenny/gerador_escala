(() => {
  const toggle=document.getElementById('editorToggle');
  const role=document.getElementById('accountLabel');
  function refresh(){
    const editable=Boolean(window.persistencia?.canEdit);
    document.body.classList.toggle('read-only',!editable);
    toggle.textContent=editable?'Bloquear edição':'Liberar edição';
    if(role)role.textContent=editable?'Edição liberada':'Consulta pública';
    const selectors='#editorStack input,#editorStack select,#editorStack button,#listaFuncionarios button,#listaFerias button,#listaFeriados button,#backupInput,#importXmlInput';
    document.querySelectorAll(selectors).forEach(el=>{
      if(!editable&&!el.disabled){el.dataset.lockedByRole='true';el.disabled=true;}
      else if(editable&&el.dataset.lockedByRole){el.disabled=false;delete el.dataset.lockedByRole;}
    });
    document.querySelectorAll('#calendario [data-data]').forEach(el=>{el.draggable=editable;});
  }
  function open(){
    if(document.getElementById('editorDialog'))return;
    const overlay=document.createElement('div');overlay.id='editorDialog';overlay.className='day-overlay';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Liberar edição');
    const card=document.createElement('form');card.className='day-card';
    const title=document.createElement('h2');title.textContent='Liberar edição';
    const label=document.createElement('label');label.textContent='Senha de edição';label.htmlFor='editorPassword';
    const input=document.createElement('input');input.id='editorPassword';input.type='password';input.autocomplete='current-password';input.required=true;input.maxLength=256;input.style.width='100%';
    const error=document.createElement('p');error.className='editor-error';error.setAttribute('role','alert');
    const actions=document.createElement('div');actions.className='button-row';
    const cancel=document.createElement('button');cancel.type='button';cancel.className='soft-button';cancel.textContent='Cancelar';
    const submit=document.createElement('button');submit.type='submit';submit.className='solid-button';submit.textContent='Liberar';
    const close=()=>{overlay.remove();toggle.focus();};cancel.onclick=close;
    card.onsubmit=async event=>{event.preventDefault();submit.disabled=true;error.textContent='';try{await persistencia.liberar(input.value);input.value='';close();}catch(e){error.textContent=e.message;}finally{submit.disabled=false;}};
    actions.append(cancel,submit);card.append(title,label,input,error,actions);overlay.append(card);document.body.append(overlay);input.focus();
    overlay.onkeydown=event=>{if(event.key==='Escape')close();if(event.key==='Tab'){const items=[input,cancel,submit].filter(el=>!el.disabled);if(event.shiftKey&&document.activeElement===items[0]){event.preventDefault();items.at(-1).focus();}else if(!event.shiftKey&&document.activeElement===items.at(-1)){event.preventDefault();items[0].focus();}}};
  }
  window.atualizarPermissao=refresh;
  window.solicitarEdicao=open;
  toggle.onclick=async()=>{if(!persistencia.canEdit){open();return;}try{await persistencia.bloquear();}catch(e){showAlert(e.message);}};
  const mutations=['adicionarFuncionario','editarFuncionario','removerFuncionario','confirmarDesligamento','adicionarFerias','editarFerias','removerFerias','adicionarFeriado','removerFeriado','atualizarCiclos','handleFileUpload','handleDrop','handleListDrop','limparTrocasManuais'];
  for(const name of mutations){const original=window[name];if(typeof original==='function')window[name]=function(...args){if(!persistencia.canEdit){open();return;}return original.apply(this,args);};}
  const openDay=window.abrirDia;
  window.abrirDia=function(day){openDay(day);if(!persistencia.canEdit){document.querySelectorAll('.day-card input,.day-card select,.day-card .solid-button').forEach(el=>el.disabled=true);}};
  document.addEventListener('click',event=>{const button=event.target.closest('button');if(!button||persistencia.canEdit)return;const action=button.getAttribute('onclick')||'';if(action.includes('backupInput')||action.includes('importXmlInput')){event.preventDefault();event.stopImmediatePropagation();open();}},true);
  const content=document.getElementById('appContent');new MutationObserver(refresh).observe(content,{childList:true,subtree:true});refresh();
})();
