import { useState, useEffect } from 'react';
import { useStoreSync } from '../hooks/useStore';
import { useAuth } from './auth';
import { supabase } from '../lib/supabase';
import availabilityStore from '../stores/availabilityStore';
import settingsStore from '../stores/settingsStore';
import notificationStore from '../stores/notificationStore';
import financialStore from '../stores/financialStore';
export default function DataProvider({ children }) {
    useStoreSync();
    const { user, isAdmin } = useAuth();
    const identity = user?.id;
    const [error, setError] = useState('');
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        if (!supabase) return;
        let active = true;
        notificationStore.clear(); financialStore.clear();
        const relevant = { schedule_config: availabilityStore, day_overrides: availabilityStore, business_settings: settingsStore };
        if (identity) relevant.notifications = notificationStore;
        if (isAdmin) relevant.expenses = financialStore;
        async function load() {
            try {
                await Promise.all([...new Set(Object.values(relevant))].map(store => store.load()));
                if (active) setError('');
            } catch { if (active) setError('Não foi possível carregar os dados. Verifique a conexão e tente novamente.'); }
        }
        void load();
        let timer;
        const channel = supabase.channel('shared-data-' + (identity || 'public'));
        Object.keys(relevant).forEach(table => {
            channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
                clearTimeout(timer); timer = setTimeout(() => { void load(); }, 150);
            });
        });
        channel.subscribe();
        const refresh = () => { void load(); };
        window.addEventListener('online', refresh);
        const poll = setInterval(refresh, 60000); // Realtime is an enhancement; reconnect refresh remains available.
        return () => { active = false; clearTimeout(timer); clearInterval(poll); supabase.removeChannel(channel); window.removeEventListener('online', refresh); };
    }, [identity, isAdmin, attempt]);
    const visibleError = error || [availabilityStore, settingsStore, ...(identity ? [notificationStore] : []), ...(isAdmin ? [financialStore] : [])].map(store => store.getError()).find(Boolean);
    return <>{visibleError && <div role="alert" className="relative z-[110] bg-red-950 text-white p-4 text-center">
        {visibleError} <button className="underline ml-3" onClick={() => setAttempt(a => a + 1)}>Tentar novamente</button>
    </div>}{children}</>;
}
