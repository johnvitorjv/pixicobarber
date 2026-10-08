import { useEffect, useMemo, useState } from 'react';
import { requireSupabase } from '../lib/supabase';
import { bahiaDate, serviceDurationLabel } from '../lib/bookingRules';
import { addCalendarDays, bookingWindow } from '../lib/bookingWindow';
import { useSupabaseServices } from '../hooks/useSupabase';
import { mutationMessage } from '../lib/bookingRules';

const inputClass = 'w-full min-w-0 bg-black border border-white/15 px-4 py-3 text-white text-sm focus:border-primary focus:outline-none';

export default function ClientEditBooking({ appointment, user, onClose, onSaved }) {
    const today = bahiaDate();
    const window = bookingWindow(user, today);
    const appointmentId = appointment.id;
    const unlimited = window.unrestricted;
    const limitEnd = window.end;
    const [date, setDate] = useState(appointment.data <= today ? addCalendarDays(today, 1) : appointment.data);
    const [serviceId, setServiceId] = useState(appointment.servicoId);
    const [slots, setSlots] = useState([]);
    const [start, setStart] = useState('');
    const [loadingSlots, setLoadingSlots] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const { services, loading: loadingServices, error: serviceError } = useSupabaseServices();
    const availableServices = useMemo(
        () => services.filter(s => s.status === 'ativo' && s.visivelAgendamento && !s.confirmacaoManual),
        [services]
    );
    const selectedService = availableServices.find(s => s.id === serviceId);

    useEffect(() => {
        let active = true;
        const load = async () => {
            if (!date || !serviceId || date <= bahiaDate() || (!unlimited && date > limitEnd)) {
                if (active) { setSlots([]); setLoadingSlots(false); }
                return;
            }
            if (active) { setLoadingSlots(true); setError(''); }
            const { data, error: requestError } = await requireSupabase().rpc('get_edit_slots', {
                p_appointment: appointmentId, p_date: date, p_service: serviceId
            });
            if (!active) return;
            setSlots(requestError ? [] : (data || []));
            setLoadingSlots(false);
            if (requestError) setError(mutationMessage(requestError));
        };
        queueMicrotask(() => { if (active) void load(); });
        const timer = setInterval(() => { if (active) void load(); }, 30000);
        return () => { active = false; clearInterval(timer); };
    }, [date, serviceId, appointmentId, unlimited, limitEnd]);

    async function save() {
        const selected = slots.find(s => s.inicio === start && s.disponivel);
        if (!selected) { setError('Escolha um horário disponível.'); return; }
        setSaving(true); setError('');
        try {
            const { error: rpcError } = await requireSupabase().rpc('client_change_appointment', {
                p_appointment: appointment.id,
                p_service: serviceId,
                p_date: date,
                p_start: selected.inicio,
            });
            if (rpcError) throw rpcError;
            await onSaved();
        } catch (err) {
            setError(mutationMessage(err));
            setStart('');
        } finally { setSaving(false); }
    }

    return (
        <div className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto">
            <section role="dialog" aria-modal="true" aria-label="Alterar agendamento" className="bg-[#101010] border border-white/15 p-6 md:p-9 max-w-xl w-full max-h-[90dvh] overflow-y-auto">
                <div className="flex items-start justify-between gap-5 mb-6">
                    <div>
                        <p className="text-primary uppercase text-[10px] tracking-[0.25em] mb-2">Meu agendamento</p>
                        <h2 className="text-white font-display text-2xl font-bold uppercase">Alterar serviço ou horário</h2>
                    </div>
                    <button onClick={onClose} className="text-zinc-400 text-xl p-2" aria-label="Fechar">×</button>
                </div>
                <p className="text-sm text-zinc-400 mb-6">Você pode alterar até o dia anterior. O novo pedido precisa ser aprovado novamente pela Pixico.</p>
                {error && <div role="alert" className="mb-5 text-red-300 border border-red-500/20 p-3 text-sm">{error}</div>}
                {serviceError && <p role="alert" className="text-red-400 text-sm mb-4">{serviceError}</p>}
                <label className="block mb-5">
                    <span className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">Serviço</span>
                    <select value={serviceId} onChange={e => { setServiceId(e.target.value); setStart(''); }} className={inputClass}>
                        {availableServices.map(s => (
                            <option key={s.id} value={s.id}>{s.nome} — {serviceDurationLabel(s)}</option>
                        ))}
                    </select>
                </label>
                <label className="block mb-5">
                    <span className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">Data</span>
                    <input type="date" min={addCalendarDays(today, 1)}
                        max={window.unrestricted ? undefined : window.end}
                        value={date} onChange={e => { setDate(e.target.value); setStart(''); }} className={inputClass} />
                </label>
                <div className="mb-3">
                    <span className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">Horários livres</span>
                    {selectedService && <p className="text-xs text-zinc-500 mb-4">O fim será calculado automaticamente: {selectedService.duracao} minutos.</p>}
                </div>
                {loadingSlots || loadingServices ? <p className="text-zinc-500 text-sm mb-6">Consultando horários...</p> :
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-52 overflow-y-auto mb-6">
                        {slots.filter(s => s.disponivel).map(s => (
                            <button key={s.inicio} onClick={() => setStart(s.inicio)}
                                className={`p-3 border text-xs font-bold ${start === s.inicio ? 'border-primary bg-primary text-black' : 'border-white/10 text-white bg-black'}`}>
                                {s.inicio}–{s.fim}
                            </button>
                        ))}
                        {!slots.some(s => s.disponivel) && <p className="col-span-full text-sm text-zinc-500">Não há horário livre nesta data. Escolha outra.</p>}
                    </div>
                }
                <div className="flex flex-col sm:flex-row gap-3">
                    <button onClick={onClose} className="flex-1 border border-white/15 px-5 py-3 text-zinc-300 text-xs uppercase tracking-widest">Voltar</button>
                    <button disabled={!start || saving || loadingSlots || !selectedService} onClick={save}
                        className="flex-1 bg-primary px-5 py-3 text-black font-bold text-xs uppercase tracking-widest disabled:opacity-40">
                        {saving ? 'Salvando...' : 'Solicitar alteração'}
                    </button>
                </div>
            </section>
        </div>
    );
}
