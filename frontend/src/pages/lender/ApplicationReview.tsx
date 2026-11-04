import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLender } from '@/context/useAuth';
import { useApp } from '@/context/useApp';
import { ActionError, AssessmentNote, Card, InfoRow, DemoDisclaimer } from '@/components/shared/UI';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ScoreGauge } from '@/components/shared/ScoreGauge';
import { ViewDocumentButton } from '@/components/shared/DocumentViewer';
import { calculateEmi, dtiPercent, expenseRatioPercent, monthlySurplus } from '@/lib/finance';
import { getAcceptedOffer, getLiveOffer, isClosedToDecisions, type LenderAction } from '@/lib/workflow';
import { ArrowLeft, Loader2, CheckCircle, Lock } from 'lucide-react';
import type { LoanApplication } from '@/types';

function fmt(n: number) { return '₹' + n.toLocaleString('en-IN'); }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }

const offerSchema = z.object({
    amount: z.number({ error: 'Enter an amount' }).positive('Amount must be greater than 0').max(100000000, 'Please check this amount'),
    interest_rate: z.number({ error: 'Enter an interest rate' }).min(0, 'Cannot be negative').max(60, 'Please check this rate'),
    tenure_months: z.number().int().positive(),
    features: z.string().max(200, 'Use 200 characters or fewer').optional(),
});
type OfferForm = z.infer<typeof offerSchema>;

const offerInputCls = 'w-full px-3 py-2 bg-[#161b22] border border-[#30363d] rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50';
const toNumber = (value: unknown) => (value === '' || value === null || value === undefined ? NaN : Number(value));

const ACTION_LABEL: Record<LenderAction | 'OFFER_MADE' | 'WITHDRAWN', string> = {
    UNDER_REVIEW: 'Marked as under review',
    INFO_REQUESTED: 'Information requested from the applicant',
    REJECTED: 'Application rejected for your institution',
    OFFER_MADE: 'Offer sent to the applicant',
    WITHDRAWN: 'Offer withdrawn',
};

function OfferFormPanel({ app, onSubmit }: { app: LoanApplication; onSubmit: (data: OfferForm) => void }) {
    const { register, handleSubmit, watch, formState: { errors } } = useForm<OfferForm>({
        resolver: zodResolver(offerSchema),
        defaultValues: { amount: app.loan_amount, interest_rate: 12.5, tenure_months: app.tenure_months, features: '' },
    });
    const amount = watch('amount');
    const rate = watch('interest_rate');
    const tenure = watch('tenure_months');
    const emi = amount > 0 && rate >= 0 ? calculateEmi(amount, rate, tenure) : 0;

    return (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-5 p-4 bg-[#0d1117] rounded-xl border border-emerald-500/20">
            <h3 className="text-sm font-bold text-emerald-400 mb-1">Create Loan Offer</h3>
            <p className="text-xs text-slate-500 mb-4">The applicant asked for {fmt(app.loan_amount)} over {app.tenure_months} months. These terms are yours to decide.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div>
                    <label htmlFor="offer-amount" className="block text-xs font-medium text-slate-400 mb-1.5">Amount (₹)</label>
                    <input id="offer-amount" type="number" min="1" {...register('amount', { setValueAs: toNumber })} className={offerInputCls} />
                    {errors.amount && <p className="mt-1 text-xs text-red-400">{errors.amount.message}</p>}
                </div>
                <div>
                    <label htmlFor="offer-rate" className="block text-xs font-medium text-slate-400 mb-1.5">Interest Rate (% p.a.)</label>
                    <input id="offer-rate" type="number" step="0.25" min="0" {...register('interest_rate', { setValueAs: toNumber })} className={offerInputCls} />
                    {errors.interest_rate && <p className="mt-1 text-xs text-red-400">{errors.interest_rate.message}</p>}
                </div>
                <div>
                    <label htmlFor="offer-tenure" className="block text-xs font-medium text-slate-400 mb-1.5">Tenure (months)</label>
                    <select id="offer-tenure" {...register('tenure_months', { setValueAs: toNumber })} className={offerInputCls}>
                        {[...new Set([6, 12, 18, 24, 36, 48, app.tenure_months])].sort((a, b) => a - b).map(t => <option key={t} value={t}>{t} months</option>)}
                    </select>
                </div>
            </div>
            <div className="mb-4">
                <label htmlFor="offer-features" className="block text-xs font-medium text-slate-400 mb-1.5">Features (optional, comma-separated)</label>
                <input id="offer-features" type="text" {...register('features')} placeholder="e.g. Flexible repayment, No processing fee" className={offerInputCls} />
                {errors.features && <p className="mt-1 text-xs text-red-400">{errors.features.message}</p>}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-500">Estimated EMI: <strong className="text-slate-300">{fmt(emi)}/mo</strong></p>
                <button type="submit" className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-semibold transition-colors">
                    <CheckCircle size={14} /> Submit Offer
                </button>
            </div>
        </form>
    );
}

export default function ApplicationReview() {
    const { id } = useParams<{ id: string }>();
    const lender = useLender();
    const { getLenderApplication, updateLenderDecision, createOffer, withdrawOffer } = useApp();
    const navigate = useNavigate();
    // Only returns applications the beneficiary shared with this lender.
    const app = id ? getLenderApplication(id, lender.id) : undefined;

    const [actionLoading, setActionLoading] = useState(false);
    const [showOfferForm, setShowOfferForm] = useState(false);
    const [noteInput, setNoteInput] = useState('');
    const [actionDone, setActionDone] = useState('');
    const [actionError, setActionError] = useState<string | null>(null);

    if (!app) return (
        <div className="text-center py-16">
            <p className="text-slate-500">This application doesn't exist or hasn't been shared with you.</p>
            <Link to="/lender/applications" className="text-emerald-400 hover:underline mt-2 inline-block">← Back</Link>
        </div>
    );

    const myDecision = app.lenderDecisions.find(d => d.lenderId === lender.id);
    const myOffers = app.offers.filter(o => o.lender_id === lender.id);
    const liveOffer = getLiveOffer(app, lender.id);
    const closed = isClosedToDecisions(app);
    const acceptedMine = getAcceptedOffer(app)?.lender_id === lender.id;
    const ass = app.assessment;

    const perform = async (done: keyof typeof ACTION_LABEL, action: () => Promise<void>) => {
        setActionLoading(true);
        setActionError(null);
        setActionDone('');
        try {
            await action();
            setActionDone(ACTION_LABEL[done]);
            setNoteInput('');
            setShowOfferForm(false);
        } catch (e) {
            setActionError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
        } finally {
            setActionLoading(false);
        }
    };

    const doAction = (status: LenderAction) => perform(status, () => updateLenderDecision(app.id, lender, status, noteInput));

    return (
        <div className="space-y-6 max-w-4xl">
            {/* Header */}
            <div className="flex flex-wrap items-center gap-3">
                <button onClick={() => navigate('/lender/applications')} aria-label="Back to applications" className="text-slate-400 hover:text-white transition-colors">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-xl font-bold text-white">Application #{app.id}</h1>
                    <p className="text-slate-500 text-sm">{app.beneficiaryName} · Submitted {fmtDate(app.submittedAt)}</p>
                </div>
                {/* Your decision only: the overall status would reveal what other lenders did. */}
                <div className="ml-auto flex items-center gap-2">
                    {myDecision && <StatusBadge status={myDecision.status} />}
                </div>
            </div>

            <DemoDisclaimer />

            {/* Action success banner */}
            {actionDone && (
                <div role="status" className="flex items-center gap-2 px-4 py-3 bg-emerald-500/15 border border-emerald-500/30 rounded-lg">
                    <CheckCircle size={16} className="text-emerald-400 flex-shrink-0" />
                    <span className="text-emerald-400 text-sm font-medium">{actionDone}.</span>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                {/* Applicant & Financial Info */}
                <Card>
                    <h2 className="text-base font-bold text-white mb-4">Applicant & Financial Profile</h2>
                    <InfoRow label="Applicant" value={app.beneficiaryName} />
                    <InfoRow label="Occupation" value={app.applicantProfile.occupation || '—'} />
                    <InfoRow label="Location" value={[app.applicantProfile.city, app.applicantProfile.state].filter(Boolean).join(', ') || '—'} />
                    <InfoRow label="Loan Amount" value={fmt(app.loan_amount)} />
                    <InfoRow label="Purpose" value={app.loan_purpose} />
                    <InfoRow label="Tenure" value={`${app.tenure_months} months`} />
                    <InfoRow label="Monthly Income" value={fmt(app.monthly_income)} />
                    <InfoRow label="Monthly Expenses" value={fmt(app.monthly_expenses)} />
                    <InfoRow label="Existing EMI" value={fmt(app.existing_emi)} />
                    <InfoRow label="Repayment History" value={app.repayment_history === 'none' ? 'None (first-time borrower)' : <span className="capitalize">{app.repayment_history}</span>} />
                    <InfoRow label="Electricity Usage" value={app.electricity_usage != null ? `${app.electricity_usage} units/mo` : 'Not provided'} />
                    <div className="mt-3 pt-3 border-t border-[#30363d] space-y-1 text-xs text-slate-500">
                        <div className="flex justify-between"><span>DTI Ratio</span><span className="text-slate-300">{dtiPercent(app.existing_emi, app.monthly_income).toFixed(1)}%</span></div>
                        <div className="flex justify-between"><span>Monthly Surplus</span><span className="text-slate-300">{fmt(monthlySurplus(app.monthly_income, app.monthly_expenses, app.existing_emi))}</span></div>
                        <div className="flex justify-between"><span>Expense Ratio</span><span className="text-slate-300">{expenseRatioPercent(app.monthly_expenses, app.monthly_income).toFixed(1)}%</span></div>
                    </div>
                </Card>

                {/* Risk Analysis */}
                {ass && (
                    <Card>
                        <h2 className="text-base font-bold text-white mb-4">Credit Risk Analysis</h2>
                        <div className="flex justify-center gap-6 mb-4">
                            <ScoreGauge kind="risk" score={ass.risk_score} label="Risk Score" sublabel="Higher = more risk" />
                            <ScoreGauge kind="composite" score={ass.composite_score} label="Composite Score" sublabel="Higher = better" />
                        </div>
                        <InfoRow label="Risk Category" value={<StatusBadge status={ass.risk_category} size="sm" />} />
                        <InfoRow label="Income Bracket" value={ass.income_bracket.replace('_', ' ')} />
                        <InfoRow label="Segment" value={ass.segment.replace(/_/g, ' ')} />
                        <InfoRow label="Prob. of Default" value={ass.probability_of_default !== null ? `${(ass.probability_of_default * 100).toFixed(1)}%` : 'Unavailable'} />
                        <InfoRow label="Model Confidence" value={ass.model_confidence !== null ? `${(ass.model_confidence * 100).toFixed(1)}%` : 'Unavailable'} />
                        <InfoRow label="Thin-file Applicant" value={ass.is_thin_file ? 'Yes, no repayment history on record' : 'No'} />
                        <InfoRow label="Explanation Method" value={ass.explanation_method} />
                        <InfoRow label="Document Status" value={<StatusBadge status={ass.verification_status} size="sm" />} />
                        <div className="mt-3 p-3 bg-[#0d1117] rounded-lg border border-[#30363d]">
                            <p className="text-xs text-slate-500 font-medium mb-2">Explanations ({ass.explanation_method})</p>
                            <ul className="space-y-1">
                                {ass.explanations.map((e, i) => (
                                    <li key={i} className="text-xs text-slate-400 flex items-start gap-1.5">
                                        <span className="text-blue-400 mt-0.5 flex-shrink-0">•</span>{e}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <AssessmentNote method={ass.explanation_method} audience="lender" />
                    </Card>
                )}
            </div>

            {/* Documents */}
            <Card>
                <h2 className="text-base font-bold text-white mb-4">Supporting Documents</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {app.documents.map(doc => (
                        <div key={doc.id} className="flex items-center justify-between gap-3 p-3 bg-[#0d1117] rounded-lg border border-[#30363d]">
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-white">{doc.label}</p>
                                {doc.checkNote && <p className="text-xs text-slate-500 mt-0.5">{doc.checkNote}</p>}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <StatusBadge status={doc.verification_status} size="sm" />
                                {doc.fileAvailable && <ViewDocumentButton applicationId={app.id} document={doc} role="lender" />}
                            </div>
                        </div>
                    ))}
                </div>
                <p className="text-xs text-slate-600 mt-3">
                    File OK means only that the file's type and size passed. Nobody has confirmed it's genuine, and no government verification is integrated. Open each document and judge it yourself.
                </p>
            </Card>

            {/* Your offers on this application */}
            {myOffers.length > 0 && (
                <Card>
                    <h2 className="text-base font-bold text-white mb-4">Your Offers</h2>
                    <div className="space-y-2">
                        {myOffers.map(offer => (
                            <div key={offer.id} className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[#0d1117] rounded-lg border border-[#30363d]">
                                <p className="text-sm text-slate-200">{fmt(offer.amount)} at {offer.interest_rate}% for {offer.tenure_months} months</p>
                                <div className="flex items-center gap-3">
                                    <StatusBadge status={offer.status} size="sm" />
                                    {offer.status === 'PENDING' && !closed && (
                                        <button
                                            onClick={() => perform('WITHDRAWN', () => withdrawOffer(app.id, lender, offer.id))}
                                            disabled={actionLoading}
                                            className="text-xs font-medium text-red-400 hover:text-red-300 disabled:opacity-40 transition-colors"
                                        >
                                            Withdraw
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* Lender Actions */}
            <Card>
                <h2 className="text-base font-bold text-white mb-1">Your Decision</h2>
                <p className="text-slate-500 text-xs mb-4">Your decision applies only to {lender.name}'s review of this application and does not affect other lenders. The credit assessment supports your judgement but doesn't replace it.</p>
                {myDecision && (
                    <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-[#0d1117] rounded-lg border border-[#30363d]">
                        <span className="text-slate-400 text-sm">Current decision:</span>
                        <StatusBadge status={myDecision.status} />
                        {myDecision.note && <span className="text-xs text-slate-500">{myDecision.note}</span>}
                    </div>
                )}
                {myDecision?.applicantReply && (
                    <div className="mb-4 p-3 bg-[#0d1117] rounded-lg border border-emerald-500/30">
                        <p className="text-xs font-medium text-slate-500 mb-1">Applicant's reply{myDecision.applicantReplyAt && `, ${new Date(myDecision.applicantReplyAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`}</p>
                        <p className="text-sm text-slate-200 break-words">{myDecision.applicantReply}</p>
                    </div>
                )}

                <ActionError message={actionError} className="mb-4" />

                {closed ? (
                    <div className="flex items-start gap-2 p-3 bg-[#0d1117] rounded-lg border border-[#30363d] text-sm text-slate-300">
                        <Lock size={15} className="text-slate-500 mt-0.5 flex-shrink-0" />
                        {acceptedMine ? (
                            <span>The applicant accepted your offer. <Link to="/lender/disbursement" className="text-emerald-400 hover:underline">Track the disbursement</Link>.</span>
                        ) : (
                            <span>This application is no longer open for decisions.</span>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Note input */}
                        <div className="mb-4">
                            <label htmlFor="decision-note" className="block text-sm font-medium text-slate-400 mb-1.5">Note</label>
                            <textarea
                                id="decision-note"
                                value={noteInput}
                                onChange={e => setNoteInput(e.target.value)}
                                rows={2}
                                placeholder="Required when requesting information. Optional otherwise. The applicant can read this."
                                className="w-full px-3 py-2 bg-[#0d1117] border border-[#30363d] rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 resize-none"
                            />
                        </div>

                        {liveOffer && <p className="text-xs text-slate-500 mb-3">You have a live offer. Withdraw it above to mark this as under review or to request information. Rejecting also withdraws it.</p>}

                        {/* Action buttons */}
                        <div className="flex flex-wrap gap-3">
                            <button
                                onClick={() => doAction('UNDER_REVIEW')}
                                disabled={actionLoading || myDecision?.status === 'UNDER_REVIEW' || liveOffer !== undefined}
                                className="px-4 py-2.5 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-400 rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                            >
                                {actionLoading && <Loader2 size={14} className="animate-spin" />} Mark Under Review
                            </button>
                            <button
                                onClick={() => doAction('INFO_REQUESTED')}
                                disabled={actionLoading || liveOffer !== undefined}
                                className="px-4 py-2.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-400 rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                Request Info
                            </button>
                            <button
                                onClick={() => setShowOfferForm(v => !v)}
                                aria-expanded={showOfferForm}
                                className="px-4 py-2.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 rounded-lg text-sm font-medium transition-colors"
                            >
                                {showOfferForm ? 'Cancel Offer' : liveOffer ? 'Replace Offer' : 'Make Offer'}
                            </button>
                            <button
                                onClick={() => doAction('REJECTED')}
                                disabled={actionLoading || myDecision?.status === 'REJECTED'}
                                className="px-4 py-2.5 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                Reject Application
                            </button>
                        </div>

                        {/* Offer form */}
                        {showOfferForm && (
                            <OfferFormPanel app={app} onSubmit={data => perform('OFFER_MADE', () => createOffer(app.id, lender, data))} />
                        )}
                    </>
                )}
            </Card>
        </div>
    );
}
