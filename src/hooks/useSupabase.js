// ═══════════════════════════════════════════════
// PIXICO BARBER — Camada de Dados Supabase (DEFINITIVA)
// Fonte ÚNICA de verdade para appointments, profiles, services
// ═══════════════════════════════════════════════
import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// ═══════════════════════════════════════════════
// APPOINTMENTS
// ═══════════════════════════════════════════════

export function useSupabaseAppointments() {
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchAppointments = useCallback(async () => {
        if (!isSupabaseConfigured()) { setLoading(false); return; }
        try {
            const { data, error } = await supabase
                .from('appointments')
                .select(`
                    *,
                    profiles:cliente_id (id, nome, sobrenome, whatsapp, foto_url, role),
                    services:servico_id (id, nome, preco, duracao, categoria)
                `)
                .order('criado_em', { ascending: false });

            if (error) throw error;

            const mapped = (data || []).map(mapAppointment);
            setAppointments(mapped);
        } catch (err) {
            console.error('[Supabase] Erro ao buscar agendamentos:', err);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchAppointments();
        if (!isSupabaseConfigured()) return;

        const channel = supabase
            .channel('appointments-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
                fetchAppointments();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [fetchAppointments]);

    return { appointments, loading, refetch: fetchAppointments };
}

function mapAppointment(a) {
    return {
        id: a.id,
        clienteId: a.cliente_id,
        servicoId: a.servico_id,
        servicoNome: a.services?.nome || 'Serviço',
        servicoPreco: a.services?.preco || 0,
        profissional: 'Pixico',
        data: (a.data || '').slice(0, 10),
        faixaInicio: a.faixa_inicio?.slice(0, 5) || '',
        faixaFim: a.faixa_fim?.slice(0, 5) || '',
        status: a.status || 'pendente',
        observacaoCliente: a.notas_cliente || '',
        observacaoAdmin: a.notas_admin || '',
        criadoEm: a.criado_em,
        atualizadoEm: a.atualizado_em,
        // Dados do cliente inline
        _clienteNome: a.profiles?.nome || 'Cliente',
        _clienteSobrenome: a.profiles?.sobrenome || '',
        _clienteWhatsapp: a.profiles?.whatsapp || '',
        _clienteFoto: a.profiles?.foto_url || '',
    };
}

export async function createAppointmentSupabase({ clienteId, servicoId, data, faixaInicio, faixaFim, observacaoCliente }) {
    if (!isSupabaseConfigured()) return null;
    const { data: result, error } = await supabase
        .from('appointments')
        .insert({
            cliente_id: clienteId,
            servico_id: servicoId,
            data: data,
            faixa_inicio: faixaInicio,
            faixa_fim: faixaFim,
            status: 'pendente',
            notas_cliente: observacaoCliente || '',
        })
        .select()
        .single();
    if (error) throw error;
    return result;
}

export async function updateAppointmentSupabase(id, updates) {
    if (!isSupabaseConfigured()) return null;
    const mapped = {};
    if (updates.status !== undefined) mapped.status = updates.status;
    if (updates.observacaoAdmin !== undefined) mapped.notas_admin = updates.observacaoAdmin;
    if (updates.data !== undefined) mapped.data = updates.data;
    if (updates.faixaInicio !== undefined) mapped.faixa_inicio = updates.faixaInicio;
    if (updates.faixaFim !== undefined) mapped.faixa_fim = updates.faixaFim;
    mapped.atualizado_em = new Date().toISOString();

    const { data, error } = await supabase
        .from('appointments')
        .update(mapped)
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function deleteAppointmentSupabase(id) {
    if (!isSupabaseConfigured()) return;
    const { error } = await supabase.from('appointments').delete().eq('id', id);
    if (error) throw error;
}


// ═══════════════════════════════════════════════
// CLIENTS (PROFILES)
// ═══════════════════════════════════════════════

export function useSupabaseClients() {
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchClients = useCallback(async () => {
        if (!isSupabaseConfigured()) { setLoading(false); return; }
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .neq('role', 'admin')
                .order('criado_em', { ascending: false });

            if (error) throw error;

            const mapped = (data || []).map(p => ({
                id: p.id,
                nome: p.nome || '',
                sobrenome: p.sobrenome || '',
                email: '',
                whatsapp: p.whatsapp || '',
                fotoUrl: p.foto_url || '',
                role: p.role || 'client',
                nascimento: p.nascimento || '',
                observacoes: p.observacoes || '',
                observacoesAdmin: p.observacoes || '',
                ultimaAtividade: p.ultima_atividade || p.criado_em,
                criadoEm: p.criado_em,
                favorito: p.favorito || false,
                blacklist: false,
                tags: [],
            }));

            setClients(mapped);
        } catch (err) {
            console.error('[Supabase] Erro ao buscar clientes:', err);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchClients();
    }, [fetchClients]);

    return { clients, loading, refetch: fetchClients };
}

export async function updateProfileSupabase(id, updates) {
    if (!isSupabaseConfigured()) return null;
    const mapped = {};
    if (updates.favorito !== undefined) mapped.favorito = updates.favorito;
    if (updates.foto_url !== undefined) mapped.foto_url = updates.foto_url;
    if (updates.observacoes !== undefined) mapped.observacoes = updates.observacoes;
    if (updates.whatsapp !== undefined) mapped.whatsapp = updates.whatsapp;
    if (updates.nome !== undefined) mapped.nome = updates.nome;
    if (updates.sobrenome !== undefined) mapped.sobrenome = updates.sobrenome;

    const { data, error } = await supabase
        .from('profiles')
        .update(mapped)
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data;
}


// ═══════════════════════════════════════════════
// SERVICES
// ═══════════════════════════════════════════════

export function useSupabaseServices() {
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchServices = useCallback(async () => {
        if (!isSupabaseConfigured()) { setLoading(false); return; }
        try {
            const { data, error } = await supabase
                .from('services')
                .select('*')
                .order('ordem', { ascending: true });

            if (error) throw error;

            const mapped = (data || []).map(mapService);
            setServices(mapped);
        } catch (err) {
            console.error('[Supabase] Erro ao buscar serviços:', err);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchServices();
    }, [fetchServices]);

    return {
        services,
        loading,
        refetch: fetchServices,
        getVisiveis: (ctx) => services.filter(s => {
            if (s.status !== 'ativo') return false;
            if (ctx === 'home') return s.visivelHome;
            if (ctx === 'agendamento') return s.visivelAgendamento;
            if (ctx === 'cliente') return s.visivelCliente;
            return true;
        }),
        getById: (id) => services.find(s => s.id === id) || null,
        getStats: () => ({
            total: services.length,
            ativos: services.filter(s => s.status === 'ativo').length,
            inativos: services.filter(s => s.status !== 'ativo').length,
            destaque: services.filter(s => s.destaque).length,
        }),
    };
}

function mapService(s) {
    return {
        id: s.id,
        nome: s.nome || '',
        descricaoCurta: s.descricao_curta || '',
        descricaoDetalhada: s.descricao_detalhada || '',
        preco: Number(s.preco) || 0,
        precoPromocional: s.preco_promocional ? Number(s.preco_promocional) : null,
        duracao: s.duracao || 30,
        categoria: s.categoria || 'corte',
        status: s.status || 'ativo',
        ordem: s.ordem || 0,
        imagemUrl: s.imagem_url || '',
        destaque: s.destaque || false,
        badge: s.badge || '',
        visivelHome: s.visivel_home !== false,
        visivelCliente: s.visivel_cliente !== false,
        visivelAgendamento: s.visivel_agendamento !== false,
    };
}

// CRUD de serviços para o Admin
export async function createServiceSupabase(data) {
    if (!isSupabaseConfigured()) return null;
    const mapped = mapServiceToDb(data);
    const { data: result, error } = await supabase.from('services').insert(mapped).select().single();
    if (error) throw error;
    return result;
}

export async function updateServiceSupabase(id, data) {
    if (!isSupabaseConfigured()) return null;
    const mapped = mapServiceToDb(data);
    mapped.atualizado_em = new Date().toISOString();
    const { data: result, error } = await supabase.from('services').update(mapped).eq('id', id).select().single();
    if (error) throw error;
    return result;
}

export async function deleteServiceSupabase(id) {
    if (!isSupabaseConfigured()) return;
    const { error } = await supabase.from('services').delete().eq('id', id);
    if (error) throw error;
}

function mapServiceToDb(data) {
    const out = {};
    if (data.nome !== undefined) out.nome = data.nome;
    if (data.descricaoCurta !== undefined) out.descricao_curta = data.descricaoCurta;
    if (data.descricaoDetalhada !== undefined) out.descricao_detalhada = data.descricaoDetalhada;
    if (data.preco !== undefined) out.preco = Number(data.preco) || 0;
    if (data.precoPromocional !== undefined) out.preco_promocional = data.precoPromocional ? Number(data.precoPromocional) : null;
    if (data.duracao !== undefined) out.duracao = Number(data.duracao) || 30;
    if (data.categoria !== undefined) out.categoria = data.categoria;
    if (data.status !== undefined) out.status = data.status;
    if (data.ordem !== undefined) out.ordem = data.ordem;
    if (data.imagemUrl !== undefined) out.imagem_url = data.imagemUrl;
    if (data.destaque !== undefined) out.destaque = data.destaque;
    if (data.badge !== undefined) out.badge = data.badge;
    if (data.visivelHome !== undefined) out.visivel_home = data.visivelHome;
    if (data.visivelCliente !== undefined) out.visivel_cliente = data.visivelCliente;
    if (data.visivelAgendamento !== undefined) out.visivel_agendamento = data.visivelAgendamento;
    return out;
}

export async function seedServicesSupabase() {
    if (!isSupabaseConfigured()) return;
    const { count, error } = await supabase.from('services').select('*', { count: 'exact', head: true });
    if (error || count > 0) return;

    const defaults = [
        { nome: 'Corte', descricao_curta: 'Corte estrutural com técnica apurada', preco: 60, duracao: 45, categoria: 'corte', ordem: 1 },
        { nome: 'Barba', descricao_curta: 'Design de barba com alinhamento preciso', preco: 50, duracao: 30, categoria: 'barba', ordem: 2 },
        { nome: 'Corte + Barba', descricao_curta: 'A experiência completa', preco: 100, duracao: 75, categoria: 'combo', ordem: 3 },
        { nome: 'Sobrancelha', descricao_curta: 'Design e alinhamento de sobrancelha', preco: 25, duracao: 15, categoria: 'complemento', ordem: 4 },
        { nome: 'Pigmentação', descricao_curta: 'Pigmentação capilar profissional', preco: 80, duracao: 60, categoria: 'tratamento', ordem: 5 },
        { nome: 'Pezinho', descricao_curta: 'Acabamento na nuca', preco: 20, duracao: 15, categoria: 'complemento', ordem: 6 },
        { nome: 'Hidratação', descricao_curta: 'Tratamento capilar premium', preco: 45, duracao: 30, categoria: 'tratamento', ordem: 7 },
    ];
    await supabase.from('services').insert(defaults);
}
