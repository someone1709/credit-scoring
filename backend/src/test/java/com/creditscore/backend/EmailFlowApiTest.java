package com.creditscore.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.creditscore.backend.common.Mailer;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

/** With a mail service set up. Its own database, since these accounts behave differently. */
@SpringBootTest
@TestPropertySource(properties = {"spring.datasource.url=jdbc:h2:mem:emailflow;MODE=MySQL;DB_CLOSE_DELAY=-1", "app.password-reset.frontend-url=http://site.test"})
class EmailFlowApiTest extends ApiTestSupport {

    private static final Pattern TOKEN = Pattern.compile("token=(\\S+)");

    @MockitoBean
    Mailer mailer;

    @BeforeEach
    void mailIsOn() {
        when(mailer.isEnabled()).thenReturn(true);
    }

    private String lastLinkTokenSentTo(String email) {
        ArgumentCaptor<String> emailBody = ArgumentCaptor.forClass(String.class);
        verify(mailer, org.mockito.Mockito.atLeastOnce()).send(eq(email), anyString(), emailBody.capture());
        Matcher matcher = TOKEN.matcher(emailBody.getValue());
        assertThat(matcher.find()).isTrue();
        return matcher.group(1);
    }

    @Test
    void aNewAccountConfirmsItsEmailBeforeApplying() throws Exception {
        Account beneficiary = newBeneficiaryWithProfile();
        Account lender = newLender("Approved Bank");
        getJson("/auth/me", beneficiary).andExpect(jsonPath("$.email_verified").value(false));

        postJson("/applications", beneficiary, applicationBody(List.of(lender.id())))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("EMAIL_NOT_VERIFIED"));

        String token = lastLinkTokenSentTo(beneficiary.email());
        postJson("/auth/verify-email", null, Map.of("token", token)).andExpect(status().isNoContent());

        getJson("/auth/me", beneficiary).andExpect(jsonPath("$.email_verified").value(true));
        postJson("/applications", beneficiary, applicationBody(List.of(lender.id()))).andExpect(status().isCreated());
    }

    @Test
    void theEmailLinkPointsAtTheSiteAndWorksOnce() throws Exception {
        Account account = newBeneficiary();
        ArgumentCaptor<String> emailBody = ArgumentCaptor.forClass(String.class);
        verify(mailer).send(eq(account.email()), anyString(), emailBody.capture());
        assertThat(emailBody.getValue()).contains("http://site.test/verify-email?token=");

        String token = lastLinkTokenSentTo(account.email());
        postJson("/auth/verify-email", null, Map.of("token", token)).andExpect(status().isNoContent());
        postJson("/auth/verify-email", null, Map.of("token", token))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("INVALID_VERIFICATION_TOKEN"));
    }

    @Test
    void resendingReplacesTheOldLink() throws Exception {
        Account account = newBeneficiary();
        String first = lastLinkTokenSentTo(account.email());

        postJson("/auth/resend-verification", account, null).andExpect(status().isAccepted());
        String second = lastLinkTokenSentTo(account.email());

        assertThat(second).isNotEqualTo(first);
        postJson("/auth/verify-email", null, Map.of("token", first)).andExpect(status().isBadRequest());
        postJson("/auth/verify-email", null, Map.of("token", second)).andExpect(status().isNoContent());
    }

    @Test
    void resendingNeedsASignedInAccount() throws Exception {
        postJson("/auth/resend-verification", null, null).andExpect(status().isUnauthorized());
    }

    @Test
    void changingTheEmailMeansConfirmingTheNewOne() throws Exception {
        Account account = newBeneficiaryWithProfile();
        postJson("/auth/verify-email", null, Map.of("token", lastLinkTokenSentTo(account.email()))).andExpect(status().isNoContent());

        String changed = uniqueEmail();
        patchJson("/auth/me", account, Map.of("name", "Test Applicant", "email", changed, "phone", "9876543210", "occupation", "Tailor",
                "address", "5 Market Street", "city", "Pune", "state", "Maharashtra", "pincode", "411001"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email_verified").value(false));

        postJson("/auth/verify-email", null, Map.of("token", lastLinkTokenSentTo(changed))).andExpect(status().isNoContent());
        getJson("/auth/me", account).andExpect(jsonPath("$.email_verified").value(true));
    }

    @Test
    void aPasswordResetIsEmailedOnlyToAnAccountThatExists() throws Exception {
        Account account = newBeneficiary();
        clearInvocations(mailer);

        postJson("/auth/forgot-password", null, Map.of("email", "nobody-here@example.com")).andExpect(status().isAccepted());
        verify(mailer, never()).send(any(), any(), any());

        postJson("/auth/forgot-password", null, Map.of("email", account.email())).andExpect(status().isAccepted());
        postJson("/auth/reset-password", null, Map.of("token", lastLinkTokenSentTo(account.email()), "password", "Another123")).andExpect(status().isNoContent());
        postJson("/auth/login", null, Map.of("email", account.email(), "password", "Another123")).andExpect(status().isOk());
    }

    @Test
    void ifMailIsTurnedOffLaterNobodyIsStuckWaiting() throws Exception {
        Account account = newBeneficiaryWithProfile();
        Account lender = newLender("Calm Bank");
        when(mailer.isEnabled()).thenReturn(false);

        getJson("/auth/me", account).andExpect(jsonPath("$.email_verified").value(true));
        postJson("/applications", account, applicationBody(List.of(lender.id()))).andExpect(status().isCreated());
    }
}
