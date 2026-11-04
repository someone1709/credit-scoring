import { createContext, useContext } from 'react';
import type { BeneficiaryProfile, LenderProfile, UserRole } from '@/types';
import type { AuthUser, BeneficiaryProfileUpdate, DemoAccount, LoginInput, RegisterInput } from '@/types/auth';

export interface AuthContextValue {
    user: AuthUser | null;
    /** True until the saved session has been checked, so pages don't flash the sign-in screen. */
    loading: boolean;
    isMockMode: boolean;
    /** True right after signing out or an expired session, so the redirect to sign-in forgets the old page. */
    sessionEnded: boolean;
    /** The sign-in page has been reached, so later links can be remembered again. */
    clearSessionEnded: () => void;
    demoAccounts: DemoAccount[];
    login: (input: LoginInput) => Promise<AuthUser>;
    register: (input: RegisterInput) => Promise<AuthUser>;
    logout: () => Promise<void>;
    demoLogin: (accountId: string) => Promise<AuthUser>;
    updateBeneficiaryProfile: (update: BeneficiaryProfileUpdate) => Promise<AuthUser>;
    /** Picks up changes made elsewhere, such as confirming an email in another tab. */
    refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}

/** The signed-in beneficiary. Only for pages behind the beneficiary route guard. */
export function useBeneficiary(): BeneficiaryProfile {
    const { user } = useAuth();
    if (user?.role !== 'beneficiary') throw new Error('useBeneficiary needs a signed-in beneficiary');
    return user.profile;
}

/** The signed-in lender. Only for pages behind the lender route guard. */
export function useLender(): LenderProfile {
    const { user } = useAuth();
    if (user?.role !== 'lender') throw new Error('useLender needs a signed-in lender');
    return user.profile;
}

export function homeForRole(role: UserRole): string {
    return role === 'lender' ? '/lender/dashboard' : '/beneficiary/dashboard';
}

/** True while this account is waiting on something that happens outside this page. */
export function isAwaitingAccountChange(user: AuthUser | null): boolean {
    if (!user) return false;
    if (user.profile.emailVerified === false) return true;
    return user.role === 'lender' && (user.profile.approvalStatus ?? 'APPROVED') !== 'APPROVED';
}

/** Workflow step 2 (Master Brief §4): the profile comes before the first application. */
export function isProfileComplete(profile: BeneficiaryProfile): boolean {
    return [profile.phone, profile.occupation, profile.address, profile.city, profile.state, profile.pincode]
        .every(value => value.trim() !== '');
}
