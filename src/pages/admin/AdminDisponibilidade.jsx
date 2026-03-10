import { useState } from 'react';
import availabilityStore from '../../stores/availabilityStore';
import { useStoreSync } from '../../hooks/useStore';
import { Calendar, Lock, Unlock, ChevronLeft, ChevronRight, Settings, Save, Plus, Trash2 } from 'lucide-react';

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export default function AdminDisponibilidade() {
    const storeTick = useStoreSync(); // Reatividade automática quando localStorage muda
    const [mesAtual, setMesAtual] = useState(new Date());
    const [diaSel, setDiaSel] = useState(null);
    const [tab, setTab] = useState('calendario'); // calendario | config

    // Config state
    const [config, setConfig] = useState(() => availabilityStore.getConfig());
    const [feriaInicio, setFeriaInicio] = useState('');
    const [feriaFim, setFeriaFim] = useState('');
    const [bloqData, setBloqData] = useState('');
    const [bloqMotivo, setBloqMotivo] = useState('');

    // Leitura reativa: recalcula sempre que storeTick muda
    const disponibilidade = availabilityStore.getRange(60);

    function getDiasCalendario() {
        const ano = mesAtual.getFullYear();
        const mes = mesAtual.getMonth();
        const primeiroDia = new Date(ano, mes, 1).getDay();
        const totalDias = new Date(ano, mes + 1, 0).getDate();
        const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
        const dias = [];
        for (let i = 0; i < primeiroDia; i++) dias.push(null);
        for (let d = 1; d <= totalDias; d++) {
            const data = new Date(ano, mes, d);
            const chave = data.toISOString().split('T')[0];
            const info = disponibilidade[chave] || availabilityStore.getDay(chave);
            dias.push({ dia: d, data: chave, passado: data < hoje, disponivel: info?.disponivel, motivo: info?.motivo, faixas: info?.faixas || [] });
        }
        return dias;
    }

    function toggleDia(dateStr, atualDisponivel) {
        if (atualDisponivel) {
            availabilityStore.closeDay(dateStr, 'Fechado pelo admin');
        } else {
            availabilityStore.openDay(dateStr);
        }
    }

    function salvarConfig() {
        availabilityStore.saveConfig(config);
    }

    function addBloqueio() {
        if (!bloqData) return;
        availabilityStore.addBloqueioEspecial(bloqData, bloqMotivo || 'Bloqueado');
        setBloqData(''); setBloqMotivo('');
        setConfig(availabilityStore.getConfig());
    }

    function addFerias() {
        if (!feriaInicio || !feriaFim) return;
        availabilityStore.addFerias(feriaInicio, feriaFim);
        setFeriaInicio(''); setFeriaFim('');
        setConfig(availabilityStore.getConfig());
    }

    const dayInfo = diaSel ? (disponibilidade[diaSel] || availabilityStore.getDay(diaSel)) : null;

    return (
        <div className="p-6 md:p-10 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                <div>
                    <span className="text-[10px] font-bold uppercase tracking-[1em] text-primary mb-3 block">Gestão</span>
                    <h1 className="font-display font-bold text-3xl md:text-5xl uppercase tracking-tighter">Disponibilidade</h1>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-2 border-b border-white/10 mb-8">
                {[
                    { id: 'calendario', label: 'Agenda & Horários', icon: Calendar },
                    { id: 'config', label: 'Configurações de Regras', icon: Settings }
                ].map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        className={`px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] transition-colors border-b-2 font-display flex items-center gap-3 ${tab === t.id ? 'border-primary text-primary' : 'border-transparent text-zinc-500 hover:text-white'}`}>
                        <t.icon size={16} /> {t.label}
                    </button>
                ))}
            </div>

            {tab === 'calendario' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Calendar Grid */}
                    <div className="lg:col-span-2 bg-black border border-white/5 p-8">
                        <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-4">
                            <button onClick={() => setMesAtual(new Date(mesAtual.getFullYear(), mesAtual.getMonth() - 1))} className="text-zinc-500 hover:text-primary transition-colors p-2 -ml-2"><ChevronLeft size={24} /></button>
                            <span className="font-display font-bold uppercase tracking-widest text-lg">{MESES[mesAtual.getMonth()]} {mesAtual.getFullYear()}</span>
                            <button onClick={() => setMesAtual(new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1))} className="text-zinc-500 hover:text-primary transition-colors p-2 -mr-2"><ChevronRight size={24} /></button>
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                            {DIAS_SEMANA.map(d => (
                                <div key={d} className="text-center text-[10px] font-bold uppercase tracking-widest text-zinc-600 py-3">{d}</div>
                            ))}
                            {getDiasCalendario().map((item, i) => {
                                if (!item) return <div key={`e-${i}`} className="aspect-square" />;
                                const sel = item.data === diaSel;
                                return (
                                    <button key={item.data} onClick={() => setDiaSel(item.data)} disabled={item.passado}
                                        className={`aspect-square flex flex-col items-center justify-center text-sm font-modern transition-all relative border ${item.passado ? 'text-zinc-800 border-transparent cursor-not-allowed' :
                                            sel ? 'bg-primary text-black border-primary font-bold shadow-[0_0_20px_rgba(255,255,255,0.1)] z-10' :
                                                item.disponivel ? 'bg-white/[0.02] text-white hover:bg-white/[0.05] border-white/5 hover:border-white/20' :
                                                    'bg-red-500/5 text-red-500/50 border-red-500/10 hover:border-red-500/30'
                                            }`}>
                                        <span className={sel ? 'text-black' : ''}>{item.dia}</span>
                                        {!item.passado && !item.disponivel && <Lock size={10} className="mt-1 opacity-50" />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Day detail panel */}
                    <div className="bg-black border border-white/5 p-8 h-fit">
                        {diaSel ? (
                            <>
                                <h3 className="font-display font-bold text-xl uppercase tracking-tighter mb-2">{diaSel.split('-').reverse().join('/')}</h3>
                                <p className={`text-[10px] font-bold uppercase tracking-widest mb-8 flex items-center gap-2 ${dayInfo?.disponivel ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {dayInfo?.disponivel ? <><Unlock size={12} /> Aberto para Reservas</> : <><Lock size={12} /> Fechado — {dayInfo?.motivo || 'Motivo não especificado'}</>}
                                </p>
                                <button
                                    onClick={() => toggleDia(diaSel, dayInfo?.disponivel)}
                                    className={`w-full py-4 font-display font-bold uppercase text-xs tracking-[0.3em] mb-8 flex items-center justify-center gap-3 transition-colors ${dayInfo?.disponivel ? 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                                        }`}>
                                    {dayInfo?.disponivel ? <><Lock size={14} /> Fechar Dia</> : <><Unlock size={14} /> Abrir Dia</>}
                                </button>
                                {dayInfo?.disponivel && dayInfo?.faixas?.length > 0 && (
                                    <div>
                                        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Horários</span>
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">{dayInfo.faixas.filter(f => f.disponivel).length} de {dayInfo.faixas.length} Lívres</span>
                                        </div>
                                        <div className="space-y-1 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                                            {dayInfo.faixas.map(f => (
                                                <div key={f.id} className={`flex items-center justify-between py-3 px-4 transition-colors group ${f.disponivel ? 'bg-white/[0.02] border border-white/5 hover:border-white/20' : 'bg-red-500/5 text-zinc-600 line-through border border-red-500/10'}`}>
                                                    <span className={`text-[11px] font-modern uppercase tracking-widest font-bold ${f.disponivel ? 'text-white group-hover:text-primary transition-colors' : 'text-red-500/50'}`}>{f.inicio} — {f.fim}</span>
                                                    <button onClick={() => { f.disponivel ? availabilityStore.blockSlot(diaSel, f.id) : availabilityStore.unblockSlot(diaSel, f.id); }}
                                                        className={`transition-colors ${f.disponivel ? 'text-zinc-500 hover:text-red-400' : 'text-red-500/50 hover:text-emerald-400'}`}>
                                                        {f.disponivel ? <Lock size={12} /> : <Unlock size={12} />}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center text-center py-16 opacity-50">
                                <Calendar size={48} className="text-zinc-600 mb-6" strokeWidth={1} />
                                <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs">Selecione uma data no calendário<br />para gerenciar a agenda local.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {tab === 'config' && (
                <div className="max-w-2xl bg-black border border-white/5 p-8">
                    <div className="space-y-12">
                        {/* Dias e Horários de Operação */}
                        <section>
                            <h3 className="font-display font-bold text-lg uppercase tracking-widest border-b border-white/10 pb-4 mb-6">Dias de Funcionamento</h3>
                            <div className="flex gap-3 flex-wrap mb-8">
                                {DIAS_SEMANA.map((d, i) => (
                                    <button key={i} onClick={() => setConfig(c => ({ ...c, diasFuncionamento: c.diasFuncionamento.includes(i) ? c.diasFuncionamento.filter(x => x !== i) : [...c.diasFuncionamento, i] }))}
                                        className={`w-12 h-12 flex items-center justify-center text-[10px] font-bold uppercase tracking-widest transition-all ${config.diasFuncionamento.includes(i) ? 'bg-primary text-black shadow-[0_0_15px_rgba(255,255,255,0.1)]' : 'bg-white/[0.02] text-zinc-500 border border-white/10 hover:border-white/30 hover:text-white'}`}>
                                        {d}
                                    </button>
                                ))}
                            </div>

                            <h3 className="font-display font-bold text-lg uppercase tracking-widest border-b border-white/10 pb-4 mb-6">Expediente</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                <InputField label="Abertura" value={config.horarioInicio} onChange={v => setConfig(c => ({ ...c, horarioInicio: v }))} type="time" />
                                <InputField label="Fechamento" value={config.horarioFim} onChange={v => setConfig(c => ({ ...c, horarioFim: v }))} type="time" />
                                <InputField label="Pausa Início" value={config.intervaloAlmoco.inicio} onChange={v => setConfig(c => ({ ...c, intervaloAlmoco: { ...c.intervaloAlmoco, inicio: v } }))} type="time" />
                                <InputField label="Pausa Fim" value={config.intervaloAlmoco.fim} onChange={v => setConfig(c => ({ ...c, intervaloAlmoco: { ...c.intervaloAlmoco, fim: v } }))} type="time" />
                            </div>

                            <h3 className="font-display font-bold text-lg uppercase tracking-widest border-b border-white/10 pb-4 mb-6">Regras de Agendamento</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                <InputField label="Duração Media (min)" value={config.duracaoSlot} onChange={v => setConfig(c => ({ ...c, duracaoSlot: Number(v) }))} type="number" />
                                <InputField label="Limite Clientes/Dia" value={config.limiteClientesDia} onChange={v => setConfig(c => ({ ...c, limiteClientesDia: Number(v) }))} type="number" />
                            </div>

                            <button onClick={salvarConfig} className="w-full bg-primary text-black py-4 font-display font-bold uppercase text-xs tracking-[0.3em] flex items-center justify-center gap-3 hover:bg-white transition-colors">
                                <Save size={16} /> Salvar Regras Globais
                            </button>
                        </section>

                        {/* Bloqueios Especiais */}
                        <section className="pt-8 border-t border-white/5">
                            <h3 className="font-display font-bold text-lg uppercase tracking-widest mb-6">Bloqueios Furtivos</h3>
                            <p className="text-zinc-500 font-modern text-[11px] uppercase tracking-widest mb-6 leading-relaxed">Dias que devem ser removidos da disponibilidade pública sem impactar o expediente fixo. Ex: Feriados Nacionais, Manutenção.</p>

                            {config.bloqueiosEspeciais?.length > 0 && (
                                <div className="space-y-2 mb-6">
                                    {config.bloqueiosEspeciais.map(b => (
                                        <div key={b.data} className="flex items-center justify-between py-4 px-4 bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
                                            <span className="font-display font-bold text-white uppercase tracking-wider text-sm">{b.data.split('-').reverse().join('/')} <span className="text-zinc-500 text-xs ml-2">— {b.motivo}</span></span>
                                            <button onClick={() => { availabilityStore.removeBloqueioEspecial(b.data); setConfig(availabilityStore.getConfig()); }} className="text-red-500/50 hover:text-red-400 p-2"><Trash2 size={16} /></button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex flex-col md:flex-row gap-4">
                                <input type="date" value={bloqData} onChange={e => setBloqData(e.target.value)} className="bg-black border border-white/10 px-4 py-4 text-white font-modern focus:border-primary focus:outline-none flex-1 transition-colors" />
                                <input type="text" value={bloqMotivo} onChange={e => setBloqMotivo(e.target.value)} placeholder="Justificativa (OPCIONAL)" className="bg-black border border-white/10 px-4 py-4 text-white font-modern focus:border-primary focus:outline-none flex-[2] transition-colors" />
                                <button onClick={addBloqueio} className="bg-primary/10 text-primary px-8 font-bold hover:bg-primary/20 transition-colors flex items-center justify-center min-h-[50px]"><Plus size={16} /></button>
                            </div>
                        </section>

                        {/* Férias */}
                        <section className="pt-8 border-t border-white/5">
                            <h3 className="font-display font-bold text-lg uppercase tracking-widest mb-6">Recesso / Férias</h3>

                            {config.ferias?.length > 0 && (
                                <div className="space-y-2 mb-6">
                                    {config.ferias.map(f => (
                                        <div key={f.inicio} className="flex items-center justify-between py-4 px-4 bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
                                            <span className="font-display font-bold text-white uppercase tracking-wider text-sm">{f.inicio.split('-').reverse().join('/')} <span className="text-zinc-500">→</span> {f.fim.split('-').reverse().join('/')}</span>
                                            <button onClick={() => { availabilityStore.removeFerias(f.inicio); setConfig(availabilityStore.getConfig()); }} className="text-red-500/50 hover:text-red-400 p-2"><Trash2 size={16} /></button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex flex-col md:flex-row gap-4">
                                <input type="date" value={feriaInicio} onChange={e => setFeriaInicio(e.target.value)} className="bg-black border border-white/10 px-4 py-4 text-white font-modern focus:border-primary focus:outline-none flex-1 transition-colors" />
                                <input type="date" value={feriaFim} onChange={e => setFeriaFim(e.target.value)} className="bg-black border border-white/10 px-4 py-4 text-white font-modern focus:border-primary focus:outline-none flex-1 transition-colors" />
                                <button onClick={addFerias} className="bg-primary/10 text-primary px-8 font-bold hover:bg-primary/20 transition-colors flex items-center justify-center min-h-[50px]"><Plus size={16} /></button>
                            </div>
                        </section>
                    </div>
                </div>
            )}
        </div>
    );
}

function InputField({ label, value, onChange, type = 'text' }) {
    return (
        <div>
            <label className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 block mb-3">{label}</label>
            <input type={type} value={value} onChange={e => onChange(e.target.value)} className="w-full bg-black border border-white/10 px-4 py-4 text-white font-modern focus:border-primary focus:outline-none transition-colors 
            [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:opacity-50 [&::-webkit-calendar-picker-indicator]:hover:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer" />
        </div>
    );
}
