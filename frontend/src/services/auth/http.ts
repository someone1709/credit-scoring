// The real authentication client. Screens never import this directly, so connecting the
// backend only means setting VITE_API_MODE=live. This file is the one place that knows the
// wire format: snake_case JSON, mapped to the app's types below. See README for the contract.

import type { BeneficiaryProfile, LenderProfile } from '@/types';
import type { AuthService, AuthUser, BeneficiaryProfileUpdate, RegisterInput } from '@/types/auth';
import { http, refreshSession, setAccessToken, toApiError } from '@/services/http';

interface BeneficiaryDto {
    id: string;
    role: 'beneficiary';
    name: string;
    email: string;
    phone: string;
    age: number | null;
    occupation: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
}

interface LenderDto {
    id: string;
    role: 'lender';
    institution_name: string;
    contact_person: string;
    email: string;
    phone: string;
    license_number: string;
}

type UserDto = BeneficiaryDto | LenderDto;

interface AuthResponseDto {
    access_token: string;
    user: UserDto;
}

const LOGO_COLORS = ['#2563eb', '#059669', '#dc2626', '#7c3aed', '#d97706'];

function initialsOf(name: string): string {
    return name.split(/\s+/).filter(Boolean).map(word => word[0]).join('').slice(0, 2).toUpperCase();
}

function logoColorFor(id: string): string {
    const hash = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return LOGO_COLORS[hash % LOGO_COLORS.length];
}

function toAuthUser(dto: UserDto): AuthUser {
    if (dto.role === 'lender') {
        const profile: LenderProfile = {
            id: dto.id,
            name: dto.institution_name,
            contactPerson: dto.contact_person,
            email: dto.email,
            phone: dto.phone,
            licenseNumber: dto.license_number,
            logoInitials: initialsOf(dto.institution_name),
            logoColor: logoColorFor(dto.id),
        };
        return { role: 'lender', profile, isDemo: false };
    }
    const profile: BeneficiaryProfile = {
        id: dto.id,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        age: dto.age,
        occupation: dto.occupation ?? '',
        address: dto.address ?? '',
        city: dto.city ?? '',
        state: dto.state ?? '',
        pincode: dto.pincode ?? '',
    };
    return { role: 'beneficiary', profile, isDemo: false };
}

function toRegisterBody(input: RegisterInput) {
    const account = { role: input.role, email: input.email, phone: input.phone, password: input.password };
    return input.role === 'lender'
        ? { ...account, institution_name: input.institutionName, contact_person: input.contactPerson, license_number: input.licenseNumber }
        : { ...account, name: input.name };
}

async function call<T>(request: () => Promise<{ data: T }>): Promise<T> {
    try {
        return (await request()).data;
    } catch (error) {
        throw toApiError(error);
    }
}

function startSession(response: AuthResponseDto): AuthUser {
    setAccessToken(response.access_token);
    return toAuthUser(response.user);
}

export const httpAuthService: AuthService = {
    mode: 'live',

    async login({ email, password, remember }) {
        return startSession(await call(() => http.post<AuthResponseDto>('/auth/login', { email, password, remember_me: remember })));
    },

    async register(input) {
        return startSession(await call(() => http.post<AuthResponseDto>('/auth/register', toRegisterBody(input))));
    },

    async logout() {
        try {
            await http.post('/auth/logout');
        } finally {
            // Sign out locally even if the server can't be reached.
            setAccessToken(null);
        }
    },

    async restoreSession() {
        try {
            return toAuthUser((await refreshSession<AuthResponseDto>()).user);
        } catch {
            // No valid refresh cookie just means nobody is signed in.
            return null;
        }
    },

    async requestPasswordReset(email) {
        await call(() => http.post('/auth/forgot-password', { email }));
        return { simulatedResetToken: null };
    },

    async resetPassword(token, password) {
        await call(() => http.post('/auth/reset-password', { token, password }));
    },

    async changePassword(currentPassword, newPassword) {
        await call(() => http.post('/auth/change-password', { current_password: currentPassword, new_password: newPassword }));
    },

    async updateBeneficiaryProfile(update: BeneficiaryProfileUpdate) {
        return toAuthUser(await call(() => http.patch<UserDto>('/auth/me', update)));
    },

    listDemoAccounts: () => [],

    async demoLogin() {
        throw new Error('Demo accounts are not available when connected to the backend.');
    },
};
