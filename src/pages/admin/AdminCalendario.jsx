import { useState } from 'react';
import appointmentStore from '../../stores/appointmentStore';
import availabilityStore from '../../stores/availabilityStore';
import clientStore from '../../stores/clientStore';
import serviceStore from '../../stores/serviceStore';
import { STATUS, STATUS_CONFIG } from '../../data/models';
import { useStoreSync } from '../../hooks/useStore';
import {
    CalendarDays, ChevronLeft, ChevronRight, Clock, User,
    Lock, Unlock, Eye, Scissors
} from 'lucide-react';

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DIAS_SEMANA_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function pad(n) { return String(n).padStart(2, '0'); }
function toDateKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function formatDataCurta(d) { const [y, m, dd] = d.split('-'); return `${dd}/${m}`; }

export default function AdminCalendario() {
    const storeTick = useStoreSync();
    const [visao, setVisao] = useState('semana'); // 'dia' | 'semana'
    const [dataRef, setDataRef] = useState(new Date());

    const config = availabilityStore.getConfig();
    const disponibilidade = availabilityStore.getRange(60);
    const todosAgendamentos = appointmentStore.getAll();

    // ─── Navegação ───
    function navAnterior() {
        const d = new Date(dataRef);
        if (visao === 'dia') d.setDate(d.getDate() - 1);
        else d.setDate(d.getDate() - 7);
        setDataRef(d);
    }

    function navProximo() {
        const d = new Date(dataRef);
        if (visao === 'dia') d.setDate(d.getDate() + 1);
        else d.setDate(d.getDate() + 7);
        setDataRef(d);
    }

    function irHoje() { setDataRef(new Date()); }

    // ─── Gerar dias visíveis ───
    function getDiasVisiveis() {
        if (visao === 'dia') {
            return [new Date(dataRef)];
        }
        // semana (seg-sáb)
        const d = new Date(dataRef);
        const dow = d.getDay();
        const seg = new Date(d);
        seg.setDate(d.getDate() - ((dow + 6) % 7)); // segunda
        const dias = [];
        for (let i = 0; i < 7; i++) {
            const dd = new Date(seg);
            dd.setDate(seg.getDate() + i);
            dias.push(dd);
        }
        return dias;
    }

    // ─── Gerar slots de horário ───
    function getSlots() {
        const [hI] = config.horarioInicio.split(':').map(Number);
        const [hF] = config.horarioFim.split(':').map(Number);
        const slots = [];
        for (let h = hI; h < hF; h++) {
            slots.push(`${pad(h)}:00`);
            slots.push(`${pad(h)}:30`);
        }
        return slots;
    }

    // ─── Agendamentos por dia ───
    function getAgendamentosDia(dateKey) {
        return todosAgendamentos.filter(a =>
            a.data === dateKey &&
            a.status !== STATUS.CANCELADO_CLIENTE &&
            a.status !== STATUS.REJEITADO
        );
    }

    // Verificar se um slot está no horário de almoço
    function isAlmoco(slot) {
        const [aI] = config.intervaloAlmoco.inicio.split(':').map(Number);
        const [aF] = config.intervaloAlmoco.fim.split(':').map(Number);
        const [h] = slot.split(':').map(Number);
        return h >= aI && h < aF;
    }

    // Verificar se um slot tem agendamento
    function getAgendamentoSlot(dateKey, slot) {
        const ags = getAgendamentosDia(dateKey);
        return ags.find(a => a.faixaInicio === slot);
    }

    const diasVisiveis = getDiasVisiveis();
    const slots = getSlots();
    const hojeKey = toDateKey(new Date());

    // Título da navegação
    function getTitulo() {
        if (visao === 'dia') {
            const dk = toDateKey(dataRef);
            return `${DIAS_SEMANA_FULL[dataRef.getDay()]}, ${dataRef.getDate()} de ${MESES[dataRef.getMonth()]}`;
        }
        const primeiro = diasVisiveis[0];
        const ultimo = diasVisiveis[diasVisiveis.length - 1];
        if (primeiro.getMonth() === ultimo.getMonth()) {
            return `${primeiro.getDate()} — ${ultimo.getDate()} de ${MESES[primeiro.getMonth()]}`;
        }
        return `${primeiro.getDate()} ${MESES[primeiro.getMonth()].slice(0, 3)} — ${ultimo.getDate()} ${MESES[ultimo.getMonth()].slice(0, 3)}`;
    }

    return (
        <div className="p-6 lg:p-8">
            {/* Header */}
            <div className="mb-6">
                <span className="text-[10px] font-bold uppercase tracking-[1em] text-primary mb-2 block">Visão Temporal</span>
                <h1 className="font-display font-bold text-2xl md:text-3xl uppercase tracking-tight">Calendário</h1>
            </div>

            {/* Controls */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                {/* Nav */}
                <div className="flex items-center gap-3">
                    <button onClick={navAnterior} className="p-2 border border-white/10 hover:border-primary/30 transition-colors">
                        <ChevronLeft size={16} />
                    </button>
                    <h2 className="font-modern text-sm min-w-48 text-center">{getTitulo()}</h2>
                    <button onClick={navProximo} className="p-2 border border-white/10 hover:border-primary/30 transition-colors">
                        <ChevronRight size={16} />
                    </button>
                    <button onClick={irHoje} className="text-[10px] font-bold uppercase tracking-wider text-primary border border-primary/20 px-3 py-2 hover:bg-primary/5 transition-colors ml-2">
                        Hoje
                    </button>
                </div>

                {/* Visão toggle */}
                <div className="flex border border-white/10">
                    {[
                        { key: 'dia', label: 'Dia' },
                        { key: 'semana', label: 'Semana' },
                    ].map(v => (
                        <button
                            key={v.key}
                            onClick={() => setVisao(v.key)}
                            className={`px-4 py-2 text-xs font-display uppercase tracking-wider transition-colors ${visao === v.key ? 'bg-primary text-black' : 'text-zinc-500 hover:text-white'
                                }`}
                        >
                            {v.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Legenda */}
            <div className="flex items-center gap-5 mb-4 text-[10px] font-modern text-zinc-500">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-green-500/20 border border-green-500/30 inline-block" /> Livre</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-primary/20 border border-primary/30 inline-block" /> Agendado</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-yellow-500/20 border border-yellow-500/30 inline-block" /> Pendente</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-zinc-700 border border-zinc-600 inline-block" /> Almoço</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-red-500/10 border border-red-500/20 inline-block" /> Bloqueado</span>
            </div>

            {/* Grid do calendário */}
            <div className="overflow-x-auto">
                <div className={`grid min-w-[600px] ${visao === 'dia' ? 'grid-cols-[80px_1fr]' : 'grid-cols-[80px_repeat(7,1fr)]'}`}>
                    {/* Header das colunas */}
                    <div className="border-b border-white/10 p-2" /> {/* canto vazio */}
                    {diasVisiveis.map(dia => {
                        const dk = toDateKey(dia);
                        const isHoje = dk === hojeKey;
                        const disp = disponibilidade[dk];
                        const bloqueado = disp?.disponivel === false;
                        const numAg = getAgendamentosDia(dk).length;

                        return (
                            <div key={dk} className={`border-b border-l border-white/10 p-2 text-center ${isHoje ? 'bg-primary/5' : ''}`}>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
                                    {DIAS_SEMANA[dia.getDay()]}
                                </span>
                                <span className={`font-display font-bold text-lg ${isHoje ? 'text-primary' : 'text-white'}`}>
                                    {dia.getDate()}
                                </span>
                                {bloqueado ? (
                                    <span className="flex items-center justify-center gap-1 text-[9px] text-red-400 mt-0.5"><Lock size={8} /> Bloqueado</span>
                                ) : numAg > 0 ? (
                                    <span className="text-[9px] text-primary mt-0.5 block">{numAg} agend.</span>
                                ) : null}
                            </div>
                        );
                    })}

                    {/* Linhas de horário */}
                    {slots.map(slot => (
                        <>
                            {/* Label do horário */}
                            <div key={`label-${slot}`} className="border-b border-white/5 p-2 flex items-center justify-end pr-3">
                                <span className="text-[10px] font-mono text-zinc-600">{slot}</span>
                            </div>

                            {/* Células por dia */}
                            {diasVisiveis.map(dia => {
                                const dk = toDateKey(dia);
                                const almoco = isAlmoco(slot);
                                const disp = disponibilidade[dk];
                                const bloqueado = disp?.disponivel === false;
                                const ag = getAgendamentoSlot(dk, slot);
                                const isHoje = dk === hojeKey;

                                if (bloqueado) {
                                    return (
                                        <div key={`${dk}-${slot}`} className="border-b border-l border-white/5 p-1 bg-red-500/5">
                                            <div className="h-full flex items-center justify-center">
                                                <Lock size={10} className="text-red-400/30" />
                                            </div>
                                        </div>
                                    );
                                }

                                if (almoco) {
                                    return (
                                        <div key={`${dk}-${slot}`} className="border-b border-l border-white/5 p-1 bg-zinc-800/50">
                                            <div className="h-full flex items-center justify-center">
                                                <span className="text-[8px] text-zinc-600">almoço</span>
                                            </div>
                                        </div>
                                    );
                                }

                                if (ag) {
                                    const cliente = clientStore.getById(ag.clienteId);
                                    const sc = STATUS_CONFIG[ag.status];
                                    const isPendente = ag.status === STATUS.PENDENTE;

                                    return (
                                        <div key={`${dk}-${slot}`} className={`border-b border-l border-white/5 p-1 ${isPendente ? 'bg-yellow-500/10' : 'bg-primary/10'
                                            } ${isHoje ? 'bg-opacity-20' : ''}`}>
                                            <div className="p-1 h-full">
                                                <span className="text-[9px] font-bold text-white block truncate">
                                                    {cliente?.nome || 'Cliente'}
                                                </span>
                                                <span className="text-[8px] text-zinc-400 block truncate">{ag.servicoNome}</span>
                                                <span className={`text-[7px] font-bold uppercase ${sc?.cor || 'text-zinc-500'}`}>
                                                    {sc?.label || ag.status}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                }

                                return (
                                    <div key={`${dk}-${slot}`} className={`border-b border-l border-white/5 p-1 hover:bg-green-500/5 transition-colors ${isHoje ? 'bg-primary/[0.02]' : ''}`}>
                                        <div className="h-full min-h-[28px]" />
                                    </div>
                                );
                            })}
                        </>
                    ))}
                </div>
            </div>

            {/* Resumo do dia selecionado (visão diária) */}
            {visao === 'dia' && (
                <div className="mt-8">
                    <DailyDetail dateKey={toDateKey(dataRef)} agendamentos={getAgendamentosDia(toDateKey(dataRef))} disponibilidade={disponibilidade[toDateKey(dataRef)]} />
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════
// Detalhe do dia (visão diária)
// ═══════════════════════════════════════════════
function DailyDetail({ dateKey, agendamentos, disponibilidade }) {
    const bloqueado = disponibilidade?.disponivel === false;

    return (
        <div className="bg-zinc-900/40 border border-white/5 p-5">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                    <Eye size={16} className="text-primary" /> Detalhes do Dia — {formatDataCurta(dateKey)}
                </h3>
                {bloqueado && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-400/10 px-3 py-1">
                        <Lock size={10} /> {disponibilidade?.motivo || 'Bloqueado'}
                    </span>
                )}
            </div>

            {agendamentos.length === 0 ? (
                <p className="text-zinc-600 font-modern text-sm py-4 text-center">
                    {bloqueado ? 'Dia bloqueado — sem agendamentos.' : 'Nenhum agendamento para este dia.'}
                </p>
            ) : (
                <div className="space-y-2">
                    {agendamentos
                        .sort((a, b) => a.faixaInicio.localeCompare(b.faixaInicio))
                        .map(ag => {
                            const cliente = clientStore.getById(ag.clienteId);
                            const sc = STATUS_CONFIG[ag.status];
                            return (
                                <div key={ag.id} className="flex items-center gap-3 p-3 bg-black/30 border border-white/5">
                                    <span className="text-sm font-modern font-bold text-primary w-20 shrink-0">
                                        {ag.faixaInicio} — {ag.faixaFim}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <span className="text-sm font-modern block truncate">
                                            <User size={12} className="inline mr-1 text-zinc-500" />
                                            {cliente?.nome || 'Cliente'} {cliente?.sobrenome || ''}
                                        </span>
                                        <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                                            <Scissors size={10} /> {ag.servicoNome}
                                        </span>
                                    </div>
                                    <span className={`text-[9px] font-bold uppercase tracking-wider ${sc?.cor || 'text-zinc-500'} px-2 py-1 ${sc?.bg || 'bg-zinc-800'}`}>
                                        {sc?.label || ag.status}
                                    </span>
                                </div>
                            );
                        })}
                </div>
            )}
        </div>
    );
}
