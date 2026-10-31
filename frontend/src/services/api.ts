// Minimal mock API layer — returns mock data with simulated delay.
// Replace implementations with real Axios calls in Phase 2.
// All function signatures match the intended backend API contract.

import type {
    LoanApplication,
    LoanOffer,
    CreditAssessmentRequest,
    CreditAssessmentResponse,
    LoanApplicationFormData,
} from '@/types';
import { MOCK_APPLICATIONS } from '@/data/mockData';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export const api = {
    // Beneficiary
    async getApplications(beneficiaryId: string): Promise<LoanApplication[]> {
        await delay(300);
        return MOCK_APPLICATIONS.filter(a => a.beneficiaryId === beneficiaryId);
    },

    async getApplication(id: string): Promise<LoanApplication | null> {
        await delay(200);
        return MOCK_APPLICATIONS.find(a => a.id === id) || null;
    },

    async submitApplication(_beneficiaryId: string, _data: LoanApplicationFormData): Promise<{ id: string }> {
        await delay(800);
        return { id: `LA${Date.now().toString().slice(-4)}` };
    },

    // Credit Assessment
    async runAssessment(_req: CreditAssessmentRequest): Promise<CreditAssessmentResponse> {
        await delay(1200);
        // Phase 1: returns mock — Phase 3 will call FastAPI
        throw new Error('Not implemented in Phase 1');
    },

    // Lender
    async getLenderApplications(_lenderId: string): Promise<LoanApplication[]> {
        await delay(300);
        return MOCK_APPLICATIONS;
    },

    async getOffers(_lenderId: string): Promise<LoanOffer[]> {
        await delay(200);
        return MOCK_APPLICATIONS.flatMap(a => a.offers.filter(o => o.lender_id === _lenderId));
    },
};
