package com.creditscore.backend.application;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;

/** One lender's own view of one application. A row existing is also what grants that lender access. */
@Entity
@Table(name = "lender_decisions")
@Getter
@Setter
public class LenderDecision {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "application_id")
    private LoanApplication application;

    @Column(name = "lender_id", nullable = false)
    private String lenderId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Enums.DecisionStatus status;

    private String note;

    @Column(name = "last_updated", nullable = false)
    private Instant lastUpdated;

    @Column(name = "applicant_reply")
    private String applicantReply;

    @Column(name = "applicant_reply_at")
    private Instant applicantReplyAt;
}
