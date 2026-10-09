import { useCallback, useEffect, useRef, useState } from 'react';
import CalendarPicker from './CalendarPicker';
import { requireSupabase } from '../lib/supabase';
import { bahiaDate } from '../lib/bookingRules';
import { addCalendarDays } from '../lib/bookingWindow';
import { mutationMessage } from '../lib/bookingRules';

// Shared by the customer edit form and the barber's rescheduling proposal.
// Every green date and selectable time is checked by the production database.
// UI state is advisory: PostgreSQL rechecks each reservation during its transaction.
export default function AvailabilityCalendar({
    mode, appointmentId, serviceId, date, onDateChange, start, onSlotChange,
    maxDate, minDate = addCalendarDays(bahiaDate(), 1), compact = false
}) {
    const [month, setMonth] = useState(() => (date || minDate).slice(0, 7) + '-01');
    const [availableDays, setAvailableDays] = useState({});
    const [loadingDays, setLoadingDays] = useState(true);
    const [slots, setSlots] = useState([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [error, setError] = useState('');
    const [refreshIndex, setRefreshIndex] = useState(0);
    const selection = useRef({ start, onSlotChange });
    useEffect(() => { selection.current = { start, onSlotChange }; }, [start, onSlotChange]);
    const refresh = useCallback(() => setRefreshIndex(x => x + 1), []);

    useEffect(() => {
        if (!serviceId && mode !== 'suggestion') return;
        let active = true;
        queueMicrotask(() => { if (active) { setLoadingDays(true); setError(''); } });
        requireSupabase().rpc('get_month_availability', {
            p_month: month, p_mode: mode, p_service: mode === 'suggestion' ? null : serviceId,
            p_appointment: mode === 'booking' ? null : appointmentId,
        }).then(({ data, error: rpcError }) => {
            if (!active) return;
            setAvailableDays(rpcError ? {} : Object.fromEntries((data || []).map(x => [x.day, x.available])));
            setLoadingDays(false);
            if (rpcError) setError(mutationMessage(rpcError));
        }).catch(err => { if (active) { setAvailableDays({}); setLoadingDays(false); setError(mutationMessage(err)); } });
        return () => { active = false; };
    }, [mode, appointmentId, serviceId, month, refreshIndex]);

    useEffect(() => {
        if (!date || (!serviceId && mode !== 'suggestion') || date < minDate || (maxDate && date > maxDate)) {
            queueMicrotask(() => { setSlots([]); setLoadingSlots(false); });
            return undefined;
        }
        let active = true;
        queueMicrotask(() => { if (active) { setSlots([]); setLoadingSlots(true); } });
        const name = mode === 'suggestion' ? 'get_suggestion_slots' : mode === 'edit' ? 'get_edit_slots' : 'get_available_slots';
        const params = mode === 'suggestion' ? { p_appointment: appointmentId, p_date: date }
            : mode === 'edit' ? { p_appointment: appointmentId, p_date: date, p_service: serviceId }
                : { p_date: date, p_service: serviceId };
        requireSupabase().rpc(name, params).then(({ data, error: rpcError }) => {
            if (!active) return;
            const available = rpcError ? [] : (data || []).filter(s => s.disponivel);
            setSlots(available);
            setLoadingSlots(false);
            if (rpcError) setError(mutationMessage(rpcError));
            if (selection.current.start && !available.some(s => s.inicio === selection.current.start)) selection.current.onSlotChange(null);
        }).catch(err => { if (active) { setSlots([]); setLoadingSlots(false); setError(mutationMessage(err)); } });
        return () => { active = false; };
    }, [date, mode, appointmentId, serviceId, minDate, maxDate, refreshIndex]);

    useEffect(() => {
        const interval = setInterval(refresh, 30000);
        const focus = () => refresh();
        window.addEventListener('focus', focus);
        return () => { clearInterval(interval); window.removeEventListener('focus', focus); };
    }, [refresh]);

    const chooseDate = next => { onSlotChange(null); onDateChange(next); setError(''); };
    const shownMonth = next => setMonth(next);
    return <div className="space-y-4" data-availability-calendar={mode}>
        <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-zinc-400">1. Escolha um dia disponível</p>
            <button type="button" onClick={refresh} className="text-primary text-xs hover:underline">Atualizar vagas</button>
        </div>
        <CalendarPicker value={date} onChange={chooseDate} minDate={minDate} maxDate={maxDate} compact={compact}
            label="Calendário de horários disponíveis"
            onMonthChange={shownMonth}
            isAvailable={day => {
                if (loadingDays) return false;
                return availableDays[day] === true;
            }}
        />
        {loadingDays && <p role="status" className="text-zinc-400 text-xs">Conferindo os dias disponíveis com a agenda...</p>}
        {error && <div role="alert" className="p-3 border border-red-500/30 text-red-300 text-xs">{error}</div>}
        {date && <>
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-zinc-400">2. Escolha o horário de {date.split('-').reverse().join('/')}</p>
            {loadingSlots ? <p role="status" className="text-zinc-400 text-sm py-3">Atualizando horários livres...</p> :
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto" data-available-slots>
                    {slots.map(slot => <button type="button" key={slot.inicio}
                        aria-label={`Horário ${slot.inicio} às ${slot.fim || 'a confirmar'}`}
                        aria-pressed={start === slot.inicio}
                        onClick={() => onSlotChange(slot)}
                        className={`px-3 py-3 border text-xs font-bold tabular-nums transition-colors ${start === slot.inicio ? 'bg-primary text-black border-primary' : 'bg-white/[0.02] border-white/15 hover:border-primary/60 text-white'}`}>
                        {slot.inicio} <span className="opacity-40 mx-1">—</span> {slot.fim || 'a confirmar'}
                    </button>)}
                    {!slots.length && <p className="col-span-full text-zinc-400 text-xs py-3">Os horários foram ocupados. Escolha outro dia.</p>}
                </div>}
        </>}
        <p className="text-[11px] text-zinc-500">As vagas são atualizadas automaticamente. A disponibilidade é conferida novamente ao confirmar para evitar horários duplicados.</p>
    </div>;
}
