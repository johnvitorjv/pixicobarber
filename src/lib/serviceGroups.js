const ESTETICA = new Set(['freestyle', 'platinado', 'luzes', 'pigmentacao']);

const GROUP_ORDER = {
    avulsos: [
        'corte',
        'barba',
        'pezinhoacabamento',
        'navalhado',
        'tesouraemaquina',
        'tesoura',
        'navalhadotesoura',
        'bigodin',
        'cortecrianca',
    ],
    combos: [
        'cortebigodinsobrancelha',
        'cortebarbasobrancelha',
        'cabelobarba',
        'pebarbasobrancelha',
        'cortebarbasobrancelhapigmentacao',
    ],
    estetica: ['freestyle', 'platinado', 'luzes', 'pigmentacao'],
};

function normalize(value = '') {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function serviceKey(service) {
    return normalize(service?.nome).replace(/[^a-z0-9]/g, '');
}

export const SERVICE_GROUPS = [
    {
        id: 'avulsos',
        label: 'Serviços avulsos',
        description: 'Cortes e serviços individuais para montar o atendimento do seu jeito.',
    },
    {
        id: 'combos',
        label: 'Combos',
        description: 'Combinações prontas com mais de um serviço.',
    },
    {
        id: 'estetica',
        label: 'Estética',
        description: 'Freestyle, platinado, luzes e pigmentação.',
    },
];

export function getServiceGroup(service) {
    if (!service) return 'avulsos';
    if (service.categoria === 'combo') return 'combos';
    if (ESTETICA.has(normalize(service.nome))) return 'estetica';
    return 'avulsos';
}

function sortGroup(groupId, services) {
    const order = GROUP_ORDER[groupId] || [];
    return [...services].sort((a, b) => {
        const ai = order.indexOf(serviceKey(a));
        const bi = order.indexOf(serviceKey(b));
        if (ai !== -1 || bi !== -1) {
            if (ai === -1) return 1;
            if (bi === -1) return -1;
            if (ai !== bi) return ai - bi;
        }
        return Number(a.ordem || 0) - Number(b.ordem || 0) || String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
    });
}

export function groupServices(services = []) {
    return SERVICE_GROUPS
        .map(group => ({
            ...group,
            services: sortGroup(group.id, services.filter(service => getServiceGroup(service) === group.id)),
        }))
        .filter(group => group.services.length > 0);
}
