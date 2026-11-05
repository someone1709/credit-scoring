package com.creditscore.backend.assessment;

import static org.assertj.core.api.Assertions.assertThat;

import com.creditscore.backend.assessment.AssessmentContract.IncomeBracket;
import com.creditscore.backend.assessment.AssessmentContract.RepaymentHistory;
import com.creditscore.backend.assessment.AssessmentContract.VerificationStatus;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Path;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

/** The answers in shared/scoring_cases.json, which the website and the ML service must also give. */
class SharedScoringCasesTest {

    private static JsonNode cases;

    @BeforeAll
    static void read() throws IOException {
        cases = new ObjectMapper().readTree(Path.of("..", "shared", "scoring_cases.json").toFile());
    }

    @Test
    void riskCategories() {
        for (JsonNode c : cases.get("risk_categories")) {
            assertThat(RuleBasedAssessmentProvider.categoryFor(c.get("risk_score").asInt()).name())
                    .as(c.toString()).isEqualTo(c.get("expected").asText());
        }
    }

    @Test
    void incomeBrackets() {
        for (JsonNode c : cases.get("income_brackets")) {
            assertThat(RuleBasedAssessmentProvider.bracketFor(c.get("monthly_income").asDouble()).name())
                    .as(c.toString()).isEqualTo(c.get("expected").asText());
        }
    }

    @Test
    void segments() {
        for (JsonNode c : cases.get("segments")) {
            IncomeBracket bracket = IncomeBracket.valueOf(c.get("income_bracket").asText());
            assertThat(RuleBasedAssessmentProvider.segmentFor(c.get("composite_score").asInt(), bracket).name())
                    .as(c.toString()).isEqualTo(c.get("expected").asText());
        }
    }

    @Test
    void compositeScores() {
        for (JsonNode c : cases.get("composite_scores")) {
            double income = c.get("monthly_income").asDouble();
            double surplus = income - c.get("monthly_expenses").asDouble() - c.get("existing_emi").asDouble();
            assertThat(RuleBasedAssessmentProvider.compositeScore(c.get("risk_score").asInt(), income > 0 ? surplus / income : 0))
                    .as(c.get("name").asText()).isEqualTo(c.get("expected").asInt());
        }
    }

    @Test
    void wholeRuleBasedAssessments() {
        RuleBasedAssessmentProvider provider = new RuleBasedAssessmentProvider();
        for (JsonNode c : cases.get("rule_based")) {
            JsonNode input = c.get("input");
            JsonNode expected = c.get("expected");
            AssessmentContract.Response result = provider.assess(new AssessmentContract.Request(
                    "CASE",
                    new BigDecimal(input.get("monthly_income").asText()),
                    new BigDecimal(input.get("monthly_expenses").asText()),
                    new BigDecimal(input.get("existing_emi").asText()),
                    new BigDecimal(input.get("loan_amount").asText()),
                    RepaymentHistory.valueOf(input.get("repayment_history").asText()),
                    null), VerificationStatus.NOT_PROVIDED);

            String name = c.get("name").asText();
            assertThat(result.riskScore()).as(name).isEqualTo(expected.get("risk_score").asInt());
            assertThat(result.riskCategory().name()).as(name).isEqualTo(expected.get("risk_category").asText());
            assertThat(result.incomeBracket().name()).as(name).isEqualTo(expected.get("income_bracket").asText());
            assertThat(result.compositeScore()).as(name).isEqualTo(expected.get("composite_score").asInt());
            assertThat(result.segment().name()).as(name).isEqualTo(expected.get("segment").asText());
            assertThat(result.isThinFile()).as(name).isEqualTo(expected.get("is_thin_file").asBoolean());
        }
    }
}
