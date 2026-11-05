import { useLender } from '@/context/useAuth';
import { ChangePasswordCard } from '@/components/auth/ChangePasswordCard';
import { Card } from '@/components/shared/UI';
import { CheckCircle } from 'lucide-react';

export default function LenderSettings() {
    const lender = useLender();
    return (
        <div className="max-w-2xl space-y-6">
            <h1 className="text-2xl font-bold text-white">Settings</h1>

            <Card>
                <h2 className="text-base font-bold text-white mb-4">Institution Profile</h2>
                <div className="space-y-3">
                    {[
                        ['Institution Name', lender.name],
                        ['Contact Person', lender.contactPerson],
                        ['Email', lender.email],
                        ['Phone', lender.phone],
                        ['NBFC / License Number', lender.licenseNumber],
                        ['Lender ID', lender.id],
                        ...(lender.approvalStatus ? [['Platform Approval', lender.approvalStatus]] : []),
                    ].map(([label, value]) => (
                        <div key={label} className="flex justify-between items-center gap-3 py-2 border-b border-[#30363d] last:border-0">
                            <span className="text-slate-500 text-sm">{label}</span>
                            <span className="text-slate-200 text-sm font-medium font-mono text-right break-all">{value}</span>
                        </div>
                    ))}
                </div>
            </Card>

            <ChangePasswordCard />

            <Card>
                <h2 className="text-base font-bold text-white mb-4">Platform Information</h2>
                <div className="space-y-2 text-sm text-slate-400">
                    <p className="flex items-start gap-2"><CheckCircle size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" /> You only access applications beneficiaries chose to share with your institution.</p>
                    <p className="flex items-start gap-2"><CheckCircle size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" /> Your decisions are independent and do not affect other lenders.</p>
                    <p className="flex items-start gap-2"><CheckCircle size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" /> The credit assessment is a decision-support tool only. You retain full authority over lending decisions.</p>
                    <p className="flex items-start gap-2"><CheckCircle size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" /> This is an academic prototype. All data is synthetic and no real transactions occur.</p>
                </div>
            </Card>

            <div className="text-xs text-slate-600 text-center">BeneScore Academic Prototype · CSE Minor Project</div>
        </div>
    );
}
