import { Link } from 'react-router-dom';
import { useRole } from '@/context/RoleContext';
import { useApp } from '@/context/AppContext';
import { Card, EmptyState } from '@/components/shared/UI';
import { DisbursementStepper } from '@/components/shared/Stepper';
import { Wallet } from 'lucide-react';

export default function LenderDisbursement() {
    const { lender } = useRole();
    const { getOffersByLender, applications } = useApp();
    const accepted = getOffersByLender(lender.id).filter(o => o.status === 'ACCEPTED');

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">Disbursement Tracking</h1>
                <p className="text-slate-500 mt-1 text-sm">Simulated disbursement status for accepted offers.</p>
            </div>
            <div className="px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-400">
                ⚠ Disbursement is fully simulated. No real financial transactions occur in this prototype.
            </div>
            {accepted.length === 0 ? (
                <EmptyState icon={<Wallet size={40} />} title="No disbursements yet" description="Accepted offers will show disbursement progress here." action={<Link to="/lender/applications" className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-semibold">View Applications</Link>} />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {accepted.map(o => {
                        const app = applications.find(a => a.id === o.applicationId);
                        const steps = app?.disbursementSteps || [];
                        const pct = steps.length ? Math.round((steps.filter(s => s.status === 'completed').length / steps.length) * 100) : 0;
                        return (
                            <Card key={o.id}>
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h2 className="font-bold text-white">{app?.beneficiaryName}</h2>
                                        <p className="text-xs text-slate-500">#{o.applicationId} · ₹{o.amount.toLocaleString('en-IN')} @ {o.interest_rate}% for {o.tenure_months}M</p>
                                    </div>
                                    <Link to={`/lender/applications/${o.applicationId}`} className="text-xs text-emerald-400 hover:underline">View</Link>
                                </div>
                                <div className="mb-1 flex justify-between text-xs text-slate-500"><span>Progress</span><span>{pct}%</span></div>
                                <div className="w-full bg-[#30363d] rounded-full h-1.5 mb-5">
                                    <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                                </div>
                                {steps.length > 0 && <DisbursementStepper steps={steps} />}
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
