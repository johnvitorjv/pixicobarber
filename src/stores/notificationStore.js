import { requireSupabase } from '../lib/supabase';
import { createRemoteStore } from './remoteStore';
const remote = createRemoteStore('notifications', n => ({ ...n, destinatario: n.para_admin ? 'admin' : n.destinatario, criadoEm: n.criado_em }));
const notificationStore = {
    ...remote,
    getParaAdmin() { return remote.getAll().filter(n => n.para_admin); },
    getParaCliente(id) { return remote.getAll().filter(n => n.destinatario === id); },
    getNaoLidasAdmin() { return this.getParaAdmin().filter(n => !n.lida); },
    getNaoLidasCliente(id) { return this.getParaCliente(id).filter(n => !n.lida); },
    getContadorAdmin() { return this.getNaoLidasAdmin().length; },
    getContadorCliente(id) { return this.getNaoLidasCliente(id).length; },
    async marcarLida(id) { await remote.write(requireSupabase().from('notifications').update({ lida: true }).eq('id', id).select().single()); },
    async marcarTodasLidas(destinatario) {
        let query = requireSupabase().from('notifications').update({ lida: true });
        query = destinatario === 'admin' ? query.eq('para_admin', true) : query.eq('destinatario', destinatario);
        await remote.write(query);
    },
    async limparLidas(destinatario) {
        let query = requireSupabase().from('notifications').delete().eq('lida', true);
        query = destinatario === 'admin' ? query.eq('para_admin', true) : query.eq('destinatario', destinatario);
        await remote.write(query);
    },
    async delete(id) { await remote.write(requireSupabase().from('notifications').delete().eq('id', id)); },
};
export default notificationStore;
