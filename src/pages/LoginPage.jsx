import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';

export default function LoginPage() {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [form, setForm] = useState({ email: '', senha: '' });
    const [showSenha, setShowSenha] = useState(false);
    const [erro, setErro] = useState('');
    const [loading, setLoading] = useState(false);

    function handleChange(e) {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
        setErro('');
    }

    function handleSubmit(e) {
        e.preventDefault();
        setLoading(true);

        if (!form.email || !form.senha) {
            setErro('Preencha todos os campos.');
            setLoading(false);
            return;
        }

        const result = login(form.email, form.senha);
        if (result.success) {
            navigate(result.user.role === 'admin' ? '/admin' : '/painel');
        } else {
            setErro(result.error);
        }
        setLoading(false);
    }

    return (
        <div className="min-h-screen bg-background-dark flex items-center justify-center px-4">
            <div className="w-full max-w-md">
                {/* Back */}
                <Link to="/" className="inline-flex items-center gap-2 text-zinc-500 hover:text-primary transition-colors mb-8 text-sm font-modern">
                    <ArrowLeft size={16} />
                    Voltar ao site
                </Link>

                {/* Card */}
                <div className="bg-zinc-900/80 border border-white/10 p-8 md:p-10">
                    {/* Header */}
                    <div className="mb-10">
                        <h1 className="font-display font-bold text-2xl uppercase tracking-tight mb-2">Entrar</h1>
                        <p className="text-zinc-500 font-modern text-sm">Acesse sua conta para gerenciar seus agendamentos.</p>
                    </div>

                    {/* Error */}
                    {erro && (
                        <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-modern">
                            {erro}
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-[0.5em] text-zinc-500 mb-2 block">E-mail</label>
                            <input
                                type="email"
                                name="email"
                                value={form.email}
                                onChange={handleChange}
                                className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white font-modern focus:border-primary focus:outline-none transition-colors"
                                placeholder="seu@email.com"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-[0.5em] text-zinc-500 mb-2 block">Senha</label>
                            <div className="relative">
                                <input
                                    type={showSenha ? 'text' : 'password'}
                                    name="senha"
                                    value={form.senha}
                                    onChange={handleChange}
                                    className="w-full bg-black/50 border border-white/10 px-4 py-3 text-white font-modern focus:border-primary focus:outline-none transition-colors pr-12"
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowSenha(!showSenha)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-primary transition-colors"
                                >
                                    {showSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <button type="button" className="text-xs text-zinc-500 hover:text-primary transition-colors font-modern">
                                Esqueci minha senha
                            </button>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full group relative overflow-hidden bg-primary text-black py-4 font-display font-bold uppercase tracking-[0.5em] text-xs hover:scale-[1.02] transition-transform disabled:opacity-50"
                        >
                            <span className="relative z-10 group-hover:text-white transition-colors duration-500">
                                {loading ? 'Entrando...' : 'Entrar'}
                            </span>
                            <div className="absolute inset-0 bg-black translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                        </button>
                    </form>

                    {/* Register Link */}
                    <div className="mt-8 pt-6 border-t border-white/5 text-center">
                        <p className="text-sm text-zinc-500 font-modern">
                            Não tem conta?{' '}
                            <Link to="/cadastro" className="text-primary hover:underline">
                                Cadastre-se
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
