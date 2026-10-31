import { Link } from 'react-router-dom';
import { useRole } from '@/context/RoleContext';
import { useApp } from '@/context/AppContext';
import { StatCard, Card, DemoDisclaimer } from '@/components/shared/UI';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ApplicationWorkflowStepper } from '@/components/shared/Stepper';
import {
    FileText, Clock, CheckCircle, IndianRupee, ArrowRight, ExternalLink
} from 'lucide-react';

function formatCurrency(amount: number) {
    return '₹' + amount.toLocaleString('en-IN');
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_TO_STEP: Record<string, number> = {
    SUBMITTED: 0,
    DOCUMENTS_REQUIRED: 1,
    UNDER_REVIEW: 3,
    OFFERS_AVAILABLE: 3,
    OFFER_ACCEPTED: 4,
    REJECTED: 4,
    DISBURSED: 4,
};

export default function BeneficiaryDashboard() {
    const { beneficiary } = useRole();
    const { getApplicationsByBeneficiary } = useApp();
    const apps = getApplicationsByBeneficiary(beneficiary.id);

    const activeApp = apps.find(a => a.status !== 'DISBURSED' && a.status !== 'REJECTED');
    const approved = apps.filter(a => a.status === 'DISBURSED' || a.status === 'OFFER_ACCEPTED');
    const totalBorrowed = approved.reduce((sum, a) => {
        const acceptedOffer = a.offers.find(o => o.status === 'ACCEPTED');
        return sum + (acceptedOffer?.amount || 0);
    }, 0);
    const pendingOffers = apps.flatMap(a => a.offers.filter(o => o.status === 'PENDING'));

    const currentStep = activeApp ? (STATUS_TO_STEP[activeApp.status] ?? 0) : 0;

    const stepDates: Record<number, string> = activeApp ? {
        0: formatDate(activeApp.submittedAt),
        1: formatDate(activeApp.submittedAt),
        2: formatDate(activeApp.submittedAt),
    } : {};

    return (
        <div className="space-y-6">
            {/* Welcome */}
            <div>
                <h1 className="text-2xl font-bold text-white">Welcome back, {beneficiary.name.split(' ')[0]}!</h1>
                <p className="text-slate-500 mt-1">Track your loan applications, manage your documents and choose the best lender offers.</p>
            </div>

            <DemoDisclaimer />

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    label="Total Applications"
                    value={apps.length}
                    sub={<Link to="/beneficiary/applications" className="text-xs text-emerald-400 hover:underline flex items-center gap-1">View all <ArrowRight size={10} /></Link> as unknown as string}
                    icon={<FileText size={20} />}
                    color="emerald"
                />
                <StatCard
                    label="Ongoing Application"
                    value={activeApp ? 1 : 0}
                    sub={activeApp ? 'In Progress' : 'None active'}
                    icon={<Clock size={20} />}
                    color="blue"
                />
                <StatCard
                    label="Approved Loans"
                    value={approved.length}
                    sub={approved.length > 0 ? 'Total received' : 'None yet'}
                    icon={<CheckCircle size={20} />}
                    color="emerald"
                />
                <StatCard
                    label="Total Borrowed"
                    value={totalBorrowed > 0 ? formatCurrency(totalBorrowed) : '—'}
                    sub={totalBorrowed > 0 ? 'Across all loans' : 'No loans yet'}
                    icon={<IndianRupee size={20} />}
                    color="amber"
                />
            </div>

            {/* Current Application Stepper */}
            {activeApp && (
                <Card>
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <h2 className="text-base font-bold text-white">Your Current Application</h2>
                            <span className="text-slate-500 text-sm">Application ID: #{activeApp.id}</span>
                        </div>
                        <Link to={`/beneficiary/applications/${activeApp.id}`} className="text-emerald-400 hover:text-emerald-300 transition-colors">
                            <ExternalLink size={16} />
                        </Link>
                    </div>
                    <ApplicationWorkflowStepper currentStep={currentStep} dates={stepDates} />
                </Card>
            )}

            {/* Recent Applications + Documents */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                {/* Recent Applications */}
                <Card className="lg:col-span-3">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-base font-bold text-white">Recent Applications</h2>
                        <Link to="/beneficiary/applications" className="text-emerald-400 hover:text-emerald-300 text-sm flex items-center gap-1 transition-colors">
                            View All <ArrowRight size={14} />
                        </Link>
                    </div>
                    <table className="w-full">
                        <thead>
                            <tr className="text-left">
                                <th className="text-xs text-slate-500 font-medium pb-3">ID</th>
                                <th className="text-xs text-slate-500 font-medium pb-3">Loan Amount</th>
                                <th className="text-xs text-slate-500 font-medium pb-3">Purpose</th>
                                <th className="text-xs text-slate-500 font-medium pb-3">Status</th>
                                <th className="text-xs text-slate-500 font-medium pb-3">Date</th>
                                <th className="text-xs text-slate-500 font-medium pb-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {apps.slice(0, 4).map(app => (
                                <tr key={app.id} className="border-t border-[#30363d]">
                                    <td className="py-3 text-sm font-mono text-slate-300">#{app.id}</td>
                                    <td className="py-3 text-sm text-white font-medium">{formatCurrency(app.loan_amount)}</td>
                                    <td className="py-3 text-sm text-slate-400">{app.loan_purpose}</td>
                                    <td className="py-3"><StatusBadge status={app.status} size="sm" /></td>
                                    <td className="py-3 text-xs text-slate-500">{formatDate(app.submittedAt)}</td>
                                    <td className="py-3">
                                        <Link to={`/beneficiary/applications/${app.id}`} className="text-emerald-400 hover:text-emerald-300 text-xs font-medium transition-colors">
                                            View
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                            {apps.length === 0 && (
                                <tr><td colSpan={6} className="py-8 text-center text-slate-500 text-sm">No applications yet.</td></tr>
                            )}
                        </tbody>
                    </table>
                </Card>

                {/* Documents Summary */}
                <Card className="lg:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-base font-bold text-white">Your Documents</h2>
                        <Link to="/beneficiary/documents" className="text-emerald-400 hover:text-emerald-300 text-sm flex items-center gap-1 transition-colors">
                            View All <ArrowRight size={14} />
                        </Link>
                    </div>
                    {activeApp ? (
                        <div className="space-y-3">
                            {activeApp.documents.map(doc => (
                                <div key={doc.id} className="flex items-center justify-between">
                                    <span className="text-sm text-slate-300">{doc.label}</span>
                                    <StatusBadge status={doc.verification_status} size="sm" />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-slate-500 text-sm">No documents uploaded yet.</p>
                    )}
                </Card>
            </div>

            {/* Loan Offers */}
            {pendingOffers.length > 0 && (
                <Card>
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-base font-bold text-white">Loan Offers from Lenders</h2>
                            <p className="text-slate-500 text-xs mt-0.5">Compare offers and choose the best one for you.</p>
                        </div>
                        <Link to="/beneficiary/offers" className="text-emerald-400 hover:text-emerald-300 text-sm flex items-center gap-1 transition-colors">
                            View All <ArrowRight size={14} />
                        </Link>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {pendingOffers.slice(0, 3).map(offer => (
                            <div key={offer.id} className="bg-[#0d1117] rounded-xl p-4 border border-[#30363d] hover:border-slate-500 transition-all">
                                <div className="flex items-center gap-3 mb-3">
                                    <div
                                        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                                        style={{ backgroundColor: offer.lenderLogoColor }}
                                    >
                                        {offer.lenderLogoInitials}
                                    </div>
                                    <span className="text-sm font-semibold text-white">{offer.lenderName}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 mb-3">
                                    <div>
                                        <p className="text-emerald-400 font-bold text-base">{formatCurrency(offer.amount)}</p>
                                        <p className="text-slate-500 text-xs">Loan Amount</p>
                                    </div>
                                    <div>
                                        <p className="text-white font-bold text-base">{offer.interest_rate}%</p>
                                        <p className="text-slate-500 text-xs">Interest Rate</p>
                                    </div>
                                    <div>
                                        <p className="text-white font-bold text-base">{offer.tenure_months}M</p>
                                        <p className="text-slate-500 text-xs">Tenure</p>
                                    </div>
                                </div>
                                <ul className="space-y-1 mb-3">
                                    {offer.features.slice(0, 2).map((f, i) => (
                                        <li key={i} className="flex items-center gap-1.5 text-xs text-slate-400">
                                            <CheckCircle size={10} className="text-emerald-500 flex-shrink-0" /> {f}
                                        </li>
                                    ))}
                                </ul>
                                <Link
                                    to="/beneficiary/offers"
                                    className="block w-full text-center py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors"
                                >
                                    View Details
                                </Link>
                            </div>
                        ))}
                    </div>
                </Card>
            )}
        </div>
    );
}
