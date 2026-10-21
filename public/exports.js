function exportarDiarioOficial() {
    const mesEscolhido = document.getElementById('mesExportar').value;
    const formato = document.getElementById('formatoExportar').value;
    
    if (mesEscolhido === '') {
        showAlert('Selecione um mês para exportar.');
        return;
    }
    
    const dados = obterDadosMes(parseInt(mesEscolhido));
    const colunas = ['Dia', 'Dia da Semana', 'Nome do Fiscal', 'Nº Registro'];
    
    if (formato === 'pdf') {
        exportarPDF(dados, colunas, 'Diário Oficial', mesEscolhido);
    } else if (formato === 'word') {
        exportarWord(dados, colunas, 'Diário Oficial', mesEscolhido);
    } else if (formato === 'xml') {
         exportarConfiguracaoXML();
    }
}

function exportarDefesaCivil() {
    const mesEscolhido = document.getElementById('mesExportar').value;
    const formato = document.getElementById('formatoExportar').value;
    
    if (mesEscolhido === '') {
        showAlert('Selecione um mês para exportar.');
        return;
    }
    
    const dados = obterDadosMes(parseInt(mesEscolhido));
    const colunas = ['Dia', 'Dia da Semana', 'Nome do Fiscal', 'Nº Registro', 'Telefone'];
    
    if (formato === 'pdf') {
        exportarPDF(dados, colunas, 'Defesa Civil', mesEscolhido);
    } else if (formato === 'word') {
        exportarWord(dados, colunas, 'Defesa Civil', mesEscolhido);
    } else if (formato === 'xml') {
        exportarConfiguracaoXML();
    }
}

function obterDadosMes(mes) {
    const dados = [];
    const diasNoMes = new Date(anoAtual, mes + 1, 0).getDate();
    const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    
    for (let dia = 1; dia <= diasNoMes; dia++) {
        const data = new Date(anoAtual, mes, dia);
        const dataStr = formatarDataISO(data);
        const escala = escalaAtual[dataStr];
        
        if (escala && escala.funcionario) {            if (!estaEmFerias(escala.funcionario, dataStr)) {
                dados.push({
                    dia: dia.toString().padStart(2, '0'),
                    diaSemana: diasSemana[data.getDay()],
                    nome: escala.funcionario.nome,
                    registro: escala.funcionario.registro,
                    telefone: escala.funcionario.telefone
                });
            }
        }
    }
    
    return dados;
}

function exportarPDF(dados, colunas, tipo, mesIndex) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    
    doc.setFontSize(16);
    doc.text(`Escala de Plantão - ${tipo}`, 20, 20);
    doc.setFontSize(12);
    doc.text(`${meses[mesIndex]} ${anoAtual}`, 20, 30);
    
    const linhas = dados.map(item => {
        if (tipo === 'Diário Oficial') {
            return [item.dia, item.diaSemana, item.nome, item.registro];
        } else {
            return [item.dia, item.diaSemana, item.nome, item.registro, item.telefone];
        }
    });
    
    doc.autoTable({
        startY: 40,
        head: [colunas],
        body: linhas,
        theme: 'grid',
        styles: { fontSize: 9 },
        headStyles: { fillColor: [66, 139, 202] }
    });
    
    doc.save(`Escala ${tipo.replace(' ', '_')} ${meses[mesIndex]} ${anoAtual}.pdf`);
}

function exportarWord(dados, colunas, tipo, mesIndex) {
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    
    let html = `
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
        <h2>Escala de Plantão - ${tipo}</h2>
        <h3>${meses[mesIndex]} ${anoAtual}</h3>
        <table border="1" style="border-collapse: collapse; width: 100%;"
            <thead>
                <tr style="background-color: #428bca; color: white;">
    `;
    
    colunas.forEach(coluna => {
        html += `<th style="padding: 8px; text-align: left;">${coluna}</th>`;
    });
    
    html += `
                </tr>
            </thead>
            <tbody>
    `;
    
    dados.forEach(item => {
        html += '<tr>';
        html += `<td style="padding: 8px;">${item.dia}</td>`;
        html += `<td style="padding: 8px;">${item.diaSemana}</td>`;
        html += `<td style="padding: 8px;">${escapeHTML(item.nome)}</td>`;
        html += `<td style="padding: 8px;">${escapeHTML(item.registro)}</td>`;
        if (tipo === 'Defesa Civil') {
            html += `<td style="padding: 8px;">${escapeHTML(item.telefone)}</td>`;
        }
        html += '</tr>';
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    const blob = new Blob([html], { type: 'application/msword' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Escala ${tipo.replace(' ', '_')} ${meses[mesIndex]} ${anoAtual}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportarConfiguracaoXML() {
    salvarEstadoAno(anoAtual);
    const configData = {
        funcionarios: funcionarios,
        ferias: ferias, // Agora usa 'registro'
        feriados: feriados,
        ciclos: {
            diaSemanaInicio: document.getElementById('cicloDiaSemanaInicio').value,
            fimSemanaInicio: document.getElementById('cicloFimSemanaInicio').value,
            feriadosInicio: document.getElementById('cicloFeriadosInicio').value
        },
        ciclosPorAno: ciclosPorAno,
        ano: anoAtual,
        trocasManuais: trocasManuais,
        escalaFimAno: escalaFimAno,
        coresDias: coresDias
    };

    let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xmlContent += '<configuracao_escala>\n';

    xmlContent += '  <funcionarios>\n';
    configData.funcionarios.forEach(func => {
        xmlContent += `    <funcionario>\n`;
        xmlContent += `      <nome>${escapeXML(func.nome)}</nome>\n`;
        xmlContent += `      <registro>${escapeXML(func.registro)}</registro>\n`;
        xmlContent += `      <telefone>${escapeXML(func.telefone)}</telefone>\n`;
        xmlContent += `      <data_inicio>${escapeXML(func.dataInicio || '1900-01-01')}</data_inicio>\n`;
        xmlContent += `      <data_fim>${escapeXML(func.dataFim || '')}</data_fim>\n`;
        xmlContent += `    </funcionario>\n`;
    });
    xmlContent += '  </funcionarios>\n';    xmlContent += '  <ferias>\n';
    for (const registro in configData.ferias) {
        configData.ferias[registro].forEach(periodo => {
            xmlContent += `    <funcionario_ferias registro="${escapeXML(registro)}">\n`;
            xmlContent += `      <inicio>${periodo.inicio}</inicio>\n`;
            xmlContent += `      <fim>${periodo.fim}</fim>\n`;
            xmlContent += `    </funcionario_ferias>\n`;
        });
    }
    xmlContent += '  </ferias>\n';

    xmlContent += '  <feriados>\n';
    for (const data in configData.feriados) {
        xmlContent += `    <feriado data="${escapeXML(data)}">${escapeXML(configData.feriados[data])}</feriado>\n`;
    }
    xmlContent += '  </feriados>\n';

    xmlContent += '  <ciclos>\n';
    xmlContent += `    <diaSemanaInicio index="${configData.ciclos.diaSemanaInicio}"/>\n`;
    xmlContent += `    <fimSemanaInicio index="${configData.ciclos.fimSemanaInicio}"/>\n`;
    xmlContent += `    <feriadosInicio index="${configData.ciclos.feriadosInicio}"/>\n`;
    xmlContent += '  </ciclos>\n';
    xmlContent += '  <ciclos_por_ano>\n';
    Object.entries(configData.ciclosPorAno).sort(([a], [b]) => Number(a) - Number(b)).forEach(([ano, ciclos]) => {
        xmlContent += `    <ano_ciclos ano="${escapeXML(ano)}" dia_semana="${ciclos.diaSemana || 0}" fim_semana="${ciclos.fimSemana || 0}" feriado="${ciclos.feriado || 0}"/>\n`;
    });
    xmlContent += '  </ciclos_por_ano>\n';
    
    xmlContent += `  <ano>${configData.ano}</ano>\n`;
    
    xmlContent += '  <trocas_manuais>\n';
    for (const data in configData.trocasManuais) {
        const funcionario = configData.trocasManuais[data];
        if (funcionario && funcionario.nome) {
            xmlContent += `    <troca data="${escapeXML(data)}" registro_funcionario="${escapeXML(funcionario.registro)}"/>\n`;
        }
    }
    xmlContent += '  </trocas_manuais>\n';

    xmlContent += '  <escala_fim_ano>\n';
    for (const data in configData.escalaFimAno) {
        const funcionario = configData.escalaFimAno[data].funcionario;
        if (funcionario && funcionario.nome) {
            xmlContent += `    <plantao data="${escapeXML(data)}" registro_funcionario="${escapeXML(funcionario.registro)}"/>\n`;
        }
    }
    xmlContent += '  </escala_fim_ano>\n';

    xmlContent += '  <cores_dias>\n';
    for(const [day,color] of Object.entries(configData.coresDias))xmlContent += `    <cor_dia data="${escapeXML(day)}" tipo="${escapeXML(color)}"/>\n`;
    xmlContent += '  </cores_dias>\n';
    xmlContent += '</configuracao_escala>';

    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia = String(hoje.getDate()).padStart(2, '0');
    const dataFormatada = `${ano}-${mes}-${dia}`;
    
    const blob = new Blob([xmlContent], { type: 'text/xml' });
    const nomeArquivo = `Escala_${dataFormatada}.xml`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nomeArquivo;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showAlert('Configuração salva com sucesso!', 'Exportação XML');
}

