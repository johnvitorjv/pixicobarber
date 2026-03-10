import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import serviceStore from '../stores/serviceStore';

function formatPreco(v) { return `R$ ${Number(v || 0).toFixed(0)}`; }
import availabilityStore from '../stores/availabilityStore';
import appointmentStore from '../stores/appointmentStore';
import notificationStore from '../stores/notificationStore';
import { isSupabaseConfigured } from '../lib/supabase';
import { createAppointmentSupabase, useSupabaseServices } from '../hooks/useSupabase';
import { NOTIF_TIPOS, NOTIF_NIVEIS } from '../data/models';
import { useStoreSync } from '../hooks/useStore';
import { ArrowLeft, Lock, Check, ChevronLeft, ChevronRight, MessageCircle, ArrowUpRight } from 'lucide-react';

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export default function BookingPage() {
    const navigate = useNavigate();
    const { user, isAuthenticated } = useAuth();

    const [step, setStep] = useState(1); // 1=serviço, 2=data, 3=horário, 4=confirmação, 5=concluído
    const [servicoId, setServicoId] = useState(null);
    const [dataSelecionada, setDataSelecionada] = useState(null);
    const [faixaSelecionada, setFaixaSelecionada] = useState(null);
    const [observacao, setObservacao] = useState('');
    const [mesAtual, setMesAtual] = useState(new Date());

    const storeTick = useStoreSync();
    const disponibilidade = availabilityStore.getRange(60);

    // Serviços: Supabase quando configurado, localStorage como fallback
    const sbConfigured = isSupabaseConfigured();
    const { services: sbServices, loading: sbServicesLoading, getById: sbGetById, getVisiveis: sbGetVisiveis } = useSupabaseServices();

    const servicosVisiveis = sbConfigured ? sbGetVisiveis('agendamento') : serviceStore.getVisiveis('agendamento');
    const getServicoById = (id) => sbConfigured ? sbGetById(id) : serviceStore.getById(id);
    const servicoSelecionado = getServicoById(servicoId);

    // Redirecionar para login se não autenticado
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center px-6">
                <div className="text-center max-w-md w-full border border-white/5 p-12 bg-white/[0.02]">
                    <h2 className="font-display font-bold text-3xl uppercase tracking-tighter mb-4 text-white">Acesso Necessário</h2>
                    <p className="text-zinc-500 font-modern mb-10 text-sm uppercase tracking-widest leading-relaxed">Para agendar um horário exclusivo, identifique-se.</p>
                    <div className="flex flex-col gap-4">
                        <Link to="/login" className="bg-primary text-black py-4 font-display font-bold uppercase text-[10px] tracking-[0.5em] hover:scale-[1.02] transition-transform w-full shadow-[0_0_20px_rgba(255,255,255,0.05)]">
                            Fazer Login
                        </Link>
                        <Link to="/cadastro" className="border border-white/10 text-white py-4 font-display font-bold uppercase text-[10px] tracking-[0.5em] hover:bg-white/[0.02] transition-colors w-full">
                            Criar Conta
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // Gerar dias do calendário
    function getDiasCalendario() {
        const ano = mesAtual.getFullYear();
        const mes = mesAtual.getMonth();
        const primeiroDia = new Date(ano, mes, 1).getDay();
        const totalDias = new Date(ano, mes + 1, 0).getDate();
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const dias = [];

        for (let i = 0; i < primeiroDia; i++) dias.push(null);

        for (let d = 1; d <= totalDias; d++) {
            const data = new Date(ano, mes, d);
            const chave = data.toISOString().split('T')[0];
            const passado = data < hoje;
            const info = disponibilidade[chave];

            dias.push({
                dia: d,
                data: chave,
                passado,
                disponivel: !passado && info?.disponivel === true,
                fechado: info?.disponivel === false,
                motivo: info?.motivo || '',
            });
        }

        return dias;
    }

    async function handleConfirmar() {
        const servico = getServicoById(servicoId);
        const faixaInfo = disponibilidade[dataSelecionada]?.faixas?.find(f => f.id === faixaSelecionada);

        if (isSupabaseConfigured()) {
            try {
                await createAppointmentSupabase({
                    clienteId: user.id,
                    servicoId,
                    data: dataSelecionada,
                    faixaInicio: faixaInfo.inicio,
                    faixaFim: faixaInfo.fim,
                    observacaoCliente: observacao,
                });
            } catch (err) {
                console.error('Erro ao criar agendamento no Supabase:', err);
                alert('Erro ao agendar. Tente novamente.');
                return;
            }
        } else {
            appointmentStore.create({
                clienteId: user.id,
                servicoId,
                servicoNome: servico.nome,
                profissional: 'Pixico',
                data: dataSelecionada,
                faixaInicio: faixaInfo.inicio,
                faixaFim: faixaInfo.fim,
                observacaoCliente: observacao,
            });

            notificationStore.create({
                tipo: NOTIF_TIPOS.NOVO_PEDIDO,
                titulo: 'Novo agendamento!',
                mensagem: `${user.nome} agendou ${servico.nome} para ${dataSelecionada} às ${faixaInfo.inicio}.`,
                destinatario: 'admin',
                nivel: NOTIF_NIVEIS.WARNING,
            });
        }

        // Bloquear faixa usada
        availabilityStore.blockSlot(dataSelecionada, faixaSelecionada);

        setStep(5);
    }

    function formatDataExibicao(dataStr) {
        const [y, m, d] = dataStr.split('-');
        return `${d}/${m}/${y}`;
    }

    const whatsappLink = `https://wa.me/5571994096863?text=${encodeURIComponent(
        `Olá! Acabei de agendar ${servicoSelecionado?.nome || 'um serviço'} para ${dataSelecionada ? formatDataExibicao(dataSelecionada) : ''}. Meu nome é ${user?.nome}.`
    )}`;

    return (
        <div className="min-h-screen bg-background-dark">
            {/* Header */}
            <div className="border-b border-white/5 bg-black/80 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-4xl mx-auto px-6 py-6 flex items-center justify-between">
                    <Link to="/" className="font-display font-bold text-xl md:text-2xl uppercase tracking-tighter hover:text-primary transition-colors">Pixico</Link>
                    <Link to="/painel" className="text-zinc-500 hover:text-white transition-colors text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                        Painel Cliente <ArrowUpRight size={14} />
                    </Link>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 py-12 md:py-20">
                {/* Progress */}
                <div className="flex flex-wrap items-center gap-2 md:gap-4 mb-16 border-b border-white/5 pb-12">
                    {['Serviço', 'Data', 'Horário', 'Confirmar'].map((label, i) => (
                        <div key={label} className="flex items-center gap-2 md:gap-4">
                            <div className={`w-8 h-8 md:w-10 md:h-10 flex items-center justify-center text-[10px] md:text-xs font-bold transition-colors ${step > i + 1 ? 'bg-primary text-black' :
                                step === i + 1 ? 'border-2 border-primary text-primary shadow-[0_0_15px_rgba(255,255,255,0.05)]' :
                                    'border border-white/10 text-zinc-600 bg-white/[0.01]'
                                }`}>
                                {step > i + 1 ? <Check size={14} /> : i + 1}
                            </div>
                            <span className={`text-[9px] md:text-[10px] uppercase tracking-[0.2em] md:tracking-[0.4em] font-bold hidden sm:block ${step >= i + 1 ? 'text-white' : 'text-zinc-600'
                                }`}>{label}</span>
                            {i < 3 && <div className={`w-4 md:w-12 h-px ${step > i + 1 ? 'bg-primary' : 'bg-white/10'}`} />}
                        </div>
                    ))}
                </div>

                {/* Step 1: Serviço */}
                {step === 1 && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="mb-12">
                            <span className="text-[10px] font-bold uppercase tracking-[1em] text-primary mb-3 block">Passo 1</span>
                            <h2 className="font-display font-bold text-3xl md:text-5xl uppercase tracking-tighter mb-4">Escolha o Serviço</h2>
                            <p className="text-zinc-500 font-modern text-sm uppercase tracking-widest">Nossos tratamentos exclusivos.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                            {servicosVisiveis.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => { setServicoId(s.id); setStep(2); }}
                                    className={`group text-left p-6 md:p-8 border transition-all duration-500 hover:-translate-y-1 ${servicoId === s.id ? 'border-primary bg-primary/5 shadow-[0_0_30px_rgba(255,255,255,0.05)]' : 'border-white/5 bg-black hover:border-white/20'
                                        }`}
                                >
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="pr-4">
                                            <span className="font-display font-bold uppercase tracking-widest text-sm md:text-base block mb-2 text-white group-hover:text-primary transition-colors">{s.nome}</span>
                                            <span className="text-zinc-500 font-modern text-xs leading-relaxed line-clamp-2">{s.descricaoCurta}</span>
                                        </div>
                                        <span className="font-display font-bold text-white text-xl md:text-2xl shrink-0 tabular-nums tracking-tighter">{formatPreco(s.preco)}</span>
                                    </div>
                                    <div className="border-t border-white/5 pt-4 flex items-center justify-between">
                                        <span className="text-[9px] text-zinc-600 font-modern uppercase tracking-[0.3em]">
                                            Duração
                                        </span>
                                        <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
                                            {s.duracao} min
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Step 2: Data */}
                {step === 2 && (
                    <div className="animate-in fade-in slide-in-from-right-8 duration-500">
                        <button onClick={() => setStep(1)} className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors mb-12 text-[10px] font-bold uppercase tracking-widest border border-white/5 bg-white/[0.02] px-4 py-2 w-fit">
                            <ArrowLeft size={14} /> Voltar
                        </button>

                        <div className="mb-12">
                            <span className="text-[10px] font-bold uppercase tracking-[1em] text-primary mb-3 block">Passo 2</span>
                            <h2 className="font-display font-bold text-3xl md:text-5xl uppercase tracking-tighter mb-4">Escolha a Data</h2>
                        </div>

                        <div className="bg-black border border-white/5 p-6 md:p-10">
                            {/* Legenda */}
                            <div className="flex flex-wrap items-center gap-6 mb-10 pb-6 border-b border-white/5">
                                <p className="text-zinc-400 font-modern text-[10px] uppercase tracking-[0.2em] flex items-center gap-2">
                                    <span className="inline-block w-2.5 h-2.5 bg-green-500" /> Disponível
                                </p>
                                <p className="text-zinc-600 font-modern text-[10px] uppercase tracking-[0.2em] flex items-center gap-2">
                                    <span className="inline-block w-2.5 h-2.5 bg-white/5 border border-white/10" /> <Lock size={10} /> Indisponível
                                </p>
                            </div>

                            {/* Navegação de mês */}
                            <div className="flex items-center justify-between mb-8">
                                <button onClick={() => setMesAtual(new Date(mesAtual.getFullYear(), mesAtual.getMonth() - 1))} className="w-12 h-12 flex items-center justify-center border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] text-white transition-colors">
                                    <ChevronLeft size={20} />
                                </button>
                                <span className="font-display font-bold uppercase tracking-[0.3em] text-lg text-white">
                                    {MESES[mesAtual.getMonth()]} {mesAtual.getFullYear()}
                                </span>
                                <button onClick={() => setMesAtual(new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1))} className="w-12 h-12 flex items-center justify-center border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] text-white transition-colors">
                                    <ChevronRight size={20} />
                                </button>
                            </div>

                            {/* Grid do calendário */}
                            <div className="grid grid-cols-7 gap-1 md:gap-2">
                                {DIAS_SEMANA.map(d => (
                                    <div key={d} className="text-center text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500 py-4 hidden sm:block">{d}</div>
                                ))}
                                {DIAS_SEMANA.map(d => (
                                    <div key={d + '_mob'} className="text-center text-[10px] font-bold uppercase tracking-wider text-zinc-500 py-2 sm:hidden">{d[0]}</div>
                                ))}

                                {getDiasCalendario().map((item, i) => {
                                    if (!item) return <div key={`empty-${i}`} />;

                                    const selecionado = item.data === dataSelecionada;

                                    if (item.passado) {
                                        return (
                                            <div key={item.data} className="aspect-square flex items-center justify-center text-zinc-700 text-sm md:text-base font-modern cursor-not-allowed">
                                                {item.dia}
                                            </div>
                                        );
                                    }

                                    if (item.fechado) {
                                        return (
                                            <div key={item.data} className="aspect-square flex flex-col items-center justify-center bg-white/[0.01] text-zinc-700 text-sm md:text-base font-modern cursor-not-allowed border border-white/5 relative group" title={item.motivo}>
                                                <span className="opacity-50 group-hover:opacity-10 transition-opacity">{item.dia}</span>
                                                <Lock size={12} className="absolute text-zinc-800" />
                                            </div>
                                        );
                                    }

                                    return (
                                        <button
                                            key={item.data}
                                            onClick={() => { setDataSelecionada(item.data); setStep(3); }}
                                            className={`aspect-square flex items-center justify-center text-sm md:text-base font-modern font-bold transition-all relative overflow-hidden group border ${selecionado
                                                ? 'bg-primary border-primary text-black shadow-[0_0_20px_rgba(255,255,255,0.1)]'
                                                : 'bg-white/[0.02] border-white/5 text-white hover:bg-white/[0.05] hover:border-white/20'
                                                }`}
                                        >
                                            <span className="relative z-10">{item.dia}</span>
                                            {!selecionado && <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-green-500/50 group-hover:bg-green-400 indicator" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 3: Horário */}
                {step === 3 && (
                    <div className="animate-in fade-in slide-in-from-right-8 duration-500">
                        <button onClick={() => setStep(2)} className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors mb-12 text-[10px] font-bold uppercase tracking-widest border border-white/5 bg-white/[0.02] px-4 py-2 w-fit">
                            <ArrowLeft size={14} /> Voltar
                        </button>

                        <div className="mb-12">
                            <span className="text-[10px] font-bold uppercase tracking-[1em] text-primary mb-3 block">Passo 3</span>
                            <h2 className="font-display font-bold text-3xl md:text-5xl uppercase tracking-tighter mb-4">Escolha o Horário</h2>
                            <p className="text-zinc-500 font-modern text-sm uppercase tracking-widest leading-relaxed">Janelas de atendimento disponíveis no dia selecionado.</p>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {(disponibilidade[dataSelecionada]?.faixas || []).map(faixa => (
                                <button
                                    key={faixa.id}
                                    disabled={!faixa.disponivel}
                                    onClick={() => { setFaixaSelecionada(faixa.id); setStep(4); }}
                                    className={`py-8 px-4 text-center font-display font-bold tracking-widest text-lg transition-all border ${!faixa.disponivel
                                        ? 'bg-white/[0.01] text-zinc-800 cursor-not-allowed border-white/5'
                                        : faixaSelecionada === faixa.id
                                            ? 'bg-primary border-primary text-black shadow-[0_0_20px_rgba(255,255,255,0.1)]'
                                            : 'bg-black border-white/10 text-white hover:border-primary hover:-translate-y-1'
                                        }`}
                                >
                                    {faixa.inicio} <span className="opacity-30 mx-1">—</span> {faixa.fim}
                                    {!faixa.disponivel && <span className="block text-[9px] font-modern uppercase tracking-widest text-red-500/50 mt-3">Indisponível</span>}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Step 4: Confirmação */}
                {step === 4 && (
                    <div className="animate-in fade-in slide-in-from-right-8 duration-500">
                        <button onClick={() => setStep(3)} className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors mb-12 text-[10px] font-bold uppercase tracking-widest border border-white/5 bg-white/[0.02] px-4 py-2 w-fit">
                            <ArrowLeft size={14} /> Voltar
                        </button>

                        <div className="mb-12">
                            <span className="text-[10px] font-bold uppercase tracking-[1em] text-primary mb-3 block">Passo 4</span>
                            <h2 className="font-display font-bold text-3xl md:text-5xl uppercase tracking-tighter mb-4">Confirmação</h2>
                        </div>

                        <div className="bg-black border border-white/5 p-8 md:p-12 mb-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                                <div className="md:col-span-2 border-b border-white/5 pb-10">
                                    <span className="text-[10px] font-bold uppercase tracking-[0.5em] text-zinc-600 block mb-3">Serviço Solicitado</span>
                                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                                        <span className="font-display font-bold text-2xl md:text-4xl uppercase tracking-tighter text-white">{servicoSelecionado?.nome}</span>
                                        <span className="font-display font-bold text-3xl text-primary tabular-nums tracking-tighter">{formatPreco(servicoSelecionado?.preco || 0)}</span>
                                    </div>
                                </div>

                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-[0.5em] text-zinc-600 block mb-3">Data</span>
                                    <span className="font-display font-bold uppercase tracking-widest text-lg text-white">{formatDataExibicao(dataSelecionada)}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-[0.5em] text-zinc-600 block mb-3">Janela de Horário</span>
                                    <span className="font-display font-bold uppercase tracking-widest text-lg text-white">
                                        {disponibilidade[dataSelecionada]?.faixas?.find(f => f.id === faixaSelecionada)?.inicio}
                                        <span className="opacity-50 mx-2">—</span>
                                        {disponibilidade[dataSelecionada]?.faixas?.find(f => f.id === faixaSelecionada)?.fim}
                                    </span>
                                </div>
                            </div>

                            <div className="mt-10 pt-10 border-t border-white/5">
                                <label className="text-[10px] font-bold uppercase tracking-[0.5em] text-zinc-600 block mb-4">Observação Furtiva (Opcional)</label>
                                <input
                                    type="text"
                                    value={observacao}
                                    onChange={(e) => setObservacao(e.target.value)}
                                    className="w-full bg-white/[0.02] border border-white/10 px-6 py-5 text-white font-modern focus:border-primary focus:outline-none transition-colors"
                                    placeholder="Detalhes ou pedidos especiais..."
                                />
                            </div>
                        </div>

                        <button
                            onClick={handleConfirmar}
                            className="w-full bg-primary text-black py-6 font-display font-bold uppercase tracking-[1em] text-xs hover:bg-white transition-colors"
                        >
                            Confirmar Solicitação
                        </button>
                    </div>
                )}

                {/* Step 5: Concluído */}
                {step === 5 && (
                    <div className="text-center py-20 animate-in fade-in zoom-in-95 duration-700">
                        <div className="w-24 h-24 bg-primary/10 border border-primary/30 rounded-full flex items-center justify-center mx-auto mb-12 shadow-[0_0_50px_rgba(255,255,255,0.05)]">
                            <Check size={48} className="text-primary" strokeWidth={1} />
                        </div>

                        <h2 className="font-display font-bold text-4xl md:text-6xl uppercase tracking-tighter mb-6 text-white">Solicitação<br />Enviada</h2>

                        <div className="max-w-md mx-auto mb-16">
                            <p className="text-zinc-400 font-modern text-sm uppercase tracking-widest leading-relaxed mb-6">
                                Seu pedido para <span className="text-white font-bold">{servicoSelecionado?.nome}</span> no dia <span className="text-white font-bold">{formatDataExibicao(dataSelecionada)}</span> foi registrado.
                            </p>

                            <div className="bg-black border border-white/5 p-6 inline-block">
                                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-yellow-500 flex items-center gap-2 justify-center">
                                    <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                                    Aguardando aprovação do profissional
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-6 justify-center">
                            <a
                                href={whatsappLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center gap-4 bg-[#25D366] text-black px-8 py-5 font-display font-bold uppercase text-[10px] tracking-[0.5em] hover:scale-[1.02] transition-transform shadow-[0_0_30px_rgba(37,211,102,0.15)]"
                            >
                                <MessageCircle size={18} />
                                Enviar no WhatsApp
                            </a>

                            <Link
                                to="/painel"
                                className="inline-flex items-center justify-center gap-4 border border-white/20 text-white px-8 py-5 font-display font-bold uppercase text-[10px] tracking-[0.5em] hover:bg-white/[0.02] transition-colors"
                            >
                                Painel Principal
                                <ArrowUpRight size={16} />
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
