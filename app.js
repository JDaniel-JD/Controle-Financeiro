// --- NAVEGAÇÃO ---
const navButtons = document.querySelectorAll('.nav-item');
const lobbies = document.querySelectorAll('.lobby');

navButtons.forEach(button => {
    button.addEventListener('click', () => {
        navButtons.forEach(btn => btn.classList.remove('active'));
        lobbies.forEach(lobby => lobby.classList.remove('active'));
        button.classList.add('active');
        const targetId = button.getAttribute('data-target');
        document.getElementById(targetId).classList.add('active');
    });
});

// --- DATA PRÉ-PREENCHIDA ---
function preencherDataDeHoje() {
    const dataInput = document.getElementById('data');
    if (dataInput) {
        const hoje = new Date().toLocaleDateString('en-CA'); 
        dataInput.value = hoje;
    }
}
preencherDataDeHoje();

// --- DADOS E PERSISTÊNCIA ---
let transacoes = JSON.parse(localStorage.getItem('minhas_transacoes')) || [];
let investimentos = JSON.parse(localStorage.getItem('meus_investimentos')) || [];
let metas = JSON.parse(localStorage.getItem('minhas_metas')) || { 'Renda Fixa': 25, 'Ações': 25, 'FIIs': 25, 'Cripto': 25 };

// Migração de dados para a nova versão (com quantidade)
investimentos = investimentos.map(inv => {
    return {
        ...inv,
        quantidade: inv.quantidade || 1, // Se não tiver, assume 1 para não quebrar o cálculo
        valorAporte: inv.valorAporte || inv.valor, 
        valorAtual: inv.valorAtual || inv.valor
    };
});

const META_RESERVA = 10000;

const formatarMoeda = (valor) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
};

// --- ELEMENTOS DOM ---
const formLancamento = document.getElementById('form-lancamento');
const formInvestimento = document.getElementById('form-investimento');
const listaTransacoes = document.getElementById('lista-transacoes');
const listaInvestimentos = document.getElementById('lista-investimentos');
const analiseCarteiraEl = document.getElementById('analise-carteira');
const saldoAtualEl = document.getElementById('saldo-atual');
const patrimonioTotalEl = document.getElementById('patrimonio-total');
const lucroPatrimonioEl = document.getElementById('lucro-patrimonio');
const totalEntradasEl = document.getElementById('total-entradas');
const totalSaidasEl = document.getElementById('total-saidas');
const barraReserva = document.getElementById('barra-reserva');
const textoReserva = document.getElementById('texto-reserva');

const irSalarioEl = document.getElementById('ir-salario');
const irMeiEl = document.getElementById('ir-mei');
const irDividendosEl = document.getElementById('ir-dividendos');
const listaBensDireitosEl = document.getElementById('lista-bens-direitos');

// --- SISTEMA DE MODAIS CUSTOMIZADOS ---
const modalOverlay = document.getElementById('modal-overlay');
const modalAlert = document.getElementById('modal-alert');
const modalConfirm = document.getElementById('modal-confirm');
const modalPrompt = document.getElementById('modal-prompt');

function fecharModais() {
    modalOverlay.classList.remove('active');
    modalAlert.classList.remove('active');
    modalConfirm.classList.remove('active');
    modalPrompt.classList.remove('active');
}

function customAlert(title, msg) {
    return new Promise((resolve) => {
        document.getElementById('modal-alert-title').textContent = title;
        document.getElementById('modal-alert-msg').innerHTML = msg;
        modalOverlay.classList.add('active');
        modalAlert.classList.add('active');
        document.getElementById('modal-alert-ok').onclick = () => { fecharModais(); resolve(); };
    });
}

function customConfirm(title, msg) {
    return new Promise((resolve) => {
        document.getElementById('modal-confirm-title').textContent = title;
        document.getElementById('modal-confirm-msg').innerHTML = msg;
        modalOverlay.classList.add('active');
        modalConfirm.classList.add('active');
        document.getElementById('modal-confirm-ok').onclick = () => { fecharModais(); resolve(true); };
        document.getElementById('modal-confirm-cancel').onclick = () => { fecharModais(); resolve(false); };
    });
}

function customPrompt(title, msg, defaultValue) {
    return new Promise((resolve) => {
        document.getElementById('modal-prompt-title').textContent = title;
        document.getElementById('modal-prompt-msg').innerHTML = msg;
        const input = document.getElementById('modal-prompt-input');
        input.value = defaultValue;
        modalOverlay.classList.add('active');
        modalPrompt.classList.add('active');
        input.focus();
        document.getElementById('modal-prompt-ok').onclick = () => { fecharModais(); resolve(input.value); };
        document.getElementById('modal-prompt-cancel').onclick = () => { fecharModais(); resolve(null); };
    });
}

// --- INTEGRAÇÃO COM APIs (BRAPI E COINGECKO) ---
window.sincronizarCotacoes = async function() {
    const btnSync = document.getElementById('btn-sync');
    btnSync.innerHTML = `<span class="material-icons" style="font-size: 1.2rem; animation: spin 1s linear infinite;">sync</span> Atualizando...`;
    btnSync.classList.add('loading');

    let mudouAlgo = false;
    let erros = [];

    for (let inv of investimentos) {
        try {
            // Criptomoedas via CoinGecko
            if (inv.categoria === 'Cripto') {
                const idMoeda = inv.ativo.toLowerCase().trim(); // Ex: bitcoin, ethereum
                const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${idMoeda}&vs_currencies=brl`);
                const data = await res.json();
                
                if (data[idMoeda] && data[idMoeda].brl) {
                    const precoAtual = data[idMoeda].brl;
                    inv.valorAtual = precoAtual * inv.quantidade;
                    mudouAlgo = true;
                } else {
                    erros.push(`Não achamos o preço de: ${inv.ativo} (Verifique o nome).`);
                }
            } 
            // Ações e FIIs via BRAPI (B3)
            else if (inv.categoria === 'Ações' || inv.categoria === 'FIIs') {
                const ticker = inv.ativo.toUpperCase().trim(); // Ex: PETR4, MXRF11
                // NOTA: A BRAPI recentemente exigiu tokens em alguns endpoints. Se falhar, é por causa disso.
                const res = await fetch(`https://brapi.dev/api/quote/${ticker}`);
                const data = await res.json();
                
                if (data.results && data.results[0] && data.results[0].regularMarketPrice) {
                    const precoAtual = data.results[0].regularMarketPrice;
                    inv.valorAtual = precoAtual * inv.quantidade;
                    mudouAlgo = true;
                } else {
                    erros.push(`Não achamos o preço de: ${inv.ativo} na B3.`);
                }
            }
        } catch (error) {
            console.error("Erro na API para " + inv.ativo, error);
            erros.push(`Falha de conexão ao buscar: ${inv.ativo}`);
        }
    }

    if (mudouAlgo) {
        salvarTudo();
        atualizarInterface();
    }

    btnSync.innerHTML = `<span class="material-icons" style="font-size: 1.2rem;">sync</span> Mercado`;
    btnSync.classList.remove('loading');

    if (erros.length > 0) {
        await customAlert("Atenção", `Cotações atualizadas, mas tivemos problemas com alguns ativos:<br><br><small>${erros.join('<br>')}</small><br><br>Você pode atualizar esses manualmente clicando no botão 'Atualizar' ao lado deles.`);
    } else if (mudouAlgo) {
        await customAlert("Sucesso", "Todas as cotações de Bolsa e Cripto foram atualizadas com o mercado real!");
    } else {
        await customAlert("Aviso", "Nenhum ativo automático encontrado. Renda Fixa deve ser atualizada manualmente.");
    }
};

// --- LÓGICA DE CATEGORIAS DINÂMICAS ---
const tipoSelect = document.getElementById('tipo');
const categoriaSelect = document.getElementById('categoria');

const categoriasConfig = {
    entrada: [
        { value: 'salario', label: 'Salario' },
        { value: 'vale', label: 'Vale' },
        { value: 'pix', label: 'Pix' },
        { value: 'mei', label: 'Receita MEI / Serviços (IR)' },
        { value: 'dividendos', label: 'Dividendos / Rendimentos' }
    ],
    saida: [
        { value: 'alimentacao', label: 'Alimentação' },
        { value: 'lazer', label: 'Lazer' },
        { value: 'veiculo', label: 'Veículo' },
        { value: 'despesa', label: 'Despesa' },
        { value: 'saude', label: 'Saúde' },
        { value: 'agua', label: 'Agua' },
        { value: 'luz', label: 'Luz' },
        { value: 'internet', label: 'Internet' },
        { value: 'iptu', label: 'IPTU' },
        { value: 'tax_lixo', label: 'TAX LIXO' },
        { value: 'investimento', label: 'Aporte (Retirar do Saldo para Investir)' }
    ]
};

function atualizarOpcoesCategoria() {
    const tipo = tipoSelect.value;
    categoriaSelect.innerHTML = ''; 
    categoriasConfig[tipo].forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.value;
        opt.textContent = cat.label;
        categoriaSelect.appendChild(opt);
    });
}
tipoSelect.addEventListener('change', atualizarOpcoesCategoria);
atualizarOpcoesCategoria();

// --- FUNÇÕES DE PERSISTÊNCIA BÁSICA ---
function salvarTudo() {
    localStorage.setItem('minhas_transacoes', JSON.stringify(transacoes));
    localStorage.setItem('meus_investimentos', JSON.stringify(investimentos));
    localStorage.setItem('minhas_metas', JSON.stringify(metas));
}

window.salvarMetas = async function() {
    metas['Renda Fixa'] = parseFloat(document.getElementById('meta-rf').value) || 0;
    metas['Ações'] = parseFloat(document.getElementById('meta-acoes').value) || 0;
    metas['FIIs'] = parseFloat(document.getElementById('meta-fiis').value) || 0;
    metas['Cripto'] = parseFloat(document.getElementById('meta-cripto').value) || 0;
    salvarTudo();
    atualizarInterface();
    await customAlert("Sucesso", "Suas metas de carteira foram atualizadas!");
};

window.deletarTransacao = async function(id) {
    const confirmou = await customConfirm("Atenção", "Tem certeza que deseja excluir este lançamento? <br><br>O seu saldo será recalculado.");
    if(confirmou) {
        transacoes = transacoes.filter(t => t.id !== id);
        salvarTudo();
        atualizarInterface();
    }
};

window.deletarInvestimento = async function(id) {
    const confirmou = await customConfirm("Atenção", "Deseja excluir este ativo da sua carteira?<br><br>Lembre-se de excluir a 'Saída' correspondente nos Lançamentos para que o dinheiro volte ao Saldo.");
    if(confirmou) {
        investimentos = investimentos.filter(i => i.id !== id);
        salvarTudo();
        atualizarInterface();
    }
};

window.atualizarCotacao = async function(id) {
    const inv = investimentos.find(i => i.id === id);
    if(inv) {
        const msg = `Ativo: <strong>${inv.ativo}</strong><br>Cotas/Qtd: ${inv.quantidade}<br>Valor Total Atual: ${formatarMoeda(inv.valorAtual)}<br><br>Digite o <strong>NOVO VALOR TOTAL</strong> do ativo na sua carteira:`;
        const novoValor = await customPrompt("Atualizar Manualmente", msg, inv.valorAtual);
        
        if(novoValor !== null && !isNaN(novoValor) && novoValor !== "") {
            inv.valorAtual = parseFloat(novoValor);
            salvarTudo();
            atualizarInterface();
        }
    }
};

// --- GRÁFICOS ---
let chartEntradasInstance = null;
let chartSaidasInstance = null;

function renderizarGraficos(dadosEntradas, dadosSaidas) {
    const ctxEntradas = document.getElementById('grafico-entradas').getContext('2d');
    const ctxSaidas = document.getElementById('grafico-saidas').getContext('2d');

    if (chartEntradasInstance) chartEntradasInstance.destroy();
    if (chartSaidasInstance) chartSaidasInstance.destroy();

    const configPadrao = {
        type: 'pie',
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 10 } } } }
        }
    };

    const paletaCores = ['#2e7d32', '#1976d2', '#fbc02d', '#d32f2f', '#8e24aa', '#f57c00', '#009688', '#e91e63', '#795548', '#607d8b'];

    chartEntradasInstance = new Chart(ctxEntradas, {
        ...configPadrao,
        data: {
            labels: Object.keys(dadosEntradas),
            datasets: [{
                data: Object.values(dadosEntradas),
                backgroundColor: paletaCores.slice(0, Object.keys(dadosEntradas).length),
                borderWidth: 1
            }]
        }
    });

    chartSaidasInstance = new Chart(ctxSaidas, {
        ...configPadrao,
        data: {
            labels: Object.keys(dadosSaidas),
            datasets: [{
                data: Object.values(dadosSaidas),
                backgroundColor: paletaCores.slice(0, Object.keys(dadosSaidas).length).reverse(),
                borderWidth: 1
            }]
        }
    });
}

// --- LÓGICA DE LANÇAMENTOS ---
formLancamento.addEventListener('submit', async (e) => {
    e.preventDefault();
    const categoriaSelect = document.getElementById('categoria');
    const categoriaTexto = categoriaSelect.options[categoriaSelect.selectedIndex].text;

    const nova = {
        id: Date.now(),
        tipo: document.getElementById('tipo').value,
        descricao: document.getElementById('descricao').value,
        valor: parseFloat(document.getElementById('valor').value),
        categoria: document.getElementById('categoria').value, 
        categoriaNome: categoriaTexto, 
        data: document.getElementById('data').value
    };
    
    transacoes.push(nova);
    salvarTudo();
    formLancamento.reset();
    preencherDataDeHoje(); 
    
    await customAlert("Sucesso", "Lançamento registrado com sucesso!");
    document.querySelector('[data-target="lobby-dashboard"]').click();
    atualizarInterface();
});

// --- LÓGICA DE INVESTIMENTOS ---
formInvestimento.addEventListener('submit', async (e) => {
    e.preventDefault();
    const valorInput = parseFloat(document.getElementById('inv-valor').value);
    const quantidadeInput = parseFloat(document.getElementById('inv-quantidade').value);
    const ativo = document.getElementById('inv-ativo').value;
    const categoria = document.getElementById('inv-categoria').value;

    const novoInv = { 
        id: Date.now(), 
        ativo, 
        categoria, 
        quantidade: quantidadeInput,
        valorAporte: valorInput,
        valorAtual: valorInput
    };
    investimentos.push(novoInv);

    const dataAtual = new Date().toISOString().split('T')[0];
    const transacaoDeducao = {
        id: Date.now() + 1,
        tipo: 'saida',
        descricao: `Aporte: ${ativo} (${quantidadeInput} cotas)`,
        valor: valorInput,
        categoria: 'investimento',
        categoriaNome: 'Aporte (Retirar do Saldo para Investir)',
        data: dataAtual
    };
    transacoes.push(transacaoDeducao);

    salvarTudo();
    formInvestimento.reset();
    atualizarInterface();
    await customAlert("Sucesso", `Investimento em <strong>${ativo}</strong> realizado e deduzido do seu saldo!`);
});

// --- ATUALIZAÇÃO DA INTERFACE ---
function atualizarInterface() {
    listaTransacoes.innerHTML = '';
    listaInvestimentos.innerHTML = '';
    analiseCarteiraEl.innerHTML = '';
    listaBensDireitosEl.innerHTML = ''; 
    
    let saldo = 0;
    let entradas = 0;
    let saidas = 0;
    let totalInvestidoReserva = 0;
    
    let patrimonioMercado = 0; 
    let patrimonioAporte = 0; 
    
    let rendimentosSalario = 0;
    let rendimentosMei = 0;
    let rendimentosDividendos = 0;

    let distribuicaoReal = { 'Renda Fixa': 0, 'Ações': 0, 'FIIs': 0, 'Cripto': 0 };
    let dadosGraficoEntradas = {};
    let dadosGraficoSaidas = {};

    const transOrdenadas = [...transacoes].sort((a, b) => new Date(b.data) - new Date(a.data));
    transOrdenadas.forEach(t => {
        const item = document.createElement('div');
        item.style.padding = '0.8rem';
        item.style.borderBottom = '1px solid #eee';
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';
        
        const cor = t.tipo === 'entrada' ? 'var(--primary)' : '#d32f2f';
        const nomeCategoria = t.categoriaNome || t.categoria; 
        
        item.innerHTML = `
            <div><strong>${t.descricao}</strong><br><small>${t.data.split('-').reverse().join('/')} | ${nomeCategoria}</small></div>
            <div class="item-actions">
                <div style="color: ${cor}; font-weight: bold; margin-right: 10px;">${t.tipo === 'entrada' ? '+' : '-'} ${formatarMoeda(t.valor)}</div>
                <button class="btn-delete" onclick="deletarTransacao(${t.id})" title="Excluir"><span class="material-icons" style="font-size: 1.2rem;">delete</span></button>
            </div>
        `;
        listaTransacoes.appendChild(item);

        if(t.tipo === 'entrada') { 
            entradas += t.valor; saldo += t.valor; 
            dadosGraficoEntradas[nomeCategoria] = (dadosGraficoEntradas[nomeCategoria] || 0) + t.valor;
            if (t.categoria === 'salario') rendimentosSalario += t.valor;
            if (t.categoria === 'mei') rendimentosMei += t.valor;
            if (t.categoria === 'dividendos') rendimentosDividendos += t.valor;
        } else { 
            saidas += t.valor; saldo -= t.valor; 
            dadosGraficoSaidas[nomeCategoria] = (dadosGraficoSaidas[nomeCategoria] || 0) + t.valor;
        }

        if(t.categoria === 'investimento' && t.tipo === 'saida') totalInvestidoReserva += t.valor;
    });

    renderizarGraficos(dadosGraficoEntradas, dadosGraficoSaidas);

    let ativosAgrupadosIR = {};
    investimentos.forEach(inv => {
        const rentabilidadeReal = inv.valorAtual - inv.valorAporte;
        const corRentabilidade = rentabilidadeReal >= 0 ? 'var(--primary)' : '#d32f2f';
        
        const item = document.createElement('div');
        item.style.padding = '0.8rem';
        item.style.borderBottom = '1px solid #eee';
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';
        
        item.innerHTML = `
            <div>
                <strong>${inv.ativo}</strong><br>
                <small>Qtd: ${inv.quantidade} | Aporte: ${formatarMoeda(inv.valorAporte)}</small>
            </div>
            <div class="item-actions">
                <div style="text-align: right; margin-right: 10px;">
                    <div style="font-weight: bold; font-size: 1.1rem; color: #1976d2;">${formatarMoeda(inv.valorAtual)}</div>
                    <small style="color: ${corRentabilidade};">${rentabilidadeReal >= 0 ? '+' : ''}${formatarMoeda(rentabilidadeReal)}</small>
                </div>
                <div style="display: flex; flex-direction: column; gap: 5px;">
                    <button class="btn-small" onclick="atualizarCotacao(${inv.id})">Manual</button>
                    <button class="btn-delete" onclick="deletarInvestimento(${inv.id})" title="Excluir"><span class="material-icons" style="font-size: 1.2rem;">delete</span></button>
                </div>
            </div>
        `;
        listaInvestimentos.appendChild(item);
        
        patrimonioMercado += inv.valorAtual;
        patrimonioAporte += inv.valorAporte;
        if (distribuicaoReal[inv.categoria] !== undefined) distribuicaoReal[inv.categoria] += inv.valorAtual;
        if (ativosAgrupadosIR[inv.ativo]) { ativosAgrupadosIR[inv.ativo] += inv.valorAporte; } 
        else { ativosAgrupadosIR[inv.ativo] = inv.valorAporte; }
    });

    for (let cat in distribuicaoReal) {
        let porcentagemReal = patrimonioMercado > 0 ? (distribuicaoReal[cat] / patrimonioMercado) * 100 : 0;
        let porcentagemMeta = metas[cat] || 0;
        const analiseItem = document.createElement('div');
        analiseItem.style.marginBottom = '1rem';
        analiseItem.innerHTML = `
            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.3rem;">
                <span>${cat}</span>
                <span>Atual: <strong>${porcentagemReal.toFixed(1)}%</strong> | Meta: <strong>${porcentagemMeta}%</strong></span>
            </div>
            <div style="height: 8px; background: #eee; border-radius: 4px; overflow: hidden; display: flex;">
                <div style="width: ${porcentagemReal}%; background: ${porcentagemReal > porcentagemMeta ? '#fbc02d' : '#1976d2'};"></div>
            </div>
        `;
        analiseCarteiraEl.appendChild(analiseItem);
    }

    if (saldo > 0) {
        listaBensDireitosEl.innerHTML += `
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px dashed #ccc;">
                <span>Depósito em Conta Corrente</span>
                <strong>${formatarMoeda(saldo)}</strong>
            </div>
        `;
    }
    for (let ativoNome in ativosAgrupadosIR) {
        listaBensDireitosEl.innerHTML += `
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px dashed #ccc;">
                <span>${ativoNome}</span>
                <strong>${formatarMoeda(ativosAgrupadosIR[ativoNome])}</strong>
            </div>
        `;
    }

    saldoAtualEl.textContent = formatarMoeda(saldo);
    totalEntradasEl.textContent = formatarMoeda(entradas);
    totalSaidasEl.textContent = formatarMoeda(saidas);
    patrimonioTotalEl.textContent = formatarMoeda(patrimonioMercado);
    const lucroGeral = patrimonioMercado - patrimonioAporte;
    lucroPatrimonioEl.textContent = `Rentabilidade: ${lucroGeral >= 0 ? '+' : ''}${formatarMoeda(lucroGeral)}`;
    lucroPatrimonioEl.style.color = lucroGeral >= 0 ? 'var(--primary)' : '#d32f2f';
    
    irSalarioEl.textContent = formatarMoeda(rendimentosSalario);
    irMeiEl.textContent = formatarMoeda(rendimentosMei);
    irDividendosEl.textContent = formatarMoeda(rendimentosDividendos);

    const percReserva = (totalInvestidoReserva / META_RESERVA) * 100;
    barraReserva.value = Math.min(percReserva, 100);
    textoReserva.textContent = `${percReserva.toFixed(1)}% da meta (Total: ${formatarMoeda(totalInvestidoReserva)})`;

    document.getElementById('meta-rf').value = metas['Renda Fixa'];
    document.getElementById('meta-acoes').value = metas['Ações'];
    document.getElementById('meta-fiis').value = metas['FIIs'];
    document.getElementById('meta-cripto').value = metas['Cripto'];
}

// Também injeta a animação CSS do spinner do botão de sync direto pelo JS para não precisar alterar o HTML de novo
const style = document.createElement('style');
style.innerHTML = `@keyframes spin { 100% { transform: rotate(360deg); } }`;
document.head.appendChild(style);

atualizarInterface();