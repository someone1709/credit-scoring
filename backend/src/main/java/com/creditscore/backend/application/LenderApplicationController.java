package com.creditscore.backend.application;

import com.creditscore.backend.application.ApplicationDtos.ApplicationDto;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/lender/applications")
@RequiredArgsConstructor
class LenderApplicationController {

    private final ApplicationService applications;

    @GetMapping
    List<ApplicationDto> list(@AuthenticationPrincipal Jwt jwt) {
        return applications.listForLender(jwt.getSubject());
    }

    @GetMapping("/{id}")
    ApplicationDto get(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
        return applications.getForLender(jwt.getSubject(), id);
    }

    @PostMapping("/{id}/decision")
    ApplicationDto decide(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @Valid @RequestBody ApplicationDtos.DecisionRequest request) {
        return applications.decide(jwt.getSubject(), id, request);
    }

    @PostMapping("/{id}/offers")
    @ResponseStatus(HttpStatus.CREATED)
    ApplicationDto makeOffer(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @Valid @RequestBody ApplicationDtos.CreateOfferRequest request) {
        return applications.makeOffer(jwt.getSubject(), id, request);
    }

    @PostMapping("/{id}/offers/{offerId}/withdraw")
    ApplicationDto withdraw(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @PathVariable String offerId) {
        return applications.withdrawOffer(jwt.getSubject(), id, offerId);
    }

    @PostMapping("/{id}/disbursement/advance")
    ApplicationDto advance(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
        return applications.advanceDisbursement(jwt.getSubject(), id);
    }
}
