import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Shield, TrendingUp, Users } from 'lucide-react';
import { useAuth } from '@/context/useAuth';

const points = [
    { icon: BarChart3, title: 'Alternative credit assessment', text: 'Income, expenses and repayment data, with every score explained.' },
    { icon: Users, title: 'Independent lenders', text: "Each lender decides alone. One rejection doesn't close other doors." },
    { icon: Shield, title: 'You control your data', text: 'Only the lenders you choose can see your application.' },
];

export function AuthLayout({ title, subtitle, children, footer }: {
    title: string;
    subtitle?: string;
    children: ReactNode;
    footer?: ReactNode;
}) {
    const { isMockMode } = useAuth();
    return (
        <div className="min-h-screen bg-[#0d1117] text-white overflow-x-hidden">
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px]" />
            </div>

            <div className="relative min-h-screen grid lg:grid-cols-2">
                {/* Brand panel */}
                <aside className="hidden lg:flex flex-col justify-between p-12 border-r border-[#30363d] bg-[#161b22]/50">
                    <Link to="/" className="flex items-center gap-3 w-fit">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center">
                            <TrendingUp size={18} className="text-white" />
                        </div>
                        <div>
                            <p className="text-white font-bold text-lg leading-tight">BeneScore</p>
                            <p className="text-slate-500 text-xs">AI-Powered Digital Lending</p>
                        </div>
                    </Link>

                    <div className="max-w-md">
                        <h2 className="text-4xl font-black leading-tight bg-gradient-to-br from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                            Loans for a<br /><span className="text-emerald-400">Better Tomorrow</span>
                        </h2>
                        <ul className="mt-8 space-y-5">
                            {points.map(({ icon: Icon, title: pointTitle, text }) => (
                                <li key={pointTitle} className="flex gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                                        <Icon size={17} className="text-emerald-400" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-white">{pointTitle}</p>
                                        <p className="text-sm text-slate-400 mt-0.5">{text}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <p className="text-xs text-slate-600">Academic prototype. No real loans, credit checks or payments.</p>
                </aside>

                {/* Form panel */}
                <main className="flex flex-col items-center justify-center px-4 py-10 sm:px-8">
                    <div className="w-full max-w-md">
                        <Link to="/" className="flex items-center gap-3 mb-8 lg:hidden w-fit">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center">
                                <TrendingUp size={18} className="text-white" />
                            </div>
                            <p className="text-white font-bold text-lg">BeneScore</p>
                        </Link>

                        <h1 className="text-2xl font-bold text-white">{title}</h1>
                        {subtitle && <p className="text-slate-500 text-sm mt-1">{subtitle}</p>}

                        <div className="mt-6">{children}</div>

                        {footer && <div className="mt-6 text-center text-sm text-slate-500">{footer}</div>}

                        {isMockMode && (
                            <p className="mt-6 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-400">
                                ⚠ Simulated sign-in: accounts are stored only in this browser. Please don't use a real password.
                            </p>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}
