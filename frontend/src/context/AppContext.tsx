import React, { useCallback, useEffect, useRef, useState } from 'react';
import type {
    BeneficiaryProfile,
    CreateOfferFormData,
    LenderProfile,
    LoanApplicationFormData,
} from '@/types';
import type { AppSnapshot } from '@/types/appService';
import { isSharedWithLender } from '@/lib/workflow';
import type { LenderAction } from '@/lib/workflow';
import { appService } from '@/services/app';
import { toApiError } from '@/services/http';
import { useAuth } from './useAuth';
import { AppContext } from './useApp';

const EMPTY: AppSnapshot = { applications: [], notifications: [] };

export function AppProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const userId = user?.profile.id ?? null;

    // Everything loaded is tagged with its owner, so one user's data can never show for another.
    const [loaded, setLoaded] = useState<{ userId: string; data: AppSnapshot } | null>(null);
    const [failure, setFailure] = useState<{ userId: string; message: string } | null>(null);

    const snapshot = loaded?.userId === userId ? loaded.data : EMPTY;
    const loadError = failure?.userId === userId ? failure.message : null;
    const loading = userId !== null && loaded?.userId !== userId && loadError === null;
    const { applications, notifications } = snapshot;

    // Lets callbacks read the latest user, and drops a response that arrives after the user changed.
    const userRef = useRef(user);
    const requestRef = useRef(0);
    useEffect(() => {
        userRef.current = user;
    }, [user]);

    const reload = useCallback(async (): Promise<void> => {
        const currentUser = userRef.current;
        if (!currentUser) return;
        const request = ++requestRef.current;
        const data = await appService.load(currentUser);
        if (request !== requestRef.current) return;
        setLoaded({ userId: currentUser.profile.id, data });
        setFailure(null);
    }, []);

    const firstLoad = useCallback(() => {
        const id = userRef.current?.profile.id;
        reload().catch(error => {
            if (id) setFailure({ userId: id, message: toApiError(error).message });
        });
    }, [reload]);

    useEffect(() => {
        requestRef.current++;
        if (userId !== null) firstLoad();
    }, [userId, firstLoad]);

    // Background refreshes keep what's on screen if they fail. The next one can succeed.
    const refreshQuietly = useCallback(() => {
        reload().catch(() => undefined);
    }, [reload]);

    useEffect(() => {
        if (userId === null) return;
        return appService.subscribe(refreshQuietly);
    }, [userId, refreshQuietly]);

    /** Runs a change, then shows the result. A failure reaches the page; a failed refresh doesn't undo a success. */
    const perform = useCallback(async <T,>(action: () => Promise<T>): Promise<T> => {
        const result = await action();
        await reload().catch(() => undefined);
        return result;
    }, [reload]);

    const submitApplication = useCallback((beneficiary: BeneficiaryProfile, data: LoanApplicationFormData, lenderIds: string[]) =>
        perform(() => appService.submitApplication(beneficiary, data, lenderIds)), [perform]);

    const acceptOffer = useCallback((offerId: string, applicationId: string, beneficiaryId: string) =>
        perform(() => appService.acceptOffer(offerId, applicationId, beneficiaryId)), [perform]);

    const declineOffer = useCallback((offerId: string, applicationId: string, beneficiaryId: string) =>
        perform(() => appService.declineOffer(offerId, applicationId, beneficiaryId)), [perform]);

    const uploadDocument = useCallback((applicationId: string, documentId: string, beneficiaryId: string, file: File) =>
        perform(() => appService.uploadDocument(applicationId, documentId, beneficiaryId, file)), [perform]);

    const syncApplicantProfile = useCallback((beneficiary: BeneficiaryProfile) =>
        perform(() => appService.syncApplicantProfile(beneficiary)), [perform]);

    const updateLenderDecision = useCallback((applicationId: string, lender: LenderProfile, status: LenderAction, note: string | null) =>
        perform(() => appService.updateLenderDecision(applicationId, lender, status, note)), [perform]);

    const createOffer = useCallback((applicationId: string, lender: LenderProfile, data: CreateOfferFormData) =>
        perform(() => appService.createOffer(applicationId, lender, data)), [perform]);

    const withdrawOffer = useCallback((applicationId: string, lender: LenderProfile, offerId: string) =>
        perform(() => appService.withdrawOffer(applicationId, lender, offerId)), [perform]);

    const advanceDisbursement = useCallback((applicationId: string, lender: LenderProfile) =>
        perform(() => appService.advanceDisbursement(applicationId, lender)), [perform]);

    // Marking as read shouldn't make anyone wait, so it updates the screen first.
    const markNotificationRead = useCallback((id: string) => {
        setLoaded(current => current && { ...current, data: { ...current.data, notifications: current.data.notifications.map(n => (n.id === id ? { ...n, read: true } : n)) } });
        appService.markNotificationRead(id).catch(() => refreshQuietly());
    }, [refreshQuietly]);

    const markAllNotificationsRead = useCallback((targetUserId: string) => {
        setLoaded(current => current && { ...current, data: { ...current.data, notifications: current.data.notifications.map(n => (n.userId === targetUserId ? { ...n, read: true } : n)) } });
        appService.markAllNotificationsRead(targetUserId).catch(() => refreshQuietly());
    }, [refreshQuietly]);

    const getApplicationsByBeneficiary = useCallback((beneficiaryId: string) =>
        applications.filter(a => a.beneficiaryId === beneficiaryId), [applications]);

    const getApplicationsByLender = useCallback((lenderId: string) =>
        applications.filter(a => isSharedWithLender(a, lenderId)), [applications]);

    const getBeneficiaryApplication = useCallback((applicationId: string, beneficiaryId: string) =>
        applications.find(a => a.id === applicationId && a.beneficiaryId === beneficiaryId), [applications]);

    const getLenderApplication = useCallback((applicationId: string, lenderId: string) =>
        applications.find(a => a.id === applicationId && isSharedWithLender(a, lenderId)), [applications]);

    const getOffersByLender = useCallback((lenderId: string) =>
        applications.flatMap(a => a.offers.filter(o => o.lender_id === lenderId)), [applications]);

    const getNotificationsByUser = useCallback((targetUserId: string) =>
        notifications.filter(n => n.userId === targetUserId), [notifications]);

    const resetDemoData = useCallback(() => perform(() => appService.resetDemoData()), [perform]);

    return (
        <AppContext.Provider value={{
            applications, notifications, loading, loadError, retryLoad: firstLoad,
            listLenders: appService.listLenders,
            fetchDocumentFile: appService.fetchDocumentFile,
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
