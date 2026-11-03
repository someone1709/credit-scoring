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
import type { LenderAction } from '@/lib/workflow';

export interface AppContextValue {
    applications: LoanApplication[];
    notifications: Notification[];

    // Beneficiary actions
    submitApplication: (beneficiary: BeneficiaryProfile, data: LoanApplicationFormData, lenders: LenderProfile[]) => LoanApplication;
    acceptOffer: (offerId: string, applicationId: string, beneficiaryId: string) => void;
    declineOffer: (offerId: string, applicationId: string, beneficiaryId: string) => void;
    uploadDocument: (applicationId: string, documentId: string, beneficiaryId: string, file: File) => void;
    syncApplicantProfile: (beneficiary: BeneficiaryProfile) => void;

    // Lender actions
    updateLenderDecision: (applicationId: string, lender: LenderProfile, status: LenderAction, note: string | null) => void;
    createOffer: (applicationId: string, lender: LenderProfile, data: CreateOfferFormData) => void;
    withdrawOffer: (applicationId: string, lender: LenderProfile, offerId: string) => void;
    advanceDisbursement: (applicationId: string, lender: LenderProfile) => void;

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

    resetDemoData: () => void;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
    const ctx = useContext(AppContext);
    if (!ctx) throw new Error('useApp must be inside AppProvider');
    return ctx;
}
