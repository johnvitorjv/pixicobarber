import { useCallback, useEffect, useRef, useState } from 'react';
import { requireSupabase } from '../lib/supabase';
export function useSlots(date, service) {
    const [state, setState] = useState({ date: '', service: '', slots: [], loading: false, error: '' });
    const generation = useRef(0);
    const invalidate = useCallback(() => { generation.current++; }, []);
    const refetch = useCallback(async () => {
        const current = ++generation.current;
        if (!date || !service) return;
        setState({ date, service, slots: [], loading: true, error: '' });
        try {
            const { data, error } = await requireSupabase().rpc('get_available_slots', { p_date: date, p_service: service });
            if (error) throw error;
            if (current === generation.current) setState({ date, service, slots: data || [], loading: false, error: '' });
        } catch {
            if (current === generation.current) setState({ date, service, slots: [], loading: false, error: 'Não foi possível verificar os horários. Tente novamente.' });
        }
    }, [date, service]);
    useEffect(() => {
        let active = true;
        queueMicrotask(() => { if (active) void refetch(); });
        const poll = setInterval(() => { void refetch(); }, 30000);
        return () => { active = false; invalidate(); clearInterval(poll); };
    }, [refetch, invalidate]);
    return { ...(state.date === date && state.service === service ? state : { slots: [], loading: !!date && !!service, error: '' }), refetch };
}
