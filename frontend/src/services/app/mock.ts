// Runs the lending workflow in this browser, using the same rules the backend enforces.
// Used when VITE_API_MODE isn't "live", so the frontend works with no server at all.

import type { BeneficiaryProfile, LenderProfile, LoanApplication, Notification } from '@/types';
import type { AppDataService, AppSnapshot } from '@/types/appService';
import { MOCK_APPLICATIONS, MOCK_NOTIFICATIONS, blankDocuments } from '@/data/mockData';
import { assessCredit } from '@/lib/assessment';
import { readJson, removeKey, writeJson } from '@/lib/storage';
import * as workflow from '@/lib/workflow';
import type { NoticeDraft, TransitionResult } from '@/lib/workflow';
import { listLenders } from '@/services/auth/mock';

const APPLICATIONS_KEY = 'benescore.applications.v2';
const NOTIFICATIONS_KEY = 'benescore.notifications.v2';
const DOCUMENT_CHECK_DELAY_MS = 1500;

let noticeCounter = 0;

function toNotifications(notices: NoticeDraft[], now: Date): Notification[] {
    return notices.map(notice => ({
        ...notice,
        id: `NOTIF${now.getTime()}${noticeCounter++}`,
        read: false,
        createdAt: now.toISOString(),
    }));
}

function uniqueId(prefix: string, taken: Set<string>): string {
    let id: string;
    do {
        id = `${prefix}${Math.floor(1000 + Math.random() * 9000)}`;
    } while (taken.has(id));
    return id;
}

/** Saved data, with any offer whose validity has lapsed marked as expired. */
function readSaved(): AppSnapshot {
    const now = new Date();
    const notices: NoticeDraft[] = [];
    const applications = readJson<LoanApplication[]>(APPLICATIONS_KEY, MOCK_APPLICATIONS).map(app => {
        const result = workflow.expireOffers(app, now);
        if (!result) return app;
        notices.push(...result.notices);
        return result.app;
    });
    const notifications = [...toNotifications(notices, now), ...readJson<Notification[]>(NOTIFICATIONS_KEY, MOCK_NOTIFICATIONS)];
    // Save straight away, so an expiry is only announced once and every tab agrees on it.
    if (notices.length > 0) {
        writeJson(APPLICATIONS_KEY, applications);
        writeJson(NOTIFICATIONS_KEY, notifications);
    }
    return { applications, notifications };
}

let state: AppSnapshot | null = null;
const listeners = new Set<() => void>();

function current(): AppSnapshot {
    state ??= readSaved();
    return state;
}

function commit(next: AppSnapshot): void {
    state = next;
    writeJson(APPLICATIONS_KEY, next.applications);
    writeJson(NOTIFICATIONS_KEY, next.notifications);
}

function findApplication(applicationId: string): LoanApplication {
    const app = current().applications.find(a => a.id === applicationId);
    if (!app) throw new workflow.WorkflowError('This application could not be found.');
    return app;
}

function applyTransition(result: TransitionResult, now: Date): void {
    const snapshot = current();
    commit({
        applications: snapshot.applications.map(a => (a.id === result.app.id ? result.app : a)),
        notifications: [...toNotifications(result.notices, now), ...snapshot.notifications],
    });
}

export const mockAppService: AppDataService = {
    async load() {
        return current();
    },

    async listLenders() {
        return listLenders();
    },

    async submitApplication(beneficiary: BeneficiaryProfile, data, lenderIds) {
        const lenders = listLenders().filter(lender => lenderIds.includes(lender.id));
        if (lenders.length === 0) {
            throw new workflow.WorkflowError('Choose at least one lender to share your application with.');
        }
        const now = new Date();
        const timestamp = now.toISOString();
        const snapshot = current();
        const id = uniqueId('LA', new Set(snapshot.applications.map(a => a.id)));
        const electricityUsage = data.electricity_usage ?? null;

        const newApp: LoanApplication = {
            id,
            beneficiaryId: beneficiary.id,
            beneficiaryName: beneficiary.name,
            applicantProfile: { occupation: beneficiary.occupation, city: beneficiary.city, state: beneficiary.state },
            consentGivenAt: timestamp,
            ...data,
            electricity_usage: electricityUsage,
            status: 'SUBMITTED',
            submittedAt: timestamp,
            lastUpdatedAt: timestamp,
            assessment: assessCredit({
                beneficiary_id: beneficiary.id,
                monthly_income: data.monthly_income,
                monthly_expenses: data.monthly_expenses,
                existing_emi: data.existing_emi,
                loan_amount: data.loan_amount,
                repayment_history: data.repayment_history,
                electricity_usage: electricityUsage,
            }, 'NOT_PROVIDED'),
            documents: blankDocuments(id, beneficiary.id),
            lenderDecisions: lenders.map(lender => ({
                lenderId: lender.id,
                lenderName: lender.name,
                applicationId: id,
                status: 'PENDING',
                lastUpdated: timestamp,
                note: null,
            })),
            offers: [],
            disbursementSteps: [],
        };

        const notices: NoticeDraft[] = [
            { userId: beneficiary.id, userRole: 'beneficiary', type: 'success', title: 'Application Submitted', message: `Your application #${id} was shared with ${lenders.map(l => l.name).join(', ')}.` },
            ...lenders.map((lender): NoticeDraft => ({ userId: lender.id, userRole: 'lender', type: 'info', title: 'New Application Available', message: `Application #${id} from ${beneficiary.name} was shared with you for review.` })),
        ];

        commit({
            applications: [newApp, ...snapshot.applications],
            notifications: [...toNotifications(notices, now), ...snapshot.notifications],
        });
        return newApp;
    },

    async acceptOffer(offerId, applicationId, beneficiaryId) {
        const now = new Date();
        applyTransition(workflow.acceptOffer(findApplication(applicationId), beneficiaryId, offerId, now), now);
    },

    async declineOffer(offerId, applicationId, beneficiaryId) {
        const now = new Date();
        applyTransition(workflow.declineOffer(findApplication(applicationId), beneficiaryId, offerId, now), now);
    },

    async uploadDocument(applicationId, documentId, beneficiaryId, file) {
        const uploadedAt = new Date();
        // Only the file's details are kept. The contents never leave the browser in this mock.
        const uploaded = workflow.recordDocumentUpload(findApplication(applicationId), beneficiaryId, documentId, file.name, uploadedAt);
        applyTransition({ app: uploaded, notices: [] }, uploadedAt);

        const result = workflow.checkDocumentFile(file);
        window.setTimeout(() => {
            const now = new Date();
            applyTransition(workflow.completeDocumentCheck(findApplication(applicationId), documentId, result, now), now);
            listeners.forEach(listener => listener());
        }, DOCUMENT_CHECK_DELAY_MS);
    },

    async syncApplicantProfile(beneficiary) {
        const snapshot = current();
        commit({
            ...snapshot,
            applications: snapshot.applications.map(app => (app.beneficiaryId !== beneficiary.id ? app : {
                ...app,
                beneficiaryName: beneficiary.name,
                applicantProfile: { occupation: beneficiary.occupation, city: beneficiary.city, state: beneficiary.state },
            })),
        });
    },

    async updateLenderDecision(applicationId, lender: LenderProfile, status, note) {
        const now = new Date();
        applyTransition(workflow.applyLenderDecision(findApplication(applicationId), lender, status, note, now), now);
    },

    async createOffer(applicationId, lender, data) {
        const now = new Date();
        const taken = new Set(current().applications.flatMap(a => a.offers.map(o => o.id)));
        const features = (data.features ?? '').split(',').map(f => f.trim()).filter(Boolean);
        applyTransition(workflow.makeOffer(findApplication(applicationId), lender, { ...data, features }, uniqueId('OFF', taken), now), now);
    },

    async withdrawOffer(applicationId, lender, offerId) {
        const now = new Date();
        applyTransition(workflow.withdrawOffer(findApplication(applicationId), lender, offerId, now), now);
    },

    async advanceDisbursement(applicationId, lender) {
        const now = new Date();
        applyTransition(workflow.advanceDisbursement(findApplication(applicationId), lender.id, now), now);
    },

    async markNotificationRead(id) {
        const snapshot = current();
        commit({ ...snapshot, notifications: snapshot.notifications.map(n => (n.id === id ? { ...n, read: true } : n)) });
    },

    async markAllNotificationsRead(userId) {
        const snapshot = current();
        commit({ ...snapshot, notifications: snapshot.notifications.map(n => (n.userId === userId ? { ...n, read: true } : n)) });
    },

    async resetDemoData() {
        removeKey(APPLICATIONS_KEY);
        removeKey(NOTIFICATIONS_KEY);
        state = { applications: MOCK_APPLICATIONS, notifications: MOCK_NOTIFICATIONS };
    },

    subscribe(listener) {
        listeners.add(listener);
        // Another tab changed the data, for example a lender acting while a beneficiary watches.
        const onStorage = (event: StorageEvent) => {
            if (event.key === APPLICATIONS_KEY || event.key === NOTIFICATIONS_KEY) {
                state = {
                    applications: readJson<LoanApplication[]>(APPLICATIONS_KEY, MOCK_APPLICATIONS),
                    notifications: readJson<Notification[]>(NOTIFICATIONS_KEY, MOCK_NOTIFICATIONS),
                };
                listener();
            }
        };
        window.addEventListener('storage', onStorage);
        return () => {
            listeners.delete(listener);
            window.removeEventListener('storage', onStorage);
        };
    },
};
