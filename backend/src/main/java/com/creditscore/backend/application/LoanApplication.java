package com.creditscore.backend.application;

import com.creditscore.backend.assessment.AssessmentContract.RepaymentHistory;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OneToOne;
import jakarta.persistence.OrderBy;
import jakarta.persistence.PrimaryKeyJoinColumn;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "loan_applications")
@Getter
@Setter
public class LoanApplication {

    @Id
    private String id;

    @Column(name = "beneficiary_id", nullable = false)
    private String beneficiaryId;

    @Column(name = "monthly_income", nullable = false, precision = 14, scale = 2)
    private BigDecimal monthlyIncome;

    @Column(name = "monthly_expenses", nullable = false, precision = 14, scale = 2)
    private BigDecimal monthlyExpenses;

    @Column(name = "existing_emi", nullable = false, precision = 14, scale = 2)
    private BigDecimal existingEmi;

    @Column(name = "loan_amount", nullable = false, precision = 14, scale = 2)
    private BigDecimal loanAmount;

    @Column(name = "loan_purpose", nullable = false)
    private String loanPurpose;

    @Column(name = "tenure_months", nullable = false)
    private int tenureMonths;

    @Enumerated(EnumType.STRING)
    @Column(name = "repayment_history", nullable = false)
    private RepaymentHistory repaymentHistory;

    @Column(name = "electricity_usage", precision = 10, scale = 2)
    private BigDecimal electricityUsage;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Enums.ApplicationStatus status;

    @Column(name = "consent_given_at", nullable = false)
    private Instant consentGivenAt;

    @Column(name = "submitted_at", nullable = false)
    private Instant submittedAt;

    @Column(name = "last_updated_at", nullable = false)
    private Instant lastUpdatedAt;

    @OneToOne(cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @PrimaryKeyJoinColumn
    private CreditAssessment assessment;

    // Removing a row takes away that lender's access, so it has to reach the database.
    @OneToMany(mappedBy = "application", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id ASC")
    private List<LenderDecision> lenderDecisions = new ArrayList<>();

    @OneToMany(mappedBy = "application", cascade = CascadeType.ALL)
    @OrderBy("createdAt ASC")
    private List<LoanOffer> offers = new ArrayList<>();

    @OneToMany(mappedBy = "application", cascade = CascadeType.ALL)
    @OrderBy("position ASC")
    private List<ApplicationDocument> documents = new ArrayList<>();

    @OneToMany(mappedBy = "application", cascade = CascadeType.ALL)
    @OrderBy("position ASC")
    private List<DisbursementStep> disbursementSteps = new ArrayList<>();

    public Optional<LoanOffer> acceptedOffer() {
        return offers.stream().filter(offer -> offer.getStatus() == Enums.OfferStatus.ACCEPTED).findFirst();
    }

    public Optional<LoanOffer> liveOfferFrom(String lenderId) {
        return offers.stream()
                .filter(offer -> offer.getLenderId().equals(lenderId) && offer.getStatus() == Enums.OfferStatus.PENDING)
                .findFirst();
    }

    public Optional<LenderDecision> decisionOf(String lenderId) {
        return lenderDecisions.stream().filter(decision -> decision.getLenderId().equals(lenderId)).findFirst();
    }
}
