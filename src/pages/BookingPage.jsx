import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import serviceStore from '../stores/serviceStore';

function formatPreco(v) { return `R$ ${Number(v || 0).toFixed(0)}`; }
import availabilityStore from '../stores/availabilityStore';
import appointmentStore from '../stores/appointmentStore';
import notificationStore from '../stores/notificationStore';
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
    const servicoSelecionado = serviceStore.getById(servicoId);

    // Redirecionar para login se não autenticado
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-background-dark flex items-center justify-center px-4">
                <div className="text-center max-w-md">
                    <h2 className="font-display font-bold text-2xl uppercase tracking-tight mb-4">Acesso Necessário</h2>
                    <p className="text-zinc-500 font-modern mb-8">Para agendar, você precisa ter uma conta.</p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link to="/login" className="bg-primary text-black px-8 py-4 font-display font-bold uppercase text-xs tracking-[0.5em] hover:scale-[1.02] transition-transform">
                            Entrar
                        </Link>
                        <Link to="/cadastro" className="border border-white/20 text-white px-8 py-4 font-display font-bold uppercase text-xs tracking-[0.5em] hover:border-primary transition-colors">
                            Cadastrar
                        </Link>
                    </div>
                    <Link to="/" className="inline-flex items-center gap-2 text-zinc-500 hover:text-primary transition-colors mt-8 text-sm font-modern">
                        <ArrowLeft size={16} /> Voltar ao site
                    </Link>
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

    function handleConfirmar() {
        const servico = serviceStore.getById(servicoId);
        const faixaInfo = disponibilidade[dataSelecionada]?.faixas?.find(f => f.id === faixaSelecionada);

        const ag = appointmentStore.create({
            clienteId: user.id,
            servicoId,
            servicoNome: servico.nome,
            profissional: 'Pixico',
            data: dataSelecionada,
            faixaInicio: faixaInfo.inicio,
            faixaFim: faixaInfo.fim,
            observacaoCliente: observacao,
        });

        // Bloquear faixa usada
        availabilityStore.blockSlot(dataSelecionada, faixaSelecionada);

        // Notificação para o admin
        notificationStore.create({
            tipo: NOTIF_TIPOS.NOVO_PEDIDO,
            titulo: 'Novo agendamento!',
            mensagem: `${user.nome} agendou ${servico.nome} para ${dataSelecionada} às ${faixaInfo.inicio}.`,
            destinatario: 'admin',
            nivel: NOTIF_NIVEIS.WARNING,
        });

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
            <div className="border-b border-white/5 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
                    <Link to="/" className="font-display font-bold text-xl uppercase tracking-tighter">Pixico</Link>
                    <Link to="/painel" className="text-zinc-500 hover:text-primary transition-colors text-sm font-modern">
                        Meu Painel
                    </Link>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-6 py-12">
                {/* Progress */}
                <div className="flex items-center gap-2 mb-12">
                    {['Serviço', 'Data', 'Horário', 'Confirmar'].map((label, i) => (
                        <div key={label} className="flex items-center gap-2">
                            <div className={`w-8 h-8 flex items-center justify-center text-xs font-bold ${step > i + 1 ? 'bg-primary text-black' :
                                step === i + 1 ? 'border-2 border-primary text-primary' :
                                    'border border-white/10 text-zinc-600'
                                }`}>
                                {step > i + 1 ? <Check size={14} /> : i + 1}
                            </div>
                            <span className={`text-[10px] uppercase tracking-wider font-bold hidden sm:inline ${step >= i + 1 ? 'text-white' : 'text-zinc-600'
                                }`}>{label}</span>
                            {i < 3 && <div className={`w-8 h-px ${step > i + 1 ? 'bg-primary' : 'bg-white/10'}`} />}
                        </div>
                    ))}
                </div>

                {/* Step 1: Serviço */}
                {step === 1 && (
                    <div>
                        <h2 className="font-display font-bold text-2xl uppercase tracking-tight mb-2">Escolha o Serviço</h2>
                        <p className="text-zinc-500 font-modern mb-8">Selecione o serviço que deseja agendar.</p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {serviceStore.getVisiveis('agendamento').map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => { setServicoId(s.id); setStep(2); }}
                                    className={`group text-left p-5 border transition-all duration-300 hover:scale-[1.02] ${servicoId === s.id ? 'border-primary bg-primary/5' : 'border-white/10 hover:border-primary/50 bg-zinc-900/60'
                                        }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <span className="font-display font-bold uppercase text-sm block mb-1">{s.nome}</span>
                                            <span className="text-zinc-500 font-modern text-xs">{s.descricaoCurta}</span>
                                        </div>
                                        <span className="font-display font-bold text-primary text-lg shrink-0 ml-4">{formatPreco(s.preco)}</span>
                                    </div>
                                    <div className="mt-3 text-[10px] text-zinc-600 font-modern uppercase tracking-wider">
                                        ~{s.duracao} min
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Step 2: Data */}
                {step === 2 && (
                    <div>
                        <button onClick={() => setStep(1)} className="flex items-center gap-2 text-zinc-500 hover:text-primary transition-colors mb-6 text-sm font-modern">
                            <ArrowLeft size={14} /> Voltar
                        </button>

                        <h2 className="font-display font-bold text-2xl uppercase tracking-tight mb-2">Escolha a Data</h2>
                        <p className="text-zinc-500 font-modern mb-8">
                            <span className="inline-block w-3 h-3 bg-green-500/30 border border-green-500/50 mr-2 align-middle" /> Disponível
                            <span className="inline-block w-3 h-3 bg-zinc-800 border border-white/5 mr-2 ml-4 align-middle" /> <Lock size={10} className="inline align-middle" /> Indisponível
                        </p>

                        {/* Navegação de mês */}
                        <div className="flex items-center justify-between mb-6">
                            <button onClick={() => setMesAtual(new Date(mesAtual.getFullYear(), mesAtual.getMonth() - 1))} className="text-zinc-500 hover:text-primary transition-colors">
                                <ChevronLeft size={20} />
                            </button>
                            <span className="font-display font-bold uppercase tracking-wide">
                                {MESES[mesAtual.getMonth()]} {mesAtual.getFullYear()}
                            </span>
                            <button onClick={() => setMesAtual(new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1))} className="text-zinc-500 hover:text-primary transition-colors">
                                <ChevronRight size={20} />
                            </button>
                        </div>

                        {/* Grid do calendário */}
                        <div className="grid grid-cols-7 gap-1 mb-4">
                            {DIAS_SEMANA.map(d => (
                                <div key={d} className="text-center text-[10px] font-bold uppercase tracking-wider text-zinc-600 py-2">{d}</div>
                            ))}
                            {getDiasCalendario().map((item, i) => {
                                if (!item) return <div key={`empty-${i}`} />;

                                const selecionado = item.data === dataSelecionada;

                                if (item.passado) {
                                    return (
                                        <div key={item.data} className="aspect-square flex items-center justify-center text-zinc-700 text-sm font-modern cursor-not-allowed">
                                            {item.dia}
                                        </div>
                                    );
                                }

                                if (item.fechado) {
                                    return (
                                        <div key={item.data} className="aspect-square flex flex-col items-center justify-center bg-zinc-900/50 text-zinc-700 text-sm font-modern cursor-not-allowed border border-white/5" title={item.motivo}>
                                            {item.dia}
                                            <Lock size={10} className="mt-0.5 text-zinc-700" />
                                        </div>
                                    );
                                }

                                return (
                                    <button
                                        key={item.data}
                                        onClick={() => { setDataSelecionada(item.data); setStep(3); }}
                                        className={`aspect-square flex items-center justify-center text-sm font-modern font-bold transition-all ${selecionado
                                            ? 'bg-primary text-black'
                                            : 'bg-green-500/10 border border-green-500/20 text-green-300 hover:bg-green-500/20 hover:scale-105'
                                            }`}
                                    >
                                        {item.dia}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Step 3: Horário */}
                {step === 3 && (
                    <div>
                        <button onClick={() => setStep(2)} className="flex items-center gap-2 text-zinc-500 hover:text-primary transition-colors mb-6 text-sm font-modern">
                            <ArrowLeft size={14} /> Voltar
                        </button>

                        <h2 className="font-display font-bold text-2xl uppercase tracking-tight mb-2">Faixa de Horário</h2>
                        <p className="text-zinc-500 font-modern text-sm mb-2">
                            Selecione a faixa de atendimento disponível mais conveniente para você.
                        </p>
                        <p className="text-zinc-600 font-modern text-xs mb-8">
                            Os horários são organizados por janelas de atendimento para garantir mais flexibilidade na operação.
                        </p>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                            {(disponibilidade[dataSelecionada]?.faixas || []).map(faixa => (
                                <button
                                    key={faixa.id}
                                    disabled={!faixa.disponivel}
                                    onClick={() => { setFaixaSelecionada(faixa.id); setStep(4); }}
                                    className={`p-4 text-center font-modern text-sm transition-all ${!faixa.disponivel
                                        ? 'bg-zinc-900/30 text-zinc-700 cursor-not-allowed border border-white/5 line-through'
                                        : faixaSelecionada === faixa.id
                                            ? 'bg-primary text-black font-bold'
                                            : 'bg-zinc-900/60 border border-white/10 text-white hover:border-primary hover:scale-[1.03]'
                                        }`}
                                >
                                    {faixa.inicio} — {faixa.fim}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Step 4: Confirmação */}
                {step === 4 && (
                    <div>
                        <button onClick={() => setStep(3)} className="flex items-center gap-2 text-zinc-500 hover:text-primary transition-colors mb-6 text-sm font-modern">
                            <ArrowLeft size={14} /> Voltar
                        </button>

                        <h2 className="font-display font-bold text-2xl uppercase tracking-tight mb-8">Confirme seu Agendamento</h2>

                        <div className="bg-zinc-900/80 border border-white/10 p-6 md:p-8 space-y-6 mb-8">
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-[0.5em] text-zinc-600 block mb-1">Serviço</span>
                                    <span className="font-display font-bold uppercase">{servicoSelecionado?.nome}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-[0.5em] text-zinc-600 block mb-1">Valor</span>
                                    <span className="font-display font-bold text-primary">{formatPreco(servicoSelecionado?.preco || 0)}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-[0.5em] text-zinc-600 block mb-1">Data</span>
                                    <span className="font-modern">{formatDataExibicao(dataSelecionada)}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-[0.5em] text-zinc-600 block mb-1">Horário</span>
                                    <span className="font-modern">
                                        {disponibilidade[dataSelecionada]?.faixas?.find(f => f.id === faixaSelecionada)?.inicio} às{' '}
                                        {disponibilidade[dataSelecionada]?.faixas?.find(f => f.id === faixaSelecionada)?.fim}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold uppercase tracking-[0.5em] text-zinc-600 block mb-2">Observação (opcional)</label>
                                <input
                                    type="text"
                                    value={observacao}
                                    onChange={(e) => setObservacao(e.target.value)}
                                    className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white font-modern focus:border-primary focus:outline-none transition-colors"
                                    placeholder="Alguma preferência ou informação extra?"
                                />
                            </div>
                        </div>

                        <button
                            onClick={handleConfirmar}
                            className="w-full group relative overflow-hidden bg-primary text-black py-5 font-display font-bold uppercase tracking-[0.5em] text-xs hover:scale-[1.02] transition-transform"
                        >
                            <span className="relative z-10 group-hover:text-white transition-colors duration-500">Confirmar Agendamento</span>
                            <div className="absolute inset-0 bg-black translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                        </button>
                    </div>
                )}

                {/* Step 5: Concluído */}
                {step === 5 && (
                    <div className="text-center py-12">
                        <div className="w-16 h-16 bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-8">
                            <Check size={32} className="text-primary" />
                        </div>

                        <h2 className="font-display font-bold text-3xl uppercase tracking-tight mb-4">Solicitação Enviada!</h2>
                        <p className="text-zinc-400 font-modern mb-2">Sua solicitação foi registrada com sucesso.</p>
                        <p className="text-zinc-500 font-modern text-sm mb-4">
                            Status: <span className="text-yellow-400 font-bold">Aguardando confirmação do barbeiro</span>
                        </p>
                        <p className="text-zinc-600 font-modern text-xs mb-12 max-w-sm mx-auto">
                            Seu horário ainda <strong className="text-zinc-400">não está confirmado</strong>. O barbeiro irá analisar e confirmar (ou sugerir uma alternativa). Você será notificado pelo painel.
                        </p>

                        <div className="bg-zinc-900/80 border border-white/10 p-6 inline-block text-left mb-10">
                            <div className="grid grid-cols-2 gap-4 text-sm font-modern">
                                <div>
                                    <span className="text-zinc-600">Serviço:</span>
                                    <span className="block font-bold">{servicoSelecionado?.nome}</span>
                                </div>
                                <div>
                                    <span className="text-zinc-600">Data:</span>
                                    <span className="block font-bold">{formatDataExibicao(dataSelecionada)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <a
                                href={whatsappLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center gap-3 bg-[#25D366] text-white px-8 py-4 font-display font-bold uppercase text-xs tracking-[0.3em] hover:scale-[1.02] transition-transform"
                            >
                                <MessageCircle size={18} />
                                Falar no WhatsApp
                            </a>

                            <Link
                                to="/painel"
                                className="inline-flex items-center justify-center gap-2 border border-white/20 text-white px-8 py-4 font-display font-bold uppercase text-xs tracking-[0.3em] hover:border-primary transition-colors"
                            >
                                Meu Painel
                                <ArrowUpRight size={16} />
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
