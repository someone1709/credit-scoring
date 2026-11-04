package com.creditscore.backend.application;

import com.creditscore.backend.assessment.AssessmentContract;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/** The wire format of the lending routes. Must match frontend/src/services/app/http.ts. */
public final class ApplicationDtos {

    // Catches typing mistakes. It isn't a lending rule.
    private static final String SANITY_LIMIT = "100000000";
    private static final String CHECK_AMOUNT = "Please check this amount";

    private ApplicationDtos() {}

    public record SubmitApplicationRequest(
            @NotNull(message = "Enter the loan amount") @Positive(message = "Must be greater than 0") @DecimalMax(value = SANITY_LIMIT, message = CHECK_AMOUNT) BigDecimal loanAmount,
            @NotNull(message = "Choose a purpose") @Pattern(regexp = "Education|Medical|Business|Personal|Home Improvement|Agriculture|Other", message = "Choose a valid purpose") String loanPurpose,
            @NotNull(message = "Choose a tenure") @Min(value = 1, message = "Choose a valid tenure") @Max(value = 120, message = "Choose a valid tenure") Integer tenureMonths,
            @NotNull(message = "Enter your monthly income") @Positive(message = "Must be greater than 0") @DecimalMax(value = SANITY_LIMIT, message = CHECK_AMOUNT) BigDecimal monthlyIncome,
            @NotNull(message = "Enter your monthly expenses") @PositiveOrZero(message = "Cannot be negative") @DecimalMax(value = SANITY_LIMIT, message = CHECK_AMOUNT) BigDecimal monthlyExpenses,
            @NotNull(message = "Enter your existing EMI, or 0") @PositiveOrZero(message = "Cannot be negative") @DecimalMax(value = SANITY_LIMIT, message = CHECK_AMOUNT) BigDecimal existingEmi,
            // Required with no default: the applicant states this, so "none" is never assumed for them.
            @NotNull(message = "Select your repayment history") AssessmentContract.RepaymentHistory repaymentHistory,
            @PositiveOrZero(message = "Cannot be negative") @DecimalMax(value = "99999999", message = CHECK_AMOUNT) BigDecimal electricityUsage,
            @NotEmpty(message = "Choose at least one lender") @Size(max = 50) List<@NotNull String> lenderIds,
            boolean consent) {}

    public record DecisionRequest(
            @NotNull(message = "Choose a decision") Enums.DecisionStatus status,
            @Size(max = 500, message = "Use 500 characters or fewer") String note) {}

    public record CreateOfferRequest(
            @NotNull(message = "Enter an amount") @Positive(message = "Amount must be greater than 0") @DecimalMax(value = SANITY_LIMIT, message = CHECK_AMOUNT) BigDecimal amount,
            @NotNull(message = "Enter an interest rate") @DecimalMin(value = "0", message = "Cannot be negative") @DecimalMax(value = "60", message = "Please check this rate") BigDecimal interestRate,
            @NotNull(message = "Choose a tenure") @Min(value = 1, message = "Choose a valid tenure") @Max(value = 120, message = "Choose a valid tenure") Integer tenureMonths,
            @Size(max = 10, message = "Use 10 features or fewer") List<@Size(max = 40, message = "Use 40 characters or fewer per feature") String> features) {}

    public record ApplicantProfileDto(String occupation, String city, String state) {}

    public record DocumentDto(String id, String applicationId, String beneficiaryId, Enums.DocumentType type, String label, String filename,
                              Instant uploadedAt, AssessmentContract.VerificationStatus verificationStatus, String checkNote) {}

    public record DecisionDto(String lenderId, String lenderName, String applicationId, Enums.DecisionStatus status, Instant lastUpdated, String note) {}

    public record OfferDto(String id, String lenderId, String lenderName, String lenderLogoInitials, String lenderLogoColor, String applicationId,
                           String beneficiaryId, BigDecimal amount, BigDecimal interestRate, int tenureMonths, Enums.OfferStatus status,
                           List<String> features, Instant createdAt, Instant expiresAt) {}

    public record StepDto(String label, Enums.StepStatus status, String date) {}

    /**
     * For a lender, this holds only that lender's own decision and offers. status is null unless their
     * offer won, because the overall status would reveal what other lenders did.
     */
    public record ApplicationDto(String id, String beneficiaryId, String beneficiaryName, ApplicantProfileDto applicantProfile, Instant consentGivenAt,
                                 BigDecimal monthlyIncome, BigDecimal monthlyExpenses, BigDecimal existingEmi, BigDecimal loanAmount, String loanPurpose,
                                 int tenureMonths, AssessmentContract.RepaymentHistory repaymentHistory, BigDecimal electricityUsage,
                                 Enums.ApplicationStatus status, Instant submittedAt, Instant lastUpdatedAt, AssessmentContract.Response assessment,
                                 List<DocumentDto> documents, List<DecisionDto> lenderDecisions, List<OfferDto> offers, List<StepDto> disbursementSteps,
                                 Boolean closedToLender) {}
}
