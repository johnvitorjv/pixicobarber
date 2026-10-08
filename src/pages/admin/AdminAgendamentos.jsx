import { useState, useEffect } from 'react';
import { requireSupabase } from '../../lib/supabase';
import { useAction } from '../../hooks/useAction';
import DataState from '../../components/DataState';
import { timeMinutes } from '../../lib/bookingRules';
import { STATUS, STATUS_CONFIG, MOTIVOS_REJEICAO, FORMAS_PAGAMENTO } from '../../data/models';
import { TEMPLATES, gerarLinkWhatsAppCliente } from '../../data/whatsappTemplates';
import { useStoreSync } from '../../hooks/useStore';
import { useSupabaseAppointments, useSupabaseClients, updateAppointmentSupabase } from '../../hooks/useSupabase';
import { Avatar } from '../../components/PhotoUpload';
import {
    Search, Filter, Clock, CheckCircle, XCircle, MessageCircle, Eye,
    ArrowUpRight, Star, Ban, RefreshCw, ChevronDown, X, Calendar, DollarSign, UserX
} from 'lucide-react';

function formatData(d) { if (!d) return ''; const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y}`; }
function formatDiaSemana(d) {
    if (!d) return '';
    const label = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'America/Bahia' }).format(new Date(`${d}T12:00:00Z`));
    return label.charAt(0).toUpperCase() + label.slice(1);
}

export default function AdminAgendamentos() {
    useStoreSync();
    const action = useAction();
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
    const [whatsappOpened, setWhatsappOpened] = useState(false);
    const [whatsappConfirmed, setWhatsappConfirmed] = useState(false);
    const [proposalSlots, setProposalSlots] = useState([]);
    const [proposalLoading, setProposalLoading] = useState(false);

    // Conclusão state
    const [valorCobrado, setValorCobrado] = useState('');
    const [formaPagamento, setFormaPagamento] = useState('');

    // Supabase data
    const { appointments: sbAppointments, loading: sbLoading, error: queryError, refetch: refetchAppointments } = useSupabaseAppointments();

    const { clients, loading: clientsLoading, error: clientsError, refetch: refetchClients } = useSupabaseClients();
    useEffect(() => {
        if (modal?.tipo !== 'rejeitar' || !sugerirNovo || !novaData) return;
        let live = true;
        queueMicrotask(() => { if (live) setProposalLoading(true); });
        requireSupabase().rpc('get_suggestion_slots', { p_appointment: modal.ag.id, p_date: novaData })
            .then(({ data, error }) => {
                if (!live) return;
                const available = error ? [] : (data || []).filter(slot => slot.disponivel);
                setProposalSlots(available);
                const first = available[0];
                setNovaFaixaInicio(first?.inicio || '');
                setNovaFaixaFim(first?.fim || '');
                setProposalLoading(false);
            });
        return () => { live = false; };
    }, [modal?.ag?.id, modal?.tipo, novaData, sugerirNovo]);

    useEffect(() => {
        if (modal?.tipo !== 'rejeitar') return;
        const reason = [
            ...motivosSelecionados.map(id => MOTIVOS_REJEICAO.find(m => m.id === id)?.label).filter(Boolean),
            motivoTexto.trim()
        ].filter(Boolean).join('; ');
        const params = {
            nome: modal.ag._clienteNome || 'Cliente',
            data: modal.ag.data,
            motivo: reason,
            novaData,
            novaFaixa: novaFaixaInicio && novaFaixaFim ? novaFaixaInicio + ' às ' + novaFaixaFim : ''
        };
        queueMicrotask(() => {
            setMensagemWpp(sugerirNovo ? TEMPLATES.rejeicao_com_sugestao(params) : TEMPLATES.rejeicao(params));
            setWhatsappConfirmed(false);
        });
    }, [modal?.tipo, modal?.ag?.id, modal?.ag?.data, modal?.ag?._clienteNome, motivosSelecionados, motivoTexto, sugerirNovo, novaData, novaFaixaInicio, novaFaixaFim]);

    // Dados persistidos exclusivamente pelo Supabase.
    const agendamentos = (() => {
        let all = sbAppointments;
        if (filtroStatus !== 'todos') all = all.filter(a => a.status === filtroStatus);
        if (filtroData) all = all.filter(a => a.data === filtroData);
        if (busca) {
            const q = busca.toLowerCase();
            all = all.filter(a => {
                return (
                        a.servicoNome?.toLowerCase().includes(q) ||
                        a._clienteNome?.toLowerCase().includes(q) ||
                        a._clienteSobrenome?.toLowerCase().includes(q) ||
                        a._clienteWhatsapp?.includes(q)
                );
            });
        }
        return all;
    })();

    // Dados persistidos exclusivamente pelo Supabase.
    function getCliente(ag) {
        return clients.find(client => client.id === ag.clienteId) || {
                nome: ag._clienteNome || 'Cliente',
                sobrenome: ag._clienteSobrenome || '',
                whatsapp: ag._clienteWhatsapp || '',
                fotoUrl: ag._clienteFoto || '',
        };
    }

    function abrirAprovar(ag) {
        setWhatsappOpened(false);
        setWhatsappConfirmed(false);
        const cliente = getCliente(ag);
        const msg = TEMPLATES.aprovacao({ nome: cliente?.nome || 'Cliente', data: ag.data, faixaInicio: ag.faixaInicio, faixaFim: ag.faixaFim });
        setMensagemWpp(ag.status === 'solicitado' ? 'Vamos avaliar a duração total e confirmar seu atendimento químico.' : msg);
        setNovaData(ag.data); setNovaFaixaInicio(ag.faixaInicio); setNovaFaixaFim(ag.faixaFim || '');
        setModal({ tipo: 'aprovar', ag });
    }

    async function confirmarAprovar() {
        await action.execute(async () => {
            if (modal.ag.confirmacaoManual) {
                const start = timeMinutes(novaFaixaInicio), end = timeMinutes(novaFaixaFim);
                if (!novaData || !Number.isFinite(start) || !Number.isFinite(end) || start % 15 !== 0 || end - start < 30 || end - start > 480) {
                    throw new Error('Informe data, início na grade de 15 minutos e ocupação total de 30 a 480 minutos.');
                }
            }
            await updateAppointmentSupabase(modal.ag.id, { status: 'confirmado', ...(modal.ag.confirmacaoManual ? { data: novaData, faixaInicio: novaFaixaInicio, faixaFim: novaFaixaFim } : {}) }); await refetchAppointments(); setModal(null);
        });
    }

    function abrirRejeitar(ag) {
        setWhatsappOpened(false);
        setWhatsappConfirmed(false);
        const cliente = getCliente(ag);
        setMotivosSelecionados([]);
        setMotivoTexto('');
        setSugerirNovo(false);
        setNovaData('');
        setNovaFaixaInicio('');
        setNovaFaixaFim('');
        const msg = TEMPLATES.rejeicao({ nome: cliente?.nome || 'Cliente', data: ag.data, faixa: `${ag.faixaInicio} às ${ag.faixaFim || 'a definir'}`, motivo: '...' });
        setMensagemWpp(msg);
        setModal({ tipo: 'rejeitar', ag });
    }

    async function confirmarRejeitar() {
        const motivo = motivosSelecionados.map(id => MOTIVOS_REJEICAO.find(m => m.id === id)?.label).filter(Boolean).join('; ') + (motivoTexto ? ' — ' + motivoTexto : '');
        await action.execute(async () => {
            if (!sugerirNovo && !motivo.trim()) {
                throw new Error('Informe um motivo claro para recusar o agendamento.');
            }
            if (sugerirNovo && !proposalSlots.some(s => s.disponivel && s.inicio === novaFaixaInicio && s.fim === novaFaixaFim)) {
                throw new Error('Escolha um horário livre para sugerir.');
            }
            const updates = { status: sugerirNovo ? 'aguardando_cliente' : 'rejeitado', motivoRejeicao: motivo };
            if (sugerirNovo) { updates.sugestaoNovaData = novaData; updates.sugestaoInicio = novaFaixaInicio; updates.sugestaoFim = novaFaixaFim; }
            await updateAppointmentSupabase(modal.ag.id, updates); await refetchAppointments(); setModal(null);
        });
    }

    function abrirConcluir(ag) {
        setValorCobrado(String(ag.valorCobrado ?? ag.servicoPreco ?? ''));
        setFormaPagamento(ag.formaPagamento || '');
        setModal({ tipo: 'concluir', ag });
    }

    async function confirmarConcluir() {
        const valor = Number(valorCobrado);
        await action.execute(async () => {
            if (!Number.isFinite(valor) || valor < 0 || valorCobrado === '' || !formaPagamento) throw new Error('Informe cobrança e pagamento.');
            await updateAppointmentSupabase(modal.ag.id, { status: 'concluido', valorCobrado: valor, formaPagamento });
            await refetchAppointments(); setModal(null);
        });
    }
    async function handleNaoCompareceu(ag) {
        await action.execute(async () => { await updateAppointmentSupabase(ag.id, { status: 'ausente' }); await refetchAppointments(); });
    }
    async function cancelarAdmin(ag) {
        await action.execute(async () => { await updateAppointmentSupabase(ag.id, { status: 'cancelado_admin' }); await refetchAppointments(); });
    }

    const STATUS_FILTER_OPTIONS = [
        { value: 'todos', label: 'Todos' },
        ...Object.entries(STATUS_CONFIG).map(([key, cfg]) => ({ value: key, label: cfg.label })),
    ];

    return (
        <div className="p-6 md:p-10 max-w-[1600px] mx-auto">
            <DataState loading={sbLoading || clientsLoading || action.busy} error={queryError || clientsError || (!modal ? action.error : '')} retry={() => Promise.all([refetchAppointments(), refetchClients()])} />
            <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <span className="text-[10px] font-bold uppercase tracking-[1em] text-primary mb-3 block">Gestão</span>
                    <h1 className="font-display font-bold text-2xl sm:text-3xl md:text-5xl uppercase tracking-tighter">Agendamentos</h1>
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
                <div className="flex flex-wrap gap-4">
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
                                            <div className="flex flex-wrap items-center gap-4">
                                                <Avatar src={cliente?.fotoUrl} initials={`${cliente?.nome?.[0] || ''}${cliente?.sobrenome?.[0] || ''}`} size="sm" className="ring-1 ring-primary/20 grayscale group-hover:grayscale-0 transition-all duration-500" />
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-sm tracking-wide">{cliente?.apelido || cliente?.nome || '—'} {cliente?.sobrenome?.[0] || ''}</span>
                                                        {cliente?.favorito && <Star role="img" aria-label="Cliente favorito" size={10} className="text-primary fill-primary" />}
                                                        {cliente?.blacklist && <Ban role="img" aria-label="Cliente bloqueado" size={10} className="text-red-400" />}
                                                    </div>
                                                    {cliente?.whatsapp && (
                                                        <span className="block text-[10px] text-zinc-500 font-modern mt-0.5">{cliente.whatsapp}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 font-modern text-zinc-300">{ag.servicoNome}</td>
                                        <td className="py-4 px-6 font-modern text-zinc-400">
                                            <span className="block text-white font-bold capitalize mb-1">{formatDiaSemana(ag.data)}</span>
                                            <span>{formatData(ag.data)}</span>
                                        </td>
                                        <td className="py-4 px-6 font-display font-bold text-primary tracking-widest text-xs tabular-nums">{ag.faixaInicio} <span className="text-zinc-600 font-modern font-normal mx-1">—</span> {ag.faixaFim || 'a definir'}</td>
                                        <td className="py-4 px-6">
                                            <span className={`text-[9px] font-bold uppercase tracking-wider ${sc.cor} px-2 py-1 ${sc.bg} inline-block`}>
                                                {sc.label || ag.status}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-2 flex-wrap opacity-100 transition-opacity duration-300">
                                                {['solicitado','pendente','confirmado','remarcado','aguardando_cliente'].includes(ag.status) && <button disabled={action.busy} title="Cancelar agendamento" onClick={() => cancelarAdmin(ag)} className="text-red-400 p-2"><Ban size={14} /></button>}
                                                {[STATUS.PENDENTE, STATUS.SOLICITADO].includes(ag.status) && (
                                                    <>
                                                        <button onClick={() => abrirAprovar(ag)} className="px-2 py-1 bg-green-500/10 text-green-400 text-[10px] font-bold uppercase tracking-wider hover:bg-green-500/20 transition-colors">Aprovar</button>
                                                        <button onClick={() => abrirRejeitar(ag)} className="px-2 py-1 bg-red-500/10 text-red-400 text-[10px] font-bold uppercase tracking-wider hover:bg-red-500/20 transition-colors">Rejeitar</button>
                                                    </>
                                                )}
                                                {ag.status === STATUS.APROVADO && (
                                                    <>
                                                        <button onClick={() => abrirConcluir(ag)} className="px-2 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-500/20 transition-colors">Concluir</button>
                                                        <button disabled={action.busy} onClick={() => handleNaoCompareceu(ag)} className="px-2 py-1 bg-orange-500/10 text-orange-400 text-[10px] font-bold uppercase tracking-wider hover:bg-orange-500/20 transition-colors">Faltou</button>
                                                    </>
                                                )}
                                                {ag.status === STATUS.AGUARDANDO_CLIENTE && ag.sugestaoNovaData && (
                                                    <span className="px-2 py-1 border border-primary/20 text-primary text-[10px] font-bold uppercase tracking-wider">Aguardando aceite do cliente</span>
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
                <ModalOverlay onClose={() => setModal(null)}><DataState error={action.error} loading={action.busy} />
                    <h3 className="font-display font-bold text-2xl uppercase tracking-tighter mb-8 flex items-center gap-3">
                        <CheckCircle size={24} className="text-green-400" /> Aprovar Agendamento
                    </h3>
                    <div className="space-y-4 mb-8 bg-white/[0.02] border border-white/5 p-6">
                        <InfoRow label="Serviço" value={modal.ag.servicoNome} />
                        <InfoRow label="Dia" value={formatDiaSemana(modal.ag.data)} />
                        <InfoRow label="Data" value={formatData(modal.ag.data)} />
                        <InfoRow label="Horário" value={`${modal.ag.faixaInicio} — ${modal.ag.faixaFim || 'a definir'}`} />
                    </div>
                    {modal.ag.confirmacaoManual && <div className="space-y-3 mb-6 border border-yellow-500/30 p-4">
                        <p className="text-sm text-yellow-300">Defina a ocupação total, incluindo processamento e lavagem (30 a 480 min). A confirmação exige todo o intervalo livre.</p>
                        <label className="block">Data do atendimento<input aria-label="Data do atendimento" type="date" className="w-full bg-black border border-white/20 p-2" value={novaData} onChange={e=>setNovaData(e.target.value)} /></label>
                        <label className="block">Início ocupado<input aria-label="Início ocupado" type="time" step="900" className="w-full bg-black border border-white/20 p-2" value={novaFaixaInicio} onChange={e=>setNovaFaixaInicio(e.target.value)} /></label>
                        <label className="block">Fim ocupado<input aria-label="Fim ocupado" type="time" className="w-full bg-black border border-white/20 p-2" value={novaFaixaFim} onChange={e=>setNovaFaixaFim(e.target.value)} /></label>
                    </div>}
                    <label className="text-[9px] font-bold uppercase tracking-[0.4em] text-zinc-500 block mb-3">Mensagem WhatsApp (editável)</label>
                    <textarea
                        value={mensagemWpp}
                        onChange={e => { setMensagemWpp(e.target.value); setWhatsappConfirmed(false); }}
                        className="w-full bg-black border-b border-white/20 p-4 text-sm text-white font-modern focus:border-primary focus:outline-none h-32 resize-none mb-6 placeholder:text-zinc-700 transition-colors"
                    />
                    <div className="mb-3 text-xs text-zinc-400">
                        <p>O cliente recebe o aviso por e-mail e no painel. Enviar também pelo WhatsApp é opcional.</p>
                        {whatsappOpened && <label className="mt-2 flex items-center gap-3"><input type="checkbox" checked={whatsappConfirmed} onChange={e => setWhatsappConfirmed(e.target.checked)} /> Também avisei pelo WhatsApp (opcional).</label>}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 mt-8">
                        <a
                            href={gerarLinkWhatsAppCliente(getCliente(modal.ag)?.whatsapp || '', mensagemWpp)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => setWhatsappOpened(true)}
                            className="flex-1 bg-[#25D366]/10 border border-[#25D366]/20 text-[#25D366] px-6 py-4 font-display font-bold uppercase text-[10px] tracking-[0.3em] flex items-center justify-center gap-3 hover:bg-[#25D366] hover:text-black transition-all"
                        >
                            <MessageCircle size={18} /> WhatsApp
                        </a>
                        <button disabled={action.busy} onClick={confirmarAprovar} className="flex-1 bg-green-500 text-black py-4 font-display font-bold uppercase text-[10px] tracking-[0.3em] hover:bg-green-400 transition-colors">Confirmar Aprovação</button>
                    </div>
                </ModalOverlay>
            )}

            {/* ── MODAL: Rejeitar ── */}
            {modal?.tipo === 'rejeitar' && (
                <ModalOverlay onClose={() => setModal(null)}><DataState error={action.error} loading={action.busy} />
                    <h3 className="font-display font-bold text-2xl uppercase tracking-tighter mb-8 flex items-center gap-3">
                        <XCircle size={24} className="text-red-400" /> Recusar ou sugerir novo horário
                    </h3>
                    <div className="space-y-3 mb-8 bg-white/[0.02] border border-white/5 p-6">
                        <InfoRow label="Serviço" value={modal.ag.servicoNome} />
                        <InfoRow label="Dia" value={formatDiaSemana(modal.ag.data)} />
                        <InfoRow label="Data" value={formatData(modal.ag.data)} />
                        <InfoRow label="Horário" value={`${modal.ag.faixaInicio} — ${modal.ag.faixaFim || 'a definir'}`} />
                    </div>
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
                        <input type="checkbox" disabled={modal.ag.status === 'solicitado'} checked={sugerirNovo} onChange={e => setSugerirNovo(e.target.checked)} className="sr-only" />
                        <div className={`w-5 h-5 border flex items-center justify-center shrink-0 transition-colors ${sugerirNovo ? 'border-primary bg-primary' : 'border-white/20'}`}>
                            {sugerirNovo && <span className="text-black text-[12px] font-bold">✓</span>}
                        </div>
                        <span className="text-sm font-modern text-white">Sugerir novo horário ao cliente</span>
                    </label>
                    {sugerirNovo && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 p-6 border border-white/5 bg-black">
                            <div>
                                <label className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 block mb-2">Nova Data</label>
                                <input type="date" value={novaData} min={new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bahia' })} onChange={e => setNovaData(e.target.value)} className="w-full bg-transparent border-b border-white/20 py-2 text-sm text-white font-modern focus:border-primary focus:outline-none transition-colors" />
                            </div>
                            <div>
                                <label className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 block mb-2">Início</label>
                                <select aria-label="Início da sugestão" value={novaFaixaInicio} onChange={e => {
                                    const chosen = proposalSlots.find(s => s.inicio === e.target.value);
                                    setNovaFaixaInicio(chosen?.inicio || '');
                                    setNovaFaixaFim(chosen?.fim || '');
                                }} className="w-full bg-black border-b border-white/20 py-2 text-sm text-white font-modern focus:border-primary focus:outline-none transition-colors">
                                    {proposalSlots.map(s => <option key={s.inicio} value={s.inicio}>{s.inicio}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 block mb-2">Fim</label>
                                <input aria-label="Fim calculado" readOnly type="time" value={novaFaixaFim} className="w-full bg-transparent border-b border-white/20 py-2 text-sm text-primary font-modern" />
                            </div>
                        </div>
                    )}
                    {sugerirNovo && <p className="mb-4 text-xs text-zinc-400">{proposalLoading ? 'Consultando horários livres...' : proposalSlots.length ? 'O fim é calculado automaticamente conforme a duração do serviço.' : 'Nenhum horário disponível na data selecionada.'}</p>}
                    <div className="mb-3 text-xs text-zinc-400">
                        <p>O cliente recebe o aviso por e-mail e no painel. Enviar também pelo WhatsApp é opcional.</p>
                        {whatsappOpened && <label className="mt-2 flex items-center gap-3"><input type="checkbox" checked={whatsappConfirmed} onChange={e => setWhatsappConfirmed(e.target.checked)} /> Também avisei pelo WhatsApp (opcional).</label>}
                    </div>
                    <div className="flex gap-3">
                        <button disabled={action.busy || (sugerirNovo && (!novaData || !novaFaixaFim))} onClick={confirmarRejeitar} className="flex-1 bg-red-500 text-white py-3 font-display font-bold uppercase text-xs tracking-[0.3em] hover:bg-red-400 transition-colors">
                            {sugerirNovo ? 'Enviar Proposta' : 'Confirmar Rejeição'}
                        </button>
                        <a
                            href={gerarLinkWhatsAppCliente(getCliente(modal.ag)?.whatsapp || '', mensagemWpp)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => setWhatsappOpened(true)}
                            className="bg-[#25D366] text-white px-6 py-3 font-display font-bold uppercase text-xs tracking-[0.3em] flex items-center gap-2"
                        >
                            <MessageCircle size={16} />
                        </a>
                    </div>
                </ModalOverlay>
            )}

            {/* ── MODAL: Concluir ── */}
            {modal?.tipo === 'concluir' && (
                <ModalOverlay onClose={() => setModal(null)}><DataState error={action.error} loading={action.busy} />
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
                                min="0" step="0.01" value={valorCobrado}
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
                        disabled={action.busy || valorCobrado === '' || !formaPagamento}
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
            <div role="dialog" aria-modal="true" className="relative bg-black border border-white/10 p-8 w-full max-w-lg shadow-2xl z-10 my-auto">
                <button
                    onClick={onClose}
                    aria-label="Fechar diálogo"
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
