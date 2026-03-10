import { useState } from 'react';
import appointmentStore from '../../stores/appointmentStore';
import clientStore from '../../stores/clientStore';
import financialStore from '../../stores/financialStore';
import notificationStore from '../../stores/notificationStore';
import { STATUS, STATUS_CONFIG, MOTIVOS_REJEICAO, NOTIF_TIPOS, NOTIF_NIVEIS, FORMAS_PAGAMENTO } from '../../data/models';
import { TEMPLATES, gerarLinkWhatsAppCliente } from '../../data/whatsappTemplates';
import { useStoreSync } from '../../hooks/useStore';
import { isSupabaseConfigured } from '../../lib/supabase';
import { useSupabaseAppointments, updateAppointmentSupabase } from '../../hooks/useSupabase';
import { Avatar } from '../../components/PhotoUpload';
import {
    Search, Filter, Clock, CheckCircle, XCircle, MessageCircle, Eye,
    ArrowUpRight, Star, Ban, RefreshCw, ChevronDown, X, Calendar, DollarSign, UserX
} from 'lucide-react';

function formatData(d) { if (!d) return ''; const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y}`; }
function formatPreco(v) { return `R$ ${Number(v || 0).toFixed(0)}`; }

export default function AdminAgendamentos() {
    const storeTick = useStoreSync();
    const [filtroStatus, setFiltroStatus] = useState('todos');
    const [busca, setBusca] = useState('');
    const [filtroData, setFiltroData] = useState('');
    const [modal, setModal] = useState(null);

    // Rejeição state
    const [motivosSelecionados, setMotivosSelecionados] = useState([]);
    const [motivoTexto, setMotivoTexto] = useState('');
    const [sugerirNovo, setSugerirNovo] = useState(false);
    const [novaData, setNovaData] = useState('');
    const [novaFaixaInicio, setNovaFaixaInicio] = useState('');
    const [novaFaixaFim, setNovaFaixaFim] = useState('');
    const [mensagemWpp, setMensagemWpp] = useState('');

    // Conclusão state
    const [valorCobrado, setValorCobrado] = useState('');
    const [formaPagamento, setFormaPagamento] = useState('');

    // Supabase data
    const supabase = isSupabaseConfigured();
    const { appointments: sbAppointments, loading: sbLoading, refetch: refetchAppointments } = useSupabaseAppointments();

    // Leitura reativa — Supabase ou localStorage
    const agendamentos = (() => {
        let all = supabase ? sbAppointments : appointmentStore.getAll();
        if (filtroStatus !== 'todos') all = all.filter(a => a.status === filtroStatus);
        if (filtroData) all = all.filter(a => a.data === filtroData);
        if (busca) {
            const q = busca.toLowerCase();
            all = all.filter(a => {
                if (supabase) {
                    return (
                        a.servicoNome?.toLowerCase().includes(q) ||
                        a._clienteNome?.toLowerCase().includes(q) ||
                        a._clienteSobrenome?.toLowerCase().includes(q) ||
                        a._clienteWhatsapp?.includes(q)
                    );
                }
                const cliente = clientStore.getById(a.clienteId);
                return (
                    a.servicoNome?.toLowerCase().includes(q) ||
                    cliente?.nome?.toLowerCase().includes(q) ||
                    cliente?.sobrenome?.toLowerCase().includes(q) ||
                    cliente?.apelido?.toLowerCase().includes(q) ||
                    cliente?.whatsapp?.includes(q)
                );
            });
        }
        return all;
    })();

    // Helper: obter dados do cliente (Supabase inline ou localStorage)
    function getCliente(ag) {
        if (supabase) {
            return {
                nome: ag._clienteNome || 'Cliente',
                sobrenome: ag._clienteSobrenome || '',
                whatsapp: ag._clienteWhatsapp || '',
                fotoUrl: ag._clienteFoto || '',
            };
        }
        return clientStore.getById(ag.clienteId) || { nome: 'Cliente', sobrenome: '', whatsapp: '' };
    }

    function abrirAprovar(ag) {
        const cliente = getCliente(ag);
        const msg = TEMPLATES.aprovacao({ nome: cliente?.nome || 'Cliente', data: ag.data, faixaInicio: ag.faixaInicio, faixaFim: ag.faixaFim });
        setMensagemWpp(msg);
        setModal({ tipo: 'aprovar', ag });
    }

    async function confirmarAprovar() {
        const { ag } = modal;
        if (supabase) {
            try {
                await updateAppointmentSupabase(ag.id, { status: 'confirmado' });
                await refetchAppointments();
            } catch (err) { console.error('Erro ao aprovar:', err); }
        } else {
            appointmentStore.aprovar(ag.id, '');
        }
        setModal(null);
    }

    function abrirRejeitar(ag) {
        const cliente = getCliente(ag);
        setMotivosSelecionados([]);
        setMotivoTexto('');
        setSugerirNovo(false);
        setNovaData('');
        setNovaFaixaInicio('');
        setNovaFaixaFim('');
        const msg = TEMPLATES.rejeicao({ nome: cliente?.nome || 'Cliente', data: ag.data, faixa: `${ag.faixaInicio} às ${ag.faixaFim}`, motivo: '...' });
        setMensagemWpp(msg);
        setModal({ tipo: 'rejeitar', ag });
    }

    async function confirmarRejeitar() {
        const { ag } = modal;
        const novoStatus = sugerirNovo ? 'aguardando_cliente' : 'rejeitado';
        if (supabase) {
            try {
                const updates = { status: novoStatus };
                if (sugerirNovo && novaData) updates.data = novaData;
                if (sugerirNovo && novaFaixaInicio) updates.faixaInicio = novaFaixaInicio;
                if (sugerirNovo && novaFaixaFim) updates.faixaFim = novaFaixaFim;
                await updateAppointmentSupabase(ag.id, updates);
                await refetchAppointments();
            } catch (err) { console.error('Erro ao rejeitar:', err); }
        } else {
            const motivoFinal = motivosSelecionados.map(id => MOTIVOS_REJEICAO.find(m => m.id === id)?.label).filter(Boolean).join('; ') + (motivoTexto ? ` — ${motivoTexto}` : '');
            appointmentStore.rejeitar(ag.id, {
                motivosRejeicaoIds: motivosSelecionados,
                motivoRejeicao: motivoFinal,
                sugestaoNovaData: sugerirNovo ? novaData : null,
                sugestaoNovaFaixa: sugerirNovo ? `${novaFaixaInicio} às ${novaFaixaFim}` : null,
            });
        }
        setModal(null);
    }

    function abrirConcluir(ag) {
        setValorCobrado(String(ag.valorCobrado || ''));
        setFormaPagamento(ag.formaPagamento || '');
        setModal({ tipo: 'concluir', ag });
    }

    async function confirmarConcluir() {
        const { ag } = modal;
        const valor = Number(valorCobrado);
        if (supabase) {
            try {
                await updateAppointmentSupabase(ag.id, { status: 'concluido' });
                await refetchAppointments();
            } catch (err) { console.error('Erro ao concluir:', err); }
        } else {
            appointmentStore.concluir(ag.id, valor, formaPagamento);
            financialStore.registrarEntradaServico({ ...ag, valorCobrado: valor, formaPagamento });
            clientStore.updateScorePresenca(ag.clienteId, 5);
        }
        setModal(null);
    }

    async function handleNaoCompareceu(ag) {
        if (supabase) {
            try {
                await updateAppointmentSupabase(ag.id, { status: 'ausente' });
                await refetchAppointments();
            } catch (err) { console.error('Erro:', err); }
        } else {
            appointmentStore.marcarNaoCompareceu(ag.id);
            clientStore.updateScorePresenca(ag.clienteId, -15);
        }
    }

    async function handleRemarcar(ag) {
        if (ag.sugestaoNovaData) {
            const [fi, ff] = (ag.sugestaoNovaFaixa || '').split(' às ');
            if (supabase) {
                try {
                    await updateAppointmentSupabase(ag.id, {
                        status: 'confirmado',
                        data: ag.sugestaoNovaData,
                        faixaInicio: fi || ag.faixaInicio,
                        faixaFim: ff || ag.faixaFim,
                    });
                    await refetchAppointments();
                } catch (err) { console.error('Erro:', err); }
            } else {
                appointmentStore.remarcar(ag.id, ag.sugestaoNovaData, fi || ag.faixaInicio, ff || ag.faixaFim);
            }
        }
    }

    const STATUS_FILTER_OPTIONS = [
        { value: 'todos', label: 'Todos' },
        ...Object.entries(STATUS_CONFIG).map(([key, cfg]) => ({ value: key, label: cfg.label })),
    ];

    return (
        <div className="p-6 md:p-10 max-w-[1600px] mx-auto">
            <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <span className="text-[10px] font-bold uppercase tracking-[1em] text-primary mb-3 block">Gestão</span>
                    <h1 className="font-display font-bold text-3xl md:text-5xl uppercase tracking-tighter">Agendamentos</h1>
                </div>
            </div>

            {/* Filters bar */}
            <div className="flex flex-col md:flex-row gap-4 mb-8">
                <div className="relative flex-1">
                    <Search size={16} className="absolute left-0 top-1/2 -translate-y-1/2 text-zinc-600" />
                    <input
                        type="text"
                        value={busca}
                        onChange={e => setBusca(e.target.value)}
                        placeholder="Buscar por nome, serviço, telefone..."
                        className="w-full bg-transparent border-b border-white/20 pl-8 pr-4 py-3 text-sm text-white font-modern focus:border-primary focus:outline-none placeholder:text-zinc-700 transition-colors"
                    />
                </div>
                <div className="flex gap-4">
                    <input
                        type="date"
                        value={filtroData}
                        onChange={e => setFiltroData(e.target.value)}
                        className="bg-transparent border-b border-white/20 px-0 py-3 text-sm text-white font-modern focus:border-primary focus:outline-none placeholder:text-zinc-700 transition-colors"
                    />
                    <select
                        value={filtroStatus}
                        onChange={e => setFiltroStatus(e.target.value)}
                        className="bg-black border-b border-white/20 px-0 py-3 text-sm text-white font-modern focus:border-primary focus:outline-none appearance-none pr-8 cursor-pointer transition-colors"
                    >
                        {STATUS_FILTER_OPTIONS.map(o => <option key={o.value} value={o.value} className="bg-black text-white">{o.label}</option>)}
                    </select>
                </div>
            </div>

            {/* Count */}
            <div className="flex items-center gap-3 mb-6">
                <div className="h-px bg-white/10 flex-1" />
                <p className="text-zinc-500 text-[9px] font-bold uppercase tracking-widest">{agendamentos.length} resultado(s)</p>
                <div className="h-px bg-white/10 flex-1" />
            </div>

            {/* Table */}
            {agendamentos.length === 0 ? (
                <div className="border border-white/5 bg-white/[0.02] p-16 text-center">
                    <p className="text-zinc-600 font-modern text-sm uppercase tracking-widest">Nenhum agendamento encontrado.</p>
                </div>
            ) : (
                <div className="overflow-x-auto bg-black border border-white/5">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-white/5 bg-white/[0.02]">
                                {['Cliente', 'Serviço', 'Data', 'Horário', 'Status', 'Ações'].map(h => (
                                    <th key={h} className="text-left py-4 px-6 text-[9px] font-bold uppercase tracking-[0.4em] text-zinc-500">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {agendamentos.map(ag => {
                                const cliente = getCliente(ag);
                                const sc = STATUS_CONFIG[ag.status] || {};
                                return (
                                    <tr key={ag.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-4">
                                                <Avatar src={cliente?.fotoUrl} initials={`${cliente?.nome?.[0] || ''}${cliente?.sobrenome?.[0] || ''}`} size="sm" className="ring-1 ring-primary/20 grayscale group-hover:grayscale-0 transition-all duration-500" />
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-sm tracking-wide">{cliente?.apelido || cliente?.nome || '—'} {cliente?.sobrenome?.[0] || ''}</span>
                                                        {cliente?.favorito && <Star size={10} className="text-primary fill-primary" />}
                                                        {cliente?.blacklist && <Ban size={10} className="text-red-400" />}
                                                    </div>
                                                    {cliente?.whatsapp && (
                                                        <span className="block text-[10px] text-zinc-500 font-modern mt-0.5">{cliente.whatsapp}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 font-modern text-zinc-300">{ag.servicoNome}</td>
                                        <td className="py-4 px-6 font-modern text-zinc-400">{formatData(ag.data)}</td>
                                        <td className="py-4 px-6 font-display font-bold text-primary tracking-widest text-xs tabular-nums">{ag.faixaInicio} <span className="text-zinc-600 font-modern font-normal mx-1">—</span> {ag.faixaFim}</td>
                                        <td className="py-4 px-6">
                                            <span className={`text-[9px] font-bold uppercase tracking-wider ${sc.cor} px-2 py-1 ${sc.bg} inline-block`}>
                                                {sc.label || ag.status}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-2 flex-wrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                {ag.status === STATUS.PENDENTE && (
                                                    <>
                                                        <button onClick={() => abrirAprovar(ag)} className="px-2 py-1 bg-green-500/10 text-green-400 text-[10px] font-bold uppercase tracking-wider hover:bg-green-500/20 transition-colors">Aprovar</button>
                                                        <button onClick={() => abrirRejeitar(ag)} className="px-2 py-1 bg-red-500/10 text-red-400 text-[10px] font-bold uppercase tracking-wider hover:bg-red-500/20 transition-colors">Rejeitar</button>
                                                    </>
                                                )}
                                                {ag.status === STATUS.APROVADO && (
                                                    <>
                                                        <button onClick={() => abrirConcluir(ag)} className="px-2 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-500/20 transition-colors">Concluir</button>
                                                        <button onClick={() => handleNaoCompareceu(ag)} className="px-2 py-1 bg-orange-500/10 text-orange-400 text-[10px] font-bold uppercase tracking-wider hover:bg-orange-500/20 transition-colors">Faltou</button>
                                                    </>
                                                )}
                                                {ag.status === STATUS.AGUARDANDO_CLIENTE && ag.sugestaoNovaData && (
                                                    <button onClick={() => handleRemarcar(ag)} className="px-2 py-1 bg-purple-500/10 text-purple-400 text-[10px] font-bold uppercase tracking-wider hover:bg-purple-500/20 transition-colors">Confirmar Remarcação</button>
                                                )}
                                                {cliente?.whatsapp && (
                                                    <a
                                                        href={gerarLinkWhatsAppCliente(cliente.whatsapp, `Olá, ${cliente.nome}!`)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="px-2.5 py-1.5 bg-[#25D366]/5 border border-[#25D366]/20 text-[#25D366] hover:bg-[#25D366] hover:text-black transition-all flex items-center justify-center rounded-sm"
                                                    >
                                                        <MessageCircle size={14} />
                                                    </a>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── MODAL: Aprovar ── */}
            {modal?.tipo === 'aprovar' && (
                <ModalOverlay onClose={() => setModal(null)}>
                    <h3 className="font-display font-bold text-2xl uppercase tracking-tighter mb-8 flex items-center gap-3">
                        <CheckCircle size={24} className="text-green-400" /> Aprovar Agendamento
                    </h3>
                    <div className="space-y-4 mb-8 bg-white/[0.02] border border-white/5 p-6">
                        <InfoRow label="Serviço" value={modal.ag.servicoNome} />
                        <InfoRow label="Data" value={formatData(modal.ag.data)} />
                        <InfoRow label="Horário" value={`${modal.ag.faixaInicio} — ${modal.ag.faixaFim}`} />
                    </div>
                    <label className="text-[9px] font-bold uppercase tracking-[0.4em] text-zinc-500 block mb-3">Mensagem WhatsApp (editável)</label>
                    <textarea
                        value={mensagemWpp}
                        onChange={e => setMensagemWpp(e.target.value)}
                        className="w-full bg-black border-b border-white/20 p-4 text-sm text-white font-modern focus:border-primary focus:outline-none h-32 resize-none mb-6 placeholder:text-zinc-700 transition-colors"
                    />
                    <div className="flex flex-col sm:flex-row gap-3 mt-8">
                        <a
                            href={gerarLinkWhatsAppCliente(getCliente(modal.ag)?.whatsapp || '', mensagemWpp)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => appointmentStore.marcarWhatsappEnviado(modal.ag.id)}
                            className="flex-1 bg-[#25D366]/10 border border-[#25D366]/20 text-[#25D366] px-6 py-4 font-display font-bold uppercase text-[10px] tracking-[0.3em] flex items-center justify-center gap-3 hover:bg-[#25D366] hover:text-black transition-all"
                        >
                            <MessageCircle size={18} /> WhatsApp
                        </a>
                        <button onClick={confirmarAprovar} className="flex-1 bg-green-500 text-black py-4 font-display font-bold uppercase text-[10px] tracking-[0.3em] hover:bg-green-400 transition-colors">Confirmar Aprovação</button>
                    </div>
                </ModalOverlay>
            )}

            {/* ── MODAL: Rejeitar ── */}
            {modal?.tipo === 'rejeitar' && (
                <ModalOverlay onClose={() => setModal(null)}>
                    <h3 className="font-display font-bold text-2xl uppercase tracking-tighter mb-8 flex items-center gap-3">
                        <XCircle size={24} className="text-red-400" /> Rejeitar Agendamento
                    </h3>
                    <label className="text-[9px] font-bold uppercase tracking-[0.4em] text-zinc-500 block mb-4">Motivo(s)</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                        {MOTIVOS_REJEICAO.map(m => (
                            <label key={m.id} className={`flex items-center gap-3 p-3 border text-sm font-modern cursor-pointer transition-colors ${motivosSelecionados.includes(m.id) ? 'border-red-400/50 bg-red-400/5 text-red-300' : 'border-white/5 text-zinc-400 hover:border-white/20 bg-black'}`}>
                                <input
                                    type="checkbox"
                                    checked={motivosSelecionados.includes(m.id)}
                                    onChange={() => setMotivosSelecionados(prev => prev.includes(m.id) ? prev.filter(x => x !== m.id) : [...prev, m.id])}
                                    className="sr-only"
                                />
                                <div className={`w-4 h-4 border flex items-center justify-center shrink-0 transition-colors ${motivosSelecionados.includes(m.id) ? 'border-red-400 bg-red-400' : 'border-white/20'}`}>
                                    {motivosSelecionados.includes(m.id) && <span className="text-black text-[10px] font-bold">✓</span>}
                                </div>
                                {m.label}
                            </label>
                        ))}
                    </div>
                    <textarea
                        value={motivoTexto}
                        onChange={e => setMotivoTexto(e.target.value)}
                        placeholder="Observação adicional (opcional)"
                        className="w-full bg-black border-b border-white/20 p-4 text-sm text-white font-modern focus:border-red-400 focus:outline-none h-24 resize-none mb-6 placeholder:text-zinc-700 transition-colors"
                    />
                    <label className="flex items-center gap-4 p-4 border border-white/5 bg-white/[0.02] cursor-pointer mb-6 hover:bg-white/[0.05] transition-colors">
                        <input type="checkbox" checked={sugerirNovo} onChange={e => setSugerirNovo(e.target.checked)} className="sr-only" />
                        <div className={`w-5 h-5 border flex items-center justify-center shrink-0 transition-colors ${sugerirNovo ? 'border-primary bg-primary' : 'border-white/20'}`}>
                            {sugerirNovo && <span className="text-black text-[12px] font-bold">✓</span>}
                        </div>
                        <span className="text-sm font-modern text-white">Sugerir novo horário ao cliente</span>
                    </label>
                    {sugerirNovo && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 p-6 border border-white/5 bg-black">
                            <div>
                                <label className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 block mb-2">Nova Data</label>
                                <input type="date" value={novaData} onChange={e => setNovaData(e.target.value)} className="w-full bg-transparent border-b border-white/20 py-2 text-sm text-white font-modern focus:border-primary focus:outline-none transition-colors" />
                            </div>
                            <div>
                                <label className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 block mb-2">Início</label>
                                <input type="time" value={novaFaixaInicio} onChange={e => setNovaFaixaInicio(e.target.value)} className="w-full bg-transparent border-b border-white/20 py-2 text-sm text-white font-modern focus:border-primary focus:outline-none transition-colors" />
                            </div>
                            <div>
                                <label className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 block mb-2">Fim</label>
                                <input type="time" value={novaFaixaFim} onChange={e => setNovaFaixaFim(e.target.value)} className="w-full bg-transparent border-b border-white/20 py-2 text-sm text-white font-modern focus:border-primary focus:outline-none transition-colors" />
                            </div>
                        </div>
                    )}
                    <div className="flex gap-3">
                        <button onClick={confirmarRejeitar} className="flex-1 bg-red-500 text-white py-3 font-display font-bold uppercase text-xs tracking-[0.3em] hover:bg-red-400 transition-colors">
                            {sugerirNovo ? 'Enviar Proposta' : 'Confirmar Rejeição'}
                        </button>
                        <a
                            href={gerarLinkWhatsAppCliente(getCliente(modal.ag)?.whatsapp || '', mensagemWpp)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-[#25D366] text-white px-6 py-3 font-display font-bold uppercase text-xs tracking-[0.3em] flex items-center gap-2"
                        >
                            <MessageCircle size={16} />
                        </a>
                    </div>
                </ModalOverlay>
            )}

            {/* ── MODAL: Concluir ── */}
            {modal?.tipo === 'concluir' && (
                <ModalOverlay onClose={() => setModal(null)}>
                    <h3 className="font-display font-bold text-2xl uppercase tracking-tighter mb-8 flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20">
                            <DollarSign size={20} className="text-emerald-400" />
                        </div>
                        Concluir Atendimento
                    </h3>
                    <div className="space-y-4 mb-8 bg-black border border-white/5 p-6">
                        <InfoRow label="Serviço" value={modal.ag.servicoNome} />
                        <InfoRow label="Data" value={formatData(modal.ag.data)} />
                    </div>
                    <div className="space-y-6">
                        <div>
                            <label className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 block mb-2">Valor Cobrado</label>
                            <input
                                type="number"
                                value={valorCobrado}
                                onChange={e => setValorCobrado(e.target.value)}
                                className="w-full bg-transparent border-b border-white/20 py-3 text-lg text-white font-modern focus:border-emerald-400 focus:outline-none transition-colors placeholder:text-zinc-700 tabular-nums"
                            />
                        </div>
                        <div>
                            <label className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 block mb-2">Forma de Pagamento</label>
                            <select
                                value={formaPagamento}
                                onChange={e => setFormaPagamento(e.target.value)}
                                className="w-full bg-black border-b border-white/20 py-3 text-sm text-white font-modern focus:border-emerald-400 focus:outline-none appearance-none cursor-pointer transition-colors"
                            >
                                <option value="" className="bg-black">Selecione</option>
                                {FORMAS_PAGAMENTO.map(f => <option key={f.id} value={f.id} className="bg-black text-white">{f.label}</option>)}
                            </select>
                        </div>
                    </div>
                    <button
                        onClick={confirmarConcluir}
                        disabled={!valorCobrado || !formaPagamento}
                        className="w-full mt-10 bg-emerald-500 text-black py-4 font-display font-bold uppercase text-[10px] tracking-[0.3em] hover:bg-emerald-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        Registrar Conclusão
                    </button>
                </ModalOverlay>
            )}
        </div>
    );
}

// ─── Componentes auxiliares ───
function ModalOverlay({ children, onClose }) {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 overflow-y-auto">
            <div className="fixed inset-0 bg-background-dark/80 backdrop-blur-xl transition-opacity" onClick={onClose} />
            <div className="relative bg-black border border-white/10 p-8 w-full max-w-lg shadow-2xl z-10 my-auto">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors p-2 hover:rotate-90 duration-300"
                >
                    <X size={20} />
                </button>
                {children}
            </div>
        </div>
    );
}

function InfoRow({ label, value }) {
    return (
        <div className="flex justify-between items-end border-b border-white/5 pb-3">
            <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">{label}</span>
            <span className="text-sm font-modern text-white">{value}</span>
        </div>
    );
}
