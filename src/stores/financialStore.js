// ═══════════════════════════════════════════════
// PIXICO BARBER — Financial Store
// ═══════════════════════════════════════════════
import { criarTransacao } from '../data/models.js';

const STORAGE_KEY = 'pixico_financeiro';

function load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch { return []; }
}

function save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

const financialStore = {
    getAll() { return load(); },

    create(data) {
        const items = load();
        const tx = criarTransacao(data);
        items.unshift(tx);
        save(items);
        return tx;
    },

    registrarEntradaServico(agendamento) {
        return this.create({
            tipo: 'entrada',
            categoria: 'servico',
            descricao: `${agendamento.servicoNome} — ${agendamento.data}`,
            valor: agendamento.valorCobrado,
            formaPagamento: agendamento.formaPagamento,
            agendamentoId: agendamento.id,
            clienteId: agendamento.clienteId,
        });
    },

    registrarDespesa({ descricao, valor, categoria }) {
        return this.create({
            tipo: 'saida',
            categoria: categoria || 'despesa',
            descricao,
            valor,
        });
    },

    delete(id) {
        save(load().filter(t => t.id !== id));
    },

    // ─── Queries ───
    getEntradas() { return load().filter(t => t.tipo === 'entrada'); },
    getSaidas() { return load().filter(t => t.tipo === 'saida'); },

    getPorPeriodo(inicio, fim) {
        return load().filter(t => {
            const d = t.criadoEm.split('T')[0];
            return d >= inicio && d <= fim;
        });
    },

    getStats(periodo) {
        const hoje = new Date();
        let inicio, fim;

        if (periodo === 'dia') {
            inicio = fim = hoje.toISOString().split('T')[0];
        } else if (periodo === 'semana') {
            const d = new Date(hoje);
            d.setDate(hoje.getDate() - hoje.getDay());
            inicio = d.toISOString().split('T')[0];
            fim = hoje.toISOString().split('T')[0];
        } else if (periodo === 'mes') {
            inicio = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`;
            fim = hoje.toISOString().split('T')[0];
        } else {
            inicio = '2020-01-01';
            fim = '2099-12-31';
        }

        const txs = this.getPorPeriodo(inicio, fim);
        const entradas = txs.filter(t => t.tipo === 'entrada');
        const saidas = txs.filter(t => t.tipo === 'saida');
        const totalEntradas = entradas.reduce((s, t) => s + t.valor, 0);
        const totalSaidas = saidas.reduce((s, t) => s + t.valor, 0);

        return {
            totalEntradas,
            totalSaidas,
            lucro: totalEntradas - totalSaidas,
            qtdEntradas: entradas.length,
            qtdSaidas: saidas.length,
            ticketMedio: entradas.length ? totalEntradas / entradas.length : 0,
        };
    },

    getPorServico() {
        const entradas = this.getEntradas();
        const agrupado = {};
        entradas.forEach(t => {
            const key = t.descricao?.split(' — ')[0] || 'Outros';
            if (!agrupado[key]) agrupado[key] = { total: 0, qtd: 0 };
            agrupado[key].total += t.valor;
            agrupado[key].qtd++;
        });
        return agrupado;
    },

    getPorFormaPagamento() {
        const entradas = this.getEntradas();
        const agrupado = {};
        entradas.forEach(t => {
            const key = t.formaPagamento || 'Não informado';
            if (!agrupado[key]) agrupado[key] = { total: 0, qtd: 0 };
            agrupado[key].total += t.valor;
            agrupado[key].qtd++;
        });
        return agrupado;
    },
};

export default financialStore;
