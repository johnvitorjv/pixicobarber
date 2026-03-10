import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import appointmentStore from '../stores/appointmentStore';
import notificationStore from '../stores/notificationStore';
import clientStore from '../stores/clientStore';
import { STATUS_CONFIG } from '../data/models';
import { useStoreSync } from '../hooks/useStore';
import { isSupabaseConfigured } from '../lib/supabase';
import { useSupabaseAppointments, updateAppointmentSupabase } from '../hooks/useSupabase';
import { Avatar } from '../components/PhotoUpload';
import PhotoUpload from '../components/PhotoUpload';
import { Calendar, Plus, User, LogOut, Clock, ArrowUpRight, Bell } from 'lucide-react';

export default function DashboardPage() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const storeTick = useStoreSync();
    const sb = isSupabaseConfigured();
    const { appointments: sbApps } = useSupabaseAppointments();

    // Agendamentos do cliente: Supabase (filtra por clienteId) ou localStorage
    const agendamentos = sb
        ? sbApps.filter(a => a.clienteId === user?.id)
        : appointmentStore.getByClient(user?.id);
    const proximos = agendamentos.filter(a => ['pendente', 'confirmado', 'aguardando_cliente', 'remarcado'].includes(a.status));
    const historico = agendamentos.filter(a => ['concluido', 'cancelado_cliente', 'rejeitado', 'ausente'].includes(a.status));
    const notifs = notificationStore.getNaoLidasCliente(user?.id);

    function handleLogout() {
        logout();
        navigate('/');
    }

    function formatData(dataStr) {
        const [y, m, d] = dataStr.split('-');
        return `${d}/${m}/${y}`;
    }

    async function cancelarAgendamento(agId) {
        if (sb) {
            try {
                await updateAppointmentSupabase(agId, { status: 'cancelado_cliente' });
            } catch (err) { console.error('Erro ao cancelar:', err); }
        } else {
            appointmentStore.cancelarPeloCliente(agId, user.id);
        }
        navigate('/painel');
    }

    return (
        <div className="min-h-screen bg-background-dark">
            {/* Header */}
            <div className="border-b border-white/5 bg-black/80 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
                    <Link to="/" className="font-display font-bold text-2xl uppercase tracking-tighter hover:text-primary transition-colors">Pixico</Link>
                    <div className="flex items-center gap-8">
                        {notifs.length > 0 && (
                            <Link to="/painel" className="flex items-center gap-2 text-primary text-[10px] font-bold uppercase tracking-widest hover:text-white transition-colors">
                                <Bell size={14} /> {notifs.length}
                            </Link>
                        )}
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 text-zinc-500 hover:text-red-400 transition-colors text-[10px] font-bold uppercase tracking-widest"
                        >
                            <LogOut size={16} />
                            Sair
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-12 md:py-20">
                {/* Welcome */}
                <div className="mb-16 flex flex-col md:flex-row md:items-center gap-8 border-b border-white/5 pb-16">
                    <Avatar src={user?.photoUrl || user?.fotoUrl || ''} initials={(user?.nome?.[0] || '') + (user?.sobrenome?.[0] || '')} size="lg" className="w-24 h-24" />
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-[1em] text-primary mb-4 block">Central do Cliente</span>
                        <h1 className="font-display font-bold text-4xl md:text-5xl uppercase tracking-tighter text-white">
                            Olá, {user?.nome}
                        </h1>
                        <p className="text-zinc-500 font-modern text-sm uppercase tracking-widest mt-4">Navegue pelos seus agendamentos e histórico.</p>
                    </div>
                </div>

                {/* Notificações não lidas */}
                {notifs.length > 0 && (
                    <div className="mb-12 space-y-2">
                        {notifs.slice(0, 3).map(n => (
                            <div key={n.id} className="p-6 bg-black border border-white/10 hover:border-white/20 transition-colors flex items-start md:items-center gap-4 group">
                                <div className="w-2 h-2 mt-2 md:mt-0 rounded-full bg-primary shrink-0" />
                                <div className="flex-1">
                                    <span className="font-display font-bold text-white uppercase tracking-wider text-sm block mb-1">{n.titulo}</span>
                                    <span className="font-modern text-sm text-zinc-400 block">{n.mensagem}</span>
                                </div>
                                <button onClick={() => { notificationStore.marcarLida(n.id); navigate('/painel'); }}
                                    className="text-zinc-600 group-hover:text-primary border border-transparent group-hover:border-primary/20 px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ml-auto shrink-0">Lida</button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
                    <Link
                        to="/agendar"
                        className="group bg-primary text-black p-8 md:p-10 flex flex-col justify-between min-h-[200px] hover:-translate-y-1 transition-transform shadow-[0_0_40px_rgba(255,255,255,0.05)]"
                    >
                        <div className="flex justify-between items-start">
                            <Plus size={32} className="mb-6" strokeWidth={1.5} />
                            <ArrowUpRight size={24} className="group-hover:rotate-45 transition-transform" />
                        </div>
                        <span className="font-display font-bold uppercase text-lg tracking-widest">Novo<br />Agendamento</span>
                    </Link>

                    <div className="bg-black border border-white/5 p-8 md:p-10 flex flex-col justify-between min-h-[200px]">
                        <Calendar size={32} className="text-primary mb-6" strokeWidth={1.5} />
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-[0.5em] text-zinc-500 block mb-2">Próximos</span>
                            <span className="text-5xl font-display font-bold tabular-nums text-white">{proximos.length}</span>
                        </div>
                    </div>

                    <div className="bg-black border border-white/5 p-8 md:p-10 flex flex-col justify-between min-h-[200px]">
                        <User size={32} className="text-primary mb-6" strokeWidth={1.5} />
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-[0.5em] text-zinc-500 block mb-2">Histórico (Visitas)</span>
                            <span className="text-5xl font-display font-bold tabular-nums text-white">{historico.length}</span>
                        </div>
                    </div>
                </div>

                {/* Próximos Agendamentos */}
                <div className="mb-20">
                    <h2 className="font-display font-bold text-2xl uppercase tracking-tighter mb-8 flex items-center gap-4 text-white">
                        <div className="w-1 h-5 bg-primary" /> Próximos Agendamentos
                    </h2>

                    {proximos.length === 0 ? (
                        <div className="bg-black border border-white/5 p-16 text-center">
                            <Calendar size={48} className="text-zinc-800 mx-auto mb-6" strokeWidth={1} />
                            <p className="text-zinc-500 font-bold uppercase tracking-widest text-[10px] mb-6">Nenhum agendamento pendente.</p>
                            <Link to="/agendar" className="bg-white/[0.02] hover:bg-white/[0.05] border border-white/10 text-white px-8 py-3 font-display font-bold uppercase text-[10px] tracking-widest transition-colors inline-block">
                                Agendar agora
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {proximos.map(ag => {
                                const status = STATUS_CONFIG[ag.status] || STATUS_CONFIG.pendente;
                                return (
                                    <div key={ag.id} className="bg-black border border-white/5 p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-white/10 transition-colors">
                                        <div className="flex items-start md:items-center gap-6">
                                            <div className="w-16 h-16 bg-white/[0.02] flex items-center justify-center shrink-0 border border-white/5">
                                                <Calendar size={24} className="text-white opacity-50" strokeWidth={1.5} />
                                            </div>
                                            <div>
                                                <span className="font-display font-bold uppercase tracking-wider text-lg text-white block mb-2">{ag.servicoNome}</span>
                                                <span className="font-modern text-sm text-zinc-400 tracking-widest uppercase">
                                                    {formatData(ag.data)} <span className="opacity-30 mx-2">|</span> {ag.faixaInicio} — {ag.faixaFim}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 border-t border-white/5 md:border-t-0 pt-4 md:pt-0">
                                            <span className={`px-4 py-2 border text-[10px] font-bold uppercase tracking-widest ${status.cor} ${status.bord}`}>
                                                {status.label}
                                            </span>
                                            {(ag.status === 'pendente' || ag.status === 'confirmado') && (
                                                <button onClick={() => cancelarAgendamento(ag.id)}
                                                    className="text-red-500/50 hover:text-red-400 text-[10px] font-bold uppercase tracking-widest transition-colors border-b border-transparent hover:border-red-400/30 pb-0.5">
                                                    Cancelar
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Histórico */}
                {historico.length > 0 && (
                    <div className="mb-20">
                        <h2 className="font-display font-bold text-lg uppercase tracking-widest mb-8 flex items-center gap-3 text-zinc-400 border-b border-white/5 pb-4">
                            Histórico de Visitas
                        </h2>
                        <div className="space-y-2">
                            {historico.map(ag => {
                                const status = STATUS_CONFIG[ag.status] || STATUS_CONFIG.concluido;
                                return (
                                    <div key={ag.id} className="bg-black border border-white/5 p-6 flex flex-col sm:flex-row sm:items-center justify-between opacity-70 hover:opacity-100 transition-opacity gap-4">
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
                                            <span className="font-display font-bold text-white uppercase tracking-wider text-sm">{ag.servicoNome}</span>
                                            <span className="text-zinc-500 font-modern text-[11px] uppercase tracking-widest">{formatData(ag.data)}</span>
                                        </div>
                                        <span className={`text-[9px] font-bold uppercase tracking-widest ${status.cor}`}>{status.label}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Dados do Perfil */}
                <div className="border-t border-white/5 pt-20">
                    <h2 className="font-display font-bold text-2xl uppercase tracking-tighter mb-8 flex items-center gap-4 text-white">
                        <div className="w-1 h-5 bg-primary" /> Meus Dados
                    </h2>

                    <div className="bg-black border border-white/5 p-8 md:p-12">
                        {/* Foto de perfil */}
                        <div className="flex items-center gap-8 mb-12 pb-12 border-b border-white/5">
                            <div className="relative group cursor-pointer w-fit">
                                <PhotoUpload
                                    value={clientStore.getById(user?.id)?.fotoUrl || ''}
                                    onChange={(newFoto) => clientStore.update(user?.id, { fotoUrl: newFoto })}
                                    initials={(user?.nome?.[0] || '') + (user?.sobrenome?.[0] || '')}
                                    size="lg"
                                />
                                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                                    <span className="text-[9px] font-bold uppercase tracking-widest text-white">Trocar</span>
                                </div>
                            </div>
                            <div>
                                <h3 className="font-display font-bold text-lg uppercase tracking-widest text-white mb-2">Avatar do Perfil</h3>
                                <p className="font-modern text-xs text-zinc-500 uppercase tracking-widest">Clique na foto para alterar a imagem.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                            <div>
                                <span className="text-[10px] font-bold uppercase tracking-[0.5em] text-zinc-600 block mb-3">Nome Completo</span>
                                <span className="font-modern text-lg text-white">{user?.nome} {user?.sobrenome}</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold uppercase tracking-[0.5em] text-zinc-600 block mb-3">E-mail</span>
                                <span className="font-modern text-lg text-white">{user?.email}</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold uppercase tracking-[0.5em] text-zinc-600 block mb-3">WhatsApp</span>
                                <span className="font-modern text-lg text-white">{user?.whatsapp}</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold uppercase tracking-[0.5em] text-zinc-600 block mb-3">Membro desde</span>
                                <span className="font-modern text-lg text-white">{user?.criadoEm ? new Date(user.criadoEm).toLocaleDateString('pt-BR') : '—'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
