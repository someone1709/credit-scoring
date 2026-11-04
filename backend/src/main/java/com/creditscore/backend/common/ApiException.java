package com.creditscore.backend.common;

import java.util.List;
import lombok.Getter;
import org.springframework.http.HttpStatus;

/** A failure the client can act on. Its message is written for the end user. */
@Getter
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;
    private final List<ApiError.FieldIssue> details;

    public ApiException(HttpStatus status, String code, String message, List<ApiError.FieldIssue> details) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
    }

    public ApiException(HttpStatus status, String code, String message) {
        this(status, code, message, List.of());
    }

    /** Also used for records the caller may not see, so they can't tell the two cases apart. */
    public static ApiException notFound(String message) {
        return new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", message);
    }

    /** The request was understood, but the workflow doesn't allow it right now. */
    public static ApiException conflict(String message) {
        return new ApiException(HttpStatus.CONFLICT, "WORKFLOW_CONFLICT", message);
    }

    public static ApiException fieldError(HttpStatus status, String field, String issue) {
        return new ApiException(status, "VALIDATION_ERROR", "Invalid input", List.of(new ApiError.FieldIssue(field, issue)));
    }
}
