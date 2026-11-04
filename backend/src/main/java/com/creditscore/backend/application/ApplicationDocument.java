package com.creditscore.backend.application;

import com.creditscore.backend.assessment.AssessmentContract.VerificationStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;

/** Metadata only. The uploaded file is checked, then discarded. */
@Entity
@Table(name = "documents")
@Getter
@Setter
public class ApplicationDocument {

    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "application_id")
    private LoanApplication application;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Enums.DocumentType type;

    @Column(nullable = false)
    private String label;

    private String filename;

    @Column(name = "uploaded_at")
    private Instant uploadedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "verification_status", nullable = false)
    private VerificationStatus verificationStatus;

    @Column(name = "check_note")
    private String checkNote;

    @Column(nullable = false)
    private int position;
}
