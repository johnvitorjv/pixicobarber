import { useState } from 'react';
import { defaultOpenDay } from '../lib/bookingRules';
import availabilityStore from '../stores/availabilityStore';

export default function DayOverrideEditor({ date, config, action }) {
    const [draft, setDraft] = useState(() => availabilityStore.getOverride(date) || defaultOpenDay(config));
    const inputClass = 'w-full min-w-0 bg-black border border-white/20 p-2 text-white [color-scheme:dark]';
    function ranges(key, title) {
        return <fieldset className="space-y-3 mb-5"><legend className="text-sm mb-2">{title}</legend>
            {draft[key].map((f,i) => <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                {['inicio','fim'].map(part => <input key={part} aria-label={`${title} ${i+1} ${part}`} type="time" className={inputClass} value={f[part]} onChange={e => setDraft({ ...draft, [key]: draft[key].map((r,j) => i===j ? {...r,[part]:e.target.value} : r) })} />)}
                <button type="button" aria-label={`Remover ${title} ${i+1}`} onClick={() => setDraft({...draft,[key]:draft[key].filter((_,j)=>j!==i)})}>×</button>
            </div>)}
            <button type="button" className="text-primary text-sm" onClick={() => setDraft({...draft,[key]:[...draft[key],{inicio:'09:00',fim:'10:00'}]})}>+ {title}</button>
        </fieldset>;
    }
    return <div className="border-t border-white/10 pt-5 mb-6">
        <h4 className="font-bold mb-3">Exceção desta data</h4>
        <p className="text-xs text-zinc-400 mb-4">Substitui todo o expediente, pausa, férias e bloqueios globais desta data. Inclua todas as pausas nos bloqueios ou separe os intervalos. Feriados são decididos aqui pelo admin.</p>
        <label className="flex gap-2 mb-4"><input type="checkbox" checked={draft.disponivel} onChange={e => setDraft({...draft,disponivel:e.target.checked})} /> Aberto nesta data</label>
        {draft.disponivel && <>{ranges('intervalos','Trabalho')}{ranges('bloqueios','Bloqueio')}</>}
        <label className="text-sm">Motivo<input className={`${inputClass} mt-2 mb-4`} value={draft.motivo || ''} onChange={e => setDraft({...draft,motivo:e.target.value})} /></label>
        <button disabled={action.busy} className="w-full bg-primary text-black p-3 font-bold mb-3" onClick={() => action.execute(() => availabilityStore.setDay(date,draft),'Exceção salva.')}>Salvar exceção</button>
        <button disabled={action.busy} className="text-sm text-zinc-400" onClick={() => action.execute(() => availabilityStore.resetDay(date),'Expediente padrão restaurado.')}>Restaurar padrão da data</button>
        <p className="text-xs text-zinc-500 mt-3">Alterações incompatíveis com reservas existentes serão rejeitadas. Remarque ou cancele antes.</p>
    </div>;
}
