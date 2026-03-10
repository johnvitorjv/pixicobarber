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
        <div className="p-6 md:p-10 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <span className="text-[10px] font-bold uppercase tracking-[1em] text-primary mb-3 block">Painel Administrativo</span>
                    <h1 className="font-display font-bold text-3xl md:text-5xl uppercase tracking-tighter">Dashboard</h1>
                </div>
                <div className="font-modern text-[10px] uppercase tracking-widest text-zinc-500 bg-white/5 px-4 py-2 border border-white/10">
                    {new Date(hoje).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
                {STAT_CARDS.map(card => (
                    <div key={card.label} className="group relative overflow-hidden bg-black border border-white/5 p-6 hover:border-primary/30 transition-colors duration-500">
                        <div className={`absolute top-0 right-0 w-32 h-32 ${card.bg} blur-[50px] rounded-full -translate-y-1/2 translate-x-1/2 opacity-20 group-hover:opacity-40 transition-opacity duration-500 pointer-events-none`} />
                        <div className="flex justify-between items-start mb-8 relative z-10">
                            <span className="block text-[9px] font-bold uppercase tracking-[0.4em] text-zinc-500">{card.label}</span>
                            <card.icon size={16} className={`${card.cor} opacity-70`} />
                        </div>
                        <span className={`text-4xl md:text-5xl font-display font-bold ${card.cor} block relative z-10 tracking-tighter`}>{card.valor}</span>
                    </div>
                ))}
            </div>

            {/* Two Column: Próximos Horários + Alertas */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                {/* Próximos horários de hoje */}
                <div className="lg:col-span-3 bg-black border border-white/5 p-6 md:p-8">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="font-display font-bold text-sm uppercase tracking-widest flex items-center gap-3">
                            <div className="w-2 h-2 bg-primary animate-pulse" /> Atendimentos de Hoje
                        </h3>
                        <Link to="/admin/agendamentos" className="group text-zinc-500 text-[9px] font-bold uppercase tracking-widest hover:text-primary transition-colors flex items-center gap-2">
                            Ver todos <ArrowUpRight size={14} className="group-hover:rotate-45 transition-transform" />
                        </Link>
                    </div>
                    {hojeApps.length === 0 ? (
                        <div className="py-16 text-center border border-white/5 bg-white/[0.02]">
                            <p className="text-zinc-600 font-modern text-sm uppercase tracking-widest">Agenda livre para hoje.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {hojeApps.slice(0, 6).map(ag => {
                                const sc = STATUS_CONFIG[ag.status];
                                const nome = sb ? (ag._clienteNome || 'Cliente') : (clientStore.getById(ag.clienteId)?.nome || 'Cliente');
                                return (
                                    <div key={ag.id} className="group flex items-center gap-6 p-4 bg-white/[0.02] border border-white/5 hover:border-primary/20 transition-colors">
                                        <span className="text-lg font-display font-bold text-primary w-20 shrink-0 tabular-nums">{ag.faixaInicio}</span>
                                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                                            <span className="text-sm font-bold block truncate tracking-wide">{nome}</span>
                                            <span className="text-[10px] uppercase font-modern text-zinc-500 mt-1">{ag.servicoNome}</span>
                                        </div>
                                        <span className={`text-[9px] font-bold uppercase tracking-wider ${sc?.cor || 'text-zinc-500'} px-3 py-1.5 ${sc?.bg || 'bg-zinc-800'}`}>
                                            {sc?.label || ag.status}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Alertas e Pendências */}
                <div className="lg:col-span-2 bg-black border border-white/5 p-6 md:p-8 flex flex-col">
                    <h3 className="font-display font-bold text-sm uppercase tracking-widest flex items-center gap-3 mb-8">
                        <AlertTriangle size={16} className="text-yellow-400" /> Atenção Necessária
                    </h3>
                    <div className="space-y-4 flex-1">
                        {pendentes.length > 0 && (
                            <Link to="/admin/agendamentos" className="group flex flex-col gap-3 p-5 bg-yellow-400/5 border border-yellow-400/20 hover:bg-yellow-400/10 transition-colors">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-yellow-400">
                                        <Clock size={16} />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">Aprovação Pendente</span>
                                    </div>
                                    <ChevronRight size={16} className="text-yellow-400/50 group-hover:text-yellow-400 group-hover:translate-x-1 transition-all" />
                                </div>
                                <span className="text-sm font-modern text-zinc-300"><strong>{pendentes.length}</strong> solicitação(ões) de agendamento aguardando sua revisão.</span>
                            </Link>
                        )}
                        {aguardando.length > 0 && (
                            <Link to="/admin/agendamentos" className="group flex flex-col gap-3 p-5 bg-blue-400/5 border border-blue-400/20 hover:bg-blue-400/10 transition-colors">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-blue-400">
                                        <Clock size={16} />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">Aguardando Cliente</span>
                                    </div>
                                    <ChevronRight size={16} className="text-blue-400/50 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                                </div>
                                <span className="text-sm font-modern text-zinc-300"><strong>{aguardando.length}</strong> proposta(s) de reagendamento pendente(s) de aceite.</span>
                            </Link>
                        )}
                        {pendentes.length === 0 && aguardando.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-center opacity-50 py-12">
                                <CheckCircle size={32} className="text-zinc-600 mb-4" />
                                <span className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2">Tudo em Ordem</span>
                                <p className="text-zinc-600 font-modern text-sm">Nenhuma ação pendente no momento.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
