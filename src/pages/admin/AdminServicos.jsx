import { useState, useRef } from 'react';
import serviceStore, { CATEGORIAS, BADGES } from '../../stores/serviceStore';
import { useStoreSync } from '../../hooks/useStore';
import { isSupabaseConfigured } from '../../lib/supabase';
import { useSupabaseServices, createServiceSupabase, updateServiceSupabase, deleteServiceSupabase } from '../../hooks/useSupabase';
import {
    Scissors, Plus, Search, Filter, Edit3, Trash2, Copy, Eye, EyeOff,
    ChevronUp, ChevronDown, X, Camera, Check, ToggleLeft, ToggleRight,
    Star, Tag, Clock, DollarSign, Image as ImageIcon, Save, ArrowUpRight
} from 'lucide-react';

const STATUS_OPTS = [
    { value: '', label: 'Todos' },
    { value: 'ativo', label: 'Ativos' },
    { value: 'inativo', label: 'Inativos' },
];

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_MB = 2;

function formatPreco(v) { return `R$ ${Number(v || 0).toFixed(0)}`; }

// ═══════════════════════════════════════════════
// Componente principal
// ═══════════════════════════════════════════════
export default function AdminServicos() {
    const storeTick = useStoreSync();
    const [busca, setBusca] = useState('');
    const [filtroStatus, setFiltroStatus] = useState('');
    const [filtroCategoria, setFiltroCategoria] = useState('');
    const [editando, setEditando] = useState(null); // null | 'novo' | serviceId
    const [confirmDelete, setConfirmDelete] = useState(null);

    const sb = isSupabaseConfigured();
    const { services: sbServices, loading: sbLoading, refetch: refetchServices, getStats: sbGetStats } = useSupabaseServices();

    const todos = sb ? sbServices : serviceStore.getAll();
    const stats = sb ? sbGetStats() : serviceStore.getStats();

    // Filtrar
    const filtrados = todos.filter(s => {
        if (busca) {
            const q = busca.toLowerCase();
            if (!s.nome.toLowerCase().includes(q) && !s.categoria.toLowerCase().includes(q) && !(s.badge || '').toLowerCase().includes(q)) return false;
        }
        if (filtroStatus && s.status !== filtroStatus) return false;
        if (filtroCategoria && s.categoria !== filtroCategoria) return false;
        return true;
    });

    async function handleDelete(id) {
        if (sb) {
            try { await deleteServiceSupabase(id); refetchServices(); } catch (err) { console.error(err); }
        } else { serviceStore.delete(id); }
        setConfirmDelete(null);
    }

    function handleDuplicate(id) {
        // Duplicação simples via local (Supabase não tem duplicate)
        const original = todos.find(s => s.id === id);
        if (!original) return;
        const copy = { ...original, nome: `${original.nome} (cópia)` };
        delete copy.id;
        if (sb) {
            createServiceSupabase(copy).then(() => refetchServices()).catch(console.error);
        } else { serviceStore.duplicate(id); }
    }

    async function handleToggleStatus(id) {
        const s = todos.find(s => s.id === id);
        if (!s) return;
        const novoStatus = s.status === 'ativo' ? 'inativo' : 'ativo';
        if (sb) {
            try { await updateServiceSupabase(id, { status: novoStatus }); refetchServices(); } catch (err) { console.error(err); }
        } else { serviceStore.toggleStatus(id); }
    }

    return (
        <div className="p-6 md:p-10 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                <div>
                    <span className="text-[10px] font-bold uppercase tracking-[1em] text-primary mb-3 block">Catálogo</span>
                    <h1 className="font-display font-bold text-3xl md:text-5xl uppercase tracking-tighter">Serviços</h1>
                </div>
                <button
                    onClick={() => setEditando('novo')}
                    className="flex items-center justify-center gap-3 bg-primary text-black px-8 py-4 font-display font-bold uppercase text-xs tracking-[0.3em] hover:bg-white transition-colors"
                >
                    <Plus size={16} /> Adicionar Serviço
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                {[
                    { label: 'Total', valor: stats.total, cor: 'text-white' },
                    { label: 'Ativos', valor: stats.ativos, cor: 'text-emerald-400' },
                    { label: 'Inativos', valor: stats.inativos, cor: 'text-zinc-500' },
                    { label: 'Destaque', valor: stats.destaque, cor: 'text-primary' },
                ].map(card => (
                    <div key={card.label} className="bg-black border border-white/5 p-6 hover:border-white/20 transition-colors">
                        <span className={`text-4xl font-display font-bold tabular-nums mb-2 block ${card.cor}`}>{card.valor}</span>
                        <span className="block text-[10px] font-bold uppercase tracking-[0.4em] text-zinc-500">{card.label}</span>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-8">
                <div className="flex-1 relative">
                    <Search size={16} className="absolute left-0 top-1/2 -translate-y-1/2 text-zinc-600" />
                    <input
                        type="text"
                        value={busca}
                        onChange={e => setBusca(e.target.value)}
                        placeholder="Buscar por nome, categoria ou badge..."
                        className="w-full bg-transparent border-b border-white/20 pl-8 pr-4 py-3 text-sm text-white font-modern focus:border-primary focus:outline-none placeholder:text-zinc-700 transition-colors"
                    />
                </div>
                <div className="flex gap-4">
                    <select
                        value={filtroStatus}
                        onChange={e => setFiltroStatus(e.target.value)}
                        className="bg-black border-b border-white/20 px-4 py-3 text-sm text-white font-modern focus:border-primary focus:outline-none appearance-none cursor-pointer uppercase tracking-widest text-[10px] font-bold"
                    >
                        {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <select
                        value={filtroCategoria}
                        onChange={e => setFiltroCategoria(e.target.value)}
                        className="bg-black border-b border-white/20 px-4 py-3 text-sm text-white font-modern focus:border-primary focus:outline-none appearance-none cursor-pointer uppercase tracking-widest text-[10px] font-bold"
                    >
                        <option value="">Todas categorias</option>
                        {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                </div>
            </div>

            {/* Count */}
            <div className="flex items-center gap-3 mb-8">
                <div className="h-px bg-white/10 flex-1" />
                <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                    {filtrados.length} serviço(s)
                </span>
                <div className="h-px bg-white/10 flex-1" />
            </div>

            {/* Lista */}
            {filtrados.length === 0 ? (
                <div className="border border-white/5 bg-white/[0.02] p-24 text-center mt-8">
                    <Scissors size={48} className="text-zinc-800 mx-auto mb-6" />
                    <p className="text-zinc-600 font-modern text-sm uppercase tracking-widest">Nenhum serviço encontrado no catálogo.</p>
                    <button onClick={() => setEditando('novo')} className="mt-6 text-primary border border-primary/20 bg-primary/5 px-6 py-3 font-display font-bold uppercase text-xs tracking-widest hover:bg-primary hover:text-black transition-colors">
                        Cadastrar Primeiro Serviço
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtrados.map((servico, idx) => (
                        <div
                            key={servico.id}
                            className={`flex flex-col md:flex-row md:items-center gap-4 p-4 md:p-5 border transition-all hover:bg-white/[0.02] group ${servico.status === 'inativo' ? 'border-white/5 opacity-60' : 'border-white/5 hover:border-white/20'
                                } bg-black`}
                        >
                            {/* Imagem */}
                            <div className="w-20 h-20 md:w-24 md:h-24 flex-shrink-0 bg-zinc-900 border border-white/10 flex items-center justify-center transition-colors group-hover:border-primary/20">
                                {servico.imagemUrl ? (
                                    <img src={servico.imagemUrl} alt="" className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" />
                                ) : (
                                    <Scissors size={24} className="text-zinc-700" />
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-3 mb-2">
                                    <span className="font-display font-bold text-lg uppercase tracking-tight truncate group-hover:text-primary transition-colors">
                                        {servico.nome}
                                    </span>
                                    {servico.badge && (
                                        <span className="text-[9px] font-bold uppercase tracking-widest bg-primary/10 border border-primary/20 text-primary px-3 py-1 flex-shrink-0">
                                            {servico.badge}
                                        </span>
                                    )}
                                    {servico.destaque && (
                                        <Star size={14} className="text-primary flex-shrink-0 drop-shadow-[0_0_8px_rgba(212,175,55,0.5)]" fill="currentColor" />
                                    )}
                                </div>
                                <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                                    <span className="text-zinc-400">{CATEGORIAS.find(c => c.id === servico.categoria)?.label || servico.categoria}</span>
                                    <span className="hidden md:inline text-zinc-700">|</span>
                                    <span>{servico.duracao} min</span>
                                    <span className="hidden md:inline text-zinc-700">|</span>
                                    <span className={`px-2 py-0.5 border ${servico.status === 'ativo' ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' : 'border-zinc-500/30 text-zinc-400 bg-zinc-500/10'}`}>
                                        {servico.status}
                                    </span>
                                </div>
                            </div>

                            {/* Preço */}
                            <div className="text-left md:text-right flex-shrink-0 min-w-[120px] bg-white/[0.02] border border-white/5 p-3 md:bg-transparent md:border-none md:p-0">
                                {servico.precoPromocional ? (
                                    <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center gap-2 md:gap-0">
                                        <span className="text-zinc-500 line-through text-[10px] font-modern font-bold uppercase tracking-widest">{formatPreco(servico.preco)}</span>
                                        <span className="text-primary font-display font-bold text-xl tabular-nums">{formatPreco(servico.precoPromocional)}</span>
                                    </div>
                                ) : (
                                    <span className="text-white font-display font-bold text-xl tabular-nums block text-center md:text-right w-full">{formatPreco(servico.preco)}</span>
                                )}
                            </div>

                            {/* Divider para mobile */}
                            <div className="h-px w-full bg-white/5 md:hidden block my-2" />

                            <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto">
                                {/* Ordem */}
                                <div className="flex items-center gap-2 flex-shrink-0 bg-white/[0.02] border border-white/5 px-2 py-1">
                                    <button onClick={async () => {
                                        if (sb) {
                                            const s = todos.find(x => x.id === servico.id);
                                            const idx = todos.indexOf(s);
                                            if (idx > 0) {
                                                await updateServiceSupabase(servico.id, { ordem: todos[idx - 1].ordem });
                                                await updateServiceSupabase(todos[idx - 1].id, { ordem: servico.ordem });
                                                refetchServices();
                                            }
                                        } else { serviceStore.moveUp(servico.id); }
                                    }} className="text-zinc-600 hover:text-primary transition-colors p-1">
                                        <ChevronUp size={16} />
                                    </button>
                                    <span className="text-[10px] text-zinc-500 font-bold w-4 text-center tabular-nums">{servico.ordem}</span>
                                    <button onClick={async () => {
                                        if (sb) {
                                            const s = todos.find(x => x.id === servico.id);
                                            const idx = todos.indexOf(s);
                                            if (idx < todos.length - 1) {
                                                await updateServiceSupabase(servico.id, { ordem: todos[idx + 1].ordem });
                                                await updateServiceSupabase(todos[idx + 1].id, { ordem: servico.ordem });
                                                refetchServices();
                                            }
                                        } else { serviceStore.moveDown(servico.id); }
                                    }} className="text-zinc-600 hover:text-primary transition-colors p-1">
                                        <ChevronDown size={16} />
                                    </button>
                                </div>

                                {/* Ações */}
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <button onClick={() => handleToggleStatus(servico.id)} className="p-2 border border-white/5 hover:bg-white/[0.05] text-zinc-400 hover:text-white transition-colors" title={servico.status === 'ativo' ? 'Desativar' : 'Ativar'}>
                                        {servico.status === 'ativo' ? <ToggleRight size={16} className="text-emerald-400" /> : <ToggleLeft size={16} />}
                                    </button>
                                    <button onClick={() => handleDuplicate(servico.id)} className="p-2 border border-white/5 hover:bg-white/[0.05] text-zinc-400 hover:text-white transition-colors" title="Duplicar">
                                        <Copy size={14} />
                                    </button>
                                    <button onClick={() => setEditando(servico.id)} className="p-2 border border-white/5 hover:bg-primary/20 hover:border-primary/50 text-zinc-400 hover:text-primary transition-colors" title="Editar">
                                        <Edit3 size={14} />
                                    </button>
                                    <button onClick={() => setConfirmDelete(servico.id)} className="p-2 border border-white/5 hover:bg-red-500/10 hover:border-red-500/50 text-zinc-400 hover:text-red-400 transition-colors" title="Excluir">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal de Edição */}
            {editando && (
                <ServiceModal
                    serviceId={editando === 'novo' ? null : editando}
                    onClose={() => setEditando(null)}
                    sb={sb}
                    sbServices={sbServices}
                    refetchServices={refetchServices}
                />
            )}

            {/* Confirm Delete */}
            {confirmDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setConfirmDelete(null)}>
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
                    <div className="relative bg-[#0a0a0a] border border-red-500/20 p-8 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
                            <Trash2 size={24} className="text-red-500" />
                        </div>
                        <h3 className="font-display font-bold text-xl uppercase tracking-tighter mb-4">Excluir Serviço?</h3>
                        <p className="text-zinc-400 font-modern text-sm leading-relaxed mb-8">
                            Tem certeza que deseja remover <strong className="text-white font-bold">"{todos.find(s => s.id === confirmDelete)?.nome || ''}"</strong> permanentemente? Esta ação não poderá ser desfeita.
                        </p>
                        <div className="flex gap-4">
                            <button onClick={() => setConfirmDelete(null)} className="flex-1 border border-white/10 py-4 text-[10px] font-bold font-display uppercase tracking-widest hover:bg-white/5 hover:text-white text-zinc-400 transition-colors">
                                Cancelar
                            </button>
                            <button onClick={() => handleDelete(confirmDelete)} className="flex-1 bg-red-500 text-white py-4 text-[10px] font-bold font-display uppercase tracking-widest hover:bg-red-600 transition-colors">
                                Excluir
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════
// Modal de Edição/Criação
// ═══════════════════════════════════════════════
function ServiceModal({ serviceId, onClose, sb, sbServices, refetchServices }) {
    const original = serviceId ? (sb ? sbServices.find(s => s.id === serviceId) : serviceStore.getById(serviceId)) : null;
    const inputRef = useRef(null);

    const [form, setForm] = useState({
        nome: original?.nome || '',
        descricaoCurta: original?.descricaoCurta || '',
        descricaoDetalhada: original?.descricaoDetalhada || '',
        preco: original?.preco || 0,
        precoPromocional: original?.precoPromocional || '',
        duracao: original?.duracao || 30,
        categoria: original?.categoria || 'corte',
        status: original?.status || 'ativo',
        badge: original?.badge || '',
        destaque: original?.destaque || false,
        visivelHome: original?.visivelHome !== undefined ? original.visivelHome : true,
        visivelCliente: original?.visivelCliente !== undefined ? original.visivelCliente : true,
        visivelAgendamento: original?.visivelAgendamento !== undefined ? original.visivelAgendamento : true,
        imagemUrl: original?.imagemUrl || '',
    });

    function handleChange(field, value) {
        setForm(prev => ({ ...prev, [field]: value }));
    }

    function processImage(file) {
        if (!ACCEPTED_TYPES.includes(file.type)) return;
        if (file.size > MAX_SIZE_MB * 1024 * 1024) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new window.Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX = 400;
                let w = img.width, h = img.height;
                if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
                else { w = Math.round(w * MAX / h); h = MAX; }
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                handleChange('imagemUrl', canvas.toDataURL('image/jpeg', 0.85));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    async function handleSave() {
        const data = {
            ...form,
            preco: Number(form.preco) || 0,
            precoPromocional: form.precoPromocional ? Number(form.precoPromocional) : null,
            duracao: Number(form.duracao) || 30,
        };

        if (sb) {
            try {
                if (serviceId) {
                    await updateServiceSupabase(serviceId, data);
                } else {
                    await createServiceSupabase(data);
                }
                refetchServices();
            } catch (err) { console.error('Erro ao salvar serviço:', err); }
        } else {
            if (serviceId) {
                serviceStore.update(serviceId, data);
            } else {
                serviceStore.create(data);
            }
        }
        onClose();
    }

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-8 md:pt-12 overflow-y-auto" onClick={onClose}>
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
            <div className="relative bg-[#0a0a0a] border border-white/10 w-full max-w-3xl my-8 shadow-2xl" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between p-6 md:p-8 border-b border-white/5 bg-white/[0.02]">
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-[0.5em] text-primary mb-2 block">Catálogo</span>
                        <h3 className="font-display font-bold text-2xl uppercase tracking-tighter">
                            {serviceId ? 'Editar Serviço' : 'Novo Serviço'}
                        </h3>
                    </div>
                    <button onClick={onClose} className="p-3 bg-white/[0.05] hover:bg-white/10 text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Form */}
                <div className="p-6 md:p-8 space-y-8">
                    {/* Imagem */}
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-4 block">Capa do Serviço</label>
                        <div className="flex items-center gap-6">
                            <div
                                className="w-24 h-24 bg-black border border-white/10 overflow-hidden cursor-pointer flex items-center justify-center hover:border-primary/50 transition-colors group"
                                onClick={() => inputRef.current?.click()}
                            >
                                {form.imagemUrl ? (
                                    <img src={form.imagemUrl} alt="" className="w-full h-full object-cover group-hover:opacity-80 transition-opacity" />
                                ) : (
                                    <Camera size={24} className="text-zinc-600 group-hover:scale-110 transition-transform" />
                                )}
                            </div>
                            <div>
                                <button onClick={() => inputRef.current?.click()} className="text-sm font-bold uppercase tracking-widest text-primary border-b border-primary/30 pb-1 hover:border-primary transition-colors">
                                    {form.imagemUrl ? 'Alterar Imagem' : 'Fazer Upload'}
                                </button>
                                {form.imagemUrl && (
                                    <button onClick={() => handleChange('imagemUrl', '')} className="block text-xs font-bold uppercase tracking-widest text-red-400 mt-3 hover:text-red-300 transition-colors">
                                        Remover
                                    </button>
                                )}
                                <p className="text-[10px] text-zinc-600 uppercase tracking-widest mt-4">JPG/PNG/WEBP · MÁX 2MB</p>
                            </div>
                            <input ref={inputRef} type="file" accept={ACCEPTED_TYPES.join(',')} onChange={e => e.target.files[0] && processImage(e.target.files[0])} className="hidden" />
                        </div>
                    </div>

                    <div className="h-px bg-white/5 w-full" />

                    {/* Nome & Preço Básicos */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3 block">Nome do Serviço *</label>
                            <input type="text" value={form.nome} onChange={e => handleChange('nome', e.target.value)}
                                className="w-full bg-black border border-white/10 px-4 py-3 text-white font-modern focus:border-primary focus:outline-none transition-colors"
                                placeholder="Ex: Corte + Barba Premium" />
                        </div>

                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3 block">Preço Padrão (R$)</label>
                            <input type="number" value={form.preco} onChange={e => handleChange('preco', e.target.value)}
                                className="w-full bg-black border border-white/10 px-4 py-3 text-white font-modern focus:border-primary focus:outline-none transition-colors" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3 block flex items-center gap-2">
                                Preço Promocional (R$) <span className="text-primary font-normal normal-case tracking-normal">(Opcional)</span>
                            </label>
                            <input type="number" value={form.precoPromocional} onChange={e => handleChange('precoPromocional', e.target.value)}
                                className="w-full bg-black border border-white/10 px-4 py-3 text-primary font-bold focus:border-primary focus:outline-none transition-colors"
                                placeholder="Deixe vazio para não usar" />
                        </div>
                    </div>

                    {/* Descrições */}
                    <div className="grid grid-cols-1 gap-6">
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3 block">Resumo Curto (Para Cards)</label>
                            <input type="text" value={form.descricaoCurta} onChange={e => handleChange('descricaoCurta', e.target.value)}
                                className="w-full bg-black border border-white/10 px-4 py-3 text-white font-modern focus:border-primary focus:outline-none transition-colors text-sm"
                                placeholder="Ex: Apenas máquina, finalização rápida" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3 block">Descrição Detalhada</label>
                            <textarea value={form.descricaoDetalhada} onChange={e => handleChange('descricaoDetalhada', e.target.value)}
                                className="w-full bg-black border border-white/10 px-4 py-3 text-white font-modern focus:border-primary focus:outline-none transition-colors text-sm min-h-[100px] resize-y"
                                placeholder="Descreva tudo que o cliente recebe neste serviço..." />
                        </div>
                    </div>

                    {/* Informações Operacionais */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3 block">Tempo (min)</label>
                            <input type="number" value={form.duracao} onChange={e => handleChange('duracao', e.target.value)}
                                className="w-full bg-black border border-white/10 px-4 py-3 text-white font-modern focus:border-primary focus:outline-none transition-colors" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3 block">Categoria</label>
                            <select value={form.categoria} onChange={e => handleChange('categoria', e.target.value)}
                                className="w-full bg-black border border-white/10 px-4 py-3 text-white font-modern focus:border-primary focus:outline-none appearance-none cursor-pointer uppercase text-xs">
                                {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3 block">Selo / Badge</label>
                            <select value={form.badge} onChange={e => handleChange('badge', e.target.value)}
                                className="w-full bg-black border border-white/10 px-4 py-3 text-primary font-bold focus:border-primary focus:outline-none appearance-none cursor-pointer uppercase text-xs">
                                <option value="">Nenhum Selo</option>
                                {BADGES.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="h-px bg-white/5 w-full" />

                    {/* Visibilidade */}
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-4 block">Onde este serviço será exibido?</label>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {[
                                { key: 'destaque', label: 'Estrela', icon: Star },
                                { key: 'visivelHome', label: 'Homepage', icon: Eye },
                                { key: 'visivelCliente', label: 'Conta Cliente', icon: Eye },
                                { key: 'visivelAgendamento', label: 'App Agenda', icon: Eye },
                            ].map(opt => (
                                <button
                                    key={opt.key}
                                    type="button"
                                    onClick={() => handleChange(opt.key, !form[opt.key])}
                                    className={`flex items-center gap-3 p-4 border text-xs font-bold uppercase tracking-widest transition-all ${form[opt.key]
                                        ? 'border-primary/50 bg-primary/10 text-primary'
                                        : 'border-white/5 bg-white/[0.02] text-zinc-500 hover:border-white/20 hover:text-white'
                                        }`}
                                >
                                    {form[opt.key] ? <Check size={16} /> : <opt.icon size={16} />}
                                    <span className="truncate">{opt.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Status Global */}
                    <div className="bg-white/[0.02] border border-white/5 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                            <h4 className="text-white font-display font-bold uppercase tracking-tight mb-1">Status Global</h4>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Se inativo, fica oculto e bloqueado no agendamento</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => handleChange('status', form.status === 'ativo' ? 'inativo' : 'ativo')}
                            className={`flex items-center gap-3 px-6 py-3 text-xs font-bold uppercase tracking-widest transition-all border ${form.status === 'ativo'
                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                                : 'border-zinc-500/30 bg-zinc-500/10 text-zinc-400'
                                }`}
                        >
                            {form.status === 'ativo' ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                            {form.status === 'ativo' ? 'Ativo no Sistema' : 'Inativo / Arquivado'}
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/5 flex gap-4 bg-black">
                    <button onClick={onClose} className="flex-1 border border-white/10 py-4 font-display font-bold uppercase text-xs tracking-[0.3em] hover:bg-white/5 transition-colors">
                        Cancelar
                    </button>
                    <button onClick={handleSave} className="flex-1 bg-primary text-black py-4 font-display font-bold uppercase text-xs tracking-[0.3em] hover:bg-white transition-colors flex items-center justify-center gap-2">
                        <Save size={16} /> {serviceId ? 'Atualizar Serviço' : 'Criar Serviço'}
                    </button>
                </div>
            </div>
        </div>
    );
}
