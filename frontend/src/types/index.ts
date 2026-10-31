// ============================================================
// EXACT enums and types from the Master Brief
// ============================================================

export type RiskCategory = 'LOW' | 'MEDIUM' | 'HIGH';

export type IncomeBracket = 'LOW_INCOME' | 'MID_INCOME' | 'HIGH_INCOME' | 'UNKNOWN';

export type ApplicantSegment =
    | 'PRIME'
    | 'STANDARD_PLUS'
    | 'LOW_INCOME_PRIME'
    | 'STANDARD'
    | 'SUBPRIME'
    | 'HIGH_RISK';

export type RepaymentHistory = 'good' | 'average' | 'poor' | 'none';

export type ExplanationMethod = 'SHAP' | 'RULE_BASED';

export type VerificationStatus =
    | 'DEMO_UNVERIFIED'
    | 'DOCUMENT_UPLOADED'
    | 'CHECKS_PASSED'
    | 'CHECKS_FAILED'
    | 'NOT_PROVIDED';

export type LenderDecisionStatus =
    | 'PENDING'
    | 'UNDER_REVIEW'
    | 'INFO_REQUESTED'
    | 'OFFER_MADE'
    | 'REJECTED';

export type ApplicationStatus =
    | 'SUBMITTED'
    | 'DOCUMENTS_REQUIRED'
    | 'UNDER_REVIEW'
    | 'OFFERS_AVAILABLE'
    | 'OFFER_ACCEPTED'
    | 'REJECTED'
    | 'DISBURSED';

export type OfferStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'WITHDRAWN';

export type DocumentType =
    | 'INCOME_PROOF'
    | 'BANK_STATEMENT'
    | 'ELECTRICITY_BILL'
    | 'AADHAAR_CARD'
    | 'PAN_CARD'
    | 'ADDRESS_PROOF'
    | 'OTHER';

export type UserRole = 'beneficiary' | 'lender';

export type LoanPurpose =
    | 'Education'
    | 'Medical'
    | 'Business'
    | 'Personal'
    | 'Home Improvement'
    | 'Agriculture'
    | 'Other';

// ============================================================
// Interfaces
// ============================================================

export interface BeneficiaryProfile {
    id: string;
    name: string;
    email: string;
    phone: string;
    age: number;
    occupation: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    aadharLinked: boolean;
    panLinked: boolean;
}

export interface LenderProfile {
    id: string;
    name: string;          // Institution name
    contactPerson: string;
    email: string;
    phone: string;
    licenseNumber: string;
    logoInitials: string;
    logoColor: string;
}

export interface CreditAssessmentRequest {
    beneficiary_id: string;
    monthly_income: number;
    monthly_expenses: number;
    existing_emi: number;
    loan_amount: number;
    repayment_history: RepaymentHistory;
    electricity_usage: number;
}

export interface CreditAssessmentResponse {
    beneficiary_id: string;
    risk_score: number;
    risk_category: RiskCategory;
    probability_of_default: number | null;
    model_confidence: number | null;
    income_bracket: IncomeBracket;
    composite_score: number;
    segment: ApplicantSegment;
    is_thin_file: boolean;
    explanations: string[];
    explanation_method: ExplanationMethod;
    verification_status: VerificationStatus;
}

export interface Document {
    id: string;
    applicationId: string;
    beneficiaryId: string;
    type: DocumentType;
    label: string;
    filename: string | null;
    uploadedAt: string | null;
    verification_status: VerificationStatus;
    checkNote: string | null;
}

export interface LenderDecision {
    lenderId: string;
    lenderName: string;
    applicationId: string;
    status: LenderDecisionStatus;
    lastUpdated: string;
    note: string | null;
}

export interface LoanOffer {
    id: string;
    lender_id: string;
    lenderName: string;
    lenderLogoInitials: string;
    lenderLogoColor: string;
    applicationId: string;
    beneficiaryId: string;
    amount: number;
    interest_rate: number;
    tenure_months: number;
    status: OfferStatus;
    features: string[];
    createdAt: string;
    expiresAt: string | null;
}

export interface DisbursementStep {
    label: string;
    status: 'completed' | 'current' | 'pending';
    date: string | null;
}

export interface LoanApplication {
    id: string;
    beneficiaryId: string;
    beneficiaryName: string;

    // Financial inputs
    monthly_income: number;
    monthly_expenses: number;
    existing_emi: number;
    loan_amount: number;
    loan_purpose: LoanPurpose;
    tenure_months: number;
    repayment_history: RepaymentHistory;
    electricity_usage: number | null;

    // Status
    status: ApplicationStatus;
    submittedAt: string;
    lastUpdatedAt: string;

    // Credit assessment
    assessment: CreditAssessmentResponse | null;

    // Relations
    documents: Document[];
    lenderDecisions: LenderDecision[];
    offers: LoanOffer[];

    // Disbursement (mock)
    disbursementSteps: DisbursementStep[];
}

export interface Notification {
    id: string;
    userId: string;
    userRole: UserRole;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    read: boolean;
    createdAt: string;
}

export interface CreateOfferFormData {
    amount: number;
    interest_rate: number;
    tenure_months: number;
    features: string;
}

export interface LoanApplicationFormData {
    loan_amount: number;
    loan_purpose: LoanPurpose;
    tenure_months: number;
    monthly_income: number;
    monthly_expenses: number;
    existing_emi: number;
    repayment_history: RepaymentHistory;
    electricity_usage: number | null;
}
