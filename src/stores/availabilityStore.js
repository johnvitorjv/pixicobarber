import { requireSupabase } from '../lib/supabase';
import { createRemoteStore } from './remoteStore';
import { bahiaDate, calendarDate, generateDay, validateSchedule } from '../lib/bookingRules';
const rules = createRemoteStore('schedule_config');
const overrides = createRemoteStore('day_overrides');
const availabilityStore = {
    async load() { await Promise.all([rules.load(), overrides.load()]); },
    clear() { rules.clear(); overrides.clear(); },
    getError() { return rules.getError() || overrides.getError(); },
    isReady() { return rules.isReady() && overrides.isReady(); },
    getConfig() { return rules.getAll()[0]?.data || null; },
    async saveConfig(config) {
        validateSchedule(config);
        await rules.write(requireSupabase().from('schedule_config').update({ data: config }).eq('id', true).select().single());
        return config;
    },
    getDay(dateStr) { return generateDay(dateStr, this.getConfig(), overrides.getAll().find(d => d.data === dateStr)?.value); },
    async setDay(dateStr, data) { await overrides.write(requireSupabase().from('day_overrides').upsert({ data: dateStr, value: data }).select().single()); return data; },
    async blockSlot(dateStr, slotId) {
        const day = this.getDay(dateStr);
        if (!day.disponivel) return day;
        return this.setDay(dateStr, { ...day, faixas: day.faixas.map(f => f.id === slotId ? { ...f, disponivel: false } : f) });
    },
    async unblockSlot(dateStr, slotId) {
        const day = this.getDay(dateStr);
        return this.setDay(dateStr, { ...day, faixas: day.faixas.map(f => f.id === slotId ? { ...f, disponivel: true } : f) });
    },
    async closeDay(dateStr, motivo) { return this.setDay(dateStr, { disponivel: false, motivo: motivo || 'Fechado', faixas: [] }); },
    async openDay(dateStr) {
        // Explicitly open closed weekdays using the current valid schedule.
        const config = this.getConfig();
        const dow = new Date(dateStr + 'T12:00:00').getDay();
        const day = generateDay(dateStr, { ...config, diasFuncionamento: [...new Set([...config.diasFuncionamento, dow])] });
        return this.setDay(dateStr, day);
    },
    getRange(days = 60) {
        const result = {};
        const first = new Date(bahiaDate() + 'T12:00:00');
        for (let i = 0; i < days; i++) { const date = new Date(first); date.setDate(first.getDate() + i); const key = calendarDate(date); result[key] = this.getDay(key); }
        return result;
    },
    async addBloqueioEspecial(data, motivo) { const c = this.getConfig(); return this.saveConfig({ ...c, bloqueiosEspeciais: [...c.bloqueiosEspeciais.filter(b => b.data !== data), { data, motivo }] }); },
    async removeBloqueioEspecial(data) { const c = this.getConfig(); return this.saveConfig({ ...c, bloqueiosEspeciais: c.bloqueiosEspeciais.filter(b => b.data !== data) }); },
    async addFerias(inicio, fim) { const c = this.getConfig(); return this.saveConfig({ ...c, ferias: [...c.ferias, { inicio, fim }] }); },
    async removeFerias(inicio) { const c = this.getConfig(); return this.saveConfig({ ...c, ferias: c.ferias.filter(f => f.inicio !== inicio) }); },
};
export default availabilityStore;
