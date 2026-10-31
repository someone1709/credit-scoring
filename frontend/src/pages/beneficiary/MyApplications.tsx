import { Link } from 'react-router-dom';
import { useRole } from '@/context/RoleContext';
import { useApp } from '@/context/AppContext';
import { Card, EmptyState, SectionHeader } from '@/components/shared/UI';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { FileText, Plus } from 'lucide-react';

function formatCurrency(n: number) { return '₹' + n.toLocaleString('en-IN'); }
function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function MyApplications() {
    const { beneficiary } = useRole();
    const { getApplicationsByBeneficiary } = useApp();
    const apps = getApplicationsByBeneficiary(beneficiary.id);

    return (
        <div className="space-y-6">
            <SectionHeader
                title="My Applications"
                subtitle="Track all your loan applications and their current statuses."
                action={
                    <Link to="/beneficiary/apply" className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-semibold transition-colors">
                        <Plus size={16} /> New Application
                    </Link>
                }
            />

            <Card>
                {apps.length === 0 ? (
                    <EmptyState
                        icon={<FileText size={40} />}
                        title="No applications yet"
                        description="Apply for a loan to get started. Your applications will appear here."
                        action={
                            <Link to="/beneficiary/apply" className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-semibold transition-colors">
                                Apply for a Loan
                            </Link>
                        }
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-[#30363d]">
                                    {['Application ID', 'Amount', 'Purpose', 'Tenure', 'Status', 'Submitted', 'Decisions', 'Actions'].map(h => (
                                        <th key={h} className="text-left text-xs text-slate-500 font-medium py-3 pr-4 first:pr-0 whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {apps.map(app => {
                                    const decisions = app.lenderDecisions;
                                    const offersMade = decisions.filter(d => d.status === 'OFFER_MADE').length;
                                    const rejected = decisions.filter(d => d.status === 'REJECTED').length;
                                    const reviewing = decisions.filter(d => d.status === 'UNDER_REVIEW').length;
                                    return (
                                        <tr key={app.id} className="border-b border-[#30363d] hover:bg-white/[0.02] transition-colors">
                                            <td className="py-4 pr-4 font-mono text-sm text-slate-300">#{app.id}</td>
                                            <td className="py-4 pr-4 text-sm text-white font-semibold whitespace-nowrap">{formatCurrency(app.loan_amount)}</td>
                                            <td className="py-4 pr-4 text-sm text-slate-400">{app.loan_purpose}</td>
                                            <td className="py-4 pr-4 text-sm text-slate-400">{app.tenure_months}M</td>
                                            <td className="py-4 pr-4"><StatusBadge status={app.status} size="sm" /></td>
                                            <td className="py-4 pr-4 text-xs text-slate-500 whitespace-nowrap">{formatDate(app.submittedAt)}</td>
                                            <td className="py-4 pr-4">
                                                <div className="flex flex-col gap-0.5">
                                                    {offersMade > 0 && <span className="text-xs text-emerald-400">{offersMade} offer{offersMade > 1 ? 's' : ''}</span>}
                                                    {reviewing > 0 && <span className="text-xs text-amber-400">{reviewing} reviewing</span>}
                                                    {rejected > 0 && <span className="text-xs text-red-400">{rejected} rejected</span>}
                                                    {decisions.length === 0 && <span className="text-xs text-slate-600">—</span>}
                                                </div>
                                            </td>
                                            <td className="py-4">
                                                <Link to={`/beneficiary/applications/${app.id}`} className="text-emerald-400 hover:text-emerald-300 text-xs font-medium transition-colors">
                                                    View Details →
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
