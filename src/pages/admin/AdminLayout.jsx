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
        <div className="min-h-screen bg-background-dark flex text-white font-modern">
            {/* Sidebar Desktop */}
            <aside className="hidden lg:flex flex-col w-64 bg-black border-r border-white/5 fixed h-full z-40">
                {/* Logo */}
                <div className="p-8 border-b border-white/5 flex flex-col items-start justify-center">
                    <Link to="/" className="font-display font-bold text-2xl uppercase tracking-tighter text-white hover:text-primary transition-colors flex items-center gap-2">
                        <div className="w-8 h-8 flex items-center justify-center bg-primary/10 rounded-full border border-primary/20"><span className="text-primary text-sm perspective-text">PX</span></div>
                        Pixico
                    </Link>
                    <span className="block text-[8px] font-bold uppercase tracking-[0.8em] text-zinc-500 mt-2 pl-10">Admin Panel</span>
                </div>

                {/* Nav */}
                <nav className="flex-1 py-4 overflow-y-auto">
                    {NAV_ITEMS.map(item => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex items-center gap-4 px-8 py-3.5 text-[11px] font-bold uppercase tracking-[0.2em] transition-all relative group ${isActive(item.path)
                                ? 'text-white'
                                : 'text-zinc-500 hover:text-white'
                                }`}
                        >
                            {/* Animated Left Border */}
                            <span className={`absolute left-0 top-0 bottom-0 w-[2px] bg-primary transition-transform origin-left ${isActive(item.path) ? 'scale-y-100' : 'scale-y-0 group-hover:scale-y-100'}`} />
                            {/* Animated Background */}
                            <div className={`absolute inset-0 bg-primary/5 transition-opacity ${isActive(item.path) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />

                            <item.icon size={16} className={`relative z-10 transition-colors ${isActive(item.path) ? 'text-primary' : 'group-hover:text-primary/70'}`} />
                            <span className="relative z-10">{item.label}</span>
                            {item.label === 'Notificações' && notifsNaoLidas > 0 && (
                                <span className="ml-auto bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full">
                                    {notifsNaoLidas > 9 ? '9+' : notifsNaoLidas}
                                </span>
                            )}
                        </Link>
                    ))}
                </nav>

                {/* Footer */}
                <div className="p-6 border-t border-white/5 mt-auto">
                    <div className="flex items-center gap-4 mb-4">
                        <Avatar src={clientStore.getById(user?.id)?.fotoUrl} initials={user?.nome?.[0] || 'A'} size="sm" className="ring-1 ring-primary/20" />
                        <div className="flex-1 min-w-0">
                            <span className="text-sm font-bold text-white block truncate">{user?.nome}</span>
                            <span className="text-[9px] text-primary uppercase tracking-[0.3em] font-bold">Admin</span>
                        </div>
                    </div>
                    <button onClick={handleLogout} className="group flex items-center gap-3 text-zinc-500 hover:text-red-400 transition-colors text-[10px] font-bold uppercase tracking-widest w-full py-2">
                        <LogOut size={16} className="group-hover:-translate-x-1 transition-transform" /> Sair
                    </button>
                </div>
            </aside>

            {/* Mobile Header */}
            <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/5">
                <div className="flex items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setSidebarOpen(true)} className="text-white hover:text-primary transition-colors">
                            <Menu size={24} />
                        </button>
                        <Link to="/admin" className="font-display font-bold text-xl uppercase tracking-tighter flex items-center gap-2">
                            <div className="w-6 h-6 flex items-center justify-center bg-primary/10 rounded-full border border-primary/20"><span className="text-primary text-[10px]">PX</span></div>
                            Pixico
                        </Link>
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
                <div className="lg:hidden fixed inset-0 z-[60]">
                    <div className="absolute inset-0 bg-background-dark/90 backdrop-blur-sm transition-opacity" onClick={() => setSidebarOpen(false)} />
                    <div className="absolute left-0 top-0 bottom-0 w-[80%] max-w-sm bg-black border-r border-white/5 flex flex-col shadow-2xl">
                        <div className="p-6 flex items-center justify-between border-b border-white/5">
                            <div className="flex flex-col">
                                <span className="font-display font-bold text-xl uppercase tracking-tighter text-white">Pixico</span>
                                <span className="text-[8px] font-bold uppercase tracking-[0.8em] text-zinc-500 mt-1">Admin Panel</span>
                            </div>
                            <button onClick={() => setSidebarOpen(false)} className="text-zinc-500 hover:text-white transition-colors p-2"><X size={20} /></button>
                        </div>
                        <nav className="flex-1 py-6 overflow-y-auto">
                            {NAV_ITEMS.map(item => (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    onClick={() => setSidebarOpen(false)}
                                    className={`flex items-center gap-4 px-6 py-4 text-[11px] font-bold uppercase tracking-[0.2em] transition-all relative ${isActive(item.path) ? 'text-white bg-primary/5' : 'text-zinc-500 hover:text-white'
                                        }`}
                                >
                                    <span className={`absolute left-0 top-0 bottom-0 w-[2px] bg-primary transition-transform origin-left ${isActive(item.path) ? 'scale-y-100' : 'scale-y-0'}`} />
                                    <item.icon size={18} className={`${isActive(item.path) ? 'text-primary' : ''}`} />
                                    {item.label}
                                </Link>
                            ))}
                        </nav>
                        <div className="p-6 border-t border-white/5 bg-black">
                            <div className="flex items-center gap-4 mb-6">
                                <Avatar src={clientStore.getById(user?.id)?.fotoUrl} initials={user?.nome?.[0] || 'A'} size="sm" className="ring-1 ring-primary/20" />
                                <div className="flex-1 min-w-0">
                                    <span className="text-sm font-bold text-white block truncate">{user?.nome}</span>
                                    <span className="text-[9px] text-primary uppercase tracking-[0.3em] font-bold">Admin</span>
                                </div>
                            </div>
                            <button onClick={handleLogout} className="flex items-center gap-3 text-zinc-500 hover:text-red-400 transition-colors text-[10px] font-bold uppercase tracking-widest w-full py-2">
                                <LogOut size={16} /> Sair
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
