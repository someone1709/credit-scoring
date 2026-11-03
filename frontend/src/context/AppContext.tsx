import React, { useCallback, useEffect, useRef, useState } from 'react';
import type {
    BeneficiaryProfile,
    CreateOfferFormData,
    LenderProfile,
    LoanApplication,
    LoanApplicationFormData,
    Notification,
} from '@/types';
import { MOCK_APPLICATIONS, MOCK_NOTIFICATIONS, blankDocuments } from '@/data/mockData';
import { assessCredit } from '@/lib/assessment';
import { readJson, removeKey, writeJson } from '@/lib/storage';
import * as workflow from '@/lib/workflow';
import type { LenderAction, NoticeDraft, TransitionResult } from '@/lib/workflow';
import { AppContext } from './useApp';

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
function loadInitialState(): { applications: LoanApplication[]; notifications: Notification[] } {
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

export function AppProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState(loadInitialState);
    const { applications, notifications } = state;

    // Transitions read the latest state here, because they can throw and must not run inside a state updater.
    const stateRef = useRef(state);

    const commit = useCallback((next: typeof state) => {
        stateRef.current = next;
        setState(next);
        writeJson(APPLICATIONS_KEY, next.applications);
        writeJson(NOTIFICATIONS_KEY, next.notifications);
    }, []);

    // Another tab changed the data, for example a lender acting while a beneficiary watches.
    useEffect(() => {
        const onStorage = (event: StorageEvent) => {
            if (event.key === APPLICATIONS_KEY || event.key === NOTIFICATIONS_KEY) {
                const next = {
                    applications: readJson<LoanApplication[]>(APPLICATIONS_KEY, MOCK_APPLICATIONS),
                    notifications: readJson<Notification[]>(NOTIFICATIONS_KEY, MOCK_NOTIFICATIONS),
                };
                stateRef.current = next;
                setState(next);
            }
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    const findApplication = useCallback((applicationId: string): LoanApplication => {
        const app = stateRef.current.applications.find(a => a.id === applicationId);
        if (!app) throw new workflow.WorkflowError('This application could not be found.');
        return app;
    }, []);

    const applyTransition = useCallback((result: TransitionResult, now: Date) => {
        const current = stateRef.current;
        commit({
            applications: current.applications.map(a => (a.id === result.app.id ? result.app : a)),
            notifications: [...toNotifications(result.notices, now), ...current.notifications],
        });
    }, [commit]);

    const submitApplication = useCallback((beneficiary: BeneficiaryProfile, data: LoanApplicationFormData, lenders: LenderProfile[]): LoanApplication => {
        if (lenders.length === 0) {
            throw new workflow.WorkflowError('Choose at least one lender to share your application with.');
        }
        const now = new Date();
        const timestamp = now.toISOString();
        const current = stateRef.current;
        const id = uniqueId('LA', new Set(current.applications.map(a => a.id)));
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
            applications: [newApp, ...current.applications],
            notifications: [...toNotifications(notices, now), ...current.notifications],
        });
        return newApp;
    }, [commit]);

    const acceptOffer = useCallback((offerId: string, applicationId: string, beneficiaryId: string) => {
        const now = new Date();
        applyTransition(workflow.acceptOffer(findApplication(applicationId), beneficiaryId, offerId, now), now);
    }, [applyTransition, findApplication]);

    const declineOffer = useCallback((offerId: string, applicationId: string, beneficiaryId: string) => {
        const now = new Date();
        applyTransition(workflow.declineOffer(findApplication(applicationId), beneficiaryId, offerId, now), now);
    }, [applyTransition, findApplication]);

    const uploadDocument = useCallback((applicationId: string, documentId: string, beneficiaryId: string, file: File) => {
        const uploadedAt = new Date();
        // Only the file's details are kept. The contents never leave the browser in this mock.
        const uploaded = workflow.recordDocumentUpload(findApplication(applicationId), beneficiaryId, documentId, file.name, uploadedAt);
        applyTransition({ app: uploaded, notices: [] }, uploadedAt);

        const result = workflow.checkDocumentFile(file);
        window.setTimeout(() => {
            const now = new Date();
            applyTransition(workflow.completeDocumentCheck(findApplication(applicationId), documentId, result, now), now);
        }, DOCUMENT_CHECK_DELAY_MS);
    }, [applyTransition, findApplication]);

    const syncApplicantProfile = useCallback((beneficiary: BeneficiaryProfile) => {
        const current = stateRef.current;
        commit({
            ...current,
            applications: current.applications.map(app => app.beneficiaryId !== beneficiary.id ? app : {
                ...app,
                beneficiaryName: beneficiary.name,
                applicantProfile: { occupation: beneficiary.occupation, city: beneficiary.city, state: beneficiary.state },
            }),
        });
    }, [commit]);

    const updateLenderDecision = useCallback((applicationId: string, lender: LenderProfile, status: LenderAction, note: string | null) => {
        const now = new Date();
        applyTransition(workflow.applyLenderDecision(findApplication(applicationId), lender, status, note, now), now);
    }, [applyTransition, findApplication]);

    const createOffer = useCallback((applicationId: string, lender: LenderProfile, data: CreateOfferFormData) => {
        const now = new Date();
        const taken = new Set(stateRef.current.applications.flatMap(a => a.offers.map(o => o.id)));
        const features = (data.features ?? '').split(',').map(f => f.trim()).filter(Boolean);
        applyTransition(workflow.makeOffer(findApplication(applicationId), lender, { ...data, features }, uniqueId('OFF', taken), now), now);
    }, [applyTransition, findApplication]);

    const withdrawOffer = useCallback((applicationId: string, lender: LenderProfile, offerId: string) => {
        const now = new Date();
        applyTransition(workflow.withdrawOffer(findApplication(applicationId), lender, offerId, now), now);
    }, [applyTransition, findApplication]);

    const advanceDisbursement = useCallback((applicationId: string, lender: LenderProfile) => {
        const now = new Date();
        applyTransition(workflow.advanceDisbursement(findApplication(applicationId), lender.id, now), now);
    }, [applyTransition, findApplication]);

    const markNotificationRead = useCallback((id: string) => {
        const current = stateRef.current;
        commit({ ...current, notifications: current.notifications.map(n => (n.id === id ? { ...n, read: true } : n)) });
    }, [commit]);

    const markAllNotificationsRead = useCallback((userId: string) => {
        const current = stateRef.current;
        commit({ ...current, notifications: current.notifications.map(n => (n.userId === userId ? { ...n, read: true } : n)) });
    }, [commit]);

    const getApplicationsByBeneficiary = useCallback((beneficiaryId: string) =>
        applications.filter(a => a.beneficiaryId === beneficiaryId), [applications]);

    const getApplicationsByLender = useCallback((lenderId: string) =>
        applications.filter(a => workflow.isSharedWithLender(a, lenderId)), [applications]);

    const getBeneficiaryApplication = useCallback((applicationId: string, beneficiaryId: string) =>
        applications.find(a => a.id === applicationId && a.beneficiaryId === beneficiaryId), [applications]);

    const getLenderApplication = useCallback((applicationId: string, lenderId: string) =>
        applications.find(a => a.id === applicationId && workflow.isSharedWithLender(a, lenderId)), [applications]);

    const getOffersByLender = useCallback((lenderId: string) =>
        applications.flatMap(a => a.offers.filter(o => o.lender_id === lenderId)), [applications]);

    const getNotificationsByUser = useCallback((userId: string) =>
        notifications.filter(n => n.userId === userId), [notifications]);

    const resetDemoData = useCallback(() => {
        removeKey(APPLICATIONS_KEY);
        removeKey(NOTIFICATIONS_KEY);
        const fresh = { applications: MOCK_APPLICATIONS, notifications: MOCK_NOTIFICATIONS };
        stateRef.current = fresh;
        setState(fresh);
    }, []);

    return (
        <AppContext.Provider value={{
            applications, notifications,
            submitApplication, acceptOffer, declineOffer, uploadDocument, syncApplicantProfile,
            updateLenderDecision, createOffer, withdrawOffer, advanceDisbursement,
            markNotificationRead, markAllNotificationsRead,
            getApplicationsByBeneficiary, getApplicationsByLender,
            getBeneficiaryApplication, getLenderApplication,
            getOffersByLender, getNotificationsByUser,
            resetDemoData,
        }}>
            {children}
        </AppContext.Provider>
    );
}
