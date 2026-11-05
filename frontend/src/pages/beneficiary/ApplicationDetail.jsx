import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useApp } from '@/context/useApp';
import { useBeneficiary } from '@/context/useAuth';
import { ActionError, AssessmentNote, Card, ConfirmButton, InfoRow, DemoDisclaimer } from '@/components/shared/UI';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ScoreGauge } from '@/components/shared/ScoreGauge';
import { ApplicationWorkflowStepper, DisbursementStepper } from '@/components/shared/Stepper';
import { canRevokeLender, canUploadDocuments, workflowStep } from '@/lib/workflow';
import { ArrowLeft, Info } from 'lucide-react';

function formatCurrency(n) { return '₹' + n.toLocaleString('en-IN'); }
function formatDate(iso) {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const MAX_REPLY_LENGTH = 500;

/** One lender's question, with the applicant's answer. Only that lender can read either. */
function InformationRequest({ decision, onReply }) {
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState(null);
    const fieldId = `reply-${decision.lenderId}`;

    const send = async () => {
        setError(null);
        setSending(true);
        try {
            await onReply(message);
            setMessage('');
        } catch (e) {
            setError(e instanceof Error ? e.message : "Your reply couldn't be sent. Please try again.");
        } finally {
            setSending(false);
        }
    };

    return (
        <li className="p-3 bg-[#0d1117] rounded-lg border border-[#30363d]">
            <p className="text-sm text-slate-300 break-words"><strong className="text-white">{decision.lenderName}:</strong> {decision.note}</p>
            {decision.applicantReply && (
                <p className="text-sm text-slate-400 mt-2 break-words"><strong className="text-slate-300">Your reply:</strong> {decision.applicantReply}</p>
            )}
            <label htmlFor={fieldId} className="block text-xs font-medium text-slate-500 mt-3 mb-1.5">
                {decision.applicantReply ? 'Send a new reply' : `Reply to ${decision.lenderName}`}
            </label>
            <textarea
                id={fieldId}
                rows={2}
                maxLength={MAX_REPLY_LENGTH}
                value={message}
                onChange={e => setMessage(e.target.value)}
                className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
            <ActionError message={error} className="mt-2" />
            <div className="flex items-center justify-between gap-3 mt-2">
                <span className="text-xs text-slate-600">{message.length}/{MAX_REPLY_LENGTH}</span>
                <button
                    type="button"
                    disabled={sending || message.trim() === ''}
                    onClick={() => void send()}
                    className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors"
                >
                    {sending ? 'Sending...' : 'Send Reply'}
                </button>
            </div>
        </li>
    );
}

export default function ApplicationDetail() {
    const { id } = useParams();
    const beneficiary = useBeneficiary();
    const { getBeneficiaryApplication, revokeLender, replyToLender } = useApp();
    const [accessError, setAccessError] = useState(null);
    const app = id ? getBeneficiaryApplication(id, beneficiary.id) : undefined;

    if (!app) return (
        <div className="text-center py-16">
            <p className="text-slate-500">Application not found.</p>
            <Link to="/beneficiary/applications" className="text-emerald-400 hover:underline mt-2 inline-block">← Back</Link>
        </div>
    );

    const assessment = app.assessment;
    const infoRequests = app.lenderDecisions.filter(d => d.status === 'INFO_REQUESTED');

    const removeAccess = async (lenderId) => {
        setAccessError(null);
        try {
            await revokeLender(app.id, lenderId, beneficiary.id);
        } catch (e) {
            setAccessError(e instanceof Error ? e.message : "Access couldn't be removed. Please try again.");
        }
    };

    return (
        <div className="space-y-6 max-w-4xl">
            <div className="flex flex-wrap items-center gap-3">
                <Link to="/beneficiary/applications" className="text-slate-400 hover:text-white transition-colors">
                    <ArrowLeft size={20} />
                </Link>
                <div>
                    <h1 className="text-xl font-bold text-white">Application #{app.id}</h1>
                    <p className="text-slate-500 text-sm">Submitted {formatDate(app.submittedAt)}</p>
                </div>
                <div className="ml-auto"><StatusBadge status={app.status} /></div>
            </div>

            <DemoDisclaimer />

            {/* Workflow stepper */}
            <Card>
                <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-5">Application Progress</h2>
                <ApplicationWorkflowStepper currentStep={workflowStep(app.status)} dates={{ 0: formatDate(app.submittedAt) }} rejected={app.status === 'REJECTED'} />
            </Card>

            {/* Information requests */}
            {infoRequests.length > 0 && (
                <Card className="border-amber-500/30">
                    <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2"><Info size={16} className="text-amber-400" /> Information Requested</h2>
                    <ul className="space-y-3">
                        {infoRequests.map(d => (
                            <InformationRequest key={d.lenderId} decision={d} onReply={message => replyToLender(app.id, d.lenderId, beneficiary.id, message)} />
                        ))}
                    </ul>
                    {canUploadDocuments(app) && (
                        <Link to="/beneficiary/documents" className="inline-block mt-4 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-semibold transition-colors">
                            Upload Documents
                        </Link>
                    )}
                </Card>
            )}

            {/* Details + Assessment */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                <Card>
                    <h2 className="text-base font-bold text-white mb-4">Loan Details</h2>
                    <InfoRow label="Loan Amount" value={formatCurrency(app.loan_amount)} />
                    <InfoRow label="Purpose" value={app.loan_purpose} />
                    <InfoRow label="Tenure" value={`${app.tenure_months} months`} />
                    <InfoRow label="Monthly Income" value={formatCurrency(app.monthly_income)} />
                    <InfoRow label="Monthly Expenses" value={formatCurrency(app.monthly_expenses)} />
                    <InfoRow label="Existing EMI" value={formatCurrency(app.existing_emi)} />
                    <InfoRow label="Repayment History" value={app.repayment_history === 'none' ? 'None (first-time borrower)' : app.repayment_history} />
                    {app.electricity_usage != null && <InfoRow label="Electricity Usage" value={`${app.electricity_usage} units/mo`} />}
                </Card>

                {assessment && (
                    <Card>
                        <h2 className="text-base font-bold text-white mb-4">Credit Assessment</h2>
                        <div className="flex justify-center gap-6 mb-4">
                            <ScoreGauge kind="risk" score={assessment.risk_score} label="Risk Score" sublabel="Higher = more risk" />
                            <ScoreGauge kind="composite" score={assessment.composite_score} label="Composite Score" sublabel="Higher = better profile" />
                        </div>
                        <InfoRow label="Risk Category" value={<StatusBadge status={assessment.risk_category} size="sm" />} />
                        <InfoRow label="Income Bracket" value={assessment.income_bracket.replace('_', ' ')} />
                        <InfoRow label="Segment" value={assessment.segment.replace(/_/g, ' ')} />
                        <InfoRow label="Prob. of Default" value={assessment.probability_of_default !== null ? `${(assessment.probability_of_default * 100).toFixed(1)}%` : 'Unavailable'} />
                        <InfoRow label="Model Confidence" value={assessment.model_confidence !== null ? `${(assessment.model_confidence * 100).toFixed(1)}%` : 'Unavailable'} />
                        <InfoRow label="Thin-file" value={assessment.is_thin_file ? 'Yes, no repayment history on record' : 'No'} />
                        <InfoRow label="Documents" value={<StatusBadge status={assessment.verification_status} size="sm" />} />
                        <InfoRow label="Method" value={assessment.explanation_method} />
                        <div className="mt-3 p-3 bg-[#0d1117] rounded-lg border border-[#30363d]">
                            <p className="text-xs text-slate-500 font-medium mb-2">Explanations ({assessment.explanation_method})</p>
                            <ul className="space-y-1">
                                {assessment.explanations.map((e, i) => (
                                    <li key={i} className="text-xs text-slate-400 flex items-start gap-1.5">
                                        <span className="text-blue-400 mt-0.5 flex-shrink-0">•</span>{e}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <AssessmentNote method={assessment.explanation_method} audience="beneficiary" />
                    </Card>
                )}
            </div>

            {/* Lender Decisions */}
            <Card>
                <h2 className="text-base font-bold text-white mb-4">Lender Decisions</h2>
                <ActionError message={accessError} className="mb-3" />
                <div className="space-y-3">
                    {app.lenderDecisions.length === 0 ? (
                        <p className="text-slate-500 text-sm">No lender can see this application. To share your details with a lender, submit a new application.</p>
                    ) : app.lenderDecisions.map(d => (
                        <div key={d.lenderId} className="p-3 bg-[#0d1117] rounded-lg border border-[#30363d] space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-white">{d.lenderName}</p>
                                    {d.note && <p className="text-xs text-slate-500 mt-0.5 break-words">{d.note}</p>}
                                </div>
                                <div className="text-right flex-shrink-0 ml-4">
                                    <StatusBadge status={d.status} size="sm" />
                                    <p className="text-xs text-slate-600 mt-1">{formatDate(d.lastUpdated)}</p>
                                </div>
                            </div>
                            {canRevokeLender(app, d.lenderId) && (
                                <div className="flex justify-end">
                                    <ConfirmButton
                                        label="Remove access"
                                        question={`Stop sharing this application with ${d.lenderName}? Any offer from it will be withdrawn, and this can't be undone.`}
                                        confirmLabel="Yes, remove"
                                        onConfirm={() => removeAccess(d.lenderId)}
                                    />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                <p className="text-xs text-slate-600 mt-3">* Each lender makes an independent decision. One rejection does not affect others.</p>
            </Card>

            {/* Document Status */}
            <Card>
                <h2 className="text-base font-bold text-white mb-4">Document Status</h2>
                <div className="space-y-3">
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
            </Card>

            {/* Disbursement */}
            {app.disbursementSteps.length > 0 && (
                <Card>
                    <h2 className="text-base font-bold text-white mb-4">Disbursement Status</h2>
                    <DisbursementStepper steps={app.disbursementSteps} />
                </Card>
            )}
        </div>
    );
}
