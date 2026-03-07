// ═══════════════════════════════════════════════
// PIXICO BARBER — Dados de Serviços
// ═══════════════════════════════════════════════

export const SERVICES = [
    {
        id: 'corte',
        nome: 'Corte',
        descricao: 'Corte estrutural com precisão e acabamento impecável.',
        preco: 60,
        duracao: 30, // minutos
    },
    {
        id: 'barba',
        nome: 'Barba',
        descricao: 'Design de barba com definição linear e alinhamento perfeito.',
        preco: 50,
        duracao: 30,
    },
    {
        id: 'corte-barba',
        nome: 'Corte + Barba',
        descricao: 'O combo completo: corte estrutural e barba alinhada em uma sessão.',
        preco: 100,
        duracao: 60,
    },
    {
        id: 'sobrancelha',
        nome: 'Sobrancelha',
        descricao: 'Design e limpeza de sobrancelha com acabamento preciso.',
        preco: 20,
        duracao: 15,
    },
    {
        id: 'pigmentacao',
        nome: 'Pigmentação',
        descricao: 'Pigmentação capilar para definição e preenchimento natural.',
        preco: 80,
        duracao: 45,
    },
    {
        id: 'acabamento',
        nome: 'Acabamento',
        descricao: 'Acabamento detalhado para manter seu corte sempre afiado.',
        preco: 30,
        duracao: 20,
    },
    {
        id: 'corte-infantil',
        nome: 'Corte Infantil',
        descricao: 'Corte para os pequenos com atenção e cuidado.',
        preco: 40,
        duracao: 30,
    },
];

export const PROFISSIONAIS = [
    { id: 'pixico', nome: 'Pixico' },
    { id: 'qualquer', nome: 'Sem preferência' },
];

export function formatPreco(valor) {
    return `R$ ${valor.toFixed(0)}`;
}
