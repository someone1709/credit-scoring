package com.creditscore.backend.notification;

import com.creditscore.backend.common.ApiException;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/notifications")
@RequiredArgsConstructor
class NotificationController {

    record NotificationDto(String id, String title, String message, Notification.Type type, boolean read, Instant createdAt) {}

    private final NotificationRepository notifications;

    @GetMapping
    List<NotificationDto> list(@AuthenticationPrincipal Jwt jwt) {
        return notifications.findTop100ByUserIdOrderByCreatedAtDescIdDesc(jwt.getSubject()).stream()
                .map(n -> new NotificationDto(String.valueOf(n.getId()), n.getTitle(), n.getMessage(), n.getType(), n.isRead(), n.getCreatedAt()))
                .toList();
    }

    @PostMapping("/{id}/read")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void markRead(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) {
        if (notifications.markRead(id, jwt.getSubject()) == 0) throw ApiException.notFound("This notification could not be found.");
    }

    @PostMapping("/read-all")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void markAllRead(@AuthenticationPrincipal Jwt jwt) {
        notifications.markAllRead(jwt.getSubject());
    }
}
