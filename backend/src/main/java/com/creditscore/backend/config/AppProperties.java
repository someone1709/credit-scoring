package com.creditscore.backend.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public record AppProperties(Jwt jwt, Refresh refresh, PasswordReset passwordReset, Cors cors, Seed seed, Ml ml, Documents documents, Mail mail, Admin admin) {

    public record Jwt(String secret, long accessTokenMinutes) {}

    public record Refresh(long rememberDays, long sessionHours, boolean cookieSecure) {}

    public record PasswordReset(long minutes, String frontendUrl, boolean logLinks) {}

    public record Cors(List<String> allowedOrigins) {}

    public record Seed(String demoPassword) {}

    public record Ml(String url, long timeoutSeconds) {}

    public record Documents(String encryptionKey) {}

    public record Mail(String host, int port, String username, String password, String from, boolean startTls) {}

    public record Admin(String key) {}
}
