import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { X, Download, Share } from 'lucide-react';

const DISMISSED_KEY = 'pwa-install-dismissed';
const INSTALLED_KEY = 'pwa-install-installed';

function remember(key, value = Date.now().toString()) {
    try { localStorage.setItem(key, value); } catch { /* Optional preference. */ }
}

export default function InstallPrompt() {
    const location = useLocation();
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showBanner, setShowBanner] = useState(false);
    const [isIOS] = useState(() => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
    const [isStandalone, setIsStandalone] = useState(() => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true);
    const [updateWorker, setUpdateWorker] = useState(null);

    useEffect(() => {
        // Já está instalado como PWA?
        const standalone = window.matchMedia('(display-mode: standalone)').matches
            || window.navigator.standalone === true;
        if (standalone) return;

        // Já foi dispensado?
        let dismissed, installedPreference;
        try {
            dismissed = localStorage.getItem(DISMISSED_KEY);
            installedPreference = localStorage.getItem(INSTALLED_KEY);
        } catch { /* Storage may be disabled. */ }
        if (dismissed || installedPreference) return;

        // Detectar iOS
        const ua = window.navigator.userAgent;
        const isiOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

        let timer;
        if (isiOS) {
            // No iOS, mostrar guia de Add to Home Screen
            const inSafari = /Safari/.test(ua) && !/CriOS|FxiOS|Chrome/.test(ua);
            if (inSafari) {
                timer = setTimeout(() => setShowBanner(true), 3000);
            }
            return () => clearTimeout(timer);
        }

        // Android / Desktop: capturar beforeinstallprompt
        const handler = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            timer = setTimeout(() => setShowBanner(true), 2000);
        };

        window.addEventListener('beforeinstallprompt', handler);
        const installed = () => { remember(INSTALLED_KEY, '1'); setIsStandalone(true); setShowBanner(false); setDeferredPrompt(null); };
        window.addEventListener('appinstalled', installed);
        return () => { clearTimeout(timer); window.removeEventListener('beforeinstallprompt', handler); window.removeEventListener('appinstalled', installed); };
    }, []);

    useEffect(() => {
        const update = e => setUpdateWorker(e.detail);
        window.addEventListener('pixico-update', update);
        let active = true;
        if ('serviceWorker' in navigator) void navigator.serviceWorker.getRegistration().then(registration => { if (active && registration?.waiting) setUpdateWorker(registration.waiting); }).catch(() => {});
        return () => { active = false; window.removeEventListener('pixico-update', update); };
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') remember(INSTALLED_KEY, '1');
        else remember(DISMISSED_KEY);
        setShowBanner(false);
        setDeferredPrompt(null);
    };

    const handleDismiss = () => {
        setShowBanner(false);
        remember(DISMISSED_KEY);
    };

    const handleIOSInstalled = () => {
        remember(INSTALLED_KEY, '1');
        setShowBanner(false);
    };

    if (updateWorker) return <div role="status" className="fixed bottom-4 left-4 right-4 z-[120] bg-black border border-primary p-4 text-white text-center">Uma atualização está disponível. <button className="text-primary underline" onClick={() => { navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true }); updateWorker.postMessage({ type: 'SKIP_WAITING' }); }}>Atualizar agora</button></div>;
    const eligibleRoute = location.pathname === '/' || location.pathname === '/painel';
    if (!showBanner || isStandalone || !eligibleRoute) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-[9999] p-4 animate-in slide-in-from-bottom-4 duration-500"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
            <div className="max-w-lg mx-auto bg-black/95 backdrop-blur-xl border border-white/10 p-5 flex items-center gap-4 shadow-[0_-4px_40px_rgba(0,0,0,0.8)]">
                {/* Ícone */}
                <div className="w-12 h-12 bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    {isIOS ? <Share size={20} className="text-primary" /> : <Download size={20} className="text-primary" />}
                </div>

                {/* Texto */}
                <div className="flex-1 min-w-0">
                    <span className="font-display font-bold text-white text-xs uppercase tracking-widest block mb-1">
                        Instalar PIXICO
                    </span>
                    {isIOS ? (
                        <span className="text-zinc-400 text-[11px] font-modern leading-relaxed block">
                            Toque em <Share size={12} className="inline text-primary -mt-0.5" /> e depois em <strong className="text-white">"Adicionar à Tela de Início"</strong>
                        </span>
                    ) : (
                        <span className="text-zinc-400 text-[11px] font-modern block">
                            Acesse como app direto do seu dispositivo.
                        </span>
                    )}
                </div>

                {/* Ações */}
                <div className="flex items-center gap-2 shrink-0">
                    {isIOS ? (
                        <button
                            onClick={handleIOSInstalled}
                            className="border border-primary/40 text-primary px-3 py-2 font-display font-bold uppercase text-[8px] tracking-[0.2em] hover:bg-primary hover:text-black transition-colors"
                        >
                            Já adicionei
                        </button>
                    ) : (
                        <button
                            onClick={handleInstall}
                            className="bg-primary text-black px-4 py-2 font-display font-bold uppercase text-[9px] tracking-[0.3em] hover:bg-white transition-colors"
                        >
                            Instalar
                        </button>
                    )}
                    <button
                        onClick={handleDismiss}
                        className="text-zinc-600 hover:text-white transition-colors p-1"
                        aria-label="Fechar"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}
