package com.creditscore.backend.auth;

import com.creditscore.backend.config.AppProperties;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.time.Duration;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
class AuthController {

    private static final String REFRESH_COOKIE = "refresh_token";
    // Only the auth routes need the cookie, so no other request carries it.
    private static final String COOKIE_PATH = "/api/v1/auth";

    private final AuthService authService;
    private final AppProperties properties;

    @PostMapping("/login")
    AuthDtos.AuthResponse login(@Valid @RequestBody AuthDtos.LoginRequest request, HttpServletResponse response) {
        return respond(authService.login(request), response);
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    AuthDtos.AuthResponse register(@Valid @RequestBody AuthDtos.RegisterRequest request, HttpServletResponse response) {
        return respond(authService.register(request), response);
    }

    @PostMapping("/refresh")
    AuthDtos.AuthResponse refresh(@CookieValue(name = REFRESH_COOKIE, required = false) String token, HttpServletResponse response) {
        return respond(authService.refresh(token), response);
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void logout(@CookieValue(name = REFRESH_COOKIE, required = false) String token, HttpServletResponse response) {
        authService.logout(token);
        writeCookie(response, "", Duration.ZERO);
    }

    @PostMapping("/forgot-password")
    @ResponseStatus(HttpStatus.ACCEPTED)
    void forgotPassword(@Valid @RequestBody AuthDtos.ForgotPasswordRequest request) {
        authService.requestPasswordReset(request.email());
    }

    @PostMapping("/reset-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void resetPassword(@Valid @RequestBody AuthDtos.ResetPasswordRequest request) {
        authService.resetPassword(request);
    }

    @PostMapping("/change-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void changePassword(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody AuthDtos.ChangePasswordRequest request) {
        authService.changePassword(jwt.getSubject(), request);
    }

    @GetMapping("/me")
    AuthDtos.UserDto me(@AuthenticationPrincipal Jwt jwt) {
        return authService.currentUser(jwt.getSubject());
    }

    @PatchMapping("/me")
    AuthDtos.UserDto updateProfile(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody AuthDtos.UpdateProfileRequest request) {
        return authService.updateBeneficiaryProfile(jwt.getSubject(), request);
    }

    private AuthDtos.AuthResponse respond(AuthService.Session session, HttpServletResponse response) {
        if (session.refreshToken() != null) {
            writeCookie(response, session.refreshToken(), session.cookieMaxAge());
        }
        return session.response();
    }

    /** A null lifetime makes a session cookie, which the browser drops when it closes. */
    private void writeCookie(HttpServletResponse response, String value, Duration maxAge) {
        ResponseCookie.ResponseCookieBuilder cookie = ResponseCookie.from(REFRESH_COOKIE, value)
                .httpOnly(true)
                .secure(properties.refresh().cookieSecure())
                .sameSite("Lax")
                .path(COOKIE_PATH);
        if (maxAge != null) cookie.maxAge(maxAge);
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.build().toString());
    }
}
