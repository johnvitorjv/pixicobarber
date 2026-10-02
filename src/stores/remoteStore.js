import { fetchAllRows } from '../lib/fetchRows.js';
import { requireSupabase } from '../lib/supabase.js';
import { notifyStoreChange } from '../hooks/useStore.js';
export function createRemoteStore(table, mapper = x => x, getClient = requireSupabase) {
    let rows = [], loaded = false, request = 0, readError = '';
    return {
        getAll: () => rows, isReady: () => loaded, getError: () => readError,
        clear() { request++; rows = []; loaded = false; readError = ''; notifyStoreChange(); },
        async load() {
            const current = ++request;
            try {
                const data = await fetchAllRows(() => getClient().from(table).select('*').order(table === 'day_overrides' ? 'data' : 'id'), () => current === request);
                if (current === request) { rows = (data || []).map(mapper); loaded = true; readError = ''; notifyStoreChange(); }
            } catch (error) {
                if (current === request) { readError = 'Não foi possível atualizar os dados. Verifique a conexão e tente novamente.'; notifyStoreChange(); }
                throw error;
            }
        },
        async write(query) {
            const { error } = await query;
            if (error) throw error;
            // The server acknowledged the write. A failed read must not invite
            // a duplicate insertion; expose the refresh failure separately.
            try { await this.load(); } catch { /* getError feeds the shared retry banner. */ }
        },
    };
}
