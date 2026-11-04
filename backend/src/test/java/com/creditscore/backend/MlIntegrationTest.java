package com.creditscore.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.Executors;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.web.multipart.MultipartFile;

/** The backend against a stand-in ML service, including every way that service can let it down. */
class MlIntegrationTest extends ApiTestSupport {

    private static final String VALID = """
            {"beneficiary_id":"%s","risk_score":28,"risk_category":"LOW","probability_of_default":0.08,"model_confidence":null,
             "income_bracket":"LOW_INCOME","composite_score":72,"segment":"LOW_INCOME_PRIME","is_thin_file":true,
             "explanations":["Debt-to-income ratio of 0.0%% lowered the estimated risk."],"explanation_method":"SHAP","verification_status":"DEMO_UNVERIFIED"}
            """;

    private static HttpServer server;
    private static volatile int responseStatus = 200;
    private static volatile String responseBody = null;
    private static volatile long delayMillis = 0;
    private static volatile String lastRequest = null;

    private static synchronized HttpServer server() throws IOException {
        if (server == null) {
            server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            server.setExecutor(Executors.newCachedThreadPool());
            server.createContext("/assess", exchange -> {
                lastRequest = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
                try {
                    Thread.sleep(delayMillis);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
                String id = lastRequest.replaceAll(".*\"beneficiary_id\":\"([^\"]+)\".*", "$1");
                byte[] body = (responseBody != null ? responseBody : VALID.formatted(id)).getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().add("Content-Type", "application/json");
                exchange.sendResponseHeaders(responseStatus, body.length);
                exchange.getResponseBody().write(body);
                exchange.close();
            });
            server.start();
        }
        return server;
    }

    @DynamicPropertySource
    static void mlUrl(DynamicPropertyRegistry registry) throws IOException {
        int port = server().getAddress().getPort();
        registry.add("app.ml.url", () -> "http://127.0.0.1:" + port);
        registry.add("app.ml.timeout-seconds", () -> 1);
    }

    @AfterAll
    static void stop() {
        if (server != null) server.stop(0);
        server = null;
    }

    @BeforeEach
    void reset() {
        responseStatus = 200;
        responseBody = null;
        delayMillis = 0;
    }

    private JsonNode apply() throws Exception {
        Account beneficiary = newBeneficiaryWithProfile();
        Account lender = newLender("ML Bank");
        return body(postJson("/applications", beneficiary, applicationBody(List.of(lender.id()))).andExpect(status().isCreated()));
    }

    private static void assertFellBackToRules(JsonNode app) {
        assertThat(app.at("/assessment/explanation_method").asText()).isEqualTo("RULE_BASED");
        assertThat(app.at("/assessment/probability_of_default").isNull()).isTrue();
        assertThat(app.at("/assessment/risk_score").asInt()).isEqualTo(30);
    }

    @Test
    void theModelsAnswerIsStoredAndReturned() throws Exception {
        JsonNode app = apply();
        assertThat(app.at("/assessment/explanation_method").asText()).isEqualTo("SHAP");
        assertThat(app.at("/assessment/probability_of_default").asDouble()).isEqualTo(0.08);
        assertThat(app.at("/assessment/model_confidence").isNull()).isTrue();
        assertThat(app.at("/assessment/risk_score").asInt()).isEqualTo(28);
        assertThat(app.at("/assessment/composite_score").asInt()).isEqualTo(72);
        assertThat(app.at("/assessment/explanations/0").asText()).contains("lowered the estimated risk");
    }

    @Test
    void theRequestUsesTheExactContract() throws Exception {
        apply();
        JsonNode sent = json.readTree(lastRequest);
        assertThat(sent.fieldNames()).toIterable().containsExactlyInAnyOrder(
                "beneficiary_id", "monthly_income", "monthly_expenses", "existing_emi", "loan_amount", "repayment_history", "electricity_usage");
        assertThat(sent.get("repayment_history").asText()).isEqualTo("none");
        assertThat(sent.get("monthly_income").asInt()).isEqualTo(24000);
        assertThat(sent.get("electricity_usage").isNull()).isTrue();
    }

    @Test
    void verificationStatusComesFromTheDocumentsNotTheModel() throws Exception {
        JsonNode app = apply();
        assertThat(app.at("/assessment/verification_status").asText()).isEqualTo("NOT_PROVIDED");
    }

    @Test
    void aServerErrorFallsBackToHonestRules() throws Exception {
        responseStatus = 503;
        responseBody = "{\"error\":\"MODEL_UNAVAILABLE\",\"message\":\"x\",\"details\":[]}";
        assertFellBackToRules(apply());
    }

    @Test
    void aSlowServiceDoesNotHoldUpTheApplicant() throws Exception {
        delayMillis = 2500;
        long start = System.nanoTime();
        JsonNode app = apply();
        assertFellBackToRules(app);
        assertThat((System.nanoTime() - start) / 1_000_000).isLessThan(2400);
    }

    @Test
    void anUnreadableAnswerFallsBack() throws Exception {
        responseBody = "<html>not json</html>";
        assertFellBackToRules(apply());
    }

    @Test
    void anAnswerThatBreaksTheContractIsNotTrusted() throws Exception {
        responseBody = "{\"beneficiary_id\":\"x\",\"risk_score\":250}";
        assertFellBackToRules(apply());
    }

    @Test
    void anAnswerForSomeoneElseIsNotTrusted() throws Exception {
        responseBody = VALID.formatted("SOMEONE-ELSE");
        assertFellBackToRules(apply());
    }

    @Test
    void anImpossibleProbabilityIsNotTrusted() throws Exception {
        Account beneficiary = newBeneficiaryWithProfile();
        responseBody = VALID.formatted(beneficiary.id()).replace("0.08", "1.8");
        Account lender = newLender("Bad Probability Bank");
        assertFellBackToRules(body(postJson("/applications", beneficiary, applicationBody(List.of(lender.id()))).andExpect(status().isCreated())));
    }
}
