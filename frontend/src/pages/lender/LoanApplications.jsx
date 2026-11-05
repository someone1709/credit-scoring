import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLender } from '@/context/useAuth';
import { useApp } from '@/context/useApp';
import { Card, EmptyState } from '@/components/shared/UI';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { FileText, Search, ChevronUp, ChevronDown } from 'lucide-react';
import { getAcceptedOffer, isClosedToDecisions } from '@/lib/workflow';

function fmt(n) { return '₹' + n.toLocaleString('en-IN'); }
function fmtDate(iso) { return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }

export default function LenderApplications() {
    const lender = useLender();
    const { getApplicationsByLender } = useApp();
    const apps = getApplicationsByLender(lender.id);

    // The search lives in the URL, so the search box in the top bar drives this list too.
    const [params, setParams] = useSearchParams();
    const search = params.get('q') ?? '';
    const setSearch = (value) => setParams(value ? { q: value } : {}, { replace: true });
    const [riskFilter, setRiskFilter] = useState('');
    const [decisionFilter, setDecisionFilter] = useState('');
    const [sortKey, setSortKey] = useState('submittedAt');
    const [sortDir, setSortDir] = useState('desc');

    const handleSort = (key) => {
        if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDir('desc'); }
    };

    const SortIcon = ({ k }) => sortKey === k
        ? (sortDir === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />)
        : null;

    const filtered = apps
        .filter(a => {
            const q = search.toLowerCase();
            const matchSearch = !q || a.id.toLowerCase().includes(q) || a.beneficiaryName.toLowerCase().includes(q);
            const matchRisk = !riskFilter || a.assessment?.risk_category === riskFilter;
            const myDec = a.lenderDecisions.find(d => d.lenderId === lender.id);
            const matchDecision = !decisionFilter || (myDec?.status === decisionFilter);
            return matchSearch && matchRisk && matchDecision;
        })
        .sort((a, b) => {
            let va, vb;
            if (sortKey === 'submittedAt') {
                va = new Date(a.submittedAt).getTime();
                vb = new Date(b.submittedAt).getTime();
            } else {
                va = a[sortKey];
                vb = b[sortKey];
            }
            return sortDir === 'desc' ? vb - va : va - vb;
        });

    return (
        <div className="space-y-5">
            <div>
                <h1 className="text-2xl font-bold text-white">Loan Applications</h1>
                <p className="text-slate-500 mt-1 text-sm">Review applications beneficiaries shared with {lender.name}.</p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search applicant or ID..."
                        aria-label="Search applicant or ID"
                        className="pl-9 pr-4 py-2 bg-[#161b22] border border-[#30363d] rounded-lg text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 transition-colors w-52"
                    />
                </div>
                <select
                    value={riskFilter}
                    onChange={e => setRiskFilter(e.target.value)}
                    aria-label="Filter by risk level"
                    className="px-3 py-2 bg-[#161b22] border border-[#30363d] rounded-lg text-sm text-slate-400 focus:outline-none"
                >
                    <option value="">All Risk Levels</option>
                    <option value="LOW">Low Risk</option>
                    <option value="MEDIUM">Medium Risk</option>
                    <option value="HIGH">High Risk</option>
                </select>
                <select
                    value={decisionFilter}
                    onChange={e => setDecisionFilter(e.target.value)}
                    aria-label="Filter by your decision"
                    className="px-3 py-2 bg-[#161b22] border border-[#30363d] rounded-lg text-sm text-slate-400 focus:outline-none"
                >
                    <option value="">All Decisions</option>
                    <option value="PENDING">Pending</option>
                    <option value="UNDER_REVIEW">Under Review</option>
                    <option value="OFFER_MADE">Offer Made</option>
                    <option value="REJECTED">Rejected</option>
                    <option value="INFO_REQUESTED">Info Requested</option>
                </select>
            </div>

            <Card className="p-0 overflow-hidden">
                {filtered.length === 0 ? (
                    <div className="p-6">
                        <EmptyState icon={<FileText size={36} />} title="No applications found" description="Adjust your filters or check back later." />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="border-b border-[#30363d]">
                                <tr>
                                    {[
                                        { label: 'App ID', sortable: false },
                                        { label: 'Applicant', sortable: false },
                                        { label: 'Amount', key: 'loan_amount', sortable: true },
                                        { label: 'Income', key: 'monthly_income', sortable: true },
                                        { label: 'Risk', sortable: false },
                                        { label: 'Composite Score', sortable: false },
                                        { label: 'My Decision', sortable: false },
                                        { label: 'Date', key: 'submittedAt', sortable: true },
                                        { label: 'Action', sortable: false },
                                    ].map(({ label, key, sortable }) => (
                                        <th
                                            key={label}
                                            onClick={() => sortable && key && handleSort(key)}
                                            className={`text-left text-xs text-slate-500 font-medium py-3 px-4 whitespace-nowrap ${sortable ? 'cursor-pointer hover:text-slate-300' : ''}`}
                                        >
                                            <span className="flex items-center gap-1">
                                                {label} {sortable && key && <SortIcon k={key} />}
                                            </span>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(app => {
                                    const myDec = app.lenderDecisions.find(d => d.lenderId === lender.id);
                                    const ass = app.assessment;
                                    // Says the application closed, never who won it.
                                    const closedToMe = isClosedToDecisions(app) && getAcceptedOffer(app)?.lender_id !== lender.id;
                                    return (
                                        <tr key={app.id} className="border-b border-[#30363d] hover:bg-white/[0.02] transition-colors">
                                            <td className="py-3 px-4 font-mono text-xs text-slate-400">#{app.id}</td>
                                            <td className="py-3 px-4 text-sm text-white font-medium whitespace-nowrap">{app.beneficiaryName}</td>
                                            <td className="py-3 px-4 text-sm text-white whitespace-nowrap">{fmt(app.loan_amount)}</td>
                                            <td className="py-3 px-4 text-sm text-slate-400 whitespace-nowrap">{fmt(app.monthly_income)}</td>
                                            <td className="py-3 px-4">
                                                {ass ? <StatusBadge status={ass.risk_category} size="sm" /> : <span className="text-slate-600 text-xs">—</span>}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-slate-300">{ass ? ass.composite_score : '—'}</td>
                                            <td className="py-3 px-4">
                                                <div className="flex flex-col items-start gap-1">
                                                    <StatusBadge status={myDec?.status || 'PENDING'} size="sm" />
                                                    {closedToMe && <span className="text-xs text-slate-500">Closed</span>}
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">{fmtDate(app.submittedAt)}</td>
                                            <td className="py-3 px-4">
                                                <Link to={`/lender/applications/${app.id}`} className="px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-medium transition-colors whitespace-nowrap">
                                                    Review
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );
}
