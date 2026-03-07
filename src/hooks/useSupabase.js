// ═══════════════════════════════════════════════
// PIXICO BARBER — Supabase Data Hooks
// Hooks React para ler/escrever dados do Supabase
// ═══════════════════════════════════════════════
import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// ─── Hook: Agendamentos ───
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

            // Mapear para o formato que os componentes já esperam
            const mapped = (data || []).map(a => ({
                id: a.id,
                clienteId: a.cliente_id,
                servicoId: a.servico_id,
                servicoNome: a.services?.nome || 'Serviço',
                profissional: 'Pixico',
                data: a.data,
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
            }));

            setAppointments(mapped);
        } catch (err) {
            console.error('Erro ao buscar agendamentos:', err);
        }
        setLoading(false);
    }, []);

    // Subscription realtime
    useEffect(() => {
        fetchAppointments();

        if (!isSupabaseConfigured()) return;

        const channel = supabase
            .channel('appointments-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
                fetchAppointments(); // Refetch quando qualquer mudança ocorre
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [fetchAppointments]);

    return { appointments, loading, refetch: fetchAppointments };
}

// Criar agendamento no Supabase
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

// Atualizar status do agendamento no Supabase
export async function updateAppointmentSupabase(id, updates) {
    if (!isSupabaseConfigured()) return null;

    // Mapear campos do formato frontend → supabase
    const supabaseUpdates = {};
    if (updates.status !== undefined) supabaseUpdates.status = updates.status;
    if (updates.observacaoAdmin !== undefined) supabaseUpdates.notas_admin = updates.observacaoAdmin;
    if (updates.data !== undefined) supabaseUpdates.data = updates.data;
    if (updates.faixaInicio !== undefined) supabaseUpdates.faixa_inicio = updates.faixaInicio;
    if (updates.faixaFim !== undefined) supabaseUpdates.faixa_fim = updates.faixaFim;
    supabaseUpdates.atualizado_em = new Date().toISOString();

    const { data, error } = await supabase
        .from('appointments')
        .update(supabaseUpdates)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
}


// ─── Hook: Clientes (Profiles) ───
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

            // Mapear para o formato que os componentes já esperam
            const mapped = (data || []).map(p => ({
                id: p.id,
                nome: p.nome || '',
                sobrenome: p.sobrenome || '',
                email: '', // email está no auth.users, não no profiles
                whatsapp: p.whatsapp || '',
                fotoUrl: p.foto_url || '',
                role: p.role || 'client',
                nascimento: p.nascimento || '',
                observacoes: p.observacoes || '',
                ultimaAtividade: p.ultima_atividade || p.criado_em,
                criadoEm: p.criado_em,
                favorito: false,
                blacklist: false,
            }));

            setClients(mapped);
        } catch (err) {
            console.error('Erro ao buscar clientes:', err);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchClients();
    }, [fetchClients]);

    return { clients, loading, refetch: fetchClients };
}


// ─── Hook: Serviços ───

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

            // Mapear para o formato que os componentes já esperam
            const mapped = (data || []).map(s => ({
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
            }));

            setServices(mapped);
        } catch (err) {
            console.error('Erro ao buscar serviços:', err);
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
        getVisiveis: (ctx) => {
            return services.filter(s => {
                if (s.status !== 'ativo') return false;
                if (ctx === 'home') return s.visivelHome;
                if (ctx === 'agendamento') return s.visivelAgendamento;
                if (ctx === 'cliente') return s.visivelCliente;
                return true;
            });
        },
        getById: (id) => services.find(s => s.id === id) || null,
    };
}

// Seed serviços padrão no Supabase (se vazio)
export async function seedServicesSupabase() {
    if (!isSupabaseConfigured()) return;

    const { count, error } = await supabase.from('services').select('*', { count: 'exact', head: true });
    if (error || count > 0) return; // Já tem serviços

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
