package com.creditscore.backend.application;

import com.creditscore.backend.application.ApplicationDtos.ApplicationDto;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/applications")
@RequiredArgsConstructor
class BeneficiaryApplicationController {

    private final ApplicationService applications;

    @GetMapping
    List<ApplicationDto> list(@AuthenticationPrincipal Jwt jwt) {
        return applications.listForBeneficiary(jwt.getSubject());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    ApplicationDto submit(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ApplicationDtos.SubmitApplicationRequest request) {
        return applications.submit(jwt.getSubject(), request);
    }

    @GetMapping("/{id}")
    ApplicationDto get(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
        return applications.getForBeneficiary(jwt.getSubject(), id);
    }

    @PostMapping("/{id}/offers/{offerId}/accept")
    ApplicationDto accept(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @PathVariable String offerId) {
        return applications.acceptOffer(jwt.getSubject(), id, offerId);
    }

    @PostMapping("/{id}/offers/{offerId}/decline")
    ApplicationDto decline(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @PathVariable String offerId) {
        return applications.declineOffer(jwt.getSubject(), id, offerId);
    }

    @GetMapping("/{id}/documents/{documentId}/file")
    ResponseEntity<byte[]> file(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @PathVariable String documentId) {
        return DocumentResponses.of(applications.documentForBeneficiary(jwt.getSubject(), id, documentId));
    }

    @PostMapping(path = "/{id}/documents/{documentId}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    ApplicationDto uploadDocument(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @PathVariable String documentId, @RequestParam("file") MultipartFile file) {
        return applications.uploadDocument(jwt.getSubject(), id, documentId, file);
    }

    @DeleteMapping("/{id}/documents/{documentId}")
    ApplicationDto deleteDocument(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @PathVariable String documentId) {
        return applications.deleteDocument(jwt.getSubject(), id, documentId);
    }

    @PostMapping("/{id}/lenders/{lenderId}/revoke")
    ApplicationDto revokeLender(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @PathVariable String lenderId) {
        return applications.revokeLender(jwt.getSubject(), id, lenderId);
    }

    @PostMapping("/{id}/lenders/{lenderId}/reply")
    ApplicationDto replyToLender(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @PathVariable String lenderId, @Valid @RequestBody ApplicationDtos.ReplyRequest request) {
        return applications.replyToLender(jwt.getSubject(), id, lenderId, request);
    }
}
