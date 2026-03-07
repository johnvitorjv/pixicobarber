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
        <div className="p-6 lg:p-8">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <span className="text-[10px] font-bold uppercase tracking-[1em] text-primary mb-2 block">Central</span>
                    <h1 className="font-display font-bold text-2xl uppercase tracking-tight">Notificações</h1>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => notificationStore.marcarTodasLidas('admin')}
                        className="px-3 py-2 bg-zinc-900 border border-white/10 text-[10px] font-bold uppercase tracking-wider text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5">
                        <CheckCheck size={14} /> Todas lidas
                    </button>
                    <button onClick={() => notificationStore.limparLidas('admin')}
                        className="px-3 py-2 bg-zinc-900 border border-white/10 text-[10px] font-bold uppercase tracking-wider text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5">
                        <Trash2 size={14} /> Limpar
                    </button>
                </div>
            </div>

            <div className="flex gap-2 mb-6">
                {[['todas', `Todas (${todas.length})`], ['nao_lidas', `Não lidas (${naoLidas.length})`]].map(([v, l]) => (
                    <button key={v} onClick={() => setFiltro(v)}
                        className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wider border transition-colors ${filtro === v ? 'border-primary text-primary bg-primary/5' : 'border-white/10 text-zinc-500'}`}>
                        {l}
                    </button>
                ))}
            </div>

            {lista.length === 0 ? (
                <div className="bg-zinc-900/40 border border-white/5 p-12 text-center">
                    <Bell size={32} className="mx-auto text-zinc-700 mb-3" />
                    <p className="text-zinc-500 font-modern">Nenhuma notificação.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {lista.map(n => {
                        const nc = NIVEL_CORES[n.nivel] || NIVEL_CORES.info;
                        return (
                            <div key={n.id} className={`flex items-start gap-4 p-4 border transition-colors ${n.lida ? 'bg-zinc-900/20 border-white/5 opacity-60' : `${nc.bg} ${nc.borda}`}`}>
                                <div className={`w-2 h-2 mt-2 rounded-full shrink-0 ${n.lida ? 'bg-zinc-700' : nc.cor.replace('text-', 'bg-')}`} />
                                <div className="flex-1 min-w-0">
                                    <span className="font-modern text-sm font-bold block">{n.titulo}</span>
                                    <span className="font-modern text-sm text-zinc-400">{n.mensagem}</span>
                                    <span className="text-[10px] text-zinc-600 mt-1 block">{formatData(n.criadoEm)}</span>
                                </div>
                                {!n.lida && (
                                    <button onClick={() => notificationStore.marcarLida(n.id)}
                                        className="text-zinc-600 hover:text-primary transition-colors shrink-0" title="Marcar como lida">
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
