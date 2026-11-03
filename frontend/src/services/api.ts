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
import { assessCredit } from '@/lib/assessment';

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
    async runAssessment(req: CreditAssessmentRequest): Promise<CreditAssessmentResponse> {
        await delay(1200);
        // Rule-based until Phase 3 calls FastAPI.
        return assessCredit(req, 'NOT_PROVIDED');
    },

    // Lender
    async getLenderApplications(lenderId: string): Promise<LoanApplication[]> {
        await delay(300);
        return MOCK_APPLICATIONS.filter(a => a.lenderDecisions.some(d => d.lenderId === lenderId));
    },

    async getOffers(lenderId: string): Promise<LoanOffer[]> {
        await delay(200);
        return MOCK_APPLICATIONS.flatMap(a => a.offers.filter(o => o.lender_id === lenderId));
    },
};
