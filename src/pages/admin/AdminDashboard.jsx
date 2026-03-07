import { Link } from 'react-router-dom';
import { STATUS_CONFIG, STATUS } from '../../data/models';
import { isSupabaseConfigured } from '../../lib/supabase';
import { useSupabaseAppointments, useSupabaseClients, useSupabaseServices } from '../../hooks/useSupabase';
// Fallbacks localStorage (só usados sem Supabase)
import appointmentStore from '../../stores/appointmentStore';
import clientStore from '../../stores/clientStore';
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
    const sb = isSupabaseConfigured();

    // Dados do Supabase
    const { appointments: sbApps } = useSupabaseAppointments();
    const { clients: sbClients } = useSupabaseClients();

    // Stats — Supabase ou localStorage
    const allApps = sb ? sbApps : appointmentStore.getAll();
    const agStats = {
        total: allApps.length,
        pendentes: allApps.filter(a => a.status === 'pendente').length,
        aprovados: allApps.filter(a => a.status === 'confirmado').length,
        rejeitados: allApps.filter(a => a.status === 'rejeitado').length,
        aguardando: allApps.filter(a => a.status === 'aguardando_cliente').length,
        concluidos: allApps.filter(a => a.status === 'concluido').length,
        cancelados: allApps.filter(a => a.status === 'cancelado_cliente').length,
        naoCompareceram: allApps.filter(a => a.status === 'ausente').length,
    };

    const clTotal = sb ? sbClients.length : clientStore.getAll().length;

    const hoje = new Date().toISOString().split('T')[0];
    const hojeApps = allApps
        .filter(a => a.data === hoje && (a.status === 'confirmado' || a.status === 'pendente'))
        .sort((a, b) => (a.faixaInicio || '').localeCompare(b.faixaInicio || ''));
    const pendentes = allApps.filter(a => a.status === 'pendente');
    const aguardando = allApps.filter(a => a.status === 'aguardando_cliente');

    const STAT_CARDS = [
        { label: 'Pendentes', valor: agStats.pendentes, cor: 'text-yellow-400', bg: 'bg-yellow-400/10', icon: Clock },
        { label: 'Aprovados', valor: agStats.aprovados, cor: 'text-green-400', bg: 'bg-green-400/10', icon: CheckCircle },
        { label: 'Concluídos', valor: agStats.concluidos, cor: 'text-emerald-400', bg: 'bg-emerald-400/10', icon: CheckCircle },
        { label: 'Rejeitados', valor: agStats.rejeitados, cor: 'text-red-400', bg: 'bg-red-400/10', icon: XCircle },
        { label: 'Clientes', valor: clTotal, cor: 'text-white', bg: 'bg-white/5', icon: Users },
        { label: 'Total Ags', valor: agStats.total, cor: 'text-primary', bg: 'bg-primary/10', icon: Star },
        { label: 'Cancelados', valor: agStats.cancelados, cor: 'text-red-400', bg: 'bg-red-400/10', icon: Ban },
        { label: 'Faltas', valor: agStats.naoCompareceram, cor: 'text-orange-400', bg: 'bg-orange-400/10', icon: AlertTriangle },
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
                    {hojeApps.length === 0 ? (
                        <p className="text-zinc-600 font-modern text-sm py-4 text-center">Nenhum agendamento para hoje.</p>
                    ) : (
                        <div className="space-y-2">
                            {hojeApps.slice(0, 6).map(ag => {
                                const sc = STATUS_CONFIG[ag.status];
                                const nome = sb ? (ag._clienteNome || 'Cliente') : (clientStore.getById(ag.clienteId)?.nome || 'Cliente');
                                return (
                                    <div key={ag.id} className="flex items-center gap-3 p-3 bg-black/30 border border-white/5">
                                        <span className="text-sm font-modern font-bold text-primary w-14 shrink-0">{ag.faixaInicio}</span>
                                        <div className="flex-1 min-w-0">
                                            <span className="text-sm font-modern block truncate">{nome}</span>
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
                        {pendentes.length === 0 && aguardando.length === 0 && (
                            <p className="text-zinc-600 font-modern text-sm py-4 text-center">Tudo em ordem! Nenhum alerta no momento.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
