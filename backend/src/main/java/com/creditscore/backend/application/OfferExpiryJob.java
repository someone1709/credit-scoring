package com.creditscore.backend.application;

import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Accepting an expired offer is refused anyway; this keeps the stored statuses honest in between. */
@Component
@RequiredArgsConstructor
class OfferExpiryJob {

    private final ApplicationService applications;

    @Scheduled(initialDelayString = "PT30S", fixedDelayString = "PT5M")
    void expireOffers() {
        applications.expireDueOffers(Instant.now());
    }
}
