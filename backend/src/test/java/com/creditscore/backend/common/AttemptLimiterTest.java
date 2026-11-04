package com.creditscore.backend.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class AttemptLimiterTest {

    private static final Duration WINDOW = Duration.ofMinutes(15);

    private static class MovableClock extends Clock {
        Instant now = Instant.parse("2026-01-01T00:00:00Z");

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }

    private final MovableClock clock = new MovableClock();
    private final AttemptLimiter limiter = new AttemptLimiter(clock);

    private void fail(String key, int times) {
        for (int i = 0; i < times; i++) limiter.record(key, WINDOW);
    }

    @Test
    void allowsAttemptsUpToTheLimitThenRefuses() {
        fail("key", 4);
        assertThatCode(() -> limiter.check("key", 5, WINDOW)).doesNotThrowAnyException();
        fail("key", 1);
        assertThatThrownBy(() -> limiter.check("key", 5, WINDOW))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.getStatus()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
                    assertThat(e.getCode()).isEqualTo("TOO_MANY_ATTEMPTS");
                    assertThat(e.getMessage()).contains("15 minutes");
                });
    }

    @Test
    void theWaitShownCountsDown() {
        fail("key", 5);
        clock.now = clock.now.plus(Duration.ofMinutes(14)).plusSeconds(30);
        assertThatThrownBy(() -> limiter.check("key", 5, WINDOW)).hasMessageContaining("1 minute.");
    }

    @Test
    void theLimitLiftsWhenTheWindowEnds() {
        fail("key", 5);
        clock.now = clock.now.plus(WINDOW);
        assertThatCode(() -> limiter.check("key", 5, WINDOW)).doesNotThrowAnyException();
        // Counting starts again rather than carrying on from the old total.
        fail("key", 4);
        assertThatCode(() -> limiter.check("key", 5, WINDOW)).doesNotThrowAnyException();
    }

    @Test
    void oneKeyDoesNotAffectAnother() {
        fail("one", 5);
        assertThatCode(() -> limiter.check("two", 5, WINDOW)).doesNotThrowAnyException();
    }

    @Test
    void resetClearsTheCount() {
        fail("key", 5);
        limiter.reset("key");
        assertThatCode(() -> limiter.check("key", 5, WINDOW)).doesNotThrowAnyException();
    }
}
