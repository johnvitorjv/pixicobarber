import { useState } from 'react';
import appointmentStore from '../../stores/appointmentStore';
import availabilityStore from '../../stores/availabilityStore';
import clientStore from '../../stores/clientStore';
import serviceStore from '../../stores/serviceStore';
import { STATUS, STATUS_CONFIG } from '../../data/models';
import { isSupabaseConfigured } from '../../lib/supabase';
import { useSupabaseAppointments } from '../../hooks/useSupabase';
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
    const [visao, setVisao] = useState('semana');
    const [dataRef, setDataRef] = useState(new Date());

    const sb = isSupabaseConfigured();
    const { appointments: sbApps } = useSupabaseAppointments();

    const config = availabilityStore.getConfig();
    const disponibilidade = availabilityStore.getRange(60);
    const todosAgendamentos = sb ? sbApps : appointmentStore.getAll();

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

    // ─── Agendamentos por dia (com normalização de data) ───
    function getAgendamentosDia(dateKey) {
        return todosAgendamentos.filter(a => {
            // Normalizar: Supabase pode retornar 'YYYY-MM-DD' ou 'YYYY-MM-DDT...' 
            const agData = (a.data || '').slice(0, 10);
            return (
                agData === dateKey &&
                a.status !== STATUS.CANCELADO_CLIENTE &&
                a.status !== STATUS.REJEITADO
            );
        });
    }

    // Verificar se um slot está no horário de almoço
    function isAlmoco(slot) {
        const [aI] = config.intervaloAlmoco.inicio.split(':').map(Number);
        const [aF] = config.intervaloAlmoco.fim.split(':').map(Number);
        const [h] = slot.split(':').map(Number);
        return h >= aI && h < aF;
    }

    // Verificar se um slot tem agendamento (cobre range temporal inteiro)
    function getAgendamentoSlot(dateKey, slot) {
        const ags = getAgendamentosDia(dateKey);
        const slotMin = timeToMinutes(slot);
        return ags.find(a => {
            const iniMin = timeToMinutes(a.faixaInicio);
            const fimMin = timeToMinutes(a.faixaFim);
            // O slot está DENTRO do range do agendamento
            return slotMin >= iniMin && slotMin < fimMin;
        });
    }

    function timeToMinutes(t) {
        if (!t) return 0;
        const [h, m] = t.split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
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
        <div className="p-6 md:p-10 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="mb-12">
                <span className="text-[10px] font-bold uppercase tracking-[1em] text-primary mb-3 block">Timeline</span>
                <h1 className="font-display font-bold text-3xl md:text-5xl uppercase tracking-tighter">Calendário</h1>
            </div>

            {/* Controls */}
            <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 mb-10">
                {/* Nav */}
                <div className="flex items-center gap-4">
                    <button onClick={navAnterior} className="p-3 border border-white/10 hover:border-primary/50 text-zinc-400 hover:text-white transition-all bg-black">
                        <ChevronLeft size={16} />
                    </button>
                    <div className="flex flex-col items-center justify-center min-w-[200px]">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Período</span>
                        <h2 className="font-modern text-lg text-white">{getTitulo()}</h2>
                    </div>
                    <button onClick={navProximo} className="p-3 border border-white/10 hover:border-primary/50 text-zinc-400 hover:text-white transition-all bg-black">
                        <ChevronRight size={16} />
                    </button>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto">
                    <button onClick={irHoje} className="px-6 py-3 border border-white/10 hover:border-primary/30 text-[10px] font-bold uppercase tracking-widest text-white hover:text-primary transition-all flex-1 md:flex-none text-center bg-black">
                        Mover p/ Hoje
                    </button>

                    {/* Visão toggle */}
                    <div className="flex border border-white/10 p-1 bg-black w-full md:w-auto">
                        {[
                            { key: 'dia', label: 'Dia' },
                            { key: 'semana', label: 'Semana' },
                        ].map(v => (
                            <button
                                key={v.key}
                                onClick={() => setVisao(v.key)}
                                className={`flex-1 md:flex-none px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all ${visao === v.key ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                {v.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Legenda */}
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3 mb-8 text-[9px] font-bold uppercase tracking-widest text-zinc-500 border-b border-white/5 pb-6">
                <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-green-500/50 shadow-[0_0_8px_rgba(34,197,94,0.5)]" /> Livre</span>
                <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary/80 shadow-[0_0_8px_rgba(212,175,55,0.4)]" /> Agendado</span>
                <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-yellow-500/50" /> Pendente</span>
                <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-zinc-600" /> Almoço</span>
                <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-red-500/50" /> Bloqueado</span>
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
                            <div key={dk} className={`border-b border-l border-white/5 p-4 text-center ${isHoje ? 'bg-primary/5' : 'bg-black'} transition-colors`}>
                                <span className={`text-[10px] font-bold uppercase tracking-widest block mb-1 ${isHoje ? 'text-primary' : 'text-zinc-500'}`}>
                                    {DIAS_SEMANA[dia.getDay()]}
                                </span>
                                <span className={`font-display font-bold text-2xl ${isHoje ? 'text-primary' : 'text-white'}`}>
                                    {dia.getDate()}
                                </span>
                                {bloqueado ? (
                                    <span className="flex items-center justify-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-red-400 mt-2 bg-red-500/10 py-1 rounded-sm"><Lock size={8} /> Box Fechado</span>
                                ) : numAg > 0 ? (
                                    <span className="text-[9px] font-bold uppercase tracking-widest text-primary mt-2 block bg-primary/10 py-1 rounded-sm">{numAg} agend.</span>
                                ) : <div className="h-6 mt-2" />}
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
                                                <Lock size={12} className="text-red-400/20" />
                                            </div>
                                        </div>
                                    );
                                }

                                if (almoco) {
                                    return (
                                        <div key={`${dk}-${slot}`} className="border-b border-l border-white/5 p-1 bg-[#111]">
                                            <div className="h-full flex items-center justify-center">
                                                <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-700">almoço</span>
                                            </div>
                                        </div>
                                    );
                                }

                                if (ag) {
                                    const nomeCliente = sb ? (ag._clienteNome || 'Cliente') : (clientStore.getById(ag.clienteId)?.nome || 'Cliente');
                                    const sc = STATUS_CONFIG[ag.status];
                                    const isPendente = ag.status === STATUS.PENDENTE;

                                    return (
                                        <div key={`${dk}-${slot}`} className={`border-b border-l ${isPendente ? 'border-yellow-500/30 bg-yellow-500/10' : 'border-primary/30 bg-primary/10'
                                            } ${isHoje ? 'bg-opacity-20' : ''} p-1 transition-all hover:brightness-110 cursor-pointer`}>
                                            <div className="p-2 h-full flex flex-col justify-center">
                                                <span className="text-[10px] font-bold text-white block truncate mb-0.5">
                                                    {nomeCliente}
                                                </span>
                                                <span className="text-[9px] font-modern text-zinc-400 block truncate mb-1">{ag.servicoNome}</span>
                                                <span className={`text-[8px] font-bold uppercase tracking-widest mt-auto ${sc?.cor || 'text-zinc-500'}`}>
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
        <div className="bg-black border border-white/5 p-6 md:p-8">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
                <h3 className="font-display font-bold text-lg uppercase tracking-widest flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <CalendarDays size={14} className="text-primary" />
                    </div>
                    {formatDataCurta(dateKey)}
                </h3>
                {bloqueado && (
                    <span className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-red-400 bg-red-500/10 px-4 py-2 border border-red-500/20">
                        <Lock size={12} /> {disponibilidade?.motivo || 'Bloqueado'}
                    </span>
                )}
            </div>

            {agendamentos.length === 0 ? (
                <div className="py-12 text-center border border-white/5 bg-white/[0.02]">
                    <p className="text-zinc-500 font-modern text-sm uppercase tracking-widest">
                        {bloqueado ? 'Dia bloqueado — sem agendamentos.' : 'Nenhum agendamento para este dia.'}
                    </p>
                </div>
            ) : (
                <div className="grid gap-3">
                    {agendamentos
                        .sort((a, b) => a.faixaInicio.localeCompare(b.faixaInicio))
                        .map(ag => {
                            const nomeCliente = sb ? (ag._clienteNome || 'Cliente') : (clientStore.getById(ag.clienteId)?.nome || 'Cliente');
                            const sobrenomeCliente = sb ? (ag._clienteSobrenome || '') : (clientStore.getById(ag.clienteId)?.sobrenome || '');
                            const sc = STATUS_CONFIG[ag.status];
                            return (
                                <div key={ag.id} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 md:p-5 bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors group">
                                    <span className="text-lg font-display font-bold text-primary w-32 shrink-0 tabular-nums">
                                        {ag.faixaInicio} <span className="text-zinc-600 font-normal mx-1">—</span> {ag.faixaFim}
                                    </span>
                                    <div className="flex-1 min-w-0 flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center shrink-0 group-hover:border-primary/30 transition-colors">
                                            <User size={16} className="text-zinc-500 group-hover:text-primary transition-colors" />
                                        </div>
                                        <div>
                                            <span className="text-base font-bold tracking-wide block truncate mb-0.5">
                                                {nomeCliente} {sobrenomeCliente}
                                            </span>
                                            <span className="text-xs font-modern text-zinc-500 flex items-center gap-1.5">
                                                <Scissors size={12} className="text-zinc-600" /> {ag.servicoNome}
                                            </span>
                                        </div>
                                    </div>
                                    <span className={`text-[10px] font-bold uppercase tracking-widest ${sc?.cor || 'text-zinc-500'} px-3 py-1.5 ${sc?.bg || 'bg-zinc-800'} mt-2 sm:mt-0 self-start sm:self-auto`}>
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
