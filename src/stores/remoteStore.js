import { fetchAllRows } from '../lib/fetchRows';
import { requireSupabase } from '../lib/supabase';
import { notifyStoreChange } from '../hooks/useStore';
export function createRemoteStore(table, mapper = x => x) {
    let rows = [];
    let loaded = false;
    let request = 0;
    return {
        getAll: () => rows,
        isReady: () => loaded,
        clear() { request++; rows = []; loaded = false; notifyStoreChange(); },
        async load() {
            const current = ++request;
            const data = await fetchAllRows(() => requireSupabase().from(table).select('*').order(table === 'day_overrides' ? 'data' : 'id'), () => current === request);
            if (current === request) { rows = (data || []).map(mapper); loaded = true; notifyStoreChange(); }
        },
        async write(query) { const { error } = await query; if (error) throw error; await this.load(); },
    };
}
