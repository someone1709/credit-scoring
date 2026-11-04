package com.creditscore.backend.common;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * Slows down password guessing and similar abuse. Counts live in memory, so they reset on restart
 * and aren't shared between servers, which is enough for one server. Several servers would need Redis or similar.
 */
@Component
public class AttemptLimiter {

    private record Window(int count, Instant startedAt) {}

    private static final int PURGE_ABOVE_ENTRIES = 10_000;

    private final Map<String, Window> windows = new ConcurrentHashMap<>();
    private final Clock clock;

    @Autowired
    public AttemptLimiter() {
        this(Clock.systemUTC());
    }

    AttemptLimiter(Clock clock) {
        this.clock = clock;
    }

    /** Refuses the request if this key has already used up its attempts. */
    public void check(String key, int max, Duration window) {
        Window current = windows.get(key);
        if (current != null && current.count() >= max && !expired(current, window)) {
            Duration wait = Duration.between(clock.instant(), current.startedAt().plus(window));
            long minutes = Math.max(1, wait.toSeconds() / 60 + (wait.toSeconds() % 60 > 0 ? 1 : 0));
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "TOO_MANY_ATTEMPTS",
                    "Too many attempts. Please try again in " + minutes + (minutes == 1 ? " minute." : " minutes."));
        }
    }

    public void record(String key, Duration window) {
        if (windows.size() > PURGE_ABOVE_ENTRIES) {
            windows.values().removeIf(entry -> expired(entry, window));
        }
        windows.compute(key, (ignored, current) -> current == null || expired(current, window)
                ? new Window(1, clock.instant())
                : new Window(current.count() + 1, current.startedAt()));
    }

    public void reset(String key) {
        windows.remove(key);
    }

    private boolean expired(Window entry, Duration window) {
        return !entry.startedAt().plus(window).isAfter(clock.instant());
    }
}
