/* The database is authoritative. A failed write stays pending and is never reported as saved. */
window.persistencia = (() => {
  let canEdit=false,revision=0, token='', pending=null, running=null, failed=false, timer;
  const status = (text,kind='') => { const el=document.getElementById('saveStatus'); el.textContent=text; el.dataset.kind=kind; };
  async function request(path, options={}) {
    const response=await fetch(path,{...options,headers:{'Content-Type':'application/json','X-App-Token':token,...options.headers}});
    const body=await response.json();
    if(!response.ok) { const error=new Error(body.error || 'Falha de comunicação.'); error.status=response.status; throw error; }
    return body;
  }
  function connectionError(error) {
    if(error.status===403){canEdit=false;window.atualizarPermissao?.(false);}
    failed=true; status('Alterações não salvas','error');
    document.getElementById('appContent').inert=true;
    const banner=document.getElementById('connectionError'); banner.classList.remove('hidden'); banner.replaceChildren();
    const text=document.createElement('span'); text.textContent=error.status===409 ? error.message : `Não foi possível salvar: ${error.message} Suas alterações continuam nesta aba.`; banner.append(text);
    const download=document.createElement('button'); download.textContent='Baixar alterações pendentes'; download.onclick=() => baixarJSON({format:'escala-backup',schemaVersion:1,state:pending},'escala-pendente.json'); banner.append(download);
    const retry=document.createElement('button'); retry.textContent=error.status===409 ? 'Recarregar dados do banco' : 'Tentar novamente'; retry.onclick=error.status===409 ? () => { if(confirm('As alterações pendentes desta aba serão descartadas. Baixe uma cópia antes de continuar. Recarregar?')) location.reload(); } : () => { failed=false; flush(); }; banner.append(retry);
  }
  async function flush() {
    clearTimeout(timer);
    if(running) { await running; if(pending && !failed) return flush(); return; }
    if(!pending || failed) return;
    const writing=pending; pending=null;
    status('Salvando…','pending');
    running=(async () => {
      try {
        const saved=await request('/api/state',{method:'PUT',body:JSON.stringify({state:writing,revision})}); revision=saved.revision;
        status(`Salvo às ${new Date(saved.updatedAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`,'saved');
        document.getElementById('connectionError').classList.add('hidden'); document.getElementById('appContent').inert=false;
      } catch(error) { pending=pending || writing; connectionError(error); }
    })();
    await running; running=null;
    if(pending && !failed) return flush();
  }
  return {
    async iniciar() {
      const session=await request('/api/session'); token=session.token; canEdit=Boolean(session.canEdit); window.atualizarPermissao?.(canEdit);
      const data=await request('/api/state'); revision=data.revision; window.estadoInicial=data.state;
      status(data.updatedAt ? 'Dados recuperados do banco' : 'Banco conectado','saved');
    },
    salvar(state) { if(!canEdit) return; pending=structuredClone(state); status('Alterações pendentes…','pending'); clearTimeout(timer); timer=setTimeout(flush,180); },
    flush, request,
    get canEdit(){return canEdit;},
    async liberar(password){await request('/api/editor/unlock',{method:'POST',body:JSON.stringify({password})});canEdit=true;window.atualizarPermissao?.(true);if(failed){failed=false;await flush();}},
    async bloquear(){await flush();if(this.pendente)throw new Error('Resolva as alterações pendentes antes de bloquear.');await request('/api/editor/lock',{method:'POST',body:'{}'});canEdit=false;window.atualizarPermissao?.(false);},
    get revision() { return revision; }, get pendente() { return Boolean(pending || running || failed); },
    async importar(state,expectedRevision=revision) { if(!canEdit) throw new Error('Libere a edição com a senha antes de importar.'); await flush(); if(this.pendente) throw new Error('Resolva o salvamento pendente antes de restaurar.'); if(expectedRevision!==revision) throw new Error('Os dados mudaram durante a importação. Selecione o arquivo novamente.'); const saved=await request('/api/state',{method:'PUT',body:JSON.stringify({state,revision,reason:'Importação de arquivo'})}); revision=saved.revision; location.reload(); },
    async restaurar(id) { if(!canEdit) throw new Error('Libere a edição com a senha antes de restaurar.'); await flush(); if(this.pendente) throw new Error('Resolva o salvamento pendente antes de restaurar.'); await request('/api/restore',{method:'POST',body:JSON.stringify({id,revision})}); location.reload(); }
  };
})();
function baixarJSON(data,name) { const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})); const link=document.createElement('a'); link.href=url; link.download=name; link.click(); setTimeout(() => URL.revokeObjectURL(url),1000); }
window.addEventListener('beforeunload',event => { if(window.persistencia.pendente) { event.preventDefault(); event.returnValue=''; } });
