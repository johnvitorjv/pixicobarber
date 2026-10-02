import { useSyncExternalStore } from 'react';
const listeners = new Set();
let version = 0;
export function notifyStoreChange() { version++; listeners.forEach(fn => fn()); }
function subscribe(callback) { listeners.add(callback); return () => listeners.delete(callback); }
function getSnapshot() { return version; }
export function useStoreSync() { return useSyncExternalStore(subscribe, getSnapshot); }
export function useStore(queryFn) { useStoreSync(); return queryFn(); }
