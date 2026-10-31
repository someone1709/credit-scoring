import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useRole } from '@/context/RoleContext';
import { useApp } from '@/context/AppContext';
import { Card, InfoRow, DemoDisclaimer } from '@/components/shared/UI';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ScoreGauge } from '@/components/shared/ScoreGauge';
import { ArrowLeft, Loader2, CheckCircle } from 'lucide-react';
import type { LenderDecisionStatus } from '@/types';
import clsx from 'clsx';

function fmt(n: number) { return '₹' + n.toLocaleString('en-IN'); }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }

export default function ApplicationReview() {
    const { id } = useParams<{ id: string }>();
    const { lender } = useRole();
    const { applications, updateLenderDecision, createOffer } = useApp();
    const navigate = useNavigate();
    const app = applications.find(a => a.id === id);

    const [actionLoading, setActionLoading] = useState(false);
    const [showOfferForm, setShowOfferForm] = useState(false);
    const [offerData, setOfferData] = useState({ amount: app?.loan_amount || 0, interest_rate: 12.5, tenure_months: 12, features: '' });
    const [noteInput, setNoteInput] = useState('');
    const [actionDone, setActionDone] = useState('');

    if (!app) return (
        <div className="text-center py-16">
            <p className="text-slate-500">Application not found.</p>
            <Link to="/lender/applications" className="text-emerald-400 hover:underline mt-2 inline-block">← Back</Link>
        </div>
    );

    const myDecision = app.lenderDecisions.find(d => d.lenderId === lender.id);
    const ass = app.assessment;

    const doAction = async (status: LenderDecisionStatus, note?: string) => {
        setActionLoading(true);
        await new Promise(r => setTimeout(r, 700));
        updateLenderDecision(app.id, lender.id, lender.name, status, note || noteInput || undefined);
        setActionDone(status);
        setActionLoading(false);
        setNoteInput('');
    };

    const submitOffer = async () => {
        setActionLoading(true);
        await new Promise(r => setTimeout(r, 700));
        createOffer(app.id, lender.id, { ...offerData, features: offerData.features });
        setShowOfferForm(false);
        setActionDone('OFFER_MADE');
        setActionLoading(false);
    };

    return (
        <div className="space-y-6 max-w-4xl">
            {/* Header */}
            <div className="flex items-center gap-3">
                <button onClick={() => navigate('/lender/applications')} className="text-slate-400 hover:text-white transition-colors">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-xl font-bold text-white">Application #{app.id}</h1>
                    <p className="text-slate-500 text-sm">{app.beneficiaryName} · Submitted {fmtDate(app.submittedAt)}</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <StatusBadge status={app.status} />
                    {myDecision && <StatusBadge status={myDecision.status} />}
                </div>
            </div>

            <DemoDisclaimer />

            {/* Action success banner */}
            {actionDone && (
                <div className="flex items-center gap-2 px-4 py-3 bg-emerald-500/15 border border-emerald-500/30 rounded-lg">
                    <CheckCircle size={16} className="text-emerald-400" />
                    <span className="text-emerald-400 text-sm font-medium">Decision recorded: <strong>{actionDone.replace('_', ' ')}</strong></span>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Applicant & Financial Info */}
                <Card>
                    <h2 className="text-base font-bold text-white mb-4">Applicant & Financial Profile</h2>
                    <InfoRow label="Applicant" value={app.beneficiaryName} />
                    <InfoRow label="Loan Amount" value={fmt(app.loan_amount)} />
                    <InfoRow label="Purpose" value={app.loan_purpose} />
                    <InfoRow label="Tenure" value={`${app.tenure_months} months`} />
                    <InfoRow label="Monthly Income" value={fmt(app.monthly_income)} />
                    <InfoRow label="Monthly Expenses" value={fmt(app.monthly_expenses)} />
                    <InfoRow label="Existing EMI" value={fmt(app.existing_emi)} />
                    <InfoRow label="Repayment History" value={app.repayment_history === 'none' ? 'None (first-time borrower)' : app.repayment_history} />
                    {app.electricity_usage != null && <InfoRow label="Electricity Usage" value={`${app.electricity_usage} units/mo`} />}
                    <div className="mt-3 pt-3 border-t border-[#30363d] space-y-1 text-xs text-slate-500">
                        <div className="flex justify-between"><span>DTI Ratio</span><span className="text-slate-300">{((app.existing_emi / app.monthly_income) * 100).toFixed(1)}%</span></div>
                        <div className="flex justify-between"><span>Monthly Surplus</span><span className="text-slate-300">{fmt(app.monthly_income - app.monthly_expenses - app.existing_emi)}</span></div>
                        <div className="flex justify-between"><span>Expense Ratio</span><span className="text-slate-300">{((app.monthly_expenses / app.monthly_income) * 100).toFixed(1)}%</span></div>
                    </div>
                </Card>

                {/* Risk Analysis */}
                {ass && (
                    <Card>
                        <h2 className="text-base font-bold text-white mb-4">Credit Risk Analysis</h2>
                        <div className="flex justify-center gap-6 mb-4">
                            <ScoreGauge score={ass.risk_score} label="Risk Score" sublabel="Higher = more risk" />
                            <ScoreGauge score={ass.composite_score} label="Composite Score" sublabel="Higher = better" />
                        </div>
                        <InfoRow label="Risk Category" value={<StatusBadge status={ass.risk_category} size="sm" />} />
                        <InfoRow label="Income Bracket" value={ass.income_bracket.replace('_', ' ')} />
                        <InfoRow label="Segment" value={ass.segment.replace(/_/g, ' ')} />
                        {ass.probability_of_default !== null && <InfoRow label="Prob. of Default" value={`${(ass.probability_of_default * 100).toFixed(1)}%`} />}
                        <InfoRow label="Thin-file Applicant" value={ass.is_thin_file ? '⚠ Yes — first-time borrower' : 'No'} />
                        <InfoRow label="Explanation Method" value={ass.explanation_method} />
                        <InfoRow label="Verification Status" value={<StatusBadge status={ass.verification_status} size="sm" />} />
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
                    </Card>
                )}
            </div>

            {/* Documents */}
            <Card>
                <h2 className="text-base font-bold text-white mb-4">Supporting Documents</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {app.documents.map(doc => (
                        <div key={doc.id} className="flex items-center justify-between p-3 bg-[#0d1117] rounded-lg border border-[#30363d]">
                            <div>
                                <p className="text-sm font-medium text-white">{doc.label}</p>
                                {doc.checkNote && <p className="text-xs text-slate-500 mt-0.5">{doc.checkNote}</p>}
                            </div>
                            <StatusBadge status={doc.verification_status} size="sm" />
                        </div>
                    ))}
                </div>
                <p className="text-xs text-slate-600 mt-3">
                    CHECKS_PASSED indicates only that basic file format checks passed. No government verification is integrated. Documents are demo only.
                </p>
            </Card>

            {/* Lender Actions */}
            <Card>
                <h2 className="text-base font-bold text-white mb-1">Your Decision</h2>
                <p className="text-slate-500 text-xs mb-4">Your decision applies only to {lender.name}'s review of this application and does not affect other lenders.</p>
                {myDecision && (
                    <div className="flex items-center gap-2 mb-4 p-3 bg-[#0d1117] rounded-lg border border-[#30363d]">
                        <span className="text-slate-400 text-sm">Current decision:</span>
                        <StatusBadge status={myDecision.status} />
                        {myDecision.note && <span className="text-xs text-slate-500"> · {myDecision.note}</span>}
                    </div>
                )}

                {/* Note input */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Note (optional)</label>
                    <textarea
                        value={noteInput}
                        onChange={e => setNoteInput(e.target.value)}
                        rows={2}
                        placeholder="Add a note with your decision..."
                        className="w-full px-3 py-2 bg-[#0d1117] border border-[#30363d] rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 resize-none"
                    />
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={() => doAction('UNDER_REVIEW')}
                        disabled={actionLoading || myDecision?.status === 'UNDER_REVIEW'}
                        className="px-4 py-2.5 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-400 rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                        {actionLoading ? <Loader2 size={14} className="animate-spin" /> : null} Mark Under Review
                    </button>
                    <button
                        onClick={() => doAction('INFO_REQUESTED')}
                        disabled={actionLoading}
                        className="px-4 py-2.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-400 rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        Request Info
                    </button>
                    <button
                        onClick={() => setShowOfferForm(v => !v)}
                        className="px-4 py-2.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 rounded-lg text-sm font-medium transition-colors"
                    >
                        {showOfferForm ? 'Cancel Offer' : 'Make Offer'}
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
                    <div className="mt-5 p-4 bg-[#0d1117] rounded-xl border border-emerald-500/20">
                        <h3 className="text-sm font-bold text-emerald-400 mb-4">Create Loan Offer</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">Amount (₹)</label>
                                <input
                                    type="number"
                                    value={offerData.amount}
                                    onChange={e => setOfferData(d => ({ ...d, amount: Number(e.target.value) }))}
                                    className="w-full px-3 py-2 bg-[#161b22] border border-[#30363d] rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500/50"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">Interest Rate (% p.a.)</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    value={offerData.interest_rate}
                                    onChange={e => setOfferData(d => ({ ...d, interest_rate: Number(e.target.value) }))}
                                    className="w-full px-3 py-2 bg-[#161b22] border border-[#30363d] rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500/50"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">Tenure (months)</label>
                                <select
                                    value={offerData.tenure_months}
                                    onChange={e => setOfferData(d => ({ ...d, tenure_months: Number(e.target.value) }))}
                                    className="w-full px-3 py-2 bg-[#161b22] border border-[#30363d] rounded-lg text-sm text-white focus:outline-none"
                                >
                                    {[6, 12, 18, 24, 36, 48].map(t => <option key={t} value={t}>{t} months</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="mb-4">
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">Features (comma-separated)</label>
                            <input
                                type="text"
                                value={offerData.features}
                                onChange={e => setOfferData(d => ({ ...d, features: e.target.value }))}
                                placeholder="e.g. Low interest rate, Flexible repayment"
                                className="w-full px-3 py-2 bg-[#161b22] border border-[#30363d] rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50"
                            />
                        </div>
                        <button
                            onClick={submitOffer}
                            disabled={actionLoading}
                            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white rounded-lg text-sm font-semibold transition-colors"
                        >
                            {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                            Submit Offer
                        </button>
                    </div>
                )}
            </Card>

            {/* Other Lender Decisions */}
            <Card>
                <h2 className="text-base font-bold text-white mb-4">All Lender Decisions</h2>
                <div className="space-y-2">
                    {app.lenderDecisions.map(d => (
                        <div key={d.lenderId} className={clsx(
                            'flex items-center justify-between p-3 rounded-lg border',
                            d.lenderId === lender.id ? 'border-emerald-500/30 bg-emerald-900/10' : 'border-[#30363d] bg-[#0d1117]'
                        )}>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-white">{d.lenderName}</span>
                                {d.lenderId === lender.id && <span className="text-xs text-emerald-400">(you)</span>}
                            </div>
                            <StatusBadge status={d.status} size="sm" />
                        </div>
                    ))}
                </div>
                <p className="text-xs text-slate-600 mt-3">Each lender's decision is independent.</p>
            </Card>
        </div>
    );
}
