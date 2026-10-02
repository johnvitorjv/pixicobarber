import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/auth';

export default function RecoveryPage() {
    const { recoverPassword, changePassword, recovery, loading } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    async function submit(event) {
        event.preventDefault();
        if (busy) return;
        setBusy(true); setError(''); setMessage('');
        try {
            if (recovery) {
                if (password !== confirmation) throw new Error('As senhas não coincidem.');
                await changePassword(password);
                navigate('/login', { replace: true, state: { message: 'Senha alterada. Entre com sua nova senha.' } });
            } else {
                await recoverPassword(email);
                setMessage('Se houver uma conta com esse e-mail, você receberá um link para recuperar o acesso.');
            }
        } catch (err) { setError(err.message); }
        finally { setBusy(false); }
    }
    return <div className="min-h-screen bg-background-dark flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-zinc-900/80 border border-white/10 p-8">
            <h1 className="font-display text-2xl font-bold uppercase mb-6">{recovery ? 'Nova senha' : 'Recuperar acesso'}</h1>
            {message && <p role="status" className="text-green-400 mb-6">{message}</p>}
            {error && <p role="alert" className="text-red-400 mb-6">{error}</p>}
            <form onSubmit={submit} className="space-y-6">
                {recovery ? <>
                    <label className="block">Nova senha<input required minLength={8} type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className="block w-full bg-black border border-white/20 p-3 mt-2" /></label>
                    <label className="block">Confirmar senha<input required minLength={8} type="password" autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)} className="block w-full bg-black border border-white/20 p-3 mt-2" /></label>
                </> : <label className="block">E-mail<input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="block w-full bg-black border border-white/20 p-3 mt-2" /></label>}
                <button disabled={busy || loading} className="w-full bg-primary text-black py-4 font-bold uppercase disabled:opacity-50">{busy ? 'Aguarde...' : recovery ? 'Salvar senha' : 'Enviar link'}</button>
            </form>
            <Link to="/login" className="block text-primary mt-6">Voltar para login</Link>
        </div>
    </div>;
}
