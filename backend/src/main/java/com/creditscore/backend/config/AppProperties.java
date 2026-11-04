package com.creditscore.backend.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public record AppProperties(Jwt jwt, Refresh refresh, PasswordReset passwordReset, Cors cors, Seed seed) {

    public record Jwt(String secret, long accessTokenMinutes) {}

    public record Refresh(long rememberDays, long sessionHours, boolean cookieSecure) {}

    public record PasswordReset(long minutes, String frontendUrl, boolean logLinks) {}

    public record Cors(List<String> allowedOrigins) {}

    public record Seed(String demoPassword) {}
}
