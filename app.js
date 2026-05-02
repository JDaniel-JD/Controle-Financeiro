// ==========================================
// ☁️ FIREBASE FIRESTORE CONFIGURAÇÃO
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ⚠️ COLOQUE AQUI AS CHAVES DO SEU FIREBASE CONSOLE ⚠️
const firebaseConfig = {
    apiKey: "AIzaSyDHSH58Cz9C6i_tdzzDZVDUQHGobI57zIY",
    authDomain: "financeiro-app-8d0a9.firebaseapp.com",
    projectId: "financeiro-app-8d0a9",
    storageBucket: "financeiro-app-8d0a9.firebasestorage.app",
    messagingSenderId: "143412404664",
    appId: "1:143412404664:web:ef0a969959abe72d7c6f4d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const docRef = doc(db, "usuarios", "meu_caixa_principal");

// --- VARIÁVEIS GLOBAIS DE DADOS ---
let transacoes = [];
let investimentos = [];
let metas = { 'Renda Fixa': 25, 'Ações': 25, 'FIIs': 25, 'Cripto': 25 };
let despesasFixas = [];
let cartoes = [];

// ==========================================
// MÓDULO DE SINCRONIZAÇÃO E MIGRAÇÃO
// ==========================================
async function carregarDadosDoFirebase() {
    // 1. Cria uma tela de loading visual para o usuário
    const loadingOverlay = document.createElement('div');
    loadingOverlay.innerHTML = `
        <div style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(255,255,255,0.95); z-index:9999; display:flex; flex-direction:column; align-items:center; justify-content:center; color:var(--primary); font-family:sans-serif;">
            <span class="material-icons" style="font-size:3rem; animation: spin 1s linear infinite;">sync</span>
            <h3 style="margin-top:15px; color:#333;">Sincronizando com a Nuvem...</h3>
        </div>
    `;
    document.body.appendChild(loadingOverlay);

    try {
        const snap = await getDoc(docRef);
        const dadosLocaisTransacoes = JSON.parse(localStorage.getItem('minhas_transacoes')) || [];
        
        if (snap.exists() && snap.data().transacoes && snap.data().transacoes.length > 0) {
            // NUVEM TEM DADOS: Puxa para a tela
            const data = snap.data();
            transacoes = data.transacoes || [];
            investimentos = data.investimentos || [];
            metas = data.metas || { 'Renda Fixa': 25, 'Ações': 25, 'FIIs': 25, 'Cripto': 25 };
            despesasFixas = data.despesasFixas || [];
            cartoes = data.cartoes || [];
        } 
        else if (dadosLocaisTransacoes.length > 0) {
            // NUVEM VAZIA MAS PC TEM DADOS: Inicia a Migração
            console.log("Migrando dados do LocalStorage para o Firebase...");
            transacoes = dadosLocaisTransacoes;
            investimentos = JSON.parse(localStorage.getItem('meus_investimentos')) || [];
            metas = JSON.parse(localStorage.getItem('minhas_metas')) || { 'Renda Fixa': 25, 'Ações': 25, 'FIIs': 25, 'Cripto': 25 };
            despesasFixas = JSON.parse(localStorage.getItem('minhas_despesas')) || [];
            cartoes = JSON.parse(localStorage.getItem('meus_cartoes')) || [];
            
            await window.salvarTudo(); // Sobe o backup local
        }

        carregarIndicadoresBCB();
        atualizarInterface();
        document.body.removeChild(loadingOverlay); // Tira o loading

    } catch (e) {
        document.body.removeChild(loadingOverlay);
        console.error("Erro no Firebase:", e);
        await window.customAlert("Modo Offline Ativo", "Não foi possível conectar ao banco de dados. O sistema carregará o seu último backup local salvo.");
        
        // MODO OFFLINE DE EMERGÊNCIA
        transacoes = JSON.parse(localStorage.getItem('minhas_transacoes')) || [];
        investimentos = JSON.parse(localStorage.getItem('meus_investimentos')) || [];
        metas = JSON.parse(localStorage.getItem('minhas_metas')) || { 'Renda Fixa': 25, 'Ações': 25, 'FIIs': 25, 'Cripto': 25 };
        despesasFixas = JSON.parse(localStorage.getItem('minhas_despesas')) || [];
        cartoes = JSON.parse(localStorage.getItem('meus_cartoes')) || [];
        atualizarInterface();
    }
}

// Salva no Firebase E cria um Backup Local de segurança
window.salvarTudo = async function() {
    // 1. Salva Backup Offline
    localStorage.setItem('minhas_transacoes', JSON.stringify(transacoes)); 
    localStorage.setItem('meus_investimentos', JSON.stringify(investimentos));
    localStorage.setItem('minhas_metas', JSON.stringify(metas)); 
    localStorage.setItem('minhas_despesas', JSON.stringify(despesasFixas)); 
    localStorage.setItem('meus_cartoes', JSON.stringify(cartoes));
    
    // 2. Salva na Nuvem
    try {
        await setDoc(docRef, { transacoes, investimentos, metas, despesasFixas, cartoes });
    } catch (e) { 
        console.error("Erro ao subir dados para a nuvem:", e); 
    }
};

// --- NAVEGAÇÃO E INIT ---
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

function initDatas() {
    const hojeStr = new Date().toLocaleDateString('en-CA'); 
    const mesStr = hojeStr.slice(0, 7); 
    if (document.getElementById('data')) document.getElementById('data').value = hojeStr;
    if (document.getElementById('df-vencimento')) document.getElementById('df-vencimento').value = hojeStr;
    if (document.getElementById('cc-vencimento')) document.getElementById('cc-vencimento').value = hojeStr;
    
    if (document.getElementById('mes-filtro')) {
        document.getElementById('mes-filtro').value = mesStr;
        document.getElementById('mes-filtro').addEventListener('change', atualizarInterface);
    }
    if (document.getElementById('mes-filtro-contas')) {
        document.getElementById('mes-filtro-contas').value = mesStr;
        document.getElementById('mes-filtro-contas').addEventListener('change', atualizarInterface);
    }
    if (document.getElementById('mes-filtro-cartoes')) {
        document.getElementById('mes-filtro-cartoes').value = mesStr;
        document.getElementById('mes-filtro-cartoes').addEventListener('change', atualizarInterface);
    }
}
initDatas(); 

const META_RESERVA = 10000;
const formatarMoeda = (valor) => { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor); };

// --- ELEMENTOS DOM ---
const formLancamento = document.getElementById('form-lancamento');
const formInvestimento = document.getElementById('form-investimento');
const formDespesaFixa = document.getElementById('form-despesa-fixa');
const formCartao = document.getElementById('form-cartao');

const listaTransacoes = document.getElementById('lista-transacoes');
const listaInvestimentos = document.getElementById('lista-investimentos');
const listaDespesasFixas = document.getElementById('lista-despesas-fixas');
const listaCartoes = document.getElementById('lista-cartoes');
const analiseCarteiraEl = document.getElementById('analise-carteira');

const saldoAtualEl = document.getElementById('saldo-atual');
const patrimonioTotalEl = document.getElementById('patrimonio-total');
const lucroPatrimonioEl = document.getElementById('lucro-patrimonio');
const barraReserva = document.getElementById('barra-reserva');
const textoReserva = document.getElementById('texto-reserva');
const areaAlertas = document.getElementById('area-alertas');

const totalEntradasMesEl = document.getElementById('total-entradas-mes');
const totalSaidasMesEl = document.getElementById('total-saidas-mes');

const irSalarioEl = document.getElementById('ir-salario');
const irMeiEl = document.getElementById('ir-mei');
const irDividendosEl = document.getElementById('ir-dividendos');
const listaBensDireitosEl = document.getElementById('lista-bens-direitos');

// --- MODAIS ---
const modalOverlay = document.getElementById('modal-overlay');
const modalAlert = document.getElementById('modal-alert');
const modalConfirm = document.getElementById('modal-confirm');
const modalPrompt = document.getElementById('modal-prompt');

function fecharModais() {
    modalOverlay.classList.remove('active'); modalAlert.classList.remove('active');
    modalConfirm.classList.remove('active'); modalPrompt.classList.remove('active');
}

window.customAlert = function(title, msg) {
    return new Promise((resolve) => {
        document.getElementById('modal-alert-title').textContent = title;
        document.getElementById('modal-alert-msg').innerHTML = msg;
        modalOverlay.classList.add('active'); modalAlert.classList.add('active');
        document.getElementById('modal-alert-ok').onclick = () => { fecharModais(); resolve(); };
    });
}

window.customConfirm = function(title, msg) {
    return new Promise((resolve) => {
        document.getElementById('modal-confirm-title').textContent = title;
        document.getElementById('modal-confirm-msg').innerHTML = msg;
        modalOverlay.classList.add('active'); modalConfirm.classList.add('active');
        document.getElementById('modal-confirm-ok').onclick = () => { fecharModais(); resolve(true); };
        document.getElementById('modal-confirm-cancel').onclick = () => { fecharModais(); resolve(false); };
    });
}

window.customPrompt = function(title, msg, defaultValue, inputType = 'text') {
    return new Promise((resolve) => {
        document.getElementById('modal-prompt-title').textContent = title;
        document.getElementById('modal-prompt-msg').innerHTML = msg;
        const input = document.getElementById('modal-prompt-input');
        input.type = inputType; input.step = inputType === 'number' ? '0.01' : ''; input.value = defaultValue;
        modalOverlay.classList.add('active'); modalPrompt.classList.add('active'); input.focus();
        document.getElementById('modal-prompt-ok').onclick = () => { fecharModais(); resolve(input.value); };
        document.getElementById('modal-prompt-cancel').onclick = () => { fecharModais(); resolve(null); };
    });
}

// --- APIS ---
async function carregarIndicadoresBCB() {
    try {
        const resSelic = await fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1');
        document.getElementById('ind-selic').textContent = `${(await resSelic.json())[0].valor}% a.a.`;
        const resIpca = await fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados/ultimos/1');
        document.getElementById('ind-ipca').textContent = `${(await resIpca.json())[0].valor}%`;
    } catch (e) { document.getElementById('ind-selic').textContent = "Offline"; document.getElementById('ind-ipca').textContent = "Offline"; }
}

window.gerarAnaliseIA = async function() {
    let apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
        apiKey = await window.customPrompt("Configurar IA", "Cole sua chave do Google Gemini:", "", "text");
        if (!apiKey) return; apiKey = apiKey.trim(); localStorage.setItem('gemini_api_key', apiKey);
    }
    const iaContainer = document.getElementById('ia-resultado');
    iaContainer.innerHTML = `Conectando...`;
    try {
        const list = await (await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey.trim()}`)).json();
        if(list.error) throw new Error(list.error.message);
        let mod = list.models.find(m => m.name.includes("flash"))?.name || list.models[0].name;
        const promptText = `Consultor financeiro. Entradas Mês: ${totalEntradasMesEl.innerText}, Saídas Mês: ${totalSaidasMesEl.innerText}, Saldo: ${saldoAtualEl.innerText}, Patrimônio: ${patrimonioTotalEl.innerText}. Curto insight.`;
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${mod}:generateContent?key=${apiKey.trim()}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
        });
        const data = await res.json();
        iaContainer.innerHTML = `<strong>Consultor IA:</strong><br>${data.candidates[0].content.parts[0].text.replace(/\n/g, '<br>')}`;
    } catch (e) { iaContainer.innerHTML = `Erro na API. Verifique a chave e tente novamente.`; localStorage.removeItem('gemini_api_key'); }
};

window.enviarResumoTelegram = async function() {
    let token = localStorage.getItem('tg_token'); 
    let chatId = localStorage.getItem('tg_chat_id');
    
    if (!token || !chatId) {
        await window.customAlert("Configurar Telegram", "1. Pesquise @BotFather\n2. Mande /newbot\n3. Mande um Oi pro bot gerado.");
        token = (await window.customPrompt("Token", "Cole o Token:", "")).trim();
        const upd = await (await fetch(`https://api.telegram.org/bot${token}/getUpdates`)).json();
        if (upd.ok && upd.result.length > 0) { 
            chatId = upd.result[upd.result.length-1].message.chat.id; 
            localStorage.setItem('tg_token', token); 
            localStorage.setItem('tg_chat_id', chatId); 
        }
        else {
            await window.customAlert("Atenção", "Você esqueceu de mandar um 'Oi' pro robô no Telegram. Tente novamente.");
            return;
        }
    }
    
    // MENSAGEM COMPLETA CORRIGIDA COM EMOJIS
    const msg = `📊 *Resumo do Mês* 📊\n\n💰 *Saldo em Conta:* ${saldoAtualEl.innerText}\n📈 *Entradas no Mês:* ${totalEntradasMesEl.innerText}\n📉 *Saídas no Mês:* ${totalSaidasMesEl.innerText}\n🏛️ *Patrimônio Total:* ${patrimonioTotalEl.innerText}\n\n_Gerado pelo seu App Financeiro._`;
    
    try {
        const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'Markdown' }) 
        });
        
        const data = await response.json();
        if (data.ok) {
            window.customAlert("Sucesso", "Relatório completo enviado pro Telegram!");
        } else {
            localStorage.removeItem('tg_token'); localStorage.removeItem('tg_chat_id');
            window.customAlert("Erro", "O Telegram recusou. Limpamos a chave para você configurar de novo.");
        }
    } catch(e) {
        window.customAlert("Erro", "Falha de conexão com a rede.");
    }
};

window.sincronizarCotacoes = async function() {
    let mudou = false;
    for (let inv of investimentos) {
        try {
            if (inv.categoria === 'Cripto') {
                const d = await (await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${inv.ativo.toLowerCase()}&vs_currencies=brl`)).json();
                if(d[inv.ativo.toLowerCase()]) { inv.valorAtual = d[inv.ativo.toLowerCase()].brl * inv.quantidade; mudou = true; }
            } else if (inv.categoria === 'Ações' || inv.categoria === 'FIIs') {
                const d = await (await fetch(`https://brapi.dev/api/quote/${inv.ativo.toUpperCase()}`)).json();
                if(d.results) { inv.valorAtual = d.results[0].regularMarketPrice * inv.quantidade; mudou = true; }
            }
        } catch (e) {}
    }
    if (mudou) { window.salvarTudo(); atualizarInterface(); window.customAlert("Sucesso", "Cotações do mercado sincronizadas!"); }
};

const ocrInput = document.getElementById('ocr-input');
const ocrStatus = document.getElementById('ocr-status');
ocrInput.addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    ocrStatus.innerHTML = `Lendo imagem...`;
    try {
        const { data: { text } } = await Tesseract.recognize(file, 'por');
        const matches = text.match(/\b\d{1,3}(?:\.\d{3})*,\d{2}\b/g);
        if (matches && matches.length > 0) {
            let maior = 0; matches.forEach(m => { let f = parseFloat(m.replace(/\./g, '').replace(',', '.')); if (f > maior) maior = f; });
            document.getElementById('valor').value = maior; ocrStatus.innerHTML = `<span style="color:var(--primary);">✔ R$ ${maior.toFixed(2)}</span>`; document.getElementById('descricao').value = "Compra Lida";
        } else { ocrStatus.innerHTML = `<span style="color:#d32f2f;">Valor não encontrado.</span>`; }
    } catch (err) { ocrStatus.innerHTML = "Erro."; }
    ocrInput.value = ""; 
});

// --- CATEGORIAS ---
const tipoSelect = document.getElementById('tipo');
const categoriaSelect = document.getElementById('categoria');
const categoriasConfig = {
    entrada: [{ value: 'salario', label: 'Salario' }, { value: 'vale', label: 'Vale' }, { value: 'pix', label: 'Pix' }, { value: 'mei', label: 'Receita MEI' }, { value: 'dividendos', label: 'Dividendos' }],
    saida: [{ value: 'alimentacao', label: 'Alimentação' }, { value: 'lazer', label: 'Lazer' }, { value: 'veiculo', label: 'Veículo' }, { value: 'despesa', label: 'Despesa' }, { value: 'saude', label: 'Saúde' }, { value: 'agua', label: 'Agua' }, { value: 'luz', label: 'Luz' }, { value: 'internet', label: 'Internet' }, { value: 'iptu', label: 'IPTU' }, { value: 'tax_lixo', label: 'TAX LIXO' }, { value: 'investimento', label: 'Aporte' }]
};
function atualizarOpcoesCategoria() {
    categoriaSelect.innerHTML = ''; categoriasConfig[tipoSelect.value].forEach(cat => {
        const opt = document.createElement('option'); opt.value = cat.value; opt.textContent = cat.label; categoriaSelect.appendChild(opt);
    });
}
tipoSelect.addEventListener('change', atualizarOpcoesCategoria); atualizarOpcoesCategoria();

// --- PAGAMENTOS (1 Clique) ---
window.pagarDespesa = async function(id) {
    const d = despesasFixas.find(x => x.id === id);
    if(d && !d.pago) {
        const v = await window.customPrompt("Pagar", `${d.descricao}:`, d.valor, "number");
        if(v) {
            transacoes.push({ id: Date.now(), tipo: 'saida', descricao: `Pago: ${d.descricao}`, valor: parseFloat(v), categoria: 'despesa', categoriaNome: 'Conta Fixa', data: new Date().toLocaleDateString('en-CA') });
            d.pago = true; window.salvarTudo(); atualizarInterface();
        }
    }
};

window.pagarCartao = async function(id) {
    const c = cartoes.find(x => x.id === id);
    if(c && !c.pago) {
        const v = await window.customPrompt("Pagar", `${c.nome}:`, c.valor, "number");
        if(v) {
            transacoes.push({ id: Date.now(), tipo: 'saida', descricao: `Fatura: ${c.nome}`, valor: parseFloat(v), categoria: 'despesa', categoriaNome: 'Cartão', data: new Date().toLocaleDateString('en-CA') });
            c.pago = true; window.salvarTudo(); atualizarInterface();
        }
    }
};

// --- SUBMITS DOS FORMULÁRIOS ---
formLancamento.addEventListener('submit', async (e) => {
    e.preventDefault();
    const cat = document.getElementById('categoria');
    transacoes.push({ id: Date.now(), tipo: document.getElementById('tipo').value, descricao: document.getElementById('descricao').value, valor: parseFloat(document.getElementById('valor').value), categoria: cat.value, categoriaNome: cat.options[cat.selectedIndex].text, data: document.getElementById('data').value });
    await window.salvarTudo(); formLancamento.reset(); initDatas(); atualizarOpcoesCategoria(); atualizarInterface();
    document.querySelector('[data-target="lobby-inicio"]').click();
});

formInvestimento.addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = parseFloat(document.getElementById('inv-valor').value); const q = parseFloat(document.getElementById('inv-quantidade').value); const a = document.getElementById('inv-ativo').value;
    const iId = Date.now(); const tId = iId + 1; 
    investimentos.push({ id: iId, idTransacaoVinculada: tId, ativo: a, categoria: document.getElementById('inv-categoria').value, quantidade: q, valorAporte: v, valorAtual: v });
    transacoes.push({ id: tId, tipo: 'saida', descricao: `Aporte: ${a}`, valor: v, categoria: 'investimento', categoriaNome: 'Aporte', data: new Date().toISOString().split('T')[0] });
    await window.salvarTudo(); formInvestimento.reset(); atualizarInterface();
});

formDespesaFixa.addEventListener('submit', async (e) => {
    e.preventDefault();
    despesasFixas.push({ id: Date.now(), descricao: document.getElementById('df-descricao').value, valor: parseFloat(document.getElementById('df-valor').value), dataVencimento: document.getElementById('df-vencimento').value, pago: false });
    await window.salvarTudo(); formDespesaFixa.reset(); initDatas(); atualizarInterface();
});

formCartao.addEventListener('submit', async (e) => {
    e.preventDefault();
    cartoes.push({ id: Date.now(), nome: document.getElementById('cc-nome').value, valor: parseFloat(document.getElementById('cc-valor').value), dataVencimento: document.getElementById('cc-vencimento').value, pago: false });
    await window.salvarTudo(); formCartao.reset(); initDatas(); atualizarInterface();
});

// Funções de Exclusão
window.salvarMetas = async function() { metas['Renda Fixa'] = parseFloat(document.getElementById('meta-rf').value)||0; metas['Ações'] = parseFloat(document.getElementById('meta-acoes').value)||0; metas['FIIs'] = parseFloat(document.getElementById('meta-fiis').value)||0; metas['Cripto'] = parseFloat(document.getElementById('meta-cripto').value)||0; window.salvarTudo(); atualizarInterface(); };
window.deletarTransacao = async function(id) { if(await window.customConfirm("Excluir lançamento?")) { transacoes = transacoes.filter(t => t.id !== id); window.salvarTudo(); atualizarInterface(); } };
window.deletarInvestimento = async function(id) { if(await window.customConfirm("Excluir ativo?")) { const inv = investimentos.find(i => i.id === id); investimentos = investimentos.filter(i => i.id !== id); if (inv?.idTransacaoVinculada) transacoes = transacoes.filter(t => t.id !== inv.idTransacaoVinculada); window.salvarTudo(); atualizarInterface(); } };
window.deletarDespesaFixa = async function(id) { if(await window.customConfirm("Deletar conta?")) { despesasFixas = despesasFixas.filter(d => d.id !== id); window.salvarTudo(); atualizarInterface(); } };
window.deletarCartao = async function(id) { if(await window.customConfirm("Deletar fatura?")) { cartoes = cartoes.filter(c => c.id !== id); window.salvarTudo(); atualizarInterface(); } };
window.atualizarCotacao = async function(id) { const inv = investimentos.find(i => i.id === id); if(inv) { const nv = await window.customPrompt("Manual", `${inv.ativo}:`, inv.valorAtual, "number"); if(nv) { inv.valorAtual = parseFloat(nv); window.salvarTudo(); atualizarInterface(); } } };

// --- GRÁFICOS ---
let chartE = null; let chartS = null;
function renderizarGraficos(de, ds) {
    const ce = document.getElementById('grafico-entradas').getContext('2d'); const cs = document.getElementById('grafico-saidas').getContext('2d');
    if (chartE) chartE.destroy(); if (chartS) chartS.destroy();
    const config = { type: 'pie', options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } } };
    const p = ['#2e7d32', '#1976d2', '#fbc02d', '#d32f2f', '#8e24aa', '#f57c00'];
    chartE = new Chart(ce, { ...config, data: { labels: Object.keys(de), datasets: [{ data: Object.values(de), backgroundColor: p }] } });
    chartS = new Chart(cs, { ...config, data: { labels: Object.keys(ds), datasets: [{ data: Object.values(ds), backgroundColor: p.reverse() }] } });
}

// --- ATUALIZAÇÃO DA INTERFACE ---
function atualizarInterface() {
    listaTransacoes.innerHTML = ''; listaInvestimentos.innerHTML = ''; analiseCarteiraEl.innerHTML = ''; listaBensDireitosEl.innerHTML = ''; 
    listaDespesasFixas.innerHTML = ''; listaCartoes.innerHTML = ''; areaAlertas.innerHTML = '';
    
    let saldoG = 0; let patM = 0; let patA = 0; let totalInvestidoReserva = 0;
    const mf = document.getElementById('mes-filtro').value; 
    const mfc = document.getElementById('mes-filtro-contas').value; 
    const mfk = document.getElementById('mes-filtro-cartoes').value; 
    let em = 0; let sm = 0; let dem = {}; let dsm = {};
    const hojeMs = new Date(new Date().toLocaleDateString('en-CA') + "T00:00:00").getTime();

    // 1. Transações Globais
    transacoes.forEach(t => {
        if(t.tipo === 'entrada') saldoG += t.valor; else saldoG -= t.valor;
        if (t.data.slice(0,7) === mf) {
            if(t.tipo === 'entrada') { em += t.valor; dem[t.categoriaNome] = (dem[t.categoriaNome] || 0) + t.valor; }
            else { sm += t.valor; dsm[t.categoriaNome] = (dsm[t.categoriaNome] || 0) + t.valor; }
        }
    });
    
    // Extrato Home (Últimas 10)
    [...transacoes].sort((a,b) => b.id - a.id).slice(0,10).forEach(t => {
        listaTransacoes.innerHTML += `<div style="padding:0.8rem; border-bottom:1px solid #eee; display:flex; justify-content:space-between;"><div><strong>${t.descricao}</strong><br><small>${t.data.split('-').reverse().join('/')}</small></div><div style="font-weight:bold; color:${t.tipo==='entrada'?'var(--primary)':'#d32f2f'}">${t.tipo==='entrada'?'+':'-'} ${formatarMoeda(t.valor)}</div></div>`;
    });

    renderizarGraficos(dem, dsm);

    // 2. Investimentos e Reserva
    let ativosAgrupadosIR = {};
    investimentos.forEach(inv => {
        totalInvestidoReserva += inv.valorAtual;
        patM += inv.valorAtual; patA += inv.valorAporte;
        ativosAgrupadosIR[inv.ativo] = (ativosAgrupadosIR[inv.ativo] || 0) + inv.valorAporte;
        
        listaInvestimentos.innerHTML += `<div style="padding:0.8rem; border-bottom:1px solid #eee; display:flex; justify-content:space-between;"><div><strong>${inv.ativo}</strong><br><small>Qtd: ${inv.quantidade}</small></div><div style="text-align:right;"><strong>${formatarMoeda(inv.valorAtual)}</strong><br><button class="btn-small" onclick="atualizarCotacao(${inv.id})">Editar</button> <button class="btn-delete" onclick="deletarInvestimento(${inv.id})" style="display:inline;"><span class="material-icons" style="font-size:1rem;">delete</span></button></div></div>`;
    });

    // 3. Contas (Alertas e Lista)
    despesasFixas.forEach(d => {
        if (d.dataVencimento.slice(0,7) === mfc) {
            listaDespesasFixas.innerHTML += `<div style="padding:0.8rem; border-bottom:1px solid #eee; display:flex; justify-content:space-between;"><div><strong>${d.descricao}</strong><br><small>${d.dataVencimento.split('-').reverse().join('/')}</small></div><div style="display:flex; gap:10px; align-items:center;"><span style="color:#d32f2f; font-weight:bold;">${formatarMoeda(d.valor)}</span> ${d.pago?'<span style="color:var(--primary); font-size:0.8rem;">Pago</span>':`<button class="btn-small" style="background:var(--primary);color:white;" onclick="pagarDespesa(${d.id})">Pagar</button>`}</div></div>`;
        }
        if(!d.pago) {
            const dv = new Date(d.dataVencimento + "T00:00:00").getTime();
            const df = Math.ceil((dv - hojeMs) / 86400000);
            if (df <= 7) areaAlertas.innerHTML += `<div class="card" style="border-left:4px solid #f57c00; background:#fff3e0; padding:1rem; margin-bottom:5px;">⚠️ <strong>${d.descricao}</strong> vence em ${df === 0 ? 'HOJE' : df + ' dias'}</div>`;
        }
    });

    // 4. Cartões (Alertas e Lista)
    cartoes.forEach(c => {
        if (c.dataVencimento.slice(0,7) === mfk) {
            listaCartoes.innerHTML += `<div style="padding:0.8rem; border-bottom:1px solid #eee; display:flex; justify-content:space-between;"><div><strong>${c.nome}</strong><br><small>${c.dataVencimento.split('-').reverse().join('/')}</small></div><div style="display:flex; gap:10px; align-items:center;"><span style="color:#d32f2f; font-weight:bold;">${formatarMoeda(c.valor)}</span> ${c.pago?'<span style="color:var(--primary); font-size:0.8rem;">Pago</span>':`<button class="btn-small" style="background:var(--primary);color:white;" onclick="pagarCartao(${c.id})">Pagar</button>`}</div></div>`;
        }
        if(!c.pago) {
            const dv = new Date(c.dataVencimento + "T00:00:00").getTime();
            const df = Math.ceil((dv - hojeMs) / 86400000);
            if (df <= 7) areaAlertas.innerHTML += `<div class="card" style="border-left:4px solid #1976d2; background:#e3f2fd; padding:1rem; margin-bottom:5px;">💳 <strong>Cartão ${c.nome}</strong> vence em ${df === 0 ? 'HOJE' : df + ' dias'}</div>`;
        }
    });

    // Atualiza Painéis
    saldoAtualEl.textContent = formatarMoeda(saldoG); 
    totalEntradasMesEl.textContent = formatarMoeda(em); 
    totalSaidasMesEl.textContent = formatarMoeda(sm);
    patrimonioTotalEl.textContent = formatarMoeda(patM);

    const pr = (totalInvestidoReserva / META_RESERVA) * 100;
    barraReserva.value = Math.min(pr, 100);
    textoReserva.textContent = `${pr.toFixed(1)}% da meta (Valor Atual: ${formatarMoeda(totalInvestidoReserva)})`;

    // IR 
    if (saldoG > 0) listaBensDireitosEl.innerHTML += `<div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px dashed #ccc;"><span>Conta Corrente</span><strong>${formatarMoeda(saldoG)}</strong></div>`;
    for (let at in ativosAgrupadosIR) listaBensDireitosEl.innerHTML += `<div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px dashed #ccc;"><span>${at}</span><strong>${formatarMoeda(ativosAgrupadosIR[at])}</strong></div>`;
}

// INICIA TUDO
carregarDadosDoFirebase();