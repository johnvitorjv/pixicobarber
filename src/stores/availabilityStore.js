import { requireSupabase } from '../lib/supabase';
import { createRemoteStore } from './remoteStore';
import { bahiaDate, calendarDate, generateDay, validateSchedule, validateOverride, defaultOpenDay } from '../lib/bookingRules';
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
    getOverride(dateStr) { return overrides.getAll().find(d => d.data === dateStr)?.value || null; },
    async setDay(dateStr, data) { validateOverride(data); const { faixas: _grid, ...value } = data; await overrides.write(requireSupabase().from('day_overrides').upsert({ data: dateStr, value }).select().single()); return value; },
    async blockSlot(dateStr, slotId) {
        const day = this.getDay(dateStr);
        if (!day.disponivel) return day;
        const slot = day.faixas.find(f => f.id === slotId);
        return this.setDay(dateStr, { ...day, bloqueios: [...day.bloqueios, { inicio: slot.inicio, fim: slot.fim }] });
    },
    async unblockSlot(dateStr, slotId) {
        const day = this.getDay(dateStr);
        const slot = day.faixas.find(f => f.id === slotId);
        return this.setDay(dateStr, { ...day, bloqueios: day.bloqueios.flatMap(f => {
            if (f.inicio >= slot.fim || f.fim <= slot.inicio) return [f];
            return [f.inicio < slot.inicio && { inicio: f.inicio, fim: slot.inicio }, f.fim > slot.fim && { inicio: slot.fim, fim: f.fim }].filter(Boolean);
        }) });
    },
    async closeDay(dateStr, motivo) { return this.setDay(dateStr, { disponivel: false, motivo: motivo || 'Fechado', intervalos: [], bloqueios: [] }); },
    async openDay(dateStr) {
        return this.setDay(dateStr, defaultOpenDay(this.getConfig()));
    },
    async resetDay(dateStr) {
        await overrides.write(requireSupabase().from('day_overrides').delete().eq('data', dateStr));
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
