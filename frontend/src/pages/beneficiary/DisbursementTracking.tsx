import { Link } from 'react-router-dom';
import { useRole } from '@/context/RoleContext';
import { useApp } from '@/context/AppContext';
import { Card, EmptyState } from '@/components/shared/UI';
import { DisbursementStepper } from '@/components/shared/Stepper';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Wallet } from 'lucide-react';

export default function DisbursementTracking() {
    const { beneficiary } = useRole();
    const { getApplicationsByBeneficiary } = useApp();
    const apps = getApplicationsByBeneficiary(beneficiary.id);
    const disbursedApps = apps.filter(a => a.disbursementSteps.length > 0);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">Disbursement Tracking</h1>
                <p className="text-slate-500 mt-1 text-sm">Simulated disbursement progress for your accepted loans.</p>
            </div>
            <div className="px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-400">
                ⚠ Disbursement is fully simulated. No real money transfers occur in this prototype.
            </div>

            {disbursedApps.length === 0 ? (
                <EmptyState
                    icon={<Wallet size={40} />}
                    title="No disbursements yet"
                    description="Accept a lender offer to begin the disbursement process."
                    action={<Link to="/beneficiary/offers" className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-semibold">View Offers</Link>}
                />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {disbursedApps.map(app => {
                        const acceptedOffer = app.offers.find(o => o.status === 'ACCEPTED');
                        const completed = app.disbursementSteps.filter(s => s.status === 'completed').length;
                        const pct = Math.round((completed / app.disbursementSteps.length) * 100);
                        return (
                            <Card key={app.id}>
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h2 className="text-base font-bold text-white">Application #{app.id}</h2>
                                        <p className="text-xs text-slate-500">{app.loan_purpose}</p>
                                    </div>
                                    <StatusBadge status={app.status} />
                                </div>
                                {acceptedOffer && (
                                    <div className="grid grid-cols-3 gap-2 mb-4">
                                        <div className="text-center p-2 bg-[#0d1117] rounded-lg">
                                            <p className="text-emerald-400 font-bold text-sm">₹{acceptedOffer.amount.toLocaleString('en-IN')}</p>
                                            <p className="text-slate-500 text-xs">Amount</p>
                                        </div>
                                        <div className="text-center p-2 bg-[#0d1117] rounded-lg">
                                            <p className="text-white font-bold text-sm">{acceptedOffer.lenderName}</p>
                                            <p className="text-slate-500 text-xs">Lender</p>
                                        </div>
                                        <div className="text-center p-2 bg-[#0d1117] rounded-lg">
                                            <p className="text-white font-bold text-sm">{pct}%</p>
                                            <p className="text-slate-500 text-xs">Progress</p>
                                        </div>
                                    </div>
                                )}
                                <div className="w-full bg-[#30363d] rounded-full h-1.5 mb-5">
                                    <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                </div>
                                <DisbursementStepper steps={app.disbursementSteps} />
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
