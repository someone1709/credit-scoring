import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRole } from '@/context/RoleContext';
import { useApp } from '@/context/AppContext';
import { Bell, Search, ChevronDown, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import { MOCK_BENEFICIARIES, MOCK_LENDERS } from '@/data/mockData';

export function Topbar() {
    const { role, beneficiary, lender, switchRole, switchBeneficiary, switchLender } = useRole();
    const { getNotificationsByUser, markNotificationRead } = useApp();
    const navigate = useNavigate();
    const [notifOpen, setNotifOpen] = useState(false);
    const [searchVal, setSearchVal] = useState('');
    const notifRef = useRef<HTMLDivElement>(null);

    const userId = role === 'beneficiary' ? beneficiary.id : lender.id;
    const userName = role === 'beneficiary' ? beneficiary.name : lender.name;
    const userInitials = userName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    const notifications = getNotificationsByUser(userId);
    const unread = notifications.filter(n => !n.read).length;

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
                setNotifOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const handleSwitch = () => {
        const newRole = role === 'beneficiary' ? 'lender' : 'beneficiary';
        switchRole(newRole);
        navigate(newRole === 'beneficiary' ? '/beneficiary/dashboard' : '/lender/dashboard');
    };

    return (
        <header className="h-14 bg-[#161b22] border-b border-[#30363d] flex items-center gap-4 px-5 flex-shrink-0">
            {/* Search */}
            <div className="flex-1 max-w-md">
                <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                        type="text"
                        value={searchVal}
                        onChange={e => setSearchVal(e.target.value)}
                        placeholder="Search for loans, offers or help..."
                        className="w-full pl-9 pr-4 py-1.5 bg-[#0d1117] border border-[#30363d] rounded-lg text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                    />
                </div>
            </div>

            <div className="flex items-center gap-3 ml-auto">
                {/* Role Switcher */}
                <div className="flex items-center gap-2 bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-1.5">
                    <span className="text-xs text-slate-500">Role:</span>
                    <button
                        onClick={handleSwitch}
                        className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                        title="Switch role"
                    >
                        <RefreshCw size={12} />
                        <span className="capitalize">{role === 'beneficiary' ? 'Beneficiary' : 'Lender'}</span>
                    </button>
                </div>

                {/* User selector (demo) */}
                {role === 'beneficiary' ? (
                    <select
                        className="bg-[#0d1117] border border-[#30363d] rounded-lg px-2 py-1.5 text-xs text-slate-400 focus:outline-none"
                        value={beneficiary.id}
                        onChange={e => switchBeneficiary(e.target.value)}
                    >
                        {MOCK_BENEFICIARIES.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                ) : (
                    <select
                        className="bg-[#0d1117] border border-[#30363d] rounded-lg px-2 py-1.5 text-xs text-slate-400 focus:outline-none"
                        value={lender.id}
                        onChange={e => switchLender(e.target.value)}
                    >
                        {MOCK_LENDERS.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                )}

                {/* Notifications */}
                <div className="relative" ref={notifRef}>
                    <button
                        onClick={() => setNotifOpen(v => !v)}
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
                        <div className="absolute right-0 top-11 w-80 bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl z-50 overflow-hidden">
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
                        </div>
                    )}
                </div>

                {/* User avatar */}
                <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                        {userInitials}
                    </div>
                    <div className="hidden sm:block">
                        <p className="text-sm font-medium text-white leading-tight">{userName}</p>
                        <p className="text-xs text-slate-500 capitalize">{role}</p>
                    </div>
                    <ChevronDown size={14} className="text-slate-500" />
                </div>
            </div>
        </header>
    );
}
