import type { BeneficiaryProfile, LenderProfile, UserRole } from './index';

export type AuthUser =
    | { role: 'beneficiary'; profile: BeneficiaryProfile; isDemo: boolean }
    | { role: 'lender'; profile: LenderProfile; isDemo: boolean };

export interface LoginInput {
    email: string;
    password: string;
    remember: boolean;
}

interface RegisterBase {
    email: string;
    phone: string;
    password: string;
}

export interface BeneficiaryRegisterInput extends RegisterBase {
    role: 'beneficiary';
    name: string;
}

export interface LenderRegisterInput extends RegisterBase {
    role: 'lender';
    institutionName: string;
    contactPerson: string;
    licenseNumber: string;
}

export type RegisterInput = BeneficiaryRegisterInput | LenderRegisterInput;

export type BeneficiaryProfileUpdate = Omit<BeneficiaryProfile, 'id'>;

export interface PasswordResetRequest {
    /** Only set by the simulated service, which can't send email. A real backend never returns this. */
    simulatedResetToken: string | null;
}

export interface DemoAccount {
    id: string;
    role: UserRole;
    name: string;
    detail: string;
}

/** Everything the UI needs from authentication. The mock and the backend client both implement this. */
export interface AuthService {
    readonly mode: 'mock' | 'live';
    login(input: LoginInput): Promise<AuthUser>;
    register(input: RegisterInput): Promise<AuthUser>;
    logout(): Promise<void>;
    restoreSession(): Promise<AuthUser | null>;
    requestPasswordReset(email: string): Promise<PasswordResetRequest>;
    resetPassword(token: string, password: string): Promise<void>;
    changePassword(currentPassword: string, newPassword: string): Promise<void>;
    updateBeneficiaryProfile(update: BeneficiaryProfileUpdate): Promise<AuthUser>;
    /** Password-free sign-in for the demo accounts. Empty and unusable when connected to a backend. */
    listDemoAccounts(): DemoAccount[];
    demoLogin(accountId: string): Promise<AuthUser>;
}
