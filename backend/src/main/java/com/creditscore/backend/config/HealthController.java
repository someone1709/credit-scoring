package com.creditscore.backend.config;

import com.creditscore.backend.assessment.MlAssessmentProvider;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
class HealthController {

    private final MlAssessmentProvider ml;

    @GetMapping("/health")
    Map<String, String> health() {
        return Map.of("status", "UP", "ml", ml.status());
    }
}
