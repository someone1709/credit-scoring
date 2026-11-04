// The real lending client. Screens never import this directly, so switching on the backend only
// means setting VITE_API_MODE=live. This file is the one place that knows the wire format:
// snake_case JSON, mapped to the app's types below. See backend/README.md for every route.

import type {
    ApplicationStatus,
    CreditAssessmentResponse,
    DisbursementStep,
    Document,
    DocumentType,
    LenderDecision,
    LenderDecisionStatus,
    LoanApplication,
    LoanOffer,
    LoanPurpose,
    Notification,
    OfferStatus,
    RepaymentHistory,
    UserRole,
    VerificationStatus,
} from '@/types';
import type { AppDataService, LenderOption } from '@/types/appService';
import { ApiError, http, toApiError } from '@/services/http';

interface DocumentDto {
    id: string;
    application_id: string;
    beneficiary_id: string;
    type: DocumentType;
    label: string;
    filename: string | null;
    uploaded_at: string | null;
    verification_status: VerificationStatus;
    check_note: string | null;
    file_available: boolean;
}

interface DecisionDto {
    lender_id: string;
    lender_name: string;
    application_id: string;
    status: LenderDecisionStatus;
    last_updated: string;
    note: string | null;
    applicant_reply: string | null;
    applicant_reply_at: string | null;
}

interface OfferDto {
    id: string;
    lender_id: string;
    lender_name: string;
    lender_logo_initials: string;
    lender_logo_color: string;
    application_id: string;
    beneficiary_id: string;
    amount: number;
    interest_rate: number;
    tenure_months: number;
    status: OfferStatus;
    features: string[];
    created_at: string;
    expires_at: string | null;
}

interface ApplicationDto {
    id: string;
    beneficiary_id: string;
    beneficiary_name: string;
    applicant_profile: { occupation: string | null; city: string | null; state: string | null };
    consent_given_at: string;
    monthly_income: number;
    monthly_expenses: number;
    existing_emi: number;
    loan_amount: number;
    loan_purpose: LoanPurpose;
    tenure_months: number;
    repayment_history: RepaymentHistory;
    electricity_usage: number | null;
    status: ApplicationStatus | null;
    submitted_at: string;
    last_updated_at: string;
    assessment: CreditAssessmentResponse | null;
    documents: DocumentDto[];
    lender_decisions: DecisionDto[];
    offers: OfferDto[];
    disbursement_steps: DisbursementStep[];
    closed_to_lender: boolean | null;
}

interface NotificationDto {
    id: string;
    title: string;
    message: string;
    type: Notification['type'];
    read: boolean;
    created_at: string;
}

interface LenderOptionDto {
    id: string;
    name: string;
    logo_initials: string;
    logo_color: string;
}

// Spring's limit is above the 5 MB rule, so slightly large files get a normal failed check.
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const REFRESH_EVERY_MS = 30000;

function toDocument(dto: DocumentDto): Document {
    return {
        id: dto.id,
        applicationId: dto.application_id,
        beneficiaryId: dto.beneficiary_id,
        type: dto.type,
        label: dto.label,
        filename: dto.filename,
        uploadedAt: dto.uploaded_at,
        verification_status: dto.verification_status,
        checkNote: dto.check_note,
        fileAvailable: dto.file_available,
    };
}

function toDecision(dto: DecisionDto): LenderDecision {
    return {
        lenderId: dto.lender_id,
        lenderName: dto.lender_name,
        applicationId: dto.application_id,
        status: dto.status,
        lastUpdated: dto.last_updated,
        note: dto.note,
        applicantReply: dto.applicant_reply,
        applicantReplyAt: dto.applicant_reply_at,
    };
}

function toOffer(dto: OfferDto): LoanOffer {
    return {
        id: dto.id,
        lender_id: dto.lender_id,
        lenderName: dto.lender_name,
        lenderLogoInitials: dto.lender_logo_initials,
        lenderLogoColor: dto.lender_logo_color,
        applicationId: dto.application_id,
        beneficiaryId: dto.beneficiary_id,
        amount: dto.amount,
        interest_rate: dto.interest_rate,
        tenure_months: dto.tenure_months,
        status: dto.status,
        features: dto.features,
        createdAt: dto.created_at,
        expiresAt: dto.expires_at,
    };
}

function toApplication(dto: ApplicationDto): LoanApplication {
    return {
        id: dto.id,
        beneficiaryId: dto.beneficiary_id,
        beneficiaryName: dto.beneficiary_name,
        applicantProfile: {
            occupation: dto.applicant_profile.occupation ?? '',
            city: dto.applicant_profile.city ?? '',
            state: dto.applicant_profile.state ?? '',
        },
        consentGivenAt: dto.consent_given_at,
        monthly_income: dto.monthly_income,
        monthly_expenses: dto.monthly_expenses,
        existing_emi: dto.existing_emi,
        loan_amount: dto.loan_amount,
        loan_purpose: dto.loan_purpose,
        tenure_months: dto.tenure_months,
        repayment_history: dto.repayment_history,
        electricity_usage: dto.electricity_usage,
        // Null for a lender whose offer didn't win. Lender screens never show the overall status.
        status: dto.status ?? 'UNDER_REVIEW',
        submittedAt: dto.submitted_at,
        lastUpdatedAt: dto.last_updated_at,
        assessment: dto.assessment,
        documents: dto.documents.map(toDocument),
        lenderDecisions: dto.lender_decisions.map(toDecision),
        offers: dto.offers.map(toOffer),
        disbursementSteps: dto.disbursement_steps,
        closedToLender: dto.closed_to_lender ?? false,
    };
}

function toNotification(dto: NotificationDto, userId: string, userRole: UserRole): Notification {
    return {
        id: dto.id,
        userId,
        userRole,
        title: dto.title,
        message: dto.message,
        type: dto.type,
        read: dto.read,
        createdAt: dto.created_at,
    };
}

/** These screens show one message above the form, so lift the specific reason out of the details. */
async function call<T>(request: () => Promise<{ data: T }>): Promise<T> {
    try {
        return (await request()).data;
    } catch (error) {
        const apiError = toApiError(error);
        if (apiError.details.length > 0) {
            throw new ApiError(apiError.status, apiError.code, apiError.details.map(detail => detail.issue).join(' '), apiError.details);
        }
        throw apiError;
    }
}

export const httpAppService: AppDataService = {
    async load(user) {
        const path = user.role === 'lender' ? '/lender/applications' : '/applications';
        const [applications, notifications] = await Promise.all([
            call(() => http.get<ApplicationDto[]>(path)),
            call(() => http.get<NotificationDto[]>('/notifications')),
        ]);
        return {
            applications: applications.map(toApplication),
            notifications: notifications.map(dto => toNotification(dto, user.profile.id, user.role)),
        };
    },

    async listLenders() {
        const lenders = await call(() => http.get<LenderOptionDto[]>('/lenders'));
        return lenders.map((dto): LenderOption => ({ id: dto.id, name: dto.name, logoInitials: dto.logo_initials, logoColor: dto.logo_color }));
    },

    async submitApplication(_beneficiary, data, lenderIds) {
        const dto = await call(() => http.post<ApplicationDto>('/applications', { ...data, lender_ids: lenderIds, consent: true }));
        return toApplication(dto);
    },

    async acceptOffer(offerId, applicationId) {
        await call(() => http.post(`/applications/${applicationId}/offers/${offerId}/accept`));
    },

    async declineOffer(offerId, applicationId) {
        await call(() => http.post(`/applications/${applicationId}/offers/${offerId}/decline`));
    },

    async uploadDocument(applicationId, documentId, _beneficiaryId, file) {
        if (file.size > MAX_UPLOAD_BYTES) {
            throw new Error('The file is larger than 5 MB.');
        }
        const form = new FormData();
        form.append('file', file);
        await call(() => http.post(`/applications/${applicationId}/documents/${documentId}`, form, {
            headers: { 'Content-Type': 'multipart/form-data' },
        }));
    },

    async deleteDocument(applicationId, documentId) {
        await call(() => http.delete(`/applications/${applicationId}/documents/${documentId}`));
    },

    async revokeLender(applicationId, lenderId) {
        await call(() => http.post(`/applications/${applicationId}/lenders/${lenderId}/revoke`));
    },

    async replyToLender(applicationId, lenderId, _beneficiaryId, message) {
        await call(() => http.post(`/applications/${applicationId}/lenders/${lenderId}/reply`, { message }));
    },

    async fetchDocumentFile(applicationId, documentId, role) {
        const base = role === 'lender' ? '/lender/applications' : '/applications';
        try {
            const response = await http.get<Blob>(`${base}/${applicationId}/documents/${documentId}/file`, { responseType: 'blob' });
            return response.data;
        } catch {
            // The error body is a Blob here, so the server's own message can't be read back.
            throw new Error("This file isn't available.");
        }
    },

    async syncApplicantProfile() {
        // The backend reads the profile live.
    },

    async updateLenderDecision(applicationId, _lender, status, note) {
        await call(() => http.post(`/lender/applications/${applicationId}/decision`, { status, note }));
    },

    async createOffer(applicationId, _lender, data) {
        const features = (data.features ?? '').split(',').map(f => f.trim()).filter(Boolean);
        await call(() => http.post(`/lender/applications/${applicationId}/offers`, {
            amount: data.amount,
            interest_rate: data.interest_rate,
            tenure_months: data.tenure_months,
            features,
        }));
    },

    async withdrawOffer(applicationId, _lender, offerId) {
        await call(() => http.post(`/lender/applications/${applicationId}/offers/${offerId}/withdraw`));
    },

    async advanceDisbursement(applicationId) {
        await call(() => http.post(`/lender/applications/${applicationId}/disbursement/advance`));
    },

    async markNotificationRead(id) {
        await call(() => http.post(`/notifications/${id}/read`));
    },

    async markAllNotificationsRead() {
        await call(() => http.post('/notifications/read-all'));
    },

    async resetDemoData() {
        throw new Error('Demo data only exists without a backend.');
    },

    subscribe(listener) {
        // Picks up what the other side did: a new offer, a decision, a notification.
        const timer = window.setInterval(listener, REFRESH_EVERY_MS);
        window.addEventListener('focus', listener);
        return () => {
            window.clearInterval(timer);
            window.removeEventListener('focus', listener);
        };
    },
};
