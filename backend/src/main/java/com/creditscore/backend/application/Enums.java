package com.creditscore.backend.application;

/** Fixed values from Master Brief §7 to §9. Application status and lender decision are separate on purpose. */
public final class Enums {

    private Enums() {}

    public enum ApplicationStatus { SUBMITTED, DOCUMENTS_REQUIRED, UNDER_REVIEW, OFFERS_AVAILABLE, OFFER_ACCEPTED, REJECTED, DISBURSED }

    public enum DecisionStatus { PENDING, UNDER_REVIEW, INFO_REQUESTED, OFFER_MADE, REJECTED }

    public enum OfferStatus { PENDING, ACCEPTED, DECLINED, EXPIRED, WITHDRAWN }

    public enum DocumentType { INCOME_PROOF, BANK_STATEMENT, ELECTRICITY_BILL, OTHER }

    /** Lowercase because that's the wire format the frontend uses. */
    public enum StepStatus { completed, current, pending }
}
