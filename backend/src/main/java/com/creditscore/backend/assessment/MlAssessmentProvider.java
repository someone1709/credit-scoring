package com.creditscore.backend.assessment;

import com.creditscore.backend.config.AppProperties;
import java.math.BigDecimal;
import java.time.Duration;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.web.client.ClientHttpRequestFactories;
import org.springframework.boot.web.client.ClientHttpRequestFactorySettings;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Asks the FastAPI ML service for the assessment. If ML_SERVICE_URL isn't set, or the service can't
 * give a valid answer, the rules take over and the result says RULE_BASED, so an outage can't stop
 * someone applying and nothing is passed off as a model's output.
 */
@Slf4j
@Primary
@Component
public class MlAssessmentProvider implements AssessmentProvider {

    private final RuleBasedAssessmentProvider rules;
    private final RestClient client;

    public MlAssessmentProvider(AppProperties properties, RestClient.Builder builder, RuleBasedAssessmentProvider rules) {
        this.rules = rules;
        String url = properties.ml().url();
        if (url == null || url.isBlank()) {
            this.client = null;
        } else {
            Duration timeout = Duration.ofSeconds(properties.ml().timeoutSeconds());
            this.client = builder
                    .baseUrl(url)
                    .requestFactory(ClientHttpRequestFactories.get(ClientHttpRequestFactorySettings.DEFAULTS.withConnectTimeout(timeout).withReadTimeout(timeout)))
                    .build();
        }
    }

    private record ServiceHealth(String status) {}

    /** UP, DOWN, or OFF when no ML service is configured. Scoring still works in the last two, using the rules. */
    public String status() {
        if (client == null) return "OFF";
        try {
            // A service with no trained model is running but can't assess anyone, so it counts as down.
            ServiceHealth health = client.get().uri("/health").retrieve().body(ServiceHealth.class);
            return health != null && "UP".equals(health.status()) ? "UP" : "DOWN";
        } catch (RestClientException e) {
            return "DOWN";
        }
    }

    @Override
    public AssessmentContract.Response assess(AssessmentContract.Request request, AssessmentContract.VerificationStatus verificationStatus) {
        if (client == null) return rules.assess(request, verificationStatus);
        try {
            AssessmentContract.Response response = client.post()
                    .uri("/assess")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(request)
                    .retrieve()
                    .body(AssessmentContract.Response.class);
            requireValid(response, request);
            return withVerification(response, verificationStatus);
        } catch (RestClientException | IllegalArgumentException e) {
            // No request details here: the log shouldn't hold anyone's finances.
            log.warn("ML service gave no usable assessment, so using the rules instead: {}", e.getClass().getSimpleName());
            return rules.assess(request, verificationStatus);
        }
    }

    private static void requireValid(AssessmentContract.Response response, AssessmentContract.Request request) {
        boolean valid = response != null
                && request.beneficiaryId().equals(response.beneficiaryId())
                && inScoreRange(response.riskScore())
                && inScoreRange(response.compositeScore())
                && response.riskCategory() != null
                && response.incomeBracket() != null
                && response.segment() != null
                && response.explanationMethod() != null
                && response.explanations() != null
                && !response.explanations().isEmpty()
                && isProbability(response.probabilityOfDefault())
                && isProbability(response.modelConfidence());
        if (!valid) throw new IllegalArgumentException("Response breaks the contract");
    }

    private static boolean inScoreRange(int score) {
        return score >= 0 && score <= 100;
    }

    /** Both may be null when unavailable (Master Brief §6.5). */
    private static boolean isProbability(BigDecimal value) {
        return value == null || (value.signum() >= 0 && value.compareTo(BigDecimal.ONE) <= 0);
    }

    /** The ML request carries no document data, so this status always comes from the application's documents. */
    private static AssessmentContract.Response withVerification(AssessmentContract.Response r, AssessmentContract.VerificationStatus status) {
        return new AssessmentContract.Response(r.beneficiaryId(), r.riskScore(), r.riskCategory(), r.probabilityOfDefault(), r.modelConfidence(),
                r.incomeBracket(), r.compositeScore(), r.segment(), r.isThinFile(), r.explanations(), r.explanationMethod(), status);
    }
}
