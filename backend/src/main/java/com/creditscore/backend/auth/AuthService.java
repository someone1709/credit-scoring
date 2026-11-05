package com.creditscore.backend.auth;

import com.creditscore.backend.auth.AuthDtos.AuthResponse;
import com.creditscore.backend.auth.AuthDtos.BeneficiaryDto;
import com.creditscore.backend.auth.AuthDtos.LenderDto;
import com.creditscore.backend.auth.AuthDtos.UserDto;
import com.creditscore.backend.common.ApiException;
import com.creditscore.backend.common.AttemptLimiter;
import com.creditscore.backend.common.Ids;
import com.creditscore.backend.common.Mailer;
import com.creditscore.backend.config.AppProperties;
import com.creditscore.backend.user.ApprovalStatus;
import com.creditscore.backend.user.BeneficiaryProfile;
import com.creditscore.backend.user.LenderProfile;
import com.creditscore.backend.user.Repositories.BeneficiaryProfileRepository;
import com.creditscore.backend.user.Repositories.LenderProfileRepository;
import com.creditscore.backend.user.Repositories.UserRepository;
import com.creditscore.backend.user.Role;
import com.creditscore.backend.user.User;
import jakarta.annotation.PostConstruct;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    /** A second tab can refresh with the same cookie just after the first; that isn't token theft. */
    private static final Duration ROTATION_GRACE = Duration.ofSeconds(30);
    private static final List<String> LOGO_COLORS = List.of("#2563eb", "#059669", "#dc2626", "#7c3aed", "#d97706");
    private static final int MAX_LOGIN_FAILURES = 5;
    private static final int MAX_LOGIN_FAILURES_PER_ADDRESS = 50;
    private static final Duration LOGIN_WINDOW = Duration.ofMinutes(15);
    private static final int MAX_EMAIL_REQUESTS = 20;
    private static final Duration EMAIL_WINDOW = Duration.ofHours(1);
    private static final int MAX_RESET_FAILURES = 20;
    private static final Duration VERIFICATION_LIFETIME = Duration.ofHours(24);

    private final UserRepository users;
    private final BeneficiaryProfileRepository beneficiaries;
    private final LenderProfileRepository lenders;
    private final TokenRepositories.RefreshTokenRepository refreshTokens;
    private final TokenRepositories.PasswordResetTokenRepository resetTokens;
    private final PasswordEncoder passwordEncoder;
    private final JwtEncoder jwtEncoder;
    private final AppProperties properties;
    private final TokenRepositories.EmailVerificationTokenRepository verificationTokens;
    private final AccountEmails emails;
    private final Mailer mailer;
    private final AttemptLimiter limiter;

    private String unknownAccountHash;

    @PostConstruct
    void prepareUnknownAccountHash() {
        unknownAccountHash = passwordEncoder.encode(Ids.randomToken());
    }

    /** What a signed-in client receives. The refresh token goes in a cookie, never in the body. */
    public record Session(AuthResponse response, String refreshToken, Duration cookieMaxAge) {}

    private static String normaliseEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    @Transactional
    public Session login(AuthDtos.LoginRequest request, String clientIp) {
        String email = normaliseEmail(request.email());
        // The pair limits guessing one account's password. The address limits trying many accounts.
        String accountKey = "login:" + email + "|" + clientIp;
        String addressKey = "login-ip:" + clientIp;
        limiter.check(accountKey, MAX_LOGIN_FAILURES, LOGIN_WINDOW);
        limiter.check(addressKey, MAX_LOGIN_FAILURES_PER_ADDRESS, LOGIN_WINDOW);

        User user = users.findByEmail(email).orElse(null);
        // Hash even for an unknown email, so response time doesn't reveal which accounts exist.
        String hash = user != null ? user.getPasswordHash() : unknownAccountHash;
        boolean matches = passwordEncoder.matches(request.password(), hash);
        if (user == null || !matches) {
            limiter.record(accountKey, LOGIN_WINDOW);
            limiter.record(addressKey, LOGIN_WINDOW);
            throw new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "The email or password is incorrect.");
        }
        limiter.reset(accountKey);
        return startSession(user, request.rememberMe());
    }

    @Transactional
    public Session register(AuthDtos.RegisterRequest request) {
        // With no mail service nobody could ever confirm, so the step is skipped.
        User user = createAccount(request, !mailer.isEnabled(), ApprovalStatus.PENDING);
        if (mailer.isEnabled()) sendVerification(user);
        return startSession(user, false);
    }

    /** Fictional accounts for demos, which nobody needs to confirm or approve. */
    @Transactional
    public void registerDemoAccount(AuthDtos.RegisterRequest request) {
        createAccount(request, true, ApprovalStatus.APPROVED);
    }

    private User createAccount(AuthDtos.RegisterRequest request, boolean emailVerified, ApprovalStatus approvalStatus) {
        String email = normaliseEmail(request.email());
        if (users.existsByEmail(email)) {
            throw ApiException.fieldError(HttpStatus.CONFLICT, "email", "This email is already registered. Try signing in instead.");
        }

        User user = new User();
        user.setId(Ids.generate(request.role() == Role.lender ? "LEN" : "BEN", 8, users::existsById));
        user.setRole(request.role());
        user.setEmail(email);
        user.setPhone(request.phone().trim());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setCreatedAt(Instant.now());
        user.setEmailVerified(emailVerified);
        users.saveAndFlush(user);

        if (request.role() == Role.lender) {
            LenderProfile profile = new LenderProfile();
            profile.setUserId(user.getId());
            profile.setInstitutionName(request.institutionName().trim());
            profile.setContactPerson(request.contactPerson().trim());
            profile.setLicenseNumber(request.licenseNumber().trim());
            profile.setLogoColor(LOGO_COLORS.get(Math.floorMod(user.getId().hashCode(), LOGO_COLORS.size())));
            profile.setApprovalStatus(approvalStatus);
            lenders.save(profile);
        } else {
            BeneficiaryProfile profile = new BeneficiaryProfile();
            profile.setUserId(user.getId());
            profile.setName(request.name().trim());
            beneficiaries.save(profile);
        }
        return user;
    }

    @Transactional(noRollbackFor = ApiException.class)
    public Session refresh(String presentedToken) {
        ApiException invalid = new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "Please sign in.");
        if (presentedToken == null || presentedToken.isBlank()) throw invalid;

        RefreshToken token = refreshTokens.findByTokenHash(Hashing.sha256(presentedToken)).orElseThrow(() -> invalid);
        Instant now = Instant.now();
        if (token.isRevoked() || token.getExpiresAt().isBefore(now)) throw invalid;

        User user = users.findById(token.getUserId()).orElseThrow(() -> invalid);

        if (token.getRotatedAt() != null) {
            if (token.getRotatedAt().plus(ROTATION_GRACE).isAfter(now)) {
                // Within the grace period the first response has already replaced the cookie.
                return new Session(new AuthResponse(accessToken(user), toDto(user)), null, null);
            }
            // An old token coming back later suggests theft, so end every session for this user.
            refreshTokens.revokeAllForUser(user.getId());
            throw invalid;
        }

        token.setRotatedAt(now);
        return startSession(user, token.isPersistent());
    }

    @Transactional
    public void logout(String presentedToken) {
        if (presentedToken == null) return;
        refreshTokens.findByTokenHash(Hashing.sha256(presentedToken)).ifPresent(token -> token.setRevoked(true));
    }

    @Transactional
    public void requestPasswordReset(String email, String clientIp) {
        String key = "forgot:" + clientIp;
        limiter.check(key, MAX_EMAIL_REQUESTS, EMAIL_WINDOW);
        limiter.record(key, EMAIL_WINDOW);
        // The controller answers the same way either way, so accounts can't be discovered.
        users.findByEmail(normaliseEmail(email)).ifPresent(user -> {
            resetTokens.findByUserIdAndUsedFalse(user.getId()).forEach(old -> old.setUsed(true));
            String token = Ids.randomToken();
            PasswordResetToken reset = new PasswordResetToken();
            reset.setUserId(user.getId());
            reset.setTokenHash(Hashing.sha256(token));
            reset.setExpiresAt(Instant.now().plus(properties.passwordReset().minutes(), ChronoUnit.MINUTES));
            resetTokens.save(reset);
            emails.sendPasswordReset(user.getEmail(), token);
        });
    }

    @Transactional
    public void resetPassword(AuthDtos.ResetPasswordRequest request, String clientIp) {
        String key = "reset:" + clientIp;
        limiter.check(key, MAX_RESET_FAILURES, LOGIN_WINDOW);
        PasswordResetToken reset = resetTokens.findByTokenHash(Hashing.sha256(request.token()))
                .filter(candidate -> !candidate.isUsed() && candidate.getExpiresAt().isAfter(Instant.now()))
                .orElse(null);
        if (reset == null) {
            limiter.record(key, LOGIN_WINDOW);
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_RESET_TOKEN", "This reset link is invalid or has expired. Please request a new one.");
        }
        User user = users.findById(reset.getUserId()).orElseThrow();
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        reset.setUsed(true);
        refreshTokens.revokeAllForUser(user.getId());
    }

    private void sendVerification(User user) {
        verificationTokens.findByUserIdAndUsedFalse(user.getId()).forEach(old -> old.setUsed(true));
        String token = Ids.randomToken();
        EmailVerificationToken verification = new EmailVerificationToken();
        verification.setUserId(user.getId());
        verification.setTokenHash(Hashing.sha256(token));
        verification.setExpiresAt(Instant.now().plus(VERIFICATION_LIFETIME));
        verificationTokens.save(verification);
        emails.sendEmailVerification(user.getEmail(), token);
    }

    @Transactional
    public void verifyEmail(AuthDtos.VerifyEmailRequest request, String clientIp) {
        String key = "verify:" + clientIp;
        limiter.check(key, MAX_RESET_FAILURES, LOGIN_WINDOW);
        EmailVerificationToken verification = verificationTokens.findByTokenHash(Hashing.sha256(request.token()))
                .filter(candidate -> !candidate.isUsed() && candidate.getExpiresAt().isAfter(Instant.now()))
                .orElse(null);
        if (verification == null) {
            limiter.record(key, LOGIN_WINDOW);
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_VERIFICATION_TOKEN", "This link is invalid or has expired. Sign in to request a new one.");
        }
        verification.setUsed(true);
        users.findById(verification.getUserId()).orElseThrow().setEmailVerified(true);
    }

    @Transactional
    public void resendVerification(String userId) {
        String key = "resend:" + userId;
        limiter.check(key, MAX_EMAIL_REQUESTS, EMAIL_WINDOW);
        limiter.record(key, EMAIL_WINDOW);
        User user = users.findById(userId).orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "Please sign in."));
        if (!user.isEmailVerified() && mailer.isEnabled()) sendVerification(user);
    }

    @Transactional
    public void changePassword(String userId, AuthDtos.ChangePasswordRequest request) {
        User user = users.findById(userId).orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "Please sign in."));
        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw ApiException.fieldError(HttpStatus.UNPROCESSABLE_ENTITY, "current_password", "Your current password is incorrect.");
        }
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
    }

    @Transactional
    public UserDto updateBeneficiaryProfile(String userId, AuthDtos.UpdateProfileRequest request) {
        User user = users.findById(userId).orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "Please sign in."));
        if (user.getRole() != Role.beneficiary) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Only beneficiaries have this profile.");
        }
        String email = normaliseEmail(request.email());
        if (!email.equals(user.getEmail()) && users.existsByEmail(email)) {
            throw ApiException.fieldError(HttpStatus.CONFLICT, "email", "This email is already registered.");
        }
        boolean emailChanged = !email.equals(user.getEmail());
        user.setEmail(email);
        user.setPhone(request.phone().trim());
        if (emailChanged && mailer.isEnabled()) {
            user.setEmailVerified(false);
            sendVerification(user);
        }

        BeneficiaryProfile profile = beneficiaries.findById(userId).orElseThrow();
        profile.setName(request.name().trim());
        profile.setAge(request.age());
        profile.setOccupation(request.occupation().trim());
        profile.setAddress(request.address().trim());
        profile.setCity(request.city().trim());
        profile.setState(request.state().trim());
        profile.setPincode(request.pincode().trim());
        return toDto(user);
    }

    @Transactional(readOnly = true)
    public UserDto currentUser(String userId) {
        return toDto(users.findById(userId).orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "Please sign in.")));
    }

    private Session startSession(User user, boolean remember) {
        Duration lifetime = remember
                ? Duration.ofDays(properties.refresh().rememberDays())
                : Duration.ofHours(properties.refresh().sessionHours());
        String token = Ids.randomToken();

        RefreshToken stored = new RefreshToken();
        stored.setUserId(user.getId());
        stored.setTokenHash(Hashing.sha256(token));
        stored.setExpiresAt(Instant.now().plus(lifetime));
        stored.setPersistent(remember);
        refreshTokens.save(stored);

        return new Session(new AuthResponse(accessToken(user), toDto(user)), token, remember ? lifetime : null);
    }

    private String accessToken(User user) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .subject(user.getId())
                .issuedAt(now)
                .expiresAt(now.plus(properties.jwt().accessTokenMinutes(), ChronoUnit.MINUTES))
                .claim("role", user.getRole().name())
                .build();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        return jwtEncoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }

    private UserDto toDto(User user) {
        // If the mail service is turned off later, people mustn't be stuck waiting on an email that can't come.
        boolean emailVerified = user.isEmailVerified() || !mailer.isEnabled();
        if (user.getRole() == Role.lender) {
            LenderProfile profile = lenders.findById(user.getId()).orElseThrow();
            return new LenderDto(user.getId(), Role.lender, profile.getInstitutionName(), profile.getContactPerson(),
                    user.getEmail(), user.getPhone(), profile.getLicenseNumber(), emailVerified, profile.getApprovalStatus());
        }
        BeneficiaryProfile profile = beneficiaries.findById(user.getId()).orElseThrow();
        return new BeneficiaryDto(user.getId(), Role.beneficiary, profile.getName(), user.getEmail(), user.getPhone(), profile.getAge(),
                profile.getOccupation(), profile.getAddress(), profile.getCity(), profile.getState(), profile.getPincode(), emailVerified);
    }
}
