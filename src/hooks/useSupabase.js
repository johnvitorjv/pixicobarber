import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, requireSupabase } from '../lib/supabase';
import { fetchAllRows } from '../lib/fetchRows';
import { useAuth } from '../context/auth';

function useRows(table, select = '*', order = 'criado_em', publicRead = false) {
    const { user, isAdmin } = useAuth();
    const [state, setState] = useState({ rows: [], loading: true, error: '' });
    const request = useRef(0);
    const invalidate = useCallback(() => { request.current++; }, []);
    const enabled = !!supabase && (publicRead || !!user);
    const identity = user?.id || '';
    const refetch = useCallback(async () => {
        const current = ++request.current;
        if (!enabled) { setState({ rows: [], loading: false, error: supabase ? '' : 'Sistema indisponível no momento.' }); return; }
        setState(old => ({ ...old, loading: true, error: '' }));
        try {
            if (!isAdmin && table === 'profiles') { setState({ rows: [], loading: false, error: '' }); return; }
            const data = await fetchAllRows(() => {
                let query = table === 'profiles' ? supabase.rpc('get_admin_clients').order(order) : (table === 'appointments' && isAdmin ? supabase.rpc('get_admin_appointments').select(select) : supabase.from(table).select(select)).order(order, { ascending: order === 'ordem' });
                query = query.order('id');
                if (!isAdmin && table === 'appointments') query = query.eq('cliente_id', identity);
                return query;
            }, () => request.current === current);
            if (request.current === current) setState({ rows: data || [], loading: false, error: '' });
        } catch {
            if (request.current === current) setState({ rows: [], loading: false, error: 'Não foi possível carregar os dados. Tente novamente.' });
        }
    // Identity changes must invalidate queries even for the same table.
    }, [enabled, table, select, order, identity, isAdmin]);
    useEffect(() => {
        let active = true;
        queueMicrotask(() => { if (active) void refetch(); });
        if (!enabled) return () => { active = false; invalidate(); };
        const channel = supabase.channel(table + '-' + identity + '-' + crypto.randomUUID())
            .on('postgres_changes', { event: '*', schema: 'public', table: table === 'appointments' ? 'notifications' : table }, () => { void refetch(); }).subscribe();
        const refresh = () => { if (!document.hidden) void refetch(); };
        window.addEventListener('online', refresh); document.addEventListener('visibilitychange', refresh);
        const poll = setInterval(refresh, 60000);
        return () => { active = false; invalidate(); clearInterval(poll); supabase.removeChannel(channel); window.removeEventListener('online', refresh); document.removeEventListener('visibilitychange', refresh); };
    }, [refetch, enabled, table, identity, invalidate]);
    return { ...state, refetch };
}
export function mapAppointment(a) {
    return {
        confirmacaoManual: a.confirmacao_manual === true,
        id: a.id, clienteId: a.cliente_id, servicoId: a.servico_id,
        servicoNome: a.servico_nome_reservado || a.services?.nome || 'Serviço',
        servicoPreco: Number(a.preco_reservado ?? a.services?.preco ?? 0),
        valorCobrado: a.valor_cobrado == null ? null : Number(a.valor_cobrado),
        formaPagamento: a.forma_pagamento || '', profissional: 'Pixico',
        data: (a.data || '').slice(0, 10), faixaInicio: a.faixa_inicio?.slice(0, 5) || '',
        faixaFim: a.faixa_fim?.slice(0, 5) || '', status: a.status,
        observacaoCliente: a.notas_cliente || '', observacaoAdmin: a.notas_admin || '',
        motivoRejeicao: a.motivo_rejeicao || '',
        sugestaoNovaData: a.sugestao_data, sugestaoNovaFaixa: a.sugestao_inicio ? a.sugestao_inicio.slice(0,5) + ' às ' + a.sugestao_fim.slice(0,5) : null,
        criadoEm: a.criado_em, atualizadoEm: a.atualizado_em,
        _clienteNome: a.profiles?.nome || 'Cliente', _clienteSobrenome: a.profiles?.sobrenome || '',
        _clienteWhatsapp: a.profiles?.whatsapp || '', _clienteFoto: a.profiles?.foto_url || '',
    };
}
export function useSupabaseAppointments() {
    const { isAdmin } = useAuth();
    const state = useRows('appointments', 'id,cliente_id,servico_id,data,faixa_inicio,faixa_fim,status,confirmacao_manual,notas_cliente,recurso_id,criado_em,atualizado_em,preco_reservado,servico_nome_reservado,valor_cobrado,forma_pagamento,motivo_rejeicao,sugestao_data,sugestao_inicio,sugestao_fim,profiles:cliente_id(id,nome,sobrenome,whatsapp,foto_url),services:servico_id(id,nome,preco,duracao,categoria)' + (isAdmin ? ',notas_admin' : ''));
    return { ...state, appointments: state.rows.map(mapAppointment) };
}
export async function createAppointmentSupabase({ clienteId, servicoId, data, faixaInicio, faixaFim, observacaoCliente, confirmacaoManual = false }) {
    const { data: result, error } = await requireSupabase().from('appointments').insert({
        cliente_id: clienteId, servico_id: servicoId, data, faixa_inicio: faixaInicio, faixa_fim: faixaFim,
        status: confirmacaoManual ? 'solicitado' : 'pendente', notas_cliente: observacaoCliente || '',
    }).select('id').single();
    if (error) throw error;
    return result;
}
export async function updateAppointmentSupabase(id, updates) {
    const names = { status: 'status', observacaoAdmin: 'notas_admin', data: 'data', faixaInicio: 'faixa_inicio',
        faixaFim: 'faixa_fim', valorCobrado: 'valor_cobrado', formaPagamento: 'forma_pagamento',
        motivoRejeicao: 'motivo_rejeicao', sugestaoNovaData: 'sugestao_data', sugestaoInicio: 'sugestao_inicio', sugestaoFim: 'sugestao_fim' };
    const mapped = Object.fromEntries(Object.entries(updates).filter(([k]) => names[k]).map(([k,v]) => [names[k],v]));
    const { data, error } = await requireSupabase().from('appointments').update(mapped).eq('id',id).select('id').single();
    if (error) throw error;
    return data;
}
export function useSupabaseClients() {
    const state = useRows('profiles');
    const clients = state.rows.filter(p => p.role !== 'admin').map(p => ({
        id: p.id, nome: p.nome || '', sobrenome: p.sobrenome || '', email: p.email || '',
        whatsapp: p.whatsapp || '', fotoUrl: p.foto_url || '', role: p.role,
        nascimento: p.nascimento || '', observacoesAdmin: p.observacoes_admin || '',
        ultimaAtividade: p.ultima_atividade || p.criado_em, criadoEm: p.criado_em,
        favorito: p.favorito || false, blacklist: p.blacklist || false,
        blacklistMotivo: p.blacklist_motivo || '', tags: p.tags || [], apelido: p.apelido || '',
    }));
    return { ...state, clients };
}
export async function updateProfileSupabase(id, updates) {
    const allowed = ['favorito','foto_url','observacoes','whatsapp','nome','sobrenome','apelido','observacoes_admin','blacklist','blacklist_motivo','tags'];
    const mapped = Object.fromEntries(Object.entries(updates).filter(([key]) => allowed.includes(key)));
    const { data, error } = await requireSupabase().from('profiles').update(mapped).eq('id',id).select('id').single();
    if (error) throw error;
    return data;
}
function mapService(s) {
    return { id: s.id, nome: s.nome, descricaoCurta: s.descricao_curta || '', descricaoDetalhada: s.descricao_detalhada || '',
        preco: Number(s.preco), precoPromocional: s.preco_promocional == null ? null : Number(s.preco_promocional),
        duracao: s.duracao, aplicacaoMinutos: s.aplicacao_minutos, confirmacaoManual: s.confirmacao_manual === true, diasPermitidos: s.dias_permitidos || [0,1,2,3,4,5,6], categoria: s.categoria, status: s.status, ordem: s.ordem || 0, imagemUrl: s.imagem_url || '',
        destaque: s.destaque, badge: s.badge || '', visivelHome: s.visivel_home, visivelCliente: s.visivel_cliente, visivelAgendamento: s.visivel_agendamento };
}
export function useSupabaseServices() {
    const state = useRows('services', '*', 'ordem', true);
    const services = state.rows.map(mapService);
    return { ...state, services,
        getById: id => services.find(s => s.id === id) || null,
        getVisiveis: ctx => services.filter(s => s.status === 'ativo' && (ctx === 'home' ? s.visivelHome : ctx === 'agendamento' ? s.visivelAgendamento : s.visivelCliente)),
        getStats: () => ({ total: services.length, ativos: services.filter(s => s.status === 'ativo').length,
            inativos: services.filter(s => s.status !== 'ativo').length, destaque: services.filter(s => s.destaque).length }),
    };
}
function mapServiceToDb(data) {
    const names = { nome: 'nome', descricaoCurta: 'descricao_curta', descricaoDetalhada: 'descricao_detalhada',
        confirmacaoManual: 'confirmacao_manual', diasPermitidos: 'dias_permitidos', aplicacaoMinutos: 'aplicacao_minutos', preco: 'preco', precoPromocional: 'preco_promocional', duracao: 'duracao', categoria: 'categoria',
        status: 'status', ordem: 'ordem', imagemUrl: 'imagem_url', destaque: 'destaque', badge: 'badge',
        visivelHome: 'visivel_home', visivelCliente: 'visivel_cliente', visivelAgendamento: 'visivel_agendamento' };
    return Object.fromEntries(Object.entries(data).filter(([k]) => names[k]).map(([k,v]) => [names[k],v]));
}
export async function createServiceSupabase(data) {
    const { data: result, error } = await requireSupabase().from('services').insert(mapServiceToDb(data)).select().single();
    if (error) throw error;
    return result;
}
export async function updateServiceSupabase(id,data) {
    const { data: result, error } = await requireSupabase().from('services').update({ ...mapServiceToDb(data), atualizado_em: new Date().toISOString() }).eq('id',id).select().single();
    if (error) throw error;
    return result;
}
export async function deleteServiceSupabase(id) {
    const { error } = await requireSupabase().from('services').delete().eq('id',id);
    if (error) throw error;
}
