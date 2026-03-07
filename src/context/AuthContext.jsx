import { createContext, useContext, useState, useEffect } from 'react';
import clientStore from '../stores/clientStore';
import notificationStore from '../stores/notificationStore';
import { NOTIF_TIPOS, NOTIF_NIVEIS } from '../data/models';

// ═══════════════════════════════════════════════
// PIXICO BARBER — Contexto de Autenticação v2
// ═══════════════════════════════════════════════

const AuthContext = createContext(null);
const STORAGE_KEY = 'pixico_auth';

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Seed admin user na inicialização
    useEffect(() => {
        clientStore.seedAdmin();
    }, []);

    // Carregar sessão do localStorage ao iniciar
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                // Revalidar que o user ainda existe no store
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
    }, []);

    // Persistir sessão
    useEffect(() => {
        if (user) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }
    }, [user]);

    // Cadastro
    function registrar({ nome, sobrenome, whatsapp, email, senha, nascimento, observacoes, fotoUrl }) {
        const result = clientStore.create({ nome, sobrenome, whatsapp, email, senha, nascimento, observacoes, fotoUrl });
        if (!result.success) return result;

        const { senha: _, ...userSeguro } = result.user;
        setUser(userSeguro);

        // Notificação para o admin
        notificationStore.create({
            tipo: NOTIF_TIPOS.NOVO_USUARIO,
            titulo: 'Novo cliente cadastrado',
            mensagem: `${nome} ${sobrenome} se cadastrou no sistema.`,
            destinatario: 'admin',
            nivel: NOTIF_NIVEIS.INFO,
        });

        return { success: true, user: userSeguro };
    }

    // Login
    function login(email, senha) {
        const allUsers = clientStore.getAllIncludingAdmin();
        const found = allUsers.find(u => u.email === email.toLowerCase() && u.senha === senha);

        if (!found) {
            return { success: false, error: 'E-mail ou senha incorretos.' };
        }

        const { senha: _, ...userSeguro } = found;
        setUser(userSeguro);
        clientStore.update(found.id, { ultimaAtividade: new Date().toISOString() });
        return { success: true, user: userSeguro };
    }

    // Logout
    function logout() {
        setUser(null);
    }

    // Refresh user data from store
    function refreshUser() {
        if (!user) return;
        const fresh = clientStore.getById(user.id);
        if (fresh) {
            const { senha, ...safe } = fresh;
            setUser(safe);
        }
    }

    const value = {
        user,
        loading,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin',
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
    if (!context) {
        throw new Error('useAuth deve ser usado dentro de AuthProvider');
    }
    return context;
}

export default AuthContext;
