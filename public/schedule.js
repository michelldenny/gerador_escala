function funcionarioAtivoNaData(funcionario, dataStr) {
    if (!funcionario) return false;
    const inicio = funcionario.dataInicio || '1900-01-01';
    const fim = funcionario.dataFim || '';
    return dataStr >= inicio && (!fim || dataStr < fim);
}

function calcularFeriadosMoveis(ano) {
    const a = ano % 19;
    const b = Math.floor(ano / 100);
    const c = ano % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const L = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * L) / 451);
    const mesPascoa = Math.floor((h + L - 7 * m + 114) / 31);
    const diaPascoa = ((h + L - 7 * m + 114) % 31) + 1;

    const pascoa = new Date(ano, mesPascoa - 1, diaPascoa);
    
    const sextaSanta = new Date(pascoa);
    sextaSanta.setDate(pascoa.getDate() - 2);

    const carnaval = new Date(pascoa);
    carnaval.setDate(pascoa.getDate() - 47);

    const corpusChristi = new Date(pascoa);
    corpusChristi.setDate(pascoa.getDate() + 60);

    return {
        [formatarDataISO(carnaval)]: "Carnaval",
        [formatarDataISO(sextaSanta)]: "Sexta-feira Santa",
        [formatarDataISO(corpusChristi)]: "Corpus Christi"
    };
}

function carregarFeriados(ano) {
    let feriadosDoAno = {
        [`${ano}-01-01`]: "Confraternização Universal",
        [`${ano}-04-21`]: "Tiradentes",
        [`${ano}-05-01`]: "Dia do Trabalho",
        [`${ano}-09-07`]: "Independência do Brasil",
        [`${ano}-10-12`]: "Nossa Senhora Aparecida",
        [`${ano}-11-02`]: "Finados",
        [`${ano}-11-15`]: "Proclamação da República",
        [`${ano}-12-25`]: "Natal",
        [`${ano}-01-25`]: "Aniversário de São Paulo",
        [`${ano}-11-20`]: "Consciência Negra"
    };

    Object.assign(feriadosDoAno, calcularFeriadosMoveis(ano));
    
    return feriadosDoAno;
}

function compararRegistroFuncional(a, b) {
    const registroA = String(a.registro || '').replace(/\D/g, '');
    const registroB = String(b.registro || '').replace(/\D/g, '');
    return registroA.localeCompare(registroB, 'pt-BR', { numeric: true, sensitivity: 'base' });
}

function estaEmFerias(funcionario, data) {    if (!funcionario || !ferias[funcionario.registro]) {
         return false;
    }
    
    const dataComparacao = new Date(data + 'T00:00:00');
    return ferias[funcionario.registro].some(periodo => {
        const inicio = new Date(periodo.inicio + 'T00:00:00');
        const fim = new Date(periodo.fim + 'T00:00:00');
        return dataComparacao >= inicio && dataComparacao <= fim;
    });
}

function obterProximoFuncionario(tipo, data) {
    const elegiveis = funcionarios.filter(funcionario => funcionarioAtivoNaData(funcionario, data));
    if (elegiveis.length === 0) {
        return null;
    }

    let indice, tentativas = 0;
    
    if (tipo === 'semana') {
        indice = indiceDiaSemana;
    } else if (tipo === 'fimSemana') {
        indice = indiceFinalSemana;
    } else {
        indice = indiceFeriado;
    }
    if (inicioCicloPendente[tipo]) {
        const indiceSelecionado = elegiveis.findIndex(funcionario => funcionario.registro === registrosInicioCiclo[tipo]);
        if (indiceSelecionado >= 0) indice = indiceSelecionado;
        inicioCicloPendente[tipo] = false;
    }
    
    indice = indice % elegiveis.length;
    while (tentativas < elegiveis.length) {
        const funcionario = elegiveis[indice];        if (funcionario && !estaEmFerias(funcionario, data)) {
            if (tipo === 'semana') {
                indiceDiaSemana = (indice + 1) % elegiveis.length;
            } else if (tipo === 'fimSemana') {
                indiceFinalSemana = (indice + 1) % elegiveis.length;
            } else {
                indiceFeriado = (indice + 1) % elegiveis.length;
            }
            return funcionario; // Retorna o objeto funcionário
        }
        indice = (indice + 1) % elegiveis.length;
        tentativas++;
    }
    
    // Fallback: retorna o primeiro funcionário que não esteja de férias
    const primeiroValido = elegiveis.find(f => !estaEmFerias(f, data));
    return primeiroValido || null; // Retorna nulo se todos estiverem de férias
}

function gerarEscala() {
    if (funcionarios.length === 0) {
        escalaAtual = {};
        return;
    }

    const inicioDiaSemana = parseInt(document.getElementById('cicloDiaSemanaInicio').value) || 0;
    const inicioFinalSemana = parseInt(document.getElementById('cicloFimSemanaInicio').value) || 0;
    const inicioFeriado = parseInt(document.getElementById('cicloFeriadosInicio').value) || 0;
    registrosInicioCiclo = {
        semana: funcionarios[inicioDiaSemana]?.registro,
        fimSemana: funcionarios[inicioFinalSemana]?.registro,
        feriado: funcionarios[inicioFeriado]?.registro
    };
    inicioCicloPendente = { semana: true, fimSemana: true, feriado: true };
    indiceDiaSemana = inicioDiaSemana;
    indiceFinalSemana = inicioFinalSemana;
    indiceFeriado = inicioFeriado;

    escalaAtual = {};
    
    for (let mes = 0; mes < 12; mes++) {
        const diasNoMes = new Date(anoAtual, mes + 1, 0).getDate();
        
        for (let dia = 1; dia <= diasNoMes; dia++) {
            const data = new Date(anoAtual, mes, dia);
            const dataStr = formatarDataISO(data);
            const diaSemana = data.getDay();
            
            let funcionario;
            let tipo;

            if (isFimAno(dataStr)) {
                 if (escalaFimAno[dataStr]) {
                     funcionario = escalaFimAno[dataStr].funcionario;
                     tipo = 'fimDeAno';
                 } else {
                    tipo = 'fimDeAno';
                    funcionario = null;
                 }
            }
            else if (feriados[dataStr]) {
                tipo = 'feriado';
                funcionario = obterProximoFuncionario('feriado', dataStr);
            }
            else if (diaSemana === 0 || diaSemana === 6) {
                tipo = 'fimSemana';
                funcionario = obterProximoFuncionario('fimSemana', dataStr);
            }
            else {
                tipo = 'semana';
                funcionario = obterProximoFuncionario('semana', dataStr);
            }
            
            escalaAtual[dataStr] = {
                funcionario: funcionario, // Agora é o objeto completo
                tipo: tipo,
                data: data
            };
        }
    }
    
    for (const data in trocasManuais) {
        if (escalaAtual[data]) {
            escalaAtual[data].funcionario = trocasManuais[data];
        }
    }

    validarPlantõesConsecutivos();
    // Mantém os pontos iniciais escolhidos; os índices de cálculo são temporários.
    indiceDiaSemana = inicioDiaSemana;
    indiceFinalSemana = inicioFinalSemana;
    indiceFeriado = inicioFeriado;
}

function validarPlantõesConsecutivos() {
    const datas = Object.keys(escalaAtual).sort();
    const prioridade = { semana: 3, feriado: 2, fimSemana: 1, fimDeAno: 4 };

    const conflitoNoIndice = indice => {
        if (indice < 1 || indice >= datas.length) return false;
        const anterior = escalaAtual[datas[indice - 1]]?.funcionario;
        const atual = escalaAtual[datas[indice]]?.funcionario;
        return anterior && atual && anterior.registro === atual.registro;
    };

    const trocaValida = (indiceA, indiceB) => {
        // Explicit assignments must survive recalculation and reopening the application.
        const fixado = day => Object.hasOwn(trocasManuais, day) || Object.hasOwn(escalaFimAno, day);
        if (fixado(datas[indiceA]) || fixado(datas[indiceB])) return false;
        const escalaA = escalaAtual[datas[indiceA]];
        const escalaB = escalaAtual[datas[indiceB]];
        const funcionarioA = escalaA?.funcionario;
        const funcionarioB = escalaB?.funcionario;
        if (!funcionarioA || !funcionarioB || funcionarioA.registro === funcionarioB.registro) return false;
        if (!funcionarioAtivoNaData(funcionarioA, datas[indiceB]) || estaEmFerias(funcionarioA, datas[indiceB])) return false;
        if (!funcionarioAtivoNaData(funcionarioB, datas[indiceA]) || estaEmFerias(funcionarioB, datas[indiceA])) return false;

        escalaA.funcionario = funcionarioB;
        escalaB.funcionario = funcionarioA;
        const vizinhos = new Set([indiceA - 1, indiceA, indiceA + 1, indiceB - 1, indiceB, indiceB + 1]);
        const valido = [...vizinhos].every(indice => !conflitoNoIndice(indice));
        escalaA.funcionario = funcionarioA;
        escalaB.funcionario = funcionarioB;
        return valido;
    };

    const trocar = (indiceA, indiceB) => {
        const funcionario = escalaAtual[datas[indiceA]].funcionario;
        escalaAtual[datas[indiceA]].funcionario = escalaAtual[datas[indiceB]].funcionario;
        escalaAtual[datas[indiceB]].funcionario = funcionario;
    };

    // Reinicia a varredura após cada inversão para tratar eventuais efeitos em cadeia.
    for (let tentativa = 0; tentativa < datas.length * 3; tentativa++) {
        let corrigiu = false;
        for (let i = 1; i < datas.length; i++) {
            if (!conflitoNoIndice(i)) continue;
            const anterior = escalaAtual[datas[i - 1]];
            const atual = escalaAtual[datas[i]];
            if ((prioridade[atual.tipo] || 0) > (prioridade[anterior.tipo] || 0)) {
                // O ciclo atual tem prioridade: mantém o dia atual e inverte o anterior para trás.
                for (let candidato = i - 2; candidato >= 0; candidato--) {
                    if (trocaValida(i - 1, candidato)) {
                        trocar(i - 1, candidato);
                        corrigiu = true;
                        break;
                    }
                }
            } else {
                // Mantém o primeiro plantão e leva o funcionário repetido para a próxima posição possível.
                for (let candidato = i + 1; candidato < datas.length; candidato++) {
                    if (trocaValida(i, candidato)) {
                        trocar(i, candidato);
                        corrigiu = true;
                        break;
                    }
                }
            }
            if (corrigiu) break;
        }
        if (!corrigiu) break;
    }

    const conflitosRestantes = datas.filter((_, indice) => conflitoNoIndice(indice));
    if (conflitosRestantes.length) {
        console.warn('Não foi possível eliminar todos os plantões consecutivos apenas com inversões.', conflitosRestantes);
    }
}

function getPeriodosFimAno(ano) {
    const natal = new Date(ano, 11, 25);
    let primeiraSegundaPreNatal = new Date(natal);
    primeiraSegundaPreNatal.setDate(natal.getDate() - (natal.getDay() === 1 ? 7 : (natal.getDay() + 6) % 7));
    
    const fimPeriodo1 = new Date(primeiraSegundaPreNatal);
    fimPeriodo1.setDate(primeiraSegundaPreNatal.getDate() + 6);
    
    let segundaPosPeriodo1 = new Date(fimPeriodo1);
    segundaPosPeriodo1.setDate(fimPeriodo1.getDate() + 1);

    const fimPeriodo2 = new Date(segundaPosPeriodo1);
    fimPeriodo2.setDate(segundaPosPeriodo1.getDate() + 6);
    
    return {
        periodo1: { inicio: formatarDataISO(primeiraSegundaPreNatal), fim: formatarDataISO(fimPeriodo1) },
        periodo2: { inicio: formatarDataISO(segundaPosPeriodo1), fim: formatarDataISO(fimPeriodo2) }
    };
}

function getPeriodoInicioAno(ano) {
    const primeiroDeJaneiro = new Date(ano, 0, 1);
    let primeiroDomingo = new Date(primeiroDeJaneiro);
    primeiroDomingo.setDate(primeiroDeJaneiro.getDate() + (7 - primeiroDeJaneiro.getDay()));
    return {
        inicio: formatarDataISO(primeiroDeJaneiro),
        fim: formatarDataISO(primeiroDomingo)
    };
}

function isFimAno(dataStr) {
    const data = new Date(dataStr + 'T00:00:00');
    const anoData = data.getFullYear();

    const { periodo1, periodo2 } = getPeriodosFimAno(anoData);
    const inicio1 = new Date(periodo1.inicio + 'T00:00:00');
    const fim1 = new Date(periodo1.fim + 'T00:00:00');
    const inicio2 = new Date(periodo2.inicio + 'T00:00:00');
    const fim2 = new Date(periodo2.fim + 'T00:00:00');
    
    const periodoInicioAno = getPeriodoInicioAno(anoData);
    const inicioAno = new Date(periodoInicioAno.inicio + 'T00:00:00');
    const fimAno = new Date(periodoInicioAno.fim + 'T00:00:00');

    return (data >= inicio1 && data <= fim1) || (data >= inicio2 && data <= fim2) || (data >= inicioAno && data <= fimAno);
}

