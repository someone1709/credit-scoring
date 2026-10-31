import { Link } from 'react-router-dom';
import { useRole } from '@/context/RoleContext';
import { useApp } from '@/context/AppContext';
import { StatCard, Card, DemoDisclaimer } from '@/components/shared/UI';
import { StatusBadge } from '@/components/shared/StatusBadge';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { FileText, Clock, Check, X, Gift, ArrowRight } from 'lucide-react';

function fmt(n: number) { return '₹' + n.toLocaleString('en-IN'); }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }

const RISK_COLORS: Record<string, string> = { LOW: '#10b981', MEDIUM: '#f59e0b', HIGH: '#ef4444' };

export default function LenderDashboard() {
    const { lender } = useRole();
    const { getApplicationsByLender, getOffersByLender } = useApp();
    const apps = getApplicationsByLender(lender.id);
    const offers = getOffersByLender(lender.id);

    const myDecisions = apps.map(a => a.lenderDecisions.find(d => d.lenderId === lender.id)).filter(Boolean);
    const underReview = myDecisions.filter(d => d!.status === 'UNDER_REVIEW').length;
    const offersMade = myDecisions.filter(d => d!.status === 'OFFER_MADE').length;
    const rejected = myDecisions.filter(d => d!.status === 'REJECTED').length;
    const accepted = offers.filter(o => o.status === 'ACCEPTED').length;

    // Chart data
    const statusData = [
        { name: 'Pending', value: myDecisions.filter(d => d!.status === 'PENDING').length, fill: '#64748b' },
        { name: 'Reviewing', value: underReview, fill: '#f59e0b' },
        { name: 'Offers Made', value: offersMade, fill: '#10b981' },
        { name: 'Rejected', value: rejected, fill: '#ef4444' },
    ];

    const riskDist = apps.reduce((acc, a) => {
        if (a.assessment) {
            const r = a.assessment.risk_category;
            acc[r] = (acc[r] || 0) + 1;
        }
        return acc;
    }, {} as Record<string, number>);

    const riskPieData = Object.entries(riskDist).map(([name, value]) => ({ name, value, fill: RISK_COLORS[name] }));

    const recentApps = [...apps].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()).slice(0, 4);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">Welcome, {lender.contactPerson.split(' ')[0]}!</h1>
                <p className="text-slate-500 mt-1 text-sm">{lender.name} · {lender.licenseNumber}</p>
            </div>

            <DemoDisclaimer />

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard label="Total Applications" value={apps.length} icon={<FileText size={20} />} color="blue" />
                <StatCard label="Under Review" value={underReview} icon={<Clock size={20} />} color="amber" />
                <StatCard label="Offers Made" value={offersMade} icon={<Gift size={20} />} color="emerald" />
                <StatCard label="Rejected" value={rejected} icon={<X size={20} />} color="red" />
                <StatCard label="Accepted Offers" value={accepted} icon={<Check size={20} />} color="emerald" />
            </div>

            {/* Charts + Recent */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Applications by Decision */}
                <Card className="lg:col-span-2">
                    <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">Applications by Decision Status</h2>
                    <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={statusData} barSize={32}>
                            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                            <Tooltip
                                contentStyle={{ background: '#1c2333', border: '1px solid #30363d', borderRadius: 8 }}
                                labelStyle={{ color: '#cbd5e1' }}
                                itemStyle={{ color: '#94a3b8' }}
                            />
                            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                {statusData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </Card>

                {/* Risk Distribution */}
                <Card>
                    <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">Risk Distribution</h2>
                    {riskPieData.length > 0 ? (
                        <>
                            <ResponsiveContainer width="100%" height={140}>
                                <PieChart>
                                    <Pie data={riskPieData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value" paddingAngle={3}>
                                        {riskPieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                                    </Pie>
                                    <Tooltip contentStyle={{ background: '#1c2333', border: '1px solid #30363d', borderRadius: 8 }} itemStyle={{ color: '#94a3b8' }} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="flex flex-col gap-1.5 mt-2">
                                {riskPieData.map(({ name, value, fill }) => (
                                    <div key={name} className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: fill }} />
                                            <span className="text-slate-400">{name} Risk</span>
                                        </div>
                                        <span className="text-white font-medium">{value}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <p className="text-slate-500 text-sm text-center py-8">No risk data yet</p>
                    )}
                </Card>
            </div>

            {/* Recent Applications */}
            <Card>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-bold text-white">Recent Applications</h2>
                    <Link to="/lender/applications" className="text-emerald-400 hover:text-emerald-300 text-sm flex items-center gap-1 transition-colors">
                        View All <ArrowRight size={14} />
                    </Link>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-[#30363d]">
                                {['ID', 'Applicant', 'Amount', 'Income', 'Risk', 'My Decision', 'Date', 'Action'].map(h => (
                                    <th key={h} className="text-left text-xs text-slate-500 font-medium py-3 pr-4 whitespace-nowrap">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {recentApps.map(app => {
                                const myDec = app.lenderDecisions.find(d => d.lenderId === lender.id);
                                return (
                                    <tr key={app.id} className="border-b border-[#30363d] hover:bg-white/[0.02] transition-colors">
                                        <td className="py-3 pr-4 font-mono text-xs text-slate-400">#{app.id}</td>
                                        <td className="py-3 pr-4 text-sm text-white font-medium whitespace-nowrap">{app.beneficiaryName}</td>
                                        <td className="py-3 pr-4 text-sm text-white whitespace-nowrap">{fmt(app.loan_amount)}</td>
                                        <td className="py-3 pr-4 text-sm text-slate-400 whitespace-nowrap">{fmt(app.monthly_income)}/mo</td>
                                        <td className="py-3 pr-4">
                                            {app.assessment
                                                ? <div className="flex items-center gap-1.5"><StatusBadge status={app.assessment.risk_category} size="sm" /><span className="text-xs text-slate-500">({app.assessment.risk_score})</span></div>
                                                : <span className="text-slate-600 text-xs">—</span>}
                                        </td>
                                        <td className="py-3 pr-4">{myDec ? <StatusBadge status={myDec.status} size="sm" /> : <StatusBadge status="PENDING" size="sm" />}</td>
                                        <td className="py-3 pr-4 text-xs text-slate-500 whitespace-nowrap">{fmtDate(app.submittedAt)}</td>
                                        <td className="py-3">
                                            <Link to={`/lender/applications/${app.id}`} className="text-emerald-400 hover:text-emerald-300 text-xs font-medium whitespace-nowrap transition-colors">
                                                Review →
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })}
                            {recentApps.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-slate-500 text-sm">No applications assigned yet.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
