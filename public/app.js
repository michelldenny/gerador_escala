
// === VARIÁVEIS GLOBAIS ===
let funcionarios = [];
let mesAtualIndex = new Date().getMonth();
let anoAtual = 2025;
let escalaAtual = {};
let feriados = {};let ferias = {}; // Ex: { "12345": [{inicio: "...", fim: "..."}, ...], "67890": [...] }

let indiceDiaSemana = 0;
let indiceFinalSemana = 0;
let indiceFeriado = 0;
let registrosInicioCiclo = {};
let inicioCicloPendente = {};

let trocasManuais = {};
let escalaFimAno = {};

// Estados salvos por ano
let escalasPorAno = {};
let trocasPorAno = {};
let fimAnoPorAno = {};
let feriasPorAno = {};
let feriadosPorAno = {};
let ciclosPorAno = {};let alertModal, alertModalTitle, alertModalMessage, closeAlertBtn;
let assignModal, assignModalDate, assignModalFuncionario, assignModalCancelBtn, assignModalOkBtn;
let confirmModal, confirmModalMessage, confirmCancelBtn, confirmOkBtn;
let confirmCallback = null;
let desligamentoModal, desligamentoNome, dataDesligamento, desligamentoCancelBtn, desligamentoOkBtn;
let funcionarioEmDesligamento = null;
let funcionarioEditandoIndex = null;
let feriasEditando = null;

// === INICIALIZAÇÃO ===
window.inicializarEscalas = function() {
    anoAtual = new Date().getFullYear();
    carregarDados();
    if (!Object.keys(feriados).length) feriados = carregarFeriados(anoAtual);
    organizarPainelConfiguracoes();

    preencherSelects();
    atualizarRotuloAnoCiclos();
    atualizarListaFuncionarios();
    
    // Modal de Alerta
    alertModal = document.getElementById('alertModal');
    alertModalTitle = document.getElementById('alertModalTitle');
    alertModalMessage = document.getElementById('alertModalMessage');
    closeAlertBtn = document.getElementById('closeAlertBtn');
    closeAlertBtn.addEventListener('click', () => alertModal.classList.add('hidden'));    // Inicialização do Modal de Confirmação
    confirmModal = document.getElementById('confirmModal');
    confirmModalMessage = document.getElementById('confirmModalMessage');
    confirmCancelBtn = document.getElementById('confirmCancelBtn');
    confirmOkBtn = document.getElementById('confirmOkBtn');

    confirmCancelBtn.addEventListener('click', () => {
        confirmModal.classList.add('hidden');
        if (confirmCallback) confirmCallback(false);
    });

    confirmOkBtn.addEventListener('click', () => {
        confirmModal.classList.add('hidden');
        if (confirmCallback) confirmCallback(true);
    });
    // Inicialização do modal de Atribuição
    assignModal = document.getElementById('assignModal');
    assignModalDate = document.getElementById('assignModalDate');
    assignModalFuncionario = document.getElementById('assignModalFuncionario');
    assignModalCancelBtn = document.getElementById('assignModalCancelBtn');
    assignModalOkBtn = document.getElementById('assignModalOkBtn');
    assignModalCancelBtn.addEventListener('click', () => assignModal.classList.add('hidden'));

    desligamentoModal = document.getElementById('desligamentoModal');
    desligamentoNome = document.getElementById('desligamentoNome');
    dataDesligamento = document.getElementById('dataDesligamento');
    desligamentoCancelBtn = document.getElementById('desligamentoCancelBtn');
    desligamentoOkBtn = document.getElementById('desligamentoOkBtn');
    desligamentoCancelBtn.addEventListener('click', fecharModalDesligamento);
    desligamentoOkBtn.addEventListener('click', confirmarDesligamento);

    gerarEscala();
    atualizarCalendario();
    atualizarListaFeriados();
    atualizarListaFerias();
    document.getElementById('inicioFuncionario').value = formatarDataISO(new Date());
    mostrarTela(funcionarios.length ? 'escala' : 'configuracoes');
};

function mostrarTela(tela) {
    const configuracoes = tela === 'configuracoes';
    document.getElementById('configScreen').classList.toggle('screen-hidden', !configuracoes);
    document.getElementById('escalaScreen').classList.toggle('screen-hidden', configuracoes);
    document.getElementById('tabConfiguracoes').classList.toggle('active', configuracoes);
    document.getElementById('tabEscala').classList.toggle('active', !configuracoes);
}

function organizarPainelConfiguracoes() {
    const overview = document.getElementById('overviewLists');
    const gruposListas = [
        ['.employee-card .list-pane', 'funcionarios'],
        ['.vacation-card .list-pane', 'ferias'],
        ['.holiday-card .list-pane', 'feriados']
    ];
    gruposListas.forEach(([seletor, grupo]) => {
        const painel = document.querySelector(seletor);
        if (painel) {
            painel.dataset.configGroup = grupo;
            overview.appendChild(painel);
        }
    });
    document.querySelector('.employee-card').dataset.configGroup = 'funcionarios';
    document.querySelector('.cycles-card').dataset.configGroup = 'ciclos';
    document.querySelector('.vacation-card').dataset.configGroup = 'ferias';
    document.querySelector('.holiday-card').dataset.configGroup = 'feriados';
    mostrarGrupoConfig('funcionarios');
}

function mostrarGrupoConfig(grupo) {
    document.querySelectorAll('[data-config-group]').forEach(elemento => {
        elemento.classList.toggle('group-hidden', elemento.dataset.configGroup !== grupo);
    });
    document.querySelectorAll('.config-tab').forEach(botao => botao.classList.remove('active'));
    const ids = { funcionarios: 'configTabFuncionarios', ciclos: 'configTabCiclos', ferias: 'configTabFerias', feriados: 'configTabFeriados' };
    document.getElementById(ids[grupo])?.classList.add('active');
    document.getElementById('overviewLists')?.classList.toggle('group-hidden', grupo === 'ciclos');
    document.querySelector('.management-grid')?.classList.toggle('single-panel', grupo === 'ciclos');
}

function abrirGrupo(seletor, focoId) {
    const card = document.querySelector(seletor);
    if (!card) return;
    mostrarGrupoConfig(card.dataset.configGroup);
    requestAnimationFrame(() => {
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (focoId) {
            setTimeout(() => document.getElementById(focoId)?.focus({ preventScroll: true }), 350);
        }
    });
}

function carregarDados() {
    try {
        const salvo = window.estadoInicial;
        if (!salvo) return;
        funcionarios = (salvo.funcionarios || []).map(f => ({ ...f, dataInicio: f.dataInicio || '1900-01-01', dataFim: f.dataFim || '' }));
        ferias = salvo.ferias || {};
        feriados = salvo.feriados || {};
        trocasManuais = salvo.trocasManuais || {};
        escalaFimAno = salvo.escalaFimAno || {};
        feriasPorAno = salvo.feriasPorAno || {};
        feriadosPorAno = salvo.feriadosPorAno || {};
        trocasPorAno = salvo.trocasPorAno || {};
        fimAnoPorAno = salvo.fimAnoPorAno || {};
        ciclosPorAno = salvo.ciclosPorAno || {};
        anoAtual = Number.isInteger(salvo.anoAtual) ? salvo.anoAtual : anoAtual;
        mesAtualIndex = Number.isInteger(salvo.mesAtualIndex) ? salvo.mesAtualIndex : new Date().getMonth();
        // Recupera períodos de versões anteriores sem deixar um mapa anual vazio ocultá-los.
        ferias = combinarFerias(salvo.ferias || {}, feriasPorAno[anoAtual] || {});
        feriasPorAno[anoAtual] = JSON.parse(JSON.stringify(ferias));
        indiceDiaSemana = salvo.ciclos?.diaSemana ?? 0;
        indiceFinalSemana = salvo.ciclos?.fimSemana ?? 0;
        indiceFeriado = salvo.ciclos?.feriado ?? 0;
        if (!ciclosPorAno[anoAtual]) {
            ciclosPorAno[anoAtual] = { diaSemana: indiceDiaSemana, fimSemana: indiceFinalSemana, feriado: indiceFeriado };
        }
    } catch (error) {
        console.warn('Não foi possível recuperar os dados do banco.', error);
    }
}

function combinarFerias(base, anual) {
    const resultado = JSON.parse(JSON.stringify(base || {}));
    Object.entries(anual || {}).forEach(([registro, periodos]) => {
        if (!resultado[registro]) resultado[registro] = [];
        (periodos || []).forEach(periodo => {
            const existe = resultado[registro].some(item => item.inicio === periodo.inicio && item.fim === periodo.fim);
            if (!existe) resultado[registro].push({ inicio: periodo.inicio, fim: periodo.fim });
        });
    });
    return resultado;
}

function salvarDados() {
    feriasPorAno[anoAtual] = JSON.parse(JSON.stringify(ferias));
    feriadosPorAno[anoAtual] = { ...feriados };
    trocasPorAno[anoAtual] = { ...trocasManuais };
    fimAnoPorAno[anoAtual] = { ...escalaFimAno };
    const ciclos = {
        diaSemana: parseInt(document.getElementById('cicloDiaSemanaInicio')?.value) || 0,
        fimSemana: parseInt(document.getElementById('cicloFimSemanaInicio')?.value) || 0,
        feriado: parseInt(document.getElementById('cicloFeriadosInicio')?.value) || 0
    };
    ciclosPorAno[anoAtual] = { ...ciclos };
    window.persistencia.salvar({ funcionarios, ferias, feriados, trocasManuais, escalaFimAno, feriasPorAno, feriadosPorAno, trocasPorAno, fimAnoPorAno, ciclosPorAno, anoAtual, mesAtualIndex, ciclos });
}



function escapeHTML(valor) {
    return String(valor ?? '').replace(/[&<>'"]/g, caractere => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[caractere]));
}

function escapeXML(valor) {
    return String(valor ?? '').replace(/[&<>'"]/g, caractere => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&apos;', '"': '&quot;' }[caractere]));
}

function atualizarCiclos() {
    ciclosPorAno[anoAtual] = {
        diaSemana: parseInt(document.getElementById('cicloDiaSemanaInicio').value) || 0,
        fimSemana: parseInt(document.getElementById('cicloFimSemanaInicio').value) || 0,
        feriado: parseInt(document.getElementById('cicloFeriadosInicio').value) || 0
    };
    gerarEscala();
    atualizarCalendario();
    salvarDados();
}
function showAlert(message, title = 'Alerta') {
    alertModalTitle.textContent = title;
    alertModalMessage.textContent = message;
    alertModal.classList.remove('hidden');
}function showConfirm(message, callback) {
    confirmModalMessage.textContent = message;
    confirmCallback = callback; // Armazena o callback
    confirmModal.classList.remove('hidden');
}
// === GESTÃO DE ESTADO (ANOS) ===

function salvarEstadoAno(ano) {
    escalasPorAno[ano] = { ...escalaAtual };
    trocasPorAno[ano] = { ...trocasManuais };
    fimAnoPorAno[ano] = { ...escalaFimAno };
    feriasPorAno[ano] = JSON.parse(JSON.stringify(ferias)); // Agora usa 'registro'
    feriadosPorAno[ano] = { ...feriados };
    ciclosPorAno[ano] = {
        diaSemana: parseInt(document.getElementById('cicloDiaSemanaInicio').value) || 0,
        fimSemana: parseInt(document.getElementById('cicloFimSemanaInicio').value) || 0,
        feriado: parseInt(document.getElementById('cicloFeriadosInicio').value) || 0
    };
}

function carregarEstadoAno(ano) {
    escalaAtual = escalasPorAno[ano] || {};
    trocasManuais = trocasPorAno[ano] || {};
    escalaFimAno = fimAnoPorAno[ano] || {};
    ferias = feriasPorAno[ano] || {}; // Agora usa 'registro'
    feriados = feriadosPorAno[ano] || carregarFeriados(ano);
    const ciclos = ciclosPorAno[ano] || { diaSemana: 0, fimSemana: 0, feriado: 0 };
    indiceDiaSemana = ciclos.diaSemana;
    indiceFinalSemana = ciclos.fimSemana;
    indiceFeriado = ciclos.feriado;
    document.getElementById('cicloDiaSemanaInicio').value = indiceDiaSemana;
    document.getElementById('cicloFimSemanaInicio').value = indiceFinalSemana;
    document.getElementById('cicloFeriadosInicio').value = indiceFeriado;
    atualizarRotuloAnoCiclos();
}

function atualizarRotuloAnoCiclos() {
    const rotulo = document.getElementById('cicloAnoLabel');
    if (rotulo) rotulo.textContent = `Configuração exclusiva para ${anoAtual}`;
}

// === GESTÃO DE FERIADOS ===





function adicionarFeriado() {
    const data = document.getElementById('dataFeriado').value;
    const nome = document.getElementById('nomeFeriado').value || 'Feriado Personalizado';

    if (!data) {
        showAlert('Selecione uma data para o feriado.');
        return;
    }    const dataObj = new Date(data + 'T00:00:00');
    const anoDaData = dataObj.getFullYear();
    
    if (anoDaData !== anoAtual) {
         showAlert(`A data do feriado deve ser do ano atual (${anoAtual}).`);
         return;
    }

    feriados[data] = nome;
    atualizarListaFeriados();
    gerarEscala();
    atualizarCalendario();

    document.getElementById('dataFeriado').value = '';
    document.getElementById('nomeFeriado').value = '';
    salvarDados();
}

function atualizarListaFeriados() {
    const lista = document.getElementById('listaFeriados');
    lista.innerHTML = '';
    
    const feriadosDoAnoAtual = Object.entries(feriados).filter(([data, nome]) => {        return new Date(data + 'T00:00:00').getFullYear() === anoAtual;
    });
    
    const feriadosOrdenados = feriadosDoAnoAtual.sort();
    feriadosOrdenados.forEach(function([data, nome]) {
        const item = document.createElement('div');
        item.className = 'bg-white p-2 rounded mb-1 text-xs flex justify-between items-center';
        item.innerHTML = `
            <div>
                <div class="font-semibold">${formatarData(data)}</div>
                <div>${escapeHTML(nome)}</div>
            </div>
            <button onclick="removerFeriado(${escapeHTML(JSON.stringify(data))})" class="text-red-500 text-xs flex items-center justify-center p-1 rounded-full hover:bg-red-100">
                <i class="fas fa-trash"></i>
            </button>
        `;
        lista.appendChild(item);
    });
}

function removerFeriado(data) {
    delete feriados[data];
    atualizarListaFeriados();
    gerarEscala();
    atualizarCalendario();
    salvarDados();
}

// === GESTÃO DE FUNCIONÁRIOS ===

function adicionarFuncionario() {
    const nome = document.getElementById('nomeFuncionario').value.trim();
    const registro = document.getElementById('registroFuncionario').value.trim();
    const telefone = document.getElementById('telefoneFuncionario').value.trim();
    const dataInicio = document.getElementById('inicioFuncionario').value;

    if (!nome || !registro || !telefone || !dataInicio) {
        showAlert('Por favor, preencha todos os campos para adicionar um funcionário.');
        return;
    }

    const funcionarioExistente = funcionarios.find((f, index) => f.registro === registro && index !== funcionarioEditandoIndex);
    if (funcionarioExistente) {
        showAlert('Já existe um funcionário com este número de registro.');
        return;
    }

    if (funcionarioEditandoIndex !== null) {
        const anterior = funcionarios[funcionarioEditandoIndex];
        const atualizado = { ...anterior, nome, registro, telefone, dataInicio };
        funcionarios[funcionarioEditandoIndex] = atualizado;
        atualizarReferenciasFuncionario(anterior.registro, atualizado);
        if (anterior.registro !== registro && ferias[anterior.registro]) {
            ferias[registro] = ferias[anterior.registro];
            delete ferias[anterior.registro];
        }
        if (anterior.registro !== registro) {
            Object.values(feriasPorAno).forEach(feriasDoAno => {
                if (!feriasDoAno?.[anterior.registro]) return;
                feriasDoAno[registro] = feriasDoAno[anterior.registro];
                delete feriasDoAno[anterior.registro];
            });
        }
    } else {
        funcionarios.push({ nome, registro, telefone, dataInicio, dataFim: '' });
    }
    
    document.getElementById('nomeFuncionario').value = '';
    document.getElementById('registroFuncionario').value = '';
    document.getElementById('telefoneFuncionario').value = '';
    document.getElementById('inicioFuncionario').value = formatarDataISO(new Date());    funcionarios.sort(compararRegistroFuncional);
    cancelarEdicaoFuncionario(false);
    
    atualizarListaFuncionarios();
    preencherSelects();
    gerarEscala();
    atualizarCalendario();
    salvarDados();
}

function editarFuncionario(index) {
    const func = funcionarios[index];
    if (!func) return;
    funcionarioEditandoIndex = index;
    abrirGrupo('.employee-card', 'nomeFuncionario');
    document.getElementById('nomeFuncionario').value = func.nome;
    document.getElementById('registroFuncionario').value = func.registro;
    document.getElementById('telefoneFuncionario').value = func.telefone;
    document.getElementById('inicioFuncionario').value = func.dataInicio || '1900-01-01';
    const botao = document.getElementById('salvarFuncionarioBtn');
    botao.querySelector('span').textContent = 'Salvar alterações';
    botao.querySelector('i').className = 'fas fa-check mr-1';
    document.getElementById('cancelarEdicaoFuncionarioBtn').classList.remove('hidden');
}

function cancelarEdicaoFuncionario(limpar = true) {
    funcionarioEditandoIndex = null;
    const botao = document.getElementById('salvarFuncionarioBtn');
    botao.querySelector('span').textContent = 'Adicionar funcionário';
    botao.querySelector('i').className = 'fas fa-plus mr-1';
    document.getElementById('cancelarEdicaoFuncionarioBtn').classList.add('hidden');
    if (limpar) {
        document.getElementById('nomeFuncionario').value = '';
        document.getElementById('registroFuncionario').value = '';
        document.getElementById('telefoneFuncionario').value = '';
        document.getElementById('inicioFuncionario').value = formatarDataISO(new Date());
    }
}

function atualizarReferenciasFuncionario(registroAnterior, atualizado) {
    const atualizarColecao = colecao => Object.values(colecao || {}).forEach(item => {
        const funcionario = item?.funcionario || item;
        if (funcionario?.registro === registroAnterior) {
            if (item?.funcionario) item.funcionario = atualizado;
            else Object.assign(item, atualizado);
        }
    });
    atualizarColecao(trocasManuais);
    atualizarColecao(escalaFimAno);
    atualizarColecao(escalaAtual);
    Object.values(trocasPorAno).forEach(atualizarColecao);
    Object.values(fimAnoPorAno).forEach(atualizarColecao);
}

function removerFuncionario(index) {
    const funcionario = funcionarios[index];
    if (!funcionario) return;
    funcionarioEmDesligamento = funcionario;
    desligamentoNome.textContent = funcionario.nome;
    dataDesligamento.min = funcionario.dataInicio || '';
    dataDesligamento.value = funcionario.dataFim || formatarDataISO(new Date());
    desligamentoModal.classList.remove('hidden');
}

function fecharModalDesligamento() {
    desligamentoModal.classList.add('hidden');
    funcionarioEmDesligamento = null;
}

function confirmarDesligamento() {
    if (!funcionarioEmDesligamento || !dataDesligamento.value) {
        showAlert('Informe a data a partir da qual o funcionário não deve ser escalado.');
        return;
    }
    if (dataDesligamento.value <= (funcionarioEmDesligamento.dataInicio || '1900-01-01')) {
        showAlert('A data de desligamento deve ser posterior à data de entrada.');
        return;
    }
    funcionarioEmDesligamento.dataFim = dataDesligamento.value;
    fecharModalDesligamento();
    atualizarListaFuncionarios();
    preencherSelects();
    gerarEscala();
    atualizarCalendario();
    salvarDados();
}

function atualizarListaFuncionarios() {
    const lista = document.getElementById('listaFuncionarios');
    lista.innerHTML = '';
    
    funcionarios.forEach((func, index) => {
        const item = document.createElement('div');
        item.className = 'bg-white p-2 rounded mb-1 text-xs flex justify-between items-center';
        item.setAttribute('draggable', 'false');
        item.setAttribute('data-index', index);
        
        const hoje = formatarDataISO(new Date());
        const status = func.dataFim && hoje >= func.dataFim ? 'inactive' : (func.dataInicio && hoje < func.dataInicio ? 'scheduled' : 'active');
        const statusTexto = status === 'inactive' ? 'Inativo' : (status === 'scheduled' ? 'Entrada agendada' : 'Ativo');
        const periodo = `${func.dataInicio && func.dataInicio !== '1900-01-01' ? 'Desde ' + formatarData(func.dataInicio) : 'Histórico completo'}${func.dataFim ? ' · até ' + formatarData(func.dataFim) : ''}`;
        item.innerHTML = `
            <div>
                <div class="font-semibold">${escapeHTML(func.nome)}</div>
                <div>RF ${escapeHTML(func.registro)}</div>
                <div class="employee-meta">${periodo}</div>
                <span class="status-pill status-${status}">${statusTexto}</span>
            </div>
            <div class="action-row">
                <button onclick="editarFuncionario(${index})" title="Editar funcionário" class="text-blue-600 text-xs p-2 hover:bg-blue-50"><i class="fas fa-pen"></i></button>
                <button onclick="removerFuncionario(${index})" title="Definir data de desligamento" class="text-amber-600 text-xs p-2 hover:bg-amber-50"><i class="fas fa-user-clock"></i></button>
            </div>
        `;
        
        lista.appendChild(item);
    });
    document.getElementById('totalFuncionarios').textContent = `${funcionarios.length} ${funcionarios.length === 1 ? 'pessoa' : 'pessoas'}`;
}

// === PREENCHIMENTO DE SELECTS ===

function preencherSelects() {
    funcionarios.sort(compararRegistroFuncional);
    preencherSelectFuncionarios();
    preencherSelectCiclos();
    preencherSelectMeses();
}



function preencherSelectFuncionarios() {
    const select = document.getElementById('funcionarioFerias');
    select.innerHTML = '<option value="">Selecionar Funcionário</option>';
    funcionarios.forEach((func, index) => {
        const option = document.createElement('option');        option.value = func.registro; 
        option.textContent = func.nome;
        select.appendChild(option);
    });
}

function preencherSelectCiclos() {
    const selectDiaSemana = document.getElementById('cicloDiaSemanaInicio');
    const selectFimSemana = document.getElementById('cicloFimSemanaInicio');
    const selectFeriados = document.getElementById('cicloFeriadosInicio');

    selectDiaSemana.innerHTML = '<option value="">Selecionar Funcionário</option>';
    selectFimSemana.innerHTML = '<option value="">Selecionar Funcionário</option>';
    selectFeriados.innerHTML = '<option value="">Selecionar Funcionário</option>';

    funcionarios.forEach((func, index) => {
        const option1 = document.createElement('option');
        option1.value = index; // Ciclos ainda usam índice, está OK
        option1.textContent = func.nome;
        selectDiaSemana.appendChild(option1);

        const option2 = document.createElement('option');
        option2.value = index;
        option2.textContent = func.nome;
        selectFimSemana.appendChild(option2);

        const option3 = document.createElement('option');
        option3.value = index;
        option3.textContent = func.nome;
        selectFeriados.appendChild(option3);
    });

    selectDiaSemana.value = indiceDiaSemana;
    selectFimSemana.value = indiceFinalSemana;
    selectFeriados.value = indiceFeriado;
}

function preencherSelectMeses() {
    const select = document.getElementById('mesExportar');
    const meses = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    select.innerHTML = '';
    meses.forEach((mes, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${mes} ${anoAtual}`;
        select.appendChild(option);
    });
}

function preencherAssignModalFuncionario(dataStr) {
    assignModalFuncionario.innerHTML = '<option value="">Selecionar Funcionário</option>';
    funcionarios.forEach((func, index) => {
        if (!funcionarioAtivoNaData(func, dataStr) || estaEmFerias(func, dataStr)) return;
        const option = document.createElement('option');
        option.value = index;
        option.textContent = func.nome;
        assignModalFuncionario.appendChild(option);
    });
}

// === GESTÃO DE FÉRIAS (REATORADA) ===

function adicionarFerias() {    const registroFuncionario = document.getElementById('funcionarioFerias').value;
    const inicio = document.getElementById('inicioFerias').value;
    const fim = document.getElementById('fimFerias').value;

    if (!registroFuncionario || !inicio || !fim) {
        showAlert('Preencha todos os campos de férias.');
        return;
    }
    if (fim < inicio) {
        showAlert('A data final das férias não pode ser anterior à data inicial.');
        return;
    }
    const conflito = (ferias[registroFuncionario] || []).some((periodo, index) => {
        const sendoEditado = feriasEditando && feriasEditando.registro === registroFuncionario && feriasEditando.index === index;
        return !sendoEditado && inicio <= periodo.fim && fim >= periodo.inicio;
    });
    if (conflito) {
        showAlert('Este período se sobrepõe a férias já cadastradas para o funcionário.');
        return;
    }
    const funcionario = funcionarios.find(f => f.registro === registroFuncionario);
    if (!funcionarioAtivoNaData(funcionario, inicio) || !funcionarioAtivoNaData(funcionario, fim)) {
        showAlert('O período de férias deve estar dentro da vigência do funcionário.');
        return;
    }    if (!ferias[registroFuncionario]) {
        ferias[registroFuncionario] = [];
    }

    if (feriasEditando) {
        const origem = feriasEditando;
        if (origem.registro !== registroFuncionario) {
            ferias[origem.registro].splice(origem.index, 1);
            if (!ferias[origem.registro].length) delete ferias[origem.registro];
            ferias[registroFuncionario].push({ inicio, fim });
        } else {
            ferias[registroFuncionario][origem.index] = { inicio, fim };
        }
    } else {
        ferias[registroFuncionario].push({inicio, fim});
    }
    atualizarListaFerias();
    gerarEscala();
    atualizarCalendario();

    document.getElementById('funcionarioFerias').value = '';
    document.getElementById('inicioFerias').value = '';
    document.getElementById('fimFerias').value = '';
    cancelarEdicaoFerias(false);
    salvarDados();
}

function editarFerias(registro, index) {
    const periodo = ferias[registro]?.[index];
    if (!periodo) return;
    feriasEditando = { registro, index };
    abrirGrupo('.vacation-card', 'funcionarioFerias');
    document.getElementById('funcionarioFerias').value = registro;
    document.getElementById('inicioFerias').value = periodo.inicio;
    document.getElementById('fimFerias').value = periodo.fim;
    const botao = document.getElementById('salvarFeriasBtn');
    botao.querySelector('span').textContent = 'Salvar alterações';
    botao.querySelector('i').className = 'fas fa-check mr-1';
    document.getElementById('cancelarEdicaoFeriasBtn').classList.remove('hidden');
}

function cancelarEdicaoFerias(limpar = true) {
    feriasEditando = null;
    const botao = document.getElementById('salvarFeriasBtn');
    botao.querySelector('span').textContent = 'Adicionar férias';
    botao.querySelector('i').className = 'fas fa-plus mr-1';
    document.getElementById('cancelarEdicaoFeriasBtn').classList.add('hidden');
    if (limpar) {
        document.getElementById('funcionarioFerias').value = '';
        document.getElementById('inicioFerias').value = '';
        document.getElementById('fimFerias').value = '';
    }
}

function atualizarListaFerias() {
    const lista = document.getElementById('listaFerias');
    lista.innerHTML = '';    for (const [registro, periodos] of Object.entries(ferias)) {
        const funcionario = funcionarios.find(f => f.registro === registro);
        if (funcionario) {
            periodos.forEach((periodo, index) => {
                const item = document.createElement('div');
                item.className = 'bg-white p-2 rounded mb-1 text-xs';
                item.innerHTML = `
                    <div class="font-semibold">${escapeHTML(funcionario.nome)}</div>
                    <div>${formatarData(periodo.inicio)} - ${formatarData(periodo.fim)}</div>
                    <div class="action-row mt-2">
                        <button onclick="editarFerias(${escapeHTML(JSON.stringify(registro))}, ${index})" class="text-blue-600 text-xs p-1"><i class="fas fa-pen mr-1"></i>Editar</button>
                        <button onclick="removerFerias(${escapeHTML(JSON.stringify(registro))}, ${index})" class="text-red-500 text-xs p-1"><i class="fas fa-trash mr-1"></i>Remover</button>
                    </div>
                `;
                lista.appendChild(item);
            });
        }
    }
    const total = Object.values(ferias).reduce((soma, periodos) => soma + periodos.length, 0);
    document.getElementById('totalFerias').textContent = `${total} ${total === 1 ? 'período' : 'períodos'}`;
}

function removerFerias(registro, periodoIndex) {    ferias[registro].splice(periodoIndex, 1);
    if (ferias[registro].length === 0) {
        delete ferias[registro];
    }
    atualizarListaFerias();
    gerarEscala();
    atualizarCalendario();
    if (feriasEditando?.registro === registro && feriasEditando?.index === periodoIndex) cancelarEdicaoFerias();
    salvarDados();
}



// === GERAÇÃO DA ESCALA ===







// === GESTÃO DE FIM DE ANO ===







function showAssignModal(dataStr) {
    assignModalDate.textContent = `Atribuir plantão para: ${formatarData(dataStr)}`;
    preencherAssignModalFuncionario(dataStr);
    assignModal.classList.remove('hidden');

    assignModalOkBtn.onclick = () => {
        const funcionarioIndex = assignModalFuncionario.value;
        if (funcionarioIndex === "") {
            delete escalaFimAno[dataStr];
        } else {
            const funcionario = funcionarios[funcionarioIndex];
            escalaFimAno[dataStr] = { funcionario, data: new Date(dataStr) };
        }
        assignModal.classList.add('hidden');
        gerarEscala();
        atualizarCalendario();
        salvarDados();
    }
}

function toggleFeriado(dataStr) {
    if (feriados[dataStr]) {
        delete feriados[dataStr];
    } else {
        feriados[dataStr] = "Feriado";
    }
    atualizarListaFeriados();
    gerarEscala();
    atualizarCalendario();
    salvarDados();
}

// === ATUALIZAÇÃO DO CALENDÁRIO (UI) ===

function atualizarCalendario() {
    queueMicrotask(() => window.atualizarResumo?.());
    const calendario = document.getElementById('calendario');
    const mesAtualEl = document.getElementById('mesAtual');
    
    const meses = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    
    mesAtualEl.textContent = `${meses[mesAtualIndex]} ${anoAtual}`;
    
    calendario.innerHTML = '';
    
    const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    diasSemana.forEach(dia => {
        const headerDiv = document.createElement('div');
        headerDiv.className = 'text-center font-bold p-2 bg-gray-200';
        headerDiv.textContent = dia;
        calendario.appendChild(headerDiv);
    });
    
    const primeiroDia = new Date(anoAtual, mesAtualIndex, 1);
    const primeiroDiaSemana = primeiroDia.getDay();
    
    for (let i = 0; i < primeiroDiaSemana; i++) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'p-2 border border-gray-200 h-20 md:h-24';
        calendario.appendChild(emptyDiv);
    }
    
    const diasNoMes = new Date(anoAtual, mesAtualIndex + 1, 0).getDate();
    
    for (let dia = 1; dia <= diasNoMes; dia++) {
        const data = new Date(anoAtual, mesAtualIndex, dia);
        const dataStr = formatarDataISO(data);
        const escala = escalaAtual[dataStr];
        
        const diaDiv = document.createElement('div');
        diaDiv.className = 'p-2 h-20 md:h-24 border cursor-pointer transition-all hover:bg-gray-50 flex flex-col justify-between items-start calendar-day-content';
        diaDiv.draggable = true;
        diaDiv.dataset.data = dataStr;
        
        let corFundo = 'bg-white';
        const funcionario = escala?.funcionario;

        if (funcionario) {            if (estaEmFerias(funcionario, dataStr)) {
                corFundo = 'bg-gray-200 border-gray-400';
            } else if (isFimAno(dataStr)) {
                 if (escalaFimAno[dataStr]) {
                     corFundo = 'bg-purple-200 border-purple-400';
                 } else {
                     corFundo = 'bg-green-100 border-green-300';
                 }
            } else if (feriados[dataStr]) {
                corFundo = 'bg-red-100 border-red-300';
            } else if (escala.tipo === 'fimSemana') {
                corFundo = 'bg-green-100 border-green-300';
            } else {
                corFundo = 'bg-blue-100 border-blue-300';
            }
        }
        
        diaDiv.className += ` ${corFundo}`;
        
        let conteudo = `<div class="font-bold text-sm mb-1">${dia}</div>`;
        
        if (isFimAno(dataStr) && escalaFimAno[dataStr]) {
            conteudo = `<div class="font-bold text-sm mb-1">${dia}</div>`;
            conteudo += `<div class="text-xs font-semibold">
                            <span class="sm:hidden fiscal-name-mobile">${escapeHTML(escalaFimAno[dataStr].funcionario.nome.split(' ')[0])}</span>
                            <span class="hidden sm:inline">${escapeHTML(escalaFimAno[dataStr].funcionario.nome)}</span>
                         </div>`;
            conteudo += `<div class="text-xs text-gray-600 hidden sm:block">RF ${escapeHTML(escalaFimAno[dataStr].funcionario.registro)}</div>`; 
        } else if (funcionario) {
            const primeiroNome = funcionario.nome.split(' ')[0];            if (estaEmFerias(funcionario, dataStr)) {
                conteudo += `<div class="text-xs text-gray-500 font-semibold">${escapeHTML(primeiroNome)} (FÉRIAS)</div>`;
            } else {
                conteudo += `<div class="text-xs font-semibold">
                             <span class="sm:hidden fiscal-name-mobile">${escapeHTML(primeiroNome)}</span>
                                <span class="hidden sm:inline">${escapeHTML(funcionario.nome)}</span>
                             </div>`;
                conteudo += `<div class="text-xs text-gray-600 hidden sm:block">RF ${escapeHTML(funcionario.registro)}</div>`;
            }
        }
        
        if (feriados[dataStr]) {
            conteudo += `<div class="text-xs text-red-600 font-bold hidden sm:block">${escapeHTML(feriados[dataStr])}</div>`;
        }

        if (isFimAno(dataStr)) {
             conteudo += `<div class="text-xs text-purple-600 font-bold hidden sm:block">Fim de Ano</div>`;
        }


        if (!funcionario) conteudo += '<span class="unassigned">Sem responsável</span>';
        if (dataStr === formatarDataISO(new Date())) diaDiv.classList.add('today');
        diaDiv.innerHTML = conteudo;
        
        diaDiv.addEventListener('dragstart', handleDragStart);
        diaDiv.addEventListener('dragover', handleDragOver);
        diaDiv.addEventListener('drop', handleDrop);

        diaDiv.setAttribute('tabindex', '0');
        diaDiv.setAttribute('role', 'button');
        diaDiv.setAttribute('aria-label', `${formatarData(dataStr)}: ${funcionario?.nome || 'Sem responsável'}`);
        diaDiv.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); diaDiv.click(); } });
        diaDiv.addEventListener('click', () => {
            if (window.abrirDia) { window.abrirDia(dataStr); return; } 
            if (isFimAno(dataStr)) {
                showAssignModal(dataStr);
            } else {
                toggleFeriado(dataStr);
            }
        });
        
        calendario.appendChild(diaDiv);
    }
}

// === DRAG AND DROP ===

let draggedElement = null;
let draggedItem = null; // Para a lista de funcionáriosfunction handleDragStart(e) {
    const target = e.target.closest('[draggable="true"]');
    
    // Verifica se é um item da lista ou do calendário
    if (target.dataset.index) { // Item da lista
        draggedItem = target;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', draggedItem.dataset.index);
    } else if (target.dataset.data) { // Item do calendário
        draggedElement = target;
        e.dataTransfer.setData('text/plain', e.target.dataset.data);
        e.target.style.opacity = '0.5';
    }
}

function handleDragOver(e) {
    e.preventDefault();
    const target = e.target.closest('[draggable="true"][data-index]'); // Alvo é item da lista
    if (target && draggedItem && draggedItem !== target) {
        const targetRect = target.getBoundingClientRect();
        const isAfter = e.clientY > targetRect.top + targetRect.height / 2;
        if (isAfter) {
            target.style.borderBottom = '2px solid #667eea';
            target.style.borderTop = '';
        } else {
            target.style.borderTop = '2px solid #667eea';
            target.style.borderBottom = '';
        }
    }
}

function handleDragEnter(e) {
    e.preventDefault();
    const target = e.target.closest('[draggable="true"][data-index]');
    if (target) {
        target.classList.add('drag-target');
    }
}

function handleDragLeave(e) {
    const target = e.target.closest('[draggable="true"][data-index]');
    if (target) {
        target.classList.remove('drag-target');
        target.style.borderTop = '';
        target.style.borderBottom = '';
    }
}

function handleListDrop(e) {
    e.preventDefault();
    const targetElement = e.target.closest('[draggable="true"][data-index]');
    
    if (draggedItem && draggedItem !== targetElement) {
        const fromIndex = parseInt(draggedItem.dataset.index);
        const toIndex = targetElement ? parseInt(targetElement.dataset.index) : -1;
        
        if (toIndex !== -1 && fromIndex !== toIndex) {
            const [removed] = funcionarios.splice(fromIndex, 1);
            funcionarios.splice(toIndex, 0, removed);
            
            atualizarListaFuncionarios();
            preencherSelects();
            atualizarRotuloAnoCiclos();
            gerarEscala();
            atualizarCalendario();
            salvarDados();
        }
    }

    if (draggedItem) {
        draggedItem.style.opacity = '1';
        // Limpa bordas de todos os itens
        document.querySelectorAll('#listaFuncionarios [draggable="true"]').forEach(el => {
            el.style.borderTop = '';
            el.style.borderBottom = '';
            el.classList.remove('drag-target');
        });
        draggedItem = null;
    }
}

// Listeners do container da lista
document.getElementById('listaFuncionarios').addEventListener('dragover', (e) => {
    e.preventDefault();
});

document.getElementById('listaFuncionarios').addEventListener('dragleave', (e) => {
    // Se sair do container, limpa as bordas
    if (e.target.id === 'listaFuncionarios') {
         document.querySelectorAll('#listaFuncionarios [draggable="true"]').forEach(el => {
            el.style.borderTop = '';
            el.style.borderBottom = '';
        });
    }
});

document.getElementById('listaFuncionarios').addEventListener('drop', (e) => {
    e.preventDefault();
    // Se soltar no container (mas não em um item), trata como soltar no final
    if (e.target.id === 'listaFuncionarios' && draggedItem) {
        const fromIndex = parseInt(draggedItem.dataset.index);
        const [removed] = funcionarios.splice(fromIndex, 1);
        funcionarios.push(removed); // Adiciona ao final

        atualizarListaFuncionarios();
        preencherSelects();
        gerarEscala();
        atualizarCalendario();
        salvarDados();

        draggedItem.style.opacity = '1';
        draggedItem = null;
    } else {
        handleListDrop(e); // Deixa a função normal tratar
    }
});

// Função de Drop do Calendário
function handleDrop(e) {
    e.preventDefault();
    
    if (draggedElement && draggedElement !== e.target) {
        const dataOrigem = draggedElement.dataset.data;
        const dataDestino = e.target.closest('[data-data]')?.dataset.data;
        
        if (dataOrigem && dataDestino && escalaAtual[dataOrigem] && escalaAtual[dataDestino]) {
            // Não permite troca com dias de férias
            const funcOrigem = escalaAtual[dataOrigem].funcionario;
            const funcDestino = escalaAtual[dataDestino].funcionario;
            
            if (funcOrigem && estaEmFerias(funcOrigem, dataDestino)) {
                showAlert(`${funcOrigem.nome} estará de férias no dia ${formatarData(dataDestino)}.`);
            } else if (funcDestino && estaEmFerias(funcDestino, dataOrigem)) {
                showAlert(`${funcDestino.nome} estará de férias no dia ${formatarData(dataOrigem)}.`);
            } else if ((!funcOrigem || funcionarioAtivoNaData(funcOrigem, dataDestino)) && (!funcDestino || funcionarioAtivoNaData(funcDestino, dataOrigem))) {
                // Troca manual
                escalaAtual[dataOrigem].funcionario = funcDestino;
                escalaAtual[dataDestino].funcionario = funcOrigem;
                
                trocasManuais[dataOrigem] = funcDestino;
                trocasManuais[dataDestino] = funcOrigem;

                atualizarCalendario();
                salvarDados();
            } else {
                showAlert('A troca não é possível porque um dos funcionários não estava ativo na data de destino.');
            }
        }
    }
    
    if (draggedElement) {
        draggedElement.style.opacity = '1';
        draggedElement = null;
    }
}

function limparTrocasManuais() {
    trocasManuais = {};
}

// === NAVEGAÇÃO DE DATAS ===

function mesAnterior() {
    salvarEstadoAno(anoAtual);
    mesAtualIndex = (mesAtualIndex - 1 + 12) % 12;
    if (mesAtualIndex === 11) {
        anoAtual--;
        carregarEstadoAno(anoAtual);
    }
    gerarEscala();
    atualizarCalendario();
    preencherSelectMeses();
    atualizarListaFeriados();
    salvarDados();
}

function proximoMes() {
    salvarEstadoAno(anoAtual);
    mesAtualIndex = (mesAtualIndex + 1) % 12;
    if (mesAtualIndex === 0) {
        anoAtual++;
        carregarEstadoAno(anoAtual);
    }
    gerarEscala();
    atualizarCalendario();
    preencherSelectMeses();
    atualizarListaFeriados();
    salvarDados();
}

function anoAnterior() {
    salvarEstadoAno(anoAtual);
    anoAtual--;
    carregarEstadoAno(anoAtual);
    gerarEscala();
    atualizarCalendario();
    preencherSelectMeses();
    atualizarListaFeriados();
    salvarDados();
}

function proximoAno() {
    salvarEstadoAno(anoAtual);
    anoAtual++;
    carregarEstadoAno(anoAtual);
    gerarEscala();
    atualizarCalendario();
    preencherSelectMeses();
    atualizarListaFeriados();
    salvarDados();
}

// === FUNÇÕES UTILITÁRIAS DE DATA ===

function formatarData(dataStr) {
    const data = new Date(dataStr + 'T00:00:00'); // Garante fuso horário local
    return data.toLocaleDateString('pt-BR');
}

function formatarDataISO(data) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

function formatarDataExterna(data) {
    const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
    return data.toLocaleDateString('pt-BR', options);
}

// === EXPORTAÇÃO ===











// === IMPORTAÇÃO / EXPORTAÇÃO XML ===



