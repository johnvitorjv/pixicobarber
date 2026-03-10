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
        <div className="p-6 md:p-10 max-w-[1600px] mx-auto">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                <div>
                    <span className="text-[10px] font-bold uppercase tracking-[1em] text-primary mb-3 block">Sistema</span>
                    <h1 className="font-display font-bold text-3xl md:text-5xl uppercase tracking-tighter">Configurações</h1>
                </div>
                <button onClick={salvar}
                    className={`px-8 py-4 font-display font-bold uppercase text-[10px] tracking-widest flex items-center justify-center gap-3 transition-all ${saved ? 'bg-green-500 text-black shadow-[0_0_20px_rgba(34,197,94,0.3)]' : 'bg-primary text-black hover:bg-white'}`}>
                    <Save size={16} /> {saved ? 'Salvo com sucesso' : 'Salvar Alterações'}
                </button>
            </div>

            <div className="max-w-3xl space-y-12 bg-black border border-white/5 p-6 md:p-10">
                <Section title="Dados do Negócio">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Field label="Nome da Barbearia" value={config.nomeNegocio} onChange={v => setConfig(c => ({ ...c, nomeNegocio: v }))} />
                        <Field label="WhatsApp (Contato)" value={config.whatsappNumero} onChange={v => setConfig(c => ({ ...c, whatsappNumero: v }))} />
                        <div className="md:col-span-2">
                            <Field label="Endereço Completo" value={config.endereco} onChange={v => setConfig(c => ({ ...c, endereco: v }))} />
                        </div>
                    </div>
                </Section>

                <Section title="Regras de Agendamento (Blacklist)">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block mb-4">Comportamento para clientes bloqueados</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[
                            { id: 'block', label: 'Bloqueio Total', desc: 'Sistemas recusam automaticamente' },
                            { id: 'approval', label: 'Lista de Espera', desc: 'Exige aprovação manual do barbeiro' },
                        ].map(opt => (
                            <button key={opt.id} onClick={() => setConfig(c => ({ ...c, blacklistBehavior: opt.id }))}
                                className={`p-6 border text-left transition-all ${config.blacklistBehavior === opt.id ? 'border-primary bg-primary/5 text-primary shadow-[0_0_15px_rgba(255,255,255,0.05)]' : 'border-white/5 text-zinc-400 hover:border-white/20 hover:text-white bg-white/[0.01]'}`}>
                                <span className="font-display font-bold uppercase tracking-widest text-xs mb-2 block">{opt.label}</span>
                                <span className="font-modern text-[11px] uppercase tracking-widest opacity-60 leading-relaxed block">{opt.desc}</span>
                            </button>
                        ))}
                    </div>
                </Section>

                <Section title="Preferências do Painel">
                    <div className="p-6 bg-white/[0.02] border border-white/5">
                        <Toggle label="Emitir som a cada nova notificação" checked={config.notifSom} onChange={v => setConfig(c => ({ ...c, notifSom: v }))} />
                    </div>
                </Section>
            </div>
        </div>
    );
}

function Section({ title, children }) {
    return (
        <div className="border-b border-white/5 pb-10 last:border-0 last:pb-0">
            <h3 className="font-display font-bold text-lg uppercase tracking-widest mb-8 flex items-center gap-3 text-white">
                <div className="w-1 h-4 bg-primary" /> {title}
            </h3>
            <div>{children}</div>
        </div>
    );
}

function Field({ label, value, onChange, type = 'text' }) {
    return (
        <div>
            <label className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 block mb-3">{label}</label>
            <input type={type} value={value} onChange={e => onChange(e.target.value)}
                className="w-full bg-black border border-white/10 px-4 py-4 text-white font-modern focus:border-primary focus:outline-none transition-colors" />
        </div>
    );
}

function Toggle({ label, checked, onChange }) {
    return (
        <label className="flex items-center justify-between cursor-pointer group">
            <span className="font-modern font-bold text-xs uppercase tracking-widest text-zinc-300 group-hover:text-white transition-colors">{label}</span>
            <button onClick={() => onChange(!checked)}
                className={`w-12 h-6 rounded-full relative transition-colors border ${checked ? 'bg-primary border-primary' : 'bg-black border-white/20'}`}>
                <div className={`absolute top-1 w-4 h-4 rounded-full transition-transform ${checked ? 'bg-black left-7' : 'bg-zinc-500 left-1'}`} />
            </button>
        </label>
    );
}
