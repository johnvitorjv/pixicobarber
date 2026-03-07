import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PhotoUpload from '../components/PhotoUpload';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';

export default function RegisterPage() {
    const navigate = useNavigate();
    const { registrar } = useAuth();
    const [showSenha, setShowSenha] = useState(false);
    const [erro, setErro] = useState('');
    const [loading, setLoading] = useState(false);
    const [fotoUrl, setFotoUrl] = useState('');
    const [fotoErro, setFotoErro] = useState('');
    const [form, setForm] = useState({
        nome: '',
        sobrenome: '',
        whatsapp: '',
        email: '',
        senha: '',
        confirmarSenha: '',
        nascimento: '',
        observacoes: '',
    });

    function handleChange(e) {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
        setErro('');
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setLoading(true);
        setFotoErro('');

        // Validações
        if (!form.nome || !form.sobrenome || !form.whatsapp || !form.email || !form.senha) {
            setErro('Preencha todos os campos obrigatórios.');
            setLoading(false);
            return;
        }

        if (!fotoUrl) {
            setFotoErro('Foto de perfil é obrigatória.');
            setErro('Adicione sua foto de perfil para continuar.');
            setLoading(false);
            return;
        }

        if (form.senha.length < 6) {
            setErro('A senha deve ter pelo menos 6 caracteres.');
            setLoading(false);
            return;
        }

        if (form.senha !== form.confirmarSenha) {
            setErro('As senhas não coincidem.');
            setLoading(false);
            return;
        }

        try {
            const result = await registrar({ ...form, fotoUrl });
            if (result.success) {
                navigate('/painel');
            } else if (result.needsConfirmation) {
                // Email confirmation está ativo — informar o usuário
                setErro(result.error);
                setLoading(false);
                // Redirecionar para login após 3 segundos
                setTimeout(() => navigate('/login'), 3000);
                return;
            } else {
                setErro(result.error);
            }
        } catch (err) {
            setErro('Erro inesperado. Tente novamente.');
        }
        setLoading(false);
    }

    const inputClass = "w-full bg-black/50 border border-white/10 px-4 py-3 text-white font-modern focus:border-primary focus:outline-none transition-colors";
    const labelClass = "text-[10px] font-bold uppercase tracking-[0.5em] text-zinc-500 mb-2 block";

    const initials = (form.nome?.[0] || '') + (form.sobrenome?.[0] || '');

    return (
        <div className="min-h-screen bg-background-dark flex items-center justify-center px-4 py-16">
            <div className="w-full max-w-lg">
                {/* Back */}
                <Link to="/" className="inline-flex items-center gap-2 text-zinc-500 hover:text-primary transition-colors mb-8 text-sm font-modern">
                    <ArrowLeft size={16} />
                    Voltar ao site
                </Link>

                {/* Card */}
                <div className="bg-zinc-900/80 border border-white/10 p-8 md:p-10">
                    <div className="mb-10">
                        <h1 className="font-display font-bold text-2xl uppercase tracking-tight mb-2">Criar Conta</h1>
                        <p className="text-zinc-500 font-modern text-sm">Cadastre-se para agendar seus horários na Pixico Barber.</p>
                    </div>

                    {erro && (
                        <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-modern">
                            {erro}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Foto de perfil — obrigatória */}
                        <div className="flex flex-col items-center mb-2">
                            <label className={`${labelClass} text-center mb-3`}>Foto de perfil *</label>
                            <PhotoUpload
                                value={fotoUrl}
                                onChange={(v) => { setFotoUrl(v); setFotoErro(''); setErro(''); }}
                                initials={initials}
                                required
                                error={fotoErro}
                                size="lg"
                            />
                        </div>

                        {/* Nome + Sobrenome */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>Nome *</label>
                                <input type="text" name="nome" value={form.nome} onChange={handleChange} className={inputClass} placeholder="Seu nome" />
                            </div>
                            <div>
                                <label className={labelClass}>Sobrenome *</label>
                                <input type="text" name="sobrenome" value={form.sobrenome} onChange={handleChange} className={inputClass} placeholder="Seu sobrenome" />
                            </div>
                        </div>

                        {/* WhatsApp */}
                        <div>
                            <label className={labelClass}>WhatsApp *</label>
                            <input type="tel" name="whatsapp" value={form.whatsapp} onChange={handleChange} className={inputClass} placeholder="(71) 99999-9999" />
                        </div>

                        {/* E-mail */}
                        <div>
                            <label className={labelClass}>E-mail *</label>
                            <input type="email" name="email" value={form.email} onChange={handleChange} className={inputClass} placeholder="seu@email.com" />
                        </div>

                        {/* Senha */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>Senha *</label>
                                <div className="relative">
                                    <input
                                        type={showSenha ? 'text' : 'password'}
                                        name="senha"
                                        value={form.senha}
                                        onChange={handleChange}
                                        className={`${inputClass} pr-12`}
                                        placeholder="Mín. 6 caracteres"
                                    />
                                    <button type="button" onClick={() => setShowSenha(!showSenha)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-primary transition-colors">
                                        {showSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className={labelClass}>Confirmar *</label>
                                <input type={showSenha ? 'text' : 'password'} name="confirmarSenha" value={form.confirmarSenha} onChange={handleChange} className={inputClass} placeholder="Repita a senha" />
                            </div>
                        </div>

                        {/* Opcionais */}
                        <div className="pt-2">
                            <p className="text-[9px] font-bold uppercase tracking-[0.5em] text-zinc-600 mb-4">Campos opcionais</p>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>Nascimento</label>
                                    <input type="date" name="nascimento" value={form.nascimento} onChange={handleChange} className={inputClass} />
                                </div>
                                <div>
                                    <label className={labelClass}>Observações</label>
                                    <input type="text" name="observacoes" value={form.observacoes} onChange={handleChange} className={inputClass} placeholder="Alguma nota" />
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full group relative overflow-hidden bg-primary text-black py-4 font-display font-bold uppercase tracking-[0.5em] text-xs hover:scale-[1.02] transition-transform disabled:opacity-50 mt-4"
                        >
                            <span className="relative z-10 group-hover:text-white transition-colors duration-500">
                                {loading ? 'Cadastrando...' : 'Criar Conta'}
                            </span>
                            <div className="absolute inset-0 bg-black translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                        </button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-white/5 text-center">
                        <p className="text-sm text-zinc-500 font-modern">
                            Já tem conta?{' '}
                            <Link to="/login" className="text-primary hover:underline">
                                Entrar
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
