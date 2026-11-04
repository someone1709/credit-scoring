package com.creditscore.backend.notification;

import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notifications;

    public void notify(String userId, Notification.Type type, String title, String message) {
        Notification notification = new Notification();
        notification.setUserId(userId);
        notification.setType(type);
        notification.setTitle(title);
        notification.setMessage(message.length() > 700 ? message.substring(0, 700) : message);
        notification.setCreatedAt(Instant.now());
        notifications.save(notification);
    }
}
