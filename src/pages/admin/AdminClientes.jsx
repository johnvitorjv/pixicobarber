import { useState } from 'react';
import clientStore from '../../stores/clientStore';
import appointmentStore from '../../stores/appointmentStore';
import { gerarLinkWhatsAppCliente } from '../../data/whatsappTemplates';
import { STATUS } from '../../data/models';
import { useStoreSync } from '../../hooks/useStore';
import { isSupabaseConfigured } from '../../lib/supabase';
import { useSupabaseClients } from '../../hooks/useSupabase';
import { Avatar } from '../../components/PhotoUpload';
import {
    Search, Star, Ban, MessageCircle, Edit3, X, Eye, Tag, Plus, Trash2, User
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
    const { clients: sbClients, loading: sbLoading } = useSupabaseClients();

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

    function toggleFav(id) { clientStore.toggleFavorito(id); }

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
        <div className="p-6 lg:p-8">
            <div className="mb-6">
                <span className="text-[10px] font-bold uppercase tracking-[1em] text-primary mb-2 block">Gestão</span>
                <h1 className="font-display font-bold text-2xl uppercase tracking-tight">Clientes</h1>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-3 mb-6">
                <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
                    <input type="text" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome, apelido, telefone, e-mail..."
                        className="w-full bg-black/50 border border-white/10 pl-10 pr-4 py-2.5 text-sm text-white font-modern focus:border-primary focus:outline-none" />
                </div>
                <div className="flex gap-2">
                    {['todos', 'favoritos', 'blacklist'].map(f => (
                        <button key={f} onClick={() => setFiltro(f)}
                            className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wider border transition-colors ${filtro === f ? 'border-primary text-primary bg-primary/5' : 'border-white/10 text-zinc-500 hover:text-white'}`}>
                            {f === 'todos' ? 'Todos' : f === 'favoritos' ? '⭐ Favoritos' : '🚫 Blacklist'}
                        </button>
                    ))}
                </div>
            </div>

            <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-wider mb-4">{clientes.length} cliente(s)</p>

            {/* Grid de clientes */}
            {clientes.length === 0 ? (
                <div className="bg-zinc-900/40 border border-white/5 p-12 text-center">
                    <p className="text-zinc-500 font-modern">Nenhum cliente encontrado.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {clientes.map(c => {
                        const ags = appointmentStore.getByClient(c.id);
                        const concluidos = ags.filter(a => a.status === STATUS.CONCLUIDO).length;
                        const faltas = ags.filter(a => a.status === STATUS.NAO_COMPARECEU).length;
                        return (
                            <div key={c.id} className={`bg-zinc-900/60 border p-4 transition-all hover:bg-zinc-900/80 ${c.blacklist ? 'border-red-500/20' : c.favorito ? 'border-primary/20' : 'border-white/5'}`}>
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <Avatar src={c.fotoUrl} initials={`${c.nome?.[0] || ''}${c.sobrenome?.[0] || ''}`} size="sm" />
                                        <div>
                                            <span className="font-modern text-sm font-bold block">{c.apelido || c.nome} {c.sobrenome?.[0]}.</span>
                                            <span className="text-[10px] text-zinc-600">{c.email}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => toggleFav(c.id)} className={`p-1 transition-colors ${c.favorito ? 'text-primary' : 'text-zinc-700 hover:text-primary'}`}>
                                            <Star size={14} className={c.favorito ? 'fill-primary' : ''} />
                                        </button>
                                        <button onClick={() => abrirDetalhe(c)} className="p-1 text-zinc-600 hover:text-white transition-colors">
                                            <Eye size={14} />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 text-[10px] font-modern text-zinc-500">
                                    <span>{concluidos} concl.</span>
                                    <span>{faltas} falta(s)</span>
                                    <span>Score: {c.scorePresenca || 100}</span>
                                </div>
                                {c.blacklist && (
                                    <div className="mt-2 text-[9px] font-bold uppercase tracking-wider text-red-400 bg-red-400/10 px-2 py-1 inline-block">Blacklist</div>
                                )}
                                {(c.tags || []).length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1">
                                        {c.tags.map(t => (
                                            <span key={t} className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 font-bold uppercase tracking-wider">{t}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal Detalhe */}
            {modal?.tipo === 'detalhe' && (() => {
                const c = clientStore.getById(modal.cliente.id) || modal.cliente;
                const ags = appointmentStore.getByClient(c.id);
                return (
                    <ModalOverlay onClose={() => setModal(null)}>
                        <h3 className="font-display font-bold text-lg uppercase tracking-tight mb-4 flex items-center gap-2">
                            <User size={20} className="text-primary" /> {c.nome} {c.sobrenome}
                        </h3>
                        <div className="space-y-2 mb-4 text-sm font-modern">
                            <div className="flex justify-between border-b border-white/5 py-1"><span className="text-zinc-500">E-mail</span><span>{c.email}</span></div>
                            <div className="flex justify-between border-b border-white/5 py-1"><span className="text-zinc-500">WhatsApp</span><span>{c.whatsapp}</span></div>
                            <div className="flex justify-between border-b border-white/5 py-1"><span className="text-zinc-500">Cadastro</span><span>{formatData(c.criadoEm)}</span></div>
                            <div className="flex justify-between border-b border-white/5 py-1"><span className="text-zinc-500">Score</span><span>{c.scorePresenca || 100}</span></div>
                            <div className="flex justify-between border-b border-white/5 py-1"><span className="text-zinc-500">Agendamentos</span><span>{ags.length}</span></div>
                        </div>

                        <div className="mb-4">
                            <label className="text-[10px] font-bold uppercase tracking-[0.4em] text-zinc-500 block mb-1">Apelido interno</label>
                            <input type="text" value={editApelido} onChange={e => setEditApelido(e.target.value)} className="w-full bg-black/50 border border-white/10 px-3 py-2 text-sm text-white font-modern focus:border-primary focus:outline-none" placeholder="Ex: João do Corte" />
                        </div>
                        <div className="mb-4">
                            <label className="text-[10px] font-bold uppercase tracking-[0.4em] text-zinc-500 block mb-1">Observações privadas</label>
                            <textarea value={editObs} onChange={e => setEditObs(e.target.value)} className="w-full bg-black/50 border border-white/10 px-3 py-2 text-sm text-white font-modern focus:border-primary focus:outline-none h-20 resize-none" />
                        </div>
                        <div className="mb-4">
                            <label className="text-[10px] font-bold uppercase tracking-[0.4em] text-zinc-500 block mb-1">Tags</label>
                            <div className="flex gap-1 flex-wrap mb-2">
                                {(c.tags || []).map(t => (
                                    <span key={t} className="text-[9px] bg-primary/10 text-primary px-2 py-1 font-bold uppercase tracking-wider flex items-center gap-1">
                                        {t} <button onClick={() => removeTag(c.id, t)} className="text-primary/50 hover:text-primary"><X size={10} /></button>
                                    </span>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <input type="text" value={editTag} onChange={e => setEditTag(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTag(c.id)} placeholder="Nova tag..." className="flex-1 bg-black/50 border border-white/10 px-3 py-1.5 text-sm text-white font-modern focus:border-primary focus:outline-none" />
                                <button onClick={() => addTag(c.id)} className="bg-primary/10 text-primary px-3 py-1.5 text-xs font-bold"><Plus size={14} /></button>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button onClick={salvarEdicao} className="flex-1 bg-primary text-black py-3 font-display font-bold uppercase text-xs tracking-[0.3em]">Salvar</button>
                            <button onClick={() => toggleBlacklist(c.id, !c.blacklist)} className={`px-6 py-3 font-display font-bold uppercase text-xs tracking-[0.3em] ${c.blacklist ? 'bg-zinc-700 text-white' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                {c.blacklist ? 'Remover Blacklist' : 'Blacklist'}
                            </button>
                        </div>
                    </ModalOverlay>
                );
            })()}

            {/* Modal Blacklist */}
            {modal?.tipo === 'blacklist' && (
                <ModalOverlay onClose={() => setModal(null)}>
                    <h3 className="font-display font-bold text-lg uppercase tracking-tight mb-4 text-red-400 flex items-center gap-2">
                        <Ban size={20} /> Adicionar à Blacklist
                    </h3>
                    <textarea value={blMotivo} onChange={e => setBlMotivo(e.target.value)} placeholder="Motivo da blacklist..." className="w-full bg-black/50 border border-white/10 p-3 text-sm text-white font-modern focus:border-primary focus:outline-none h-24 resize-none mb-4" />
                    <button onClick={confirmarBlacklist} className="w-full bg-red-500 text-white py-3 font-display font-bold uppercase text-xs tracking-[0.3em]">Confirmar</button>
                </ModalOverlay>
            )}
        </div>
    );
}

function ModalOverlay({ children, onClose }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-zinc-900 border border-white/10 p-6 md:p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X size={18} /></button>
                {children}
            </div>
        </div>
    );
}
