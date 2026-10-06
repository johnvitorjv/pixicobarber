import { normalizeWhatsApp } from '../lib/contact';
import { requireSupabase } from '../lib/supabase';
import { createRemoteStore } from './remoteStore';
const defaults = { nomeNegocio: 'PIXICO Barber', whatsappNumero: '5571994096863', endereco: 'R. da Palestina, 297c - Itacaranha, Salvador - BA, 40713-660', blacklistBehavior: 'approval' };
const remote = createRemoteStore('business_settings');
const settingsStore = {
    ...remote,
    get() { return { ...defaults, ...remote.getAll()[0]?.data };  },
    async update(updates) {
        const data = { ...this.get(), ...updates };
        data.nomeNegocio = data.nomeNegocio?.trim(); data.endereco = data.endereco?.trim();
        data.whatsappNumero = normalizeWhatsApp(data.whatsappNumero);
        if (!data.nomeNegocio || !data.endereco || !/^\d{10,15}$/.test(data.whatsappNumero || '')) throw new Error('Preencha o nome, endereço e WhatsApp com DDI e DDD.');
        await remote.write(requireSupabase().from('business_settings').update({ data }).eq('id', true).select().single());
        return data;
    },
    getBlacklistBehavior() { return this.get().blacklistBehavior; },
    setBlacklistBehavior(blacklistBehavior) { return this.update({ blacklistBehavior }); },
    getTemplateOverride(key) { return this.get().templateOverrides?.[key] || null; },
    setTemplateOverride(key, value) { return this.update({ templateOverrides: { ...this.get().templateOverrides, [key]: value } }); },
};
export default settingsStore;
