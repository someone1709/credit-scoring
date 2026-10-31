import { NavLink, useNavigate } from 'react-router-dom';
import { useRole } from '@/context/RoleContext';
import { useApp } from '@/context/AppContext';
import clsx from 'clsx';
import {
    LayoutDashboard, FilePlus, FileText, Upload, Gift, CreditCard, Bell, User,
    HelpCircle, LogOut, TrendingUp, Users, BarChart3, Settings, Wallet,
    ChevronLeft, ChevronRight, CheckSquare,
} from 'lucide-react';
import { useState } from 'react';

const beneficiaryLinks = [
    { to: '/beneficiary/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/beneficiary/apply', label: 'Apply for Loan', icon: FilePlus },
    { to: '/beneficiary/applications', label: 'My Applications', icon: FileText },
    { to: '/beneficiary/documents', label: 'Documents', icon: Upload },
    { to: '/beneficiary/offers', label: 'Offers from Lenders', icon: Gift },
    { to: '/beneficiary/disbursement', label: 'Disbursement', icon: Wallet },
    { to: '/beneficiary/notifications', label: 'Notifications', icon: Bell },
    { to: '/beneficiary/profile', label: 'Profile', icon: User },
    { to: '/beneficiary/help', label: 'Help & Support', icon: HelpCircle },
];

const lenderLinks = [
    { to: '/lender/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/lender/applications', label: 'Loan Applications', icon: FileText },
    { to: '/lender/offers', label: 'My Offers', icon: Gift },
    { to: '/lender/accepted-offers', label: 'Accepted Offers', icon: CheckSquare },
    { to: '/lender/disbursement', label: 'Disbursement', icon: Wallet },
    { to: '/lender/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/lender/settings', label: 'Settings', icon: Settings },
];

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
    const { role, beneficiary, lender } = useRole();
    const { getNotificationsByUser } = useApp();
    const navigate = useNavigate();
    const links = role === 'beneficiary' ? beneficiaryLinks : lenderLinks;
    const userId = role === 'beneficiary' ? beneficiary.id : lender.id;
    const unread = getNotificationsByUser(userId).filter(n => !n.read).length;

    return (
        <aside className={clsx(
            'flex flex-col h-full bg-[#161b22] border-r border-[#30363d] transition-all duration-300 relative',
            collapsed ? 'w-16' : 'w-60'
        )}>
            {/* Logo */}
            <div className={clsx('flex items-center gap-3 p-4 border-b border-[#30363d]', collapsed && 'justify-center')}>
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                    <TrendingUp size={16} className="text-white" />
                </div>
                {!collapsed && (
                    <div>
                        <p className="text-white font-bold text-sm leading-tight">BeneScore</p>
                        <p className="text-slate-500 text-xs">Loans for a Better Tomorrow</p>
                    </div>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-3 px-2">
                {links.map(({ to, label, icon: Icon }) => (
                    <NavLink
                        key={to}
                        to={to}
                        className={({ isActive }) => clsx(
                            'flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm font-medium transition-all group',
                            isActive
                                ? 'bg-emerald-500/15 text-emerald-400 border-l-2 border-emerald-500 pl-2.5'
                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                        )}
                        title={collapsed ? label : undefined}
                    >
                        <div className="relative flex-shrink-0">
                            <Icon size={18} />
                            {label === 'Notifications' && unread > 0 && (
                                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full text-white text-[9px] flex items-center justify-center font-bold">
                                    {unread > 9 ? '9+' : unread}
                                </span>
                            )}
                        </div>
                        {!collapsed && <span>{label}</span>}
                    </NavLink>
                ))}
            </nav>

            {/* Bottom grow card */}
            {!collapsed && role === 'beneficiary' && (
                <div className="mx-3 mb-3 p-3 rounded-xl bg-gradient-to-br from-emerald-900/40 to-emerald-800/20 border border-emerald-800/30">
                    <p className="text-emerald-300 font-semibold text-sm">Your financial growth starts here.</p>
                    <p className="text-slate-400 text-xs mt-1">Access fair loans, build your future.</p>
                </div>
            )}

            {/* Logout */}
            <button
                className={clsx(
                    'flex items-center gap-3 mx-2 mb-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all',
                    collapsed && 'justify-center'
                )}
                onClick={() => navigate('/')}
            >
                <LogOut size={18} />
                {!collapsed && <span>Log Out</span>}
            </button>

            {/* Collapse toggle */}
            <button
                className="absolute -right-3 top-20 w-6 h-6 bg-[#30363d] border border-[#444] rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-[#444] transition-all z-10"
                onClick={onToggle}
            >
                {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
            </button>
        </aside>
    );
}
