import { Link } from 'react-router-dom';
import { useLender } from '@/context/useAuth';
import { useApp } from '@/context/useApp';
import { Card, EmptyState } from '@/components/shared/UI';
import { DisbursementStepper } from '@/components/shared/Stepper';
import { CheckSquare } from 'lucide-react';

function fmt(n) { return '₹' + n.toLocaleString('en-IN'); }

export default function AcceptedOffers() {
    const lender = useLender();
    const { getOffersByLender, getLenderApplication } = useApp();
    const accepted = getOffersByLender(lender.id).filter(o => o.status === 'ACCEPTED');

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">Accepted Offers</h1>
                <p className="text-slate-500 mt-1 text-sm">Offers accepted by beneficiaries and simulated disbursement progress.</p>
            </div>
            <div className="px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-400">
                ⚠ Disbursement is fully simulated. No real money is transferred in this academic prototype.
            </div>
            {accepted.length === 0 ? (
                <EmptyState icon={<CheckSquare size={40} />} title="No accepted offers yet" description="Offers accepted by beneficiaries will appear here." />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {accepted.map(o => {
                        const app = getLenderApplication(o.applicationId, lender.id);
                        const steps = app?.disbursementSteps || [];
                        const pct = steps.length ? Math.round((steps.filter(s => s.status === 'completed').length / steps.length) * 100) : 0;
                        return (
                            <Card key={o.id}>
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h2 className="text-base font-bold text-white">{app?.beneficiaryName || '—'}</h2>
                                        <p className="text-xs text-slate-500">App #{o.applicationId}</p>
                                    </div>
                                    <Link to={`/lender/applications/${o.applicationId}`} className="text-xs text-emerald-400 hover:underline">View App</Link>
                                </div>
                                <div className="grid grid-cols-3 gap-2 mb-4">
                                    <div className="text-center p-2 bg-[#0d1117] rounded-lg">
                                        <p className="text-emerald-400 font-bold text-sm">{fmt(o.amount)}</p>
                                        <p className="text-slate-500 text-xs">Amount</p>
                                    </div>
                                    <div className="text-center p-2 bg-[#0d1117] rounded-lg">
                                        <p className="text-white font-bold text-sm">{o.interest_rate}%</p>
                                        <p className="text-slate-500 text-xs">Rate</p>
                                    </div>
                                    <div className="text-center p-2 bg-[#0d1117] rounded-lg">
                                        <p className="text-white font-bold text-sm">{o.tenure_months}M</p>
                                        <p className="text-slate-500 text-xs">Tenure</p>
                                    </div>
                                </div>
                                <div className="mb-1 flex justify-between text-xs text-slate-500">
                                    <span>Disbursement Progress</span><span>{pct}%</span>
                                </div>
                                <div className="w-full bg-[#30363d] rounded-full h-1.5 mb-4">
                                    <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
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
