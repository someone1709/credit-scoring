package com.creditscore.backend.auth;

import com.creditscore.backend.config.AppProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * No mail server is set up for this prototype, so no email is actually sent. For local development,
 * APP_LOG_RESET_LINKS=true prints the link instead. Connect a real mail service here for production.
 */
@Slf4j
@Component
@RequiredArgsConstructor
class PasswordResetMailer {

    private final AppProperties properties;

    void send(String email, String token) {
        if (properties.passwordReset().logLinks()) {
            log.info("SIMULATED EMAIL to {}: reset your password at {}/reset-password?token={}", email, properties.passwordReset().frontendUrl(), token);
        }
    }
}
