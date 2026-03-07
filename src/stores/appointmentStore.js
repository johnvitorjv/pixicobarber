// ═══════════════════════════════════════════════
// PIXICO BARBER — Appointment Store
// ═══════════════════════════════════════════════
import { STATUS, criarAgendamento } from '../data/models.js';

const STORAGE_KEY = 'pixico_appointments';

function load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch { return []; }
}

function save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

const appointmentStore = {
    getAll() { return load(); },

    getById(id) { return load().find(a => a.id === id) || null; },

    create(data) {
        const items = load();
        const ag = criarAgendamento(data);
        items.unshift(ag);
        save(items);
        return ag;
    },

    update(id, updates) {
        const items = load();
        const idx = items.findIndex(a => a.id === id);
        if (idx === -1) return null;
        items[idx] = {
            ...items[idx],
            ...updates,
            atualizadoEm: new Date().toISOString(),
        };
        save(items);
        return items[idx];
    },

    addHistorico(id, acao, por, porId, detalhes) {
        const items = load();
        const idx = items.findIndex(a => a.id === id);
        if (idx === -1) return;
        items[idx].historicoAcoes = items[idx].historicoAcoes || [];
        items[idx].historicoAcoes.push({
            acao, por, porId, em: new Date().toISOString(), ...(detalhes || {}),
        });
        items[idx].atualizadoEm = new Date().toISOString();
        save(items);
        return items[idx];
    },

    aprovar(id, observacaoAdmin) {
        const ag = this.update(id, { status: STATUS.APROVADO, observacaoAdmin });
        if (ag) this.addHistorico(id, 'aprovado', 'admin', 'admin');
        return ag;
    },

    rejeitar(id, { motivosRejeicaoIds, motivoRejeicao, sugestaoNovaData, sugestaoNovaFaixa }) {
        const novoStatus = sugestaoNovaData ? STATUS.AGUARDANDO_CLIENTE : STATUS.REJEITADO;
        const ag = this.update(id, {
            status: novoStatus,
            motivosRejeicaoIds,
            motivoRejeicao,
            sugestaoNovaData: sugestaoNovaData || null,
            sugestaoNovaFaixa: sugestaoNovaFaixa || null,
        });
        if (ag) this.addHistorico(id, novoStatus === STATUS.AGUARDANDO_CLIENTE ? 'proposta_enviada' : 'rejeitado', 'admin', 'admin', { motivoRejeicao });
        return ag;
    },

    remarcar(id, novaData, novaFaixaInicio, novaFaixaFim) {
        const ag = this.update(id, {
            status: STATUS.APROVADO,
            data: novaData,
            faixaInicio: novaFaixaInicio,
            faixaFim: novaFaixaFim,
            sugestaoNovaData: null,
            sugestaoNovaFaixa: null,
        });
        if (ag) this.addHistorico(id, 'remarcado', 'admin', 'admin');
        return ag;
    },

    concluir(id, valorCobrado, formaPagamento) {
        const ag = this.update(id, {
            status: STATUS.CONCLUIDO,
            valorCobrado,
            formaPagamento,
        });
        if (ag) this.addHistorico(id, 'concluido', 'admin', 'admin');
        return ag;
    },

    marcarNaoCompareceu(id) {
        const ag = this.update(id, { status: STATUS.NAO_COMPARECEU });
        if (ag) this.addHistorico(id, 'nao_compareceu', 'admin', 'admin');
        return ag;
    },

    cancelarPeloCliente(id, clienteId) {
        const ag = this.update(id, { status: STATUS.CANCELADO_CLIENTE });
        if (ag) this.addHistorico(id, 'cancelado_cliente', 'cliente', clienteId);
        return ag;
    },

    marcarWhatsappEnviado(id) {
        return this.update(id, { whatsappEnviado: true });
    },

    delete(id) {
        const items = load().filter(a => a.id !== id);
        save(items);
    },

    // ─── Queries ───
    getByClient(clienteId) { return load().filter(a => a.clienteId === clienteId); },
    getByDate(date) { return load().filter(a => a.data === date); },
    getByStatus(status) { return load().filter(a => a.status === status); },
    getPendentes() { return this.getByStatus(STATUS.PENDENTE); },
    getAguardandoCliente() { return this.getByStatus(STATUS.AGUARDANDO_CLIENTE); },

    getStats() {
        const all = load();
        return {
            total: all.length,
            pendentes: all.filter(a => a.status === STATUS.PENDENTE).length,
            aprovados: all.filter(a => a.status === STATUS.APROVADO).length,
            rejeitados: all.filter(a => a.status === STATUS.REJEITADO).length,
            aguardando: all.filter(a => a.status === STATUS.AGUARDANDO_CLIENTE).length,
            concluidos: all.filter(a => a.status === STATUS.CONCLUIDO).length,
            cancelados: all.filter(a => a.status === STATUS.CANCELADO_CLIENTE).length,
            naoCompareceram: all.filter(a => a.status === STATUS.NAO_COMPARECEU).length,
        };
    },

    getHoje() {
        const hoje = new Date().toISOString().split('T')[0];
        return load().filter(a => a.data === hoje && (a.status === STATUS.APROVADO || a.status === STATUS.PENDENTE))
            .sort((a, b) => a.faixaInicio.localeCompare(b.faixaInicio));
    },
};

export default appointmentStore;
