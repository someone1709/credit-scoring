package com.creditscore.backend.auth;

import com.creditscore.backend.user.Role;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** The wire format of the auth routes. Must match frontend/src/services/auth/http.ts. */
public final class AuthDtos {

    private static final String PHONE = "^\\+?[0-9][0-9\\s-]{8,14}$";
    private static final String PASSWORD = "^(?=.*[A-Za-z])(?=.*[0-9]).*$";
    private static final String PASSWORD_MESSAGE = "Include at least one letter and one number";

    private AuthDtos() {}

    public record LoginRequest(
            @NotBlank(message = "Enter your email address") String email,
            @NotBlank(message = "Enter your password") String password,
            boolean rememberMe) {}

    public record RegisterRequest(
            @NotNull(message = "Choose an account type") Role role,
            @NotBlank(message = "Enter your email address") @Email(message = "Enter a valid email address") @Size(max = 190) String email,
            @NotBlank(message = "Enter your phone number") @Pattern(regexp = PHONE, message = "Enter a valid phone number") String phone,
            @NotNull(message = "Enter a password") @Size(min = 8, max = 72, message = "Use 8 to 72 characters")
            @Pattern(regexp = PASSWORD, message = PASSWORD_MESSAGE) String password,
            @Size(max = 80, message = "Use 80 characters or fewer") String name,
            @Size(max = 100, message = "Use 100 characters or fewer") String institutionName,
            @Size(max = 80, message = "Use 80 characters or fewer") String contactPerson,
            @Size(max = 40, message = "Use 40 characters or fewer") String licenseNumber) {

        @AssertTrue(message = "Enter your full name")
        boolean isName() {
            return role != Role.beneficiary || (name != null && name.trim().length() >= 2);
        }

        @AssertTrue(message = "Enter the institution name")
        boolean isInstitutionName() {
            return role != Role.lender || (institutionName != null && institutionName.trim().length() >= 2);
        }

        @AssertTrue(message = "Enter a contact person")
        boolean isContactPerson() {
            return role != Role.lender || (contactPerson != null && contactPerson.trim().length() >= 2);
        }

        @AssertTrue(message = "Enter the license number")
        boolean isLicenseNumber() {
            return role != Role.lender || (licenseNumber != null && licenseNumber.trim().length() >= 3);
        }
    }

    public record ForgotPasswordRequest(@NotBlank(message = "Enter your email address") @Email(message = "Enter a valid email address") String email) {}

    public record ResetPasswordRequest(
            @NotBlank(message = "This reset link is invalid") String token,
            @NotNull(message = "Enter a password") @Size(min = 8, max = 72, message = "Use 8 to 72 characters")
            @Pattern(regexp = PASSWORD, message = PASSWORD_MESSAGE) String password) {}

    public record ChangePasswordRequest(
            @NotBlank(message = "Enter your current password") String currentPassword,
            @NotNull(message = "Enter a new password") @Size(min = 8, max = 72, message = "Use 8 to 72 characters")
            @Pattern(regexp = PASSWORD, message = PASSWORD_MESSAGE) String newPassword) {}

    public record UpdateProfileRequest(
            @NotBlank(message = "Enter your full name") @Size(min = 2, max = 80, message = "Enter your full name") String name,
            @NotBlank(message = "Enter your email address") @Email(message = "Enter a valid email address") @Size(max = 190) String email,
            @NotBlank(message = "Enter your phone number") @Pattern(regexp = PHONE, message = "Enter a valid phone number") String phone,
            @Min(value = 1, message = "Enter a valid age") @Max(value = 120, message = "Enter a valid age") Integer age,
            @NotBlank(message = "Enter your occupation") @Size(max = 80) String occupation,
            @NotBlank(message = "Enter your address") @Size(max = 200) String address,
            @NotBlank(message = "Enter your city") @Size(max = 80) String city,
            @NotBlank(message = "Enter your state") @Size(max = 80) String state,
            @NotNull(message = "Must be 6 digits") @Pattern(regexp = "^\\d{6}$", message = "Must be 6 digits") String pincode) {}

    /** One of the two user shapes in the frontend's README. The fields of the other role are left out. */
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public sealed interface UserDto permits BeneficiaryDto, LenderDto {}

    public record BeneficiaryDto(String id, Role role, String name, String email, String phone, Integer age,
                                 String occupation, String address, String city, String state, String pincode) implements UserDto {}

    public record LenderDto(String id, Role role, String institutionName, String contactPerson, String email,
                            String phone, String licenseNumber) implements UserDto {}

    public record AuthResponse(String accessToken, UserDto user) {}
}
