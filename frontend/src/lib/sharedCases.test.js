// The answers in shared/scoring_cases.json, which the backend and the ML service must also give.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assessCredit, computeCompositeScore, incomeBracketFor, riskCategoryFor, segmentFor } from './assessment.js';

const cases = JSON.parse(readFileSync(new URL('../../../shared/scoring_cases.json', import.meta.url), 'utf8'));

describe('shared scoring cases', () => {
    it('risk categories', () => {
        for (const c of cases.risk_categories) assert.equal(riskCategoryFor(c.risk_score), c.expected, `risk ${c.risk_score}`);
    });

    it('income brackets', () => {
        for (const c of cases.income_brackets) assert.equal(incomeBracketFor(c.monthly_income), c.expected, `income ${c.monthly_income}`);
    });

    it('segments', () => {
        for (const c of cases.segments) assert.equal(segmentFor(c.composite_score, c.income_bracket), c.expected, `${c.composite_score} ${c.income_bracket}`);
    });

    it('composite scores', () => {
        for (const c of cases.composite_scores) {
            const request = { beneficiary_id: 'CASE', monthly_income: c.monthly_income, monthly_expenses: c.monthly_expenses, existing_emi: c.existing_emi, loan_amount: 1, repayment_history: 'none', electricity_usage: null };
            assert.equal(computeCompositeScore(c.risk_score, request), c.expected, c.name);
        }
    });

    it('whole rule-based assessments', () => {
        for (const c of cases.rule_based) {
            const result = assessCredit({ beneficiary_id: 'CASE', electricity_usage: null, ...c.input }, 'NOT_PROVIDED');
            const { risk_score, risk_category, income_bracket, composite_score, segment, is_thin_file } = result;
            assert.deepEqual({ risk_score, risk_category, income_bracket, composite_score, segment, is_thin_file }, c.expected, c.name);
        }
    });
});
