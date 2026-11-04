package com.creditscore.backend.auth;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

final class TokenRepositories {

    private TokenRepositories() {}

    interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {
        @Lock(LockModeType.PESSIMISTIC_WRITE)
        Optional<RefreshToken> findByTokenHash(String tokenHash);

        @Modifying
        @Query("update RefreshToken t set t.revoked = true where t.userId = :userId and t.revoked = false")
        void revokeAllForUser(@Param("userId") String userId);
    }

    interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Long> {
        Optional<PasswordResetToken> findByTokenHash(String tokenHash);

        List<PasswordResetToken> findByUserIdAndUsedFalse(String userId);
    }

    interface EmailVerificationTokenRepository extends JpaRepository<EmailVerificationToken, Long> {
        Optional<EmailVerificationToken> findByTokenHash(String tokenHash);

        List<EmailVerificationToken> findByUserIdAndUsedFalse(String userId);
    }
}
