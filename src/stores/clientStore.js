// ═══════════════════════════════════════════════
// PIXICO BARBER — Client Store
// ═══════════════════════════════════════════════
import { criarCliente } from '../data/models.js';

const STORAGE_KEY = 'pixico_users';

function load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch { return []; }
}

function save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

const clientStore = {
    getAll() { return load().filter(u => u.role !== 'admin'); },

    getAllIncludingAdmin() { return load(); },

    getById(id) { return load().find(u => u.id === id) || null; },

    getByEmail(email) { return load().find(u => u.email === email.toLowerCase()) || null; },

    create(data) {
        const items = load();
        if (items.find(u => u.email === data.email.toLowerCase())) {
            return { success: false, error: 'Este e-mail já está cadastrado.' };
        }
        const user = criarCliente(data);
        items.push(user);
        save(items);
        return { success: true, user };
    },

    update(id, updates) {
        const items = load();
        const idx = items.findIndex(u => u.id === id);
        if (idx === -1) return null;
        // Não permitir sobrescrever role/senha por aqui
        const { role, senha, ...safeUpdates } = updates;
        items[idx] = { ...items[idx], ...safeUpdates, ultimaAtividade: new Date().toISOString() };
        save(items);
        return items[idx];
    },

    toggleFavorito(id) {
        const items = load();
        const idx = items.findIndex(u => u.id === id);
        if (idx === -1) return null;
        items[idx].favorito = !items[idx].favorito;
        items[idx].ultimaAtividade = new Date().toISOString();
        save(items);
        return items[idx];
    },

    setBlacklist(id, blacklist, motivo) {
        const items = load();
        const idx = items.findIndex(u => u.id === id);
        if (idx === -1) return null;
        items[idx].blacklist = blacklist;
        items[idx].blacklistMotivo = blacklist ? (motivo || null) : null;
        items[idx].blacklistData = blacklist ? new Date().toISOString() : null;
        items[idx].ultimaAtividade = new Date().toISOString();
        save(items);
        return items[idx];
    },

    setApelido(id, apelido) {
        return this.update(id, { apelido });
    },

    setObservacoes(id, observacoesAdmin) {
        return this.update(id, { observacoesAdmin });
    },

    addTag(id, tag) {
        const items = load();
        const idx = items.findIndex(u => u.id === id);
        if (idx === -1) return null;
        if (!items[idx].tags) items[idx].tags = [];
        if (!items[idx].tags.includes(tag)) items[idx].tags.push(tag);
        save(items);
        return items[idx];
    },

    removeTag(id, tag) {
        const items = load();
        const idx = items.findIndex(u => u.id === id);
        if (idx === -1) return null;
        items[idx].tags = (items[idx].tags || []).filter(t => t !== tag);
        save(items);
        return items[idx];
    },

    updateScorePresenca(id, delta) {
        const items = load();
        const idx = items.findIndex(u => u.id === id);
        if (idx === -1) return null;
        items[idx].scorePresenca = Math.max(0, Math.min(100, (items[idx].scorePresenca || 100) + delta));
        save(items);
        return items[idx];
    },

    // ─── Queries ───
    getFavoritos() { return this.getAll().filter(u => u.favorito); },
    getBlacklist() { return this.getAll().filter(u => u.blacklist); },

    getStats() {
        const all = this.getAll();
        return {
            total: all.length,
            favoritos: all.filter(u => u.favorito).length,
            blacklist: all.filter(u => u.blacklist).length,
            novosEsteMes: all.filter(u => {
                const d = new Date(u.criadoEm);
                const now = new Date();
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            }).length,
        };
    },

    // Seed admin user se não existir
    seedAdmin() {
        const items = load();
        if (!items.find(u => u.role === 'admin')) {
            items.push({
                id: 'admin',
                nome: 'Pixico',
                sobrenome: 'Admin',
                email: 'admin@pixico.com',
                senha: 'pixico2026',
                whatsapp: '5571994096863',
                role: 'admin',
                criadoEm: new Date().toISOString(),
                ultimaAtividade: new Date().toISOString(),
            });
            save(items);
        }
    },
};

export default clientStore;
