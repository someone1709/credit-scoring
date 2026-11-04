package com.creditscore.backend;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
abstract class ApiTestSupport {

    private static final AtomicInteger COUNTER = new AtomicInteger();
    static final String PASSWORD = "Strong123";

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    record Account(String id, String token, Cookie refreshCookie, String email) {}

    ResultActions call(MockHttpServletRequestBuilder request, Account as, Object body) throws Exception {
        if (as != null) request.header(HttpHeaders.AUTHORIZATION, "Bearer " + as.token());
        if (body != null) request.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(body));
        return mvc.perform(request.contextPath("/api/v1"));
    }

    ResultActions postJson(String path, Account as, Object body) throws Exception {
        return call(post("/api/v1" + path), as, body);
    }

    ResultActions getJson(String path, Account as) throws Exception {
        return call(get("/api/v1" + path), as, null);
    }

    ResultActions patchJson(String path, Account as, Object body) throws Exception {
        return call(patch("/api/v1" + path), as, body);
    }

    JsonNode body(ResultActions result) throws Exception {
        return json.readTree(result.andReturn().getResponse().getContentAsByteArray());
    }

    static String uniqueEmail() {
        return "user" + COUNTER.incrementAndGet() + "@example.com";
    }

    private Account signedUp(Map<String, Object> request) throws Exception {
        var response = postJson("/auth/register", null, request).andReturn().getResponse();
        JsonNode node = json.readTree(response.getContentAsByteArray());
        if (response.getStatus() != 201) throw new AssertionError("register failed: " + node);
        return new Account(node.at("/user/id").asText(), node.get("access_token").asText(), response.getCookie("refresh_token"), node.at("/user/email").asText());
    }

    Account newLender(String name) throws Exception {
        return signedUp(Map.of("role", "lender", "email", uniqueEmail(), "phone", "9876543210", "password", PASSWORD,
                "institution_name", name, "contact_person", "Contact Person", "license_number", "LIC-1"));
    }

    Account newBeneficiary() throws Exception {
        return signedUp(Map.of("role", "beneficiary", "email", uniqueEmail(), "phone", "9876543210", "password", PASSWORD, "name", "Test Applicant"));
    }

    Account newBeneficiaryWithProfile() throws Exception {
        Account account = newBeneficiary();
        patchJson("/auth/me", account, Map.of("name", "Test Applicant", "email", account.email(), "phone", "9876543210", "occupation", "Tailor",
                "address", "5 Market Street", "city", "Pune", "state", "Maharashtra", "pincode", "411001"))
                .andReturn();
        return account;
    }

    Map<String, Object> applicationBody(List<String> lenderIds) {
        return new java.util.HashMap<>(Map.of(
                "loan_amount", 40000, "loan_purpose", "Business", "tenure_months", 12, "monthly_income", 24000, "monthly_expenses", 9000,
                "existing_emi", 0, "repayment_history", "none", "lender_ids", lenderIds, "consent", true));
    }

    String submit(Account beneficiary, Account... lenders) throws Exception {
        List<String> ids = java.util.Arrays.stream(lenders).map(Account::id).toList();
        var response = postJson("/applications", beneficiary, applicationBody(ids)).andReturn().getResponse();
        JsonNode node = json.readTree(response.getContentAsByteArray());
        if (response.getStatus() != 201) throw new AssertionError("submit failed: " + node);
        return node.get("id").asText();
    }

    String offer(Account lender, String applicationId) throws Exception {
        var response = postJson("/lender/applications/" + applicationId + "/offers", lender,
                Map.of("amount", 35000, "interest_rate", 13, "tenure_months", 12, "features", List.of("Flexible repayment"))).andReturn().getResponse();
        JsonNode node = json.readTree(response.getContentAsByteArray());
        if (response.getStatus() != 201) throw new AssertionError("offer failed: " + node);
        JsonNode offers = node.get("offers");
        return offers.get(offers.size() - 1).get("id").asText();
    }
}
