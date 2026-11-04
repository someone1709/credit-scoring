package com.creditscore.backend.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "beneficiary_profiles")
@Getter
@Setter
public class BeneficiaryProfile {

    @Id
    @Column(name = "user_id")
    private String userId;

    @Column(nullable = false)
    private String name;

    private Integer age;
    private String occupation;
    private String address;
    private String city;
    private String state;
    private String pincode;

    /** Workflow step 2 (Master Brief §4): the profile comes before the first application. */
    public boolean isComplete(String phone) {
        return hasText(phone) && hasText(occupation) && hasText(address) && hasText(city) && hasText(state) && hasText(pincode);
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
