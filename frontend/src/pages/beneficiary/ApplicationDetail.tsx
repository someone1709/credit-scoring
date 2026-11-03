import { useParams, Link } from 'react-router-dom';
import { useApp } from '@/context/useApp';
import { useBeneficiary } from '@/context/useAuth';
import { Card, InfoRow, DemoDisclaimer } from '@/components/shared/UI';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ScoreGauge } from '@/components/shared/ScoreGauge';
import { ApplicationWorkflowStepper, DisbursementStepper } from '@/components/shared/Stepper';
import { canUploadDocuments, workflowStep } from '@/lib/workflow';
import { ArrowLeft, Info } from 'lucide-react';

function formatCurrency(n: number) { return '₹' + n.toLocaleString('en-IN'); }
function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ApplicationDetail() {
    const { id } = useParams<{ id: string }>();
    const beneficiary = useBeneficiary();
    const { getBeneficiaryApplication } = useApp();
    const app = id ? getBeneficiaryApplication(id, beneficiary.id) : undefined;

    if (!app) return (
        <div className="text-center py-16">
            <p className="text-slate-500">Application not found.</p>
            <Link to="/beneficiary/applications" className="text-emerald-400 hover:underline mt-2 inline-block">← Back</Link>
        </div>
    );

    const assessment = app.assessment;
    const infoRequests = app.lenderDecisions.filter(d => d.status === 'INFO_REQUESTED');

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
                    <ul className="space-y-2">
                        {infoRequests.map(d => (
                            <li key={d.lenderId} className="text-sm text-slate-300"><strong className="text-white">{d.lenderName}:</strong> {d.note}</li>
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
                        <p className="text-xs text-slate-600 mt-3">Illustrative rule-based result, not a trained model and not a lending decision. Lenders make their own decisions.</p>
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
