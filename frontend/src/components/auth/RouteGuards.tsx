import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { UserRole } from '@/types';
import { Spinner } from '@/components/shared/UI';
import { homeForRole, isProfileComplete, useAuth } from '@/context/useAuth';

function FullPageSpinner() {
    return (
        <div role="status" aria-label="Loading" className="min-h-screen bg-[#0d1117] flex items-center justify-center">
            <Spinner size="lg" />
        </div>
    );
}

/** Only the given role gets through. Anyone else is signed in first or sent to their own dashboard. */
export function RequireRole({ role }: { role: UserRole }) {
    const { user, loading, sessionEnded } = useAuth();
    const location = useLocation();

    if (loading) return <FullPageSpinner />;
    if (!user) {
        return <Navigate to="/login" replace state={sessionEnded ? undefined : { from: location.pathname + location.search }} />;
    }
    if (user.role !== role) return <Navigate to={homeForRole(user.role)} replace />;
    return <Outlet />;
}

/**
 * The sign-in pages, which signed-in users don't need. This is also the one place that decides
 * where people go after signing in, so the forms don't race this redirect with their own.
 */
export function GuestOnly() {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) return <FullPageSpinner />;
    if (!user) return <Outlet />;

    // Return to the page that asked for sign-in, but only if this account may see it.
    const from = (location.state as { from?: string } | null)?.from;
    if (from?.startsWith(`/${user.role}/`)) return <Navigate to={from} replace />;

    // The next workflow step for a new beneficiary is completing the profile (Master Brief §4).
    if (user.role === 'beneficiary' && !isProfileComplete(user.profile)) {
        return <Navigate to="/beneficiary/profile" replace state={{ welcome: true }} />;
    }
    return <Navigate to={homeForRole(user.role)} replace />;
}
