import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { AuthContext } from './auth';
import { normalizeWhatsApp } from '../lib/contact';
import { authMessage, profileToUser } from '../lib/authUtils';

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [recovery, setRecovery] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);
    const completeLogout = useCallback(() => setLoggingOut(false), []);
    const generation = useRef(0);
    const signingOut = useRef(false);
    const currentUserId = useRef(null);

    const invalidate = useCallback(() => { generation.current++; }, []);
    const loadUser = useCallback(async (authUser) => {
        const request = ++generation.current;
        if (!authUser) { currentUserId.current = null; setUser(null); setLoading(false); return null; }
        if (currentUserId.current !== authUser.id) setLoading(true);
        try {
            const { data, error: queryError } = await supabase.from('profiles')
                .select('id,nome,sobrenome,whatsapp,role,foto_url,nascimento,criado_em').eq('id', authUser.id).single();
            if (queryError) throw queryError;
            const safeUser = profileToUser(authUser, data);
            if (request === generation.current) { currentUserId.current = safeUser.id; setUser(safeUser); setError(''); }
            return safeUser;
        } catch {
            if (request === generation.current) { currentUserId.current = null; setUser(null); setError('Não foi possível carregar seu perfil. Tente novamente.'); }
            return null;
        } finally {
            if (request === generation.current) setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!isSupabaseConfigured()) {
            queueMicrotask(() => { setError('Sistema indisponível: configuração de acesso ausente.'); setLoading(false); });
            return;
        }
        let active = true;
        let authEventReceived = false;
        let eventVersion = 0;
        const timers = new Set();
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            authEventReceived = true;
            const version = ++eventVersion;
            if (!active) return;
            // Supabase API calls must run outside the synchronous auth lock.
            const timer = setTimeout(() => {
                timers.delete(timer);
                if (!active || version !== eventVersion) return;
                if (event === 'PASSWORD_RECOVERY') setRecovery(true);
                if (event === 'SIGNED_OUT' && signingOut.current) return;
                if (event === 'SIGNED_OUT') setRecovery(false);
                void loadUser(session?.user);
            }, 0);
            timers.add(timer);
        });
        supabase.auth.getSession().then(({ data, error: sessionError }) => {
            if (!active || authEventReceived) return;
            if (sessionError) { setError('Não foi possível restaurar a sessão.'); setLoading(false); }
            else void loadUser(data.session?.user);
        }).catch(() => { if (active) { setError('Não foi possível restaurar a sessão.'); setLoading(false); } });
        return () => { active = false; invalidate(); timers.forEach(clearTimeout); subscription.unsubscribe(); };
    }, [loadUser, invalidate]);

    async function login(email, senha) {
        if (!supabase) return { success: false, error: 'Acesso indisponível no momento.' };
        const { data, error: loginError } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: senha });
        if (loginError) return { success: false, error: authMessage(loginError) };
        const safeUser = await loadUser(data.user);
        return safeUser ? { success: true, user: safeUser } : { success: false, error: 'Não foi possível carregar seu perfil. Tente entrar novamente.' };
    }

    async function registrar(dados) {
        if (!supabase) return { success: false, error: 'Cadastro indisponível no momento.' };
        const { data, error: signupError } = await supabase.auth.signUp({
            email: dados.email.trim().toLowerCase(), password: dados.senha,
            options: { emailRedirectTo: window.location.origin + '/login', data: {
                nome: dados.nome.trim(), sobrenome: dados.sobrenome.trim(),
                whatsapp: normalizeWhatsApp(dados.whatsapp), nascimento: dados.nascimento || '',
                observacoes: dados.observacoes?.trim() || '',
            } },
        });
        if (signupError) return { success: false, error: authMessage(signupError) };
        if (!data.session) return { success: true, needsConfirmation: true,
            message: 'Verifique seu e-mail para confirmar a conta. Depois, faça login.' };
        const safeUser = await loadUser(data.user);
        return safeUser ? { success: true, user: safeUser } : { success: false, error: 'Conta criada. Faça login novamente para carregar o perfil.' };
    }

    async function logout(onSuccess, scope = 'local') {
        signingOut.current = true; setLoggingOut(true);
        let completed = false;
        try {
            if (supabase) {
                const { error: logoutError } = await supabase.auth.signOut({ scope });
                if (logoutError) throw new Error('Não foi possível sair. Tente novamente.');
            }
            // Navigate in the same update as clearing auth; guards must not win this race.
            if (typeof onSuccess === 'function') onSuccess();
            generation.current++; currentUserId.current = null; setUser(null); setRecovery(false); setError('');
            completed = true;
        } finally { signingOut.current = false; if (!completed || typeof onSuccess !== 'function') setLoggingOut(false); }
    }

    async function refreshUser() {
        if (!supabase) return;
        const { data, error: sessionError } = await supabase.auth.getUser();
        if (sessionError) throw sessionError;
        return loadUser(data.user);
    }

    async function recoverPassword(email) {
        if (!supabase) throw new Error('Recuperação indisponível no momento.');
        const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
            redirectTo: window.location.origin + '/recuperar-acesso',
        });
        if (recoveryError) throw new Error(authMessage(recoveryError));
    }

    async function changePassword(password) {
        if (!supabase) throw new Error('Recuperação indisponível no momento.');
        if (password.length < 8) throw new Error('Use pelo menos 8 caracteres.');
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw new Error(authMessage(updateError));
        try { await logout(undefined, 'global'); }
        catch { const failure = new Error('Sua senha foi alterada, mas não foi possível encerrar as sessões. Reconecte e tente encerrar novamente.'); failure.passwordChanged = true; throw failure; }
    }

    return <AuthContext.Provider value={{ user, loading, error, recovery, loggingOut, completeLogout, isAuthenticated: !!user,
        isAdmin: user?.role === 'admin', registrar, login, logout, refreshUser, recoverPassword, changePassword, finishRecovery: () => logout(undefined, 'global') }}>
        {children}
    </AuthContext.Provider>;
}
