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
        <div className="p-6 lg:p-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                <div>
                    <span className="text-[10px] font-bold uppercase tracking-[1em] text-primary mb-2 block">Gestão</span>
                    <h1 className="font-display font-bold text-2xl md:text-3xl uppercase tracking-tight">Serviços</h1>
                </div>
                <button
                    onClick={() => setEditando('novo')}
                    className="flex items-center gap-2 bg-primary text-black px-6 py-3 font-display font-bold uppercase text-xs tracking-[0.3em] hover:scale-[1.02] transition-transform"
                >
                    <Plus size={16} /> Novo Serviço
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {[
                    { label: 'Total', valor: stats.total, cor: 'text-white', bg: 'bg-white/5' },
                    { label: 'Ativos', valor: stats.ativos, cor: 'text-green-400', bg: 'bg-green-400/10' },
                    { label: 'Inativos', valor: stats.inativos, cor: 'text-zinc-400', bg: 'bg-zinc-400/10' },
                    { label: 'Destaque', valor: stats.destaque, cor: 'text-primary', bg: 'bg-primary/10' },
                ].map(card => (
                    <div key={card.label} className={`${card.bg} border border-white/5 p-4`}>
                        <span className={`text-2xl font-display font-bold ${card.cor}`}>{card.valor}</span>
                        <span className="block text-[9px] font-bold uppercase tracking-[0.4em] text-zinc-500 mt-1">{card.label}</span>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <div className="flex-1 relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                        type="text"
                        value={busca}
                        onChange={e => setBusca(e.target.value)}
                        placeholder="Buscar serviço..."
                        className="w-full bg-black/50 border border-white/10 pl-10 pr-4 py-2.5 text-sm text-white font-modern focus:border-primary focus:outline-none transition-colors"
                    />
                </div>
                <select
                    value={filtroStatus}
                    onChange={e => setFiltroStatus(e.target.value)}
                    className="bg-black/50 border border-white/10 px-4 py-2.5 text-sm text-white font-modern focus:border-primary focus:outline-none appearance-none cursor-pointer"
                >
                    {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <select
                    value={filtroCategoria}
                    onChange={e => setFiltroCategoria(e.target.value)}
                    className="bg-black/50 border border-white/10 px-4 py-2.5 text-sm text-white font-modern focus:border-primary focus:outline-none appearance-none cursor-pointer"
                >
                    <option value="">Todas categorias</option>
                    {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
            </div>

            {/* Count */}
            <span className="text-[10px] font-bold uppercase tracking-[0.5em] text-primary mb-4 block">
                {filtrados.length} resultado(s)
            </span>

            {/* Lista */}
            {filtrados.length === 0 ? (
                <div className="text-center py-20">
                    <Scissors size={48} className="text-zinc-800 mx-auto mb-4" />
                    <p className="text-zinc-600 font-modern">Nenhum serviço encontrado.</p>
                    <button onClick={() => setEditando('novo')} className="mt-4 text-primary text-sm font-modern hover:underline">
                        Criar primeiro serviço
                    </button>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtrados.map((servico, idx) => (
                        <div
                            key={servico.id}
                            className={`flex items-center gap-4 p-4 border transition-all hover:border-white/10 ${servico.status === 'inativo' ? 'border-white/5 opacity-50' : 'border-white/5'
                                } bg-zinc-900/40`}
                        >
                            {/* Imagem */}
                            <div className="w-14 h-14 flex-shrink-0 bg-zinc-800 overflow-hidden">
                                {servico.imagemUrl ? (
                                    <img src={servico.imagemUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <Scissors size={20} className="text-zinc-600" />
                                    </div>
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className="font-display font-bold text-sm uppercase tracking-tight truncate">
                                        {servico.nome}
                                    </span>
                                    {servico.badge && (
                                        <span className="text-[8px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 flex-shrink-0">
                                            {servico.badge}
                                        </span>
                                    )}
                                    {servico.destaque && (
                                        <Star size={12} className="text-primary flex-shrink-0" fill="currentColor" />
                                    )}
                                </div>
                                <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-modern">
                                    <span>{CATEGORIAS.find(c => c.id === servico.categoria)?.label || servico.categoria}</span>
                                    <span>·</span>
                                    <span>{servico.duracao}min</span>
                                    <span>·</span>
                                    <span className={servico.status === 'ativo' ? 'text-green-400' : 'text-red-400'}>
                                        {servico.status}
                                    </span>
                                </div>
                            </div>

                            {/* Preço */}
                            <div className="text-right flex-shrink-0">
                                {servico.precoPromocional ? (
                                    <>
                                        <span className="text-zinc-500 line-through text-xs font-modern block">{formatPreco(servico.preco)}</span>
                                        <span className="text-primary font-display font-bold text-sm">{formatPreco(servico.precoPromocional)}</span>
                                    </>
                                ) : (
                                    <span className="text-white font-display font-bold text-sm">{formatPreco(servico.preco)}</span>
                                )}
                            </div>

                            {/* Ordem */}
                            <div className="flex flex-col gap-0.5 flex-shrink-0">
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
                                }} className="text-zinc-600 hover:text-primary transition-colors p-0.5">
                                    <ChevronUp size={14} />
                                </button>
                                <span className="text-[9px] text-zinc-600 text-center font-mono">{servico.ordem}</span>
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
                                }} className="text-zinc-600 hover:text-primary transition-colors p-0.5">
                                    <ChevronDown size={14} />
                                </button>
                            </div>

                            {/* Ações */}
                            <div className="flex items-center gap-1 flex-shrink-0">
                                <button onClick={() => handleToggleStatus(servico.id)} className="p-2 text-zinc-500 hover:text-white transition-colors" title={servico.status === 'ativo' ? 'Desativar' : 'Ativar'}>
                                    {servico.status === 'ativo' ? <ToggleRight size={18} className="text-green-400" /> : <ToggleLeft size={18} />}
                                </button>
                                <button onClick={() => handleDuplicate(servico.id)} className="p-2 text-zinc-500 hover:text-white transition-colors" title="Duplicar">
                                    <Copy size={14} />
                                </button>
                                <button onClick={() => setEditando(servico.id)} className="p-2 text-zinc-500 hover:text-primary transition-colors" title="Editar">
                                    <Edit3 size={14} />
                                </button>
                                <button onClick={() => setConfirmDelete(servico.id)} className="p-2 text-zinc-500 hover:text-red-400 transition-colors" title="Excluir">
                                    <Trash2 size={14} />
                                </button>
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
                    <div className="absolute inset-0 bg-black/80" />
                    <div className="relative bg-zinc-900 border border-white/10 p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
                        <h3 className="font-display font-bold text-lg uppercase mb-3">Excluir Serviço?</h3>
                        <p className="text-zinc-400 font-modern text-sm mb-6">
                            "{todos.find(s => s.id === confirmDelete)?.nome || ''}" será removido permanentemente. Esta ação não pode ser desfeita.
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setConfirmDelete(null)} className="flex-1 border border-white/10 py-3 text-sm font-display uppercase tracking-wider hover:bg-white/5 transition-colors">
                                Cancelar
                            </button>
                            <button onClick={() => handleDelete(confirmDelete)} className="flex-1 bg-red-500 text-white py-3 text-sm font-display uppercase tracking-wider hover:bg-red-600 transition-colors">
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
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-8 overflow-y-auto" onClick={onClose}>
            <div className="absolute inset-0 bg-black/80" />
            <div className="relative bg-zinc-900 border border-white/10 w-full max-w-2xl my-8" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/5">
                    <h3 className="font-display font-bold text-lg uppercase tracking-tight">
                        {serviceId ? 'Editar Serviço' : 'Novo Serviço'}
                    </h3>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Form */}
                <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                    {/* Imagem */}
                    <div className="flex items-center gap-4">
                        <div
                            className="w-20 h-20 bg-zinc-800 border border-white/10 overflow-hidden cursor-pointer flex items-center justify-center hover:border-primary/50 transition-colors"
                            onClick={() => inputRef.current?.click()}
                        >
                            {form.imagemUrl ? (
                                <img src={form.imagemUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <Camera size={24} className="text-zinc-600" />
                            )}
                        </div>
                        <div>
                            <button onClick={() => inputRef.current?.click()} className="text-sm text-primary font-modern hover:underline">
                                {form.imagemUrl ? 'Trocar imagem' : 'Upload imagem'}
                            </button>
                            {form.imagemUrl && (
                                <button onClick={() => handleChange('imagemUrl', '')} className="block text-xs text-red-400 font-modern hover:underline mt-1">
                                    Remover
                                </button>
                            )}
                            <p className="text-[10px] text-zinc-600 mt-1">JPG, PNG ou WebP · Máx 2MB</p>
                        </div>
                        <input ref={inputRef} type="file" accept={ACCEPTED_TYPES.join(',')} onChange={e => e.target.files[0] && processImage(e.target.files[0])} className="hidden" />
                    </div>

                    {/* Nome */}
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-[0.5em] text-zinc-500 mb-2 block">Nome *</label>
                        <input type="text" value={form.nome} onChange={e => handleChange('nome', e.target.value)}
                            className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white font-modern focus:border-primary focus:outline-none transition-colors"
                            placeholder="Ex: Corte + Barba" />
                    </div>

                    {/* Descrições */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-[0.5em] text-zinc-500 mb-2 block">Descrição curta</label>
                            <input type="text" value={form.descricaoCurta} onChange={e => handleChange('descricaoCurta', e.target.value)}
                                className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white font-modern focus:border-primary focus:outline-none transition-colors text-sm"
                                placeholder="Resumo para cards" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-[0.5em] text-zinc-500 mb-2 block">Descrição detalhada</label>
                            <input type="text" value={form.descricaoDetalhada} onChange={e => handleChange('descricaoDetalhada', e.target.value)}
                                className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white font-modern focus:border-primary focus:outline-none transition-colors text-sm"
                                placeholder="Descrição completa" />
                        </div>
                    </div>

                    {/* Preço, Promo, Duração */}
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-[0.5em] text-zinc-500 mb-2 block">Preço (R$)</label>
                            <input type="number" value={form.preco} onChange={e => handleChange('preco', e.target.value)}
                                className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white font-modern focus:border-primary focus:outline-none transition-colors" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-[0.5em] text-zinc-500 mb-2 block">Promo (R$)</label>
                            <input type="number" value={form.precoPromocional} onChange={e => handleChange('precoPromocional', e.target.value)}
                                className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white font-modern focus:border-primary focus:outline-none transition-colors"
                                placeholder="Vazio = sem" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-[0.5em] text-zinc-500 mb-2 block">Duração (min)</label>
                            <input type="number" value={form.duracao} onChange={e => handleChange('duracao', e.target.value)}
                                className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white font-modern focus:border-primary focus:outline-none transition-colors" />
                        </div>
                    </div>

                    {/* Categoria, Badge */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-[0.5em] text-zinc-500 mb-2 block">Categoria</label>
                            <select value={form.categoria} onChange={e => handleChange('categoria', e.target.value)}
                                className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white font-modern focus:border-primary focus:outline-none appearance-none cursor-pointer">
                                {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-[0.5em] text-zinc-500 mb-2 block">Badge</label>
                            <select value={form.badge} onChange={e => handleChange('badge', e.target.value)}
                                className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white font-modern focus:border-primary focus:outline-none appearance-none cursor-pointer">
                                <option value="">Nenhum</option>
                                {BADGES.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Visibilidade */}
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-[0.5em] text-zinc-500 mb-3 block">Visibilidade</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[
                                { key: 'destaque', label: 'Destaque', icon: Star },
                                { key: 'visivelHome', label: 'Home', icon: Eye },
                                { key: 'visivelCliente', label: 'Painel Cliente', icon: Eye },
                                { key: 'visivelAgendamento', label: 'Agendamento', icon: Eye },
                            ].map(opt => (
                                <button
                                    key={opt.key}
                                    type="button"
                                    onClick={() => handleChange(opt.key, !form[opt.key])}
                                    className={`flex items-center gap-2 p-3 border text-xs font-modern transition-all ${form[opt.key]
                                        ? 'border-primary/30 bg-primary/5 text-primary'
                                        : 'border-white/5 text-zinc-500 hover:border-white/10'
                                        }`}
                                >
                                    {form[opt.key] ? <Check size={14} /> : <opt.icon size={14} />}
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-3">
                        <label className="text-[10px] font-bold uppercase tracking-[0.5em] text-zinc-500">Status</label>
                        <button
                            type="button"
                            onClick={() => handleChange('status', form.status === 'ativo' ? 'inativo' : 'ativo')}
                            className={`flex items-center gap-2 px-4 py-2 text-xs font-modern transition-all border ${form.status === 'ativo'
                                ? 'border-green-500/30 bg-green-500/10 text-green-400'
                                : 'border-red-500/30 bg-red-500/10 text-red-400'
                                }`}
                        >
                            {form.status === 'ativo' ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                            {form.status === 'ativo' ? 'Ativo' : 'Inativo'}
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/5 flex gap-3">
                    <button onClick={onClose} className="flex-1 border border-white/10 py-3 font-display font-bold uppercase text-xs tracking-[0.3em] hover:bg-white/5 transition-colors">
                        Cancelar
                    </button>
                    <button onClick={handleSave} className="flex-1 bg-primary text-black py-3 font-display font-bold uppercase text-xs tracking-[0.3em] hover:scale-[1.02] transition-transform flex items-center justify-center gap-2">
                        <Save size={14} /> Salvar
                    </button>
                </div>
            </div>
        </div>
    );
}
