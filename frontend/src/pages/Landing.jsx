import { Link, useNavigate } from 'react-router-dom';
import { homeForRole, useAuth } from '@/context/useAuth';
import { MOCK_APPLICATIONS, MOCK_LENDERS } from '@/data/mockData';
import { TrendingUp, Shield, Users, BarChart3, ChevronRight, LayoutDashboard, Star } from 'lucide-react';

const features = [
    {
        icon: BarChart3,
        title: 'Alternative Credit Scoring',
        desc: 'An assessment using DTI, expense ratios, surplus and repayment history. No CIBIL score required.',
    },
    {
        icon: Users,
        title: 'Multi-Lender Competition',
        desc: "Multiple independent lenders review your application simultaneously. One rejection doesn't close all doors.",
    },
    {
        icon: Shield,
        title: 'Transparent Explanations',
        desc: 'Every assessment is explained in plain language. Know exactly why your score is what it is.',
    },
];

// Counted from the demo data, so the page can't claim more than the prototype holds.
const simulatedDisbursed = MOCK_APPLICATIONS
    .filter(app => app.status === 'DISBURSED')
    .flatMap(app => app.offers.filter(offer => offer.status === 'ACCEPTED'))
    .reduce((sum, offer) => sum + offer.amount, 0);

const demoStats = [
    { value: `₹${(simulatedDisbursed / 100000).toFixed(1)}L`, label: 'Simulated Disbursed' },
    { value: String(MOCK_LENDERS.length), label: 'Demo Lenders' },
];

const platformStats = [
    { value: 'Every', label: 'Score Explained' },
    { value: '0', label: 'CIBIL Required' },
];

export default function LandingPage() {
    const navigate = useNavigate();
    const { user, isMockMode } = useAuth();
    // The demo numbers say nothing about a real database, so they only show in demo mode.
    const stats = isMockMode ? [...demoStats, ...platformStats] : platformStats;

    const enter = (role) => {
        navigate(user?.role === role ? homeForRole(role) : `/login?role=${role}`);
    };

    return (
        <div className="min-h-screen bg-[#0d1117] text-white overflow-x-hidden">
            {/* Gradient blobs */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px]" />
            </div>

            {/* Topbar */}
            <header className="relative border-b border-[#30363d] bg-[#161b22]/80 backdrop-blur-sm">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center">
                            <TrendingUp size={18} className="text-white" />
                        </div>
                        <div>
                            <p className="text-white font-bold text-lg leading-tight">BeneScore</p>
                            <p className="text-slate-500 text-xs hidden sm:block">AI-Powered Digital Lending</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="hidden md:flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-full">
                            <Star size={11} />
                            Academic Prototype · CSE Minor Project
                        </div>
                        {user ? (
                            <Link to={homeForRole(user.role)} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-semibold transition-colors whitespace-nowrap">
                                <LayoutDashboard size={15} /> Dashboard
                            </Link>
                        ) : (
                            <>
                                <Link to="/login" className="px-3 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors whitespace-nowrap">Sign In</Link>
                                <Link to="/register" className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-semibold transition-colors whitespace-nowrap">Create Account</Link>
                            </>
                        )}
                    </div>
                </div>
            </header>

            {/* Hero */}
            <section className="relative max-w-6xl mx-auto px-6 py-20 text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-xs font-medium mb-6">
                    Alternative Credit Scoring for Underserved Communities
                </div>
                <h1 className="text-4xl sm:text-6xl font-black bg-gradient-to-br from-white via-slate-200 to-slate-400 bg-clip-text text-transparent leading-tight mb-6">
                    Loans for a<br />
                    <span className="text-emerald-400">Better Tomorrow</span>
                </h1>
                <p className="text-slate-400 text-lg max-w-2xl mx-auto mb-10">
                    An AI-powered lending platform that uses alternative data to score creditworthiness — opening loan access to low-income individuals and thin-file first-time borrowers.
                </p>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button
                        onClick={() => enter('beneficiary')}
                        className="group flex items-center justify-center gap-3 px-8 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-base font-bold transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40"
                    >
                        <span className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">👤</span>
                        Enter as Beneficiary
                        <ChevronRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
                    </button>
                    <button
                        onClick={() => enter('lender')}
                        className="group flex items-center justify-center gap-3 px-8 py-4 bg-[#1c2333] hover:bg-[#212842] border border-[#30363d] hover:border-blue-500/30 text-white rounded-xl text-base font-bold transition-all"
                    >
                        <span className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">🏦</span>
                        Enter as Lender
                        <ChevronRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
                    </button>
                </div>
            </section>

            {/* Stats */}
            <section className="relative max-w-4xl mx-auto px-6 pb-16">
                <div className={`grid grid-cols-2 gap-4 ${isMockMode ? 'sm:grid-cols-4' : ''}`}>
                    {stats.map(({ value, label }) => (
                        <div key={label} className="text-center p-5 bg-[#161b22] border border-[#30363d] rounded-xl">
                            <p className="text-2xl font-black text-emerald-400">{value}</p>
                            <p className="text-slate-500 text-xs mt-1">{label}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Features */}
            <section className="relative max-w-6xl mx-auto px-6 pb-20">
                <h2 className="text-2xl font-bold text-center text-white mb-10">Why BeneScore?</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {features.map(({ icon: Icon, title, desc }) => (
                        <div key={title} className="p-6 bg-[#161b22] border border-[#30363d] rounded-xl hover:border-emerald-500/30 transition-all group">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center mb-4 group-hover:bg-emerald-500/25 transition-colors">
                                <Icon size={20} className="text-emerald-400" />
                            </div>
                            <h3 className="text-white font-bold mb-2">{title}</h3>
                            <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Demo disclaimer */}
            <section className="relative max-w-3xl mx-auto px-6 pb-16">
                <div className="p-5 bg-amber-500/5 border border-amber-500/20 rounded-xl text-center">
                    <p className="text-amber-400 text-sm font-semibold mb-1">Academic Prototype Notice</p>
                    <p className="text-slate-500 text-xs leading-relaxed">
                        This is a frontend prototype. All data is synthetic. No real loans are issued, no real money is transferred, and no real financial decisions are made. All scores are illustrative, from fixed rules or a model trained on synthetic data. Not for production use.
                    </p>
                </div>
            </section>

            <footer className="relative border-t border-[#30363d] py-6 text-center text-xs text-slate-600">
                BeneScore · Beneficiary Credit Scoring with Income Verification Layer · CSE Minor Project
            </footer>
        </div>
    );
}
