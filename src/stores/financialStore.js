import { requireSupabase } from '../lib/supabase';
import { createRemoteStore } from './remoteStore';
const remote = createRemoteStore('expenses', e => ({ ...e, valor: Number(e.valor), tipo: 'saida', criadoEm: e.criado_em }));
const financialStore = {
    ...remote,
    getSaidas: remote.getAll,
    async registrarDespesa({ descricao, valor, categoria }) {
        if (!descricao.trim() || !Number.isFinite(valor) || valor <= 0) throw new Error('Informe descrição e valor positivo.');
        await remote.write(requireSupabase().from('expenses').insert({ descricao: descricao.trim(), valor, categoria }).select().single());
    },
    async delete(id) { await remote.write(requireSupabase().from('expenses').delete().eq('id', id)); },
};
export default financialStore;
