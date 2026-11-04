import type {
    BeneficiaryProfile,
    CreateOfferFormData,
    LenderProfile,
    LoanApplication,
    LoanApplicationFormData,
    Notification,
} from './index';
import type { AuthUser } from './auth';
import type { LenderAction } from '@/lib/workflow';

export interface AppSnapshot {
    applications: LoanApplication[];
    notifications: Notification[];
}

/** What a beneficiary needs to choose a lender. Contact and license details stay private. */
export type LenderOption = Pick<LenderProfile, 'id' | 'name' | 'logoInitials' | 'logoColor'>;

/** Everything the UI can ask of the lending data. The mock and the backend client both implement this. */
export interface AppDataService {
    load(user: AuthUser): Promise<AppSnapshot>;
    listLenders(): Promise<LenderOption[]>;

    submitApplication(beneficiary: BeneficiaryProfile, data: LoanApplicationFormData, lenderIds: string[]): Promise<LoanApplication>;
    acceptOffer(offerId: string, applicationId: string, beneficiaryId: string): Promise<void>;
    declineOffer(offerId: string, applicationId: string, beneficiaryId: string): Promise<void>;
    uploadDocument(applicationId: string, documentId: string, beneficiaryId: string, file: File): Promise<void>;
    /** The backend reads the profile live, so only the mock has a copy to update. */
    syncApplicantProfile(beneficiary: BeneficiaryProfile): Promise<void>;

    updateLenderDecision(applicationId: string, lender: LenderProfile, status: LenderAction, note: string | null): Promise<void>;
    createOffer(applicationId: string, lender: LenderProfile, data: CreateOfferFormData): Promise<void>;
    withdrawOffer(applicationId: string, lender: LenderProfile, offerId: string): Promise<void>;
    advanceDisbursement(applicationId: string, lender: LenderProfile): Promise<void>;

    markNotificationRead(id: string): Promise<void>;
    markAllNotificationsRead(userId: string): Promise<void>;

    resetDemoData(): Promise<void>;

    /** Calls back when the data may have changed elsewhere. Returns the unsubscribe function. */
    subscribe(listener: () => void): () => void;
}
