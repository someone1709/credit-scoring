import type {
    BeneficiaryProfile,
    LenderProfile,
    LoanApplication,
    LoanOffer,
    Notification,
    CreditAssessmentResponse,
    Document,
    LenderDecision,
    DisbursementStep,
} from '@/types';

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
        aadharLinked: true,
        panLinked: true,
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
        aadharLinked: true,
        panLinked: false,
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
// Mock Credit Assessments
// ============================================================

const ASSESSMENT_LA2391: CreditAssessmentResponse = {
    beneficiary_id: 'BEN001',
    risk_score: 38,
    risk_category: 'MEDIUM',
    probability_of_default: 0.18,
    model_confidence: null,
    income_bracket: 'MID_INCOME',
    composite_score: 64,
    segment: 'STANDARD',
    is_thin_file: false,
    explanations: [
        'Monthly income is available and within the mid-income range.',
        'Debt-to-income ratio is moderate at 18.5%.',
        'Existing EMI obligations are manageable relative to income.',
        'Repayment history is reported as good — no adverse indicators.',
        'Expense-to-income ratio is within acceptable limits (45%).',
    ],
    explanation_method: 'RULE_BASED',
    verification_status: 'DEMO_UNVERIFIED',
};

const ASSESSMENT_LA1820: CreditAssessmentResponse = {
    beneficiary_id: 'BEN001',
    risk_score: 22,
    risk_category: 'LOW',
    probability_of_default: 0.08,
    model_confidence: null,
    income_bracket: 'MID_INCOME',
    composite_score: 78,
    segment: 'STANDARD_PLUS',
    is_thin_file: false,
    explanations: [
        'Monthly income is stable and well-documented.',
        'Low debt-to-income ratio of 9.2%.',
        'Monthly surplus is strong relative to the requested loan amount.',
        'Repayment history is reported as good.',
        'Electricity usage indicator is within normal range.',
    ],
    explanation_method: 'RULE_BASED',
    verification_status: 'CHECKS_PASSED',
};

const ASSESSMENT_LA1045: CreditAssessmentResponse = {
    beneficiary_id: 'BEN001',
    risk_score: 62,
    risk_category: 'HIGH',
    probability_of_default: 0.45,
    model_confidence: null,
    income_bracket: 'LOW_INCOME',
    composite_score: 38,
    segment: 'SUBPRIME',
    is_thin_file: true,
    explanations: [
        'No repayment history on record — applicant is a first-time borrower.',
        'Note: no history is not equivalent to poor repayment behaviour.',
        'Expense-to-income ratio is high at 72%.',
        'Monthly surplus is limited relative to the requested loan amount.',
        'Debt-to-income ratio is elevated at 31%.',
    ],
    explanation_method: 'RULE_BASED',
    verification_status: 'DEMO_UNVERIFIED',
};

const ASSESSMENT_BEN2_APP: CreditAssessmentResponse = {
    beneficiary_id: 'BEN002',
    risk_score: 18,
    risk_category: 'LOW',
    probability_of_default: 0.06,
    model_confidence: null,
    income_bracket: 'MID_INCOME',
    composite_score: 82,
    segment: 'PRIME',
    is_thin_file: false,
    explanations: [
        'Monthly income is stable with strong surplus.',
        'Repayment history is reported as good.',
        'Low debt-to-income ratio of 7.5%.',
        'Existing EMI obligations are well within comfortable range.',
        'Electricity usage is within normal bounds.',
    ],
    explanation_method: 'RULE_BASED',
    verification_status: 'CHECKS_PASSED',
};

// ============================================================
// Mock Documents
// ============================================================

const makeDocs = (appId: string, benId: string): Document[] => [
    {
        id: `${appId}-DOC1`,
        applicationId: appId,
        beneficiaryId: benId,
        type: 'AADHAAR_CARD',
        label: 'Aadhaar Card',
        filename: 'aadhaar_rahul.pdf',
        uploadedAt: '2026-10-25T10:00:00Z',
        verification_status: 'CHECKS_PASSED',
        checkNote: 'File format checks passed. Demo — not government-verified.',
    },
    {
        id: `${appId}-DOC2`,
        applicationId: appId,
        beneficiaryId: benId,
        type: 'PAN_CARD',
        label: 'PAN Card',
        filename: 'pan_rahul.pdf',
        uploadedAt: '2026-10-25T10:05:00Z',
        verification_status: 'CHECKS_PASSED',
        checkNote: 'File format checks passed. Demo — not government-verified.',
    },
    {
        id: `${appId}-DOC3`,
        applicationId: appId,
        beneficiaryId: benId,
        type: 'INCOME_PROOF',
        label: 'Income Proof',
        filename: 'income_proof_rahul.pdf',
        uploadedAt: '2026-10-25T10:10:00Z',
        verification_status: 'DOCUMENT_UPLOADED',
        checkNote: 'Awaiting basic checks.',
    },
    {
        id: `${appId}-DOC4`,
        applicationId: appId,
        beneficiaryId: benId,
        type: 'BANK_STATEMENT',
        label: 'Bank Statement',
        filename: null,
        uploadedAt: null,
        verification_status: 'NOT_PROVIDED',
        checkNote: null,
    },
    {
        id: `${appId}-DOC5`,
        applicationId: appId,
        beneficiaryId: benId,
        type: 'ADDRESS_PROOF',
        label: 'Address Proof',
        filename: 'address_rahul.pdf',
        uploadedAt: '2026-10-25T10:15:00Z',
        verification_status: 'CHECKS_PASSED',
        checkNote: 'File format checks passed. Demo — not government-verified.',
    },
];

const makeDocs2 = (appId: string, benId: string): Document[] => [
    {
        id: `${appId}-DOC1`,
        applicationId: appId,
        beneficiaryId: benId,
        type: 'AADHAAR_CARD',
        label: 'Aadhaar Card',
        filename: 'aadhaar_priya.pdf',
        uploadedAt: '2026-08-11T09:00:00Z',
        verification_status: 'CHECKS_PASSED',
        checkNote: 'File format checks passed. Demo — not government-verified.',
    },
    {
        id: `${appId}-DOC2`,
        applicationId: appId,
        beneficiaryId: benId,
        type: 'INCOME_PROOF',
        label: 'Income Proof',
        filename: 'income_priya.pdf',
        uploadedAt: '2026-08-11T09:05:00Z',
        verification_status: 'CHECKS_PASSED',
        checkNote: 'File format checks passed. Demo — not government-verified.',
    },
    {
        id: `${appId}-DOC3`,
        applicationId: appId,
        beneficiaryId: benId,
        type: 'BANK_STATEMENT',
        label: 'Bank Statement',
        filename: 'bank_priya.pdf',
        uploadedAt: '2026-08-11T09:10:00Z',
        verification_status: 'CHECKS_PASSED',
        checkNote: 'File format checks passed. Demo — not government-verified.',
    },
];

// ============================================================
// Disbursement Steps
// ============================================================

const DISBURSEMENT_LA1820: DisbursementStep[] = [
    { label: 'Offer Accepted', status: 'completed', date: 'Aug 15, 2026' },
    { label: 'Agreement Signed', status: 'completed', date: 'Aug 16, 2026' },
    { label: 'Verification Complete', status: 'completed', date: 'Aug 17, 2026' },
    { label: 'Disbursement Initiated', status: 'completed', date: 'Aug 18, 2026' },
    { label: 'Amount Credited (Simulated)', status: 'completed', date: 'Aug 19, 2026' },
];

const DISBURSEMENT_LA2391: DisbursementStep[] = [
    { label: 'Offer Accepted', status: 'pending', date: null },
    { label: 'Agreement Signed', status: 'pending', date: null },
    { label: 'Verification Complete', status: 'pending', date: null },
    { label: 'Disbursement Initiated', status: 'pending', date: null },
    { label: 'Amount Credited (Simulated)', status: 'pending', date: null },
];

const DISBURSEMENT_BEN2: DisbursementStep[] = [
    { label: 'Offer Accepted', status: 'completed', date: 'Sep 5, 2026' },
    { label: 'Agreement Signed', status: 'completed', date: 'Sep 6, 2026' },
    { label: 'Verification Complete', status: 'completed', date: 'Sep 7, 2026' },
    { label: 'Disbursement Initiated', status: 'completed', date: 'Sep 8, 2026' },
    { label: 'Amount Credited (Simulated)', status: 'completed', date: 'Sep 10, 2026' },
];

// ============================================================
// Mock Lender Decisions
// ============================================================

const DECISIONS_LA2391: LenderDecision[] = [
    {
        lenderId: 'LENDER001',
        lenderName: 'Unity Bank',
        applicationId: 'LA2391',
        status: 'OFFER_MADE',
        lastUpdated: '2026-10-28T14:00:00Z',
        note: 'Application reviewed. Offer made based on available financial profile.',
    },
    {
        lenderId: 'LENDER002',
        lenderName: 'Grameen Finance',
        applicationId: 'LA2391',
        status: 'UNDER_REVIEW',
        lastUpdated: '2026-10-27T11:00:00Z',
        note: null,
    },
    {
        lenderId: 'LENDER003',
        lenderName: 'Saha Cooperative Bank',
        applicationId: 'LA2391',
        status: 'PENDING',
        lastUpdated: '2026-10-25T09:00:00Z',
        note: null,
    },
];

const DECISIONS_LA1820: LenderDecision[] = [
    {
        lenderId: 'LENDER001',
        lenderName: 'Unity Bank',
        applicationId: 'LA1820',
        status: 'OFFER_MADE',
        lastUpdated: '2026-08-14T10:00:00Z',
        note: 'Strong financial profile. Competitive offer provided.',
    },
    {
        lenderId: 'LENDER002',
        lenderName: 'Grameen Finance',
        applicationId: 'LA1820',
        status: 'OFFER_MADE',
        lastUpdated: '2026-08-14T12:00:00Z',
        note: 'Offer created for quick disbursal.',
    },
];

const DECISIONS_LA1045: LenderDecision[] = [
    {
        lenderId: 'LENDER001',
        lenderName: 'Unity Bank',
        applicationId: 'LA1045',
        status: 'REJECTED',
        lastUpdated: '2026-03-18T09:00:00Z',
        note: 'High risk profile and missing repayment history.',
    },
    {
        lenderId: 'LENDER002',
        lenderName: 'Grameen Finance',
        applicationId: 'LA1045',
        status: 'REJECTED',
        lastUpdated: '2026-03-19T10:00:00Z',
        note: 'Income does not support requested loan amount.',
    },
];

const DECISIONS_BEN2_APP: LenderDecision[] = [
    {
        lenderId: 'LENDER002',
        lenderName: 'Grameen Finance',
        applicationId: 'LA3001',
        status: 'OFFER_MADE',
        lastUpdated: '2026-09-04T10:00:00Z',
        note: 'Excellent profile. Preferential rate applied.',
    },
];

// ============================================================
// Mock Offers
// ============================================================

export const MOCK_OFFERS: LoanOffer[] = [
    {
        id: 'OFF001',
        lender_id: 'LENDER001',
        lenderName: 'Unity Bank',
        lenderLogoInitials: 'UB',
        lenderLogoColor: '#2563eb',
        applicationId: 'LA2391',
        beneficiaryId: 'BEN001',
        amount: 75000,
        interest_rate: 12.5,
        tenure_months: 24,
        status: 'PENDING',
        features: ['Low interest rate', 'Flexible repayment', 'No processing fee'],
        createdAt: '2026-10-28T14:00:00Z',
        expiresAt: '2026-11-27T14:00:00Z',
    },
    {
        id: 'OFF002',
        lender_id: 'LENDER001',
        lenderName: 'Unity Bank',
        lenderLogoInitials: 'UB',
        lenderLogoColor: '#2563eb',
        applicationId: 'LA1820',
        beneficiaryId: 'BEN001',
        amount: 50000,
        interest_rate: 11.5,
        tenure_months: 12,
        status: 'ACCEPTED',
        features: ['Low interest rate', 'Flexible repayment', 'Quick processing'],
        createdAt: '2026-08-14T10:00:00Z',
        expiresAt: null,
    },
    {
        id: 'OFF003',
        lender_id: 'LENDER002',
        lenderName: 'Grameen Finance',
        lenderLogoInitials: 'GF',
        lenderLogoColor: '#059669',
        applicationId: 'LA1820',
        beneficiaryId: 'BEN001',
        amount: 45000,
        interest_rate: 13.0,
        tenure_months: 18,
        status: 'DECLINED',
        features: ['Quick disbursal', 'Minimal documentation', 'Suitable for first-time borrowers'],
        createdAt: '2026-08-14T12:00:00Z',
        expiresAt: null,
    },
    {
        id: 'OFF004',
        lender_id: 'LENDER002',
        lenderName: 'Grameen Finance',
        lenderLogoInitials: 'GF',
        lenderLogoColor: '#059669',
        applicationId: 'LA3001',
        beneficiaryId: 'BEN002',
        amount: 120000,
        interest_rate: 10.5,
        tenure_months: 36,
        status: 'ACCEPTED',
        features: ['Preferential rate', 'Quick disbursal', 'Suitable for businesses'],
        createdAt: '2026-09-04T10:00:00Z',
        expiresAt: null,
    },
];

// ============================================================
// Mock Applications
// ============================================================

export const MOCK_APPLICATIONS: LoanApplication[] = [
    {
        id: 'LA2391',
        beneficiaryId: 'BEN001',
        beneficiaryName: 'Rahul Kumar',
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
        lastUpdatedAt: '2026-10-28T14:00:00Z',
        assessment: ASSESSMENT_LA2391,
        documents: makeDocs('LA2391', 'BEN001'),
        lenderDecisions: DECISIONS_LA2391,
        offers: [MOCK_OFFERS[0]],
        disbursementSteps: DISBURSEMENT_LA2391,
    },
    {
        id: 'LA1820',
        beneficiaryId: 'BEN001',
        beneficiaryName: 'Rahul Kumar',
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
        assessment: ASSESSMENT_LA1820,
        documents: makeDocs('LA1820', 'BEN001'),
        lenderDecisions: DECISIONS_LA1820,
        offers: [MOCK_OFFERS[1], MOCK_OFFERS[2]],
        disbursementSteps: DISBURSEMENT_LA1820,
    },
    {
        id: 'LA1045',
        beneficiaryId: 'BEN001',
        beneficiaryName: 'Rahul Kumar',
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
        assessment: ASSESSMENT_LA1045,
        documents: makeDocs('LA1045', 'BEN001'),
        lenderDecisions: DECISIONS_LA1045,
        offers: [],
        disbursementSteps: [],
    },
    {
        id: 'LA3001',
        beneficiaryId: 'BEN002',
        beneficiaryName: 'Priya Sharma',
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
        assessment: ASSESSMENT_BEN2_APP,
        documents: makeDocs2('LA3001', 'BEN002'),
        lenderDecisions: DECISIONS_BEN2_APP,
        offers: [MOCK_OFFERS[3]],
        disbursementSteps: DISBURSEMENT_BEN2,
    },
];

// ============================================================
// Mock Notifications
// ============================================================

export const MOCK_NOTIFICATIONS: Notification[] = [
    {
        id: 'NOTIF001',
        userId: 'BEN001',
        userRole: 'beneficiary',
        title: 'New Loan Offer Received',
        message: 'Unity Bank has made a loan offer of ₹75,000 at 12.5% p.a. on your application #LA2391.',
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
        title: 'Disbursement Complete',
        message: 'Your loan of ₹50,000 (Application #LA1820) has been simulated as disbursed.',
        type: 'success',
        read: true,
        createdAt: '2026-08-19T10:05:00Z',
    },
    {
        id: 'NOTIF004',
        userId: 'BEN001',
        userRole: 'beneficiary',
        title: 'Application Rejected',
        message: 'Both lenders reviewing application #LA1045 have rejected it. See details for reasons.',
        type: 'error',
        read: true,
        createdAt: '2026-03-19T12:05:00Z',
    },
    {
        id: 'NOTIF005',
        userId: 'LENDER001',
        userRole: 'lender',
        title: 'New Application Available',
        message: 'A new loan application #LA2391 from Rahul Kumar is available for your review.',
        type: 'info',
        read: false,
        createdAt: '2026-10-25T09:00:00Z',
    },
    {
        id: 'NOTIF006',
        userId: 'LENDER002',
        userRole: 'lender',
        title: 'New Application Available',
        message: 'A new loan application #LA2391 from Rahul Kumar is available for your review.',
        type: 'info',
        read: false,
        createdAt: '2026-10-25T09:00:00Z',
    },
];
