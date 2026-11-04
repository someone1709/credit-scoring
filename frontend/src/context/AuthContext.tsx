import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { AuthUser, BeneficiaryProfileUpdate, LoginInput, RegisterInput } from '@/types/auth';
import { authService } from '@/services/auth';
import { SESSION_KEY } from '@/services/auth/mock';
import { setSessionExpiredHandler } from '@/services/http';
import { AuthContext, isAwaitingAccountChange, type AuthContextValue } from './useAuth';

const ACCOUNT_CHECK_EVERY_MS = 30000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [sessionEnded, setSessionEnded] = useState(false);

    useEffect(() => {
        let cancelled = false;
        authService.restoreSession()
            .then(restored => { if (!cancelled) setUser(restored); })
            .catch(() => { if (!cancelled) setUser(null); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    // When the backend refuses a token and it can't be refreshed, the session is over.
    useEffect(() => {
        setSessionExpiredHandler(() => {
            setSessionEnded(true);
            setUser(null);
        });
        return () => setSessionExpiredHandler(null);
    }, []);

    // Signing out of a remembered session in one tab signs out the others too.
    useEffect(() => {
        const onStorage = (event: StorageEvent) => {
            if (event.key === SESSION_KEY) {
                authService.restoreSession().then(setUser).catch(() => setUser(null));
            }
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    const refreshUser = useCallback(async () => {
        try {
            const latest = await authService.currentUser();
            if (latest) setUser(latest);
        } catch {
            // Keeps what's on screen. The next check can succeed.
        }
    }, []);

    // Someone waiting for approval or a confirmed email shouldn't have to reload to see it.
    const awaiting = isAwaitingAccountChange(user);
    useEffect(() => {
        if (!awaiting) return;
        const check = () => void refreshUser();
        const timer = window.setInterval(check, ACCOUNT_CHECK_EVERY_MS);
        window.addEventListener('focus', check);
        return () => {
            window.clearInterval(timer);
            window.removeEventListener('focus', check);
        };
    }, [awaiting, refreshUser]);

    const login = useCallback(async (input: LoginInput) => {
        const signedIn = await authService.login(input);
        setSessionEnded(false);
        setUser(signedIn);
        return signedIn;
    }, []);

    const register = useCallback(async (input: RegisterInput) => {
        const created = await authService.register(input);
        setSessionEnded(false);
        setUser(created);
        return created;
    }, []);

    const logout = useCallback(async () => {
        try {
            await authService.logout();
        } finally {
            setSessionEnded(true);
            setUser(null);
        }
    }, []);

    const demoLogin = useCallback(async (accountId: string) => {
        const signedIn = await authService.demoLogin(accountId);
        setSessionEnded(false);
        setUser(signedIn);
        return signedIn;
    }, []);

    const updateBeneficiaryProfile = useCallback(async (update: BeneficiaryProfileUpdate) => {
        const updated = await authService.updateBeneficiaryProfile(update);
        setUser(updated);
        return updated;
    }, []);

    const clearSessionEnded = useCallback(() => setSessionEnded(false), []);

    const value = useMemo<AuthContextValue>(() => ({
        user,
        loading,
        isMockMode: authService.mode === 'mock',
        sessionEnded,
        clearSessionEnded,
        demoAccounts: authService.listDemoAccounts(),
        login,
        register,
        logout,
        demoLogin,
        updateBeneficiaryProfile,
        refreshUser,
    }), [user, loading, sessionEnded, clearSessionEnded, login, register, logout, demoLogin, updateBeneficiaryProfile, refreshUser]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
