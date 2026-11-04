package com.creditscore.backend.application;

import com.creditscore.backend.application.ApplicationDtos.ApplicantProfileDto;
import com.creditscore.backend.application.ApplicationDtos.ApplicationDto;
import com.creditscore.backend.application.ApplicationDtos.DecisionDto;
import com.creditscore.backend.application.ApplicationDtos.DocumentDto;
import com.creditscore.backend.application.ApplicationDtos.OfferDto;
import com.creditscore.backend.application.ApplicationDtos.StepDto;
import com.creditscore.backend.assessment.AssessmentContract;
import com.creditscore.backend.user.BeneficiaryProfile;
import com.creditscore.backend.user.LenderProfile;
import com.creditscore.backend.user.Repositories.BeneficiaryProfileRepository;
import com.creditscore.backend.user.Repositories.LenderProfileRepository;
import java.time.format.DateTimeFormatter;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** Turns stored applications into responses. This is where one lender is kept from seeing another's data. */
@Component
@RequiredArgsConstructor
class ApplicationMapper {

    private static final DateTimeFormatter STEP_DATE = DateTimeFormatter.ofPattern("dd MMM yyyy", Locale.ENGLISH);

    private final BeneficiaryProfileRepository beneficiaries;
    private final LenderProfileRepository lenders;
    private final DocumentFileRepository documentFiles;

    ApplicationDto forBeneficiary(LoanApplication app) {
        return toDto(app, lenderProfiles(app), app.getStatus(), app.getLenderDecisions(), app.getOffers(), app.getDisbursementSteps(), null, true);
    }

    ApplicationDto forLender(LoanApplication app, String lenderId) {
        boolean won = app.acceptedOffer().filter(offer -> offer.getLenderId().equals(lenderId)).isPresent();
        boolean closed = app.acceptedOffer().isPresent() && !won;
        return toDto(
                app,
                lenderProfiles(app),
                won ? app.getStatus() : null,
                app.getLenderDecisions().stream().filter(decision -> decision.getLenderId().equals(lenderId)).toList(),
                app.getOffers().stream().filter(offer -> offer.getLenderId().equals(lenderId)).toList(),
                won ? app.getDisbursementSteps() : List.of(),
                closed,
                !closed);
    }

    /** Offers stay on record after a lender's access is removed, so they still need that lender's name. */
    private Map<String, LenderProfile> lenderProfiles(LoanApplication app) {
        Set<String> ids = new HashSet<>();
        app.getLenderDecisions().forEach(decision -> ids.add(decision.getLenderId()));
        app.getOffers().forEach(offer -> ids.add(offer.getLenderId()));
        return lenders.findAllById(ids).stream().collect(Collectors.toMap(LenderProfile::getUserId, Function.identity()));
    }

    private ApplicationDto toDto(LoanApplication app, Map<String, LenderProfile> profiles, Enums.ApplicationStatus status,
                                 List<LenderDecision> decisions, List<LoanOffer> offers, List<DisbursementStep> steps, Boolean closedToLender, boolean filesVisible) {
        BeneficiaryProfile beneficiary = beneficiaries.findById(app.getBeneficiaryId()).orElseThrow();
        Set<String> storedFiles = filesVisible
                ? documentFiles.findStoredIds(app.getDocuments().stream().map(ApplicationDocument::getId).toList())
                : Set.of();
        return new ApplicationDto(
                app.getId(),
                app.getBeneficiaryId(),
                beneficiary.getName(),
                new ApplicantProfileDto(beneficiary.getOccupation(), beneficiary.getCity(), beneficiary.getState()),
                app.getConsentGivenAt(),
                app.getMonthlyIncome(),
                app.getMonthlyExpenses(),
                app.getExistingEmi(),
                app.getLoanAmount(),
                app.getLoanPurpose(),
                app.getTenureMonths(),
                app.getRepaymentHistory(),
                app.getElectricityUsage(),
                status,
                app.getSubmittedAt(),
                app.getLastUpdatedAt(),
                assessment(app),
                app.getDocuments().stream().map(doc -> document(doc, app, storedFiles.contains(doc.getId()))).toList(),
                decisions.stream().map(decision -> decision(decision, app, profiles)).toList(),
                offers.stream().map(offer -> offer(offer, app, profiles)).toList(),
                steps.stream().map(ApplicationMapper::step).toList(),
                closedToLender);
    }

    private static AssessmentContract.Response assessment(LoanApplication app) {
        CreditAssessment a = app.getAssessment();
        if (a == null) return null;
        return new AssessmentContract.Response(app.getBeneficiaryId(), a.getRiskScore(), a.getRiskCategory(), a.getProbabilityOfDefault(),
                a.getModelConfidence(), a.getIncomeBracket(), a.getCompositeScore(), a.getSegment(), a.isThinFile(), a.getExplanations(),
                a.getExplanationMethod(), a.getVerificationStatus());
    }

    private static DocumentDto document(ApplicationDocument doc, LoanApplication app, boolean fileAvailable) {
        return new DocumentDto(doc.getId(), app.getId(), app.getBeneficiaryId(), doc.getType(), doc.getLabel(), doc.getFilename(),
                doc.getUploadedAt(), doc.getVerificationStatus(), doc.getCheckNote(), fileAvailable);
    }

    private static DecisionDto decision(LenderDecision decision, LoanApplication app, Map<String, LenderProfile> profiles) {
        return new DecisionDto(decision.getLenderId(), profiles.get(decision.getLenderId()).getInstitutionName(), app.getId(),
                decision.getStatus(), decision.getLastUpdated(), decision.getNote(), decision.getApplicantReply(), decision.getApplicantReplyAt());
    }

    private static OfferDto offer(LoanOffer offer, LoanApplication app, Map<String, LenderProfile> profiles) {
        LenderProfile lender = profiles.get(offer.getLenderId());
        return new OfferDto(offer.getId(), offer.getLenderId(), lender.getInstitutionName(), lender.logoInitials(), lender.getLogoColor(),
                app.getId(), app.getBeneficiaryId(), offer.getAmount(), offer.getInterestRate(), offer.getTenureMonths(), offer.getStatus(),
                offer.getFeatures(), offer.getCreatedAt(), offer.getExpiresAt());
    }

    private static StepDto step(DisbursementStep step) {
        return new StepDto(step.getLabel(), step.getStatus(), step.getCompletedOn() == null ? null : STEP_DATE.format(step.getCompletedOn()));
    }
}
