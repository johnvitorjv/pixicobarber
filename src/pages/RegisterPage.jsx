import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/auth';
import { bahiaDate } from '../lib/bookingRules';
import PhotoUpload from '../components/PhotoUpload';
import { CalendarInput } from '../components/CalendarPicker';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';

export default function RegisterPage() {
    const navigate = useNavigate();
    const { registrar } = useAuth();
    const [showSenha, setShowSenha] = useState(false);
    const [erro, setErro] = useState('');
    const [message, setMessage] = useState('');
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
        if (loading) return;
        setLoading(true);
        setMessage('');

        // Validações
        if (!fotoUrl) {
            setFotoErro('Adicione uma foto de perfil para continuar.');
            setErro('A foto de perfil é obrigatória para o cadastro.');
            setLoading(false);
            return;
        }

        if (!form.nome.trim() || !form.sobrenome.trim() || !/^\d{10,13}$/.test(form.whatsapp.replace(/\D/g, '')) || !form.email.trim() || !form.senha) {
            setErro('Preencha todos os campos obrigatórios.');
            setLoading(false);
            return;
        }

        if (form.senha.length < 8) {
            setErro('A senha deve ter pelo menos 8 caracteres.');
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
            if (result.needsConfirmation) {
                setMessage(result.message);
            } else if (result.success) {
                navigate('/painel');
            } else {
                setErro(result.error);
            }
        } catch {
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

                    {message && <p role="status" className="text-green-400 mb-6">{message} <Link to="/login" className="underline">Entrar</Link></p>}
                    {erro && (
                        <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-modern">
                            {erro}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Foto obrigatória para identificação do cliente pelo profissional. */}
                        <div className="flex flex-col items-center gap-3 mb-2">
                            <PhotoUpload
                                value={fotoUrl}
                                onChange={(value) => { setFotoUrl(value); setFotoErro(''); setErro(''); }}
                                initials={initials}
                                required
                                error={fotoErro}
                                size="lg"
                            />
                            <p className="text-xs text-zinc-500 text-center max-w-sm">
                                Foto obrigatória. Ela ajuda o barbeiro a reconhecer você mesmo quando usa apelido ou nome diferente no dia a dia.
                            </p>
                        </div>

                        {/* Nome + Sobrenome */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>Nome *</label>
                                <input type="text" name="nome" required maxLength={100} autoComplete="given-name" value={form.nome} onChange={handleChange} className={inputClass} placeholder="Seu nome" />
                            </div>
                            <div>
                                <label className={labelClass}>Sobrenome *</label>
                                <input type="text" name="sobrenome" required maxLength={100} autoComplete="family-name" value={form.sobrenome} onChange={handleChange} className={inputClass} placeholder="Seu sobrenome" />
                            </div>
                        </div>

                        {/* WhatsApp */}
                        <div>
                            <label className={labelClass}>WhatsApp *</label>
                            <input type="tel" name="whatsapp" maxLength={20} required autoComplete="tel" value={form.whatsapp} onChange={handleChange} className={inputClass} placeholder="(71) 99999-9999" />
                        </div>

                        {/* E-mail */}
                        <div>
                            <label className={labelClass}>E-mail *</label>
                            <input type="email" name="email" required autoComplete="email" value={form.email} onChange={handleChange} className={inputClass} placeholder="seu@email.com" />
                        </div>

                        {/* Senha */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>Senha *</label>
                                <div className="relative">
                                    <input
                                        type={showSenha ? 'text' : 'password'}
                                        name="senha" required minLength={8} autoComplete="new-password"
                                        value={form.senha}
                                        onChange={handleChange}
                                        className={`${inputClass} pr-12`}
                                        placeholder="Mín. 8 caracteres"
                                    />
                                    <button type="button" onClick={() => setShowSenha(!showSenha)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-primary transition-colors">
                                        {showSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className={labelClass}>Confirmar *</label>
                                <input type={showSenha ? 'text' : 'password'} name="confirmarSenha" required minLength={8} autoComplete="new-password" value={form.confirmarSenha} onChange={handleChange} className={inputClass} placeholder="Repita a senha" />
                            </div>
                        </div>

                        {/* Opcionais */}
                        <div className="pt-2">
                            <p className="text-[9px] font-bold uppercase tracking-[0.5em] text-zinc-600 mb-4">Campos opcionais</p>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>Nascimento</label>
                                    <CalendarInput label="Data de nascimento" value={form.nascimento} maxDate={bahiaDate()} onChange={date => setForm(prev => ({ ...prev, nascimento:date }))} />
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
