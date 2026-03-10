import { useState } from 'react';
import clientStore from '../../stores/clientStore';
import appointmentStore from '../../stores/appointmentStore';
import { gerarLinkWhatsAppCliente } from '../../data/whatsappTemplates';
import { STATUS } from '../../data/models';
import { useStoreSync } from '../../hooks/useStore';
import { isSupabaseConfigured } from '../../lib/supabase';
import { useSupabaseClients, useSupabaseAppointments, updateProfileSupabase } from '../../hooks/useSupabase';
import { Avatar } from '../../components/PhotoUpload';
import {
    Search, Star, Ban, MessageCircle, Edit3, X, Eye, Tag, Plus, User, CalendarDays
} from 'lucide-react';

function formatData(d) { if (!d) return '—'; try { return new Date(d).toLocaleDateString('pt-BR'); } catch { return d; } }

export default function AdminClientes() {
    const storeTick = useStoreSync();
    const [busca, setBusca] = useState('');
    const [filtro, setFiltro] = useState('todos');
    const [modal, setModal] = useState(null);

    // Edit state
    const [editApelido, setEditApelido] = useState('');
    const [editObs, setEditObs] = useState('');
    const [editTag, setEditTag] = useState('');
    const [blMotivo, setBlMotivo] = useState('');

    // Supabase data
    const sbConfigured = isSupabaseConfigured();
    const { clients: sbClients, loading: sbClientsLoading, refetch: refetchClients } = useSupabaseClients();
    const { appointments: sbApps } = useSupabaseAppointments();

    // Leitura reativa — Supabase ou localStorage
    const clientes = (() => {
        let all = sbConfigured ? sbClients : clientStore.getAll();
        if (filtro === 'favoritos') all = all.filter(u => u.favorito);
        if (filtro === 'blacklist') all = all.filter(u => u.blacklist);
        if (busca) {
            const q = busca.toLowerCase();
            all = all.filter(u =>
                u.nome?.toLowerCase().includes(q) ||
                u.sobrenome?.toLowerCase().includes(q) ||
                u.apelido?.toLowerCase().includes(q) ||
                u.whatsapp?.includes(q) ||
                u.email?.toLowerCase().includes(q)
            );
        }
        return all;
    })();

    function abrirDetalhe(c) {
        setEditApelido(c.apelido || '');
        setEditObs(c.observacoesAdmin || '');
        setBlMotivo(c.blacklistMotivo || '');
        setModal({ tipo: 'detalhe', cliente: c });
    }

    function salvarEdicao() {
        const { cliente } = modal;
        clientStore.setApelido(cliente.id, editApelido);
        clientStore.setObservacoes(cliente.id, editObs);
        setModal(null);
    }

    async function toggleFav(id) {
        if (sbConfigured) {
            const current = sbClients.find(c => c.id === id);
            try {
                await updateProfileSupabase(id, { favorito: !(current?.favorito) });
                await refetchClients();
            } catch (err) { console.error('Erro ao alternar favorito:', err); }
        } else {
            clientStore.toggleFavorito(id);
        }
    }

    function toggleBlacklist(id, blacklist) {
        if (blacklist) {
            setBlMotivo('');
            setModal({ tipo: 'blacklist', clienteId: id });
        } else {
            clientStore.setBlacklist(id, false, '');
        }
    }

    function confirmarBlacklist() {
        clientStore.setBlacklist(modal.clienteId, true, blMotivo);
        setModal(null);
    }

    function addTag(clienteId) {
        if (editTag.trim()) {
            clientStore.addTag(clienteId, editTag.trim());
            setEditTag('');
        }
    }

    function removeTag(clienteId, tag) {
        clientStore.removeTag(clienteId, tag);
    }

    return (
        <div className="p-6 md:p-10 max-w-[1600px] mx-auto">
            <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <span className="text-[10px] font-bold uppercase tracking-[1em] text-primary mb-3 block">Comunidade</span>
                    <h1 className="font-display font-bold text-3xl md:text-5xl uppercase tracking-tighter">Clientes</h1>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-8">
                <div className="relative flex-1">
                    <Search size={16} className="absolute left-0 top-1/2 -translate-y-1/2 text-zinc-600" />
                    <input type="text" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome, apelido, telefone, e-mail..."
                        className="w-full bg-transparent border-b border-white/20 pl-8 pr-4 py-3 text-sm text-white font-modern focus:border-primary focus:outline-none placeholder:text-zinc-700 transition-colors" />
                </div>
                <div className="flex flex-wrap gap-2 md:gap-4 mt-2 md:mt-0">
                    {['todos', 'favoritos', 'blacklist'].map(f => (
                        <button key={f} onClick={() => setFiltro(f)}
                            className={`px-6 py-3 text-[10px] font-bold uppercase tracking-widest border transition-all ${filtro === f ? 'border-primary text-primary bg-primary/5' : 'border-white/10 text-zinc-500 hover:text-white hover:border-white/30 bg-black'}`}>
                            {f === 'todos' ? 'Todos' : f === 'favoritos' ? '⭐ Favoritos' : '🚫 Blacklist'}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex items-center gap-3 mb-8">
                <div className="h-px bg-white/10 flex-1" />
                <p className="text-zinc-500 text-[9px] font-bold uppercase tracking-widest">{clientes.length} cliente(s)</p>
                <div className="h-px bg-white/10 flex-1" />
            </div>

            {/* Grid de clientes */}
            {clientes.length === 0 ? (
                <div className="border border-white/5 bg-white/[0.02] p-16 text-center">
                    <p className="text-zinc-600 font-modern text-sm uppercase tracking-widest">Nenhum cliente encontrado.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {clientes.map(c => {
                        const clientApps = sbConfigured ? sbApps.filter(a => a.clienteId === c.id) : appointmentStore.getByClient(c.id);
                        const concluidos = clientApps.filter(a => a.status === STATUS.CONCLUIDO || a.status === 'concluido').length;
                        const faltas = clientApps.filter(a => a.status === STATUS.NAO_COMPARECEU || a.status === 'ausente').length;
                        return (
                            <div key={c.id} className={`bg-black aspect-[3/4] flex flex-col justify-between p-6 border transition-all hover:-translate-y-1 group ${c.blacklist ? 'border-red-500/20 hover:border-red-500/40 backdrop-blur-md' : c.favorito ? 'border-primary/20 hover:border-primary/40' : 'border-white/5 hover:border-white/20'}`}>
                                <div>
                                    <div className="flex items-start justify-between mb-6">
                                        <Avatar src={c.fotoUrl} initials={`${c.nome?.[0] || ''}${c.sobrenome?.[0] || ''}`} size="md" className="ring-1 ring-white/10 group-hover:ring-primary/30 grayscale group-hover:grayscale-0 transition-all duration-500" />
                                        <div className="flex gap-1 bg-white/[0.02] border border-white/5 p-1">
                                            <button onClick={() => toggleFav(c.id)} className={`p-1.5 transition-colors ${c.favorito ? 'text-primary' : 'text-zinc-600 hover:text-primary'}`}>
                                                <Star size={14} className={c.favorito ? 'fill-primary' : ''} />
                                            </button>
                                            <button onClick={() => abrirDetalhe(c)} className="p-1.5 text-zinc-600 hover:text-white transition-colors">
                                                <Eye size={14} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="mb-6">
                                        <span className="font-display text-xl font-bold uppercase tracking-tight block mb-1 group-hover:text-primary transition-colors line-clamp-2">{c.apelido || c.nome} {c.sobrenome?.[0]}.</span>
                                        <span className="text-[10px] font-modern text-zinc-500 uppercase tracking-widest truncate block">{c.email}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-6 border-y border-white/5 py-3">
                                        <div className="flex flex-col">
                                            <span className="text-white text-lg font-display tabular-nums mb-0.5">{concluidos}</span>
                                            <span className="text-[8px] text-zinc-600">Presenças</span>
                                        </div>
                                        <div className="flex flex-col border-l border-white/5 pl-2">
                                            <span className="text-white text-lg font-display tabular-nums mb-0.5">{c.scorePresenca || 100}%</span>
                                            <span className="text-[8px] text-zinc-600">Score</span>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    {c.blacklist && (
                                        <div className="text-[9px] font-bold uppercase tracking-widest text-red-500 bg-red-500/10 px-3 py-1.5 inline-block border border-red-500/20 mb-2 w-full text-center">Proibido</div>
                                    )}
                                    <div className="flex flex-wrap gap-1.5 min-h-[22px]">
                                        {(c.tags || []).slice(0, 3).map(t => (
                                            <span key={t} className="text-[8px] bg-primary/5 border border-primary/20 text-primary px-2 py-0.5 font-bold uppercase tracking-widest line-clamp-1">{t}</span>
                                        ))}
                                        {(c.tags || []).length > 3 && (
                                            <span className="text-[8px] bg-white/5 border border-white/10 text-white px-2 py-0.5 font-bold uppercase tracking-widest">+{c.tags.length - 3}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal Detalhe — Painel Completo do Cliente */}
            {modal?.tipo === 'detalhe' && (() => {
                const c = sbConfigured ? (sbClients.find(cl => cl.id === modal.cliente.id) || modal.cliente) : (clientStore.getById(modal.cliente.id) || modal.cliente);
                const clientApps = sbConfigured ? sbApps.filter(a => a.clienteId === c.id) : appointmentStore.getByClient(c.id);
                const totalAgs = clientApps.length;
                const concluidosCount = clientApps.filter(a => a.status === 'concluido' || a.status === STATUS.CONCLUIDO).length;
                const faltasCount = clientApps.filter(a => a.status === 'ausente' || a.status === STATUS.NAO_COMPARECEU).length;
                const canceladosCount = clientApps.filter(a => a.status === 'cancelado_cliente' || a.status === STATUS.CANCELADO_CLIENTE).length;
                const rejeitadosCount = clientApps.filter(a => a.status === 'rejeitado' || a.status === STATUS.REJEITADO).length;
                const valorTotal = clientApps.filter(a => a.status === 'concluido' || a.status === STATUS.CONCLUIDO).reduce((s, a) => s + (a.servicoPreco || 0), 0);
                const ticketMedio = concluidosCount > 0 ? valorTotal / concluidosCount : 0;

                // Último atendimento concluído
                const ultimoConcluido = clientApps
                    .filter(a => a.status === 'concluido' || a.status === STATUS.CONCLUIDO)
                    .sort((a, b) => (b.data || '').localeCompare(a.data || ''))[0];

                // Próximo agendamento (pendente ou confirmado)
                const proximo = clientApps
                    .filter(a => a.status === 'pendente' || a.status === 'confirmado' || a.status === STATUS.PENDENTE || a.status === STATUS.APROVADO)
                    .sort((a, b) => (a.data || '').localeCompare(b.data || ''))[0];

                // Serviços mais usados
                const servicoCount = {};
                clientApps.filter(a => a.status === 'concluido' || a.status === STATUS.CONCLUIDO).forEach(a => {
                    const nome = a.servicoNome || 'Serviço';
                    servicoCount[nome] = (servicoCount[nome] || 0) + 1;
                });
                const topServicos = Object.entries(servicoCount).sort((a, b) => b[1] - a[1]).slice(0, 3);

                // Score de presença
                const score = totalAgs > 0 ? Math.round(((concluidosCount) / Math.max(1, concluidosCount + faltasCount)) * 100) : 100;

                return (
                    <ModalOverlay onClose={() => setModal(null)}>
                        <div className="max-h-[85vh] overflow-y-auto -m-6 md:-m-8 p-6 md:p-8">
                            {/* ═══ BLOCO HERO — Foto + Nome ═══ */}
                            <div className="flex flex-col items-center text-center mb-8 pt-4">
                                {/* Foto ampliada */}
                                <div className="relative mb-6">
                                    {c.fotoUrl ? (
                                        <img src={c.fotoUrl} alt={c.nome} className="w-32 h-32 rounded-full object-cover ring-2 ring-primary/20 shadow-2xl shadow-primary/10" />
                                    ) : (
                                        <div className="w-32 h-32 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center">
                                            <span className="font-display font-bold text-3xl text-zinc-500 tracking-widest">{(c.nome?.[0] || '')}{(c.sobrenome?.[0] || '')}</span>
                                        </div>
                                    )}
                                    {/* Badge de status */}
                                    {c.favorito && (
                                        <span className="absolute 0-bottom-1 -right-1 bg-primary text-black p-2 rounded-full ring-4 ring-zinc-900"><Star size={14} className="fill-black" /></span>
                                    )}
                                    {c.blacklist && (
                                        <span className="absolute -bottom-1 -right-1 bg-red-500 text-white p-2 rounded-full ring-4 ring-zinc-900"><Ban size={14} /></span>
                                    )}
                                </div>
                                <h3 className="font-display font-bold text-3xl uppercase tracking-tighter mb-1">{c.nome} {c.sobrenome}</h3>
                                {c.apelido && <span className="text-primary text-sm font-modern italic tracking-wide">"{c.apelido}"</span>}
                                <div className="flex items-center gap-3 mt-4">
                                    <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 border ${score >= 80 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : score >= 50 ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                                        Score: {score}%
                                    </span>
                                    {c.favorito && <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 bg-primary/10 text-primary border border-primary/20">⭐ Favorito</span>}
                                    {c.blacklist && <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20">🚫 Blacklist</span>}
                                </div>
                            </div>

                            {/* ═══ BLOCO CONTATO ═══ */}
                            <div className="bg-white/[0.02] border border-white/5 p-6 mb-6">
                                <h4 className="text-[10px] font-bold uppercase tracking-[0.5em] text-primary mb-6 flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center"><User size={12} /></div>
                                    Contato
                                </h4>
                                <div className="space-y-4 text-sm font-modern">
                                    <div className="flex justify-between items-center"><span className="text-zinc-500 text-xs uppercase tracking-widest">WhatsApp</span><span className="text-white font-bold">{c.whatsapp || '—'}</span></div>
                                    <div className="h-px w-full bg-white/5" />
                                    <div className="flex justify-between items-center"><span className="text-zinc-500 text-xs uppercase tracking-widest">E-mail</span><span className="text-white font-bold">{c.email || '—'}</span></div>
                                    <div className="h-px w-full bg-white/5" />
                                    <div className="flex justify-between items-center"><span className="text-zinc-500 text-xs uppercase tracking-widest">Cadastro</span><span className="text-zinc-400">{formatData(c.criadoEm)}</span></div>
                                    {c.nascimento && (
                                        <>
                                            <div className="h-px w-full bg-white/5" />
                                            <div className="flex justify-between items-center"><span className="text-zinc-500 text-xs uppercase tracking-widest">Nascimento</span><span className="text-zinc-400">{formatData(c.nascimento)}</span></div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* ═══ BLOCO HISTÓRICO ═══ */}
                            <div className="bg-white/[0.02] border border-white/5 p-6 mb-6">
                                <h4 className="text-[10px] font-bold uppercase tracking-[0.5em] text-primary mb-6 flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center"><CalendarDays size={12} /></div>
                                    Histórico
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                    <div className="bg-black/50 border border-white/5 p-4 text-center">
                                        <span className="text-2xl font-display font-bold text-white block mb-1 tabular-nums">{totalAgs}</span>
                                        <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Total</span>
                                    </div>
                                    <div className="bg-black/50 border border-white/5 p-4 text-center">
                                        <span className="text-2xl font-display font-bold text-emerald-400 block mb-1 tabular-nums">{concluidosCount}</span>
                                        <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Concluídos</span>
                                    </div>
                                    <div className="bg-black/50 border border-white/5 p-4 text-center">
                                        <span className="text-2xl font-display font-bold text-orange-400 block mb-1 tabular-nums">{faltasCount}</span>
                                        <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Faltas</span>
                                    </div>
                                    <div className="bg-black/50 border border-white/5 p-4 text-center">
                                        <span className="text-2xl font-display font-bold text-zinc-500 block mb-1 tabular-nums">{canceladosCount + rejeitadosCount}</span>
                                        <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Cancelados</span>
                                    </div>
                                </div>
                                <div className="space-y-4 text-sm font-modern bg-black/30 p-4 border border-white/5">
                                    <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2">
                                        <span className="text-zinc-500 text-xs uppercase tracking-widest">Último atendimento</span>
                                        <span className="font-bold">{ultimoConcluido ? <>{formatData(ultimoConcluido.data)} <span className="text-zinc-600 font-normal mx-2">—</span> <span className="text-primary">{ultimoConcluido.servicoNome}</span></> : '—'}</span>
                                    </div>
                                    <div className="h-px w-full bg-white/5 hidden md:block" />
                                    <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2">
                                        <span className="text-zinc-500 text-xs uppercase tracking-widest">Próximo agendamento</span>
                                        <span className="font-bold">{proximo ? <>{formatData(proximo.data)} <span className="text-zinc-600 font-normal mx-2">—</span> <span className="text-primary">{proximo.servicoNome}</span></> : '—'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* ═══ BLOCO FINANCEIRO ═══ */}
                            <div className="bg-white/[0.02] border border-white/5 p-6 mb-6">
                                <h4 className="text-[10px] font-bold uppercase tracking-[0.5em] text-primary mb-6 flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center"><Tag size={12} /></div>
                                    Financeiro
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                    <div className="bg-black/50 border border-white/5 p-5 flex flex-col items-center justify-center">
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Valor Total Investido</span>
                                        <span className="text-3xl font-display font-bold text-primary tabular-nums">R$ {valorTotal.toFixed(0)}</span>
                                    </div>
                                    <div className="bg-black/50 border border-white/5 p-5 flex flex-col items-center justify-center">
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Ticket Médio</span>
                                        <span className="text-3xl font-display font-bold text-white tabular-nums">R$ {ticketMedio.toFixed(0)}</span>
                                    </div>
                                </div>
                                {topServicos.length > 0 && (
                                    <div className="bg-black/30 border border-white/5 p-4">
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block mb-3">Serviços Favoritos</span>
                                        <div className="flex flex-wrap gap-2">
                                            {topServicos.map(([nome, qtd]) => (
                                                <span key={nome} className="text-[10px] border border-primary/20 bg-primary/5 text-white px-3 py-1.5 font-bold tracking-wide">
                                                    <span className="text-primary mr-2 uppercase">{qtd}x</span> {nome}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* ═══ BLOCO ADMIN ═══ */}
                            <div className="bg-white/[0.02] border border-white/5 p-6 mb-8">
                                <h4 className="text-[10px] font-bold uppercase tracking-[0.5em] text-primary mb-6 flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center"><Edit3 size={12} /></div>
                                    Notas Internas
                                </h4>
                                <div className="mb-5">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block mb-2">Apelido (Para fácil identificação)</label>
                                    <input type="text" value={editApelido} onChange={e => setEditApelido(e.target.value)} className="w-full bg-black border-b border-white/10 px-4 py-3 text-sm text-white font-modern focus:border-primary focus:outline-none transition-colors placeholder:text-zinc-700" placeholder="Ex: João do Corte" />
                                </div>
                                <div className="mb-5">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block mb-2">Observações (Privado: Barbeiros)</label>
                                    <textarea value={editObs} onChange={e => setEditObs(e.target.value)} className="w-full bg-black border-b border-white/10 px-4 py-3 text-sm text-white font-modern focus:border-primary focus:outline-none h-20 resize-none transition-colors placeholder:text-zinc-700" placeholder="Escreva informações que devem ser lembradas..." />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block mb-3">Context Tags</label>
                                    <div className="flex gap-2 flex-wrap mb-4 bg-black/30 p-3 border border-white/5 rounded-sm min-h-[48px] items-center">
                                        {(c.tags || []).length === 0 && <span className="text-[10px] text-zinc-600 italic">Nenhuma tag...</span>}
                                        {(c.tags || []).map(t => (
                                            <span key={t} className="text-[10px] bg-primary/10 text-primary px-3 py-1.5 font-bold uppercase tracking-widest flex items-center gap-2 border border-primary/20">
                                                {t} <button onClick={() => removeTag(c.id, t)} className="text-primary/50 hover:text-primary transition-colors"><X size={12} /></button>
                                            </span>
                                        ))}
                                    </div>
                                    <div className="flex gap-3">
                                        <input type="text" value={editTag} onChange={e => setEditTag(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTag(c.id)} placeholder="Adicionar tag e apertar Enter..." className="flex-1 bg-black border-b border-white/10 px-4 py-2 text-sm text-white font-modern focus:border-primary focus:outline-none transition-colors" />
                                        <button onClick={() => addTag(c.id)} className="bg-white/5 hover:bg-white/10 text-white px-6 py-2 text-xs font-bold uppercase tracking-widest transition-colors">Add</button>
                                    </div>
                                </div>
                            </div>

                            {/* ═══ AÇÕES BOTOES ═══ */}
                            <div className="flex flex-col md:flex-row gap-4 mb-2">
                                <button onClick={salvarEdicao} className="flex-1 bg-primary text-black py-4 font-display font-bold uppercase text-xs tracking-[0.3em] hover:bg-white hover:text-black transition-colors">
                                    Salvar Alterações
                                </button>
                                <button onClick={() => toggleFav(c.id)} className={`px-6 py-4 border text-xs font-display font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 ${c.favorito ? 'border-primary text-primary bg-primary/5 hover:bg-primary/10' : 'border-white/10 text-zinc-400 hover:text-white hover:border-white/30 bg-black'}`}>
                                    <Star size={16} className={c.favorito ? 'fill-primary' : ''} />
                                    <span className="hidden md:inline">{c.favorito ? 'Favoritado' : 'Favoritar'}</span>
                                </button>
                                <button onClick={() => toggleBlacklist(c.id, !c.blacklist)} className={`px-6 py-4 font-display font-bold uppercase text-xs tracking-[0.3em] transition-colors border ${c.blacklist ? 'bg-zinc-800 text-white border-zinc-700 hover:bg-zinc-700' : 'bg-red-500/5 text-red-500 border-red-500/20 hover:bg-red-500/10'}`}>
                                    {c.blacklist ? 'Retirar Blacklist' : 'Dar Blacklist'}
                                </button>
                            </div>

                            {c.whatsapp && (
                                <a href={gerarLinkWhatsAppCliente(c.whatsapp, 'Olá! Aqui é da Pixico Barber.')} target="_blank" rel="noopener noreferrer"
                                    className="w-full flex items-center justify-center gap-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 py-4 font-display font-bold uppercase text-xs tracking-[0.3em] transition-colors">
                                    <MessageCircle size={16} /> Contatar via WhatsApp
                                </a>
                            )}
                        </div>
                    </ModalOverlay>
                );
            })()}

            {/* Modal Blacklist */}
            {modal?.tipo === 'blacklist' && (
                <ModalOverlay onClose={() => setModal(null)}>
                    <h3 className="font-display font-bold text-2xl uppercase tracking-tighter mb-6 text-red-500 flex items-center gap-3">
                        <Ban size={24} /> Adicionar à Blacklist
                    </h3>
                    <p className="text-zinc-400 text-sm font-modern mb-6">Bloquear o cliente de realizar novos agendamentos online. Apenas admins poderão gerenciar o cliente.</p>
                    <textarea value={blMotivo} onChange={e => setBlMotivo(e.target.value)} placeholder="Descreva o motivo da restrição..." className="w-full bg-black border-b border-white/20 p-4 text-sm text-white font-modern focus:border-red-500 focus:outline-none h-32 resize-none mb-6 placeholder:text-zinc-600 transition-colors" />
                    <button onClick={confirmarBlacklist} className="w-full bg-red-600 hover:bg-red-500 text-white py-4 font-display font-bold uppercase text-xs tracking-[0.3em] transition-colors">Confirmar Bloqueio</button>
                </ModalOverlay>
            )}
        </div>
    );
}

function ModalOverlay({ children, onClose }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" onClick={onClose} />
            <div className="relative bg-[#0a0a0a] border border-white/10 p-6 md:p-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl overflow-x-hidden">
                <button onClick={onClose} className="absolute top-6 right-6 text-zinc-600 hover:text-white transition-colors bg-white/5 p-2 rounded-full hover:bg-white/10"><X size={18} /></button>
                {children}
            </div>
        </div>
    );
}
