package com.creditscore.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.creditscore.backend.application.DocumentFileRepository;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.ResultActions;

/** Lender approval, attempt limits, and what an applicant can take back or say to a lender. */
class PlatformApiTest extends ApiTestSupport {

    private static final String ADMIN_KEY = "test-admin-key";
    private static final byte[] PDF_BYTES = "%PDF-1.4 demo".getBytes();

    @Autowired
    DocumentFileRepository documentFiles;

    private ResultActions adminList(String key) throws Exception {
        var request = get("/api/v1/admin/lenders").contextPath("/api/v1");
        if (key != null) request.header("X-Admin-Key", key);
        return mvc.perform(request);
    }

    private ResultActions adminAct(String lenderId, String action) throws Exception {
        return mvc.perform(post("/api/v1/admin/lenders/" + lenderId + "/" + action).contextPath("/api/v1").header("X-Admin-Key", ADMIN_KEY));
    }

    private ResultActions loginFrom(String address, String email, String password) throws Exception {
        return mvc.perform(post("/api/v1/auth/login").contextPath("/api/v1")
                .with(request -> {
                    request.setRemoteAddr(address);
                    return request;
                })
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(Map.of("email", email, "password", password))));
    }

    private ResultActions upload(Account beneficiary, String id, int slot) throws Exception {
        return mvc.perform(multipart("/api/v1/applications/" + id + "/documents/" + id + "-DOC" + slot)
                .file(new MockMultipartFile("file", "statement.pdf", "application/pdf", PDF_BYTES))
                .contextPath("/api/v1")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + beneficiary.token()));
    }

    private ResultActions deleteDocument(Account beneficiary, String id, int slot) throws Exception {
        return call(delete("/api/v1/applications/" + id + "/documents/" + id + "-DOC" + slot), beneficiary, null);
    }

    private ResultActions revoke(Account beneficiary, String id, Account lender) throws Exception {
        return postJson("/applications/" + id + "/lenders/" + lender.id() + "/revoke", beneficiary, null);
    }

    private ResultActions reply(Account beneficiary, String id, Account lender, String message) throws Exception {
        return postJson("/applications/" + id + "/lenders/" + lender.id() + "/reply", beneficiary, Map.of("message", message));
    }

    private void askForInformation(Account lender, String id) throws Exception {
        postJson("/lender/applications/" + id + "/decision", lender, Map.of("status", "INFO_REQUESTED", "note", "Which employer?")).andExpect(status().isOk());
    }

    private JsonNode offerIn(JsonNode application, String offerId) {
        for (JsonNode offer : application.get("offers")) {
            if (offer.get("id").asText().equals(offerId)) return offer;
        }
        throw new AssertionError("no offer " + offerId);
    }

    private List<String> notificationTitles(Account account) throws Exception {
        return body(getJson("/notifications", account)).findValuesAsText("title");
    }

    // --- Lender approval

    @Test
    void aNewLenderStartsPendingAndCanReachNothing() throws Exception {
        Account pending = newPendingLender("Pending Bank");
        Account beneficiary = newBeneficiaryWithProfile();

        getJson("/auth/me", pending).andExpect(jsonPath("$.approval_status").value("PENDING"));
        assertThat(body(getJson("/lenders", beneficiary)).findValuesAsText("id")).doesNotContain(pending.id());

        postJson("/applications", beneficiary, applicationBody(List.of(pending.id())))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.details[0].field").value("lender_ids"));

        getJson("/lender/applications", pending).andExpect(status().isOk()).andExpect(jsonPath("$").isEmpty());
    }

    @Test
    void approvingALenderLetsApplicantsChooseIt() throws Exception {
        Account lender = newPendingLender("Soon Approved Bank");
        Account beneficiary = newBeneficiaryWithProfile();

        adminAct(lender.id(), "approve").andExpect(status().isOk()).andExpect(jsonPath("$.approval_status").value("APPROVED"));

        assertThat(body(getJson("/lenders", beneficiary)).findValuesAsText("id")).contains(lender.id());
        String id = submit(beneficiary, lender);
        getJson("/lender/applications/" + id, lender).andExpect(status().isOk());
        assertThat(notificationTitles(lender)).contains("Institution Approved");
    }

    @Test
    void rejectingALenderTakesAwayAccessButLeavesAnAcceptedLoanInPlace() throws Exception {
        Account lender = newLender("Turned Away Bank");
        Account other = newLender("Staying Bank");
        Account beneficiary = newBeneficiaryWithProfile();

        String open = submit(beneficiary, lender, other);
        String openOffer = offer(lender, open);
        String accepted = submit(newBeneficiaryWithProfile(), lender);
        Account acceptedOwner = newBeneficiaryWithProfile();
        String acceptedId = submit(acceptedOwner, lender);
        String winning = offer(lender, acceptedId);
        postJson("/applications/" + acceptedId + "/offers/" + winning + "/accept", acceptedOwner, null).andExpect(status().isOk());

        adminAct(lender.id(), "reject").andExpect(status().isOk()).andExpect(jsonPath("$.approval_status").value("REJECTED"));

        // Gone from the open applications, and the applicant can't accept its offer any more.
        getJson("/lender/applications/" + open, lender).andExpect(status().isNotFound());
        getJson("/lender/applications/" + accepted, lender).andExpect(status().isNotFound());
        JsonNode view = body(getJson("/applications/" + open, beneficiary));
        assertThat(offerIn(view, openOffer).get("status").asText()).isEqualTo("WITHDRAWN");
        assertThat(view.get("lender_decisions").findValuesAsText("lender_id")).containsExactly(other.id());
        assertThat(notificationTitles(beneficiary)).contains("Lender No Longer Available");
        assertThat(body(getJson("/lenders", beneficiary)).findValuesAsText("id")).doesNotContain(lender.id());

        // The loan already agreed isn't stranded.
        getJson("/lender/applications/" + acceptedId, lender).andExpect(status().isOk());
        postJson("/lender/applications/" + acceptedId + "/disbursement/advance", lender, null).andExpect(status().isOk());
    }

    @Test
    void theAdminRoutesNeedTheKey() throws Exception {
        Account lender = newLender("Curious Bank");
        adminList(null).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.error").value("INVALID_ADMIN_KEY"));
        adminList("wrong").andExpect(status().isUnauthorized());
        // Being signed in as a lender is no substitute.
        call(get("/api/v1/admin/lenders"), lender, null).andExpect(status().isUnauthorized());

        JsonNode list = body(adminList(ADMIN_KEY).andExpect(status().isOk()));
        assertThat(list.findValuesAsText("id")).contains(lender.id());
    }

    @Test
    void adminKeyGuessesAreLimited() throws Exception {
        for (int i = 0; i < 10; i++) {
            mvc.perform(get("/api/v1/admin/lenders").contextPath("/api/v1").header("X-Admin-Key", "guess" + i).with(request -> {
                request.setRemoteAddr("10.9.9.9");
                return request;
            })).andExpect(status().isUnauthorized());
        }
        mvc.perform(get("/api/v1/admin/lenders").contextPath("/api/v1").header("X-Admin-Key", ADMIN_KEY).with(request -> {
            request.setRemoteAddr("10.9.9.9");
            return request;
        })).andExpect(status().isTooManyRequests());
    }

    // --- Sign-in limits

    @Test
    void repeatedWrongPasswordsLockThatAccountFromThatAddress() throws Exception {
        Account account = newBeneficiary();
        for (int i = 0; i < 5; i++) {
            loginFrom("10.1.1.1", account.email(), "Wrong1234").andExpect(status().isUnauthorized());
        }
        // Refused even with the right password, or guessing could carry on.
        loginFrom("10.1.1.1", account.email(), PASSWORD)
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.error").value("TOO_MANY_ATTEMPTS"));
        // Someone guessing can't lock the real owner out from elsewhere.
        loginFrom("10.1.1.2", account.email(), PASSWORD).andExpect(status().isOk());
    }

    @Test
    void aSuccessfulSignInClearsTheCount() throws Exception {
        Account account = newBeneficiary();
        for (int i = 0; i < 4; i++) loginFrom("10.1.2.1", account.email(), "Wrong1234").andExpect(status().isUnauthorized());
        loginFrom("10.1.2.1", account.email(), PASSWORD).andExpect(status().isOk());
        for (int i = 0; i < 4; i++) loginFrom("10.1.2.1", account.email(), "Wrong1234").andExpect(status().isUnauthorized());
        loginFrom("10.1.2.1", account.email(), PASSWORD).andExpect(status().isOk());
    }

    @Test
    void tryingManyAccountsFromOneAddressIsLimitedToo() throws Exception {
        for (int i = 0; i < 50; i++) {
            loginFrom("10.1.3.1", "person" + i + "@example.com", "Wrong1234").andExpect(status().isUnauthorized());
        }
        loginFrom("10.1.3.1", "another@example.com", "Wrong1234").andExpect(status().isTooManyRequests());
    }

    @Test
    void passwordResetRequestsAreLimited() throws Exception {
        var request = post("/api/v1/auth/forgot-password").contextPath("/api/v1")
                .with(r -> {
                    r.setRemoteAddr("10.1.4.1");
                    return r;
                })
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsBytes(Map.of("email", "someone@example.com")));
        for (int i = 0; i < 20; i++) mvc.perform(request).andExpect(status().isAccepted());
        mvc.perform(request).andExpect(status().isTooManyRequests());
    }

    // --- Taking back access

    @Test
    void anApplicantCanTakeAccessBackFromOneLender() throws Exception {
        Account beneficiary = newBeneficiaryWithProfile();
        Account removed = newLender("Removed Bank");
        Account kept = newLender("Kept Bank");
        String id = submit(beneficiary, removed, kept);
        String removedOffer = offer(removed, id);
        upload(beneficiary, id, 1).andExpect(status().isOk());

        JsonNode view = body(revoke(beneficiary, id, removed).andExpect(status().isOk()));

        assertThat(view.get("lender_decisions").findValuesAsText("lender_id")).containsExactly(kept.id());
        // The offer stays on the applicant's record under the lender's name, but can no longer be accepted.
        assertThat(offerIn(view, removedOffer).get("status").asText()).isEqualTo("WITHDRAWN");
        assertThat(offerIn(view, removedOffer).get("lender_name").asText()).isEqualTo("Removed Bank");
        assertThat(view.get("status").asText()).isEqualTo("SUBMITTED");
        postJson("/applications/" + id + "/offers/" + removedOffer + "/accept", beneficiary, null).andExpect(status().isConflict());

        // The removed lender can't reach it by any route, and is told.
        getJson("/lender/applications/" + id, removed).andExpect(status().isNotFound());
        assertThat(body(getJson("/lender/applications", removed)).findValuesAsText("id")).doesNotContain(id);
        getJson("/lender/applications/" + id + "/documents/" + id + "-DOC1/file", removed).andExpect(status().isNotFound());
        postJson("/lender/applications/" + id + "/decision", removed, Map.of("status", "UNDER_REVIEW")).andExpect(status().isNotFound());
        assertThat(notificationTitles(removed)).contains("Access Removed");

        // Nothing changes for the other lender.
        getJson("/lender/applications/" + id, kept).andExpect(status().isOk());
        getJson("/lender/applications/" + id + "/documents/" + id + "-DOC1/file", kept).andExpect(status().isOk());

        // Reading the application again still works with that lender gone.
        getJson("/applications/" + id, beneficiary).andExpect(status().isOk());
        getJson("/lender/applications/" + id, kept).andExpect(status().isOk());
    }

    @Test
    void removingTheLastLenderLeavesAnEmptyButReadableApplication() throws Exception {
        Account beneficiary = newBeneficiaryWithProfile();
        Account only = newLender("Only Bank");
        String id = submit(beneficiary, only);
        JsonNode view = body(revoke(beneficiary, id, only).andExpect(status().isOk()));
        assertThat(view.get("lender_decisions")).isEmpty();
        assertThat(view.get("status").asText()).isEqualTo("SUBMITTED");
    }

    @Test
    void theLenderHoldingTheLoanKeepsAccess() throws Exception {
        Account beneficiary = newBeneficiaryWithProfile();
        Account winner = newLender("Winner Bank");
        Account loser = newLender("Other Bank");
        String id = submit(beneficiary, winner, loser);
        String winning = offer(winner, id);
        postJson("/applications/" + id + "/offers/" + winning + "/accept", beneficiary, null).andExpect(status().isOk());

        revoke(beneficiary, id, winner).andExpect(status().isConflict());
        revoke(beneficiary, id, loser).andExpect(status().isOk());
    }

    @Test
    void onlyTheOwnerCanTakeAccessBack() throws Exception {
        Account beneficiary = newBeneficiaryWithProfile();
        Account lender = newLender("Some Bank");
        String id = submit(beneficiary, lender);

        revoke(newBeneficiaryWithProfile(), id, lender).andExpect(status().isNotFound());
        postJson("/applications/" + id + "/lenders/" + lender.id() + "/revoke", lender, null).andExpect(status().isForbidden());
        revoke(beneficiary, id, newLender("Never Shared Bank")).andExpect(status().isNotFound());
        getJson("/lender/applications/" + id, lender).andExpect(status().isOk());
    }

    // --- Deleting documents

    @Test
    void deletingADocumentRemovesTheFileAndFreesTheSlot() throws Exception {
        Account beneficiary = newBeneficiaryWithProfile();
        Account lender = newLender("Reader Bank");
        String id = submit(beneficiary, lender);
        upload(beneficiary, id, 2).andExpect(status().isOk());
        assertThat(documentFiles.existsById(id + "-DOC2")).isTrue();

        JsonNode view = body(deleteDocument(beneficiary, id, 2).andExpect(status().isOk()));

        JsonNode document = view.get("documents").get(1);
        assertThat(document.get("verification_status").asText()).isEqualTo("NOT_PROVIDED");
        assertThat(document.get("filename").isNull()).isTrue();
        assertThat(document.get("file_available").asBoolean()).isFalse();
        assertThat(view.at("/assessment/verification_status").asText()).isEqualTo("NOT_PROVIDED");
        assertThat(documentFiles.existsById(id + "-DOC2")).isFalse();
        getJson("/applications/" + id + "/documents/" + id + "-DOC2/file", beneficiary).andExpect(status().isNotFound());
        getJson("/lender/applications/" + id + "/documents/" + id + "-DOC2/file", lender).andExpect(status().isNotFound());

        upload(beneficiary, id, 2).andExpect(status().isOk());
        assertThat(documentFiles.existsById(id + "-DOC2")).isTrue();
    }

    @Test
    void aFailedUploadCanBeClearedToo() throws Exception {
        Account beneficiary = newBeneficiaryWithProfile();
        String id = submit(beneficiary, newLender("A Bank"));
        mvc.perform(multipart("/api/v1/applications/" + id + "/documents/" + id + "-DOC1")
                .file(new MockMultipartFile("file", "fake.pdf", "application/pdf", "not a pdf".getBytes()))
                .contextPath("/api/v1")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + beneficiary.token())).andExpect(status().isOk());

        JsonNode view = body(deleteDocument(beneficiary, id, 1).andExpect(status().isOk()));
        assertThat(view.get("documents").get(0).get("verification_status").asText()).isEqualTo("NOT_PROVIDED");
    }

    @Test
    void documentsCantBeRemovedOnceALoanRelysOnThem() throws Exception {
        Account beneficiary = newBeneficiaryWithProfile();
        Account lender = newLender("Holding Bank");
        String id = submit(beneficiary, lender);
        upload(beneficiary, id, 1).andExpect(status().isOk());
        String winning = offer(lender, id);
        postJson("/applications/" + id + "/offers/" + winning + "/accept", beneficiary, null).andExpect(status().isOk());

        deleteDocument(beneficiary, id, 1).andExpect(status().isConflict());
        assertThat(documentFiles.existsById(id + "-DOC1")).isTrue();
    }

    @Test
    void onlyTheOwnerCanDeleteADocument() throws Exception {
        Account beneficiary = newBeneficiaryWithProfile();
        Account lender = newLender("Pushy Bank");
        String id = submit(beneficiary, lender);
        upload(beneficiary, id, 1).andExpect(status().isOk());

        deleteDocument(newBeneficiaryWithProfile(), id, 1).andExpect(status().isNotFound());
        deleteDocument(lender, id, 1).andExpect(status().isForbidden());
        deleteDocument(beneficiary, id, 3).andExpect(status().isConflict());
        assertThat(documentFiles.existsById(id + "-DOC1")).isTrue();
    }

    // --- Replying to a lender

    @Test
    void anApplicantCanAnswerTheLenderThatAsked() throws Exception {
        Account beneficiary = newBeneficiaryWithProfile();
        Account asker = newLender("Asking Bank");
        Account other = newLender("Quiet Bank");
        String id = submit(beneficiary, asker, other);
        askForInformation(asker, id);

        JsonNode view = body(reply(beneficiary, id, asker, "  I work at Pune Tailors.  ").andExpect(status().isOk()));
        // Stored for the lender that asked, whichever order the decisions come back in.
        assertThat(view.get("lender_decisions").findValuesAsText("applicant_reply")).contains("I work at Pune Tailors.");
        for (JsonNode decision : view.get("lender_decisions")) {
            if (decision.get("lender_id").asText().equals(other.id())) assertThat(decision.get("applicant_reply").isNull()).isTrue();
        }

        getJson("/lender/applications/" + id, asker)
                .andExpect(jsonPath("$.lender_decisions[0].applicant_reply").value("I work at Pune Tailors."))
                .andExpect(jsonPath("$.lender_decisions[0].applicant_reply_at").isNotEmpty());
        assertThat(notificationTitles(asker)).contains("Applicant Replied");

        // Another lender sees neither the question nor the answer.
        String raw = getJson("/lender/applications/" + id, other).andReturn().getResponse().getContentAsString();
        assertThat(raw).doesNotContain("Pune Tailors").doesNotContain("Which employer");
    }

    @Test
    void repliesAreOnlyForALenderWaitingOnAnAnswer() throws Exception {
        Account beneficiary = newBeneficiaryWithProfile();
        Account lender = newLender("Patient Bank");
        String id = submit(beneficiary, lender);

        reply(beneficiary, id, lender, "Hello").andExpect(status().isConflict());
        askForInformation(lender, id);
        reply(beneficiary, id, lender, "   ").andExpect(status().isUnprocessableEntity());
        reply(beneficiary, id, lender, "x".repeat(501)).andExpect(status().isUnprocessableEntity());
        reply(newBeneficiaryWithProfile(), id, lender, "Hello").andExpect(status().isNotFound());
        reply(beneficiary, id, newLender("Stranger Bank"), "Hello").andExpect(status().isNotFound());
    }

    @Test
    void aReplyStaysVisibleUntilTheLenderAsksSomethingNew() throws Exception {
        Account beneficiary = newBeneficiaryWithProfile();
        Account lender = newLender("Thorough Bank");
        String id = submit(beneficiary, lender);
        askForInformation(lender, id);
        reply(beneficiary, id, lender, "First answer").andExpect(status().isOk());

        postJson("/lender/applications/" + id + "/decision", lender, Map.of("status", "UNDER_REVIEW")).andExpect(status().isOk());
        getJson("/lender/applications/" + id, lender).andExpect(jsonPath("$.lender_decisions[0].applicant_reply").value("First answer"));

        askForInformation(lender, id);
        getJson("/lender/applications/" + id, lender).andExpect(jsonPath("$.lender_decisions[0].applicant_reply").isEmpty());
    }

    // --- Smaller things

    @Test
    void stepDatesFollowIndianTime() throws Exception {
        Account beneficiary = newBeneficiaryWithProfile();
        Account lender = newLender("Dated Bank");
        String id = submit(beneficiary, lender);
        String winning = offer(lender, id);
        DateTimeFormatter format = DateTimeFormatter.ofPattern("dd MMM yyyy", Locale.ENGLISH);
        String before = format.format(LocalDate.now(ZoneId.of("Asia/Kolkata")));

        JsonNode view = body(postJson("/applications/" + id + "/offers/" + winning + "/accept", beneficiary, null).andExpect(status().isOk()));

        String after = format.format(LocalDate.now(ZoneId.of("Asia/Kolkata")));
        assertThat(view.at("/disbursement_steps/0/date").asText()).isIn(before, after);
    }

    @Test
    void healthSaysWhetherTheModelIsInUse() throws Exception {
        getJson("/health", null).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("UP")).andExpect(jsonPath("$.ml").value("OFF"));
    }
}
