package com.creditscore.backend.config;

import com.creditscore.backend.auth.AuthDtos;
import com.creditscore.backend.auth.AuthService;
import com.creditscore.backend.user.Repositories.UserRepository;
import com.creditscore.backend.user.Role;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * Optional fictional accounts for demos, so there are lenders to choose from on a new database.
 * Runs only when APP_SEED_DEMO_PASSWORD is set, which keeps credentials out of the source code.
 */
@Slf4j
@Component
@RequiredArgsConstructor
class DemoDataSeeder implements ApplicationRunner {

    private final AppProperties properties;
    private final UserRepository users;
    private final AuthService auth;

    @Override
    public void run(ApplicationArguments args) {
        String password = properties.seed().demoPassword();
        if (password == null || password.isBlank()) return;

        List<AuthDtos.RegisterRequest> accounts = List.of(
                lender("arun.mehta@unitybank.example", "Unity Bank", "Arun Mehta", "NBFC-UB-2024-001", "+91 8001234567", password),
                lender("sunita@grameen.example", "Grameen Finance", "Sunita Devi", "NBFC-GF-2024-002", "+91 8009876543", password),
                lender("rajesh@sahabank.example", "Saha Cooperative Bank", "Rajesh Saha", "COOP-SCB-2024-003", "+91 8005551234", password),
                beneficiary("rahul.kumar@example.com", "Rahul Kumar", "+91 9876543210", password));

        for (AuthDtos.RegisterRequest account : accounts) {
            if (!users.existsByEmail(account.email())) {
                auth.registerDemoAccount(account);
                log.info("Created demo account {}", account.email());
            }
        }
    }

    private static AuthDtos.RegisterRequest lender(String email, String institution, String contact, String license, String phone, String password) {
        return new AuthDtos.RegisterRequest(Role.lender, email, phone, password, null, institution, contact, license);
    }

    private static AuthDtos.RegisterRequest beneficiary(String email, String name, String phone, String password) {
        return new AuthDtos.RegisterRequest(Role.beneficiary, email, phone, password, name, null, null, null);
    }
}
