package com.creditscore.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.servlet.http.Cookie;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletResponse;

class AuthApiTest extends ApiTestSupport {

    @Test
    void registerReturnsATokenAndHttpOnlyCookieButNoPassword() throws Exception {
        var response = postJson("/auth/register", null, Map.of("role", "beneficiary", "email", uniqueEmail(), "phone", "9876543210", "password", PASSWORD, "name", "New Person"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.user.role").value("beneficiary"))
                .andExpect(jsonPath("$.user.name").value("New Person"))
                .andExpect(jsonPath("$.user.occupation").doesNotExist())
                .andReturn().getResponse();
        assertThat(response.getContentAsString()).doesNotContain(PASSWORD).doesNotContain("password_hash").doesNotContain("refresh");
        assertThat(response.getCookie("refresh_token").isHttpOnly()).isTrue();
        assertThat(response.getHeader("Set-Cookie")).contains("SameSite=Lax").contains("Path=/api/v1/auth");
    }

    @Test
    void lenderFieldsAreSnakeCase() throws Exception {
        postJson("/auth/register", null, Map.of("role", "lender", "email", uniqueEmail(), "phone", "9876543210", "password", PASSWORD,
                "institution_name", "Live Bank", "contact_person", "Sam Roy", "license_number", "NBFC-1"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.user.institution_name").value("Live Bank"))
                .andExpect(jsonPath("$.user.contact_person").value("Sam Roy"))
                .andExpect(jsonPath("$.user.license_number").value("NBFC-1"));
    }

    @Test
    void duplicateEmailIsReportedOnTheField() throws Exception {
        Account existing = newBeneficiary();
        postJson("/auth/register", null, Map.of("role", "beneficiary", "email", existing.email().toUpperCase(), "phone", "9876543210", "password", PASSWORD, "name", "Other Person"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.details[0].field").value("email"));
    }

    @Test
    void invalidRegistrationUsesTheBriefsErrorShape() throws Exception {
        postJson("/auth/register", null, Map.of("role", "lender", "email", "nope", "phone", "1", "password", "short"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.message").value("Invalid input"))
                .andExpect(jsonPath("$.details[?(@.field == 'email')]").exists())
                .andExpect(jsonPath("$.details[?(@.field == 'phone')]").exists())
                .andExpect(jsonPath("$.details[?(@.field == 'password')]").exists())
                .andExpect(jsonPath("$.details[?(@.field == 'institution_name')]").exists())
                .andExpect(jsonPath("$.details[?(@.field == 'license_number')]").exists());
    }

    @Test
    void wrongPasswordAndUnknownEmailGetTheSameAnswer() throws Exception {
        Account account = newBeneficiary();
        var wrong = postJson("/auth/login", null, Map.of("email", account.email(), "password", "WrongPass1")).andExpect(status().isUnauthorized());
        var unknown = postJson("/auth/login", null, Map.of("email", "nobody@example.com", "password", "WrongPass1")).andExpect(status().isUnauthorized());
        assertThat(wrong.andReturn().getResponse().getContentAsString()).isEqualTo(unknown.andReturn().getResponse().getContentAsString());
    }

    @Test
    void loginWorksAndEmailIgnoresCase() throws Exception {
        Account account = newBeneficiary();
        postJson("/auth/login", null, Map.of("email", account.email().toUpperCase(), "password", PASSWORD, "remember_me", true))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.access_token").isNotEmpty())
                .andExpect(jsonPath("$.user.id").value(account.id()));
    }

    @Test
    void rememberMeControlsTheCookieLifetime() throws Exception {
        Account account = newBeneficiary();
        MockHttpServletResponse remembered = postJson("/auth/login", null, Map.of("email", account.email(), "password", PASSWORD, "remember_me", true)).andReturn().getResponse();
        MockHttpServletResponse session = postJson("/auth/login", null, Map.of("email", account.email(), "password", PASSWORD, "remember_me", false)).andReturn().getResponse();
        assertThat(remembered.getHeader("Set-Cookie")).contains("Max-Age");
        assertThat(session.getHeader("Set-Cookie")).doesNotContain("Max-Age");
    }

    @Test
    void routesNeedAToken() throws Exception {
        getJson("/applications", null).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.error").value("UNAUTHENTICATED"));
        getJson("/lender/applications", null).andExpect(status().isUnauthorized());
        getJson("/notifications", null).andExpect(status().isUnauthorized());
        getJson("/auth/me", null).andExpect(status().isUnauthorized());
        getJson("/health", null).andExpect(status().isOk());
    }

    @Test
    void aForgedTokenIsRejected() throws Exception {
        Account forged = new Account("x", "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4Iiwicm9sZSI6ImxlbmRlciJ9.invalidsignature", null, "x");
        getJson("/lender/applications", forged).andExpect(status().isUnauthorized());
    }

    @Test
    void eachRoleStaysInItsOwnRoutes() throws Exception {
        Account beneficiary = newBeneficiary();
        Account lender = newLender("Role Bank");
        getJson("/lender/applications", beneficiary).andExpect(status().isForbidden()).andExpect(jsonPath("$.error").value("FORBIDDEN"));
        getJson("/applications", lender).andExpect(status().isForbidden());
        getJson("/lenders", lender).andExpect(status().isForbidden());
    }

    private MockHttpServletResponse refresh(Cookie cookie) throws Exception {
        return mvc.perform(post("/api/v1/auth/refresh").contextPath("/api/v1").cookie(cookie)).andReturn().getResponse();
    }

    @Test
    void refreshRotatesTheCookieAndKeepsTheUser() throws Exception {
        Account account = newBeneficiary();
        MockHttpServletResponse first = refresh(account.refreshCookie());
        assertThat(first.getStatus()).isEqualTo(200);
        JsonNode node = json.readTree(first.getContentAsByteArray());
        assertThat(node.at("/user/id").asText()).isEqualTo(account.id());
        Cookie rotated = first.getCookie("refresh_token");
        assertThat(rotated.getValue()).isNotEqualTo(account.refreshCookie().getValue());

        // A second tab using the old cookie moments later still works, without replacing the cookie.
        MockHttpServletResponse secondTab = refresh(account.refreshCookie());
        assertThat(secondTab.getStatus()).isEqualTo(200);
        assertThat(secondTab.getCookie("refresh_token")).isNull();

        assertThat(refresh(rotated).getStatus()).isEqualTo(200);
    }

    @Test
    void refreshStillWorksWhenTheExpiredTokenIsSentAlong() throws Exception {
        Account account = newBeneficiary();
        var response = mvc.perform(post("/api/v1/auth/refresh").contextPath("/api/v1").cookie(account.refreshCookie())
                .header("Authorization", "Bearer an.expired.token")).andReturn().getResponse();
        assertThat(response.getStatus()).isEqualTo(200);
    }

    @Test
    void refreshWithoutACookieIsRefused() throws Exception {
        postJson("/auth/refresh", null, null).andExpect(status().isUnauthorized());
    }

    @Test
    void logoutEndsTheSessionAndClearsTheCookie() throws Exception {
        Account account = newBeneficiary();
        MockHttpServletResponse out = mvc.perform(post("/api/v1/auth/logout").contextPath("/api/v1").cookie(account.refreshCookie())).andReturn().getResponse();
        assertThat(out.getStatus()).isEqualTo(204);
        assertThat(out.getCookie("refresh_token").getMaxAge()).isZero();
        assertThat(refresh(account.refreshCookie()).getStatus()).isEqualTo(401);
    }

    @Test
    void changePasswordChecksTheCurrentOneOnItsField() throws Exception {
        Account account = newBeneficiary();
        postJson("/auth/change-password", account, Map.of("current_password", "WrongPass1", "new_password", "Newpass12"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.details[0].field").value("current_password"));
        postJson("/auth/change-password", account, Map.of("current_password", PASSWORD, "new_password", "Newpass12")).andExpect(status().isNoContent());
        postJson("/auth/login", null, Map.of("email", account.email(), "password", "Newpass12")).andExpect(status().isOk());
        postJson("/auth/login", null, Map.of("email", account.email(), "password", PASSWORD)).andExpect(status().isUnauthorized());
    }

    @Test
    void forgotPasswordAnswersTheSameForAnyEmail() throws Exception {
        Account account = newBeneficiary();
        postJson("/auth/forgot-password", null, Map.of("email", account.email())).andExpect(status().isAccepted());
        postJson("/auth/forgot-password", null, Map.of("email", "nobody@example.com")).andExpect(status().isAccepted());
    }

    @Test
    void aBadResetTokenIsRefused() throws Exception {
        postJson("/auth/reset-password", null, Map.of("token", "not-real", "password", "Another12"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("INVALID_RESET_TOKEN"));
    }

    @Test
    void profileUpdateValidatesAndSaves() throws Exception {
        Account account = newBeneficiary();
        patchJson("/auth/me", account, Map.of("name", "A", "email", "bad", "phone", "1", "occupation", "", "address", "", "city", "", "state", "", "pincode", "12"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.details[?(@.field == 'pincode')]").exists());
        patchJson("/auth/me", account, Map.of("name", "Better Name", "email", account.email(), "phone", "9876543210", "age", 30, "occupation", "Tailor",
                "address", "5 Market Street", "city", "Pune", "state", "Maharashtra", "pincode", "411001"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Better Name"))
                .andExpect(jsonPath("$.age").value(30));
    }

    @Test
    void lendersCannotUseTheBeneficiaryProfileRoute() throws Exception {
        Account lender = newLender("Profile Bank");
        patchJson("/auth/me", lender, Map.of("name", "Better Name", "email", lender.email(), "phone", "9876543210", "occupation", "Tailor",
                "address", "5 Market Street", "city", "Pune", "state", "Maharashtra", "pincode", "411001"))
                .andExpect(status().isForbidden());
    }
}
