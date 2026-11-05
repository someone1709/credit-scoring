package com.creditscore.backend.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "lender_profiles")
@Getter
@Setter
public class LenderProfile {

    @Id
    @Column(name = "user_id")
    private String userId;

    @Column(name = "institution_name", nullable = false)
    private String institutionName;

    @Column(name = "contact_person", nullable = false)
    private String contactPerson;

    @Column(name = "license_number", nullable = false)
    private String licenseNumber;

    @Column(name = "logo_color", nullable = false)
    private String logoColor;

    @Enumerated(EnumType.STRING)
    @Column(name = "approval_status", nullable = false)
    private ApprovalStatus approvalStatus;

    /** Only an approved institution can be chosen by applicants or see their data. */
    public boolean isApproved() {
        return approvalStatus == ApprovalStatus.APPROVED;
    }

    public String logoInitials() {
        return Initials.of(institutionName);
    }
}
