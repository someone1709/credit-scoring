import { Link } from 'react-router-dom';
import { useRole } from '@/context/RoleContext';
import { useApp } from '@/context/AppContext';
import { Card, EmptyState, DemoDisclaimer } from '@/components/shared/UI';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Upload, FileText, ExternalLink } from 'lucide-react';

export default function Documents() {
    const { beneficiary } = useRole();
    const { getApplicationsByBeneficiary, uploadDocument } = useApp();
    const apps = getApplicationsByBeneficiary(beneficiary.id);

    const allDocs = apps.flatMap(app =>
        app.documents.map(doc => ({ ...doc, appId: app.id, appStatus: app.status }))
    );

    const handleUpload = (docId: string, appId: string, file: File) => {
        uploadDocument(appId, docId, file.name);
    };

    if (allDocs.length === 0) {
        return (
            <div className="space-y-6">
                <h1 className="text-2xl font-bold text-white">Documents</h1>
                <EmptyState
                    icon={<FileText size={40} />}
                    title="No documents yet"
                    description="Submit a loan application to manage document uploads."
                    action={<Link to="/beneficiary/apply" className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-semibold">Apply for a Loan</Link>}
                />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">Documents & Verification</h1>
                <p className="text-slate-500 mt-1 text-sm">Upload supporting financial documents. Basic file checks are performed automatically.</p>
            </div>
            <DemoDisclaimer />

            {apps.map(app => {
                const docs = app.documents;
                return (
                    <Card key={app.id}>
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-base font-bold text-white">Application #{app.id}</h2>
                                <p className="text-xs text-slate-500">{app.loan_purpose} · ₹{app.loan_amount.toLocaleString('en-IN')}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <StatusBadge status={app.status} size="sm" />
                                <Link to={`/beneficiary/applications/${app.id}`} className="text-slate-400 hover:text-emerald-400 transition-colors">
                                    <ExternalLink size={14} />
                                </Link>
                            </div>
                        </div>
                        <div className="space-y-3">
                            {docs.map(doc => (
                                <div key={doc.id} className="flex items-center justify-between p-3 bg-[#0d1117] rounded-lg border border-[#30363d] gap-4">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-8 h-8 rounded-lg bg-[#1c2333] flex items-center justify-center flex-shrink-0">
                                            <FileText size={14} className="text-slate-400" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-white">{doc.label}</p>
                                            <p className="text-xs text-slate-500 truncate">
                                                {doc.filename ? doc.filename : 'Not uploaded'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 flex-shrink-0">
                                        <StatusBadge status={doc.verification_status} size="sm" />
                                        {doc.verification_status === 'NOT_PROVIDED' || doc.verification_status === 'CHECKS_FAILED' ? (
                                            <label className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-400 rounded-lg text-xs font-medium cursor-pointer transition-colors">
                                                <Upload size={12} /> Upload
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    accept=".pdf,.jpg,.jpeg,.png"
                                                    onChange={e => {
                                                        const file = e.target.files?.[0];
                                                        if (file) handleUpload(doc.id, app.id, file);
                                                    }}
                                                />
                                            </label>
                                        ) : null}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <p className="mt-3 text-xs text-slate-600">
                            Note: Uploading a document does not establish its authenticity. CHECKS_PASSED means only that basic file format checks passed — no government verification is integrated.
                        </p>
                    </Card>
                );
            })}
        </div>
    );
}
