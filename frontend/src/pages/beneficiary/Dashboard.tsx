import { Link } from 'react-router-dom';
import { isProfileComplete, useBeneficiary } from '@/context/useAuth';
import { useApp } from '@/context/useApp';
import { StatCard, Card, DemoDisclaimer } from '@/components/shared/UI';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ApplicationWorkflowStepper } from '@/components/shared/Stepper';
import { getAcceptedOffer, workflowStep } from '@/lib/workflow';
import {
    FileText, Clock, CheckCircle, IndianRupee, ArrowRight, ExternalLink, UserCheck
} from 'lucide-react';

function formatCurrency(amount: number) {
    return '₹' + amount.toLocaleString('en-IN');
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function BeneficiaryDashboard() {
    const beneficiary = useBeneficiary();
    const { getApplicationsByBeneficiary, getNotificationsByUser } = useApp();
    const apps = getApplicationsByBeneficiary(beneficiary.id);

    const activeApps = apps.filter(a => a.status !== 'DISBURSED' && a.status !== 'REJECTED');
    const activeApp = activeApps[0];
    const approved = apps.filter(a => a.status === 'DISBURSED' || a.status === 'OFFER_ACCEPTED');
    // Borrowed means the (simulated) money has actually gone out, not just that an offer was accepted.
    const totalBorrowed = apps
        .filter(a => a.status === 'DISBURSED')
        .reduce((sum, a) => sum + (getAcceptedOffer(a)?.amount || 0), 0);
    const pendingOffers = apps.flatMap(a => a.offers.filter(o => o.status === 'PENDING'));
    const latestAccepted = apps.find(a => a.status === 'OFFER_ACCEPTED') ?? apps.find(a => a.status === 'DISBURSED');
    const acceptedOffer = latestAccepted && getAcceptedOffer(latestAccepted);
    const recentActivity = getNotificationsByUser(beneficiary.id).slice(0, 4);

    return (
        <div className="space-y-6">
            {/* Welcome */}
            <div>
                <h1 className="text-2xl font-bold text-white">Welcome back, {beneficiary.name.split(' ')[0]}!</h1>
                <p className="text-slate-500 mt-1">Track your loan applications, manage your documents and choose the best lender offers.</p>
            </div>

            <DemoDisclaimer />

            {/* Workflow step 2: the profile comes before the first application */}
            {!isProfileComplete(beneficiary) && (
                <Card className="flex flex-col sm:flex-row sm:items-center gap-3 border-emerald-500/30">
                    <UserCheck size={20} className="text-emerald-400 flex-shrink-0" />
                    <div className="flex-1">
                        <p className="text-sm font-semibold text-white">Complete your profile to apply for a loan</p>
                        <p className="text-xs text-slate-500 mt-0.5">Lenders need your occupation and location to review an application.</p>
                    </div>
                    <Link to="/beneficiary/profile" className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-semibold transition-colors text-center whitespace-nowrap">
                        Complete Profile
                    </Link>
                </Card>
            )}

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard
                    label="Total Applications"
                    value={apps.length}
                    sub={<Link to="/beneficiary/applications" className="text-xs text-emerald-400 hover:underline flex items-center gap-1">View all <ArrowRight size={10} /></Link>}
                    icon={<FileText size={20} />}
                    color="emerald"
                />
                <StatCard
                    label="Ongoing Applications"
                    value={activeApps.length}
                    sub={activeApps.length > 0 ? 'In progress' : 'None active'}
                    icon={<Clock size={20} />}
                    color="blue"
                />
                <StatCard
                    label="Approved Loans"
                    value={approved.length}
                    sub={approved.length > 0 ? 'Offers you accepted' : 'None yet'}
                    icon={<CheckCircle size={20} />}
                    color="emerald"
                />
                <StatCard
                    label="Total Borrowed"
                    value={totalBorrowed > 0 ? formatCurrency(totalBorrowed) : '—'}
                    sub={totalBorrowed > 0 ? 'Simulated disbursements' : 'Nothing disbursed yet'}
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
                    <ApplicationWorkflowStepper currentStep={workflowStep(activeApp.status)} dates={{ 0: formatDate(activeApp.submittedAt) }} />
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
                    <div className="overflow-x-auto">
                    <table className="w-full min-w-[480px]">
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
                    </div>
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
                        <p className="text-slate-500 text-sm">No application is in progress, so no documents are needed right now.</p>
                    )}
                </Card>
            </div>

            {/* Accepted offer + Recent activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {acceptedOffer && latestAccepted && (
                    <Card>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-base font-bold text-white">Accepted Offer</h2>
                            <StatusBadge status={latestAccepted.status} size="sm" />
                        </div>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: acceptedOffer.lenderLogoColor }}>
                                {acceptedOffer.lenderLogoInitials}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-white">{acceptedOffer.lenderName}</p>
                                <p className="text-xs text-slate-500">Application #{latestAccepted.id}</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-300">
                            {formatCurrency(acceptedOffer.amount)} at {acceptedOffer.interest_rate}% p.a. for {acceptedOffer.tenure_months} months
                        </p>
                        <Link to="/beneficiary/disbursement" className="text-emerald-400 hover:text-emerald-300 text-sm flex items-center gap-1 mt-3 transition-colors">
                            Track disbursement <ArrowRight size={14} />
                        </Link>
                    </Card>
                )}
                <Card className={acceptedOffer ? '' : 'lg:col-span-2'}>
                    <h2 className="text-base font-bold text-white mb-4">Recent Activity</h2>
                    {recentActivity.length === 0 ? (
                        <p className="text-slate-500 text-sm">Nothing yet. Updates on your applications will appear here.</p>
                    ) : (
                        <ul className="space-y-3">
                            {recentActivity.map(n => (
                                <li key={n.id}>
                                    <p className="text-sm text-slate-200">{n.title}</p>
                                    <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>
                                </li>
                            ))}
                        </ul>
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
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
                                <div className="grid grid-cols-[1.5fr_1fr_1fr] gap-2 mb-3">
                                    <div>
                                        <p className="text-emerald-400 font-bold text-sm whitespace-nowrap">{formatCurrency(offer.amount)}</p>
                                        <p className="text-slate-500 text-xs">Loan Amount</p>
                                    </div>
                                    <div>
                                        <p className="text-white font-bold text-sm">{offer.interest_rate}%</p>
                                        <p className="text-slate-500 text-xs">Interest Rate</p>
                                    </div>
                                    <div>
                                        <p className="text-white font-bold text-sm">{offer.tenure_months}M</p>
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
