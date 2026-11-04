import { createContext, useContext } from 'react';
import type {
    BeneficiaryProfile,
    CreateOfferFormData,
    LenderProfile,
    LoanApplication,
    LoanApplicationFormData,
    LoanOffer,
    Notification,
} from '@/types';
import type { LenderOption } from '@/types/appService';
import type { LenderAction } from '@/lib/workflow';

export interface AppContextValue {
    applications: LoanApplication[];
    notifications: Notification[];
    /** True while the signed-in user's data is first being fetched. */
    loading: boolean;
    loadError: string | null;
    retryLoad: () => void;
    listLenders: () => Promise<LenderOption[]>;

    // Beneficiary actions
    submitApplication: (beneficiary: BeneficiaryProfile, data: LoanApplicationFormData, lenderIds: string[]) => Promise<LoanApplication>;
    acceptOffer: (offerId: string, applicationId: string, beneficiaryId: string) => Promise<void>;
    declineOffer: (offerId: string, applicationId: string, beneficiaryId: string) => Promise<void>;
    uploadDocument: (applicationId: string, documentId: string, beneficiaryId: string, file: File) => Promise<void>;
    syncApplicantProfile: (beneficiary: BeneficiaryProfile) => Promise<void>;

    // Lender actions
    updateLenderDecision: (applicationId: string, lender: LenderProfile, status: LenderAction, note: string | null) => Promise<void>;
    createOffer: (applicationId: string, lender: LenderProfile, data: CreateOfferFormData) => Promise<void>;
    withdrawOffer: (applicationId: string, lender: LenderProfile, offerId: string) => Promise<void>;
    advanceDisbursement: (applicationId: string, lender: LenderProfile) => Promise<void>;

    // Notifications
    markNotificationRead: (id: string) => void;
    markAllNotificationsRead: (userId: string) => void;

    // Derived. These return only what the given user may see.
    getApplicationsByBeneficiary: (beneficiaryId: string) => LoanApplication[];
    getApplicationsByLender: (lenderId: string) => LoanApplication[];
    getBeneficiaryApplication: (applicationId: string, beneficiaryId: string) => LoanApplication | undefined;
    getLenderApplication: (applicationId: string, lenderId: string) => LoanApplication | undefined;
    getOffersByLender: (lenderId: string) => LoanOffer[];
    getNotificationsByUser: (userId: string) => Notification[];

    resetDemoData: () => Promise<void>;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
    const ctx = useContext(AppContext);
    if (!ctx) throw new Error('useApp must be inside AppProvider');
    return ctx;
}
