package com.creditscore.backend.common;

import java.util.List;

/** The error body from Master Brief §6.7. */
public record ApiError(String error, String message, List<FieldIssue> details) {

    public record FieldIssue(String field, String issue) {}

    public static ApiError of(String error, String message) {
        return new ApiError(error, message, List.of());
    }
}
