package com.creditscore.backend.common;

import com.creditscore.backend.config.AppProperties;
import java.util.Properties;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Component;

/**
 * Sends email through the SMTP service in the APP_MAIL_* settings. Without them it's off, and the app
 * says so rather than pretending anything was sent.
 */
@Slf4j
@Component
public class Mailer {

    private static final String TIMEOUT_MS = "10000";

    private final String from;
    private final JavaMailSenderImpl sender;
    // Sending in the background keeps response times the same whether or not an account exists.
    private final ExecutorService background = Executors.newSingleThreadExecutor();

    public Mailer(AppProperties properties) {
        AppProperties.Mail mail = properties.mail();
        this.from = mail.from();
        this.sender = mail.host() == null || mail.host().isBlank() || from == null || from.isBlank() ? null : buildSender(mail);
    }

    private static JavaMailSenderImpl buildSender(AppProperties.Mail mail) {
        JavaMailSenderImpl impl = new JavaMailSenderImpl();
        impl.setHost(mail.host());
        impl.setPort(mail.port());
        boolean authenticated = mail.username() != null && !mail.username().isBlank();
        if (authenticated) {
            impl.setUsername(mail.username());
            impl.setPassword(mail.password());
        }
        Properties settings = impl.getJavaMailProperties();
        settings.put("mail.smtp.auth", String.valueOf(authenticated));
        settings.put("mail.smtp.starttls.enable", String.valueOf(mail.startTls()));
        settings.put("mail.smtp.connectiontimeout", TIMEOUT_MS);
        settings.put("mail.smtp.timeout", TIMEOUT_MS);
        settings.put("mail.smtp.writetimeout", TIMEOUT_MS);
        return impl;
    }

    public boolean isEnabled() {
        return sender != null;
    }

    public void send(String to, String subject, String body) {
        if (sender == null) return;
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(from);
        message.setTo(to);
        message.setSubject(subject);
        message.setText(body);
        background.execute(() -> {
            try {
                sender.send(message);
            } catch (MailException e) {
                // No address or body here, because the body can hold a sign-in link.
                log.warn("Could not send an email: {}", e.getClass().getSimpleName());
            }
        });
    }
}
