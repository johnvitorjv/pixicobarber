if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    const register = async () => {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
            const notify = worker => window.dispatchEvent(new CustomEvent('pixico-update', { detail: worker }));
            if (registration.waiting) notify(registration.waiting);
            registration.addEventListener('updatefound', () => {
                const worker = registration.installing;
                worker?.addEventListener('statechange', () => {
                    if (worker.state === 'installed' && navigator.serviceWorker.controller) notify(worker);
                });
            });
        } catch { /* Installation is optional; the website remains usable. */ }
    };
    if (document.readyState === 'complete') void register();
    else window.addEventListener('load', register, { once: true });
}
