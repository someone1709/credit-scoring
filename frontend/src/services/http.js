// The single Axios client for the Spring Boot API. Set VITE_API_MODE=live and
// VITE_API_BASE_URL to use it. The access token stays in memory only: the backend keeps
// the refresh token in an httpOnly cookie, so a page reload silently restores the session.

import axios from 'axios';

/** The error shape from Master Brief §6.7. */
export class ApiError extends Error {
    status;
    code;
    details;

    constructor(status, code, message, details = []) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

export const API_MODE = import.meta.env.VITE_API_MODE === 'live' ? 'live' : 'mock';

export const http = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api/v1',
    withCredentials: true,
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
});

let accessToken = null;
let onSessionExpired = null;

export function setAccessToken(token) {
    accessToken = token;
}

export function setSessionExpiredHandler(handler) {
    onSessionExpired = handler;
}

http.interceptors.request.use(config => {
    if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
    return config;
});

// These answer 401 for a wrong password or a dead cookie, which isn't an expired session.
const AUTH_ROUTES_WITHOUT_RETRY = ['/auth/login', '/auth/register', '/auth/refresh'];

// Everyone who needs a refresh shares one request. A refresh token usually works once, so a
// second parallel request would fail and wrongly sign the user out.
let refreshInFlight = null;

export function refreshSession() {
    refreshInFlight ??= http
        .post('/auth/refresh')
        .then(response => {
            setAccessToken(response.data.access_token);
            return response.data;
        })
        .finally(() => {
            refreshInFlight = null;
        });
    return refreshInFlight;
}

http.interceptors.response.use(undefined, async (error) => {
    const config = error.config;
    const isAuthRoute = AUTH_ROUTES_WITHOUT_RETRY.some(route => config?.url?.includes(route));

    if (error.response?.status === 401 && config && !config._retried && !isAuthRoute && accessToken) {
        config._retried = true;
        try {
            await refreshSession();
        } catch {
            setAccessToken(null);
            onSessionExpired?.();
            throw toApiError(error);
        }
        // Outside the try: if the retry itself fails, that's an ordinary error, not a dead session.
        return http.request(config);
    }
    throw toApiError(error);
});

export function toApiError(error) {
    if (error instanceof ApiError) return error;
    if (axios.isAxiosError(error)) {
        if (!error.response) {
            return new ApiError(0, 'NETWORK_ERROR', "We couldn't reach the server. Check your connection and try again.");
        }
        const body = error.response.data;
        return new ApiError(
            error.response.status,
            body?.error ?? 'REQUEST_FAILED',
            body?.message ?? 'Something went wrong. Please try again.',
            Array.isArray(body?.details) ? body.details : [],
        );
    }
    return new ApiError(0, 'UNKNOWN_ERROR', 'Something went wrong. Please try again.');
}
