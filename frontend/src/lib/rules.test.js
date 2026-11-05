// The project's non-negotiable rules, run with: npm test
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MOCK_APPLICATIONS, MOCK_NOTIFICATIONS, blankDocuments } from '../data/mockData.js';
import { assessCredit, incomeBracketFor } from './assessment.js';
import { calculateEmi, repaymentSchedule, totalRepayable } from './finance.js';
import {
    WorkflowError,
    acceptOffer,
    advanceDisbursement,
    applyLenderDecision,
    canDeleteDocument,
    canRevokeLender,
    canUploadDocuments,
    checkDocumentFile,
    completeDocumentCheck,
    declineOffer,
    deleteDocument,
    deriveApplicationStatus,
    deriveVerificationStatus,
    expireOffers,
    makeOffer,
    recordDocumentUpload,
    replyToLender,
    revokeLender,
    withdrawOffer,
    workflowStep,
} from './workflow.js';

const NOW = new Date('2026-11-03T10:00:00Z');

const baseRequest = {
    beneficiary_id: 'BEN',
    monthly_income: 30000,
    monthly_expenses: 12000,
    existing_emi: 1000,
    loan_amount: 50000,
    repayment_history: 'good',
    electricity_usage: null,
};

function lender(id) {
    return { id, name: `Lender ${id}`, contactPerson: 'A', email: `${id}@x.test`, phone: '1', licenseNumber: 'L', logoInitials: 'LX', logoColor: '#000' };
}

const A = lender('A');
const B = lender('B');
const C = lender('C');

function application(lenders = [A, B]) {
    return {
        id: 'APP',
        beneficiaryId: 'BEN',
        beneficiaryName: 'Test Person',
        applicantProfile: { occupation: 'Job', city: 'City', state: 'State' },
        consentGivenAt: NOW.toISOString(),
        monthly_income: 30000,
        monthly_expenses: 12000,
        existing_emi: 1000,
        loan_amount: 50000,
        loan_purpose: 'Personal',
        tenure_months: 12,
        repayment_history: 'none',
        electricity_usage: null,
        status: 'SUBMITTED',
        submittedAt: NOW.toISOString(),
        lastUpdatedAt: NOW.toISOString(),
        assessment: assessCredit(baseRequest, 'NOT_PROVIDED'),
        documents: blankDocuments('APP', 'BEN'),
        lenderDecisions: lenders.map(l => ({ lenderId: l.id, lenderName: l.name, applicationId: 'APP', status: 'PENDING', lastUpdated: NOW.toISOString(), note: null })),
        offers: [],
        disbursementSteps: [],
    };
}

const terms = { amount: 40000, interest_rate: 12, tenure_months: 12, features: [] };

describe('credit assessment', () => {
    it('never adds risk for having no repayment history', () => {
        const none = assessCredit({ ...baseRequest, repayment_history: 'none' }, 'NOT_PROVIDED');
        const average = assessCredit({ ...baseRequest, repayment_history: 'average' }, 'NOT_PROVIDED');
        const poor = assessCredit({ ...baseRequest, repayment_history: 'poor' }, 'NOT_PROVIDED');
        const good = assessCredit({ ...baseRequest, repayment_history: 'good' }, 'NOT_PROVIDED');
        assert.ok(none.risk_score < average.risk_score);
        assert.ok(none.risk_score < poor.risk_score);
        // Only good history lowers risk, by its own 5 points. None stays at the neutral baseline.
        assert.equal(none.risk_score, good.risk_score + 5);
        assert.equal(none.is_thin_file, true);
        assert.equal(good.is_thin_file, false);
    });

    it('never fabricates probability or confidence', () => {
        const result = assessCredit(baseRequest, 'NOT_PROVIDED');
        assert.equal(result.probability_of_default, null);
        assert.equal(result.model_confidence, null);
        assert.equal(result.explanation_method, 'RULE_BASED');
    });

    it('gives the same result every time', () => {
        assert.deepEqual(assessCredit(baseRequest, 'NOT_PROVIDED'), assessCredit(baseRequest, 'NOT_PROVIDED'));
    });

    it('keeps composite a separate measure, not just the inverse of risk', () => {
        const result = assessCredit(baseRequest, 'NOT_PROVIDED');
        assert.notEqual(result.composite_score, 100 - result.risk_score);
    });

    it('moves risk and composite in opposite directions as finances worsen', () => {
        const healthy = assessCredit(baseRequest, 'NOT_PROVIDED');
        const stretched = assessCredit({ ...baseRequest, monthly_expenses: 25000, existing_emi: 6000 }, 'NOT_PROVIDED');
        assert.ok(stretched.risk_score > healthy.risk_score);
        assert.ok(stretched.composite_score < healthy.composite_score);
    });

    it('takes the requested amount into account', () => {
        const small = assessCredit(baseRequest, 'NOT_PROVIDED');
        const huge = assessCredit({ ...baseRequest, loan_amount: 5000000 }, 'NOT_PROVIDED');
        assert.ok(huge.risk_score > small.risk_score);
    });

    it("doesn't let electricity usage change the score", () => {
        const without = assessCredit(baseRequest, 'NOT_PROVIDED');
        const low = assessCredit({ ...baseRequest, electricity_usage: 10 }, 'NOT_PROVIDED');
        const high = assessCredit({ ...baseRequest, electricity_usage: 900 }, 'NOT_PROVIDED');
        assert.equal(without.risk_score, low.risk_score);
        assert.equal(low.risk_score, high.risk_score);
        assert.equal(without.composite_score, high.composite_score);
    });

    it('labels a strong low-income profile LOW_INCOME_PRIME', () => {
        const result = assessCredit({ ...baseRequest, monthly_income: 24000, monthly_expenses: 9000, existing_emi: 0, loan_amount: 40000, repayment_history: 'none' }, 'NOT_PROVIDED');
        assert.equal(result.income_bracket, 'LOW_INCOME');
        assert.equal(result.segment, 'LOW_INCOME_PRIME');
    });

    it('reports unknown income as UNKNOWN', () => {
        assert.equal(incomeBracketFor(null), 'UNKNOWN');
        assert.equal(incomeBracketFor(0), 'UNKNOWN');
    });
});

describe('finance', () => {
    it('calculates a known EMI', () => {
        assert.equal(calculateEmi(100000, 12, 12), 8885);
    });

    it('handles a 0% rate without breaking', () => {
        assert.equal(calculateEmi(12000, 0, 12), 1000);
        assert.equal(totalRepayable(12000, 0, 12), 12000);
    });

    it('builds a schedule that repays exactly the principal', () => {
        const rows = repaymentSchedule(75000, 12.5, 24);
        assert.equal(rows.length, 24);
        assert.equal(rows.at(-1)?.balance, 0);
        assert.equal(rows.reduce((sum, row) => sum + row.principal, 0), 75000);
    });
});

describe('independent lender decisions', () => {
    it("doesn't reject the application when one lender rejects", () => {
        const { app, notices } = applyLenderDecision(application(), A, 'REJECTED', 'No', NOW);
        assert.equal(app.status, 'UNDER_REVIEW');
        assert.equal(app.lenderDecisions.find(d => d.lenderId === 'B')?.status, 'PENDING');
        assert.equal(notices[0].title, 'One Lender Declined');
    });

    it('rejects the application only when every lender has rejected', () => {
        const first = applyLenderDecision(application(), A, 'REJECTED', null, NOW).app;
        const { app, notices } = applyLenderDecision(first, B, 'REJECTED', null, NOW);
        assert.equal(app.status, 'REJECTED');
        assert.equal(notices[0].title, 'Application Rejected');
    });

    it('stops a lender the application was not shared with', () => {
        assert.throws(() => applyLenderDecision(application(), C, 'UNDER_REVIEW', null, NOW), WorkflowError);
        assert.throws(() => makeOffer(application(), C, terms, 'O1', NOW), WorkflowError);
    });

    it('needs a note to request information, and asks for documents when it has one', () => {
        assert.throws(() => applyLenderDecision(application(), A, 'INFO_REQUESTED', '   ', NOW), WorkflowError);
        const { app } = applyLenderDecision(application(), A, 'INFO_REQUESTED', 'Need bank statement', NOW);
        assert.equal(app.status, 'DOCUMENTS_REQUIRED');
    });

    it("doesn't carry an old note over to a new decision", () => {
        const asked = applyLenderDecision(application(), A, 'INFO_REQUESTED', 'Need more', NOW).app;
        const { app } = applyLenderDecision(asked, A, 'UNDER_REVIEW', null, NOW);
        assert.equal(app.lenderDecisions.find(d => d.lenderId === 'A')?.note, null);
    });
});

describe('offers', () => {
    const withOffers = () => {
        const one = makeOffer(application(), A, terms, 'O1', NOW).app;
        return makeOffer(one, B, { ...terms, interest_rate: 10 }, 'O2', NOW).app;
    };

    it('shows offers as available', () => {
        assert.equal(withOffers().status, 'OFFERS_AVAILABLE');
    });

    it('accepts one offer, declines the rest and tells the other lender nothing about the winner', () => {
        const { app, notices } = acceptOffer(withOffers(), 'BEN', 'O2', NOW);
        assert.equal(app.status, 'OFFER_ACCEPTED');
        assert.equal(app.offers.find(o => o.id === 'O2')?.status, 'ACCEPTED');
        assert.equal(app.offers.find(o => o.id === 'O1')?.status, 'DECLINED');
        const toLoser = notices.find(n => n.userId === 'A');
        assert.ok(toLoser);
        assert.ok(!toLoser.message.includes(B.name));
    });

    it('closes the application to every lender once an offer is accepted', () => {
        const { app } = acceptOffer(withOffers(), 'BEN', 'O2', NOW);
        assert.throws(() => applyLenderDecision(app, A, 'UNDER_REVIEW', null, NOW), WorkflowError);
        assert.throws(() => applyLenderDecision(app, B, 'REJECTED', null, NOW), WorkflowError);
        assert.throws(() => makeOffer(app, A, terms, 'O3', NOW), WorkflowError);
    });

    it("stops a beneficiary acting on someone else's offer", () => {
        assert.throws(() => acceptOffer(withOffers(), 'OTHER', 'O1', NOW), WorkflowError);
        assert.throws(() => declineOffer(withOffers(), 'OTHER', 'O1', NOW), WorkflowError);
    });

    it('moves the status back when the last live offer is declined', () => {
        const single = makeOffer(application(), A, terms, 'O1', NOW).app;
        const { app } = declineOffer(single, 'BEN', 'O1', NOW);
        assert.equal(app.status, 'UNDER_REVIEW');
        assert.equal(app.lenderDecisions.find(d => d.lenderId === 'A')?.status, 'UNDER_REVIEW');
    });

    it('keeps showing offers while another one is still live', () => {
        const { app } = declineOffer(withOffers(), 'BEN', 'O1', NOW);
        assert.equal(app.status, 'OFFERS_AVAILABLE');
    });

    it('lets a lender withdraw only its own offer', () => {
        assert.throws(() => withdrawOffer(withOffers(), A, 'O2', NOW), WorkflowError);
        const { app } = withdrawOffer(withOffers(), A, 'O1', NOW);
        assert.equal(app.offers.find(o => o.id === 'O1')?.status, 'WITHDRAWN');
        assert.equal(app.offers.find(o => o.id === 'O2')?.status, 'PENDING');
    });

    it('withdraws only that lender\'s offer when it rejects', () => {
        const { app } = applyLenderDecision(withOffers(), A, 'REJECTED', null, NOW);
        assert.equal(app.offers.find(o => o.id === 'O1')?.status, 'WITHDRAWN');
        assert.equal(app.offers.find(o => o.id === 'O2')?.status, 'PENDING');
        assert.equal(app.status, 'OFFERS_AVAILABLE');
    });

    it('requires withdrawing a live offer before reviewing again', () => {
        assert.throws(() => applyLenderDecision(withOffers(), A, 'UNDER_REVIEW', null, NOW), WorkflowError);
    });

    it('keeps one live offer per lender when an offer is replaced', () => {
        const { app } = makeOffer(withOffers(), A, { ...terms, amount: 45000 }, 'O3', NOW);
        const fromA = app.offers.filter(o => o.lender_id === 'A');
        assert.deepEqual(fromA.map(o => o.status), ['WITHDRAWN', 'PENDING']);
    });

    it('rejects invalid terms', () => {
        assert.throws(() => makeOffer(application(), A, { ...terms, amount: 0 }, 'O1', NOW), WorkflowError);
        assert.throws(() => makeOffer(application(), A, { ...terms, interest_rate: -1 }, 'O1', NOW), WorkflowError);
    });

    it("expires old offers, which can't then be accepted", () => {
        const later = new Date(NOW.getTime() + 31 * 86400000);
        const single = makeOffer(application(), A, terms, 'O1', NOW).app;
        assert.throws(() => acceptOffer(single, 'BEN', 'O1', later), WorkflowError);

        const result = expireOffers(single, later);
        assert.ok(result);
        assert.equal(result.app.offers[0].status, 'EXPIRED');
        assert.equal(result.app.status, 'UNDER_REVIEW');
        assert.equal(expireOffers(single, NOW), null);
    });
});

describe('simulated disbursement', () => {
    const accepted = () => {
        const offered = makeOffer(application(), A, terms, 'O1', NOW).app;
        return acceptOffer(offered, 'BEN', 'O1', NOW).app;
    };

    it('lets only the accepted lender move it forward', () => {
        assert.throws(() => advanceDisbursement(accepted(), 'B', NOW), WorkflowError);
    });

    it('reaches DISBURSED only after the last step', () => {
        let app = accepted();
        for (let step = 0; step < 3; step++) {
            app = advanceDisbursement(app, 'A', NOW).app;
            assert.equal(app.status, 'OFFER_ACCEPTED');
        }
        const final = advanceDisbursement(app, 'A', NOW);
        assert.equal(final.app.status, 'DISBURSED');
        assert.ok(final.notices[0].message.includes('No real money'));
        assert.throws(() => advanceDisbursement(final.app, 'A', NOW), WorkflowError);
    });
});

describe('documents', () => {
    it('really checks the file', () => {
        assert.equal(checkDocumentFile({ name: 'a.pdf', size: 1000, type: 'application/pdf' }).passed, true);
        assert.equal(checkDocumentFile({ name: 'a.exe', size: 1000, type: 'application/x-msdownload' }).passed, false);
        assert.equal(checkDocumentFile({ name: 'a.pdf', size: 1000, type: 'image/png' }).passed, false);
        assert.equal(checkDocumentFile({ name: 'a.pdf', size: 0, type: 'application/pdf' }).passed, false);
        assert.equal(checkDocumentFile({ name: 'a.png', size: 6 * 1024 * 1024, type: 'image/png' }).passed, false);
    });

    it('never claims a passed check proves a document is genuine', () => {
        assert.match(checkDocumentFile({ name: 'a.pdf', size: 1, type: 'application/pdf' }).note, /does not prove/);
    });

    it('keeps the overall verification status in step with the documents', () => {
        const uploaded = recordDocumentUpload(application(), 'BEN', 'APP-DOC1', 'a.pdf', NOW);
        assert.equal(uploaded.assessment?.verification_status, 'DOCUMENT_UPLOADED');

        const passed = completeDocumentCheck(uploaded, 'APP-DOC1', { passed: true, note: 'ok' }, NOW).app;
        assert.equal(passed.assessment?.verification_status, 'CHECKS_PASSED');

        const failed = completeDocumentCheck(uploaded, 'APP-DOC1', { passed: false, note: 'bad' }, NOW).app;
        assert.equal(failed.assessment?.verification_status, 'CHECKS_FAILED');
    });

    it('treats no uploads as not provided', () => {
        assert.equal(deriveVerificationStatus(blankDocuments('X', 'BEN')), 'NOT_PROVIDED');
    });

    it("stops uploads to someone else's application or a closed one", () => {
        assert.throws(() => recordDocumentUpload(application(), 'OTHER', 'APP-DOC1', 'a.pdf', NOW), WorkflowError);
        const rejected = { ...application(), status: 'REJECTED' };
        assert.equal(canUploadDocuments(rejected), false);
        assert.throws(() => recordDocumentUpload(rejected, 'BEN', 'APP-DOC1', 'a.pdf', NOW), WorkflowError);
    });

    it('tells a lender waiting on information when evidence arrives', () => {
        const asked = applyLenderDecision(application(), A, 'INFO_REQUESTED', 'Need it', NOW).app;
        const { notices } = completeDocumentCheck(asked, 'APP-DOC1', { passed: true, note: 'ok' }, NOW);
        assert.deepEqual(notices.map(n => n.userId), ['A']);
    });
});

describe('application progress', () => {
    it('marks every step done for finished applications', () => {
        assert.equal(workflowStep('DISBURSED'), 5);
        assert.equal(workflowStep('REJECTED'), 5);
        assert.equal(workflowStep('OFFER_ACCEPTED'), 5);
    });
});

describe('demo data', () => {
    it('stores the status the rules would derive', () => {
        for (const app of MOCK_APPLICATIONS) {
            assert.equal(app.status, deriveApplicationStatus(app), app.id);
        }
    });

    it('has no fabricated probabilities and a verification status that matches its documents', () => {
        for (const app of MOCK_APPLICATIONS) {
            assert.equal(app.assessment?.probability_of_default, null, app.id);
            assert.equal(app.assessment?.model_confidence, null, app.id);
            assert.equal(app.assessment?.verification_status, deriveVerificationStatus(app.documents), app.id);
        }
    });

    it('never blames missing repayment history in a decision note', () => {
        for (const app of MOCK_APPLICATIONS) {
            for (const decision of app.lenderDecisions) {
                assert.ok(!/history/i.test(decision.note ?? ''), `${app.id}: ${decision.note}`);
            }
        }
    });

    it('only notifies users about things they may know', () => {
        for (const notice of MOCK_NOTIFICATIONS.filter(n => n.userRole === 'lender')) {
            const match = notice.message.match(/#(LA\d+)/);
            const app = MOCK_APPLICATIONS.find(a => a.id === match?.[1]);
            assert.ok(app?.lenderDecisions.some(d => d.lenderId === notice.userId), notice.id);
        }
    });
});

describe('taking back access', () => {
    it('removes the lender and withdraws its live offer, leaving other lenders alone', () => {
        const withOffer = makeOffer(makeOffer(application(), A, terms, 'OFF-A', NOW).app, B, terms, 'OFF-B', NOW).app;
        const { app, notices } = revokeLender(withOffer, 'BEN', 'A', NOW);

        assert.deepEqual(app.lenderDecisions.map(d => d.lenderId), ['B']);
        assert.equal(app.offers.find(o => o.id === 'OFF-A')?.status, 'WITHDRAWN');
        assert.equal(app.offers.find(o => o.id === 'OFF-B')?.status, 'PENDING');
        assert.equal(app.status, 'OFFERS_AVAILABLE');
        assert.deepEqual(notices.map(n => [n.userId, n.title]), [['A', 'Access Removed']]);
    });

    it('stops the removed lender acting on the application', () => {
        const { app } = revokeLender(application(), 'BEN', 'A', NOW);
        assert.throws(() => applyLenderDecision(app, A, 'UNDER_REVIEW', null, NOW), WorkflowError);
        assert.throws(() => makeOffer(app, A, terms, 'OFF', NOW), WorkflowError);
    });

    it('leaves an application with no lenders readable', () => {
        const { app } = revokeLender(application([A]), 'BEN', 'A', NOW);
        assert.equal(app.lenderDecisions.length, 0);
        assert.equal(app.status, 'SUBMITTED');
    });

    it("keeps the lender holding the loan, and refuses anyone but the owner", () => {
        const accepted = acceptOffer(makeOffer(application(), A, terms, 'OFF-A', NOW).app, 'BEN', 'OFF-A', NOW).app;
        assert.equal(canRevokeLender(accepted, 'A'), false);
        assert.equal(canRevokeLender(accepted, 'B'), true);
        assert.throws(() => revokeLender(accepted, 'BEN', 'A', NOW), WorkflowError);
        assert.throws(() => revokeLender(application(), 'OTHER', 'A', NOW), WorkflowError);
        assert.throws(() => revokeLender(application(), 'BEN', 'NOT-SHARED', NOW), WorkflowError);
    });
});

describe('replying to a lender', () => {
    const asked = () => applyLenderDecision(application(), A, 'INFO_REQUESTED', 'Which employer?', NOW).app;

    it('records the answer for the lender that asked and tells only that lender', () => {
        const { app, notices } = replyToLender(asked(), 'BEN', 'A', '  At a tailor shop.  ', NOW);
        assert.equal(app.lenderDecisions.find(d => d.lenderId === 'A')?.applicantReply, 'At a tailor shop.');
        assert.equal(app.lenderDecisions.find(d => d.lenderId === 'B')?.applicantReply, undefined);
        assert.deepEqual(notices.map(n => n.userId), ['A']);
    });

    it('only works while that lender is waiting, and needs a real message', () => {
        assert.throws(() => replyToLender(application(), 'BEN', 'A', 'Hello', NOW), WorkflowError);
        assert.throws(() => replyToLender(asked(), 'BEN', 'A', '   ', NOW), WorkflowError);
        assert.throws(() => replyToLender(asked(), 'BEN', 'A', 'x'.repeat(501), NOW), WorkflowError);
        assert.throws(() => replyToLender(asked(), 'OTHER', 'A', 'Hello', NOW), WorkflowError);
    });

    it('stays visible until the lender asks something new', () => {
        const replied = replyToLender(asked(), 'BEN', 'A', 'First answer', NOW).app;
        const reviewing = applyLenderDecision(replied, A, 'UNDER_REVIEW', null, NOW).app;
        assert.equal(reviewing.lenderDecisions.find(d => d.lenderId === 'A')?.applicantReply, 'First answer');
        const askedAgain = applyLenderDecision(reviewing, A, 'INFO_REQUESTED', 'One more thing?', NOW).app;
        assert.equal(askedAgain.lenderDecisions.find(d => d.lenderId === 'A')?.applicantReply, null);
    });
});

describe('deleting a document', () => {
    function uploaded() {
        const app = recordDocumentUpload(application(), 'BEN', 'APP-DOC1', 'statement.pdf', NOW);
        return completeDocumentCheck(app, 'APP-DOC1', { passed: true, note: 'File OK' }, NOW).app;
    }

    it('clears the slot and the overall document status', () => {
        const before = uploaded();
        assert.equal(before.assessment?.verification_status, 'CHECKS_PASSED');
        const app = deleteDocument(before, 'BEN', 'APP-DOC1', NOW);
        const doc = app.documents.find(d => d.id === 'APP-DOC1');
        assert.equal(doc?.verification_status, 'NOT_PROVIDED');
        assert.equal(doc?.filename, null);
        assert.equal(doc?.checkNote, null);
        assert.equal(app.assessment?.verification_status, 'NOT_PROVIDED');
    });

    it('lets the slot be used again', () => {
        const app = deleteDocument(uploaded(), 'BEN', 'APP-DOC1', NOW);
        assert.equal(recordDocumentUpload(app, 'BEN', 'APP-DOC1', 'new.pdf', NOW).documents.find(d => d.id === 'APP-DOC1')?.filename, 'new.pdf');
    });

    it("refuses an empty slot, a check still running, someone else, or a document a loan relies on", () => {
        assert.throws(() => deleteDocument(application(), 'BEN', 'APP-DOC1', NOW), WorkflowError);
        assert.throws(() => deleteDocument(uploaded(), 'OTHER', 'APP-DOC1', NOW), WorkflowError);
        const checking = recordDocumentUpload(application(), 'BEN', 'APP-DOC1', 'statement.pdf', NOW);
        assert.throws(() => deleteDocument(checking, 'BEN', 'APP-DOC1', NOW), WorkflowError);
        assert.equal(canDeleteDocument(checking, checking.documents[0]), false);

        const accepted = acceptOffer(makeOffer(uploaded(), A, terms, 'OFF-A', NOW).app, 'BEN', 'OFF-A', NOW).app;
        assert.throws(() => deleteDocument(accepted, 'BEN', 'APP-DOC1', NOW), WorkflowError);
    });
});
