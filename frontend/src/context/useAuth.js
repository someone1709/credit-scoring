import { createContext, useContext } from 'react';

export const AuthContext = createContext(null);

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}

/** The signed-in beneficiary. Only for pages behind the beneficiary route guard. */
export function useBeneficiary() {
    const { user } = useAuth();
    if (user?.role !== 'beneficiary') throw new Error('useBeneficiary needs a signed-in beneficiary');
    return user.profile;
}

/** The signed-in lender. Only for pages behind the lender route guard. */
export function useLender() {
    const { user } = useAuth();
    if (user?.role !== 'lender') throw new Error('useLender needs a signed-in lender');
    return user.profile;
}

export function homeForRole(role) {
    return role === 'lender' ? '/lender/dashboard' : '/beneficiary/dashboard';
}

/** True while this account is waiting on something that happens outside this page. */
export function isAwaitingAccountChange(user) {
    if (!user) return false;
    if (user.profile.emailVerified === false) return true;
    return user.role === 'lender' && (user.profile.approvalStatus ?? 'APPROVED') !== 'APPROVED';
}

/** Workflow step 2 (Master Brief §4): the profile comes before the first application. */
export function isProfileComplete(profile) {
    return [profile.phone, profile.occupation, profile.address, profile.city, profile.state, profile.pincode]
        .every(value => value.trim() !== '');
}
