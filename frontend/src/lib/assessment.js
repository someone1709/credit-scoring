// Illustrative rule-based assessment used until the ML service exists (Phase 3).
// It is deterministic and honest about what it is: probability_of_default and
// model_confidence stay null because no model has produced them (Master Brief §6.5).
// Every threshold here is a placeholder for the team to confirm.

import { dtiPercent, expenseRatioPercent, monthlySurplus } from './finance.js';

export function riskCategoryFor(riskScore) {
    if (riskScore <= 30) return 'LOW';
    if (riskScore <= 60) return 'MEDIUM';
    return 'HIGH';
}

export function incomeBracketFor(monthlyIncome) {
    if (monthlyIncome === null || !(monthlyIncome > 0)) return 'UNKNOWN';
    if (monthlyIncome >= 50000) return 'HIGH_INCOME';
    if (monthlyIncome >= 25000) return 'MID_INCOME';
    return 'LOW_INCOME';
}

export function segmentFor(compositeScore, bracket) {
    if (compositeScore >= 75 && bracket === 'HIGH_INCOME') return 'PRIME';
    if (compositeScore >= 70 && bracket === 'LOW_INCOME') return 'LOW_INCOME_PRIME';
    if (compositeScore >= 70) return 'STANDARD_PLUS';
    if (compositeScore >= 45) return 'STANDARD';
    if (compositeScore >= 30) return 'SUBPRIME';
    return 'HIGH_RISK';
}

function clampScore(value) {
    return Math.round(Math.max(0, Math.min(100, value)));
}

function computeRiskScore(req) {
    const dti = dtiPercent(req.existing_emi, req.monthly_income);
    const expenseRatio = expenseRatioPercent(req.monthly_expenses, req.monthly_income);
    const surplus = monthlySurplus(req.monthly_income, req.monthly_expenses, req.existing_emi);
    const loanToAnnualIncome = req.monthly_income > 0 ? req.loan_amount / (req.monthly_income * 12) : 0;

    let score = 30;

    if (dti > 40) score += 25;
    else if (dti > 25) score += 15;
    else if (dti > 10) score += 8;

    if (expenseRatio > 70) score += 20;
    else if (expenseRatio > 50) score += 10;
    else if (expenseRatio > 35) score += 5;

    // `none` is deliberately absent: no history must never add risk (Master Brief §5.3).
    if (req.repayment_history === 'poor') score += 20;
    else if (req.repayment_history === 'average') score += 8;
    else if (req.repayment_history === 'good') score -= 5;

    if (surplus < 2000) score += 10;
    else if (surplus > 10000) score -= 5;

    if (loanToAnnualIncome > 2) score += 15;
    else if (loanToAnnualIncome > 1) score += 8;

    return clampScore(score);
}

/** A separate measure from risk: 70% inverse risk, 30% affordability. Higher is more favourable. */
export function computeCompositeScore(riskScore, req) {
    const surplus = monthlySurplus(req.monthly_income, req.monthly_expenses, req.existing_emi);
    const surplusShare = req.monthly_income > 0 ? surplus / req.monthly_income : 0;
    const affordability = Math.max(0, Math.min(100, surplusShare * 200)); // 50% of income left scores 100
    return clampScore(0.7 * (100 - riskScore) + 0.3 * affordability);
}

function formatINR(amount) {
    return `₹${amount.toLocaleString('en-IN')}`;
}

function buildExplanations(req) {
    const dti = dtiPercent(req.existing_emi, req.monthly_income);
    const expenseRatio = expenseRatioPercent(req.monthly_expenses, req.monthly_income);
    const surplus = monthlySurplus(req.monthly_income, req.monthly_expenses, req.existing_emi);

    const explanations = [
        `Monthly income of ${formatINR(req.monthly_income)} is available for assessment.`,
        `Debt-to-income ratio is ${dti.toFixed(1)}%.`,
        `Expense-to-income ratio is ${expenseRatio.toFixed(1)}%.`,
        surplus >= 0
            ? `Monthly surplus after expenses and EMI is ${formatINR(surplus)}.`
            : `Expenses and EMI exceed monthly income by ${formatINR(Math.abs(surplus))}.`,
        `Requested amount of ${formatINR(req.loan_amount)} was compared with annual income.`,
    ];

    explanations.push(
        req.repayment_history === 'none'
            ? 'No repayment history is on record. This is not treated as poor history and adds no risk.'
            : `Repayment history is reported as ${req.repayment_history}.`,
    );

    if (req.electricity_usage !== null) {
        explanations.push('Electricity usage was provided but does not affect this score, because it is not assumed to be a reliable credit signal.');
    }

    return explanations;
}

export function assessCredit(req, verificationStatus) {
    const riskScore = computeRiskScore(req);
    const compositeScore = computeCompositeScore(riskScore, req);
    const incomeBracket = incomeBracketFor(req.monthly_income);

    return {
        beneficiary_id: req.beneficiary_id,
        risk_score: riskScore,
        risk_category: riskCategoryFor(riskScore),
        probability_of_default: null,
        model_confidence: null,
        income_bracket: incomeBracket,
        composite_score: compositeScore,
        segment: segmentFor(compositeScore, incomeBracket),
        is_thin_file: req.repayment_history === 'none',
        explanations: buildExplanations(req),
        explanation_method: 'RULE_BASED',
        verification_status: verificationStatus,
    };
}
