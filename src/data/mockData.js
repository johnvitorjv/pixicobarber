// ═══════════════════════════════════════════════
// PIXICO BARBER — Mock Data para Agendamento
// ═══════════════════════════════════════════════

// Gera faixas de horário padrão do dia
export function gerarFaixasHorario() {
    const faixas = [];
    const inicios = [
        { inicio: '09:00', fim: '09:30' },
        { inicio: '09:30', fim: '10:00' },
        { inicio: '10:00', fim: '10:30' },
        { inicio: '10:30', fim: '11:00' },
        { inicio: '11:00', fim: '11:30' },
        { inicio: '11:30', fim: '12:00' },
        { inicio: '14:00', fim: '14:30' },
        { inicio: '14:30', fim: '15:00' },
        { inicio: '15:00', fim: '15:30' },
        { inicio: '15:30', fim: '16:00' },
        { inicio: '16:00', fim: '16:30' },
        { inicio: '16:30', fim: '17:00' },
        { inicio: '17:00', fim: '17:30' },
        { inicio: '17:30', fim: '18:00' },
    ];

    inicios.forEach((slot, i) => {
        faixas.push({
            id: `slot-${i}`,
            inicio: slot.inicio,
            fim: slot.fim,
            disponivel: true,
        });
    });

    return faixas;
}

// Gera disponibilidade para os próximos 30 dias
export function gerarDisponibilidade() {
    const disponibilidade = {};
    const hoje = new Date();

    for (let i = 0; i < 30; i++) {
        const data = new Date(hoje);
        data.setDate(hoje.getDate() + i);

        const diaSemana = data.getDay();
        const chave = data.toISOString().split('T')[0];

        // Domingo (0) = fechado, Segunda (1) = fechado
        if (diaSemana === 0 || diaSemana === 1) {
            disponibilidade[chave] = { disponivel: false, motivo: 'Fechado', faixas: [] };
        } else {
            // Fechar aleatoriamente alguns dias (~10%)
            const fechado = Math.random() < 0.1;
            if (fechado) {
                disponibilidade[chave] = { disponivel: false, motivo: 'Agenda fechada', faixas: [] };
            } else {
                const faixas = gerarFaixasHorario();
                // Marcar aleatoriamente alguns horários como indisponíveis
                faixas.forEach(f => {
                    if (Math.random() < 0.25) f.disponivel = false;
                });
                disponibilidade[chave] = { disponivel: true, faixas };
            }
        }
    }

    return disponibilidade;
}

// Mock de agendamentos existentes
export const MOCK_AGENDAMENTOS = [
    {
        id: 'ag-001',
        servicoId: 'corte',
        servicoNome: 'Corte',
        profissional: 'Pixico',
        data: '2026-03-10',
        faixaHorario: '14:00 às 14:30',
        status: 'confirmado',
        observacao: '',
        criadoEm: '2026-03-06T20:00:00',
    },
];

// Status possíveis de agendamento
export const STATUS_AGENDAMENTO = {
    pendente: { label: 'Pendente', cor: 'text-yellow-400', bg: 'bg-yellow-400/10' },
    confirmado: { label: 'Confirmado', cor: 'text-green-400', bg: 'bg-green-400/10' },
    concluido: { label: 'Concluído', cor: 'text-zinc-400', bg: 'bg-zinc-400/10' },
    cancelado: { label: 'Cancelado', cor: 'text-red-400', bg: 'bg-red-400/10' },
};
