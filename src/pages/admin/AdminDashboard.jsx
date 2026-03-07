import { Link } from 'react-router-dom';
import appointmentStore from '../../stores/appointmentStore';
import clientStore from '../../stores/clientStore';
import financialStore from '../../stores/financialStore';
import notificationStore from '../../stores/notificationStore';
import { STATUS_CONFIG, STATUS } from '../../data/models';
import serviceStore from '../../stores/serviceStore';
import { useStoreSync } from '../../hooks/useStore';
import {
    Clock, CheckCircle, XCircle, Users, Star, Ban, DollarSign,
    TrendingUp, CalendarDays, ArrowUpRight, Bell, AlertTriangle, UserPlus, ChevronRight
} from 'lucide-react';

function formatPreco(v) { return `R$ ${Number(v || 0).toFixed(0)}`; }
function formatData(d) { if (!d) return ''; const [y, m, dd] = d.split('-'); return `${dd}/${m}`; }

export default function AdminDashboard() {
    const storeTick = useStoreSync();

    const agStats = appointmentStore.getStats();
    const clStats = clientStore.getStats();
    const finDia = financialStore.getStats('dia');
    const finSemana = financialStore.getStats('semana');
    const finMes = financialStore.getStats('mes');
    const hoje = appointmentStore.getHoje();
    const pendentes = appointmentStore.getPendentes();
    const aguardando = appointmentStore.getAguardandoCliente();
    const notifsNaoLidas = notificationStore.getNaoLidasAdmin();

    const STAT_CARDS = [
        { label: 'Pendentes', valor: agStats.pendentes, cor: 'text-yellow-400', bg: 'bg-yellow-400/10', icon: Clock },
        { label: 'Aprovados', valor: agStats.aprovados, cor: 'text-green-400', bg: 'bg-green-400/10', icon: CheckCircle },
        { label: 'Concluídos', valor: agStats.concluidos, cor: 'text-emerald-400', bg: 'bg-emerald-400/10', icon: CheckCircle },
        { label: 'Rejeitados', valor: agStats.rejeitados, cor: 'text-red-400', bg: 'bg-red-400/10', icon: XCircle },
        { label: 'Clientes', valor: clStats.total, cor: 'text-white', bg: 'bg-white/5', icon: Users },
        { label: 'Favoritos', valor: clStats.favoritos, cor: 'text-primary', bg: 'bg-primary/10', icon: Star },
        { label: 'Blacklist', valor: clStats.blacklist, cor: 'text-red-400', bg: 'bg-red-400/10', icon: Ban },
        { label: 'Notificações', valor: notifsNaoLidas.length, cor: 'text-blue-400', bg: 'bg-blue-400/10', icon: Bell },
    ];

    return (
        <div className="p-6 lg:p-8">
            {/* Header */}
            <div className="mb-8">
                <span className="text-[10px] font-bold uppercase tracking-[1em] text-primary mb-2 block">Painel Administrativo</span>
                <h1 className="font-display font-bold text-2xl md:text-3xl uppercase tracking-tight">Dashboard</h1>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                {STAT_CARDS.map(card => (
                    <div key={card.label} className={`${card.bg} border border-white/5 p-4 md:p-5`}>
                        <div className="flex items-center justify-between mb-3">
                            <card.icon size={18} className={card.cor} />
                        </div>
                        <span className={`text-2xl md:text-3xl font-display font-bold ${card.cor}`}>{card.valor}</span>
                        <span className="block text-[9px] font-bold uppercase tracking-[0.4em] text-zinc-500 mt-1">{card.label}</span>
                    </div>
                ))}
            </div>

            {/* Financial Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
                {[
                    { label: 'Faturamento Hoje', valor: finDia.totalEntradas, extra: `${finDia.qtdEntradas} serviço(s)` },
                    { label: 'Faturamento Semana', valor: finSemana.totalEntradas, extra: `Ticket médio: ${formatPreco(finSemana.ticketMedio)}` },
                    { label: 'Faturamento Mês', valor: finMes.totalEntradas, extra: `Lucro: ${formatPreco(finMes.lucro)}` },
                ].map(item => (
                    <div key={item.label} className="bg-zinc-900/60 border border-white/5 p-5">
                        <DollarSign size={16} className="text-primary mb-2" />
                        <span className="text-2xl font-display font-bold text-primary">{formatPreco(item.valor)}</span>
                        <span className="block text-[9px] font-bold uppercase tracking-[0.4em] text-zinc-500 mt-1">{item.label}</span>
                        <span className="block text-[10px] text-zinc-600 font-modern mt-2">{item.extra}</span>
                    </div>
                ))}
            </div>

            {/* Two Column: Próximos Horários + Alertas */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Próximos horários de hoje */}
                <div className="bg-zinc-900/40 border border-white/5 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-display font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                            <CalendarDays size={16} className="text-primary" /> Hoje
                        </h3>
                        <Link to="/admin/agendamentos" className="text-primary text-[10px] font-bold uppercase tracking-wider hover:underline flex items-center gap-1">
                            Ver todos <ArrowUpRight size={12} />
                        </Link>
                    </div>
                    {hoje.length === 0 ? (
                        <p className="text-zinc-600 font-modern text-sm py-4 text-center">Nenhum agendamento para hoje.</p>
                    ) : (
                        <div className="space-y-2">
                            {hoje.slice(0, 6).map(ag => {
                                const sc = STATUS_CONFIG[ag.status];
                                const cliente = clientStore.getById(ag.clienteId);
                                return (
                                    <div key={ag.id} className="flex items-center gap-3 p-3 bg-black/30 border border-white/5">
                                        <span className="text-sm font-modern font-bold text-primary w-14 shrink-0">{ag.faixaInicio}</span>
                                        <div className="flex-1 min-w-0">
                                            <span className="text-sm font-modern block truncate">{cliente?.nome || 'Cliente'} {cliente?.sobrenome || ''}</span>
                                            <span className="text-[10px] text-zinc-500">{ag.servicoNome}</span>
                                        </div>
                                        <span className={`text-[9px] font-bold uppercase tracking-wider ${sc?.cor || 'text-zinc-500'} px-2 py-1 ${sc?.bg || 'bg-zinc-800'}`}>
                                            {sc?.label || ag.status}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Alertas e Pendências */}
                <div className="bg-zinc-900/40 border border-white/5 p-5">
                    <h3 className="font-display font-bold text-sm uppercase tracking-wider flex items-center gap-2 mb-4">
                        <AlertTriangle size={16} className="text-yellow-400" /> Atenção
                    </h3>
                    <div className="space-y-2">
                        {pendentes.length > 0 && (
                            <Link to="/admin/agendamentos" className="flex items-center gap-3 p-3 bg-yellow-400/5 border border-yellow-400/10 hover:bg-yellow-400/10 transition-colors">
                                <Clock size={16} className="text-yellow-400" />
                                <span className="text-sm font-modern flex-1"><strong>{pendentes.length}</strong> agendamento(s) pendente(s) de aprovação</span>
                                <ChevronRight size={14} className="text-zinc-600" />
                            </Link>
                        )}
                        {aguardando.length > 0 && (
                            <Link to="/admin/agendamentos" className="flex items-center gap-3 p-3 bg-blue-400/5 border border-blue-400/10 hover:bg-blue-400/10 transition-colors">
                                <Clock size={16} className="text-blue-400" />
                                <span className="text-sm font-modern flex-1"><strong>{aguardando.length}</strong> proposta(s) aguardando retorno do cliente</span>
                                <ChevronRight size={14} className="text-zinc-600" />
                            </Link>
                        )}
                        {clStats.novosEsteMes > 0 && (
                            <div className="flex items-center gap-3 p-3 bg-white/5 border border-white/5">
                                <UserPlus size={16} className="text-emerald-400" />
                                <span className="text-sm font-modern flex-1"><strong>{clStats.novosEsteMes}</strong> novo(s) cliente(s) este mês</span>
                            </div>
                        )}
                        {pendentes.length === 0 && aguardando.length === 0 && (
                            <p className="text-zinc-600 font-modern text-sm py-4 text-center">Tudo em ordem! Nenhum alerta no momento.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
