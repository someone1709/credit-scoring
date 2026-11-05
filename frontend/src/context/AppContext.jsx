import { useCallback, useEffect, useRef, useState } from 'react';
import { isSharedWithLender } from '@/lib/workflow';
import { appService } from '@/services/app';
import { toApiError } from '@/services/http';
import { useAuth } from './useAuth';
import { AppContext } from './useApp';

const EMPTY = { applications: [], notifications: [] };

export function AppProvider({ children }) {
    const { user } = useAuth();
    const userId = user?.profile.id ?? null;

    // Everything loaded is tagged with its owner, so one user's data can never show for another.
    const [loaded, setLoaded] = useState(null);
    const [failure, setFailure] = useState(null);

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

    const reload = useCallback(async () => {
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
    const perform = useCallback(async (action) => {
        const result = await action();
        await reload().catch(() => undefined);
        return result;
    }, [reload]);

    const submitApplication = useCallback((beneficiary, data, lenderIds) =>
        perform(() => appService.submitApplication(beneficiary, data, lenderIds)), [perform]);

    const acceptOffer = useCallback((offerId, applicationId, beneficiaryId) =>
        perform(() => appService.acceptOffer(offerId, applicationId, beneficiaryId)), [perform]);

    const declineOffer = useCallback((offerId, applicationId, beneficiaryId) =>
        perform(() => appService.declineOffer(offerId, applicationId, beneficiaryId)), [perform]);

    const uploadDocument = useCallback((applicationId, documentId, beneficiaryId, file) =>
        perform(() => appService.uploadDocument(applicationId, documentId, beneficiaryId, file)), [perform]);

    const deleteDocument = useCallback((applicationId, documentId, beneficiaryId) =>
        perform(() => appService.deleteDocument(applicationId, documentId, beneficiaryId)), [perform]);

    const revokeLender = useCallback((applicationId, lenderId, beneficiaryId) =>
        perform(() => appService.revokeLender(applicationId, lenderId, beneficiaryId)), [perform]);

    const replyToLender = useCallback((applicationId, lenderId, beneficiaryId, message) =>
        perform(() => appService.replyToLender(applicationId, lenderId, beneficiaryId, message)), [perform]);

    const syncApplicantProfile = useCallback((beneficiary) =>
        perform(() => appService.syncApplicantProfile(beneficiary)), [perform]);

    const updateLenderDecision = useCallback((applicationId, lender, status, note) =>
        perform(() => appService.updateLenderDecision(applicationId, lender, status, note)), [perform]);

    const createOffer = useCallback((applicationId, lender, data) =>
        perform(() => appService.createOffer(applicationId, lender, data)), [perform]);

    const withdrawOffer = useCallback((applicationId, lender, offerId) =>
        perform(() => appService.withdrawOffer(applicationId, lender, offerId)), [perform]);

    const advanceDisbursement = useCallback((applicationId, lender) =>
        perform(() => appService.advanceDisbursement(applicationId, lender)), [perform]);

    // Marking as read shouldn't make anyone wait, so it updates the screen first.
    const markNotificationRead = useCallback((id) => {
        setLoaded(current => current && { ...current, data: { ...current.data, notifications: current.data.notifications.map(n => (n.id === id ? { ...n, read: true } : n)) } });
        appService.markNotificationRead(id).catch(() => refreshQuietly());
    }, [refreshQuietly]);

    const markAllNotificationsRead = useCallback((targetUserId) => {
        setLoaded(current => current && { ...current, data: { ...current.data, notifications: current.data.notifications.map(n => (n.userId === targetUserId ? { ...n, read: true } : n)) } });
        appService.markAllNotificationsRead(targetUserId).catch(() => refreshQuietly());
    }, [refreshQuietly]);

    const getApplicationsByBeneficiary = useCallback((beneficiaryId) =>
        applications.filter(a => a.beneficiaryId === beneficiaryId), [applications]);

    const getApplicationsByLender = useCallback((lenderId) =>
        applications.filter(a => isSharedWithLender(a, lenderId)), [applications]);

    const getBeneficiaryApplication = useCallback((applicationId, beneficiaryId) =>
        applications.find(a => a.id === applicationId && a.beneficiaryId === beneficiaryId), [applications]);

    const getLenderApplication = useCallback((applicationId, lenderId) =>
        applications.find(a => a.id === applicationId && isSharedWithLender(a, lenderId)), [applications]);

    const getOffersByLender = useCallback((lenderId) =>
        applications.filter(a => isSharedWithLender(a, lenderId)).flatMap(a => a.offers.filter(o => o.lender_id === lenderId)), [applications]);

    const getNotificationsByUser = useCallback((targetUserId) =>
        notifications.filter(n => n.userId === targetUserId), [notifications]);

    const resetDemoData = useCallback(() => perform(() => appService.resetDemoData()), [perform]);

    return (
        <AppContext.Provider value={{
            applications, notifications, loading, loadError, retryLoad: firstLoad,
            listLenders: appService.listLenders,
            fetchDocumentFile: appService.fetchDocumentFile,
            submitApplication, acceptOffer, declineOffer, uploadDocument, deleteDocument, revokeLender, replyToLender, syncApplicantProfile,
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
