package com.creditscore.backend.assessment;

import com.creditscore.backend.assessment.AssessmentContract.ExplanationMethod;
import com.creditscore.backend.assessment.AssessmentContract.IncomeBracket;
import com.creditscore.backend.assessment.AssessmentContract.RepaymentHistory;
import com.creditscore.backend.assessment.AssessmentContract.RiskCategory;
import com.creditscore.backend.assessment.AssessmentContract.Segment;
import java.math.BigDecimal;
import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.springframework.stereotype.Component;

/**
 * Illustrative rules, used when the ML service is off or fails. They match frontend/src/lib/assessment.ts.
 * probability_of_default and model_confidence stay null because no model produced them (Master Brief §6.5).
 * Every threshold is a placeholder for the team to confirm.
 */
@Component
public class RuleBasedAssessmentProvider implements AssessmentProvider {

    private static final Locale INDIA = Locale.of("en", "IN");

    @Override
    public AssessmentContract.Response assess(AssessmentContract.Request request, AssessmentContract.VerificationStatus verificationStatus) {
        double income = request.monthlyIncome().doubleValue();
        double expenses = request.monthlyExpenses().doubleValue();
        double emi = request.existingEmi().doubleValue();
        double loan = request.loanAmount().doubleValue();

        double dti = income > 0 ? emi / income * 100 : 0;
        double expenseRatio = income > 0 ? expenses / income * 100 : 0;
        double surplus = income - expenses - emi;

        int risk = riskScore(dti, expenseRatio, surplus, income > 0 ? loan / (income * 12) : 0, request.repaymentHistory());
        int composite = compositeScore(risk, income > 0 ? surplus / income : 0);
        IncomeBracket bracket = bracketFor(income);

        return new AssessmentContract.Response(
                request.beneficiaryId(),
                risk,
                categoryFor(risk),
                null,
                null,
                bracket,
                composite,
                segmentFor(composite, bracket),
                request.repaymentHistory() == RepaymentHistory.none,
                explanations(request, dti, expenseRatio, surplus),
                ExplanationMethod.RULE_BASED,
                verificationStatus);
    }

    private static int riskScore(double dti, double expenseRatio, double surplus, double loanToAnnualIncome, RepaymentHistory history) {
        int score = 30;

        if (dti > 40) score += 25;
        else if (dti > 25) score += 15;
        else if (dti > 10) score += 8;

        if (expenseRatio > 70) score += 20;
        else if (expenseRatio > 50) score += 10;
        else if (expenseRatio > 35) score += 5;

        // `none` is deliberately absent: no history must never add risk (Master Brief §5.3).
        if (history == RepaymentHistory.poor) score += 20;
        else if (history == RepaymentHistory.average) score += 8;
        else if (history == RepaymentHistory.good) score -= 5;

        if (surplus < 2000) score += 10;
        else if (surplus > 10000) score -= 5;

        if (loanToAnnualIncome > 2) score += 15;
        else if (loanToAnnualIncome > 1) score += 8;

        return clamp(score);
    }

    /** A separate measure from risk: 70% inverse risk, 30% affordability. Higher is more favourable. */
    private static int compositeScore(int risk, double surplusShare) {
        double affordability = Math.max(0, Math.min(100, surplusShare * 200)); // 50% of income left scores 100
        return clamp((int) Math.round(0.7 * (100 - risk) + 0.3 * affordability));
    }

    private static int clamp(int score) {
        return Math.max(0, Math.min(100, score));
    }

    private static RiskCategory categoryFor(int risk) {
        if (risk <= 30) return RiskCategory.LOW;
        if (risk <= 60) return RiskCategory.MEDIUM;
        return RiskCategory.HIGH;
    }

    private static IncomeBracket bracketFor(double income) {
        if (income <= 0) return IncomeBracket.UNKNOWN;
        if (income >= 50000) return IncomeBracket.HIGH_INCOME;
        if (income >= 25000) return IncomeBracket.MID_INCOME;
        return IncomeBracket.LOW_INCOME;
    }

    private static Segment segmentFor(int composite, IncomeBracket bracket) {
        if (composite >= 75 && bracket == IncomeBracket.HIGH_INCOME) return Segment.PRIME;
        if (composite >= 70 && bracket == IncomeBracket.LOW_INCOME) return Segment.LOW_INCOME_PRIME;
        if (composite >= 70) return Segment.STANDARD_PLUS;
        if (composite >= 45) return Segment.STANDARD;
        if (composite >= 30) return Segment.SUBPRIME;
        return Segment.HIGH_RISK;
    }

    private static List<String> explanations(AssessmentContract.Request request, double dti, double expenseRatio, double surplus) {
        List<String> lines = new ArrayList<>();
        lines.add("Monthly income of " + inr(request.monthlyIncome()) + " is available for assessment.");
        lines.add(String.format(Locale.ROOT, "Debt-to-income ratio is %.1f%%.", dti));
        lines.add(String.format(Locale.ROOT, "Expense-to-income ratio is %.1f%%.", expenseRatio));
        lines.add(surplus >= 0
                ? "Monthly surplus after expenses and EMI is " + inr(BigDecimal.valueOf(surplus)) + "."
                : "Expenses and EMI exceed monthly income by " + inr(BigDecimal.valueOf(Math.abs(surplus))) + ".");
        lines.add("Requested amount of " + inr(request.loanAmount()) + " was compared with annual income.");
        lines.add(request.repaymentHistory() == RepaymentHistory.none
                ? "No repayment history is on record. This is not treated as poor history and adds no risk."
                : "Repayment history is reported as " + request.repaymentHistory() + ".");
        if (request.electricityUsage() != null) {
            lines.add("Electricity usage was provided but does not affect this score, because it is not assumed to be a reliable credit signal.");
        }
        return lines;
    }

    private static String inr(BigDecimal amount) {
        NumberFormat format = NumberFormat.getNumberInstance(INDIA);
        format.setMaximumFractionDigits(2);
        return "₹" + format.format(amount);
    }
}
