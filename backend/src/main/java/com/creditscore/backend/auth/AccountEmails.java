package com.creditscore.backend.auth;

import com.creditscore.backend.common.Mailer;
import com.creditscore.backend.config.AppProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * The emails an account can receive. With no mail service set up, APP_LOG_RESET_LINKS=true prints
 * the links to this server's log instead, for local development only.
 */
@Slf4j
@Component
@RequiredArgsConstructor
class AccountEmails {

    private final Mailer mailer;
    private final AppProperties properties;

    void sendPasswordReset(String email, String token) {
        deliver(email, "Reset your BeneScore password",
                "Use this link to choose a new password. It works once and expires in " + properties.passwordReset().minutes() + " minutes.",
                "/reset-password?token=" + token);
    }

    void sendEmailVerification(String email, String token) {
        deliver(email, "Confirm your BeneScore email", "Use this link to confirm your email address. It expires in 24 hours.", "/verify-email?token=" + token);
    }

    private void deliver(String email, String subject, String intro, String path) {
        String link = properties.passwordReset().frontendUrl() + path;
        if (mailer.isEnabled()) {
            mailer.send(email, subject, intro + "\n\n" + link + "\n\nIf this wasn't you, you can ignore this email.\n\nBeneScore is an academic prototype. No real loans are issued.");
        } else if (properties.passwordReset().logLinks()) {
            log.info("SIMULATED EMAIL to {}: {} {}", email, subject, link);
        }
    }
}
