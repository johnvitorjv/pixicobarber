// ═══════════════════════════════════════════════
// PIXICO BARBER — Notification Store
// ═══════════════════════════════════════════════
import { criarNotificacao } from '../data/models.js';

const STORAGE_KEY = 'pixico_notifications';

function load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch { return []; }
}

function save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

const notificationStore = {
    getAll() { return load(); },

    create(data) {
        const items = load();
        const notif = criarNotificacao(data);
        items.unshift(notif);
        save(items);
        return notif;
    },

    marcarLida(id) {
        const items = load();
        const idx = items.findIndex(n => n.id === id);
        if (idx === -1) return null;
        items[idx].lida = true;
        save(items);
        return items[idx];
    },

    marcarTodasLidas(destinatario) {
        const items = load();
        items.forEach(n => {
            if (n.destinatario === destinatario) n.lida = true;
        });
        save(items);
    },

    delete(id) {
        save(load().filter(n => n.id !== id));
    },

    limparLidas(destinatario) {
        save(load().filter(n => !(n.destinatario === destinatario && n.lida)));
    },

    // ─── Queries ───
    getParaAdmin() { return load().filter(n => n.destinatario === 'admin'); },
    getParaCliente(clienteId) { return load().filter(n => n.destinatario === clienteId); },
    getNaoLidasAdmin() { return this.getParaAdmin().filter(n => !n.lida); },
    getNaoLidasCliente(clienteId) { return this.getParaCliente(clienteId).filter(n => !n.lida); },

    getContadorAdmin() { return this.getNaoLidasAdmin().length; },
    getContadorCliente(clienteId) { return this.getNaoLidasCliente(clienteId).length; },
};

export default notificationStore;
