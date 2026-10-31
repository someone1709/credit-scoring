import { useState } from 'react';
import { useRole } from '@/context/RoleContext';
import { useApp } from '@/context/AppContext';
import { Card, EmptyState, DemoDisclaimer } from '@/components/shared/UI';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { CheckCircle, Gift } from 'lucide-react';
import type { LoanOffer } from '@/types';
import clsx from 'clsx';

function formatCurrency(n: number) { return '₹' + n.toLocaleString('en-IN'); }
function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function OfferCard({ offer, onAccept, onDecline }: {
    offer: LoanOffer & { applicationId: string };
    onAccept: () => void;
    onDecline: () => void;
}) {
    const emi = Math.round((offer.amount * (offer.interest_rate / 12 / 100)) /
        (1 - Math.pow(1 + offer.interest_rate / 12 / 100, -offer.tenure_months)));
    const isPending = offer.status === 'PENDING';
    const isAccepted = offer.status === 'ACCEPTED';

    return (
        <div className={clsx(
            'border rounded-xl p-5 transition-all',
            isAccepted ? 'border-emerald-500/50 bg-emerald-900/10' : 'border-[#30363d] bg-[#0d1117] hover:border-slate-500',
        )}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                        style={{ backgroundColor: offer.lenderLogoColor }}
                    >
                        {offer.lenderLogoInitials}
                    </div>
                    <div>
                        <p className="text-white font-semibold">{offer.lenderName}</p>
                        <p className="text-xs text-slate-500">Offer for App #{offer.applicationId}</p>
                    </div>
                </div>
                <StatusBadge status={offer.status} />
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center p-3 bg-[#1c2333] rounded-lg">
                    <p className="text-emerald-400 font-bold text-lg">{formatCurrency(offer.amount)}</p>
                    <p className="text-slate-500 text-xs">Loan Amount</p>
                </div>
                <div className="text-center p-3 bg-[#1c2333] rounded-lg">
                    <p className="text-white font-bold text-lg">{offer.interest_rate}%</p>
                    <p className="text-slate-500 text-xs">p.a. Interest</p>
                </div>
                <div className="text-center p-3 bg-[#1c2333] rounded-lg">
                    <p className="text-white font-bold text-lg">{offer.tenure_months}M</p>
                    <p className="text-slate-500 text-xs">Tenure</p>
                </div>
            </div>

            <div className="flex items-center justify-between mb-3 text-xs text-slate-500">
                <span>Est. EMI: <strong className="text-slate-300">₹{emi.toLocaleString('en-IN')}/mo</strong></span>
                {offer.expiresAt && <span>Expires: {formatDate(offer.expiresAt)}</span>}
            </div>

            {/* Features */}
            <ul className="space-y-1 mb-4">
                {offer.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-slate-400">
                        <CheckCircle size={10} className="text-emerald-500 flex-shrink-0" />{f}
                    </li>
                ))}
            </ul>

            {/* Actions */}
            {isPending && (
                <div className="flex gap-2 mt-2">
                    <button
                        onClick={onAccept}
                        className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-semibold transition-colors"
                    >
                        Accept Offer
                    </button>
                    <button
                        onClick={onDecline}
                        className="flex-1 py-2 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-colors"
                    >
                        Decline
                    </button>
                </div>
            )}
            {isAccepted && (
                <div className="flex items-center justify-center gap-2 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                    <CheckCircle size={14} className="text-emerald-400" />
                    <span className="text-emerald-400 text-sm font-medium">You accepted this offer</span>
                </div>
            )}
        </div>
    );
}

export default function LoanOffers() {
    const { beneficiary } = useRole();
    const { getApplicationsByBeneficiary, acceptOffer, declineOffer } = useApp();
    const apps = getApplicationsByBeneficiary(beneficiary.id);
    const [confirmAccept, setConfirmAccept] = useState<{ offerId: string; applicationId: string } | null>(null);

    const allOffers = apps.flatMap(app =>
        app.offers.map(o => ({ ...o, applicationId: app.id }))
    );

    if (allOffers.length === 0) {
        return (
            <div className="space-y-6">
                <h1 className="text-2xl font-bold text-white">Loan Offers</h1>
                <EmptyState
                    icon={<Gift size={40} />}
                    title="No offers yet"
                    description="Lenders will review your applications and send offers. Check back soon."
                />
            </div>
        );
    }

    const pending = allOffers.filter(o => o.status === 'PENDING');
    const others = allOffers.filter(o => o.status !== 'PENDING');

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">Loan Offers from Lenders</h1>
                <p className="text-slate-500 mt-1 text-sm">Compare offers and choose the one that suits you best. You can accept only one offer per application.</p>
            </div>
            <DemoDisclaimer />

            {pending.length > 0 && (
                <div>
                    <h2 className="text-base font-semibold text-emerald-400 mb-3">Available Offers ({pending.length})</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {pending.map(offer => (
                            <OfferCard
                                key={offer.id}
                                offer={offer}
                                onAccept={() => setConfirmAccept({ offerId: offer.id, applicationId: offer.applicationId })}
                                onDecline={() => declineOffer(offer.id)}
                            />
                        ))}
                    </div>
                </div>
            )}

            {others.length > 0 && (
                <div>
                    <h2 className="text-base font-semibold text-slate-500 mb-3">Past Offers</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {others.map(offer => (
                            <OfferCard key={offer.id} offer={offer} onAccept={() => { }} onDecline={() => { }} />
                        ))}
                    </div>
                </div>
            )}

            {/* Accept Confirmation Modal */}
            {confirmAccept && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-sm">
                        <h3 className="text-white font-bold text-lg mb-2">Accept this offer?</h3>
                        <p className="text-slate-400 text-sm mb-4">
                            Accepting this offer will decline all other pending offers for this application. This action is simulated.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => { acceptOffer(confirmAccept.offerId, confirmAccept.applicationId); setConfirmAccept(null); }}
                                className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-semibold transition-colors"
                            >
                                Yes, Accept
                            </button>
                            <button
                                onClick={() => setConfirmAccept(null)}
                                className="flex-1 py-2.5 bg-[#0d1117] border border-[#30363d] text-slate-300 rounded-lg text-sm font-medium transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
