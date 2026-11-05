package com.creditscore.backend.user;

import java.util.Comparator;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Lenders a beneficiary can choose to share with. Contact and license details stay private. */
@RestController
@RequiredArgsConstructor
class LenderDirectoryController {

    record LenderSummary(String id, String name, String logoInitials, String logoColor) {}

    private final Repositories.LenderProfileRepository lenders;

    @GetMapping("/lenders")
    List<LenderSummary> list() {
        return lenders.findAll().stream()
                .filter(LenderProfile::isApproved)
                .sorted(Comparator.comparing(LenderProfile::getInstitutionName, String.CASE_INSENSITIVE_ORDER))
                .map(lender -> new LenderSummary(lender.getUserId(), lender.getInstitutionName(), lender.logoInitials(), lender.getLogoColor()))
                .toList();
    }
}
