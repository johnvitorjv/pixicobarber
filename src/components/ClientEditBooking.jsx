import { useMemo, useState } from 'react';
import { requireSupabase } from '../lib/supabase';
import { bahiaDate, mutationMessage, serviceDurationLabel } from '../lib/bookingRules';
import { addCalendarDays, bookingWindow } from '../lib/bookingWindow';
import { useSupabaseServices } from '../hooks/useSupabase';
import AvailabilityCalendar from './AvailabilityCalendar';

const inputClass = 'w-full min-w-0 bg-black border border-white/15 px-4 py-3 text-white text-sm focus:border-primary focus:outline-none';

export default function ClientEditBooking({ appointment, user, onClose, onSaved }) {
    const today = bahiaDate();
    const windowLimit = bookingWindow(user, today);
    const minDate = addCalendarDays(today, 1);
    const maxDate = windowLimit.unrestricted ? addCalendarDays(today, 59) : windowLimit.end;
    const [date, setDate] = useState(appointment.data >= minDate && appointment.data <= maxDate ? appointment.data : '');
    const [serviceId, setServiceId] = useState(appointment.servicoId);
    const [slot, setSlot] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const { services, loading: loadingServices, error: serviceError } = useSupabaseServices();
    const availableServices = useMemo(() => services.filter(s => s.status === 'ativo' && s.visivelAgendamento && !s.confirmacaoManual), [services]);
    const selectedService = availableServices.find(s => s.id === serviceId);

    async function save() {
        if (!slot?.inicio || !date || !selectedService || saving) { setError('Escolha um dia e horário disponíveis.'); return; }
        setSaving(true);
        setError('');
        try {
            // The database performs the final availability check and atomic swap.
            const { error: rpcError } = await requireSupabase().rpc('client_change_appointment', {
                p_appointment: appointment.id, p_service: serviceId, p_date: date, p_start: slot.inicio,
            });
            if (rpcError) throw rpcError;
            await onSaved();
        } catch (err) {
            setError(mutationMessage(err));
            setSlot(null);
        } finally { setSaving(false); }
    }

    return <div className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-xl flex items-center justify-center p-3 sm:p-5">
        <section role="dialog" aria-modal="true" aria-label="Alterar agendamento" className="bg-[#101010] border border-white/15 p-4 sm:p-7 max-w-2xl w-full max-h-[95dvh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                    <p className="text-primary uppercase text-[10px] tracking-[.25em] mb-2">Meu agendamento</p>
                    <h2 className="text-white font-display text-xl sm:text-2xl font-bold uppercase">Escolha um novo horário</h2>
                </div>
                <button type="button" onClick={onClose} className="text-zinc-400 text-xl p-2" aria-label="Fechar">×</button>
            </div>
            <p className="text-sm text-zinc-400 mb-5">Você pode alterar até o dia anterior. Escolha o serviço, um dia verde e um horário livre; a nova solicitação precisará ser aprovada.</p>
            {error && <div role="alert" className="mb-5 text-red-300 border border-red-500/20 p-3 text-sm">{error}</div>}
            {serviceError && <p role="alert" className="text-red-400 text-sm mb-4">{serviceError}</p>}
            <label className="block mb-5">
                <span className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">Serviço</span>
                <select value={serviceId} onChange={e => { setServiceId(e.target.value); setSlot(null); }} className={inputClass}>
                    {availableServices.map(s => <option key={s.id} value={s.id}>{s.nome} — {serviceDurationLabel(s)}</option>)}
                </select>
            </label>
            {loadingServices ? <p className="text-sm text-zinc-400 py-4">Consultando serviços...</p> :
                <AvailabilityCalendar mode="edit" appointmentId={appointment.id} serviceId={serviceId}
                    date={date} onDateChange={setDate} start={slot?.inicio || ''} onSlotChange={setSlot}
                    minDate={minDate} maxDate={maxDate} compact />}
            <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <button type="button" onClick={onClose} className="flex-1 border border-white/15 px-5 py-3 text-zinc-300 text-xs uppercase tracking-widest">Voltar</button>
                <button type="button" disabled={!slot || saving || !selectedService} onClick={save}
                    className="flex-1 bg-primary px-5 py-3 text-black font-bold text-xs uppercase tracking-widest disabled:opacity-40">
                    {saving ? 'Conferindo e salvando...' : 'Solicitar alteração'}
                </button>
            </div>
        </section>
    </div>;
}
