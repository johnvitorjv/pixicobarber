import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/auth';
export default function SessionNotice() {
    const { error, recovery, loggingOut, completeLogout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    useEffect(() => {
        if (recovery && location.pathname !== '/recuperar-acesso') navigate('/recuperar-acesso', { replace: true });
    }, [recovery, location.pathname, navigate]);
    useEffect(() => { if (loggingOut && location.pathname === '/') completeLogout(); }, [loggingOut, location.pathname, completeLogout]);
    return error ? <p role="alert" className="relative z-[110] bg-red-950 text-white p-4 text-center">{error}</p> : null;
}
