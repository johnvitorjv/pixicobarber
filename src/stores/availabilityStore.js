// ═══════════════════════════════════════════════
// PIXICO BARBER — Availability Store
// ═══════════════════════════════════════════════

const STORAGE_KEY = 'pixico_availability';
const CONFIG_KEY = 'pixico_avail_config';

function load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch { return {}; }
}

function save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadConfig() {
    try {
        return JSON.parse(localStorage.getItem(CONFIG_KEY)) || getDefaultConfig();
    } catch { return getDefaultConfig(); }
}

function saveConfig(config) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

function getDefaultConfig() {
    return {
        diasFuncionamento: [2, 3, 4, 5, 6], // Ter-Sáb (0=Dom, 1=Seg)
        horarioInicio: '09:00',
        horarioFim: '18:00',
        intervaloAlmoco: { inicio: '12:00', fim: '14:00' },
        duracaoSlot: 30, // minutos
        limiteClientesDia: 16,
        limiteClientesTurno: 8,
        bloqueiosEspeciais: [], // [{ data, motivo }]
        ferias: [], // [{ inicio, fim }]
    };
}

// Gera faixas de horário baseado na config
function gerarFaixas(config) {
    const faixas = [];
    const [hI, mI] = config.horarioInicio.split(':').map(Number);
    const [hF, mF] = config.horarioFim.split(':').map(Number);
    const [hAI, mAI] = config.intervaloAlmoco.inicio.split(':').map(Number);
    const [hAF, mAF] = config.intervaloAlmoco.fim.split(':').map(Number);
    const almocoInicio = hAI * 60 + mAI;
    const almocoFim = hAF * 60 + mAF;

    let current = hI * 60 + mI;
    const end = hF * 60 + mF;
    let idx = 0;

    while (current + config.duracaoSlot <= end) {
        const slotEnd = current + config.duracaoSlot;
        // Pular se cai no intervalo de almoço
        if (!(current >= almocoInicio && current < almocoFim)) {
            const inicioStr = `${String(Math.floor(current / 60)).padStart(2, '0')}:${String(current % 60).padStart(2, '0')}`;
            const fimStr = `${String(Math.floor(slotEnd / 60)).padStart(2, '0')}:${String(slotEnd % 60).padStart(2, '0')}`;
            faixas.push({
                id: `slot-${idx}`,
                inicio: inicioStr,
                fim: fimStr,
                disponivel: true,
            });
            idx++;
        }
        current = slotEnd;
    }
    return faixas;
}

const availabilityStore = {
    getConfig() { return loadConfig(); },

    saveConfig(config) {
        saveConfig(config);
        return config;
    },

    // Retorna disponibilidade de uma data
    getDay(dateStr) {
        const overrides = load();
        if (overrides[dateStr]) return overrides[dateStr];

        const config = loadConfig();
        const date = new Date(dateStr + 'T12:00:00');
        const diaSemana = date.getDay();

        // Verificar se está nas férias
        for (const f of config.ferias || []) {
            if (dateStr >= f.inicio && dateStr <= f.fim) {
                return { disponivel: false, motivo: 'Férias', faixas: [] };
            }
        }

        // Bloqueios especiais
        const bloqueio = (config.bloqueiosEspeciais || []).find(b => b.data === dateStr);
        if (bloqueio) {
            return { disponivel: false, motivo: bloqueio.motivo || 'Bloqueado', faixas: [] };
        }

        // Dia normal de funcionamento?
        if (!config.diasFuncionamento.includes(diaSemana)) {
            return { disponivel: false, motivo: 'Fechado', faixas: [] };
        }

        return { disponivel: true, faixas: gerarFaixas(config) };
    },

    // Override manual para uma data
    setDay(dateStr, data) {
        const overrides = load();
        overrides[dateStr] = data;
        save(overrides);
        return data;
    },

    // Bloquear faixa específica em uma data
    blockSlot(dateStr, slotId) {
        const day = this.getDay(dateStr);
        if (!day.disponivel) return day;
        day.faixas = day.faixas.map(f => f.id === slotId ? { ...f, disponivel: false } : f);
        this.setDay(dateStr, day);
        return day;
    },

    // Liberar faixa específica
    unblockSlot(dateStr, slotId) {
        const day = this.getDay(dateStr);
        day.faixas = day.faixas.map(f => f.id === slotId ? { ...f, disponivel: true } : f);
        this.setDay(dateStr, day);
        return day;
    },

    // Fechar dia
    closeDay(dateStr, motivo) {
        this.setDay(dateStr, { disponivel: false, motivo: motivo || 'Fechado pelo admin', faixas: [] });
    },

    // Abrir dia (reset ao padrão)
    openDay(dateStr) {
        const overrides = load();
        delete overrides[dateStr];
        save(overrides);
    },

    // Disponibilidade dos próximos N dias
    getRange(days = 30) {
        const result = {};
        const hoje = new Date();
        for (let i = 0; i < days; i++) {
            const d = new Date(hoje);
            d.setDate(hoje.getDate() + i);
            const key = d.toISOString().split('T')[0];
            result[key] = this.getDay(key);
        }
        return result;
    },

    addBloqueioEspecial(data, motivo) {
        const config = loadConfig();
        config.bloqueiosEspeciais = config.bloqueiosEspeciais || [];
        config.bloqueiosEspeciais.push({ data, motivo });
        saveConfig(config);
    },

    removeBloqueioEspecial(data) {
        const config = loadConfig();
        config.bloqueiosEspeciais = (config.bloqueiosEspeciais || []).filter(b => b.data !== data);
        saveConfig(config);
    },

    addFerias(inicio, fim) {
        const config = loadConfig();
        config.ferias = config.ferias || [];
        config.ferias.push({ inicio, fim });
        saveConfig(config);
    },

    removeFerias(inicio) {
        const config = loadConfig();
        config.ferias = (config.ferias || []).filter(f => f.inicio !== inicio);
        saveConfig(config);
    },
};

export default availabilityStore;
