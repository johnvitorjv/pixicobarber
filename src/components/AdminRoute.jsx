import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/auth';

export default function AdminRoute({ children }) {
    const { isAuthenticated, isAdmin, loading, loggingOut } = useAuth();

    if (loading || loggingOut) {
        return (
            <div className="min-h-screen bg-background-dark flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!isAuthenticated || !isAdmin) {
        return <Navigate to="/login" replace />;
    }

    return children;
}
