import type {
    BeneficiaryProfile,
    LenderProfile,
    LoanApplication,
    LoanOffer,
    Notification,
    CreditAssessmentRequest,
    CreditAssessmentResponse,
    Document,
    DocumentType,
    LenderDecision,
    DisbursementStep,
    VerificationStatus,
} from '@/types';
import { assessCredit } from '../lib/assessment.ts';
import { deriveVerificationStatus } from '../lib/workflow.ts';

// ============================================================
// Mock Users
// ============================================================

export const MOCK_BENEFICIARIES: BeneficiaryProfile[] = [
    {
        id: 'BEN001',
        name: 'Rahul Kumar',
        email: 'rahul.kumar@email.com',
        phone: '+91 9876543210',
        age: 28,
        occupation: 'Freelance Designer',
        address: '12, MG Road',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
    },
    {
        id: 'BEN002',
        name: 'Priya Sharma',
        email: 'priya.sharma@email.com',
        phone: '+91 9123456789',
        age: 34,
        occupation: 'Shop Owner',
        address: '45, Gandhi Nagar',
        city: 'Jaipur',
        state: 'Rajasthan',
        pincode: '302001',
    },
    {
        id: 'BEN003',
        name: 'Arjun Nair',
        email: 'arjun.nair@email.com',
        phone: '+91 9988776655',
        age: 23,
        occupation: 'Delivery Partner',
        address: '8, Lake View Road',
        city: 'Kochi',
        state: 'Kerala',
        pincode: '682001',
    },
];

export const MOCK_LENDERS: LenderProfile[] = [
    {
        id: 'LENDER001',
        name: 'Unity Bank',
        contactPerson: 'Arun Mehta',
        email: 'arun.mehta@unitybank.com',
        phone: '+91 8001234567',
        licenseNumber: 'NBFC-UB-2024-001',
        logoInitials: 'UB',
        logoColor: '#2563eb',
    },
    {
        id: 'LENDER002',
        name: 'Grameen Finance',
        contactPerson: 'Sunita Devi',
        email: 'sunita@grameen.finance',
        phone: '+91 8009876543',
        licenseNumber: 'NBFC-GF-2024-002',
        logoInitials: 'GF',
        logoColor: '#059669',
    },
    {
        id: 'LENDER003',
        name: 'Saha Cooperative Bank',
        contactPerson: 'Rajesh Saha',
        email: 'rajesh@sahabank.in',
        phone: '+91 8005551234',
        licenseNumber: 'COOP-SCB-2024-003',
        logoInitials: 'SC',
        logoColor: '#dc2626',
    },
];

// ============================================================
// Mock Documents
// ============================================================

const PASSED_NOTE = 'File type and size checks passed. This does not prove the document is genuine.';

const DOCUMENT_SLOTS: { type: DocumentType; label: string; suffix: string }[] = [
    { type: 'INCOME_PROOF', label: 'Income Proof', suffix: 'DOC1' },
    { type: 'BANK_STATEMENT', label: 'Bank Statement', suffix: 'DOC2' },
    { type: 'ELECTRICITY_BILL', label: 'Electricity Bill', suffix: 'DOC3' },
    { type: 'OTHER', label: 'Other Supporting Document', suffix: 'DOC4' },
];

/** The empty document checklist every new application starts with. Documents are optional. */
export function blankDocuments(applicationId: string, beneficiaryId: string): Document[] {
    return DOCUMENT_SLOTS.map(({ type, label, suffix }) => ({
        id: `${applicationId}-${suffix}`,
        applicationId,
        beneficiaryId,
        type,
        label,
        filename: null,
        uploadedAt: null,
        verification_status: 'NOT_PROVIDED' as VerificationStatus,
        checkNote: null,
    }));
}

function seedDocuments(applicationId: string, beneficiaryId: string, uploadedAt: string, uploads: Partial<Record<DocumentType, string>>): Document[] {
    return blankDocuments(applicationId, beneficiaryId).map(doc => {
        const filename = uploads[doc.type];
        return filename
            ? { ...doc, filename, uploadedAt, verification_status: 'CHECKS_PASSED' as VerificationStatus, checkNote: PASSED_NOTE }
            : doc;
    });
}

// ============================================================
// Disbursement Steps
// ============================================================

const DISBURSEMENT_LABELS = [
    'Offer Accepted',
    'Agreement Signed',
    'Verification Complete (Simulated)',
    'Disbursement Initiated',
    'Amount Credited (Simulated)',
];

const completedSteps = (dates: string[]): DisbursementStep[] =>
    DISBURSEMENT_LABELS.map((label, i) => ({ label, status: 'completed', date: dates[i] }));

// ============================================================
// Mock Offers
// ============================================================

function daysFromNow(days: number): string {
    return new Date(Date.now() + days * 86400000).toISOString();
}

const UNITY_LOGO = { lenderName: 'Unity Bank', lenderLogoInitials: 'UB', lenderLogoColor: '#2563eb' };
const GRAMEEN_LOGO = { lenderName: 'Grameen Finance', lenderLogoInitials: 'GF', lenderLogoColor: '#059669' };
const SAHA_LOGO = { lenderName: 'Saha Cooperative Bank', lenderLogoInitials: 'SC', lenderLogoColor: '#dc2626' };

const OFFERS_LA2391: LoanOffer[] = [
    {
        id: 'OFF001',
        lender_id: 'LENDER001',
        ...UNITY_LOGO,
        applicationId: 'LA2391',
        beneficiaryId: 'BEN001',
        amount: 75000,
        interest_rate: 12.5,
        tenure_months: 24,
        status: 'PENDING',
        features: ['Flexible repayment', 'No processing fee'],
        createdAt: '2026-10-28T14:00:00Z',
        expiresAt: daysFromNow(21),
    },
    {
        id: 'OFF005',
        lender_id: 'LENDER003',
        ...SAHA_LOGO,
        applicationId: 'LA2391',
        beneficiaryId: 'BEN001',
        amount: 70000,
        interest_rate: 11.75,
        tenure_months: 18,
        status: 'PENDING',
        features: ['Lower interest rate', 'Shorter tenure'],
        createdAt: '2026-10-30T10:00:00Z',
        expiresAt: daysFromNow(25),
    },
];

const OFFERS_LA1820: LoanOffer[] = [
    {
        id: 'OFF002',
        lender_id: 'LENDER001',
        ...UNITY_LOGO,
        applicationId: 'LA1820',
        beneficiaryId: 'BEN001',
        amount: 50000,
        interest_rate: 11.5,
        tenure_months: 12,
        status: 'ACCEPTED',
        features: ['Flexible repayment', 'Quick processing'],
        createdAt: '2026-08-14T10:00:00Z',
        expiresAt: null,
    },
    {
        id: 'OFF003',
        lender_id: 'LENDER002',
        ...GRAMEEN_LOGO,
        applicationId: 'LA1820',
        beneficiaryId: 'BEN001',
        amount: 45000,
        interest_rate: 13.0,
        tenure_months: 18,
        status: 'DECLINED',
        features: ['Quick disbursal', 'Minimal documentation'],
        createdAt: '2026-08-14T12:00:00Z',
        expiresAt: null,
    },
];

const OFFERS_LA3001: LoanOffer[] = [
    {
        id: 'OFF004',
        lender_id: 'LENDER002',
        ...GRAMEEN_LOGO,
        applicationId: 'LA3001',
        beneficiaryId: 'BEN002',
        amount: 120000,
        interest_rate: 10.5,
        tenure_months: 36,
        status: 'ACCEPTED',
        features: ['Preferential rate', 'Quick disbursal'],
        createdAt: '2026-09-04T10:00:00Z',
        expiresAt: null,
    },
];

export const MOCK_OFFERS: LoanOffer[] = [...OFFERS_LA2391, ...OFFERS_LA1820, ...OFFERS_LA3001];

// ============================================================
// Mock Lender Decisions
// ============================================================

function decision(applicationId: string, lender: 'LENDER001' | 'LENDER002' | 'LENDER003', status: LenderDecision['status'], lastUpdated: string, note: string | null = null): LenderDecision {
    const lenderName = { LENDER001: 'Unity Bank', LENDER002: 'Grameen Finance', LENDER003: 'Saha Cooperative Bank' }[lender];
    return { lenderId: lender, lenderName, applicationId, status, lastUpdated, note };
}

// ============================================================
// Mock Applications
// ============================================================

type SeedInput = Omit<LoanApplication, 'assessment' | 'beneficiaryName' | 'applicantProfile' | 'consentGivenAt'>;

/** Assessments are computed by the same rules live applications use, so seed data can't contradict them. */
function seedApplication(input: SeedInput): LoanApplication {
    const beneficiary = MOCK_BENEFICIARIES.find(b => b.id === input.beneficiaryId)!;
    const request: CreditAssessmentRequest = {
        beneficiary_id: input.beneficiaryId,
        monthly_income: input.monthly_income,
        monthly_expenses: input.monthly_expenses,
        existing_emi: input.existing_emi,
        loan_amount: input.loan_amount,
        repayment_history: input.repayment_history,
        electricity_usage: input.electricity_usage,
    };
    const assessment: CreditAssessmentResponse = assessCredit(request, deriveVerificationStatus(input.documents));
    return {
        ...input,
        beneficiaryName: beneficiary.name,
        applicantProfile: { occupation: beneficiary.occupation, city: beneficiary.city, state: beneficiary.state },
        consentGivenAt: input.submittedAt,
        assessment,
    };
}

export const MOCK_APPLICATIONS: LoanApplication[] = [
    seedApplication({
        id: 'LA2391',
        beneficiaryId: 'BEN001',
        monthly_income: 32000,
        monthly_expenses: 14400,
        existing_emi: 2000,
        loan_amount: 75000,
        loan_purpose: 'Education',
        tenure_months: 24,
        repayment_history: 'good',
        electricity_usage: 120,
        status: 'OFFERS_AVAILABLE',
        submittedAt: '2026-10-25T08:30:00Z',
        lastUpdatedAt: '2026-10-30T10:00:00Z',
        documents: seedDocuments('LA2391', 'BEN001', '2026-10-25T10:00:00Z', { INCOME_PROOF: 'income_proof_rahul.pdf', ELECTRICITY_BILL: 'electricity_rahul.pdf' }),
        lenderDecisions: [
            decision('LA2391', 'LENDER001', 'OFFER_MADE', '2026-10-28T14:00:00Z', 'Offer: ₹75,000 at 12.5% for 24 months.'),
            decision('LA2391', 'LENDER002', 'UNDER_REVIEW', '2026-10-27T11:00:00Z'),
            decision('LA2391', 'LENDER003', 'OFFER_MADE', '2026-10-30T10:00:00Z', 'Offer: ₹70,000 at 11.75% for 18 months.'),
        ],
        offers: OFFERS_LA2391,
        disbursementSteps: [],
    }),
    seedApplication({
        id: 'LA1820',
        beneficiaryId: 'BEN001',
        monthly_income: 32000,
        monthly_expenses: 13000,
        existing_emi: 1500,
        loan_amount: 50000,
        loan_purpose: 'Personal',
        tenure_months: 12,
        repayment_history: 'good',
        electricity_usage: 110,
        status: 'DISBURSED',
        submittedAt: '2026-08-12T09:00:00Z',
        lastUpdatedAt: '2026-08-19T10:00:00Z',
        documents: seedDocuments('LA1820', 'BEN001', '2026-08-12T10:00:00Z', { INCOME_PROOF: 'income_proof_rahul.pdf', BANK_STATEMENT: 'bank_rahul.pdf' }),
        lenderDecisions: [
            decision('LA1820', 'LENDER001', 'OFFER_MADE', '2026-08-14T10:00:00Z', 'Offer: ₹50,000 at 11.5% for 12 months.'),
            decision('LA1820', 'LENDER002', 'OFFER_MADE', '2026-08-14T12:00:00Z', 'Offer: ₹45,000 at 13% for 18 months.'),
        ],
        offers: OFFERS_LA1820,
        disbursementSteps: completedSteps(['15 Aug 2026', '16 Aug 2026', '17 Aug 2026', '18 Aug 2026', '19 Aug 2026']),
    }),
    seedApplication({
        id: 'LA1045',
        beneficiaryId: 'BEN001',
        monthly_income: 18000,
        monthly_expenses: 13000,
        existing_emi: 5600,
        loan_amount: 30000,
        loan_purpose: 'Business',
        tenure_months: 18,
        repayment_history: 'none',
        electricity_usage: 95,
        status: 'REJECTED',
        submittedAt: '2026-03-10T07:45:00Z',
        lastUpdatedAt: '2026-03-19T12:00:00Z',
        documents: seedDocuments('LA1045', 'BEN001', '2026-03-10T09:00:00Z', { INCOME_PROOF: 'income_proof_rahul.pdf' }),
        lenderDecisions: [
            decision('LA1045', 'LENDER001', 'REJECTED', '2026-03-18T09:00:00Z', 'Expenses and EMI exceed monthly income.'),
            decision('LA1045', 'LENDER002', 'REJECTED', '2026-03-19T10:00:00Z', 'Income does not support the requested amount.'),
        ],
        offers: [],
        disbursementSteps: [],
    }),
    seedApplication({
        id: 'LA3001',
        beneficiaryId: 'BEN002',
        monthly_income: 55000,
        monthly_expenses: 20000,
        existing_emi: 4000,
        loan_amount: 120000,
        loan_purpose: 'Business',
        tenure_months: 36,
        repayment_history: 'good',
        electricity_usage: 200,
        status: 'DISBURSED',
        submittedAt: '2026-09-01T10:00:00Z',
        lastUpdatedAt: '2026-09-10T11:00:00Z',
        documents: seedDocuments('LA3001', 'BEN002', '2026-09-01T11:00:00Z', { INCOME_PROOF: 'income_priya.pdf', BANK_STATEMENT: 'bank_priya.pdf' }),
        lenderDecisions: [
            decision('LA3001', 'LENDER002', 'OFFER_MADE', '2026-09-04T10:00:00Z', 'Offer: ₹1,20,000 at 10.5% for 36 months.'),
        ],
        offers: OFFERS_LA3001,
        disbursementSteps: completedSteps(['5 Sep 2026', '6 Sep 2026', '7 Sep 2026', '8 Sep 2026', '10 Sep 2026']),
    }),
    seedApplication({
        id: 'LA2455',
        beneficiaryId: 'BEN002',
        monthly_income: 28000,
        monthly_expenses: 17000,
        existing_emi: 3500,
        loan_amount: 90000,
        loan_purpose: 'Home Improvement',
        tenure_months: 24,
        repayment_history: 'average',
        electricity_usage: null,
        status: 'DOCUMENTS_REQUIRED',
        submittedAt: '2026-10-20T09:00:00Z',
        lastUpdatedAt: '2026-10-29T15:00:00Z',
        documents: blankDocuments('LA2455', 'BEN002'),
        lenderDecisions: [
            decision('LA2455', 'LENDER001', 'PENDING', '2026-10-20T09:00:00Z'),
            decision('LA2455', 'LENDER003', 'INFO_REQUESTED', '2026-10-29T15:00:00Z', 'Please upload a recent bank statement.'),
        ],
        offers: [],
        disbursementSteps: [],
    }),
    seedApplication({
        id: 'LA2510',
        beneficiaryId: 'BEN003',
        monthly_income: 24000,
        monthly_expenses: 9000,
        existing_emi: 0,
        loan_amount: 40000,
        loan_purpose: 'Business',
        tenure_months: 12,
        repayment_history: 'none',
        electricity_usage: null,
        status: 'UNDER_REVIEW',
        submittedAt: '2026-10-31T12:00:00Z',
        lastUpdatedAt: '2026-11-01T09:30:00Z',
        documents: seedDocuments('LA2510', 'BEN003', '2026-10-31T12:30:00Z', { INCOME_PROOF: 'income_arjun.pdf' }),
        lenderDecisions: [
            decision('LA2510', 'LENDER001', 'UNDER_REVIEW', '2026-11-01T09:30:00Z'),
            decision('LA2510', 'LENDER002', 'PENDING', '2026-10-31T12:00:00Z'),
        ],
        offers: [],
        disbursementSteps: [],
    }),
];

// ============================================================
// Mock Notifications
// ============================================================

export const MOCK_NOTIFICATIONS: Notification[] = [
    {
        id: 'NOTIF007',
        userId: 'BEN001',
        userRole: 'beneficiary',
        title: 'New Loan Offer Received',
        message: 'Saha Cooperative Bank offered ₹70,000 at 11.75% p.a. on your application #LA2391.',
        type: 'success',
        read: false,
        createdAt: '2026-10-30T10:05:00Z',
    },
    {
        id: 'NOTIF001',
        userId: 'BEN001',
        userRole: 'beneficiary',
        title: 'New Loan Offer Received',
        message: 'Unity Bank offered ₹75,000 at 12.5% p.a. on your application #LA2391.',
        type: 'success',
        read: false,
        createdAt: '2026-10-28T14:05:00Z',
    },
    {
        id: 'NOTIF002',
        userId: 'BEN001',
        userRole: 'beneficiary',
        title: 'Application Under Review',
        message: 'Grameen Finance is reviewing your application #LA2391.',
        type: 'info',
        read: false,
        createdAt: '2026-10-27T11:10:00Z',
    },
    {
        id: 'NOTIF003',
        userId: 'BEN001',
        userRole: 'beneficiary',
        title: 'Disbursement Complete (Simulated)',
        message: 'Your loan of ₹50,000 on application #LA1820 is marked as disbursed. No real money moved.',
        type: 'success',
        read: true,
        createdAt: '2026-08-19T10:05:00Z',
    },
    {
        id: 'NOTIF004',
        userId: 'BEN001',
        userRole: 'beneficiary',
        title: 'Application Rejected',
        message: 'Every lender you shared application #LA1045 with has rejected it.',
        type: 'error',
        read: true,
        createdAt: '2026-03-19T12:05:00Z',
    },
    {
        id: 'NOTIF008',
        userId: 'BEN002',
        userRole: 'beneficiary',
        title: 'More Information Requested',
        message: 'Saha Cooperative Bank asked for more information on your application #LA2455: Please upload a recent bank statement.',
        type: 'warning',
        read: false,
        createdAt: '2026-10-29T15:05:00Z',
    },
    {
        id: 'NOTIF009',
        userId: 'BEN003',
        userRole: 'beneficiary',
        title: 'Application Under Review',
        message: 'Unity Bank is reviewing your application #LA2510.',
        type: 'info',
        read: false,
        createdAt: '2026-11-01T09:35:00Z',
    },
    {
        id: 'NOTIF005',
        userId: 'LENDER001',
        userRole: 'lender',
        title: 'New Application Available',
        message: 'Application #LA2510 from Arjun Nair was shared with you for review.',
        type: 'info',
        read: false,
        createdAt: '2026-10-31T12:05:00Z',
    },
    {
        id: 'NOTIF006',
        userId: 'LENDER002',
        userRole: 'lender',
        title: 'New Application Available',
        message: 'Application #LA2510 from Arjun Nair was shared with you for review.',
        type: 'info',
        read: false,
        createdAt: '2026-10-31T12:05:00Z',
    },
];
