import { useState, useRef, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { homeForRole, useAuth } from '@/context/useAuth';
import { useApp } from '@/context/useApp';
import { Bell, Search, ChevronDown, RefreshCw, LogOut, Menu, RotateCcw, Settings, User } from 'lucide-react';
import clsx from 'clsx';

export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
    const { user, logout, demoLogin, demoAccounts, isMockMode } = useAuth();
    const { getNotificationsByUser, markNotificationRead, resetDemoData } = useApp();
    const navigate = useNavigate();
    const [notifOpen, setNotifOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [searchVal, setSearchVal] = useState('');
    const notifRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    if (!user) return null;

    const role = user.role;
    const userId = user.profile.id;
    const userName = user.profile.name;
    const userInitials = userName.split(/\s+/).filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase();
    const notifications = getNotificationsByUser(userId);
    const unread = notifications.filter(n => !n.read).length;

    // The role switcher belongs to the demo accounts. Real accounts stay in their own role.
    const canSwitchDemoAccount = isMockMode && user.isDemo;
    const sameRoleDemoAccounts = demoAccounts.filter(account => account.role === role);
    const otherRole = role === 'beneficiary' ? 'lender' : 'beneficiary';

    const switchAccount = async (accountId: string) => {
        const next = await demoLogin(accountId);
        setMenuOpen(false);
        navigate(homeForRole(next.role));
    };

    const handleSwitchRole = () => {
        const target = demoAccounts.find(account => account.role === otherRole);
        if (target) void switchAccount(target.id);
    };

    const handleSearch = (e: FormEvent) => {
        e.preventDefault();
        const query = searchVal.trim();
        navigate(`/${role}/applications${query ? `?q=${encodeURIComponent(query)}` : ''}`);
    };

    const handleLogout = async () => {
        setMenuOpen(false);
        await logout();
        navigate('/login', { replace: true });
    };

    const handleReset = () => {
        if (window.confirm('Reset all applications, offers and notifications to the original demo data?')) {
            resetDemoData();
            setMenuOpen(false);
            navigate(homeForRole(role));
        }
    };

    return (
        <header className="h-14 bg-[#161b22] border-b border-[#30363d] flex items-center gap-2 sm:gap-4 px-3 sm:px-5 flex-shrink-0">
            <button onClick={onOpenMenu} aria-label="Open menu" className="p-2 -ml-1 text-slate-400 hover:text-white md:hidden">
                <Menu size={20} />
            </button>

            {/* Search */}
            <form onSubmit={handleSearch} role="search" className="flex-1 max-w-md min-w-0">
                <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                        type="search"
                        aria-label="Search applications"
                        value={searchVal}
                        onChange={e => setSearchVal(e.target.value)}
                        placeholder={role === 'lender' ? 'Search applicant or ID...' : 'Search your applications...'}
                        className="w-full pl-9 pr-3 py-1.5 bg-[#0d1117] border border-[#30363d] rounded-lg text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                    />
                </div>
            </form>

            <div className="flex items-center gap-2 sm:gap-3 ml-auto flex-shrink-0">
                {canSwitchDemoAccount && (
                    <>
                        {/* Role Switcher */}
                        <div className="hidden lg:flex items-center gap-2 bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-1.5">
                            <span className="text-xs text-slate-500">Demo role:</span>
                            <button
                                onClick={handleSwitchRole}
                                className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                                title={`Switch to the ${otherRole} demo`}
                            >
                                <RefreshCw size={12} />
                                <span className="capitalize">{role}</span>
                            </button>
                        </div>

                        {/* User selector (demo) */}
                        <select
                            aria-label="Demo account"
                            className="hidden xl:block bg-[#0d1117] border border-[#30363d] rounded-lg px-2 py-1.5 text-xs text-slate-400 focus:outline-none"
                            value={userId}
                            onChange={e => void switchAccount(e.target.value)}
                        >
                            {sameRoleDemoAccounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
                        </select>
                    </>
                )}

                {/* Notifications */}
                <div className="relative" ref={notifRef}>
                    <button
                        onClick={() => setNotifOpen(v => !v)}
                        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
                        aria-expanded={notifOpen}
                        className="relative w-9 h-9 bg-[#0d1117] border border-[#30363d] rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:border-slate-500 transition-all"
                    >
                        <Bell size={16} />
                        {unread > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] flex items-center justify-center font-bold">
                                {unread > 9 ? '9+' : unread}
                            </span>
                        )}
                    </button>
                    {notifOpen && (
                        <div className="fixed sm:absolute inset-x-3 sm:inset-x-auto sm:right-0 top-14 sm:top-11 sm:w-80 bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl z-50 overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-3 border-b border-[#30363d]">
                                <h3 className="text-sm font-semibold text-white">Notifications</h3>
                                {unread > 0 && <span className="text-xs text-slate-500">{unread} unread</span>}
                            </div>
                            <div className="max-h-72 overflow-y-auto">
                                {notifications.length === 0 ? (
                                    <p className="text-slate-500 text-sm p-4 text-center">No notifications</p>
                                ) : notifications.slice(0, 6).map(n => (
                                    <button
                                        key={n.id}
                                        onClick={() => { markNotificationRead(n.id); setNotifOpen(false); }}
                                        className={clsx(
                                            'w-full text-left px-4 py-3 border-b border-[#30363d] last:border-0 hover:bg-white/5 transition-colors',
                                            !n.read && 'bg-blue-500/5'
                                        )}
                                    >
                                        <div className="flex items-start gap-2">
                                            <span className={clsx(
                                                'w-2 h-2 rounded-full flex-shrink-0 mt-1.5',
                                                n.type === 'success' ? 'bg-emerald-400' :
                                                    n.type === 'error' ? 'bg-red-400' :
                                                        n.type === 'warning' ? 'bg-amber-400' : 'bg-blue-400'
                                            )} />
                                            <div>
                                                <p className={clsx('text-xs font-medium', n.read ? 'text-slate-400' : 'text-white')}>{n.title}</p>
                                                <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>
                                                <p className="text-[10px] text-slate-600 mt-1">{new Date(n.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={() => { setNotifOpen(false); navigate(`/${role}/notifications`); }}
                                className="w-full px-4 py-2.5 border-t border-[#30363d] text-xs font-medium text-emerald-400 hover:bg-white/5 transition-colors"
                            >
                                View all notifications
                            </button>
                        </div>
                    )}
                </div>

                {/* User menu */}
                <div className="relative" ref={menuRef}>
                    <button
                        onClick={() => setMenuOpen(v => !v)}
                        aria-label="Account menu"
                        aria-expanded={menuOpen}
                        className="flex items-center gap-2 rounded-lg hover:bg-white/5 transition-colors sm:pr-1"
                    >
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                            {userInitials}
                        </div>
                        <div className="hidden sm:block text-left max-w-36">
                            <p className="text-sm font-medium text-white leading-tight truncate">{userName}</p>
                            <p className="text-xs text-slate-500 capitalize">{role}{user.isDemo ? ' · Demo' : ''}</p>
                        </div>
                        <ChevronDown size={14} className={clsx('hidden sm:block text-slate-500 transition-transform', menuOpen && 'rotate-180')} />
                    </button>
                    {menuOpen && (
                        <div className="absolute right-0 top-11 w-56 bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl z-50 overflow-hidden py-1">
                            <button
                                onClick={() => { setMenuOpen(false); navigate(role === 'lender' ? '/lender/settings' : '/beneficiary/profile'); }}
                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5 transition-colors"
                            >
                                {role === 'lender' ? <Settings size={15} /> : <User size={15} />}
                                {role === 'lender' ? 'Settings' : 'Profile'}
                            </button>
                            {canSwitchDemoAccount && (
                                <button
                                    onClick={handleSwitchRole}
                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5 transition-colors lg:hidden"
                                >
                                    <RefreshCw size={15} /> <span>Switch to {otherRole} demo</span>
                                </button>
                            )}
                            {isMockMode && (
                                <button
                                    onClick={handleReset}
                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5 transition-colors"
                                >
                                    <RotateCcw size={15} /> Reset demo data
                                </button>
                            )}
                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 border-t border-[#30363d] mt-1 transition-colors"
                            >
                                <LogOut size={15} /> Log Out
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
