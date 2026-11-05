package com.creditscore.backend.application;

import com.creditscore.backend.application.ApplicationDtos.ApplicationDto;
import com.creditscore.backend.application.Enums.ApplicationStatus;
import com.creditscore.backend.application.Enums.DecisionStatus;
import com.creditscore.backend.application.Enums.OfferStatus;
import com.creditscore.backend.application.Enums.StepStatus;
import com.creditscore.backend.assessment.AssessmentContract;
import com.creditscore.backend.assessment.AssessmentContract.VerificationStatus;
import com.creditscore.backend.assessment.AssessmentProvider;
import com.creditscore.backend.common.ApiException;
import com.creditscore.backend.common.Ids;
import com.creditscore.backend.common.Mailer;
import com.creditscore.backend.notification.Notification;
import com.creditscore.backend.notification.NotificationService;
import com.creditscore.backend.user.BeneficiaryProfile;
import com.creditscore.backend.user.LenderProfile;
import com.creditscore.backend.user.Repositories.BeneficiaryProfileRepository;
import com.creditscore.backend.user.Repositories.LenderProfileRepository;
import com.creditscore.backend.user.Repositories.UserRepository;
import com.creditscore.backend.user.User;
import jakarta.persistence.EntityManager;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * The lending workflow. These rules match frontend/src/lib/workflow.js, and the server is what enforces them:
 * one lender can't affect another, and nobody reaches data that isn't theirs.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ApplicationService {

    private static final int OFFER_VALIDITY_DAYS = 30;
    private static final String NOT_FOUND = "This application doesn't exist or isn't available to you.";
    private static final String FILE_NOT_FOUND = "This file isn't available.";
    private static final Locale INDIA = Locale.of("en", "IN");
    // Step dates are shown to people in India, whatever time zone the server runs in.
    private static final ZoneId INDIA_TIME = ZoneId.of("Asia/Kolkata");
    private static final List<String> DISBURSEMENT_LABELS = List.of(
            "Offer Accepted", "Agreement Signed", "Verification Complete (Simulated)", "Disbursement Initiated", "Amount Credited (Simulated)");

    private record DocumentSlot(Enums.DocumentType type, String label) {}

    private static final List<DocumentSlot> DOCUMENT_SLOTS = List.of(
            new DocumentSlot(Enums.DocumentType.INCOME_PROOF, "Income Proof"),
            new DocumentSlot(Enums.DocumentType.BANK_STATEMENT, "Bank Statement"),
            new DocumentSlot(Enums.DocumentType.ELECTRICITY_BILL, "Electricity Bill"),
            new DocumentSlot(Enums.DocumentType.OTHER, "Other Supporting Document"));

    private final EntityManager entityManager;
    private final ApplicationRepository applications;
    private final UserRepository users;
    private final BeneficiaryProfileRepository beneficiaries;
    private final LenderProfileRepository lenders;
    private final AssessmentProvider assessmentProvider;
    private final NotificationService notifications;
    private final ApplicationMapper mapper;
    private final DocumentFileRepository documentFiles;
    private final DocumentCipher documentCipher;
    private final Mailer mailer;

    /** A decrypted document, on its way to someone allowed to see it. */
    public record FileDownload(String filename, String contentType, byte[] content) {}

    // ============================================================
    // Derived state
    // ============================================================

    /** Always derived, never set by hand, so one lender's rejection can't close an application others are reviewing. */
    static ApplicationStatus deriveStatus(LoanApplication app) {
        if (app.acceptedOffer().isPresent()) {
            List<DisbursementStep> steps = app.getDisbursementSteps();
            boolean finished = !steps.isEmpty() && steps.stream().allMatch(step -> step.getStatus() == StepStatus.completed);
            return finished ? ApplicationStatus.DISBURSED : ApplicationStatus.OFFER_ACCEPTED;
        }
        if (app.getOffers().stream().anyMatch(offer -> offer.getStatus() == OfferStatus.PENDING)) return ApplicationStatus.OFFERS_AVAILABLE;

        List<DecisionStatus> decisions = app.getLenderDecisions().stream().map(LenderDecision::getStatus).toList();
        if (decisions.contains(DecisionStatus.INFO_REQUESTED)) return ApplicationStatus.DOCUMENTS_REQUIRED;
        if (!decisions.isEmpty() && decisions.stream().allMatch(status -> status == DecisionStatus.REJECTED)) return ApplicationStatus.REJECTED;
        if (decisions.stream().anyMatch(status -> status != DecisionStatus.PENDING)) return ApplicationStatus.UNDER_REVIEW;
        return ApplicationStatus.SUBMITTED;
    }

    static VerificationStatus deriveVerification(List<ApplicationDocument> documents) {
        List<VerificationStatus> statuses = documents.stream()
                .map(ApplicationDocument::getVerificationStatus)
                .filter(status -> status != VerificationStatus.NOT_PROVIDED)
                .toList();
        if (statuses.isEmpty()) return VerificationStatus.NOT_PROVIDED;
        if (statuses.contains(VerificationStatus.CHECKS_FAILED)) return VerificationStatus.CHECKS_FAILED;
        if (statuses.contains(VerificationStatus.DOCUMENT_UPLOADED)) return VerificationStatus.DOCUMENT_UPLOADED;
        if (statuses.stream().allMatch(status -> status == VerificationStatus.CHECKS_PASSED)) return VerificationStatus.CHECKS_PASSED;
        return VerificationStatus.DEMO_UNVERIFIED;
    }

    private static void refreshStatus(LoanApplication app, Instant now) {
        app.setStatus(deriveStatus(app));
        app.setLastUpdatedAt(now);
    }

    private static void setDecision(LoanApplication app, String lenderId, DecisionStatus status, String note, Instant now) {
        LenderDecision decision = app.decisionOf(lenderId).orElseThrow();
        decision.setStatus(status);
        decision.setNote(note);
        decision.setLastUpdated(now);
        // A new question starts fresh. Otherwise the applicant's last answer stays visible to the lender.
        if (status == DecisionStatus.INFO_REQUESTED) {
            decision.setApplicantReply(null);
            decision.setApplicantReplyAt(null);
        }
    }

    private static boolean won(LoanApplication app, String lenderId) {
        return app.acceptedOffer().filter(offer -> offer.getLenderId().equals(lenderId)).isPresent();
    }

    /** Takes back any live offer and all access. Past offers stay on record for the applicant. */
    private static void removeLender(LoanApplication app, String lenderId, Instant now) {
        app.liveOfferFrom(lenderId).ifPresent(offer -> offer.setStatus(OfferStatus.WITHDRAWN));
        app.getLenderDecisions().removeIf(decision -> decision.getLenderId().equals(lenderId));
        refreshStatus(app, now);
    }

    private static String inr(BigDecimal amount) {
        NumberFormat format = NumberFormat.getNumberInstance(INDIA);
        format.setMaximumFractionDigits(2);
        return "₹" + format.format(amount);
    }

    private static String plainNumber(BigDecimal value) {
        return value.stripTrailingZeros().toPlainString();
    }

    // ============================================================
    // Beneficiary
    // ============================================================

    @Transactional
    public ApplicationDto submit(String beneficiaryId, ApplicationDtos.SubmitApplicationRequest request) {
        if (!request.consent()) {
            throw ApiException.fieldError(HttpStatus.UNPROCESSABLE_ENTITY, "consent", "Your consent is needed to share this application");
        }
        User user = users.findById(beneficiaryId).orElseThrow();
        BeneficiaryProfile profile = beneficiaries.findById(beneficiaryId).orElseThrow();
        if (!profile.isComplete(user.getPhone())) {
            throw new ApiException(HttpStatus.CONFLICT, "PROFILE_INCOMPLETE", "Complete your profile before applying for a loan.");
        }
        if (mailer.isEnabled() && !user.isEmailVerified()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "EMAIL_NOT_VERIFIED", "Confirm your email address before applying for a loan.");
        }

        Set<String> lenderIds = new LinkedHashSet<>(request.lenderIds());
        List<LenderProfile> chosen = lenders.findAllById(lenderIds);
        if (chosen.size() != lenderIds.size() || !chosen.stream().allMatch(LenderProfile::isApproved)) {
            throw ApiException.fieldError(HttpStatus.UNPROCESSABLE_ENTITY, "lender_ids", "Choose lenders from the list");
        }

        Instant now = Instant.now();
        LoanApplication app = new LoanApplication();
        app.setId(Ids.generate("LA", 6, applications::existsById));
        app.setBeneficiaryId(beneficiaryId);
        app.setMonthlyIncome(request.monthlyIncome());
        app.setMonthlyExpenses(request.monthlyExpenses());
        app.setExistingEmi(request.existingEmi());
        app.setLoanAmount(request.loanAmount());
        app.setLoanPurpose(request.loanPurpose());
        app.setTenureMonths(request.tenureMonths());
        app.setRepaymentHistory(request.repaymentHistory());
        app.setElectricityUsage(request.electricityUsage());
        app.setStatus(ApplicationStatus.SUBMITTED);
        app.setConsentGivenAt(now);
        app.setSubmittedAt(now);
        app.setLastUpdatedAt(now);

        for (int i = 0; i < DOCUMENT_SLOTS.size(); i++) {
            ApplicationDocument doc = new ApplicationDocument();
            doc.setId(app.getId() + "-DOC" + (i + 1));
            doc.setApplication(app);
            doc.setType(DOCUMENT_SLOTS.get(i).type());
            doc.setLabel(DOCUMENT_SLOTS.get(i).label());
            doc.setVerificationStatus(VerificationStatus.NOT_PROVIDED);
            doc.setPosition(i);
            app.getDocuments().add(doc);
        }
        for (LenderProfile lender : chosen) {
            LenderDecision decision = new LenderDecision();
            decision.setApplication(app);
            decision.setLenderId(lender.getUserId());
            decision.setStatus(DecisionStatus.PENDING);
            decision.setLastUpdated(now);
            app.getLenderDecisions().add(decision);
        }

        AssessmentContract.Response result = assessmentProvider.assess(new AssessmentContract.Request(
                beneficiaryId, request.monthlyIncome(), request.monthlyExpenses(), request.existingEmi(), request.loanAmount(),
                request.repaymentHistory(), request.electricityUsage()), VerificationStatus.NOT_PROVIDED);
        // The assessment's foreign key needs the application row to exist first.
        entityManager.persist(app);
        entityManager.flush();
        app.setAssessment(toEntity(app.getId(), result));
        entityManager.flush();

        String names = String.join(", ", chosen.stream().map(LenderProfile::getInstitutionName).toList());
        notifications.notify(beneficiaryId, Notification.Type.success, "Application Submitted", "Your application #" + app.getId() + " was shared with " + names + ".");
        for (LenderProfile lender : chosen) {
            notifications.notify(lender.getUserId(), Notification.Type.info, "New Application Available",
                    "Application #" + app.getId() + " from " + profile.getName() + " was shared with you for review.");
        }
        return mapper.forBeneficiary(app);
    }

    private static CreditAssessment toEntity(String applicationId, AssessmentContract.Response result) {
        CreditAssessment assessment = new CreditAssessment();
        assessment.setApplicationId(applicationId);
        assessment.setRiskScore(result.riskScore());
        assessment.setRiskCategory(result.riskCategory());
        assessment.setProbabilityOfDefault(result.probabilityOfDefault());
        assessment.setModelConfidence(result.modelConfidence());
        assessment.setIncomeBracket(result.incomeBracket());
        assessment.setCompositeScore(result.compositeScore());
        assessment.setSegment(result.segment());
        assessment.setThinFile(result.isThinFile());
        assessment.setExplanations(result.explanations());
        assessment.setExplanationMethod(result.explanationMethod());
        assessment.setVerificationStatus(result.verificationStatus());
        return assessment;
    }

    @Transactional(readOnly = true)
    public List<ApplicationDto> listForBeneficiary(String beneficiaryId) {
        return applications.findByBeneficiaryIdOrderBySubmittedAtDesc(beneficiaryId).stream().map(mapper::forBeneficiary).toList();
    }

    @Transactional(readOnly = true)
    public ApplicationDto getForBeneficiary(String beneficiaryId, String applicationId) {
        return applications.findById(applicationId)
                .filter(app -> app.getBeneficiaryId().equals(beneficiaryId))
                .map(mapper::forBeneficiary)
                .orElseThrow(() -> ApiException.notFound(NOT_FOUND));
    }

    private LoanApplication lockOwn(String beneficiaryId, String applicationId) {
        return applications.findForUpdate(applicationId)
                .filter(app -> app.getBeneficiaryId().equals(beneficiaryId))
                .orElseThrow(() -> ApiException.notFound(NOT_FOUND));
    }

    private static LoanOffer requireOpenOffer(LoanApplication app, String offerId, Instant now) {
        LoanOffer offer = app.getOffers().stream()
                .filter(candidate -> candidate.getId().equals(offerId))
                .findFirst()
                .orElseThrow(() -> ApiException.notFound("This offer no longer exists."));
        if (offer.getStatus() != OfferStatus.PENDING) throw ApiException.conflict("This offer is no longer available.");
        if (offer.getExpiresAt() != null && !offer.getExpiresAt().isAfter(now)) throw ApiException.conflict("This offer has expired.");
        return offer;
    }

    @Transactional
    public ApplicationDto acceptOffer(String beneficiaryId, String applicationId, String offerId) {
        LoanApplication app = lockOwn(beneficiaryId, applicationId);
        Instant now = Instant.now();
        LoanOffer offer = requireOpenOffer(app, offerId, now);
        if (app.acceptedOffer().isPresent()) throw ApiException.conflict("You have already accepted an offer on this application.");

        offer.setStatus(OfferStatus.ACCEPTED);
        notifications.notify(offer.getLenderId(), Notification.Type.success, "Offer Accepted",
                "Your offer of " + inr(offer.getAmount()) + " on application #" + app.getId() + " was accepted.");
        for (LoanOffer other : app.getOffers()) {
            if (other.getStatus() == OfferStatus.PENDING) {
                other.setStatus(OfferStatus.DECLINED);
                // Other lenders learn their offer was declined, not who won.
                notifications.notify(other.getLenderId(), Notification.Type.info, "Offer Declined", "Your offer on application #" + app.getId() + " was declined.");
            }
        }

        for (int i = 0; i < DISBURSEMENT_LABELS.size(); i++) {
            DisbursementStep step = new DisbursementStep();
            step.setApplication(app);
            step.setPosition(i);
            step.setLabel(DISBURSEMENT_LABELS.get(i));
            step.setStatus(i == 0 ? StepStatus.completed : i == 1 ? StepStatus.current : StepStatus.pending);
            step.setCompletedOn(i == 0 ? LocalDate.ofInstant(now, INDIA_TIME) : null);
            app.getDisbursementSteps().add(step);
        }
        refreshStatus(app, now);
        return mapper.forBeneficiary(app);
    }

    @Transactional
    public ApplicationDto declineOffer(String beneficiaryId, String applicationId, String offerId) {
        LoanApplication app = lockOwn(beneficiaryId, applicationId);
        Instant now = Instant.now();
        LoanOffer offer = requireOpenOffer(app, offerId, now);
        offer.setStatus(OfferStatus.DECLINED);
        // The lender goes back to reviewing, so a decision of OFFER_MADE always means a live offer.
        setDecision(app, offer.getLenderId(), DecisionStatus.UNDER_REVIEW, "Applicant declined the offer.", now);
        refreshStatus(app, now);
        notifications.notify(offer.getLenderId(), Notification.Type.info, "Offer Declined", "Your offer on application #" + app.getId() + " was declined.");
        return mapper.forBeneficiary(app);
    }

    @Transactional
    public ApplicationDto uploadDocument(String beneficiaryId, String applicationId, String documentId, MultipartFile file) {
        LoanApplication app = lockOwn(beneficiaryId, applicationId);
        if (app.getStatus() == ApplicationStatus.DISBURSED || app.getStatus() == ApplicationStatus.REJECTED) {
            throw ApiException.conflict("This application is closed, so documents can no longer be uploaded.");
        }
        ApplicationDocument document = app.getDocuments().stream()
                .filter(candidate -> candidate.getId().equals(documentId))
                .findFirst()
                .orElseThrow(() -> ApiException.notFound("This document could not be found."));
        // Older uploads passed before files were kept, so those can be uploaded again.
        if (document.getVerificationStatus() == VerificationStatus.CHECKS_PASSED && documentFiles.existsById(document.getId())) {
            throw ApiException.conflict("This document has already passed its checks.");
        }

        String filename = DocumentChecks.cleanFilename(file.getOriginalFilename());
        DocumentChecks.Result result = DocumentChecks.check(filename, file.getSize(), firstBytes(file));

        Instant now = Instant.now();
        document.setFilename(filename);
        document.setUploadedAt(now);
        document.setVerificationStatus(result.passed() ? VerificationStatus.CHECKS_PASSED : VerificationStatus.CHECKS_FAILED);
        document.setCheckNote(result.note());
        // Only a file that passed is kept, so nothing else ever reaches a lender.
        if (result.passed()) {
            DocumentFile stored = new DocumentFile();
            stored.setDocumentId(document.getId());
            stored.setContentType(DocumentChecks.contentType(filename));
            stored.setContent(documentCipher.encrypt(contentsOf(file), document.getId()));
            documentFiles.save(stored);
        }
        if (app.getAssessment() != null) app.getAssessment().setVerificationStatus(deriveVerification(app.getDocuments()));
        app.setLastUpdatedAt(now);

        if (result.passed()) {
            // Lenders waiting on more information hear about new evidence; the rest aren't interrupted.
            app.getLenderDecisions().stream()
                    .filter(decision -> decision.getStatus() == DecisionStatus.INFO_REQUESTED)
                    .forEach(decision -> notifications.notify(decision.getLenderId(), Notification.Type.info, "Document Uploaded",
                            document.getLabel() + " was uploaded for application #" + app.getId() + ", where you asked for more information."));
        }
        return mapper.forBeneficiary(app);
    }

    /** The file and what's known about it both go, and the slot can be used again. */
    @Transactional
    public ApplicationDto deleteDocument(String beneficiaryId, String applicationId, String documentId) {
        LoanApplication app = lockOwn(beneficiaryId, applicationId);
        if (app.acceptedOffer().isPresent()) {
            throw ApiException.conflict("You've accepted an offer that relies on these documents, so they can no longer be removed.");
        }
        ApplicationDocument document = app.getDocuments().stream()
                .filter(candidate -> candidate.getId().equals(documentId))
                .findFirst()
                .orElseThrow(() -> ApiException.notFound("This document could not be found."));
        if (document.getVerificationStatus() == VerificationStatus.NOT_PROVIDED) {
            throw ApiException.conflict("Nothing has been uploaded here.");
        }
        documentFiles.findById(documentId).ifPresent(documentFiles::delete);
        document.setFilename(null);
        document.setUploadedAt(null);
        document.setVerificationStatus(VerificationStatus.NOT_PROVIDED);
        document.setCheckNote(null);
        if (app.getAssessment() != null) app.getAssessment().setVerificationStatus(deriveVerification(app.getDocuments()));
        app.setLastUpdatedAt(Instant.now());
        return mapper.forBeneficiary(app);
    }

    /** Sharing was the applicant's choice, so they can take it back, except from the lender holding their loan. */
    @Transactional
    public ApplicationDto revokeLender(String beneficiaryId, String applicationId, String lenderId) {
        LoanApplication app = lockOwn(beneficiaryId, applicationId);
        if (app.decisionOf(lenderId).isEmpty()) throw ApiException.notFound("This lender doesn't have access to this application.");
        if (won(app, lenderId)) throw ApiException.conflict("You've accepted this lender's offer, so it keeps access to this application.");

        removeLender(app, lenderId, Instant.now());
        notifications.notify(lenderId, Notification.Type.info, "Access Removed", "The applicant removed your access to application #" + app.getId() + ".");
        return mapper.forBeneficiary(app);
    }

    @Transactional
    public ApplicationDto replyToLender(String beneficiaryId, String applicationId, String lenderId, ApplicationDtos.ReplyRequest request) {
        LoanApplication app = lockOwn(beneficiaryId, applicationId);
        LenderDecision decision = app.decisionOf(lenderId).orElseThrow(() -> ApiException.notFound("This lender doesn't have access to this application."));
        if (decision.getStatus() != DecisionStatus.INFO_REQUESTED) throw ApiException.conflict("This lender isn't waiting for information from you.");

        Instant now = Instant.now();
        String message = request.message().trim();
        decision.setApplicantReply(message);
        decision.setApplicantReplyAt(now);
        app.setLastUpdatedAt(now);
        notifications.notify(lenderId, Notification.Type.info, "Applicant Replied", "On application #" + app.getId() + ": " + message);
        return mapper.forBeneficiary(app);
    }

    private static byte[] contentsOf(MultipartFile file) {
        try {
            return file.getBytes();
        } catch (IOException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_REQUEST", "The file could not be read.");
        }
    }

    @Transactional(readOnly = true)
    public FileDownload documentForBeneficiary(String beneficiaryId, String applicationId, String documentId) {
        LoanApplication app = applications.findById(applicationId)
                .filter(candidate -> candidate.getBeneficiaryId().equals(beneficiaryId))
                .orElseThrow(() -> ApiException.notFound(FILE_NOT_FOUND));
        return readFile(app, documentId);
    }

    /** A lender whose offer didn't win loses access, because they no longer have a reason to see it. */
    @Transactional(readOnly = true)
    public FileDownload documentForLender(String lenderId, String applicationId, String documentId) {
        LoanApplication app = applications.findById(applicationId)
                .filter(candidate -> canSee(candidate, lenderId))
                .filter(candidate -> candidate.acceptedOffer().map(offer -> offer.getLenderId().equals(lenderId)).orElse(true))
                .orElseThrow(() -> ApiException.notFound(FILE_NOT_FOUND));
        FileDownload download = readFile(app, documentId);
        log.info("Lender {} opened document {}", lenderId, documentId);
        return download;
    }

    private FileDownload readFile(LoanApplication app, String documentId) {
        ApplicationDocument document = app.getDocuments().stream()
                .filter(candidate -> candidate.getId().equals(documentId))
                .findFirst()
                .orElseThrow(() -> ApiException.notFound(FILE_NOT_FOUND));
        DocumentFile stored = documentFiles.findById(documentId).orElseThrow(() -> ApiException.notFound(FILE_NOT_FOUND));
        return new FileDownload(document.getFilename(), stored.getContentType(), documentCipher.decrypt(stored.getContent(), documentId));
    }

    private static byte[] firstBytes(MultipartFile file) {
        try (InputStream input = file.getInputStream()) {
            return input.readNBytes(16);
        } catch (IOException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_REQUEST", "The file could not be read.");
        }
    }

    // ============================================================
    // Lender
    // ============================================================

    /**
     * The application must be shared with this lender, and the platform must have approved it.
     * An institution that later loses approval keeps only loans already accepted from it, so those aren't stranded.
     */
    private boolean canSee(LoanApplication app, String lenderId) {
        if (app.decisionOf(lenderId).isEmpty()) return false;
        return won(app, lenderId) || lenders.findById(lenderId).map(LenderProfile::isApproved).orElse(false);
    }

    @Transactional(readOnly = true)
    public List<ApplicationDto> listForLender(String lenderId) {
        return applications.findSharedWith(lenderId).stream()
                .filter(app -> canSee(app, lenderId))
                .map(app -> mapper.forLender(app, lenderId))
                .toList();
    }

    @Transactional(readOnly = true)
    public ApplicationDto getForLender(String lenderId, String applicationId) {
        return applications.findById(applicationId)
                .filter(app -> canSee(app, lenderId))
                .map(app -> mapper.forLender(app, lenderId))
                .orElseThrow(() -> ApiException.notFound(NOT_FOUND));
    }

    /** An application that wasn't shared looks exactly like one that doesn't exist. */
    private LoanApplication lockShared(String lenderId, String applicationId) {
        return applications.findForUpdate(applicationId)
                .filter(app -> canSee(app, lenderId))
                .orElseThrow(() -> ApiException.notFound(NOT_FOUND));
    }

    private LoanApplication lockOpen(String lenderId, String applicationId) {
        LoanApplication app = lockShared(lenderId, applicationId);
        if (app.acceptedOffer().isPresent()) throw ApiException.conflict("This application is no longer open for decisions.");
        return app;
    }

    private String lenderName(String lenderId) {
        return lenders.findById(lenderId).orElseThrow().getInstitutionName();
    }

    @Transactional
    public ApplicationDto decide(String lenderId, String applicationId, ApplicationDtos.DecisionRequest request) {
        DecisionStatus status = request.status();
        if (status != DecisionStatus.UNDER_REVIEW && status != DecisionStatus.INFO_REQUESTED && status != DecisionStatus.REJECTED) {
            throw ApiException.fieldError(HttpStatus.UNPROCESSABLE_ENTITY, "status", "Use the offer action to make an offer");
        }
        LoanApplication app = lockOpen(lenderId, applicationId);

        String note = request.note() == null || request.note().isBlank() ? null : request.note().trim();
        if (status == DecisionStatus.INFO_REQUESTED && note == null) {
            throw ApiException.fieldError(HttpStatus.UNPROCESSABLE_ENTITY, "note", "Say what information you need, so the applicant can provide it.");
        }

        var liveOffer = app.liveOfferFrom(lenderId);
        if (liveOffer.isPresent() && status != DecisionStatus.REJECTED) {
            throw ApiException.conflict("Withdraw your current offer before changing this decision.");
        }

        // Rejecting takes back any live offer from this lender; other lenders are untouched.
        liveOffer.ifPresent(offer -> offer.setStatus(OfferStatus.WITHDRAWN));
        Instant now = Instant.now();
        setDecision(app, lenderId, status, note, now);
        refreshStatus(app, now);

        String name = lenderName(lenderId);
        String reference = "application #" + app.getId();
        switch (status) {
            case UNDER_REVIEW -> notifications.notify(app.getBeneficiaryId(), Notification.Type.info, "Application Under Review", name + " is reviewing your " + reference + ".");
            case INFO_REQUESTED -> notifications.notify(app.getBeneficiaryId(), Notification.Type.warning, "More Information Requested", name + " asked for more information on your " + reference + ": " + note);
            default -> {
                if (app.getStatus() == ApplicationStatus.REJECTED) {
                    notifications.notify(app.getBeneficiaryId(), Notification.Type.error, "Application Rejected", "Every lender you shared " + reference + " with has rejected it.");
                } else {
                    notifications.notify(app.getBeneficiaryId(), Notification.Type.warning, "One Lender Declined", name + " rejected your " + reference + ". Other lenders' reviews are not affected.");
                }
            }
        }
        return mapper.forLender(app, lenderId);
    }

    @Transactional
    public ApplicationDto makeOffer(String lenderId, String applicationId, ApplicationDtos.CreateOfferRequest request) {
        LoanApplication app = lockOpen(lenderId, applicationId);
        Instant now = Instant.now();

        // A lender holds one live offer per application: a new one replaces the old one on record.
        app.liveOfferFrom(lenderId).ifPresent(old -> old.setStatus(OfferStatus.WITHDRAWN));

        LoanOffer offer = new LoanOffer();
        offer.setId(Ids.generate("OFF", 6, applications::offerIdExists));
        offer.setApplication(app);
        offer.setLenderId(lenderId);
        offer.setAmount(request.amount());
        offer.setInterestRate(request.interestRate());
        offer.setTenureMonths(request.tenureMonths());
        offer.setStatus(OfferStatus.PENDING);
        offer.setFeatures(cleanFeatures(request.features()));
        offer.setCreatedAt(now);
        offer.setExpiresAt(now.plus(OFFER_VALIDITY_DAYS, ChronoUnit.DAYS));
        app.getOffers().add(offer);

        String terms = inr(request.amount()) + " at " + plainNumber(request.interestRate()) + "%";
        setDecision(app, lenderId, DecisionStatus.OFFER_MADE, "Offer: " + terms + " for " + request.tenureMonths() + " months.", now);
        refreshStatus(app, now);

        notifications.notify(app.getBeneficiaryId(), Notification.Type.success, "New Loan Offer Received",
                lenderName(lenderId) + " offered " + terms + " p.a. on your application #" + app.getId() + ".");
        return mapper.forLender(app, lenderId);
    }

    private static List<String> cleanFeatures(List<String> features) {
        if (features == null) return List.of();
        List<String> cleaned = new ArrayList<>();
        for (String feature : features) {
            if (feature != null && !feature.isBlank()) cleaned.add(feature.replace('\n', ' ').trim());
        }
        return cleaned;
    }

    @Transactional
    public ApplicationDto withdrawOffer(String lenderId, String applicationId, String offerId) {
        LoanApplication app = lockOpen(lenderId, applicationId);
        LoanOffer offer = app.liveOfferFrom(lenderId)
                .filter(candidate -> candidate.getId().equals(offerId))
                .orElseThrow(() -> ApiException.conflict("Only your own pending offers can be withdrawn."));
        Instant now = Instant.now();
        offer.setStatus(OfferStatus.WITHDRAWN);
        setDecision(app, lenderId, DecisionStatus.UNDER_REVIEW, "Offer withdrawn by the lender.", now);
        refreshStatus(app, now);
        notifications.notify(app.getBeneficiaryId(), Notification.Type.warning, "Offer Withdrawn", lenderName(lenderId) + " withdrew its offer on your application #" + app.getId() + ".");
        return mapper.forLender(app, lenderId);
    }

    @Transactional
    public ApplicationDto advanceDisbursement(String lenderId, String applicationId) {
        LoanApplication app = lockShared(lenderId, applicationId);
        LoanOffer accepted = app.acceptedOffer()
                .filter(offer -> offer.getLenderId().equals(lenderId))
                .orElseThrow(() -> ApiException.conflict("Only the lender whose offer was accepted can update this disbursement."));
        List<DisbursementStep> steps = app.getDisbursementSteps();
        int current = -1;
        for (int i = 0; i < steps.size(); i++) {
            if (steps.get(i).getStatus() == StepStatus.current) current = i;
        }
        if (current == -1) throw ApiException.conflict("This disbursement is already complete.");

        Instant now = Instant.now();
        DisbursementStep step = steps.get(current);
        step.setStatus(StepStatus.completed);
        step.setCompletedOn(LocalDate.ofInstant(now, INDIA_TIME));
        if (current + 1 < steps.size()) steps.get(current + 1).setStatus(StepStatus.current);
        refreshStatus(app, now);

        if (app.getStatus() == ApplicationStatus.DISBURSED) {
            notifications.notify(app.getBeneficiaryId(), Notification.Type.success, "Disbursement Complete (Simulated)",
                    "Your loan of " + inr(accepted.getAmount()) + " on application #" + app.getId() + " is marked as disbursed. No real money moved.");
        } else {
            notifications.notify(app.getBeneficiaryId(), Notification.Type.info, "Disbursement Updated", step.getLabel() + " is done for application #" + app.getId() + ".");
        }
        return mapper.forLender(app, lenderId);
    }

    // ============================================================
    // Platform
    // ============================================================

    /** For an institution the platform turned away. Applicants hear about it, and can share elsewhere. */
    @Transactional
    public void removeLenderEverywhere(String lenderId) {
        Instant now = Instant.now();
        String name = lenderName(lenderId);
        for (String id : applications.findSharedWith(lenderId).stream().map(LoanApplication::getId).toList()) {
            LoanApplication app = applications.findForUpdate(id).orElseThrow();
            if (won(app, lenderId)) continue;
            removeLender(app, lenderId, now);
            notifications.notify(app.getBeneficiaryId(), Notification.Type.warning, "Lender No Longer Available",
                    name + " is no longer available on this platform, so it can't see your application #" + app.getId() + " and any offer from it was withdrawn.");
        }
    }

    // ============================================================
    // Background
    // ============================================================

    @Transactional
    public int expireDueOffers(Instant now) {
        int expired = 0;
        for (String id : applications.findIdsWithExpiredOffers(OfferStatus.PENDING, now)) {
            LoanApplication app = applications.findForUpdate(id).orElseThrow();
            for (LoanOffer offer : app.getOffers()) {
                if (offer.getStatus() == OfferStatus.PENDING && offer.getExpiresAt() != null && !offer.getExpiresAt().isAfter(now)) {
                    offer.setStatus(OfferStatus.EXPIRED);
                    setDecision(app, offer.getLenderId(), DecisionStatus.UNDER_REVIEW, "Offer expired.", now);
                    notifications.notify(app.getBeneficiaryId(), Notification.Type.warning, "Offer Expired", "The offer from " + lenderName(offer.getLenderId()) + " on application #" + app.getId() + " has expired.");
                    notifications.notify(offer.getLenderId(), Notification.Type.info, "Offer Expired", "Your offer on application #" + app.getId() + " has expired.");
                    expired++;
                }
            }
            refreshStatus(app, now);
        }
        return expired;
    }
}
