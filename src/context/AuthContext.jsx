import { createContext, useContext, useState, useEffect } from 'react';
import clientStore from '../stores/clientStore';
import notificationStore from '../stores/notificationStore';
import { NOTIF_TIPOS, NOTIF_NIVEIS } from '../data/models';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// ═══════════════════════════════════════════════
// PIXICO BARBER — Contexto de Autenticação v3 (Híbrido Supabase/Local)
// ═══════════════════════════════════════════════

const AuthContext = createContext(null);
const STORAGE_KEY = 'pixico_auth';

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Seed admin user na inicialização (somente local fallback)
    useEffect(() => {
        if (!isSupabaseConfigured()) {
            clientStore.seedAdmin();
        }
    }, []);

    // Monitorar estado de autenticação
    useEffect(() => {
        const loadSession = async () => {
            if (isSupabaseConfigured()) {
                // Fluxo Supabase
                const { data: { session }, error } = await supabase.auth.getSession();
                if (session?.user) {
                    await fetchAndSetUserData(session.user);
                } else {
                    setUser(null);
                }
                setLoading(false);

                // Listener para mudanças de auth no Supabase
                const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
                    if (session?.user) {
                        await fetchAndSetUserData(session.user);
                    } else {
                        setUser(null);
                    }
                    setLoading(false);
                });

                return () => subscription.unsubscribe();
            } else {
                // Fluxo LocalStorage (Fallback)
                try {
                    const stored = localStorage.getItem(STORAGE_KEY);
                    if (stored) {
                        const parsed = JSON.parse(stored);
                        const fresh = clientStore.getById(parsed.id);
                        if (fresh) {
                            const { senha, ...safe } = fresh;
                            setUser(safe);
                        } else {
                            localStorage.removeItem(STORAGE_KEY);
                        }
                    }
                } catch (e) {
                    localStorage.removeItem(STORAGE_KEY);
                }
                setLoading(false);
            }
        };

        loadSession();
    }, []);

    // Persistir sessão local (Fallback)
    useEffect(() => {
        if (!isSupabaseConfigured()) {
            if (user) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
            } else {
                localStorage.removeItem(STORAGE_KEY);
            }
        }
    }, [user]);

    // Buscar dados estendidos do usuário (Supabase)
    const fetchAndSetUserData = async (supabaseUser) => {
        try {
            const meta = supabaseUser.user_metadata || {};
            const safeUser = {
                id: supabaseUser.id,
                email: supabaseUser.email,
                nome: meta.nome || '',
                sobrenome: meta.sobrenome || '',
                whatsapp: meta.whatsapp || '',
                fotoUrl: meta.fotoUrl || '',
                role: meta.role || 'client',
            };
            setUser(safeUser);
            return safeUser;
        } catch (error) {
            console.error('Erro ao buscar dados do usuário:', error);
            setUser(null);
            return null;
        }
    };

    // Cadastro
    async function registrar(dados) {
        if (isSupabaseConfigured()) {
            try {
                const { data, error } = await supabase.auth.signUp({
                    email: dados.email,
                    password: dados.senha,
                    options: {
                        data: {
                            nome: dados.nome,
                            sobrenome: dados.sobrenome,
                            whatsapp: dados.whatsapp,
                            fotoUrl: dados.fotoUrl || '',
                            role: 'client'
                        }
                    }
                });

                if (error) throw error;

                // Se há sessão (email confirmation desativado), setar user direto
                if (data.session && data.user) {
                    const safeUser = await fetchAndSetUserData(data.user);
                    return { success: true, user: safeUser };
                }

                // Se NÃO há sessão (email confirmation ativo)
                if (data.user && !data.session) {
                    return {
                        success: false,
                        error: 'Cadastro realizado! Verifique seu e-mail para confirmar a conta antes de fazer login.',
                        needsConfirmation: true
                    };
                }

                return { success: true, user: data.user };
            } catch (error) {
                return { success: false, error: error.message || 'Erro ao cadastrar.' };
            }
        } else {
            // Fallback LocalStorage
            const { nome, sobrenome, whatsapp, email, senha, nascimento, observacoes, fotoUrl } = dados;
            const result = clientStore.create({ nome, sobrenome, whatsapp, email, senha, nascimento, observacoes, fotoUrl });
            if (!result.success) return result;

            const { senha: _, ...userSeguro } = result.user;
            setUser(userSeguro);

            notificationStore.create({
                tipo: NOTIF_TIPOS.NOVO_USUARIO,
                titulo: 'Novo cliente cadastrado',
                mensagem: `${nome} ${sobrenome} se cadastrou no sistema.`,
                destinatario: 'admin',
                nivel: NOTIF_NIVEIS.INFO,
            });

            return { success: true, user: userSeguro };
        }
    }

    // Login
    async function login(email, senha) {
        if (isSupabaseConfigured()) {
            try {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email: email.toLowerCase(),
                    password: senha,
                });
                if (error) throw error;

                // Setar user diretamente
                if (data.user) {
                    const safeUser = await fetchAndSetUserData(data.user);
                    return { success: true, user: safeUser };
                }
                return { success: true, user: data.user };
            } catch (error) {
                // Mostrar erro REAL do Supabase para debug
                const msg = error.message || '';
                if (msg.includes('Email not confirmed')) {
                    return { success: false, error: 'E-mail não confirmado. Verifique sua caixa de entrada.' };
                }
                if (msg.includes('Invalid login credentials')) {
                    return { success: false, error: 'E-mail ou senha incorretos.' };
                }
                return { success: false, error: msg || 'Erro ao fazer login.' };
            }
        } else {
            // Fallback LocalStorage
            const allUsers = clientStore.getAllIncludingAdmin();
            const found = allUsers.find(u => u.email === email.toLowerCase() && u.senha === senha);

            if (!found) return { success: false, error: 'E-mail ou senha incorretos.' };

            const { senha: _, ...userSeguro } = found;
            setUser(userSeguro);
            clientStore.update(found.id, { ultimaAtividade: new Date().toISOString() });
            return { success: true, user: userSeguro };
        }
    }

    // Logout
    async function logout() {
        if (isSupabaseConfigured()) {
            await supabase.auth.signOut();
        }
        setUser(null);
    }

    // Refresh user data
    async function refreshUser() {
        if (!user) return;
        if (isSupabaseConfigured()) {
            // Em supabase, atualizaríamos consultando a tabela profiles novamente
        } else {
            const fresh = clientStore.getById(user.id);
            if (fresh) {
                const { senha, ...safe } = fresh;
                setUser(safe);
            }
        }
    }

    const value = {
        user,
        loading,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin' || user?.email === 'admin@pixico.com',
        registrar,
        login,
        logout,
        refreshUser,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider');
    return context;
}

export default AuthContext;
