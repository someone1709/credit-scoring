import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useBeneficiary } from '@/context/useAuth';
import { useApp } from '@/context/useApp';
import { ActionError, Card, EmptyState, DemoDisclaimer } from '@/components/shared/UI';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { calculateEmi, totalRepayable } from '@/lib/finance';
import { CheckCircle, Gift } from 'lucide-react';
import clsx from 'clsx';

function formatCurrency(n) { return '₹' + n.toLocaleString('en-IN'); }
function formatDate(iso) {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function OfferCard({ offer, highlights, busy = false, onAccept, onDecline }) {
    const emi = calculateEmi(offer.amount, offer.interest_rate, offer.tenure_months);
    const repayable = totalRepayable(offer.amount, offer.interest_rate, offer.tenure_months);
    const isPending = offer.status === 'PENDING';
    const isAccepted = offer.status === 'ACCEPTED';

    return (
        <div className={clsx(
            'border rounded-xl p-5 transition-all',
            isAccepted ? 'border-emerald-500/50 bg-emerald-900/10' : 'border-[#30363d] bg-[#0d1117] hover:border-slate-500',
        )}>
            {/* Header */}
            <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-3 min-w-0">
                    <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                        style={{ backgroundColor: offer.lenderLogoColor }}
                    >
                        {offer.lenderLogoInitials}
                    </div>
                    <div className="min-w-0">
                        <p className="text-white font-semibold">{offer.lenderName}</p>
                        <p className="text-xs text-slate-500">Offer for App #{offer.applicationId}</p>
                    </div>
                </div>
                <StatusBadge status={offer.status} />
            </div>

            {highlights && highlights.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                    {highlights.map(label => (
                        <span key={label} className="px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 text-xs font-medium">{label}</span>
                    ))}
                </div>
            )}

            {/* Metrics */}
            <div className="grid grid-cols-[1.5fr_1fr_1fr] gap-2 mb-4">
                <div className="text-center py-3 px-1 bg-[#1c2333] rounded-lg">
                    <p className="text-emerald-400 font-bold text-sm whitespace-nowrap">{formatCurrency(offer.amount)}</p>
                    <p className="text-slate-500 text-xs">Loan Amount</p>
                </div>
                <div className="text-center py-3 px-1 bg-[#1c2333] rounded-lg">
                    <p className="text-white font-bold text-sm whitespace-nowrap">{offer.interest_rate}%</p>
                    <p className="text-slate-500 text-xs">p.a. Interest</p>
                </div>
                <div className="text-center py-3 px-1 bg-[#1c2333] rounded-lg">
                    <p className="text-white font-bold text-sm">{offer.tenure_months}M</p>
                    <p className="text-slate-500 text-xs">Tenure</p>
                </div>
            </div>

            <div className="space-y-1 mb-3 text-xs text-slate-500">
                <div className="flex justify-between"><span>Est. EMI</span><strong className="text-slate-300">{formatCurrency(emi)}/mo</strong></div>
                <div className="flex justify-between"><span>Total repayable</span><strong className="text-slate-300">{formatCurrency(repayable)}</strong></div>
                {offer.expiresAt && isPending && <div className="flex justify-between"><span>Expires</span><span>{formatDate(offer.expiresAt)}</span></div>}
            </div>

            {/* Features */}
            {offer.features.length > 0 && (
                <ul className="space-y-1 mb-4">
                    {offer.features.map((f, i) => (
                        <li key={i} className="flex items-center gap-2 text-xs text-slate-400">
                            <CheckCircle size={10} className="text-emerald-500 flex-shrink-0" />{f}
                        </li>
                    ))}
                </ul>
            )}

            {/* Actions */}
            {isPending && onAccept && onDecline && (
                <div className="flex gap-2 mt-2">
                    <button
                        onClick={onAccept}
                        disabled={busy}
                        className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white rounded-lg text-sm font-semibold transition-colors"
                    >
                        Accept Offer
                    </button>
                    <button
                        onClick={onDecline}
                        disabled={busy}
                        className="flex-1 py-2 bg-red-500/15 hover:bg-red-500/25 disabled:opacity-60 border border-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-colors"
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

/** Marks the best live offer on each measure. Only meaningful when there's more than one to compare. */
function comparisonHighlights(offers) {
    const highlights = new Map();
    if (offers.length < 2) return highlights;
    const mark = (label, score) => {
        const best = Math.min(...offers.map(score));
        // A tie isn't a highlight, because it doesn't help anyone choose.
        const winners = offers.filter(o => score(o) === best);
        if (winners.length === 1) highlights.set(winners[0].id, [...(highlights.get(winners[0].id) ?? []), label]);
    };
    mark('Lowest rate', o => o.interest_rate);
    mark('Lowest EMI', o => calculateEmi(o.amount, o.interest_rate, o.tenure_months));
    mark('Lowest total cost', o => totalRepayable(o.amount, o.interest_rate, o.tenure_months) - o.amount);
    return highlights;
}

export default function LoanOffers() {
    const beneficiary = useBeneficiary();
    const { getApplicationsByBeneficiary, acceptOffer, declineOffer } = useApp();
    const apps = getApplicationsByBeneficiary(beneficiary.id);
    const [confirmAccept, setConfirmAccept] = useState(null);
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);

    const run = async (action) => {
        setError(null);
        setBusy(true);
        try {
            await action();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
        } finally {
            setBusy(false);
        }
    };

    const allOffers = apps.flatMap(app => app.offers);

    if (allOffers.length === 0) {
        return (
            <div className="space-y-6">
                <h1 className="text-2xl font-bold text-white">Loan Offers</h1>
                <EmptyState
                    icon={<Gift size={40} />}
                    title="No offers yet"
                    description="Lenders will review your applications and send offers. Check back soon."
                    action={<Link to="/beneficiary/applications" className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-semibold transition-colors">View My Applications</Link>}
                />
            </div>
        );
    }

    // Offers are only comparable within one application, since each answers a different request.
    const appsWithLiveOffers = apps
        .map(app => ({ app, live: app.offers.filter(o => o.status === 'PENDING') }))
        .filter(({ live }) => live.length > 0);
    const others = allOffers.filter(o => o.status !== 'PENDING');
    const siblingCount = confirmAccept
        ? allOffers.filter(o => o.applicationId === confirmAccept.applicationId && o.status === 'PENDING').length - 1
        : 0;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">Loan Offers from Lenders</h1>
                <p className="text-slate-500 mt-1 text-sm">Compare offers and choose the one that suits you best. You can accept only one offer per application.</p>
            </div>
            <DemoDisclaimer />
            <ActionError message={error} />

            {appsWithLiveOffers.map(({ app, live }) => {
                const highlights = comparisonHighlights(live);
                return (
                    <div key={app.id}>
                        <h2 className="text-base font-semibold text-emerald-400 mb-1">Available Offers for #{app.id} ({live.length})</h2>
                        <p className="text-xs text-slate-500 mb-3">You asked for {formatCurrency(app.loan_amount)} over {app.tenure_months} months.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {live.map(offer => (
                                <OfferCard
                                    key={offer.id}
                                    offer={offer}
                                    highlights={highlights.get(offer.id)}
                                    busy={busy}
                                    onAccept={() => setConfirmAccept(offer)}
                                    onDecline={() => void run(() => declineOffer(offer.id, offer.applicationId, beneficiary.id))}
                                />
                            ))}
                        </div>
                    </div>
                );
            })}

            {others.length > 0 && (
                <div>
                    <h2 className="text-base font-semibold text-slate-500 mb-3">Past Offers</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {others.map(offer => (
                            <OfferCard key={offer.id} offer={offer} />
                        ))}
                    </div>
                </div>
            )}

            {/* Accept Confirmation Modal */}
            {confirmAccept && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="accept-offer-title">
                    <Card className="w-full max-w-sm">
                        <h3 id="accept-offer-title" className="text-white font-bold text-lg mb-2">Accept this offer?</h3>
                        <p className="text-slate-300 text-sm mb-2">
                            {confirmAccept.lenderName}: {formatCurrency(confirmAccept.amount)} at {confirmAccept.interest_rate}% p.a. for {confirmAccept.tenure_months} months.
                        </p>
                        <p className="text-slate-400 text-sm mb-4">
                            {siblingCount > 0
                                ? `Your ${siblingCount === 1 ? 'other offer' : `${siblingCount} other offers`} for this application will be declined. `
                                : ''}
                            This can't be undone. This action is simulated.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    const offer = confirmAccept;
                                    setConfirmAccept(null);
                                    void run(() => acceptOffer(offer.id, offer.applicationId, beneficiary.id));
                                }}
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
