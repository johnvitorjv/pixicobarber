import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import appointmentStore from '../stores/appointmentStore';
import notificationStore from '../stores/notificationStore';
import clientStore from '../stores/clientStore';
import { STATUS_CONFIG } from '../data/models';
import { useStoreSync } from '../hooks/useStore';
import { Avatar } from '../components/PhotoUpload';
import PhotoUpload from '../components/PhotoUpload';
import { Calendar, Plus, User, LogOut, Clock, ArrowUpRight, Bell } from 'lucide-react';

export default function DashboardPage() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const storeTick = useStoreSync();

    const agendamentos = appointmentStore.getByClient(user?.id);
    const proximos = agendamentos.filter(a => ['pendente', 'aprovado', 'aguardando_cliente', 'remarcado'].includes(a.status));
    const historico = agendamentos.filter(a => ['concluido', 'cancelado_cliente', 'rejeitado', 'nao_compareceu'].includes(a.status));
    const notifs = notificationStore.getNaoLidasCliente(user?.id);

    function handleLogout() {
        logout();
        navigate('/');
    }

    function formatData(dataStr) {
        const [y, m, d] = dataStr.split('-');
        return `${d}/${m}/${y}`;
    }

    function cancelarAgendamento(agId) {
        appointmentStore.cancelarPeloCliente(agId, user.id);
        // Force re-render
        navigate('/painel');
    }

    return (
        <div className="min-h-screen bg-background-dark">
            {/* Header */}
            <div className="border-b border-white/5 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
                    <Link to="/" className="font-display font-bold text-xl uppercase tracking-tighter">Pixico</Link>
                    <div className="flex items-center gap-6">
                        {notifs.length > 0 && (
                            <span className="flex items-center gap-1.5 text-primary text-sm font-modern">
                                <Bell size={14} /> {notifs.length}
                            </span>
                        )}
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 text-zinc-500 hover:text-red-400 transition-colors text-sm font-modern"
                        >
                            <LogOut size={16} />
                            Sair
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-6 py-12">
                {/* Welcome */}
                <div className="mb-12 flex items-center gap-6">
                    <Avatar src={clientStore.getById(user?.id)?.fotoUrl} initials={(user?.nome?.[0] || '') + (user?.sobrenome?.[0] || '')} size="lg" />
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-[1em] text-primary mb-2 block">Painel do Cliente</span>
                        <h1 className="font-display font-bold text-3xl md:text-4xl uppercase tracking-tight">
                            Olá, {user?.nome}
                        </h1>
                        <p className="text-zinc-500 font-modern mt-1">Gerencie seus agendamentos e dados pessoais.</p>
                    </div>
                </div>

                {/* Notificações não lidas */}
                {notifs.length > 0 && (
                    <div className="mb-8 space-y-2">
                        {notifs.slice(0, 3).map(n => (
                            <div key={n.id} className={`p-4 border flex items-start gap-3 ${n.nivel === 'success' ? 'bg-green-400/5 border-green-400/20' :
                                n.nivel === 'error' ? 'bg-red-400/5 border-red-400/20' :
                                    n.nivel === 'warning' ? 'bg-yellow-400/5 border-yellow-400/20' :
                                        'bg-blue-400/5 border-blue-400/20'
                                }`}>
                                <Bell size={14} className="text-primary mt-0.5 shrink-0" />
                                <div>
                                    <span className="font-modern text-sm font-bold block">{n.titulo}</span>
                                    <span className="font-modern text-sm text-zinc-400">{n.mensagem}</span>
                                </div>
                                <button onClick={() => { notificationStore.marcarLida(n.id); navigate('/painel'); }}
                                    className="text-zinc-600 hover:text-white text-[10px] font-bold uppercase tracking-wider ml-auto shrink-0">OK</button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-16">
                    <Link
                        to="/agendar"
                        className="group bg-primary text-black p-6 flex items-center justify-between hover:scale-[1.02] transition-transform"
                    >
                        <div>
                            <Plus size={24} className="mb-3" />
                            <span className="font-display font-bold uppercase text-sm tracking-wide">Novo Agendamento</span>
                        </div>
                        <ArrowUpRight size={20} className="group-hover:rotate-45 transition-transform" />
                    </Link>

                    <div className="bg-zinc-900/80 border border-white/10 p-6">
                        <Calendar size={24} className="text-primary mb-3" />
                        <span className="font-display font-bold uppercase text-sm tracking-wide block mb-1">Próximos</span>
                        <span className="text-3xl font-display font-bold">{proximos.length}</span>
                    </div>

                    <div className="bg-zinc-900/80 border border-white/10 p-6">
                        <User size={24} className="text-primary mb-3" />
                        <span className="font-display font-bold uppercase text-sm tracking-wide block mb-1">Histórico</span>
                        <span className="text-3xl font-display font-bold">{historico.length}</span>
                    </div>
                </div>

                {/* Próximos Agendamentos */}
                <div className="mb-16">
                    <h2 className="font-display font-bold text-xl uppercase tracking-tight mb-6 flex items-center gap-3">
                        <Clock size={20} className="text-primary" />
                        Próximos Agendamentos
                    </h2>

                    {proximos.length === 0 ? (
                        <div className="bg-zinc-900/60 border border-white/5 p-8 text-center">
                            <p className="text-zinc-500 font-modern mb-4">Nenhum agendamento pendente.</p>
                            <Link to="/agendar" className="text-primary hover:underline font-modern text-sm">
                                Agendar agora →
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {proximos.map(ag => {
                                const status = STATUS_CONFIG[ag.status] || STATUS_CONFIG.pendente;
                                return (
                                    <div key={ag.id} className="bg-zinc-900/60 border border-white/5 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-primary/10 flex items-center justify-center shrink-0">
                                                <Calendar size={20} className="text-primary" />
                                            </div>
                                            <div>
                                                <span className="font-display font-bold uppercase text-sm block">{ag.servicoNome}</span>
                                                <span className="text-zinc-500 font-modern text-sm">
                                                    {formatData(ag.data)} • {ag.faixaInicio} — {ag.faixaFim}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={`${status.bg} px-3 py-1 text-xs font-bold uppercase tracking-wider ${status.cor}`}>
                                                {status.label}
                                            </span>
                                            {(ag.status === 'pendente' || ag.status === 'aprovado') && (
                                                <button onClick={() => cancelarAgendamento(ag.id)}
                                                    className="text-zinc-600 hover:text-red-400 text-[10px] font-bold uppercase tracking-wider transition-colors">
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
                    <div className="mb-16">
                        <h2 className="font-display font-bold text-xl uppercase tracking-tight mb-6">Histórico</h2>
                        <div className="space-y-3">
                            {historico.map(ag => {
                                const status = STATUS_CONFIG[ag.status] || STATUS_CONFIG.concluido;
                                return (
                                    <div key={ag.id} className="bg-zinc-900/30 border border-white/5 p-4 flex items-center justify-between opacity-60">
                                        <div>
                                            <span className="font-modern text-sm font-bold">{ag.servicoNome}</span>
                                            <span className="text-zinc-600 font-modern text-sm ml-3">{formatData(ag.data)}</span>
                                        </div>
                                        <span className={`text-xs font-bold uppercase tracking-wider ${status.cor}`}>{status.label}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Dados do Perfil */}
                <div>
                    <h2 className="font-display font-bold text-xl uppercase tracking-tight mb-6">Meus Dados</h2>
                    <div className="bg-zinc-900/60 border border-white/5 p-6">
                        {/* Foto de perfil — trocar */}
                        <div className="flex items-center gap-6 mb-6 pb-6 border-b border-white/5">
                            <PhotoUpload
                                value={clientStore.getById(user?.id)?.fotoUrl || ''}
                                onChange={(newFoto) => clientStore.update(user?.id, { fotoUrl: newFoto })}
                                initials={(user?.nome?.[0] || '') + (user?.sobrenome?.[0] || '')}
                                size="md"
                            />
                            <div>
                                <span className="text-[10px] font-bold uppercase tracking-[0.5em] text-zinc-600 block mb-1">Foto de perfil</span>
                                <span className="font-modern text-sm text-zinc-400">Clique na foto para alterar</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <span className="text-[10px] font-bold uppercase tracking-[0.5em] text-zinc-600 block mb-1">Nome</span>
                                <span className="font-modern">{user?.nome} {user?.sobrenome}</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold uppercase tracking-[0.5em] text-zinc-600 block mb-1">E-mail</span>
                                <span className="font-modern">{user?.email}</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold uppercase tracking-[0.5em] text-zinc-600 block mb-1">WhatsApp</span>
                                <span className="font-modern">{user?.whatsapp}</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold uppercase tracking-[0.5em] text-zinc-600 block mb-1">Membro desde</span>
                                <span className="font-modern">{user?.criadoEm ? new Date(user.criadoEm).toLocaleDateString('pt-BR') : '—'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
