package com.creditscore.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.creditscore.backend.application.ApplicationService;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.support.TransactionTemplate;

/** The project's non-negotiable rules, checked through the real API. */
class WorkflowApiTest extends ApiTestSupport {

    @Autowired
    ApplicationService applicationService;

    @Autowired
    EntityManager entityManager;

    @Autowired
    TransactionTemplate transactions;

    @Autowired
    com.creditscore.backend.application.DocumentFileRepository documentFiles;

    private ResultActions decide(Account lender, String id, String status, String note) throws Exception {
        Map<String, Object> body = note == null ? Map.of("status", status) : Map.of("status", status, "note", note);
        return postJson("/lender/applications/" + id + "/decision", lender, body);
    }

    private String statusOf(Account beneficiary, String id) throws Exception {
        return body(getJson("/applications/" + id, beneficiary)).get("status").asText();
    }

    // --- Applying

    @Test
    void submittingStoresAnHonestAssessmentAndSharesOnlyWithChosenLenders() throws Exception {
        Account beneficiary = newBeneficiaryWithProfile();
        Account chosen = newLender("Chosen Bank");
        Account other = newLender("Other Bank");
        String id = submit(beneficiary, chosen);

        JsonNode app = body(getJson("/applications/" + id, beneficiary));
        assertThat(app.get("status").asText()).isEqualTo("SUBMITTED");
        assertThat(app.at("/assessment/probability_of_default").isNull()).isTrue();
        assertThat(app.at("/assessment/model_confidence").isNull()).isTrue();
        assertThat(app.at("/assessment/explanation_method").asText()).isEqualTo("RULE_BASED");
        assertThat(app.at("/assessment/is_thin_file").asBoolean()).isTrue();
        assertThat(app.at("/assessment/risk_score").asInt()).isEqualTo(30);
        assertThat(app.at("/assessment/composite_score").asInt()).isEqualTo(79);
        assertThat(app.at("/assessment/segment").asText()).isEqualTo("LOW_INCOME_PRIME");
        assertThat(app.at("/assessment/verification_status").asText()).isEqualTo("NOT_PROVIDED");
        assertThat(app.at("/repayment_history").asText()).isEqualTo("none");
        assertThat(app.get("documents")).hasSize(4);
        assertThat(app.get("lender_decisions")).hasSize(1);

        getJson("/lender/applications/" + id, chosen).andExpect(status().isOk());
        getJson("/lender/applications/" + id, other).andExpect(status().isNotFound());
        assertThat(body(getJson("/lender/applications", other))).isEmpty();
    }

    @Test
    void noHistoryAddsNoRisk() throws Exception {
        Account beneficiary = newBeneficiaryWithProfile();
        Account lender = newLender("History Bank");
        int none = riskFor(beneficiary, lender, "none");
        int good = riskFor(beneficiary, lender, "good");
        int average = riskFor(beneficiary, lender, "average");
        int poor = riskFor(beneficiary, lender, "poor");
        assertThat(none).isEqualTo(good + 5).isLessThan(average).isLessThan(poor);
    }

    private int riskFor(Account beneficiary, Account lender, String history) throws Exception {
        Map<String, Object> request = applicationBody(List.of(lender.id()));
        request.put("repayment_history", history);
        JsonNode app = body(postJson("/applications", beneficiary, request).andExpect(status().isCreated()));
        assertThat(app.at("/assessment/is_thin_file").asBoolean()).isEqualTo(history.equals("none"));
        return app.at("/assessment/risk_score").asInt();
    }

    @Test
    void consentAndLendersAreRequired() throws Exception {
        Account beneficiary = newBeneficiaryWithProfile();
        Account lender = newLender("Consent Bank");

        Map<String, Object> noConsent = applicationBody(List.of(lender.id()));
        noConsent.put("consent", false);
        postJson("/applications", beneficiary, noConsent).andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.details[0].field").value("consent"));

        postJson("/applications", beneficiary, applicationBody(List.of())).andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.details[0].field").value("lender_ids"));
        postJson("/applications", beneficiary, applicationBody(List.of("LEN-FAKE"))).andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.details[0].field").value("lender_ids"));
    }

    @Test
    void aBeneficiaryCannotBeSharedAsALender() throws Exception {
        Account beneficiary = newBeneficiaryWithProfile();
        Account other = newBeneficiary();
        postJson("/applications", beneficiary, applicationBody(List.of(other.id()))).andExpect(status().isUnprocessableEntity());
    }

    @Test
    void repaymentHistoryMustBeStatedAndValid() throws Exception {
        Account beneficiary = newBeneficiaryWithProfile();
        Account lender = newLender("Stated Bank");
        Map<String, Object> missing = applicationBody(List.of(lender.id()));
        missing.remove("repayment_history");
        postJson("/applications", beneficiary, missing).andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.details[0].field").value("repayment_history"));

        Map<String, Object> invalid = applicationBody(List.of(lender.id()));
        invalid.put("repayment_history", "excellent");
        postJson("/applications", beneficiary, invalid).andExpect(status().isBadRequest());
    }

    @Test
    void theProfileComesFirst() throws Exception {
        Account incomplete = newBeneficiary();
        Account lender = newLender("Profile First Bank");
        postJson("/applications", incomplete, applicationBody(List.of(lender.id()))).andExpect(status().isConflict()).andExpect(jsonPath("$.error").value("PROFILE_INCOMPLETE"));
    }

    @Test
    void lenderDirectoryHidesContactDetails() throws Exception {
        Account beneficiary = newBeneficiary();
        Account lender = newLender("Directory Bank");
        String raw = getJson("/lenders", beneficiary).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(raw).contains("Directory Bank").contains("logo_initials").doesNotContain(lender.email()).doesNotContain("license").doesNotContain("9876543210");
    }

    // --- Privacy

    @Test
    void beneficiariesOnlySeeTheirOwnApplications() throws Exception {
        Account owner = newBeneficiaryWithProfile();
        Account stranger = newBeneficiaryWithProfile();
        Account lender = newLender("Owner Bank");
        String id = submit(owner, lender);
        String offerId = offer(lender, id);

        getJson("/applications/" + id, stranger).andExpect(status().isNotFound());
        assertThat(body(getJson("/applications", stranger))).isEmpty();
        postJson("/applications/" + id + "/offers/" + offerId + "/accept", stranger, null).andExpect(status().isNotFound());
        postJson("/applications/" + id + "/offers/" + offerId + "/decline", stranger, null).andExpect(status().isNotFound());
        assertThat(statusOf(owner, id)).isEqualTo("OFFERS_AVAILABLE");
    }

    @Test
    void aLenderOutsideTheApplicationCannotActOnItOrGrantItselfAccess() throws Exception {
        Account beneficiary = newBeneficiaryWithProfile();
        Account shared = newLender("Shared Bank");
        Account outsider = newLender("Outsider Bank");
        String id = submit(beneficiary, shared);

        decide(outsider, id, "UNDER_REVIEW", null).andExpect(status().isNotFound());
        postJson("/lender/applications/" + id + "/offers", outsider, Map.of("amount", 1000, "interest_rate", 10, "tenure_months", 12)).andExpect(status().isNotFound());
        postJson("/lender/applications/" + id + "/disbursement/advance", outsider, null).andExpect(status().isNotFound());

        // The attempts must not have created access.
        getJson("/lender/applications/" + id, outsider).andExpect(status().isNotFound());
        assertThat(body(getJson("/applications/" + id, beneficiary)).get("lender_decisions")).hasSize(1);
    }

    @Test
    void aLenderSeesNothingAboutOtherLenders() throws Exception {
        Account beneficiary = newBeneficiaryWithProfile();
        Account first = newLender("First Secret Bank");
        Account second = newLender("Second Secret Bank");
        String id = submit(beneficiary, first, second);
        decide(second, id, "REJECTED", "A private reason").andExpect(status().isOk());
        offer(second, id);

        String raw = getJson("/lender/applications/" + id, first).andReturn().getResponse().getContentAsString();
        JsonNode view = json.readTree(raw);
        assertThat(raw).doesNotContain("Second Secret Bank").doesNotContain("A private reason").doesNotContain(second.id());
        assertThat(view.get("status").isNull()).isTrue();
        assertThat(view.get("lender_decisions")).hasSize(1);
        assertThat(view.get("offers")).isEmpty();
        assertThat(view.get("closed_to_lender").asBoolean()).isFalse();
    }

    @Test
    void aLenderNeverReceivesTheApplicantsContactDetails() throws Exception {
        Account beneficiary = newBeneficiaryWithProfile();
        Account lender = newLender("Contact Check Bank");
        String id = submit(beneficiary, lender);
        String raw = getJson("/lender/applications/" + id, lender).andReturn().getResponse().getContentAsString();
        assertThat(raw).contains("Test Applicant").contains("Tailor").contains("Pune")
                .doesNotContain(beneficiary.email()).doesNotContain("9876543210").doesNotContain("Market Street").doesNotContain("411001");
    }

    // --- Independent decisions and status

    @Test
    void oneRejectionDoesNotRejectTheApplication() throws Exception {
        Account beneficiary = newBeneficiaryWithProfile();
        Account first = newLender("Reject One");
        Account second = newLender("Reject Two");
        String id = submit(beneficiary, first, second);

        decide(first, id, "REJECTED", "No").andExpect(status().isOk());
        assertThat(statusOf(beneficiary, id)).isEqualTo("UNDER_REVIEW");
        JsonNode secondView = body(getJson("/lender/applications/" + id, second));
        assertThat(secondView.at("/lender_decisions/0/status").asText()).isEqualTo("PENDING");

        decide(second, id, "REJECTED", null).andExpect(status().isOk());
        assertThat(statusOf(beneficiary, id)).isEqualTo("REJECTED");
    }

    @Test
    void requestingInformationNeedsANoteAndAsksForDocuments() throws Exception {
        Account beneficiary = newBeneficiaryWithProfile();
        Account lender = newLender("Info Bank");
        String id = submit(beneficiary, lender);

        decide(lender, id, "INFO_REQUESTED", "   ").andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.details[0].field").value("note"));
        decide(lender, id, "INFO_REQUESTED", "Need bank statement").andExpect(status().isOk());
        assertThat(statusOf(beneficiary, id)).isEqualTo("DOCUMENTS_REQUIRED");

        // An old note must not carry over to the next decision.
        JsonNode next = body(decide(lender, id, "UNDER_REVIEW", null));
        assertThat(next.at("/lender_decisions/0/note").isNull()).isTrue();
    }

    @Test
    void decisionsCannotClaimAnOfferWithoutOne() throws Exception {
        Account beneficiary = newBeneficiaryWithProfile();
        Account lender = newLender("Claim Bank");
        String id = submit(beneficiary, lender);
        decide(lender, id, "OFFER_MADE", null).andExpect(status().isUnprocessableEntity());
        decide(lender, id, "PENDING", null).andExpect(status().isUnprocessableEntity());
    }

    // --- Offers

    @Test
    void acceptingClosesTheApplicationAndTellsOthersNothingAboutTheWinner() throws Exception {
        Account beneficiary = newBeneficiaryWithProfile();
        Account winner = newLender("Winner Bank");
        Account loser = newLender("Loser Bank");
        String id = submit(beneficiary, winner, loser);
        String winningOffer = offer(winner, id);
        String losingOffer = offer(loser, id);
        assertThat(statusOf(beneficiary, id)).isEqualTo("OFFERS_AVAILABLE");

        JsonNode accepted = body(postJson("/applications/" + id + "/offers/" + winningOffer + "/accept", beneficiary, null).andExpect(status().isOk()));
        assertThat(accepted.get("status").asText()).isEqualTo("OFFER_ACCEPTED");
        assertThat(accepted.get("disbursement_steps")).hasSize(5);

        String loserRaw = getJson("/lender/applications/" + id, loser).andReturn().getResponse().getContentAsString();
        JsonNode loserView = json.readTree(loserRaw);
        assertThat(loserRaw).doesNotContain("Winner Bank").doesNotContain(winner.id());
        assertThat(loserView.get("closed_to_lender").asBoolean()).isTrue();
        assertThat(loserView.get("status").isNull()).isTrue();
        assertThat(loserView.get("disbursement_steps")).isEmpty();
        assertThat(loserView.at("/offers/0/status").asText()).isEqualTo("DECLINED");

        JsonNode winnerView = body(getJson("/lender/applications/" + id, winner));
        assertThat(winnerView.get("closed_to_lender").asBoolean()).isFalse();
        assertThat(winnerView.get("status").asText()).isEqualTo("OFFER_ACCEPTED");

        String loserNotices = getJson("/notifications", loser).andReturn().getResponse().getContentAsString();
        assertThat(loserNotices).contains("Offer Declined").doesNotContain("Winner Bank");

        // Nobody can change anything now.
        decide(winner, id, "REJECTED", null).andExpect(status().isConflict());
        decide(loser, id, "UNDER_REVIEW", null).andExpect(status().isConflict());
        postJson("/lender/applications/" + id + "/offers", loser, Map.of("amount", 1000, "interest_rate", 10, "tenure_months", 12)).andExpect(status().isConflict());
        postJson("/applications/" + id + "/offers/" + losingOffer + "/accept", beneficiary, null).andExpect(status().isConflict());
    }

    @Test
    void decliningTheLastOfferMovesTheStatusBack() throws Exception {
        Account beneficiary = newBeneficiaryWithProfile();
        Account lender = newLender("Decline Bank");
        String id = submit(beneficiary, lender);
        String offerId = offer(lender, id);
        JsonNode declined = body(postJson("/applications/" + id + "/offers/" + offerId + "/decline", beneficiary, null).andExpect(status().isOk()));
        assertThat(declined.get("status").asText()).isEqualTo("UNDER_REVIEW");
        assertThat(declined.at("/lender_decisions/0/status").asText()).isEqualTo("UNDER_REVIEW");
    }

    @Test
    void aLenderManagesOnlyItsOwnOffers() throws Exception {
        Account beneficiary = newBeneficiaryWithProfile();
        Account first = newLender("Offer One");
        Account second = newLender("Offer Two");
        String id = submit(beneficiary, first, second);
        String firstOffer = offer(first, id);
        String secondOffer = offer(second, id);

        postJson("/lender/applications/" + id + "/offers/" + secondOffer + "/withdraw", first, null).andExpect(status().isConflict());
        decide(first, id, "UNDER_REVIEW", null).andExpect(status().isConflict());

        JsonNode withdrawn = body(postJson("/lender/applications/" + id + "/offers/" + firstOffer + "/withdraw", first, null).andExpect(status().isOk()));
        assertThat(withdrawn.at("/offers/0/status").asText()).isEqualTo("WITHDRAWN");
        assertThat(statusOf(beneficiary, id)).isEqualTo("OFFERS_AVAILABLE");

        JsonNode rejected = body(decide(second, id, "REJECTED", null));
        assertThat(rejected.at("/offers/0/status").asText()).isEqualTo("WITHDRAWN");
        assertThat(statusOf(beneficiary, id)).isEqualTo("UNDER_REVIEW");
    }

    @Test
    void aNewOfferReplacesTheLenderslastOne() throws Exception {
        Account beneficiary = newBeneficiaryWithProfile();
        Account lender = newLender("Replace Bank");
        String id = submit(beneficiary, lender);
        offer(lender, id);
        offer(lender, id);
        JsonNode offers = body(getJson("/applications/" + id, beneficiary)).get("offers");
        assertThat(offers).hasSize(2);
        assertThat(offers.findValuesAsText("status")).containsExactly("WITHDRAWN", "PENDING");
    }

    @Test
    void offerTermsAreValidated() throws Exception {
        Account beneficiary = newBeneficiaryWithProfile();
        Account lender = newLender("Terms Bank");
        String id = submit(beneficiary, lender);
        postJson("/lender/applications/" + id + "/offers", lender, Map.of("amount", 0, "interest_rate", -1, "tenure_months", 0))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.details[?(@.field == 'amount')]").exists())
                .andExpect(jsonPath("$.details[?(@.field == 'interest_rate')]").exists())
                .andExpect(jsonPath("$.details[?(@.field == 'tenure_months')]").exists());
    }

    @Test
    void expiredOffersCannotBeAcceptedAndStatusFollows() throws Exception {
        Account beneficiary = newBeneficiaryWithProfile();
        Account lender = newLender("Expiry Bank");
        String id = submit(beneficiary, lender);
        String offerId = offer(lender, id);

        transactions.executeWithoutResult(tx -> entityManager
                .createQuery("update LoanOffer o set o.expiresAt = :past where o.id = :id")
                .setParameter("past", Instant.now().minus(1, ChronoUnit.HOURS))
                .setParameter("id", offerId)
                .executeUpdate());

        postJson("/applications/" + id + "/offers/" + offerId + "/accept", beneficiary, null).andExpect(status().isConflict());

        assertThat(applicationService.expireDueOffers(Instant.now())).isGreaterThanOrEqualTo(1);
        JsonNode app = body(getJson("/applications/" + id, beneficiary));
        assertThat(app.at("/offers/0/status").asText()).isEqualTo("EXPIRED");
        assertThat(app.get("status").asText()).isEqualTo("UNDER_REVIEW");
    }

    // --- Disbursement

    @Test
    void onlyTheWinnerAdvancesDisbursementAndItEndsAsDisbursed() throws Exception {
        Account beneficiary = newBeneficiaryWithProfile();
        Account winner = newLender("Disburse Win");
        Account loser = newLender("Disburse Lose");
        String id = submit(beneficiary, winner, loser);

        postJson("/lender/applications/" + id + "/disbursement/advance", winner, null).andExpect(status().isConflict());

        String offerId = offer(winner, id);
        postJson("/applications/" + id + "/offers/" + offerId + "/accept", beneficiary, null).andExpect(status().isOk());

        postJson("/lender/applications/" + id + "/disbursement/advance", loser, null).andExpect(status().isConflict());

        for (int step = 0; step < 3; step++) {
            postJson("/lender/applications/" + id + "/disbursement/advance", winner, null).andExpect(status().isOk());
            assertThat(statusOf(beneficiary, id)).isEqualTo("OFFER_ACCEPTED");
        }
        postJson("/lender/applications/" + id + "/disbursement/advance", winner, null).andExpect(status().isOk());
        assertThat(statusOf(beneficiary, id)).isEqualTo("DISBURSED");
        postJson("/lender/applications/" + id + "/disbursement/advance", winner, null).andExpect(status().isConflict());
        assertThat(getJson("/notifications", beneficiary).andReturn().getResponse().getContentAsString()).contains("No real money moved");
    }

    // --- Documents

    private ResultActions upload(Account beneficiary, String id, int slot, String filename, String contentType, byte[] content) throws Exception {
        return mvc.perform(multipart("/api/v1/applications/" + id + "/documents/" + id + "-DOC" + slot)
                .file(new MockMultipartFile("file", filename, contentType, content))
                .contextPath("/api/v1")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + beneficiary.token()));
    }

    private static final byte[] PDF_BYTES = "%PDF-1.4 demo".getBytes();

    @Test
    void documentChecksLookAtTheRealFile() throws Exception {
        Account beneficiary = newBeneficiaryWithProfile();
        Account lender = newLender("Docs Bank");
        String id = submit(beneficiary, lender);

        JsonNode passed = body(upload(beneficiary, id, 1, "income.pdf", "application/pdf", PDF_BYTES).andExpect(status().isOk()));
        assertThat(passed.at("/documents/0/verification_status").asText()).isEqualTo("CHECKS_PASSED");
        assertThat(passed.at("/documents/0/check_note").asText()).contains("does not prove");
        assertThat(passed.at("/assessment/verification_status").asText()).isEqualTo("CHECKS_PASSED");

        JsonNode wrongType = body(upload(beneficiary, id, 2, "tool.exe", "application/octet-stream", new byte[] {1, 2, 3}));
        assertThat(wrongType.at("/documents/1/verification_status").asText()).isEqualTo("CHECKS_FAILED");
        assertThat(wrongType.at("/assessment/verification_status").asText()).isEqualTo("CHECKS_FAILED");

        JsonNode disguised = body(upload(beneficiary, id, 2, "fake.pdf", "application/pdf", "MZ not a pdf".getBytes()));
        assertThat(disguised.at("/documents/1/check_note").asText()).contains("do not match");

        JsonNode big = body(upload(beneficiary, id, 3, "big.png", "image/png", new byte[6 * 1024 * 1024]));
        assertThat(big.at("/documents/2/check_note").asText()).contains("larger than 5 MB");

        JsonNode empty = body(upload(beneficiary, id, 4, "empty.pdf", "application/pdf", new byte[0]));
        assertThat(empty.at("/documents/3/check_note").asText()).contains("empty");

        // A failed document can be replaced, a passed one can't.
        JsonNode retried = body(upload(beneficiary, id, 2, "statement.pdf", "application/pdf", PDF_BYTES));
        assertThat(retried.at("/documents/1/verification_status").asText()).isEqualTo("CHECKS_PASSED");
        upload(beneficiary, id, 1, "again.pdf", "application/pdf", PDF_BYTES).andExpect(status().isConflict());
    }

    @Test
    void documentPathsAreReducedToAPlainName() throws Exception {
        Account beneficiary = newBeneficiaryWithProfile();
        String id = submit(beneficiary, newLender("Path Bank"));
        JsonNode app = body(upload(beneficiary, id, 1, "../../etc/passwd.pdf", "application/pdf", PDF_BYTES));
        assertThat(app.at("/documents/0/filename").asText()).isEqualTo("passwd.pdf");
    }

    @Test
    void uploadsAreLimitedToTheOwnerAndOpenApplications() throws Exception {
        Account owner = newBeneficiaryWithProfile();
        Account stranger = newBeneficiaryWithProfile();
        Account lender = newLender("Upload Bank");
        String id = submit(owner, lender);

        upload(stranger, id, 1, "a.pdf", "application/pdf", PDF_BYTES).andExpect(status().isNotFound());
        decide(lender, id, "REJECTED", null).andExpect(status().isOk());
        assertThat(statusOf(owner, id)).isEqualTo("REJECTED");
        upload(owner, id, 1, "a.pdf", "application/pdf", PDF_BYTES).andExpect(status().isConflict());
    }

    @Test
    void aWaitingLenderHearsAboutNewEvidence() throws Exception {
        Account beneficiary = newBeneficiaryWithProfile();
        Account waiting = newLender("Waiting Bank");
        Account other = newLender("Not Waiting Bank");
        String id = submit(beneficiary, waiting, other);
        decide(waiting, id, "INFO_REQUESTED", "Need proof").andExpect(status().isOk());
        upload(beneficiary, id, 1, "a.pdf", "application/pdf", PDF_BYTES).andExpect(status().isOk());

        assertThat(getJson("/notifications", waiting).andReturn().getResponse().getContentAsString()).contains("Document Uploaded");
        assertThat(getJson("/notifications", other).andReturn().getResponse().getContentAsString()).doesNotContain("Document Uploaded");
    }

    // --- Reading stored documents

    private static final byte[] PNG_BYTES = {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n', 1, 2, 3, 4};

    @Test
    void theOwnerAndChosenLendersCanOpenAPassedFileAndNobodyElse() throws Exception {
        Account owner = newBeneficiaryWithProfile();
        Account stranger = newBeneficiaryWithProfile();
        Account chosen = newLender("File Chosen Bank");
        Account outsider = newLender("File Outsider Bank");
        String id = submit(owner, chosen);
        String doc = id + "-DOC1";

        JsonNode uploaded = body(upload(owner, id, 1, "income.pdf", "application/pdf", PDF_BYTES).andExpect(status().isOk()));
        assertThat(uploaded.at("/documents/0/file_available").asBoolean()).isTrue();
        assertThat(uploaded.at("/documents/1/file_available").asBoolean()).isFalse();

        var forOwner = getJson("/applications/" + id + "/documents/" + doc + "/file", owner).andExpect(status().isOk()).andReturn().getResponse();
        assertThat(forOwner.getContentAsByteArray()).isEqualTo(PDF_BYTES);

        var forLender = getJson("/lender/applications/" + id + "/documents/" + doc + "/file", chosen).andExpect(status().isOk()).andReturn().getResponse();
        assertThat(forLender.getContentAsByteArray()).isEqualTo(PDF_BYTES);
        assertThat(forLender.getContentType()).isEqualTo("application/pdf");

        getJson("/applications/" + id + "/documents/" + doc + "/file", stranger).andExpect(status().isNotFound());
        getJson("/lender/applications/" + id + "/documents/" + doc + "/file", outsider).andExpect(status().isNotFound());
        getJson("/lender/applications/" + id + "/documents/" + doc + "/file", owner).andExpect(status().isForbidden());
        getJson("/applications/" + id + "/documents/" + doc + "/file", chosen).andExpect(status().isForbidden());
        getJson("/applications/" + id + "/documents/" + doc + "/file", null).andExpect(status().isUnauthorized());
    }

    @Test
    void aFileIsServedSoABrowserCantRunIt() throws Exception {
        Account owner = newBeneficiaryWithProfile();
        Account lender = newLender("Header Bank");
        String id = submit(owner, lender);
        upload(owner, id, 1, "scan \"final\".png", "text/html", PNG_BYTES).andExpect(status().isOk());

        var response = getJson("/lender/applications/" + id + "/documents/" + id + "-DOC1/file", lender).andExpect(status().isOk()).andReturn().getResponse();
        // The type comes from the checked file, not from what the uploader claimed.
        assertThat(response.getContentType()).isEqualTo("image/png");
        assertThat(response.getHeader("X-Content-Type-Options")).isEqualTo("nosniff");
        assertThat(response.getHeader("Content-Security-Policy")).contains("sandbox");
        assertThat(response.getHeader("Cache-Control")).contains("no-store");
        assertThat(response.getHeader("Content-Disposition")).startsWith("attachment");
    }

    @Test
    void aFileThatFailedItsChecksIsNeverKept() throws Exception {
        Account owner = newBeneficiaryWithProfile();
        Account lender = newLender("Failed File Bank");
        String id = submit(owner, lender);
        JsonNode failed = body(upload(owner, id, 1, "virus.exe", "application/octet-stream", new byte[] {1, 2, 3}));
        assertThat(failed.at("/documents/0/verification_status").asText()).isEqualTo("CHECKS_FAILED");
        assertThat(failed.at("/documents/0/file_available").asBoolean()).isFalse();
        getJson("/lender/applications/" + id + "/documents/" + id + "-DOC1/file", lender).andExpect(status().isNotFound());
        assertThat(documentFiles.existsById(id + "-DOC1")).isFalse();
    }

    @Test
    void aLenderWhoseOfferLostCanNoLongerOpenFiles() throws Exception {
        Account owner = newBeneficiaryWithProfile();
        Account winner = newLender("File Winner");
        Account loser = newLender("File Loser");
        String id = submit(owner, winner, loser);
        upload(owner, id, 1, "income.pdf", "application/pdf", PDF_BYTES).andExpect(status().isOk());
        String path = "/lender/applications/" + id + "/documents/" + id + "-DOC1/file";

        getJson(path, loser).andExpect(status().isOk());
        String offerId = offer(winner, id);
        postJson("/applications/" + id + "/offers/" + offerId + "/accept", owner, null).andExpect(status().isOk());

        getJson(path, loser).andExpect(status().isNotFound());
        assertThat(body(getJson("/lender/applications/" + id, loser)).at("/documents/0/file_available").asBoolean()).isFalse();
        getJson(path, winner).andExpect(status().isOk());
        assertThat(body(getJson("/lender/applications/" + id, winner)).at("/documents/0/file_available").asBoolean()).isTrue();
    }

    @Test
    void filesAreEncryptedInTheDatabase() throws Exception {
        Account owner = newBeneficiaryWithProfile();
        String id = submit(owner, newLender("Encrypt Bank"));
        byte[] secret = "%PDF-1.4 my private bank statement".getBytes();
        upload(owner, id, 1, "bank.pdf", "application/pdf", secret).andExpect(status().isOk());

        byte[] stored = documentFiles.findById(id + "-DOC1").orElseThrow().getContent();
        assertThat(new String(stored, java.nio.charset.StandardCharsets.ISO_8859_1)).doesNotContain("private bank statement").doesNotContain("%PDF");
        assertThat(stored.length).isGreaterThan(secret.length);
    }

    @Test
    void oneEncryptedFileCannotBeSwappedOntoAnotherDocument() throws Exception {
        Account owner = newBeneficiaryWithProfile();
        String id = submit(owner, newLender("Swap Bank"));
        upload(owner, id, 1, "income.pdf", "application/pdf", PDF_BYTES).andExpect(status().isOk());
        upload(owner, id, 2, "bank.pdf", "application/pdf", PDF_BYTES).andExpect(status().isOk());

        var first = documentFiles.findById(id + "-DOC1").orElseThrow();
        var second = documentFiles.findById(id + "-DOC2").orElseThrow();
        second.setContent(first.getContent());
        documentFiles.save(second);

        getJson("/applications/" + id + "/documents/" + id + "-DOC2/file", owner).andExpect(status().isInternalServerError());
    }

    @Test
    void anOlderUploadWithNoFileCanBeUploadedAgain() throws Exception {
        Account owner = newBeneficiaryWithProfile();
        String id = submit(owner, newLender("Older Upload Bank"));
        upload(owner, id, 1, "income.pdf", "application/pdf", PDF_BYTES).andExpect(status().isOk());
        documentFiles.deleteById(id + "-DOC1");

        JsonNode app = body(getJson("/applications/" + id, owner));
        assertThat(app.at("/documents/0/verification_status").asText()).isEqualTo("CHECKS_PASSED");
        assertThat(app.at("/documents/0/file_available").asBoolean()).isFalse();

        JsonNode again = body(upload(owner, id, 1, "income.pdf", "application/pdf", PDF_BYTES).andExpect(status().isOk()));
        assertThat(again.at("/documents/0/file_available").asBoolean()).isTrue();
    }

    @Test
    void listingApplicationsNeverCarriesFileContents() throws Exception {
        Account owner = newBeneficiaryWithProfile();
        Account lender = newLender("List Bank");
        String id = submit(owner, lender);
        upload(owner, id, 1, "income.pdf", "application/pdf", "%PDF-1.4 unique-marker-text".getBytes()).andExpect(status().isOk());
        assertThat(getJson("/applications", owner).andReturn().getResponse().getContentAsString()).doesNotContain("unique-marker-text").doesNotContain("JVBER");
        assertThat(getJson("/lender/applications", lender).andReturn().getResponse().getContentAsString()).doesNotContain("unique-marker-text").doesNotContain("JVBER");
    }

    // --- Notifications

    @Test
    void notificationsArePrivateAndCanBeMarkedRead() throws Exception {
        Account beneficiary = newBeneficiaryWithProfile();
        Account stranger = newBeneficiary();
        Account lender = newLender("Notice Bank");
        submit(beneficiary, lender);

        JsonNode notices = body(getJson("/notifications", beneficiary));
        assertThat(notices).isNotEmpty();
        String noticeId = notices.get(0).get("id").asText();
        assertThat(notices.get(0).get("read").asBoolean()).isFalse();

        postJson("/notifications/" + noticeId + "/read", stranger, null).andExpect(status().isNotFound());
        postJson("/notifications/" + noticeId + "/read", beneficiary, null).andExpect(status().isNoContent());
        assertThat(body(getJson("/notifications", beneficiary)).get(0).get("read").asBoolean()).isTrue();

        postJson("/notifications/read-all", lender, null).andExpect(status().isNoContent());
        for (JsonNode notice : body(getJson("/notifications", lender))) {
            assertThat(notice.get("read").asBoolean()).isTrue();
        }
    }
}
