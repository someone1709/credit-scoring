import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLender } from '@/context/useAuth';
import { useApp } from '@/context/useApp';
import { ActionError, Card, EmptyState } from '@/components/shared/UI';
import { DisbursementStepper } from '@/components/shared/Stepper';
import { CheckCircle, Wallet } from 'lucide-react';

export default function LenderDisbursement() {
    const lender = useLender();
    const { getOffersByLender, getLenderApplication, advanceDisbursement } = useApp();
    const accepted = getOffersByLender(lender.id).filter(o => o.status === 'ACCEPTED');
    const [error, setError] = useState<string | null>(null);

    const advance = (applicationId: string) => {
        setError(null);
        try {
            advanceDisbursement(applicationId, lender);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">Disbursement Tracking</h1>
                <p className="text-slate-500 mt-1 text-sm">Move each accepted offer through its simulated disbursement steps.</p>
            </div>
            <div className="px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-400">
                ⚠ Disbursement is fully simulated. No real financial transactions occur in this prototype.
            </div>
            <ActionError message={error} />
            {accepted.length === 0 ? (
                <EmptyState icon={<Wallet size={40} />} title="No disbursements yet" description="Accepted offers will show disbursement progress here." action={<Link to="/lender/applications" className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-semibold">View Applications</Link>} />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {accepted.map(o => {
                        const app = getLenderApplication(o.applicationId, lender.id);
                        const steps = app?.disbursementSteps || [];
                        const pct = steps.length ? Math.round((steps.filter(s => s.status === 'completed').length / steps.length) * 100) : 0;
                        const currentStep = steps.find(s => s.status === 'current');
                        return (
                            <Card key={o.id}>
                                <div className="flex items-center justify-between gap-3 mb-4">
                                    <div className="min-w-0">
                                        <h2 className="font-bold text-white">{app?.beneficiaryName}</h2>
                                        <p className="text-xs text-slate-500">#{o.applicationId} · ₹{o.amount.toLocaleString('en-IN')} @ {o.interest_rate}% for {o.tenure_months}M</p>
                                    </div>
                                    <Link to={`/lender/applications/${o.applicationId}`} className="text-xs text-emerald-400 hover:underline flex-shrink-0">View</Link>
                                </div>
                                <div className="mb-1 flex justify-between text-xs text-slate-500"><span>Progress</span><span>{pct}%</span></div>
                                <div className="w-full bg-[#30363d] rounded-full h-1.5 mb-5">
                                    <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                </div>
                                {steps.length > 0 && <DisbursementStepper steps={steps} />}
                                {currentStep ? (
                                    <button
                                        onClick={() => advance(o.applicationId)}
                                        className="w-full px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-semibold transition-colors"
                                    >
                                        Mark “{currentStep.label}” as done
                                    </button>
                                ) : (
                                    <p className="flex items-center justify-center gap-2 py-2 text-sm font-medium text-emerald-400">
                                        <CheckCircle size={14} /> Disbursement complete (simulated)
                                    </p>
                                )}
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
