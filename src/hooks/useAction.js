import { useState, useRef } from 'react';
import { mutationMessage } from '../lib/bookingRules';
export function useAction() {
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const running = useRef(false);
    async function execute(task, successMessage = '') {
        if (running.current) return false;
        running.current = true; setBusy(true); setError(''); setMessage('');
        try { await task(); setMessage(successMessage); return true; }
        catch (err) { setError(mutationMessage(err)); return false; }
        finally { running.current = false; setBusy(false); }
    }
    return { error, busy, message, execute };
}
