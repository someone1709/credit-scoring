package com.creditscore.backend.user;

/** Whether a lender may be chosen by applicants. It says nothing about whether its license is genuine. */
public enum ApprovalStatus {
    PENDING,
    APPROVED,
    REJECTED
}
