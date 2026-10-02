// ═══════════════════════════════════════════════
// PIXICO BARBER — Models & Constants
// ═══════════════════════════════════════════════

// ─── Status de Agendamento ───
export const STATUS = {
    PENDENTE: 'pendente',
    APROVADO: 'confirmado',
    REJEITADO: 'rejeitado',
    AGUARDANDO_CLIENTE: 'aguardando_cliente',
    REMARCADO: 'remarcado',
    CANCELADO_CLIENTE: 'cancelado_cliente',
    CANCELADO_ADMIN: 'cancelado_admin',
    CONCLUIDO: 'concluido',
    NAO_COMPARECEU: 'ausente',
};

export const STATUS_CONFIG = {
    [STATUS.PENDENTE]: { label: 'Pendente', cor: 'text-yellow-400', bg: 'bg-yellow-400/10', icon: 'Clock' },
    [STATUS.APROVADO]: { label: 'Aprovado', cor: 'text-green-400', bg: 'bg-green-400/10', icon: 'CheckCircle' },
    [STATUS.REJEITADO]: { label: 'Rejeitado', cor: 'text-red-400', bg: 'bg-red-400/10', icon: 'XCircle' },
    [STATUS.AGUARDANDO_CLIENTE]: { label: 'Aguardando Cliente', cor: 'text-blue-400', bg: 'bg-blue-400/10', icon: 'MessageCircle' },
    [STATUS.REMARCADO]: { label: 'Remarcado', cor: 'text-purple-400', bg: 'bg-purple-400/10', icon: 'RefreshCw' },
    [STATUS.CANCELADO_CLIENTE]: { label: 'Cancelado', cor: 'text-zinc-400', bg: 'bg-zinc-400/10', icon: 'Ban' },
    [STATUS.CANCELADO_ADMIN]: { label: 'Cancelado pela barbearia', cor: 'text-zinc-400', bg: 'bg-zinc-400/10', icon: 'Ban' },
    [STATUS.CONCLUIDO]: { label: 'Concluído', cor: 'text-emerald-400', bg: 'bg-emerald-400/10', icon: 'CheckCheck' },
    [STATUS.NAO_COMPARECEU]: { label: 'Não Compareceu', cor: 'text-orange-400', bg: 'bg-orange-400/10', icon: 'UserX' },
};

// ─── Motivos de Rejeição Padronizados ───
export const MOTIVOS_REJEICAO = [
    { id: 'dia_indisponivel', label: 'Dia já indisponível' },
    { id: 'horario_ocupado', label: 'Horário já ocupado' },
    { id: 'limite_turno', label: 'Limite de atendimentos do turno atingido' },
    { id: 'barbearia_fechada', label: 'Barbearia fechada na data' },
    { id: 'conflito_agenda', label: 'Conflito de agenda' },
    { id: 'servico_indisponivel', label: 'Serviço indisponível no horário' },
    { id: 'necessidade_remarcar', label: 'Necessidade de remarcar' },
    { id: 'dados_incompletos', label: 'Dados incompletos' },
    { id: 'duplicada', label: 'Solicitação duplicada' },
    { id: 'outro', label: 'Outro motivo' },
];

// ─── Tipos de Notificação ───
export const NOTIF_TIPOS = {
    NOVO_PEDIDO: 'novo_pedido',
    APROVACAO: 'aprovacao',
    REJEICAO: 'rejeicao',
    AGUARDANDO: 'aguardando',
    CANCELAMENTO: 'cancelamento',
    REMARCACAO: 'remarcacao',
    CONCLUIDO: 'concluido',
    NOVO_USUARIO: 'novo_usuario',
    BLACKLIST_TENTATIVA: 'blacklist_tentativa',
    ALERTA_AGENDA: 'alerta_agenda',
    FINANCEIRO: 'financeiro',
    SISTEMA: 'sistema',
};

export const NOTIF_NIVEIS = {
    INFO: 'info',
    SUCCESS: 'success',
    WARNING: 'warning',
    ERROR: 'error',
};

// ─── Turnos ───
export const TURNOS = {
    MANHA: { id: 'manha', label: 'Manhã', inicio: '09:00', fim: '12:00' },
    TARDE: { id: 'tarde', label: 'Tarde', inicio: '14:00', fim: '18:00' },
};

// ─── Formas de Pagamento ───
export const FORMAS_PAGAMENTO = [
    { id: 'dinheiro', label: 'Dinheiro' },
    { id: 'pix', label: 'PIX' },
    { id: 'debito', label: 'Cartão Débito' },
    { id: 'credito', label: 'Cartão Crédito' },
];
