import { useState } from 'react';
import { useLender } from '@/context/useAuth';
import { useApp } from '@/context/useApp';
import { Card, EmptyState } from '@/components/shared/UI';
import { calculateEmi, repaymentSchedule, totalRepayable } from '@/lib/finance';
import { CalendarClock, ChevronDown, ChevronUp } from 'lucide-react';

function fmt(n) { return '₹' + n.toLocaleString('en-IN'); }

export default function Repayments() {
    const lender = useLender();
    const { getApplicationsByLender } = useApp();
    const [openId, setOpenId] = useState(null);

    // A schedule exists only once this lender's accepted offer has been disbursed.
    const loans = getApplicationsByLender(lender.id).flatMap(app => {
        const offer = app.offers.find(o => o.lender_id === lender.id && o.status === 'ACCEPTED');
        return offer && app.status === 'DISBURSED' ? [{ app, offer }] : [];
    });

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">Repayments</h1>
                <p className="text-slate-500 mt-1 text-sm">Expected repayment schedules for your disbursed loans.</p>
            </div>
            <div className="px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-400">
                ⚠ Simulated. These schedules are calculated from the offer terms. No payments are collected or recorded in this prototype.
            </div>

            {loans.length === 0 ? (
                <EmptyState icon={<CalendarClock size={40} />} title="No repayment schedules yet" description="A schedule appears here once one of your accepted offers has been disbursed." />
            ) : (
                <div className="space-y-4">
                    {loans.map(({ app, offer }) => {
                        const isOpen = openId === offer.id;
                        const emi = calculateEmi(offer.amount, offer.interest_rate, offer.tenure_months);
                        const repayable = totalRepayable(offer.amount, offer.interest_rate, offer.tenure_months);
                        return (
                            <Card key={offer.id}>
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <h2 className="font-bold text-white">{app.beneficiaryName}</h2>
                                        <p className="text-xs text-slate-500">#{app.id} · {fmt(offer.amount)} @ {offer.interest_rate}% for {offer.tenure_months}M</p>
                                    </div>
                                    <button
                                        onClick={() => setOpenId(isOpen ? null : offer.id)}
                                        aria-expanded={isOpen}
                                        className="flex items-center gap-1.5 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
                                    >
                                        {isOpen ? 'Hide schedule' : 'View schedule'} {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    </button>
                                </div>
                                <div className="grid grid-cols-3 gap-2 mt-4">
                                    <div className="text-center p-2 bg-[#0d1117] rounded-lg">
                                        <p className="text-white font-bold text-sm">{fmt(emi)}</p>
                                        <p className="text-slate-500 text-xs">EMI</p>
                                    </div>
                                    <div className="text-center p-2 bg-[#0d1117] rounded-lg">
                                        <p className="text-white font-bold text-sm">{fmt(repayable)}</p>
                                        <p className="text-slate-500 text-xs">Total Repayable</p>
                                    </div>
                                    <div className="text-center p-2 bg-[#0d1117] rounded-lg">
                                        <p className="text-emerald-400 font-bold text-sm">{fmt(repayable - offer.amount)}</p>
                                        <p className="text-slate-500 text-xs">Total Interest</p>
                                    </div>
                                </div>
                                {isOpen && (
                                    <div className="overflow-x-auto mt-4">
                                        <table className="w-full min-w-[420px]">
                                            <thead>
                                                <tr className="border-b border-[#30363d]">
                                                    {['Instalment', 'EMI', 'Principal', 'Interest', 'Balance'].map(h => (
                                                        <th key={h} className="text-left text-xs text-slate-500 font-medium py-2 pr-4 whitespace-nowrap">{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {repaymentSchedule(offer.amount, offer.interest_rate, offer.tenure_months).map(row => (
                                                    <tr key={row.instalment} className="border-b border-[#30363d] last:border-0">
                                                        <td className="py-2 pr-4 text-sm text-slate-400">{row.instalment}</td>
                                                        <td className="py-2 pr-4 text-sm text-white whitespace-nowrap">{fmt(row.emi)}</td>
                                                        <td className="py-2 pr-4 text-sm text-slate-300 whitespace-nowrap">{fmt(row.principal)}</td>
                                                        <td className="py-2 pr-4 text-sm text-slate-300 whitespace-nowrap">{fmt(row.interest)}</td>
                                                        <td className="py-2 pr-4 text-sm text-slate-300 whitespace-nowrap">{fmt(row.balance)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
