// The lending workflow as plain functions, so the rules can be tested without React
// and reused as a reference when the Spring Boot backend implements them.
// Each transition takes an application and returns the next version plus who to notify.

import type {
    ApplicationStatus,
    Document,
    LenderDecision,
    LenderProfile,
    LoanApplication,
    LoanOffer,
    Notification,
    OfferStatus,
    VerificationStatus,
} from '@/types';

export class WorkflowError extends Error {}

export type NoticeDraft = Pick<Notification, 'userId' | 'userRole' | 'title' | 'message' | 'type'>;

export interface TransitionResult {
    app: LoanApplication;
    notices: NoticeDraft[];
}

export type LenderAction = 'UNDER_REVIEW' | 'INFO_REQUESTED' | 'REJECTED';

const OFFER_VALIDITY_DAYS = 30;
const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
const ALLOWED_DOCUMENT_TYPES: Record<string, string[]> = {
    pdf: ['application/pdf'],
    jpg: ['image/jpeg'],
    jpeg: ['image/jpeg'],
    png: ['image/png'],
};

function formatINR(amount: number): string {
    return `₹${amount.toLocaleString('en-IN')}`;
}

function formatStepDate(now: Date): string {
    return now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ============================================================
// Derived state
// ============================================================

/**
 * The beneficiary's aggregate status. It is always derived, never set by hand, so one
 * lender's rejection can't close an application other lenders are still reviewing.
 */
export function deriveApplicationStatus(
    app: Pick<LoanApplication, 'offers' | 'lenderDecisions' | 'disbursementSteps'>,
): ApplicationStatus {
    const steps = app.disbursementSteps;
    if (app.offers.some(o => o.status === 'ACCEPTED')) {
        const finished = steps.length > 0 && steps.every(s => s.status === 'completed');
        return finished ? 'DISBURSED' : 'OFFER_ACCEPTED';
    }
    if (app.offers.some(o => o.status === 'PENDING')) return 'OFFERS_AVAILABLE';

    const decisions = app.lenderDecisions.map(d => d.status);
    if (decisions.includes('INFO_REQUESTED')) return 'DOCUMENTS_REQUIRED';
    if (decisions.length > 0 && decisions.every(s => s === 'REJECTED')) return 'REJECTED';
    if (decisions.some(s => s !== 'PENDING')) return 'UNDER_REVIEW';
    return 'SUBMITTED';
}

export function deriveVerificationStatus(documents: Pick<Document, 'verification_status'>[]): VerificationStatus {
    const statuses = documents.map(d => d.verification_status).filter(s => s !== 'NOT_PROVIDED');
    if (statuses.length === 0) return 'NOT_PROVIDED';
    if (statuses.includes('CHECKS_FAILED')) return 'CHECKS_FAILED';
    if (statuses.includes('DOCUMENT_UPLOADED')) return 'DOCUMENT_UPLOADED';
    if (statuses.every(s => s === 'CHECKS_PASSED')) return 'CHECKS_PASSED';
    return 'DEMO_UNVERIFIED';
}

/** Lender decisions double as the access list: they exist only for lenders the beneficiary consented to share with. */
export function isSharedWithLender(app: LoanApplication, lenderId: string): boolean {
    return app.lenderDecisions.some(d => d.lenderId === lenderId);
}

export function getAcceptedOffer(app: LoanApplication): LoanOffer | undefined {
    return app.offers.find(o => o.status === 'ACCEPTED');
}

export function getLiveOffer(app: LoanApplication, lenderId: string): LoanOffer | undefined {
    return app.offers.find(o => o.lender_id === lenderId && o.status === 'PENDING');
}

/** True once a beneficiary has accepted an offer: no lender can change anything after that. */
export function isClosedToDecisions(app: LoanApplication): boolean {
    return getAcceptedOffer(app) !== undefined;
}

export function canUploadDocuments(app: LoanApplication): boolean {
    return app.status !== 'DISBURSED' && app.status !== 'REJECTED';
}

/** Index of the current step in the five-step application workflow; 5 means every step is done. */
export function workflowStep(status: ApplicationStatus): number {
    switch (status) {
        case 'SUBMITTED':
        case 'DOCUMENTS_REQUIRED':
            return 1;
        case 'UNDER_REVIEW':
            return 3;
        case 'OFFERS_AVAILABLE':
            return 4;
        case 'OFFER_ACCEPTED':
        case 'DISBURSED':
        case 'REJECTED':
            return 5;
    }
}

function withDerivedStatus(app: LoanApplication, now: Date): LoanApplication {
    return { ...app, status: deriveApplicationStatus(app), lastUpdatedAt: now.toISOString() };
}

function setDecision(app: LoanApplication, lenderId: string, patch: Pick<LenderDecision, 'status' | 'note'>, now: Date): LenderDecision[] {
    return app.lenderDecisions.map(d =>
        d.lenderId === lenderId ? { ...d, ...patch, lastUpdated: now.toISOString() } : d,
    );
}

function assertLenderCanAct(app: LoanApplication, lenderId: string): void {
    if (!isSharedWithLender(app, lenderId)) {
        throw new WorkflowError('This application has not been shared with you.');
    }
    if (isClosedToDecisions(app)) {
        throw new WorkflowError('This application is no longer open for decisions.');
    }
}

// ============================================================
// Lender actions
// ============================================================

export function applyLenderDecision(
    app: LoanApplication,
    lender: Pick<LenderProfile, 'id' | 'name'>,
    status: LenderAction,
    note: string | null,
    now: Date,
): TransitionResult {
    assertLenderCanAct(app, lender.id);

    const trimmedNote = note?.trim() || null;
    if (status === 'INFO_REQUESTED' && !trimmedNote) {
        throw new WorkflowError('Say what information you need, so the applicant can provide it.');
    }

    const liveOffer = getLiveOffer(app, lender.id);
    if (liveOffer && status !== 'REJECTED') {
        throw new WorkflowError('Withdraw your current offer before changing this decision.');
    }

    // Rejecting takes back any live offer from this lender; other lenders are untouched.
    const offers = app.offers.map(o =>
        o.id === liveOffer?.id ? { ...o, status: 'WITHDRAWN' as OfferStatus } : o,
    );
    const next = withDerivedStatus(
        { ...app, offers, lenderDecisions: setDecision(app, lender.id, { status, note: trimmedNote }, now) },
        now,
    );

    const notices: NoticeDraft[] = [];
    const reference = `application #${app.id}`;
    if (status === 'UNDER_REVIEW') {
        notices.push({ userId: app.beneficiaryId, userRole: 'beneficiary', type: 'info', title: 'Application Under Review', message: `${lender.name} is reviewing your ${reference}.` });
    } else if (status === 'INFO_REQUESTED') {
        notices.push({ userId: app.beneficiaryId, userRole: 'beneficiary', type: 'warning', title: 'More Information Requested', message: `${lender.name} asked for more information on your ${reference}: ${trimmedNote}` });
    } else {
        const stillOpen = next.status !== 'REJECTED';
        notices.push({
            userId: app.beneficiaryId,
            userRole: 'beneficiary',
            type: stillOpen ? 'warning' : 'error',
            title: stillOpen ? 'One Lender Declined' : 'Application Rejected',
            message: stillOpen
                ? `${lender.name} rejected your ${reference}. Other lenders' reviews are not affected.`
                : `Every lender you shared ${reference} with has rejected it.`,
        });
    }
    return { app: next, notices };
}

export function makeOffer(
    app: LoanApplication,
    lender: LenderProfile,
    input: { amount: number; interest_rate: number; tenure_months: number; features: string[] },
    offerId: string,
    now: Date,
): TransitionResult {
    assertLenderCanAct(app, lender.id);
    if (!(input.amount > 0) || !(input.tenure_months > 0) || !(input.interest_rate >= 0)) {
        throw new WorkflowError('Enter a valid offer amount, interest rate and tenure.');
    }

    const offer: LoanOffer = {
        id: offerId,
        lender_id: lender.id,
        lenderName: lender.name,
        lenderLogoInitials: lender.logoInitials,
        lenderLogoColor: lender.logoColor,
        applicationId: app.id,
        beneficiaryId: app.beneficiaryId,
        amount: input.amount,
        interest_rate: input.interest_rate,
        tenure_months: input.tenure_months,
        status: 'PENDING',
        features: input.features,
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + OFFER_VALIDITY_DAYS * 86400000).toISOString(),
    };

    // A lender holds one live offer per application: a new one replaces the old one on record.
    const offers: LoanOffer[] = [
        ...app.offers.map(o =>
            o.lender_id === lender.id && o.status === 'PENDING' ? { ...o, status: 'WITHDRAWN' as OfferStatus } : o,
        ),
        offer,
    ];
    const note = `Offer: ${formatINR(input.amount)} at ${input.interest_rate}% for ${input.tenure_months} months.`;
    const next = withDerivedStatus(
        { ...app, offers, lenderDecisions: setDecision(app, lender.id, { status: 'OFFER_MADE', note }, now) },
        now,
    );
    return {
        app: next,
        notices: [{
            userId: app.beneficiaryId,
            userRole: 'beneficiary',
            type: 'success',
            title: 'New Loan Offer Received',
            message: `${lender.name} offered ${formatINR(input.amount)} at ${input.interest_rate}% p.a. on your application #${app.id}.`,
        }],
    };
}

export function withdrawOffer(app: LoanApplication, lender: Pick<LenderProfile, 'id' | 'name'>, offerId: string, now: Date): TransitionResult {
    assertLenderCanAct(app, lender.id);
    const offer = app.offers.find(o => o.id === offerId && o.lender_id === lender.id);
    if (!offer || offer.status !== 'PENDING') {
        throw new WorkflowError('Only your own pending offers can be withdrawn.');
    }
    const offers = app.offers.map(o => (o.id === offerId ? { ...o, status: 'WITHDRAWN' as OfferStatus } : o));
    const next = withDerivedStatus(
        { ...app, offers, lenderDecisions: setDecision(app, lender.id, { status: 'UNDER_REVIEW', note: 'Offer withdrawn by the lender.' }, now) },
        now,
    );
    return {
        app: next,
        notices: [{ userId: app.beneficiaryId, userRole: 'beneficiary', type: 'warning', title: 'Offer Withdrawn', message: `${lender.name} withdrew its offer on your application #${app.id}.` }],
    };
}

export function advanceDisbursement(app: LoanApplication, lenderId: string, now: Date): TransitionResult {
    const accepted = getAcceptedOffer(app);
    if (!accepted || accepted.lender_id !== lenderId) {
        throw new WorkflowError('Only the lender whose offer was accepted can update this disbursement.');
    }
    const currentIndex = app.disbursementSteps.findIndex(s => s.status === 'current');
    if (currentIndex === -1) {
        throw new WorkflowError('This disbursement is already complete.');
    }

    const completedLabel = app.disbursementSteps[currentIndex].label;
    const disbursementSteps = app.disbursementSteps.map((step, i) => {
        if (i === currentIndex) return { ...step, status: 'completed' as const, date: formatStepDate(now) };
        if (i === currentIndex + 1) return { ...step, status: 'current' as const };
        return step;
    });
    const next = withDerivedStatus({ ...app, disbursementSteps }, now);
    const finished = next.status === 'DISBURSED';
    return {
        app: next,
        notices: [{
            userId: app.beneficiaryId,
            userRole: 'beneficiary',
            type: finished ? 'success' : 'info',
            title: finished ? 'Disbursement Complete (Simulated)' : 'Disbursement Updated',
            message: finished
                ? `Your loan of ${formatINR(accepted.amount)} on application #${app.id} is marked as disbursed. No real money moved.`
                : `${completedLabel} is done for application #${app.id}.`,
        }],
    };
}

// ============================================================
// Beneficiary actions
// ============================================================

function assertOwnsOpenOffer(app: LoanApplication, beneficiaryId: string, offerId: string, now: Date): LoanOffer {
    if (app.beneficiaryId !== beneficiaryId) {
        throw new WorkflowError('This application belongs to another account.');
    }
    const offer = app.offers.find(o => o.id === offerId);
    if (!offer) throw new WorkflowError('This offer no longer exists.');
    if (offer.status !== 'PENDING') throw new WorkflowError('This offer is no longer available.');
    if (offer.expiresAt && new Date(offer.expiresAt) <= now) throw new WorkflowError('This offer has expired.');
    return offer;
}

export function acceptOffer(app: LoanApplication, beneficiaryId: string, offerId: string, now: Date): TransitionResult {
    const offer = assertOwnsOpenOffer(app, beneficiaryId, offerId, now);
    if (isClosedToDecisions(app)) {
        throw new WorkflowError('You have already accepted an offer on this application.');
    }

    const notices: NoticeDraft[] = [{
        userId: offer.lender_id,
        userRole: 'lender',
        type: 'success',
        title: 'Offer Accepted',
        message: `Your offer of ${formatINR(offer.amount)} on application #${app.id} was accepted.`,
    }];

    const offers = app.offers.map(o => {
        if (o.id === offerId) return { ...o, status: 'ACCEPTED' as OfferStatus };
        if (o.status !== 'PENDING') return o;
        // Other lenders learn their offer was declined, not who won.
        notices.push({ userId: o.lender_id, userRole: 'lender', type: 'info', title: 'Offer Declined', message: `Your offer on application #${app.id} was declined.` });
        return { ...o, status: 'DECLINED' as OfferStatus };
    });

    const disbursementSteps = [
        { label: 'Offer Accepted', status: 'completed' as const, date: formatStepDate(now) },
        { label: 'Agreement Signed', status: 'current' as const, date: null },
        { label: 'Verification Complete (Simulated)', status: 'pending' as const, date: null },
        { label: 'Disbursement Initiated', status: 'pending' as const, date: null },
        { label: 'Amount Credited (Simulated)', status: 'pending' as const, date: null },
    ];

    return { app: withDerivedStatus({ ...app, offers, disbursementSteps }, now), notices };
}

export function declineOffer(app: LoanApplication, beneficiaryId: string, offerId: string, now: Date): TransitionResult {
    const offer = assertOwnsOpenOffer(app, beneficiaryId, offerId, now);
    const offers = app.offers.map(o => (o.id === offerId ? { ...o, status: 'DECLINED' as OfferStatus } : o));
    // The lender goes back to reviewing, so a decision of OFFER_MADE always means a live offer.
    const next = withDerivedStatus(
        { ...app, offers, lenderDecisions: setDecision(app, offer.lender_id, { status: 'UNDER_REVIEW', note: 'Applicant declined the offer.' }, now) },
        now,
    );
    return {
        app: next,
        notices: [{ userId: offer.lender_id, userRole: 'lender', type: 'info', title: 'Offer Declined', message: `Your offer on application #${app.id} was declined.` }],
    };
}

export function expireOffers(app: LoanApplication, now: Date): TransitionResult | null {
    const expired = app.offers.filter(o => o.status === 'PENDING' && o.expiresAt && new Date(o.expiresAt) <= now);
    if (expired.length === 0) return null;

    const expiredIds = new Set(expired.map(o => o.id));
    const offers = app.offers.map(o => (expiredIds.has(o.id) ? { ...o, status: 'EXPIRED' as OfferStatus } : o));
    let lenderDecisions = app.lenderDecisions;
    for (const offer of expired) {
        lenderDecisions = lenderDecisions.map(d =>
            d.lenderId === offer.lender_id ? { ...d, status: 'UNDER_REVIEW', note: 'Offer expired.', lastUpdated: now.toISOString() } : d,
        );
    }
    return {
        app: withDerivedStatus({ ...app, offers, lenderDecisions }, now),
        notices: expired.flatMap(offer => [
            { userId: app.beneficiaryId, userRole: 'beneficiary' as const, type: 'warning' as const, title: 'Offer Expired', message: `The offer from ${offer.lenderName} on application #${app.id} has expired.` },
            { userId: offer.lender_id, userRole: 'lender' as const, type: 'info' as const, title: 'Offer Expired', message: `Your offer on application #${app.id} has expired.` },
        ]),
    };
}

// ============================================================
// Documents
// ============================================================

export interface DocumentFileInfo {
    name: string;
    size: number;
    type: string;
}

export interface DocumentCheckResult {
    passed: boolean;
    note: string;
}

/** Real checks on the file's type and size. They say nothing about whether a document is genuine. */
export function checkDocumentFile(file: DocumentFileInfo): DocumentCheckResult {
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    const allowedTypes = ALLOWED_DOCUMENT_TYPES[extension];
    if (!allowedTypes) return { passed: false, note: 'File type not accepted. Upload a PDF, JPG or PNG.' };
    if (file.type && !allowedTypes.includes(file.type)) return { passed: false, note: 'The file contents do not match its extension.' };
    if (file.size === 0) return { passed: false, note: 'The file is empty.' };
    if (file.size > MAX_DOCUMENT_BYTES) return { passed: false, note: 'The file is larger than 5 MB.' };
    return { passed: true, note: 'File type and size checks passed. This does not prove the document is genuine.' };
}

function withDocuments(app: LoanApplication, documents: Document[], now: Date): LoanApplication {
    const assessment = app.assessment && { ...app.assessment, verification_status: deriveVerificationStatus(documents) };
    return { ...app, documents, assessment, lastUpdatedAt: now.toISOString() };
}

export function recordDocumentUpload(app: LoanApplication, beneficiaryId: string, documentId: string, filename: string, now: Date): LoanApplication {
    if (app.beneficiaryId !== beneficiaryId) {
        throw new WorkflowError('This application belongs to another account.');
    }
    if (!canUploadDocuments(app)) {
        throw new WorkflowError('This application is closed, so documents can no longer be uploaded.');
    }
    const documents = app.documents.map(d =>
        d.id === documentId
            ? { ...d, filename, uploadedAt: now.toISOString(), verification_status: 'DOCUMENT_UPLOADED' as VerificationStatus, checkNote: 'Awaiting basic file checks.' }
            : d,
    );
    return withDocuments(app, documents, now);
}

export function completeDocumentCheck(app: LoanApplication, documentId: string, result: DocumentCheckResult, now: Date): TransitionResult {
    const documents = app.documents.map(d =>
        d.id === documentId
            ? { ...d, verification_status: (result.passed ? 'CHECKS_PASSED' : 'CHECKS_FAILED') as VerificationStatus, checkNote: result.note }
            : d,
    );
    const label = app.documents.find(d => d.id === documentId)?.label ?? 'A document';
    // Lenders waiting on more information hear about new evidence; the rest aren't interrupted.
    const notices: NoticeDraft[] = !result.passed
        ? []
        : app.lenderDecisions
            .filter(d => d.status === 'INFO_REQUESTED')
            .map(d => ({ userId: d.lenderId, userRole: 'lender' as const, type: 'info' as const, title: 'Document Uploaded', message: `${label} was uploaded for application #${app.id}, where you asked for more information.` }));
    return { app: withDocuments(app, documents, now), notices };
}
