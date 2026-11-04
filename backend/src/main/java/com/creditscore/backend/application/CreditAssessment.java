package com.creditscore.backend.application;

import com.creditscore.backend.assessment.AssessmentContract;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.List;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "credit_assessments")
@Getter
@Setter
public class CreditAssessment {

    @Id
    @Column(name = "application_id")
    private String applicationId;

    @Column(name = "risk_score", nullable = false)
    private int riskScore;

    @Enumerated(EnumType.STRING)
    @Column(name = "risk_category", nullable = false)
    private AssessmentContract.RiskCategory riskCategory;

    @Column(name = "probability_of_default", precision = 5, scale = 4)
    private BigDecimal probabilityOfDefault;

    @Column(name = "model_confidence", precision = 5, scale = 4)
    private BigDecimal modelConfidence;

    @Enumerated(EnumType.STRING)
    @Column(name = "income_bracket", nullable = false)
    private AssessmentContract.IncomeBracket incomeBracket;

    @Column(name = "composite_score", nullable = false)
    private int compositeScore;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AssessmentContract.Segment segment;

    @Column(name = "is_thin_file", nullable = false)
    private boolean thinFile;

    @Convert(converter = StringListConverter.class)
    @Column(nullable = false, columnDefinition = "TEXT")
    private List<String> explanations;

    @Enumerated(EnumType.STRING)
    @Column(name = "explanation_method", nullable = false)
    private AssessmentContract.ExplanationMethod explanationMethod;

    @Enumerated(EnumType.STRING)
    @Column(name = "verification_status", nullable = false)
    private AssessmentContract.VerificationStatus verificationStatus;
}
