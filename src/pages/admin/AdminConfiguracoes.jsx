import { useState } from 'react';
import settingsStore from '../../stores/settingsStore';
import { Save, Settings } from 'lucide-react';

export default function AdminConfiguracoes() {
    const [config, setConfig] = useState(() => settingsStore.get());
    const [saved, setSaved] = useState(false);

    function salvar() {
        settingsStore.update(config);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    }

    return (
        <div className="p-6 lg:p-8">
            <div className="mb-6">
                <span className="text-[10px] font-bold uppercase tracking-[1em] text-primary mb-2 block">Sistema</span>
                <h1 className="font-display font-bold text-2xl uppercase tracking-tight">Configurações</h1>
            </div>

            <div className="max-w-xl space-y-6">
                <Section title="Dados do Negócio">
                    <Field label="Nome" value={config.nomeNegocio} onChange={v => setConfig(c => ({ ...c, nomeNegocio: v }))} />
                    <Field label="WhatsApp" value={config.whatsappNumero} onChange={v => setConfig(c => ({ ...c, whatsappNumero: v }))} />
                    <Field label="Endereço" value={config.endereco} onChange={v => setConfig(c => ({ ...c, endereco: v }))} />
                </Section>

                <Section title="Blacklist">
                    <label className="text-[10px] font-bold uppercase tracking-[0.4em] text-zinc-500 block mb-2">Comportamento</label>
                    <div className="flex gap-3">
                        {[
                            { id: 'block', label: 'Bloquear totalmente', desc: 'Impede novos agendamentos' },
                            { id: 'approval', label: 'Exigir aprovação', desc: 'Permite agendar, mas exige revisão' },
                        ].map(opt => (
                            <button key={opt.id} onClick={() => setConfig(c => ({ ...c, blacklistBehavior: opt.id }))}
                                className={`flex-1 p-4 border text-left transition-colors ${config.blacklistBehavior === opt.id ? 'border-primary bg-primary/5' : 'border-white/10 hover:border-white/20'}`}>
                                <span className="font-modern text-sm font-bold block">{opt.label}</span>
                                <span className="text-[10px] text-zinc-500">{opt.desc}</span>
                            </button>
                        ))}
                    </div>
                </Section>

                <Section title="Notificações">
                    <Toggle label="Som de notificação" checked={config.notifSom} onChange={v => setConfig(c => ({ ...c, notifSom: v }))} />
                </Section>

                <button onClick={salvar}
                    className={`px-8 py-3 font-display font-bold uppercase text-xs tracking-[0.3em] flex items-center gap-2 transition-colors ${saved ? 'bg-green-500 text-black' : 'bg-primary text-black hover:bg-primary/90'}`}>
                    <Save size={14} /> {saved ? 'Salvo!' : 'Salvar'}
                </button>
            </div>
        </div>
    );
}

function Section({ title, children }) {
    return (
        <div className="border-b border-white/10 pb-6">
            <h3 className="font-display font-bold text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
                <Settings size={14} className="text-primary" /> {title}
            </h3>
            <div className="space-y-4">{children}</div>
        </div>
    );
}

function Field({ label, value, onChange, type = 'text' }) {
    return (
        <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.4em] text-zinc-500 block mb-1">{label}</label>
            <input type={type} value={value} onChange={e => onChange(e.target.value)}
                className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white font-modern focus:border-primary focus:outline-none" />
        </div>
    );
}

function Toggle({ label, checked, onChange }) {
    return (
        <label className="flex items-center justify-between cursor-pointer">
            <span className="font-modern text-sm">{label}</span>
            <button onClick={() => onChange(!checked)}
                className={`w-10 h-5 rounded-full relative transition-colors ${checked ? 'bg-primary' : 'bg-zinc-700'}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'left-5' : 'left-0.5'}`} />
            </button>
        </label>
    );
}
