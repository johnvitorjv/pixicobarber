import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import notificationStore from '../../stores/notificationStore';
import clientStore from '../../stores/clientStore';
import { Avatar } from '../../components/PhotoUpload';
import {
    LayoutDashboard, CalendarDays, Users, Clock, DollarSign,
    Bell, Settings, LogOut, Menu, X, ChevronRight, Calendar, Shield, Star, Scissors
} from 'lucide-react';

const NAV_ITEMS = [
    { path: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/admin/agendamentos', icon: Clock, label: 'Agendamentos' },
    { path: '/admin/calendario', icon: CalendarDays, label: 'Calendário' },
    { path: '/admin/servicos', icon: Scissors, label: 'Serviços' },
    { path: '/admin/clientes', icon: Users, label: 'Clientes' },
    { path: '/admin/disponibilidade', icon: Calendar, label: 'Disponibilidade' },
    { path: '/admin/financeiro', icon: DollarSign, label: 'Financeiro' },
    { path: '/admin/notificacoes', icon: Bell, label: 'Notificações' },
    { path: '/admin/configuracoes', icon: Settings, label: 'Configurações' },
];

export default function AdminLayout() {
    const { user, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const notifsNaoLidas = notificationStore.getContadorAdmin();

    function handleLogout() {
        logout();
        navigate('/');
    }

    function isActive(path) {
        if (path === '/admin') return location.pathname === '/admin';
        return location.pathname.startsWith(path);
    }

    return (
        <div className="min-h-screen bg-background-dark flex">
            {/* Sidebar Desktop */}
            <aside className="hidden lg:flex flex-col w-64 bg-black/80 border-r border-white/5 fixed h-full z-40">
                {/* Logo */}
                <div className="p-6 border-b border-white/5">
                    <Link to="/" className="font-display font-bold text-xl uppercase tracking-tighter text-white hover:text-primary transition-colors">
                        Pixico
                    </Link>
                    <span className="block text-[9px] font-bold uppercase tracking-[0.5em] text-primary/60 mt-1">Admin</span>
                </div>

                {/* Nav */}
                <nav className="flex-1 py-4 overflow-y-auto">
                    {NAV_ITEMS.map(item => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex items-center gap-3 px-6 py-3 text-sm font-modern transition-all relative ${isActive(item.path)
                                ? 'text-primary bg-primary/5 border-l-2 border-primary'
                                : 'text-zinc-500 hover:text-white hover:bg-white/5 border-l-2 border-transparent'
                                }`}
                        >
                            <item.icon size={18} />
                            {item.label}
                            {item.label === 'Notificações' && notifsNaoLidas > 0 && (
                                <span className="ml-auto bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full">
                                    {notifsNaoLidas > 9 ? '9+' : notifsNaoLidas}
                                </span>
                            )}
                        </Link>
                    ))}
                </nav>

                {/* Footer */}
                <div className="p-4 border-t border-white/5">
                    <div className="flex items-center gap-3 px-2 mb-3">
                        <Avatar src={clientStore.getById(user?.id)?.fotoUrl} initials={user?.nome?.[0] || 'A'} size="sm" />
                        <div className="flex-1 min-w-0">
                            <span className="text-sm font-modern text-white block truncate">{user?.nome}</span>
                            <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Admin</span>
                        </div>
                    </div>
                    <button onClick={handleLogout} className="flex items-center gap-2 text-zinc-600 hover:text-red-400 transition-colors text-xs font-modern w-full px-2 py-2">
                        <LogOut size={14} /> Sair
                    </button>
                </div>
            </aside>

            {/* Mobile Header */}
            <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-xl border-b border-white/5">
                <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setSidebarOpen(true)} className="text-white">
                            <Menu size={22} />
                        </button>
                        <Link to="/admin" className="font-display font-bold text-lg uppercase tracking-tighter">Pixico</Link>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link to="/admin/notificacoes" className="relative text-zinc-400 hover:text-primary transition-colors">
                            <Bell size={18} />
                            {notifsNaoLidas > 0 && (
                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
                                    {notifsNaoLidas > 9 ? '9+' : notifsNaoLidas}
                                </span>
                            )}
                        </Link>
                    </div>
                </div>
            </div>

            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div className="lg:hidden fixed inset-0 z-50">
                    <div className="absolute inset-0 bg-black/80" onClick={() => setSidebarOpen(false)} />
                    <div className="absolute left-0 top-0 bottom-0 w-72 bg-background-dark border-r border-white/5 flex flex-col">
                        <div className="p-4 flex items-center justify-between border-b border-white/5">
                            <span className="font-display font-bold uppercase tracking-tighter">Admin</span>
                            <button onClick={() => setSidebarOpen(false)} className="text-zinc-400"><X size={20} /></button>
                        </div>
                        <nav className="flex-1 py-4">
                            {NAV_ITEMS.map(item => (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    onClick={() => setSidebarOpen(false)}
                                    className={`flex items-center gap-3 px-6 py-3.5 text-sm font-modern transition-all ${isActive(item.path) ? 'text-primary bg-primary/5' : 'text-zinc-500 hover:text-white'
                                        }`}
                                >
                                    <item.icon size={18} />
                                    {item.label}
                                </Link>
                            ))}
                        </nav>
                        <div className="p-4 border-t border-white/5">
                            <button onClick={handleLogout} className="flex items-center gap-2 text-zinc-600 hover:text-red-400 text-sm font-modern">
                                <LogOut size={14} /> Sair
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <main className="flex-1 lg:ml-64 pt-14 lg:pt-0 min-h-screen">
                <Outlet />
            </main>
        </div>
    );
}
