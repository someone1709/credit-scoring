import { Link } from 'react-router-dom';
import { useRole } from '@/context/RoleContext';
import { useApp } from '@/context/AppContext';
import { Card, EmptyState } from '@/components/shared/UI';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Gift } from 'lucide-react';

function fmt(n: number) { return '₹' + n.toLocaleString('en-IN'); }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }

export default function MyOffers() {
    const { lender } = useRole();
    const { getOffersByLender, applications } = useApp();
    const offers = getOffersByLender(lender.id);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">My Offers</h1>
                <p className="text-slate-500 mt-1 text-sm">All loan offers made by {lender.name}.</p>
            </div>
            {offers.length === 0 ? (
                <EmptyState icon={<Gift size={40} />} title="No offers yet" description="Review applications to create loan offers." action={<Link to="/lender/applications" className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-semibold">Browse Applications</Link>} />
            ) : (
                <Card className="p-0 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="border-b border-[#30363d]">
                                <tr>
                                    {['Offer ID', 'Application', 'Applicant', 'Amount', 'Rate', 'Tenure', 'Status', 'Created', 'Action'].map(h => (
                                        <th key={h} className="text-left text-xs text-slate-500 font-medium py-3 px-4 whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {offers.map(o => {
                                    const app = applications.find(a => a.id === o.applicationId);
                                    return (
                                        <tr key={o.id} className="border-b border-[#30363d] hover:bg-white/[0.02] transition-colors">
                                            <td className="py-3 px-4 font-mono text-xs text-slate-400">{o.id.slice(0, 10)}</td>
                                            <td className="py-3 px-4 font-mono text-xs text-slate-400">#{o.applicationId}</td>
                                            <td className="py-3 px-4 text-sm text-white font-medium whitespace-nowrap">{app?.beneficiaryName || '—'}</td>
                                            <td className="py-3 px-4 text-sm text-white whitespace-nowrap">{fmt(o.amount)}</td>
                                            <td className="py-3 px-4 text-sm text-slate-300 whitespace-nowrap">{o.interest_rate}% p.a.</td>
                                            <td className="py-3 px-4 text-sm text-slate-300 whitespace-nowrap">{o.tenure_months}M</td>
                                            <td className="py-3 px-4"><StatusBadge status={o.status} size="sm" /></td>
                                            <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">{fmtDate(o.createdAt)}</td>
                                            <td className="py-3 px-4">
                                                <Link to={`/lender/applications/${o.applicationId}`} className="text-emerald-400 hover:text-emerald-300 text-xs font-medium transition-colors">
                                                    View App →
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}
        </div>
    );
}
