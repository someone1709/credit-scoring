// Simulated authentication that keeps accounts in this browser, so the screens can be used
// before the backend exists. It is NOT secure and must not be used with real passwords.
// Demo accounts have no password at all, which keeps credentials out of the source code.

import type { BeneficiaryProfile, LenderProfile, UserRole } from '@/types';
import type { AuthService, AuthUser, BeneficiaryProfileUpdate, RegisterInput } from '@/types/auth';
import { MOCK_BENEFICIARIES, MOCK_LENDERS } from '@/data/mockData';
import { ApiError } from '@/services/http';
import { readJson, removeKey, writeJson } from '@/lib/storage';

const USERS_KEY = 'benescore.users.v1';
const RESETS_KEY = 'benescore.password-resets.v1';
export const SESSION_KEY = 'benescore.session.v1';

const RESET_LIFETIME_MS = 30 * 60 * 1000;
const SIMULATED_DELAY_MS = 450;
const LOGO_COLORS = ['#2563eb', '#059669', '#dc2626', '#7c3aed', '#d97706'];

interface StoredUserBase {
    createdAt: string;
    isDemo: boolean;
    // Null for demo accounts, which can't sign in with a password.
    passwordHash: string | null;
    salt: string | null;
}

type StoredUser = StoredUserBase & (
    | { role: 'beneficiary'; profile: BeneficiaryProfile }
    | { role: 'lender'; profile: LenderProfile }
);

interface StoredReset {
    token: string;
    userId: string;
    expiresAt: number;
}

function wait(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY_MS));
}

function seedUsers(): StoredUser[] {
    const shared = { createdAt: '2026-01-01T00:00:00Z', isDemo: true, passwordHash: null, salt: null };
    return [
        ...MOCK_BENEFICIARIES.map((profile): StoredUser => ({ ...shared, role: 'beneficiary', profile })),
        ...MOCK_LENDERS.map((profile): StoredUser => ({ ...shared, role: 'lender', profile })),
    ];
}

function readUsers(): StoredUser[] {
    const stored = readJson<StoredUser[]>(USERS_KEY, []);
    const storedIds = new Set(stored.map(user => user.profile.id));
    return [...seedUsers().filter(user => !storedIds.has(user.profile.id)), ...stored];
}

function writeUsers(users: StoredUser[]): void {
    writeJson(USERS_KEY, users);
}

function toAuthUser(user: StoredUser): AuthUser {
    return user.role === 'lender'
        ? { role: 'lender', profile: user.profile, isDemo: user.isDemo }
        : { role: 'beneficiary', profile: user.profile, isDemo: user.isDemo };
}

function normaliseEmail(email: string): string {
    return email.trim().toLowerCase();
}

function randomToken(): string {
    return crypto.randomUUID().replace(/-/g, '');
}

async function hashPassword(password: string, salt: string): Promise<string> {
    if (!crypto.subtle) {
        throw new ApiError(0, 'INSECURE_CONTEXT', 'Sign-in needs a secure page. Open the app on localhost or over HTTPS.');
    }
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${password}`));
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function saveSession(userId: string, remember: boolean): void {
    clearSession();
    const value = JSON.stringify({ userId });
    (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, value);
}

function clearSession(): void {
    removeKey(SESSION_KEY);
    try {
        sessionStorage.removeItem(SESSION_KEY);
    } catch {
        // Storage can be blocked; there is nothing to clear in that case.
    }
}

function currentUserId(): string | null {
    try {
        const raw = sessionStorage.getItem(SESSION_KEY) ?? localStorage.getItem(SESSION_KEY);
        return raw ? (JSON.parse(raw) as { userId: string }).userId : null;
    } catch {
        return null;
    }
}

function requireCurrentUser(users: StoredUser[]): StoredUser {
    const id = currentUserId();
    const user = users.find(candidate => candidate.profile.id === id);
    if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Your session has ended. Please sign in again.');
    return user;
}

function assertEmailFree(users: StoredUser[], email: string, ownId?: string): void {
    if (users.some(user => user.profile.email.toLowerCase() === email && user.profile.id !== ownId)) {
        throw new ApiError(409, 'EMAIL_TAKEN', 'This email is already registered.', [{ field: 'email', issue: 'This email is already registered. Try signing in instead.' }]);
    }
}

function newUserId(users: StoredUser[], prefix: string): string {
    const ids = new Set(users.map(user => user.profile.id));
    let id: string;
    do {
        id = `${prefix}${randomToken().slice(0, 6).toUpperCase()}`;
    } while (ids.has(id));
    return id;
}

function initialsOf(name: string): string {
    return name.split(/\s+/).filter(Boolean).map(word => word[0]).join('').slice(0, 2).toUpperCase();
}

/** Every lender a beneficiary can share an application with. Live mode will fetch this from the backend. */
export function listLenders(): LenderProfile[] {
    return readUsers().flatMap(user => (user.role === 'lender' ? [user.profile] : []));
}

export const mockAuthService: AuthService = {
    mode: 'mock',

    async login({ email, password, remember }) {
        await wait();
        const users = readUsers();
        const user = users.find(candidate => candidate.profile.email.toLowerCase() === normaliseEmail(email));

        if (user?.isDemo) {
            throw new ApiError(401, 'DEMO_ACCOUNT', 'This is a demo account with no password. Use the demo access buttons below.');
        }
        // The same message for an unknown email and a wrong password, so accounts can't be discovered.
        const invalid = new ApiError(401, 'INVALID_CREDENTIALS', 'The email or password is incorrect.');
        if (!user?.passwordHash || !user.salt) throw invalid;
        if ((await hashPassword(password, user.salt)) !== user.passwordHash) throw invalid;

        saveSession(user.profile.id, remember);
        return toAuthUser(user);
    },

    async register(input: RegisterInput) {
        await wait();
        const users = readUsers();
        const email = normaliseEmail(input.email);
        assertEmailFree(users, email);

        const salt = randomToken();
        const shared = {
            createdAt: new Date().toISOString(),
            isDemo: false,
            passwordHash: await hashPassword(input.password, salt),
            salt,
        };
        const user: StoredUser = input.role === 'lender'
            ? {
                ...shared,
                role: 'lender',
                profile: {
                    id: newUserId(users, 'LENDER'),
                    name: input.institutionName.trim(),
                    contactPerson: input.contactPerson.trim(),
                    email,
                    phone: input.phone.trim(),
                    licenseNumber: input.licenseNumber.trim(),
                    logoInitials: initialsOf(input.institutionName),
                    logoColor: LOGO_COLORS[users.length % LOGO_COLORS.length],
                },
            }
            : {
                ...shared,
                role: 'beneficiary',
                profile: {
                    id: newUserId(users, 'BEN'),
                    name: input.name.trim(),
                    email,
                    phone: input.phone.trim(),
                    age: null,
                    occupation: '',
                    address: '',
                    city: '',
                    state: '',
                    pincode: '',
                },
            };

        writeUsers([...users, user]);
        saveSession(user.profile.id, false);
        return toAuthUser(user);
    },

    async logout() {
        clearSession();
    },

    async restoreSession() {
        const id = currentUserId();
        const user = readUsers().find(candidate => candidate.profile.id === id);
        return user ? toAuthUser(user) : null;
    },

    async currentUser() {
        return this.restoreSession();
    },

    async requestPasswordReset(email) {
        await wait();
        const user = readUsers().find(candidate => candidate.profile.email.toLowerCase() === normaliseEmail(email));
        if (!user || user.isDemo) return { simulatedResetToken: null };

        const token = randomToken();
        const resets = readJson<StoredReset[]>(RESETS_KEY, []).filter(reset => reset.userId !== user.profile.id);
        writeJson(RESETS_KEY, [...resets, { token, userId: user.profile.id, expiresAt: Date.now() + RESET_LIFETIME_MS }]);
        return { simulatedResetToken: token };
    },

    async resetPassword(token, password) {
        await wait();
        const resets = readJson<StoredReset[]>(RESETS_KEY, []);
        const reset = resets.find(candidate => candidate.token === token);
        if (!reset || reset.expiresAt < Date.now()) {
            throw new ApiError(400, 'INVALID_RESET_TOKEN', 'This reset link is invalid or has expired. Please request a new one.');
        }

        const salt = randomToken();
        const passwordHash = await hashPassword(password, salt);
        writeUsers(readUsers().map(user => (user.profile.id === reset.userId ? { ...user, salt, passwordHash } : user)));
        // Each link works once.
        writeJson(RESETS_KEY, resets.filter(candidate => candidate.token !== token));
    },

    async changePassword(currentPassword, newPassword) {
        await wait();
        const users = readUsers();
        const user = requireCurrentUser(users);
        if (user.isDemo || !user.passwordHash || !user.salt) {
            throw new ApiError(403, 'DEMO_ACCOUNT', 'Demo accounts have no password to change.');
        }
        if ((await hashPassword(currentPassword, user.salt)) !== user.passwordHash) {
            throw new ApiError(422, 'VALIDATION_ERROR', 'Invalid input', [{ field: 'currentPassword', issue: 'Your current password is incorrect.' }]);
        }
        const salt = randomToken();
        const passwordHash = await hashPassword(newPassword, salt);
        writeUsers(users.map(candidate => (candidate.profile.id === user.profile.id ? { ...candidate, salt, passwordHash } : candidate)));
    },

    // This mode can't send email, so accounts never have an address to confirm.
    async verifyEmail() {
        throw new ApiError(400, 'INVALID_VERIFICATION_TOKEN', "Email confirmation isn't used in demo mode.");
    },

    async resendVerification() {},

    async updateBeneficiaryProfile(update: BeneficiaryProfileUpdate) {
        await wait();
        const users = readUsers();
        const user = requireCurrentUser(users);
        if (user.role !== 'beneficiary') {
            throw new ApiError(403, 'FORBIDDEN', 'Only beneficiaries have this profile.');
        }
        const email = normaliseEmail(update.email);
        assertEmailFree(users, email, user.profile.id);

        const updated: StoredUser = { ...user, profile: { ...update, id: user.profile.id, email } };
        writeUsers(users.map(candidate => (candidate.profile.id === user.profile.id ? updated : candidate)));
        return toAuthUser(updated);
    },

    listDemoAccounts() {
        const accounts = (role: UserRole, list: { id: string; name: string; detail: string }[]) =>
            list.map(account => ({ ...account, role }));
        return [
            ...accounts('beneficiary', MOCK_BENEFICIARIES.map(b => ({ id: b.id, name: b.name, detail: b.occupation }))),
            ...accounts('lender', MOCK_LENDERS.map(l => ({ id: l.id, name: l.name, detail: l.contactPerson }))),
        ];
    },

    async demoLogin(accountId) {
        const user = readUsers().find(candidate => candidate.profile.id === accountId && candidate.isDemo);
        if (!user) throw new ApiError(404, 'NOT_FOUND', 'That demo account no longer exists.');
        // Demo sign-in stays in this tab, so two tabs can show the two sides of the marketplace.
        saveDemoSession(user.profile.id);
        return toAuthUser(user);
    },
};

function saveDemoSession(userId: string): void {
    try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ userId }));
    } catch {
        // Without storage the demo still works until the page reloads.
    }
}
