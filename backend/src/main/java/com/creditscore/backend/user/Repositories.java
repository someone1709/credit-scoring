package com.creditscore.backend.user;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public final class Repositories {

    private Repositories() {}

    public interface UserRepository extends JpaRepository<User, String> {
        Optional<User> findByEmail(String email);

        boolean existsByEmail(String email);
    }

    public interface BeneficiaryProfileRepository extends JpaRepository<BeneficiaryProfile, String> {}

    public interface LenderProfileRepository extends JpaRepository<LenderProfile, String> {}
}
