import { useParams, Link } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { Card, InfoRow, DemoDisclaimer } from '@/components/shared/UI';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ScoreGauge } from '@/components/shared/ScoreGauge';
import { ApplicationWorkflowStepper, DisbursementStepper } from '@/components/shared/Stepper';
import { ArrowLeft } from 'lucide-react';

function formatCurrency(n: number) { return '₹' + n.toLocaleString('en-IN'); }
function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_TO_STEP: Record<string, number> = {
    SUBMITTED: 0, DOCUMENTS_REQUIRED: 1, UNDER_REVIEW: 3,
    OFFERS_AVAILABLE: 3, OFFER_ACCEPTED: 4, REJECTED: 4, DISBURSED: 4,
};

export default function ApplicationDetail() {
    const { id } = useParams<{ id: string }>();
    const { applications } = useApp();
    const app = applications.find(a => a.id === id);

    if (!app) return (
        <div className="text-center py-16">
            <p className="text-slate-500">Application not found.</p>
            <Link to="/beneficiary/applications" className="text-emerald-400 hover:underline mt-2 inline-block">← Back</Link>
        </div>
    );

    const assessment = app.assessment;
    const currentStep = STATUS_TO_STEP[app.status] ?? 0;

    return (
        <div className="space-y-6 max-w-4xl">
            <div className="flex items-center gap-3">
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
                <ApplicationWorkflowStepper currentStep={currentStep} />
            </Card>

            {/* Details + Assessment */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            <ScoreGauge score={assessment.risk_score} label="Risk Score" sublabel="Higher = more risk" />
                            <ScoreGauge score={assessment.composite_score} label="Composite Score" sublabel="Higher = better profile" />
                        </div>
                        <InfoRow label="Risk Category" value={<StatusBadge status={assessment.risk_category} size="sm" />} />
                        <InfoRow label="Income Bracket" value={assessment.income_bracket.replace('_', ' ')} />
                        <InfoRow label="Segment" value={assessment.segment.replace(/_/g, ' ')} />
                        {assessment.probability_of_default !== null && (
                            <InfoRow label="Prob. of Default" value={`${(assessment.probability_of_default * 100).toFixed(1)}%`} />
                        )}
                        <InfoRow label="Thin-file" value={assessment.is_thin_file ? 'Yes — first-time borrower' : 'No'} />
                        <InfoRow label="Method" value={assessment.explanation_method} />
                        <div className="mt-3 p-3 bg-[#0d1117] rounded-lg border border-[#30363d]">
                            <p className="text-xs text-slate-500 font-medium mb-2">AI Explanations ({assessment.explanation_method})</p>
                            <ul className="space-y-1">
                                {assessment.explanations.map((e, i) => (
                                    <li key={i} className="text-xs text-slate-400 flex items-start gap-1.5">
                                        <span className="text-blue-400 mt-0.5 flex-shrink-0">•</span>{e}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </Card>
                )}
            </div>

            {/* Lender Decisions */}
            <Card>
                <h2 className="text-base font-bold text-white mb-4">Lender Decisions</h2>
                <div className="space-y-3">
                    {app.lenderDecisions.length === 0 ? (
                        <p className="text-slate-500 text-sm">No lender decisions yet.</p>
                    ) : app.lenderDecisions.map(d => (
                        <div key={d.lenderId} className="flex items-center justify-between p-3 bg-[#0d1117] rounded-lg border border-[#30363d]">
                            <div>
                                <p className="text-sm font-medium text-white">{d.lenderName}</p>
                                {d.note && <p className="text-xs text-slate-500 mt-0.5">{d.note}</p>}
                            </div>
                            <div className="text-right flex-shrink-0 ml-4">
                                <StatusBadge status={d.status} size="sm" />
                                <p className="text-xs text-slate-600 mt-1">{formatDate(d.lastUpdated)}</p>
                            </div>
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
