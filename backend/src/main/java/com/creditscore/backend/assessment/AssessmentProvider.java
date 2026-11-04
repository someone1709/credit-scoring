package com.creditscore.backend.assessment;

/** The FastAPI ML service will implement this in Phase 3, so nothing else needs to change. */
public interface AssessmentProvider {

    AssessmentContract.Response assess(AssessmentContract.Request request, AssessmentContract.VerificationStatus verificationStatus);
}
