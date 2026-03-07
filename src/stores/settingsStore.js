// ═══════════════════════════════════════════════
// PIXICO BARBER — Settings Store
// ═══════════════════════════════════════════════

const STORAGE_KEY = 'pixico_settings';

function getDefaults() {
    return {
        blacklistBehavior: 'approval', // 'block' | 'approval'
        // 'block' = bloqueia totalmente novos pedidos
        // 'approval' = permite pedido mas exige aprovação manual

        whatsappNumero: '5571994096863',
        nomeNegocio: 'PIXICO Barber',
        endereco: 'Salvador — Itacaranha',

        // Mensagens editáveis (override dos templates padrão)
        templateOverrides: {},

        // Notificações
        notifSom: true,
        notifEmail: false,
    };
}

function load() {
    try {
        return { ...getDefaults(), ...(JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}) };
    } catch { return getDefaults(); }
}

function save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

const settingsStore = {
    get() { return load(); },

    update(updates) {
        const current = load();
        const updated = { ...current, ...updates };
        save(updated);
        return updated;
    },

    getBlacklistBehavior() { return load().blacklistBehavior; },
    setBlacklistBehavior(behavior) { return this.update({ blacklistBehavior: behavior }); },

    getTemplateOverride(key) { return load().templateOverrides?.[key] || null; },
    setTemplateOverride(key, template) {
        const current = load();
        current.templateOverrides = current.templateOverrides || {};
        current.templateOverrides[key] = template;
        save(current);
    },

    reset() {
        save(getDefaults());
        return getDefaults();
    },
};

export default settingsStore;
