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
        <div className="p-6 lg:p-8">
            <div className="mb-6">
                <span className="text-[10px] font-bold uppercase tracking-[1em] text-primary mb-2 block">Gestão</span>
                <h1 className="font-display font-bold text-2xl uppercase tracking-tight">Disponibilidade</h1>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 border-b border-white/10 mb-6">
                {[{ id: 'calendario', label: 'Calendário', icon: Calendar }, { id: 'config', label: 'Configurações', icon: Settings }].map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        className={`pb-3 text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-colors ${tab === t.id ? 'border-primary text-primary' : 'border-transparent text-zinc-500 hover:text-white'}`}>
                        <t.icon size={14} /> {t.label}
                    </button>
                ))}
            </div>

            {tab === 'calendario' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <div className="flex items-center justify-between mb-4">
                            <button onClick={() => setMesAtual(new Date(mesAtual.getFullYear(), mesAtual.getMonth() - 1))} className="text-zinc-500 hover:text-primary"><ChevronLeft size={20} /></button>
                            <span className="font-display font-bold uppercase tracking-wide">{MESES[mesAtual.getMonth()]} {mesAtual.getFullYear()}</span>
                            <button onClick={() => setMesAtual(new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1))} className="text-zinc-500 hover:text-primary"><ChevronRight size={20} /></button>
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                            {DIAS_SEMANA.map(d => (
                                <div key={d} className="text-center text-[10px] font-bold uppercase tracking-wider text-zinc-600 py-2">{d}</div>
                            ))}
                            {getDiasCalendario().map((item, i) => {
                                if (!item) return <div key={`e-${i}`} />;
                                const sel = item.data === diaSel;
                                return (
                                    <button key={item.data} onClick={() => setDiaSel(item.data)} disabled={item.passado}
                                        className={`aspect-square flex flex-col items-center justify-center text-sm font-modern transition-all relative ${item.passado ? 'text-zinc-800 cursor-not-allowed' :
                                            sel ? 'bg-primary text-black font-bold' :
                                                item.disponivel ? 'bg-green-500/10 text-green-300 hover:bg-green-500/20 border border-green-500/20' :
                                                    'bg-red-500/5 text-red-400/50 border border-red-500/10'
                                            }`}>
                                        {item.dia}
                                        {!item.passado && !item.disponivel && <Lock size={8} className="mt-0.5" />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Day detail panel */}
                    <div className="bg-zinc-900/40 border border-white/5 p-5">
                        {diaSel ? (
                            <>
                                <h3 className="font-display font-bold text-sm uppercase tracking-wider mb-3">{diaSel}</h3>
                                <p className={`text-sm font-modern mb-3 ${dayInfo?.disponivel ? 'text-green-400' : 'text-red-400'}`}>
                                    {dayInfo?.disponivel ? 'Aberto' : `Fechado — ${dayInfo?.motivo || ''}`}
                                </p>
                                <button
                                    onClick={() => toggleDia(diaSel, dayInfo?.disponivel)}
                                    className={`w-full py-2.5 font-display font-bold uppercase text-xs tracking-[0.3em] mb-4 flex items-center justify-center gap-2 ${dayInfo?.disponivel ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'
                                        }`}>
                                    {dayInfo?.disponivel ? <><Lock size={14} /> Fechar Dia</> : <><Unlock size={14} /> Abrir Dia</>}
                                </button>
                                {dayInfo?.disponivel && dayInfo?.faixas?.length > 0 && (
                                    <div>
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 mb-2 block">Faixas ({dayInfo.faixas.filter(f => f.disponivel).length}/{dayInfo.faixas.length})</span>
                                        <div className="space-y-1 max-h-48 overflow-y-auto">
                                            {dayInfo.faixas.map(f => (
                                                <div key={f.id} className={`flex items-center justify-between py-1.5 px-2 text-[11px] font-modern ${f.disponivel ? 'text-green-300 bg-green-500/5' : 'text-zinc-600 line-through bg-zinc-900/50'}`}>
                                                    <span>{f.inicio} — {f.fim}</span>
                                                    <button onClick={() => { f.disponivel ? availabilityStore.blockSlot(diaSel, f.id) : availabilityStore.unblockSlot(diaSel, f.id); }}
                                                        className="text-zinc-500 hover:text-primary">
                                                        {f.disponivel ? <Lock size={10} /> : <Unlock size={10} />}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <p className="text-zinc-600 font-modern text-sm py-8 text-center">Selecione um dia para gerenciar.</p>
                        )}
                    </div>
                </div>
            )}

            {tab === 'config' && (
                <div className="max-w-xl space-y-6">
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-[0.4em] text-zinc-500 block mb-2">Dias de Funcionamento</label>
                        <div className="flex gap-2 flex-wrap">
                            {DIAS_SEMANA.map((d, i) => (
                                <button key={i} onClick={() => setConfig(c => ({ ...c, diasFuncionamento: c.diasFuncionamento.includes(i) ? c.diasFuncionamento.filter(x => x !== i) : [...c.diasFuncionamento, i] }))}
                                    className={`w-10 h-10 text-[10px] font-bold transition-colors ${config.diasFuncionamento.includes(i) ? 'bg-primary text-black' : 'bg-zinc-900 text-zinc-600 border border-white/10'}`}>
                                    {d}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <InputField label="Horário Início" value={config.horarioInicio} onChange={v => setConfig(c => ({ ...c, horarioInicio: v }))} type="time" />
                        <InputField label="Horário Fim" value={config.horarioFim} onChange={v => setConfig(c => ({ ...c, horarioFim: v }))} type="time" />
                        <InputField label="Almoço Início" value={config.intervaloAlmoco.inicio} onChange={v => setConfig(c => ({ ...c, intervaloAlmoco: { ...c.intervaloAlmoco, inicio: v } }))} type="time" />
                        <InputField label="Almoço Fim" value={config.intervaloAlmoco.fim} onChange={v => setConfig(c => ({ ...c, intervaloAlmoco: { ...c.intervaloAlmoco, fim: v } }))} type="time" />
                        <InputField label="Duração Slot (min)" value={config.duracaoSlot} onChange={v => setConfig(c => ({ ...c, duracaoSlot: Number(v) }))} type="number" />
                        <InputField label="Máx Clientes/Dia" value={config.limiteClientesDia} onChange={v => setConfig(c => ({ ...c, limiteClientesDia: Number(v) }))} type="number" />
                    </div>
                    <button onClick={salvarConfig} className="bg-primary text-black px-8 py-3 font-display font-bold uppercase text-xs tracking-[0.3em] flex items-center gap-2"><Save size={14} /> Salvar Configuração</button>

                    {/* Bloqueios */}
                    <div className="border-t border-white/10 pt-6">
                        <h3 className="font-display font-bold text-sm uppercase tracking-wider mb-3">Bloqueios Especiais</h3>
                        {(config.bloqueiosEspeciais || []).map(b => (
                            <div key={b.data} className="flex items-center justify-between py-2 border-b border-white/5 text-sm font-modern">
                                <span>{b.data} — {b.motivo}</span>
                                <button onClick={() => { availabilityStore.removeBloqueioEspecial(b.data); setConfig(availabilityStore.getConfig()); }} className="text-red-400 hover:text-red-300"><Trash2 size={14} /></button>
                            </div>
                        ))}
                        <div className="flex gap-2 mt-2">
                            <input type="date" value={bloqData} onChange={e => setBloqData(e.target.value)} className="bg-black/50 border border-white/10 px-3 py-2 text-sm text-white font-modern focus:border-primary focus:outline-none flex-1" />
                            <input type="text" value={bloqMotivo} onChange={e => setBloqMotivo(e.target.value)} placeholder="Motivo" className="bg-black/50 border border-white/10 px-3 py-2 text-sm text-white font-modern focus:border-primary focus:outline-none flex-1" />
                            <button onClick={addBloqueio} className="bg-primary/10 text-primary px-3 py-2 text-xs font-bold"><Plus size={14} /></button>
                        </div>
                    </div>

                    {/* Férias */}
                    <div className="border-t border-white/10 pt-6">
                        <h3 className="font-display font-bold text-sm uppercase tracking-wider mb-3">Férias</h3>
                        {(config.ferias || []).map(f => (
                            <div key={f.inicio} className="flex items-center justify-between py-2 border-b border-white/5 text-sm font-modern">
                                <span>{f.inicio} até {f.fim}</span>
                                <button onClick={() => { availabilityStore.removeFerias(f.inicio); setConfig(availabilityStore.getConfig()); }} className="text-red-400 hover:text-red-300"><Trash2 size={14} /></button>
                            </div>
                        ))}
                        <div className="flex gap-2 mt-2">
                            <input type="date" value={feriaInicio} onChange={e => setFeriaInicio(e.target.value)} className="bg-black/50 border border-white/10 px-3 py-2 text-sm text-white font-modern focus:border-primary focus:outline-none flex-1" />
                            <input type="date" value={feriaFim} onChange={e => setFeriaFim(e.target.value)} className="bg-black/50 border border-white/10 px-3 py-2 text-sm text-white font-modern focus:border-primary focus:outline-none flex-1" />
                            <button onClick={addFerias} className="bg-primary/10 text-primary px-3 py-2 text-xs font-bold"><Plus size={14} /></button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function InputField({ label, value, onChange, type = 'text' }) {
    return (
        <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.4em] text-zinc-500 block mb-1">{label}</label>
            <input type={type} value={value} onChange={e => onChange(e.target.value)} className="w-full bg-black/50 border border-white/10 px-3 py-2.5 text-sm text-white font-modern focus:border-primary focus:outline-none" />
        </div>
    );
}
