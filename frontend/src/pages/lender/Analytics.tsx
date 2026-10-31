import { useRole } from '@/context/RoleContext';
import { useApp } from '@/context/AppContext';
import { Card } from '@/components/shared/UI';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend,
} from 'recharts';

const MONTHS = ['Aug', 'Sep', 'Oct'];
const RISK_COLORS: Record<string, string> = { LOW: '#10b981', MEDIUM: '#f59e0b', HIGH: '#ef4444' };

const tooltipStyle = {
    contentStyle: { background: '#1c2333', border: '1px solid #30363d', borderRadius: 8 },
    labelStyle: { color: '#cbd5e1' },
    itemStyle: { color: '#94a3b8' },
};

export default function Analytics() {
    const { lender } = useRole();
    const { getApplicationsByLender, getOffersByLender } = useApp();
    const apps = getApplicationsByLender(lender.id);
    const offers = getOffersByLender(lender.id);

    // Decision distribution
    const decisionCounts = apps.reduce((acc, a) => {
        const d = a.lenderDecisions.find(x => x.lenderId === lender.id);
        const s = d?.status || 'PENDING';
        acc[s] = (acc[s] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const decisionData = Object.entries(decisionCounts).map(([name, value]) => ({ name: name.replace('_', ' '), value }));

    // Risk distribution
    const riskCounts = apps.reduce((acc, a) => {
        if (a.assessment) { const r = a.assessment.risk_category; acc[r] = (acc[r] || 0) + 1; }
        return acc;
    }, {} as Record<string, number>);
    const riskData = Object.entries(riskCounts).map(([name, value]) => ({ name, value, fill: RISK_COLORS[name] }));

    // Offer conversion trend (mock monthly)
    const trendData = MONTHS.map((month, i) => ({
        month,
        Applications: 1 + i,
        'Offers Made': i > 0 ? 1 : 0,
        'Accepted': i > 1 ? 1 : 0,
    }));

    // Income bracket
    const incomeCounts = apps.reduce((acc, a) => {
        if (a.assessment) { const b = a.assessment.income_bracket; acc[b] = (acc[b] || 0) + 1; }
        return acc;
    }, {} as Record<string, number>);
    const incomeData = Object.entries(incomeCounts).map(([name, value]) => ({
        name: name.replace('_', ' '),
        value,
    }));

    const totalOffered = offers.reduce((s, o) => s + o.amount, 0);
    const acceptedOffers = offers.filter(o => o.status === 'ACCEPTED');
    const totalAccepted = acceptedOffers.reduce((s, o) => s + o.amount, 0);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">Analytics</h1>
                <p className="text-slate-500 mt-1 text-sm">Lending activity overview for {lender.name}.</p>
            </div>

            {/* Summary KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                    { label: 'Total Applications', value: apps.length },
                    { label: 'Offers Made', value: offers.length },
                    { label: 'Total Offered', value: `₹${(totalOffered / 1000).toFixed(0)}K` },
                    { label: 'Total Accepted', value: `₹${(totalAccepted / 1000).toFixed(0)}K` },
                ].map(({ label, value }) => (
                    <Card key={label} className="text-center">
                        <p className="text-2xl font-bold text-white">{value}</p>
                        <p className="text-xs text-slate-500 mt-1">{label}</p>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Decision Distribution */}
                <Card>
                    <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">Decisions by Status</h2>
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={decisionData} barSize={28}>
                            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                            <Tooltip {...tooltipStyle} />
                            <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </Card>

                {/* Risk Distribution */}
                <Card>
                    <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">Risk Category Distribution</h2>
                    {riskData.length > 0 ? (
                        <div className="flex items-center gap-6">
                            <ResponsiveContainer width="50%" height={180}>
                                <PieChart>
                                    <Pie data={riskData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" paddingAngle={3}>
                                        {riskData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                                    </Pie>
                                    <Tooltip {...tooltipStyle} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="flex flex-col gap-3">
                                {riskData.map(({ name, value, fill }) => (
                                    <div key={name} className="flex items-center gap-2">
                                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: fill }} />
                                        <span className="text-xs text-slate-400">{name} Risk</span>
                                        <span className="text-xs font-bold text-white ml-1">{value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <p className="text-slate-500 text-sm text-center py-10">No risk data available</p>
                    )}
                </Card>
            </div>

            {/* Offer Conversion Trend */}
            <Card>
                <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">Offer Conversion Trend (Simulated)</h2>
                <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                        <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip {...tooltipStyle} />
                        <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
                        <Line type="monotone" dataKey="Applications" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} />
                        <Line type="monotone" dataKey="Offers Made" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981' }} />
                        <Line type="monotone" dataKey="Accepted" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b' }} />
                    </LineChart>
                </ResponsiveContainer>
            </Card>

            {/* Income Bracket */}
            <Card>
                <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">Income Bracket of Applicants</h2>
                {incomeData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={incomeData} barSize={40} layout="vertical">
                            <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                            <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
                            <Tooltip {...tooltipStyle} />
                            <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <p className="text-slate-500 text-sm text-center py-8">No income data yet</p>
                )}
            </Card>
        </div>
    );
}
