// ═══════════════════════════════════════════════
// PIXICO BARBER — Service Store
// Store reativo para gestão de serviços via localStorage
// ═══════════════════════════════════════════════

const STORAGE_KEY = 'pixico_services';

function load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch { return []; }
}

function save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// Dados padrão (seed inicial — migração dos hardcoded)
const DEFAULT_SERVICES = [
    {
        id: 'corte', nome: 'Corte',
        descricaoCurta: 'Corte estrutural com precisão e acabamento impecável.',
        descricaoDetalhada: 'Corte estrutural com técnica apurada e acabamento impecável. Cada detalhe pensado para valorizar seu estilo.',
        preco: 60, precoPromocional: null, duracao: 30,
        categoria: 'corte', status: 'ativo', ordem: 1,
        imagemUrl: null, destaque: true,
        badge: null, visivelHome: true, visivelCliente: true, visivelAgendamento: true,
    },
    {
        id: 'barba', nome: 'Barba',
        descricaoCurta: 'Design de barba com definição linear e alinhamento perfeito.',
        descricaoDetalhada: 'Design de barba com definição linear e alinhamento perfeito. Acabamento feito com navalha para resultado preciso.',
        preco: 50, precoPromocional: null, duracao: 30,
        categoria: 'barba', status: 'ativo', ordem: 2,
        imagemUrl: null, destaque: true,
        badge: null, visivelHome: true, visivelCliente: true, visivelAgendamento: true,
    },
    {
        id: 'corte-barba', nome: 'Corte + Barba',
        descricaoCurta: 'O combo completo: corte estrutural e barba alinhada.',
        descricaoDetalhada: 'A experiência completa: corte estrutural e barba alinhada em uma única sessão de atendimento.',
        preco: 100, precoPromocional: null, duracao: 60,
        categoria: 'combo', status: 'ativo', ordem: 3,
        imagemUrl: null, destaque: true,
        badge: 'mais pedido', visivelHome: true, visivelCliente: true, visivelAgendamento: true,
    },
    {
        id: 'sobrancelha', nome: 'Sobrancelha',
        descricaoCurta: 'Design e limpeza de sobrancelha com acabamento preciso.',
        descricaoDetalhada: 'Design e limpeza de sobrancelha com acabamento preciso para um visual limpo e definido.',
        preco: 20, precoPromocional: null, duracao: 15,
        categoria: 'complemento', status: 'ativo', ordem: 4,
        imagemUrl: null, destaque: false,
        badge: null, visivelHome: false, visivelCliente: true, visivelAgendamento: true,
    },
    {
        id: 'pigmentacao', nome: 'Pigmentação',
        descricaoCurta: 'Pigmentação capilar para definição e preenchimento natural.',
        descricaoDetalhada: 'Pigmentação capilar avançada para definição, preenchimento natural e aparência mais densa.',
        preco: 80, precoPromocional: null, duracao: 45,
        categoria: 'tratamento', status: 'ativo', ordem: 5,
        imagemUrl: null, destaque: false,
        badge: 'premium', visivelHome: false, visivelCliente: true, visivelAgendamento: true,
    },
    {
        id: 'acabamento', nome: 'Acabamento',
        descricaoCurta: 'Acabamento detalhado para manter seu corte sempre afiado.',
        descricaoDetalhada: 'Acabamento detalhado com navalha e máquina para manter seu corte sempre afiado entre as visitas.',
        preco: 30, precoPromocional: null, duracao: 20,
        categoria: 'complemento', status: 'ativo', ordem: 6,
        imagemUrl: null, destaque: false,
        badge: null, visivelHome: false, visivelCliente: true, visivelAgendamento: true,
    },
    {
        id: 'corte-infantil', nome: 'Corte Infantil',
        descricaoCurta: 'Corte para os pequenos com atenção e cuidado.',
        descricaoDetalhada: 'Corte para os pequenos com atenção, cuidado e ambiente acolhedor.',
        preco: 40, precoPromocional: null, duracao: 30,
        categoria: 'corte', status: 'ativo', ordem: 7,
        imagemUrl: null, destaque: false,
        badge: 'infantil', visivelHome: false, visivelCliente: true, visivelAgendamento: true,
    },
];

const CATEGORIAS = [
    { id: 'corte', label: 'Corte' },
    { id: 'barba', label: 'Barba' },
    { id: 'combo', label: 'Combo' },
    { id: 'complemento', label: 'Complemento' },
    { id: 'tratamento', label: 'Tratamento' },
];

const BADGES = [
    { id: 'mais pedido', label: 'Mais Pedido' },
    { id: 'premium', label: 'Premium' },
    { id: 'infantil', label: 'Infantil' },
    { id: 'novo', label: 'Novo' },
    { id: 'transformação', label: 'Transformação' },
    { id: 'promoção', label: 'Promoção' },
];

const serviceStore = {
    // ─── CRUD ───
    getAll() { return load().sort((a, b) => (a.ordem || 0) - (b.ordem || 0)); },

    getById(id) { return load().find(s => s.id === id) || null; },

    getAtivos() { return this.getAll().filter(s => s.status === 'ativo'); },

    getVisiveis(contexto) {
        const ativos = this.getAtivos();
        switch (contexto) {
            case 'home': return ativos.filter(s => s.visivelHome);
            case 'cliente': return ativos.filter(s => s.visivelCliente);
            case 'agendamento': return ativos.filter(s => s.visivelAgendamento);
            default: return ativos;
        }
    },

    create(data) {
        const items = load();
        const maxOrdem = items.reduce((max, s) => Math.max(max, s.ordem || 0), 0);
        const servico = {
            id: `srv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            nome: data.nome || 'Novo Serviço',
            descricaoCurta: data.descricaoCurta || '',
            descricaoDetalhada: data.descricaoDetalhada || '',
            preco: data.preco || 0,
            precoPromocional: data.precoPromocional || null,
            duracao: data.duracao || 30,
            categoria: data.categoria || 'corte',
            status: data.status || 'ativo',
            ordem: data.ordem || maxOrdem + 1,
            imagemUrl: data.imagemUrl || null,
            destaque: data.destaque || false,
            badge: data.badge || null,
            visivelHome: data.visivelHome !== undefined ? data.visivelHome : true,
            visivelCliente: data.visivelCliente !== undefined ? data.visivelCliente : true,
            visivelAgendamento: data.visivelAgendamento !== undefined ? data.visivelAgendamento : true,
            criadoEm: new Date().toISOString(),
            atualizadoEm: new Date().toISOString(),
        };
        items.push(servico);
        save(items);
        return servico;
    },

    update(id, updates) {
        const items = load();
        const idx = items.findIndex(s => s.id === id);
        if (idx === -1) return null;
        items[idx] = { ...items[idx], ...updates, atualizadoEm: new Date().toISOString() };
        save(items);
        return items[idx];
    },

    delete(id) {
        const items = load().filter(s => s.id !== id);
        save(items);
    },

    toggleStatus(id) {
        const item = this.getById(id);
        if (!item) return null;
        return this.update(id, { status: item.status === 'ativo' ? 'inativo' : 'ativo' });
    },

    duplicate(id) {
        const original = this.getById(id);
        if (!original) return null;
        const { id: _, criadoEm, atualizadoEm, ...rest } = original;
        return this.create({ ...rest, nome: `${rest.nome} (cópia)` });
    },

    reorder(orderedIds) {
        const items = load();
        orderedIds.forEach((id, index) => {
            const item = items.find(s => s.id === id);
            if (item) item.ordem = index + 1;
        });
        save(items);
    },

    moveUp(id) {
        const items = this.getAll();
        const idx = items.findIndex(s => s.id === id);
        if (idx <= 0) return;
        const prevOrdem = items[idx - 1].ordem;
        this.update(items[idx - 1].id, { ordem: items[idx].ordem });
        this.update(id, { ordem: prevOrdem });
    },

    moveDown(id) {
        const items = this.getAll();
        const idx = items.findIndex(s => s.id === id);
        if (idx === -1 || idx >= items.length - 1) return;
        const nextOrdem = items[idx + 1].ordem;
        this.update(items[idx + 1].id, { ordem: items[idx].ordem });
        this.update(id, { ordem: nextOrdem });
    },

    // ─── Queries ───
    getCategorias() { return CATEGORIAS; },
    getBadges() { return BADGES; },

    getStats() {
        const all = load();
        return {
            total: all.length,
            ativos: all.filter(s => s.status === 'ativo').length,
            inativos: all.filter(s => s.status === 'inativo').length,
            comPromocao: all.filter(s => s.precoPromocional != null).length,
            destaque: all.filter(s => s.destaque).length,
        };
    },

    // ─── Seed ───
    seedDefaults() {
        const existing = load();
        if (existing.length === 0) {
            const seeded = DEFAULT_SERVICES.map(s => ({
                ...s,
                criadoEm: new Date().toISOString(),
                atualizadoEm: new Date().toISOString(),
            }));
            save(seeded);
        }
    },
};

export { CATEGORIAS, BADGES };
export default serviceStore;
