import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { FormAlert } from '@/components/auth/AuthFields';
import { Spinner } from '@/components/shared/UI';
import { homeForRole, useAuth } from '@/context/useAuth';
import { authService } from '@/services/auth';
import { toApiError } from '@/services/http';

/** Works signed in or not, because the link can be opened on any device. */
export default function VerifyEmail() {
    const [params] = useSearchParams();
    const token = params.get('token');
    const { user, loading, refreshUser } = useAuth();
    const [confirmed, setConfirmed] = useState(false);
    const [error, setError] = useState(token ? null : 'This link is incomplete. Sign in to request a new one.');

    // Each link works once, so React's development double-run mustn't send it twice.
    const sent = useRef(false);
    useEffect(() => {
        if (!token || sent.current) return;
        sent.current = true;
        authService.verifyEmail(token)
            .then(() => setConfirmed(true))
            .catch(e => setError(toApiError(e).message));
    }, [token]);

    const staleInThisTab = user?.profile.emailVerified === false;
    useEffect(() => {
        if (confirmed && !loading && staleInThisTab) void refreshUser();
    }, [confirmed, loading, staleInThisTab, refreshUser]);

    const onward = user
        ? <Link to={homeForRole(user.role)} className="text-emerald-400 hover:text-emerald-300 font-medium">Go to your dashboard</Link>
        : <Link to="/login" className="text-emerald-400 hover:text-emerald-300 font-medium">Sign in</Link>;

    if (error) {
        return (
            <AuthLayout title="This link isn't valid" footer={onward}>
                <FormAlert>{error}</FormAlert>
            </AuthLayout>
        );
    }
    if (!confirmed) {
        return (
            <AuthLayout title="Confirming your email">
                <div role="status" aria-label="Confirming" className="flex justify-center py-8"><Spinner size="lg" /></div>
            </AuthLayout>
        );
    }
    return (
        <AuthLayout title="Your email is confirmed" footer={onward}>
            <p className="text-sm text-slate-400">Thanks. You can carry on where you left off.</p>
        </AuthLayout>
    );
}
