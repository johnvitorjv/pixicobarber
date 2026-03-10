import { useState } from 'react';
import notificationStore from '../../stores/notificationStore';
import { useStoreSync } from '../../hooks/useStore';
import { Bell, Check, CheckCheck, Trash2 } from 'lucide-react';

function formatData(d) {
    try { return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }
    catch { return d; }
}

const NIVEL_CORES = {
    info: { cor: 'text-blue-400', bg: 'bg-blue-400/10', borda: 'border-blue-400/20' },
    success: { cor: 'text-emerald-400', bg: 'bg-emerald-400/10', borda: 'border-emerald-400/20' },
    warning: { cor: 'text-yellow-400', bg: 'bg-yellow-400/10', borda: 'border-yellow-400/20' },
    error: { cor: 'text-red-400', bg: 'bg-red-400/10', borda: 'border-red-400/20' },
};

export default function AdminNotificacoes() {
    const storeTick = useStoreSync();
    const [filtro, setFiltro] = useState('todas');

    const todas = notificationStore.getParaAdmin();
    const naoLidas = notificationStore.getNaoLidasAdmin();
    const lista = filtro === 'nao_lidas' ? naoLidas : todas;

    return (
        <div className="p-6 md:p-10 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                <div>
                    <span className="text-[10px] font-bold uppercase tracking-[1em] text-primary mb-3 block">Central</span>
                    <h1 className="font-display font-bold text-3xl md:text-5xl uppercase tracking-tighter">Notificações</h1>
                </div>
                <div className="flex gap-4">
                    <button onClick={() => notificationStore.marcarTodasLidas('admin')}
                        className="px-6 py-4 bg-white/[0.02] border border-white/5 text-[10px] font-bold uppercase tracking-widest text-zinc-400 hover:text-white hover:border-white/20 transition-colors flex items-center gap-2">
                        <CheckCheck size={16} /> Marcar Lidas
                    </button>
                    <button onClick={() => notificationStore.limparLidas('admin')}
                        className="px-6 py-4 bg-red-500/5 text-red-500/50 hover:text-red-400 border border-red-500/10 hover:border-red-500/20 text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center gap-2">
                        <Trash2 size={16} /> Limpar
                    </button>
                </div>
            </div>

            {/* Filtros */}
            <div className="flex bg-white/[0.02] border border-white/5 w-fit p-1 mb-8">
                {[['todas', `Todas (${todas.length})`], ['nao_lidas', `Não Lidas (${naoLidas.length})`]].map(([v, l]) => (
                    <button key={v} onClick={() => setFiltro(v)}
                        className={`px-8 py-3 text-[10px] font-bold uppercase tracking-widest transition-all ${filtro === v ? 'bg-primary text-black' : 'text-zinc-500 hover:text-white hover:bg-white/[0.02]'}`}>
                        {l}
                    </button>
                ))}
            </div>

            {/* Lista */}
            {lista.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-20 opacity-50 bg-black border border-white/5">
                    <Bell size={48} className="text-zinc-600 mb-6" strokeWidth={1} />
                    <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs">Caixa de entrada limpa.<br />Nenhuma notificação no momento.</p>
                </div>
            ) : (
                <div className="bg-black border border-white/5 divide-y divide-white/5">
                    {lista.map(n => {
                        const nc = NIVEL_CORES[n.nivel] || NIVEL_CORES.info;
                        return (
                            <div key={n.id} className={`flex items-start md:items-center gap-6 p-6 md:p-8 transition-colors ${n.lida ? 'opacity-50 hover:opacity-100 hover:bg-white/[0.02]' : 'bg-white/[0.02] hover:bg-white/[0.05]'}`}>
                                <div className={`w-3 h-3 rounded-full shrink-0 flex items-center justify-center mt-1 md:mt-0 ${n.lida ? 'bg-zinc-800' : nc.bg.replace('/10', '/20')}`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${n.lida ? 'bg-zinc-600' : nc.cor.replace('text-', 'bg-')}`} />
                                </div>

                                <div className="flex-1 min-w-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div>
                                        <span className="font-display font-bold uppercase tracking-tight text-white mb-2 block">{n.titulo}</span>
                                        <span className="font-modern text-sm text-zinc-400 leading-relaxed block">{n.mensagem}</span>
                                    </div>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 shrink-0">{formatData(n.criadoEm)}</span>
                                </div>

                                {!n.lida && (
                                    <button onClick={() => notificationStore.marcarLida(n.id)}
                                        className="w-10 h-10 rounded-full border border-white/5 flex items-center justify-center text-zinc-500 hover:text-primary hover:border-primary/50 transition-colors shrink-0" title="Marcar como lida">
                                        <Check size={16} />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
