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
    const { appointments: sbAppointments, loading: sbLoading } = useSupabaseAppointments();

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

    function confirmarAprovar() {
        const { ag } = modal;
        appointmentStore.aprovar(ag.id, '');
        const cliente = getCliente(ag);
        notificationStore.create({
            tipo: NOTIF_TIPOS.APROVACAO,
            titulo: 'Agendamento aprovado!',
            mensagem: `Seu ${ag.servicoNome} foi confirmado para ${formatData(ag.data)} às ${ag.faixaInicio}.`,
            destinatario: ag.clienteId,
            nivel: NOTIF_NIVEIS.SUCCESS,
        });
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

    function confirmarRejeitar() {
        const { ag } = modal;
        const motivoFinal = motivosSelecionados.map(id => MOTIVOS_REJEICAO.find(m => m.id === id)?.label).filter(Boolean).join('; ') + (motivoTexto ? ` — ${motivoTexto}` : '');
        appointmentStore.rejeitar(ag.id, {
            motivosRejeicaoIds: motivosSelecionados,
            motivoRejeicao: motivoFinal,
            sugestaoNovaData: sugerirNovo ? novaData : null,
            sugestaoNovaFaixa: sugerirNovo ? `${novaFaixaInicio} às ${novaFaixaFim}` : null,
        });
        const notifTipo = sugerirNovo ? NOTIF_TIPOS.AGUARDANDO : NOTIF_TIPOS.REJEICAO;
        const notifMsg = sugerirNovo
            ? `Seu horário para ${formatData(ag.data)} não está disponível. Uma nova proposta foi enviada.`
            : `Seu horário para ${formatData(ag.data)} foi recusado: ${motivoFinal}`;
        notificationStore.create({
            tipo: notifTipo,
            titulo: sugerirNovo ? 'Proposta de novo horário' : 'Agendamento recusado',
            mensagem: notifMsg,
            destinatario: ag.clienteId,
            nivel: sugerirNovo ? NOTIF_NIVEIS.WARNING : NOTIF_NIVEIS.ERROR,
        });
        setModal(null);
    }

    function abrirConcluir(ag) {
        setValorCobrado(String(ag.valorCobrado || ''));
        setFormaPagamento(ag.formaPagamento || '');
        setModal({ tipo: 'concluir', ag });
    }

    function confirmarConcluir() {
        const { ag } = modal;
        const valor = Number(valorCobrado);
        appointmentStore.concluir(ag.id, valor, formaPagamento);
        financialStore.registrarEntradaServico({ ...ag, valorCobrado: valor, formaPagamento });
        clientStore.updateScorePresenca(ag.clienteId, 5);
        notificationStore.create({
            tipo: NOTIF_TIPOS.CONCLUIDO,
            titulo: 'Atendimento concluído',
            mensagem: `Seu ${ag.servicoNome} foi finalizado. Obrigado!`,
            destinatario: ag.clienteId,
            nivel: NOTIF_NIVEIS.SUCCESS,
        });
        setModal(null);
    }

    function handleNaoCompareceu(ag) {
        appointmentStore.marcarNaoCompareceu(ag.id);
        clientStore.updateScorePresenca(ag.clienteId, -15);
        notificationStore.create({
            tipo: NOTIF_TIPOS.SISTEMA,
            titulo: 'Falta registrada',
            mensagem: `${ag.servicoNome} em ${formatData(ag.data)} — cliente não compareceu.`,
            destinatario: 'admin',
            nivel: NOTIF_NIVEIS.WARNING,
        });
    }

    function handleRemarcar(ag) {
        if (ag.sugestaoNovaData) {
            const [fi, ff] = (ag.sugestaoNovaFaixa || '').split(' às ');
            appointmentStore.remarcar(ag.id, ag.sugestaoNovaData, fi || ag.faixaInicio, ff || ag.faixaFim);
            notificationStore.create({
                tipo: NOTIF_TIPOS.REMARCACAO,
                titulo: 'Agendamento remarcado',
                mensagem: `Seu horário foi atualizado para ${formatData(ag.sugestaoNovaData)}.`,
                destinatario: ag.clienteId,
                nivel: NOTIF_NIVEIS.SUCCESS,
            });
        }
    }

    const STATUS_FILTER_OPTIONS = [
        { value: 'todos', label: 'Todos' },
        ...Object.entries(STATUS_CONFIG).map(([key, cfg]) => ({ value: key, label: cfg.label })),
    ];

    return (
        <div className="p-6 lg:p-8">
            <div className="mb-6">
                <span className="text-[10px] font-bold uppercase tracking-[1em] text-primary mb-2 block">Gestão</span>
                <h1 className="font-display font-bold text-2xl uppercase tracking-tight">Agendamentos</h1>
            </div>

            {/* Filters bar */}
            <div className="flex flex-col md:flex-row gap-3 mb-6">
                <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
                    <input
                        type="text"
                        value={busca}
                        onChange={e => setBusca(e.target.value)}
                        placeholder="Buscar por nome, serviço, telefone..."
                        className="w-full bg-black/50 border border-white/10 pl-10 pr-4 py-2.5 text-sm text-white font-modern focus:border-primary focus:outline-none"
                    />
                </div>
                <input
                    type="date"
                    value={filtroData}
                    onChange={e => setFiltroData(e.target.value)}
                    className="bg-black/50 border border-white/10 px-3 py-2.5 text-sm text-white font-modern focus:border-primary focus:outline-none"
                />
                <select
                    value={filtroStatus}
                    onChange={e => setFiltroStatus(e.target.value)}
                    className="bg-black/50 border border-white/10 px-3 py-2.5 text-sm text-white font-modern focus:border-primary focus:outline-none"
                >
                    {STATUS_FILTER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
            </div>

            {/* Count */}
            <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-wider mb-4">{agendamentos.length} resultado(s)</p>

            {/* Table */}
            {agendamentos.length === 0 ? (
                <div className="bg-zinc-900/40 border border-white/5 p-12 text-center">
                    <p className="text-zinc-500 font-modern">Nenhum agendamento encontrado.</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-white/10">
                                {['Cliente', 'Serviço', 'Data', 'Horário', 'Status', 'Ações'].map(h => (
                                    <th key={h} className="text-left py-3 px-3 text-[9px] font-bold uppercase tracking-[0.4em] text-zinc-500">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {agendamentos.map(ag => {
                                const cliente = getCliente(ag);
                                const sc = STATUS_CONFIG[ag.status] || {};
                                return (
                                    <tr key={ag.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                        <td className="py-3 px-3">
                                            <div className="flex items-center gap-2">
                                                <Avatar src={cliente?.fotoUrl} initials={`${cliente?.nome?.[0] || ''}${cliente?.sobrenome?.[0] || ''}`} size="xs" />
                                                {cliente?.favorito && <Star size={12} className="text-primary fill-primary" />}
                                                {cliente?.blacklist && <Ban size={12} className="text-red-400" />}
                                                <div>
                                                    <span className="font-modern text-sm">{cliente?.apelido || cliente?.nome || '—'} {cliente?.sobrenome?.[0] || ''}</span>
                                                    {cliente?.whatsapp && (
                                                        <span className="block text-[10px] text-zinc-600">{cliente.whatsapp}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-3 px-3 font-modern">{ag.servicoNome}</td>
                                        <td className="py-3 px-3 font-modern">{formatData(ag.data)}</td>
                                        <td className="py-3 px-3 font-modern">{ag.faixaInicio} — {ag.faixaFim}</td>
                                        <td className="py-3 px-3">
                                            <span className={`text-[9px] font-bold uppercase tracking-wider ${sc.cor} px-2 py-1 ${sc.bg} inline-block`}>
                                                {sc.label || ag.status}
                                            </span>
                                        </td>
                                        <td className="py-3 px-3">
                                            <div className="flex items-center gap-1.5 flex-wrap">
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
                                                        className="px-2 py-1 bg-[#25D366]/10 text-[#25D366] text-[10px] font-bold uppercase tracking-wider hover:bg-[#25D366]/20 transition-colors"
                                                    >
                                                        <MessageCircle size={12} className="inline -mt-0.5" />
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
                    <h3 className="font-display font-bold text-lg uppercase tracking-tight mb-4 flex items-center gap-2">
                        <CheckCircle size={20} className="text-green-400" /> Aprovar Agendamento
                    </h3>
                    <div className="space-y-3 mb-6">
                        <InfoRow label="Serviço" value={modal.ag.servicoNome} />
                        <InfoRow label="Data" value={formatData(modal.ag.data)} />
                        <InfoRow label="Horário" value={`${modal.ag.faixaInicio} — ${modal.ag.faixaFim}`} />
                    </div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.4em] text-zinc-500 block mb-2">Mensagem WhatsApp (editável)</label>
                    <textarea
                        value={mensagemWpp}
                        onChange={e => setMensagemWpp(e.target.value)}
                        className="w-full bg-black/50 border border-white/10 p-3 text-sm text-white font-modern focus:border-primary focus:outline-none h-28 resize-none mb-4"
                    />
                    <div className="flex gap-3">
                        <button onClick={confirmarAprovar} className="flex-1 bg-green-500 text-black py-3 font-display font-bold uppercase text-xs tracking-[0.3em] hover:bg-green-400 transition-colors">Confirmar Aprovação</button>
                        <a
                            href={gerarLinkWhatsAppCliente(getCliente(modal.ag)?.whatsapp || '', mensagemWpp)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => appointmentStore.marcarWhatsappEnviado(modal.ag.id)}
                            className="bg-[#25D366] text-white px-6 py-3 font-display font-bold uppercase text-xs tracking-[0.3em] flex items-center gap-2 hover:bg-[#20bd5a] transition-colors"
                        >
                            <MessageCircle size={16} /> WhatsApp
                        </a>
                    </div>
                </ModalOverlay>
            )}

            {/* ── MODAL: Rejeitar ── */}
            {modal?.tipo === 'rejeitar' && (
                <ModalOverlay onClose={() => setModal(null)}>
                    <h3 className="font-display font-bold text-lg uppercase tracking-tight mb-4 flex items-center gap-2">
                        <XCircle size={20} className="text-red-400" /> Rejeitar Agendamento
                    </h3>
                    <label className="text-[10px] font-bold uppercase tracking-[0.4em] text-zinc-500 block mb-2">Motivo(s)</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4 max-h-48 overflow-y-auto">
                        {MOTIVOS_REJEICAO.map(m => (
                            <label key={m.id} className={`flex items-center gap-2 p-2 border text-sm font-modern cursor-pointer transition-colors ${motivosSelecionados.includes(m.id) ? 'border-red-400/50 bg-red-400/5 text-red-300' : 'border-white/5 text-zinc-400 hover:border-white/10'}`}>
                                <input
                                    type="checkbox"
                                    checked={motivosSelecionados.includes(m.id)}
                                    onChange={() => setMotivosSelecionados(prev => prev.includes(m.id) ? prev.filter(x => x !== m.id) : [...prev, m.id])}
                                    className="sr-only"
                                />
                                <div className={`w-3.5 h-3.5 border flex items-center justify-center shrink-0 ${motivosSelecionados.includes(m.id) ? 'border-red-400 bg-red-400' : 'border-white/20'}`}>
                                    {motivosSelecionados.includes(m.id) && <span className="text-black text-[8px] font-bold">✓</span>}
                                </div>
                                {m.label}
                            </label>
                        ))}
                    </div>
                    <textarea
                        value={motivoTexto}
                        onChange={e => setMotivoTexto(e.target.value)}
                        placeholder="Observação adicional (opcional)"
                        className="w-full bg-black/50 border border-white/10 p-3 text-sm text-white font-modern focus:border-primary focus:outline-none h-20 resize-none mb-4"
                    />
                    <label className="flex items-center gap-3 p-3 border border-white/5 bg-blue-400/5 cursor-pointer mb-4 hover:bg-blue-400/10 transition-colors">
                        <input type="checkbox" checked={sugerirNovo} onChange={e => setSugerirNovo(e.target.checked)} className="sr-only" />
                        <div className={`w-4 h-4 border flex items-center justify-center shrink-0 ${sugerirNovo ? 'border-blue-400 bg-blue-400' : 'border-white/20'}`}>
                            {sugerirNovo && <span className="text-black text-[9px] font-bold">✓</span>}
                        </div>
                        <span className="text-sm font-modern text-blue-300">Sugerir novo horário ao cliente</span>
                    </label>
                    {sugerirNovo && (
                        <div className="grid grid-cols-3 gap-3 mb-4">
                            <div>
                                <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-600 block mb-1">Nova Data</label>
                                <input type="date" value={novaData} onChange={e => setNovaData(e.target.value)} className="w-full bg-black/50 border border-white/10 px-3 py-2 text-sm text-white font-modern focus:border-primary focus:outline-none" />
                            </div>
                            <div>
                                <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-600 block mb-1">Início</label>
                                <input type="time" value={novaFaixaInicio} onChange={e => setNovaFaixaInicio(e.target.value)} className="w-full bg-black/50 border border-white/10 px-3 py-2 text-sm text-white font-modern focus:border-primary focus:outline-none" />
                            </div>
                            <div>
                                <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-600 block mb-1">Fim</label>
                                <input type="time" value={novaFaixaFim} onChange={e => setNovaFaixaFim(e.target.value)} className="w-full bg-black/50 border border-white/10 px-3 py-2 text-sm text-white font-modern focus:border-primary focus:outline-none" />
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
                    <h3 className="font-display font-bold text-lg uppercase tracking-tight mb-4 flex items-center gap-2">
                        <DollarSign size={20} className="text-emerald-400" /> Concluir Atendimento
                    </h3>
                    <InfoRow label="Serviço" value={modal.ag.servicoNome} />
                    <InfoRow label="Data" value={formatData(modal.ag.data)} />
                    <div className="mt-4 space-y-4">
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-[0.4em] text-zinc-500 block mb-1">Valor Cobrado</label>
                            <input type="number" value={valorCobrado} onChange={e => setValorCobrado(e.target.value)} className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white font-modern focus:border-primary focus:outline-none" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-[0.4em] text-zinc-500 block mb-1">Forma de Pagamento</label>
                            <select value={formaPagamento} onChange={e => setFormaPagamento(e.target.value)} className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white font-modern focus:border-primary focus:outline-none">
                                <option value="">Selecione</option>
                                {FORMAS_PAGAMENTO.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                            </select>
                        </div>
                    </div>
                    <button onClick={confirmarConcluir} disabled={!valorCobrado || !formaPagamento} className="w-full mt-6 bg-emerald-500 text-black py-3 font-display font-bold uppercase text-xs tracking-[0.3em] hover:bg-emerald-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-zinc-900 border border-white/10 p-6 md:p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"><X size={18} /></button>
                {children}
            </div>
        </div>
    );
}

function InfoRow({ label, value }) {
    return (
        <div className="flex items-center justify-between py-1.5 border-b border-white/5">
            <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-zinc-500">{label}</span>
            <span className="text-sm font-modern text-white">{value}</span>
        </div>
    );
}
