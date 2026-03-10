import { useState, useEffect } from 'react';
import { X, Download, Share } from 'lucide-react';

export default function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showBanner, setShowBanner] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);

    useEffect(() => {
        // Já está instalado como PWA?
        const standalone = window.matchMedia('(display-mode: standalone)').matches
            || window.navigator.standalone === true;
        setIsStandalone(standalone);
        if (standalone) return;

        // Já foi dispensado?
        const dismissed = localStorage.getItem('pwa-install-dismissed');
        if (dismissed) return;

        // Detectar iOS
        const ua = window.navigator.userAgent;
        const isiOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        setIsIOS(isiOS);

        if (isiOS) {
            // No iOS, mostrar guia de Add to Home Screen
            const inSafari = /Safari/.test(ua) && !/CriOS|FxiOS|Chrome/.test(ua);
            if (inSafari) {
                setTimeout(() => setShowBanner(true), 3000);
            }
            return;
        }

        // Android / Desktop: capturar beforeinstallprompt
        const handler = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setTimeout(() => setShowBanner(true), 2000);
        };

        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setShowBanner(false);
        }
        setDeferredPrompt(null);
    };

    const handleDismiss = () => {
        setShowBanner(false);
        localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    };

    if (!showBanner || isStandalone) return null;

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
                    {!isIOS && (
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
