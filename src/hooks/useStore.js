import { useSyncExternalStore, useCallback } from 'react';

// ═══════════════════════════════════════════════
// PIXICO BARBER — Hook reativo para stores localStorage
// Elimina dependência de refresh manual em TODOS os componentes
// ═══════════════════════════════════════════════

const listeners = new Set();
let version = 0;

function notify() {
    version++;
    listeners.forEach(fn => fn());
}

// Interceptar localStorage.setItem para notificar subscribers (mesma aba)
const originalSetItem = localStorage.setItem.bind(localStorage);
localStorage.setItem = function (key, value) {
    originalSetItem(key, value);
    if (key.startsWith('pixico_')) {
        notify();
    }
};

const originalRemoveItem = localStorage.removeItem.bind(localStorage);
localStorage.removeItem = function (key) {
    originalRemoveItem(key);
    if (key.startsWith('pixico_')) {
        notify();
    }
};

// Cross-tab sync: ouvir mudanças de localStorage feitas em OUTRAS abas
window.addEventListener('storage', (e) => {
    if (e.key && e.key.startsWith('pixico_')) {
        notify();
    }
});

function subscribe(callback) {
    listeners.add(callback);
    return () => listeners.delete(callback);
}

function getSnapshot() {
    return version;
}

/**
 * Hook que força re-render quando qualquer store pixico_ muda.
 * Uso: const tick = useStoreSync(); — coloque como dep de useMemo.
 */
export function useStoreSync() {
    return useSyncExternalStore(subscribe, getSnapshot);
}

/**
 * Hook que executa uma query de store e retorna resultado reativo.
 * Uso: const data = useStore(() => appointmentStore.getAll());
 */
export function useStore(queryFn) {
    const tick = useSyncExternalStore(subscribe, getSnapshot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return queryFn();
}

/**
 * Dispara manualmente uma atualização para todos os subscribers.
 * Útil quando uma operação muda estado sem passar pelo localStorage.setItem.
 */
export function notifyStoreChange() {
    version++;
    listeners.forEach(fn => fn());
}
