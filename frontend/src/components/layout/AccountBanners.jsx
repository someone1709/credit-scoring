import { useState } from 'react';
import { useAuth } from '@/context/useAuth';
import { authService } from '@/services/auth';
import { toApiError } from '@/services/http';

const BANNER = 'flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 mb-4 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm text-amber-400';

function ConfirmEmailBanner({ email, reason }) {
    const [message, setMessage] = useState(null);
    const [sending, setSending] = useState(false);

    const resend = async () => {
        setSending(true);
        try {
            await authService.resendVerification();
            setMessage('Sent. Check your inbox.');
        } catch (e) {
            setMessage(toApiError(e).message);
        } finally {
            setSending(false);
        }
    };

    return (
        <div role="status" className={BANNER}>
            <span className="min-w-0 break-words"><strong>Confirm your email.</strong> We sent a link to {email}. {reason}</span>
            {message
                ? <span className="text-amber-300">{message}</span>
                : <button type="button" disabled={sending} onClick={() => void resend()} className="font-semibold underline hover:text-amber-300 disabled:opacity-50">Send it again</button>}
        </div>
    );
}

/** Things this account has to wait for or act on, shown on every page until they're settled. */
export function AccountBanners() {
    const { user } = useAuth();
    if (!user) return null;
    const approval = user.role === 'lender' ? user.profile.approvalStatus : undefined;

    return (
        <>
            {user.profile.emailVerified === false && (
                <ConfirmEmailBanner
                    email={user.profile.email}
                    reason={user.role === 'lender' ? 'This shows the platform the address is really yours.' : "You can apply for a loan once it's confirmed."}
                />
            )}
            {approval === 'PENDING' && (
                <div role="status" className={BANNER}>
                    <span><strong>Waiting for approval.</strong> Applicants can't choose your institution until the platform approves it.</span>
                </div>
            )}
            {approval === 'REJECTED' && (
                <div role="alert" className="px-3 py-2 mb-4 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
                    <strong>Not approved.</strong> Your institution can't receive applications. Contact the platform for details.
                </div>
            )}
        </>
    );
}
