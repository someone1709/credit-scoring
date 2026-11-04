package com.creditscore.backend.user;

import com.creditscore.backend.application.ApplicationService;
import com.creditscore.backend.common.ApiException;
import com.creditscore.backend.common.AttemptLimiter;
import com.creditscore.backend.config.AppProperties;
import com.creditscore.backend.notification.Notification;
import com.creditscore.backend.notification.NotificationService;
import com.creditscore.backend.user.Repositories.LenderProfileRepository;
import com.creditscore.backend.user.Repositories.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Lets whoever runs the platform decide which lenders applicants can choose. The brief has only two
 * user roles, so this is guarded by a key in the server's settings rather than an admin account.
 */
@RestController
@RequestMapping("/admin/lenders")
@RequiredArgsConstructor
class LenderAdminController {

    record AdminLender(String id, String institutionName, String contactPerson, String email, String phone, String licenseNumber,
                       boolean emailVerified, ApprovalStatus approvalStatus, Instant registeredAt) {}

    private static final int MAX_FAILURES = 10;
    private static final Duration FAILURE_WINDOW = Duration.ofMinutes(15);

    private final LenderProfileRepository lenders;
    private final UserRepository users;
    private final NotificationService notifications;
    private final ApplicationService applications;
    private final AttemptLimiter limiter;
    private final AppProperties properties;

    private void requireKey(String presented, HttpServletRequest request) {
        String expected = properties.admin().key();
        // With no key set, these routes don't exist as far as anyone can tell.
        if (expected == null || expected.isBlank()) throw ApiException.notFound("Not found.");

        String limitKey = "admin:" + request.getRemoteAddr();
        limiter.check(limitKey, MAX_FAILURES, FAILURE_WINDOW);
        boolean matches = presented != null && MessageDigest.isEqual(presented.getBytes(StandardCharsets.UTF_8), expected.getBytes(StandardCharsets.UTF_8));
        if (!matches) {
            limiter.record(limitKey, FAILURE_WINDOW);
            throw new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_ADMIN_KEY", "That admin key is incorrect.");
        }
        limiter.reset(limitKey);
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<AdminLender> list(@RequestHeader(name = "X-Admin-Key", required = false) String key, HttpServletRequest request) {
        requireKey(key, request);
        return lenders.findAll().stream()
                .map(this::toDto)
                // People waiting on a decision come first, newest first.
                .sorted(Comparator.comparing((AdminLender lender) -> lender.approvalStatus() != ApprovalStatus.PENDING)
                        .thenComparing(AdminLender::registeredAt, Comparator.reverseOrder()))
                .toList();
    }

    @PostMapping("/{id}/approve")
    @Transactional
    public AdminLender approve(@RequestHeader(name = "X-Admin-Key", required = false) String key, @PathVariable String id, HttpServletRequest request) {
        requireKey(key, request);
        LenderProfile lender = find(id);
        lender.setApprovalStatus(ApprovalStatus.APPROVED);
        notifications.notify(id, Notification.Type.success, "Institution Approved", "Applicants can now choose " + lender.getInstitutionName() + " when they apply.");
        return toDto(lender);
    }

    @PostMapping("/{id}/reject")
    @Transactional
    public AdminLender reject(@RequestHeader(name = "X-Admin-Key", required = false) String key, @PathVariable String id, HttpServletRequest request) {
        requireKey(key, request);
        LenderProfile lender = find(id);
        lender.setApprovalStatus(ApprovalStatus.REJECTED);
        applications.removeLenderEverywhere(id);
        notifications.notify(id, Notification.Type.error, "Institution Not Approved", lender.getInstitutionName() + " can't receive applications. Contact the platform for details.");
        return toDto(lender);
    }

    private LenderProfile find(String id) {
        return lenders.findById(id).orElseThrow(() -> ApiException.notFound("This lender could not be found."));
    }

    private AdminLender toDto(LenderProfile lender) {
        User user = users.findById(lender.getUserId()).orElseThrow();
        return new AdminLender(lender.getUserId(), lender.getInstitutionName(), lender.getContactPerson(), user.getEmail(), user.getPhone(),
                lender.getLicenseNumber(), user.isEmailVerified(), lender.getApprovalStatus(), user.getCreatedAt());
    }
}
