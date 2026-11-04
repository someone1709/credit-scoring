import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Check, TrendingUp } from 'lucide-react';
import { useAuth } from '@/context/useAuth';
import { ActionError, Card, ConfirmButton, EmptyState, InfoRow } from '@/components/shared/UI';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { decideLender, listLendersAsAdmin, type AdminLender } from '@/services/admin';
import { ApiError } from '@/services/http';

function explain(error: unknown): string {
    if (error instanceof ApiError && error.status === 404) {
        return 'Lender approval is turned off on this server. Set APP_ADMIN_KEY in its settings to turn it on.';
    }
    return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

function LenderCard({ lender, busy, onDecide }: { lender: AdminLender; busy: boolean; onDecide: (decision: 'approve' | 'reject') => Promise<void> }) {
    return (
        <Card>
            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                    <h2 className="text-base font-bold text-white break-words">{lender.institutionName}</h2>
                    <p className="text-xs text-slate-500">Registered {new Date(lender.registeredAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                </div>
                <StatusBadge status={lender.approvalStatus} size="sm" />
            </div>
            <InfoRow label="License number" value={lender.licenseNumber} mono />
            <InfoRow label="Contact person" value={lender.contactPerson} />
            <InfoRow label="Email" value={<span className="break-all">{lender.email}</span>} />
            <InfoRow label="Email confirmed" value={lender.emailVerified ? 'Yes' : 'Not yet'} />
            <InfoRow label="Phone" value={lender.phone} />
            <div className="flex flex-wrap items-center gap-3 mt-4">
                {lender.approvalStatus !== 'APPROVED' && (
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => void onDecide('approve')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors"
                    >
                        <Check size={14} /> Approve
                    </button>
                )}
                {lender.approvalStatus !== 'REJECTED' && (
                    <ConfirmButton
                        label="Reject"
                        question="Reject this institution? It loses access to every application that isn't already its accepted loan."
                        confirmLabel="Yes, reject"
                        disabled={busy}
                        onConfirm={() => onDecide('reject')}
                    />
                )}
            </div>
        </Card>
    );
}

export default function LenderApprovals() {
    const { isMockMode } = useAuth();
    // Held only while this page is open, so it never reaches browser storage or a URL.
    const [key, setKey] = useState('');
    const [lenders, setLenders] = useState<AdminLender[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const unlock = async (event: FormEvent) => {
        event.preventDefault();
        setError(null);
        setBusy(true);
        try {
            setLenders(await listLendersAsAdmin(key));
        } catch (e) {
            setError(explain(e));
        } finally {
            setBusy(false);
        }
    };

    const decide = async (lenderId: string, decision: 'approve' | 'reject') => {
        setError(null);
        setBusy(true);
        try {
            const updated = await decideLender(key, lenderId, decision);
            setLenders(current => current?.map(lender => (lender.id === updated.id ? updated : lender)) ?? null);
        } catch (e) {
            setError(explain(e));
        } finally {
            setBusy(false);
        }
    };

    const waiting = lenders?.filter(lender => lender.approvalStatus === 'PENDING').length ?? 0;

    return (
        <div className="min-h-screen bg-[#0d1117] text-white px-4 py-8 sm:px-8">
            <div className="max-w-3xl mx-auto space-y-6">
                <Link to="/" className="flex items-center gap-3 w-fit">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center">
                        <TrendingUp size={18} className="text-white" />
                    </div>
                    <p className="text-white font-bold text-lg">BeneScore</p>
                </Link>

                <div>
                    <h1 className="text-2xl font-bold text-white">Lender Approvals</h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Applicants can only choose institutions approved here.
                        {lenders && ` ${waiting} waiting for a decision.`}
                    </p>
                </div>

                <ActionError message={error} />

                {isMockMode ? (
                    <Card>
                        <p className="text-sm text-slate-400">Lender approval needs the backend. In demo mode every institution counts as approved.</p>
                    </Card>
                ) : lenders === null ? (
                    <Card>
                        <form onSubmit={unlock} className="space-y-4">
                            <div>
                                <label htmlFor="admin-key" className="block text-sm font-medium text-slate-400 mb-1.5">Admin key</label>
                                <input
                                    id="admin-key"
                                    type="password"
                                    autoComplete="off"
                                    value={key}
                                    onChange={e => setKey(e.target.value)}
                                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                                />
                                <p className="text-xs text-slate-600 mt-1.5">The APP_ADMIN_KEY value from the server's settings.</p>
                            </div>
                            <button
                                type="submit"
                                disabled={busy || key === ''}
                                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors"
                            >
                                {busy ? 'Checking...' : 'Unlock'}
                            </button>
                        </form>
                    </Card>
                ) : lenders.length === 0 ? (
                    <EmptyState icon={<Building2 size={40} />} title="No institutions yet" description="They'll appear here when they register." />
                ) : (
                    lenders.map(lender => (
                        <LenderCard key={lender.id} lender={lender} busy={busy} onDecide={decision => decide(lender.id, decision)} />
                    ))
                )}
            </div>
        </div>
    );
}
