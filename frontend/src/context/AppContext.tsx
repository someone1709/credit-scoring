import React, {
    createContext,
    useContext,
    useState,
    useCallback,
} from 'react';
import type {
    LoanApplication,
    LoanOffer,
    Notification,
    LenderDecision,
    LenderDecisionStatus,
    OfferStatus,
    Document,
    VerificationStatus,
    CreateOfferFormData,
    LoanApplicationFormData,
    ApplicationStatus,
} from '@/types';
import {
    MOCK_APPLICATIONS,
    MOCK_NOTIFICATIONS,
    MOCK_OFFERS,
    MOCK_LENDERS,
} from '@/data/mockData';

interface AppContextValue {
    applications: LoanApplication[];
    notifications: Notification[];

    // Beneficiary actions
    submitApplication: (beneficiaryId: string, beneficiaryName: string, data: LoanApplicationFormData) => LoanApplication;
    acceptOffer: (offerId: string, applicationId: string) => void;
    declineOffer: (offerId: string) => void;
    uploadDocument: (appId: string, docId: string, filename: string) => void;

    // Lender actions
    updateLenderDecision: (applicationId: string, lenderId: string, lenderName: string, status: LenderDecisionStatus, note?: string) => void;
    createOffer: (applicationId: string, lenderId: string, data: CreateOfferFormData) => void;

    // Notifications
    markNotificationRead: (id: string) => void;
    markAllNotificationsRead: (userId: string) => void;

    // Derived
    getApplicationsByBeneficiary: (beneficiaryId: string) => LoanApplication[];
    getApplicationsByLender: (lenderId: string) => LoanApplication[];
    getOffersByLender: (lenderId: string) => LoanOffer[];
    getNotificationsByUser: (userId: string) => Notification[];
}

const AppContext = createContext<AppContextValue | null>(null);

function generateAssessment(data: LoanApplicationFormData, beneficiaryId: string) {
    const dti = (data.existing_emi / data.monthly_income) * 100;
    const eir = (data.monthly_expenses / data.monthly_income) * 100;
    const surplus = data.monthly_income - data.monthly_expenses - data.existing_emi;
    const isThinFile = data.repayment_history === 'none';

    let riskScore = 30;
    if (dti > 40) riskScore += 25;
    else if (dti > 25) riskScore += 15;
    else if (dti > 10) riskScore += 8;

    if (eir > 70) riskScore += 20;
    else if (eir > 50) riskScore += 10;
    else if (eir > 35) riskScore += 5;

    if (data.repayment_history === 'poor') riskScore += 20;
    else if (data.repayment_history === 'average') riskScore += 8;
    else if (data.repayment_history === 'none') riskScore += 5;
    else if (data.repayment_history === 'good') riskScore -= 5;

    if (surplus < 2000) riskScore += 10;
    else if (surplus > 10000) riskScore -= 5;

    riskScore = Math.max(5, Math.min(95, riskScore));
    const compositeScore = Math.max(5, Math.min(95, 100 - riskScore + (Math.random() * 4 - 2)));
    const pod = riskScore / 100 - 0.05 + (Math.random() * 0.05);

    const riskCategory = riskScore <= 30 ? 'LOW' : riskScore <= 60 ? 'MEDIUM' : 'HIGH';
    const incomeBracket =
        data.monthly_income >= 50000 ? 'HIGH_INCOME' :
            data.monthly_income >= 25000 ? 'MID_INCOME' : 'LOW_INCOME';

    let segment: LoanApplication['assessment'] extends infer T ? T extends null ? never : T extends { segment: infer S } ? S : never : never = 'STANDARD';
    if (compositeScore >= 75 && incomeBracket === 'HIGH_INCOME') segment = 'PRIME';
    else if (compositeScore >= 70) segment = 'STANDARD_PLUS';
    else if (compositeScore >= 55 && incomeBracket === 'LOW_INCOME') segment = 'LOW_INCOME_PRIME';
    else if (compositeScore >= 45) segment = 'STANDARD';
    else if (compositeScore >= 30) segment = 'SUBPRIME';
    else segment = 'HIGH_RISK';

    const explanations: string[] = [
        `Monthly income of ₹${data.monthly_income.toLocaleString('en-IN')} is available for assessment.`,
        `Debt-to-income ratio is ${dti.toFixed(1)}%.`,
        `Expense-to-income ratio is ${eir.toFixed(1)}%.`,
        `Monthly surplus after expenses and EMI is approximately ₹${surplus.toLocaleString('en-IN')}.`,
    ];
    if (isThinFile) {
        explanations.push('No repayment history on record — applicant may be a first-time borrower. No history is not equivalent to poor repayment behaviour.');
    } else {
        explanations.push(`Repayment history is reported as ${data.repayment_history}.`);
    }

    return {
        beneficiary_id: beneficiaryId,
        risk_score: Math.round(riskScore),
        risk_category: riskCategory as 'LOW' | 'MEDIUM' | 'HIGH',
        probability_of_default: parseFloat(Math.max(0.02, Math.min(0.95, pod)).toFixed(2)),
        model_confidence: null,
        income_bracket: incomeBracket as 'LOW_INCOME' | 'MID_INCOME' | 'HIGH_INCOME',
        composite_score: Math.round(compositeScore),
        segment: segment as LoanApplication['assessment'] extends infer T ? T extends null ? never : T extends { segment: infer S } ? S : never : never,
        is_thin_file: isThinFile,
        explanations,
        explanation_method: 'RULE_BASED' as const,
        verification_status: 'DEMO_UNVERIFIED' as const,
    };
}

export function AppProvider({ children }: { children: React.ReactNode }) {
    const [applications, setApplications] = useState<LoanApplication[]>(MOCK_APPLICATIONS);
    const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS);

    const submitApplication = useCallback((beneficiaryId: string, beneficiaryName: string, data: LoanApplicationFormData): LoanApplication => {
        const id = `LA${Date.now().toString().slice(-4)}`;
        const assessment = generateAssessment(data, beneficiaryId);

        const defaultDocs: Document[] = [
            { id: `${id}-DOC1`, applicationId: id, beneficiaryId, type: 'AADHAAR_CARD', label: 'Aadhaar Card', filename: null, uploadedAt: null, verification_status: 'NOT_PROVIDED', checkNote: null },
            { id: `${id}-DOC2`, applicationId: id, beneficiaryId, type: 'PAN_CARD', label: 'PAN Card', filename: null, uploadedAt: null, verification_status: 'NOT_PROVIDED', checkNote: null },
            { id: `${id}-DOC3`, applicationId: id, beneficiaryId, type: 'INCOME_PROOF', label: 'Income Proof', filename: null, uploadedAt: null, verification_status: 'NOT_PROVIDED', checkNote: null },
            { id: `${id}-DOC4`, applicationId: id, beneficiaryId, type: 'BANK_STATEMENT', label: 'Bank Statement', filename: null, uploadedAt: null, verification_status: 'NOT_PROVIDED', checkNote: null },
        ];

        const defaultDecisions: LenderDecision[] = MOCK_LENDERS.slice(0, 2).map(l => ({
            lenderId: l.id,
            lenderName: l.name,
            applicationId: id,
            status: 'PENDING' as LenderDecisionStatus,
            lastUpdated: new Date().toISOString(),
            note: null,
        }));

        const newApp: LoanApplication = {
            id,
            beneficiaryId,
            beneficiaryName,
            ...data,
            electricity_usage: data.electricity_usage ?? null,
            status: 'SUBMITTED',
            submittedAt: new Date().toISOString(),
            lastUpdatedAt: new Date().toISOString(),
            assessment,
            documents: defaultDocs,
            lenderDecisions: defaultDecisions,
            offers: [],
            disbursementSteps: [],
        };

        setApplications(prev => [newApp, ...prev]);

        // Add notification
        const notif: Notification = {
            id: `NOTIF${Date.now()}`,
            userId: beneficiaryId,
            userRole: 'beneficiary',
            title: 'Application Submitted',
            message: `Your loan application #${id} has been submitted successfully.`,
            type: 'success',
            read: false,
            createdAt: new Date().toISOString(),
        };
        setNotifications(prev => [notif, ...prev]);

        return newApp;
    }, []);

    const acceptOffer = useCallback((offerId: string, applicationId: string) => {
        setApplications(prev => prev.map(app => {
            if (app.id !== applicationId) return app;
            const updatedOffers = app.offers.map(o => ({
                ...o,
                status: (o.id === offerId ? 'ACCEPTED' : o.status === 'PENDING' ? 'DECLINED' : o.status) as OfferStatus,
            }));
            const disbursementSteps = [
                { label: 'Offer Accepted', status: 'completed' as const, date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) },
                { label: 'Agreement Signed', status: 'current' as const, date: null },
                { label: 'Verification Complete', status: 'pending' as const, date: null },
                { label: 'Disbursement Initiated', status: 'pending' as const, date: null },
                { label: 'Amount Credited (Simulated)', status: 'pending' as const, date: null },
            ];
            return { ...app, offers: updatedOffers, status: 'OFFER_ACCEPTED' as ApplicationStatus, disbursementSteps, lastUpdatedAt: new Date().toISOString() };
        }));
    }, []);

    const declineOffer = useCallback((offerId: string) => {
        setApplications(prev => prev.map(app => ({
            ...app,
            offers: app.offers.map(o => o.id === offerId ? { ...o, status: 'DECLINED' as OfferStatus } : o),
        })));
    }, []);

    const uploadDocument = useCallback((appId: string, docId: string, filename: string) => {
        setApplications(prev => prev.map(app => {
            if (app.id !== appId) return app;
            const updatedDocs = app.documents.map(d => {
                if (d.id !== docId) return d;
                const status: VerificationStatus = 'DOCUMENT_UPLOADED';
                return { ...d, filename, uploadedAt: new Date().toISOString(), verification_status: status, checkNote: 'Awaiting basic checks. [DEMO]' };
            });
            // Simulate check passing after a brief delay via state update:
            setTimeout(() => {
                setApplications(inner => inner.map(a => {
                    if (a.id !== appId) return a;
                    return {
                        ...a,
                        documents: a.documents.map(d => d.id === docId ? { ...d, verification_status: 'CHECKS_PASSED' as VerificationStatus, checkNote: 'File format checks passed. Demo — not government-verified.' } : d),
                    };
                }));
            }, 2000);
            return { ...app, documents: updatedDocs };
        }));
    }, []);

    const updateLenderDecision = useCallback((applicationId: string, lenderId: string, lenderName: string, status: LenderDecisionStatus, note?: string) => {
        setApplications(prev => prev.map(app => {
            if (app.id !== applicationId) return app;
            const existing = app.lenderDecisions.find(d => d.lenderId === lenderId);
            let updatedDecisions: LenderDecision[];
            if (existing) {
                updatedDecisions = app.lenderDecisions.map(d =>
                    d.lenderId === lenderId ? { ...d, status, note: note || d.note, lastUpdated: new Date().toISOString() } : d
                );
            } else {
                updatedDecisions = [...app.lenderDecisions, {
                    lenderId, lenderName, applicationId, status,
                    lastUpdated: new Date().toISOString(),
                    note: note || null,
                }];
            }

            // Recalculate aggregated status
            const allStatuses = updatedDecisions.map(d => d.status);
            let newAppStatus: ApplicationStatus = app.status;
            if (allStatuses.some(s => s === 'OFFER_MADE') && app.status !== 'OFFER_ACCEPTED' && app.status !== 'DISBURSED') {
                newAppStatus = 'OFFERS_AVAILABLE';
            } else if (allStatuses.every(s => s === 'REJECTED')) {
                newAppStatus = 'REJECTED';
            } else if (app.status === 'SUBMITTED' && allStatuses.some(s => s === 'UNDER_REVIEW' || s === 'INFO_REQUESTED')) {
                newAppStatus = 'UNDER_REVIEW';
            }

            return { ...app, lenderDecisions: updatedDecisions, status: newAppStatus, lastUpdatedAt: new Date().toISOString() };
        }));
    }, []);

    const createOffer = useCallback((applicationId: string, lenderId: string, data: CreateOfferFormData) => {
        const lender = MOCK_LENDERS.find(l => l.id === lenderId)!;
        const newOffer: LoanOffer = {
            id: `OFF${Date.now()}`,
            lender_id: lenderId,
            lenderName: lender.name,
            lenderLogoInitials: lender.logoInitials,
            lenderLogoColor: lender.logoColor,
            applicationId,
            beneficiaryId: applications.find(a => a.id === applicationId)?.beneficiaryId || '',
            amount: data.amount,
            interest_rate: data.interest_rate,
            tenure_months: data.tenure_months,
            status: 'PENDING',
            features: data.features.split(',').map(f => f.trim()).filter(Boolean),
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        };

        setApplications(prev => prev.map(app => {
            if (app.id !== applicationId) return app;
            const existingOffer = app.offers.find(o => o.lender_id === lenderId && o.status === 'PENDING');
            const offers = existingOffer
                ? app.offers.map(o => o.id === existingOffer.id ? newOffer : o)
                : [...app.offers, newOffer];
            return { ...app, offers };
        }));

        updateLenderDecision(applicationId, lenderId, lender.name, 'OFFER_MADE', `Offer created: ₹${data.amount.toLocaleString('en-IN')} at ${data.interest_rate}% for ${data.tenure_months} months.`);
    }, [applications, updateLenderDecision]);

    const markNotificationRead = useCallback((id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    }, []);

    const markAllNotificationsRead = useCallback((userId: string) => {
        setNotifications(prev => prev.map(n => n.userId === userId ? { ...n, read: true } : n));
    }, []);

    const getApplicationsByBeneficiary = useCallback((beneficiaryId: string) =>
        applications.filter(a => a.beneficiaryId === beneficiaryId), [applications]);

    const getApplicationsByLender = useCallback((lenderId: string) =>
        applications.filter(a => a.lenderDecisions.some(d => d.lenderId === lenderId)), [applications]);

    const getOffersByLender = useCallback((lenderId: string): LoanOffer[] =>
        applications.flatMap(a => a.offers.filter(o => o.lender_id === lenderId)), [applications]);

    const getNotificationsByUser = useCallback((userId: string) =>
        notifications.filter(n => n.userId === userId), [notifications]);

    return (
        <AppContext.Provider value={{
            applications, notifications,
            submitApplication, acceptOffer, declineOffer, uploadDocument,
            updateLenderDecision, createOffer,
            markNotificationRead, markAllNotificationsRead,
            getApplicationsByBeneficiary, getApplicationsByLender,
            getOffersByLender, getNotificationsByUser,
        }}>
            {children}
        </AppContext.Provider>
    );
}

export function useApp() {
    const ctx = useContext(AppContext);
    if (!ctx) throw new Error('useApp must be inside AppProvider');
    return ctx;
}

// Re-export MOCK_OFFERS for convenience
export { MOCK_OFFERS };
