package com.creditscore.backend.assessment;

import java.math.BigDecimal;
import java.util.List;

/** The fixed contract from Master Brief §6. These enums and field names must not change. */
public final class AssessmentContract {

    private AssessmentContract() {}

    public enum RiskCategory { LOW, MEDIUM, HIGH }

    public enum IncomeBracket { LOW_INCOME, MID_INCOME, HIGH_INCOME, UNKNOWN }

    public enum Segment { PRIME, STANDARD_PLUS, LOW_INCOME_PRIME, STANDARD, SUBPRIME, HIGH_RISK }

    /** Lowercase because the contract fixes these values as lowercase. */
    public enum RepaymentHistory { good, average, poor, none }

    public enum ExplanationMethod { SHAP, RULE_BASED }

    public enum VerificationStatus { DEMO_UNVERIFIED, DOCUMENT_UPLOADED, CHECKS_PASSED, CHECKS_FAILED, NOT_PROVIDED }

    public record Request(String beneficiaryId, BigDecimal monthlyIncome, BigDecimal monthlyExpenses, BigDecimal existingEmi,
                          BigDecimal loanAmount, RepaymentHistory repaymentHistory, BigDecimal electricityUsage) {}

    public record Response(String beneficiaryId, int riskScore, RiskCategory riskCategory, BigDecimal probabilityOfDefault,
                           BigDecimal modelConfidence, IncomeBracket incomeBracket, int compositeScore, Segment segment,
                           boolean isThinFile, List<String> explanations, ExplanationMethod explanationMethod,
                           VerificationStatus verificationStatus) {}
}
