package com.creditscore.backend.application;

import java.util.Arrays;
import java.util.Locale;
import java.util.Map;

/** Real checks on a file's type and size. They say nothing about whether a document is genuine. */
final class DocumentChecks {

    private static final long MAX_BYTES = 5L * 1024 * 1024;
    private static final byte[] PDF = {'%', 'P', 'D', 'F', '-'};
    private static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF};
    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n'};
    private static final Map<String, byte[]> SIGNATURES = Map.of("pdf", PDF, "jpg", JPEG, "jpeg", JPEG, "png", PNG);
    private static final Map<String, String> CONTENT_TYPES = Map.of("pdf", "application/pdf", "jpg", "image/jpeg", "jpeg", "image/jpeg", "png", "image/png");

    record Result(boolean passed, String note) {}

    private DocumentChecks() {}

    private static String extensionOf(String filename) {
        int dot = filename.lastIndexOf('.');
        return dot < 0 ? "" : filename.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    /** Set from the checked file, never from what the uploader claimed. */
    static String contentType(String filename) {
        return CONTENT_TYPES.get(extensionOf(filename));
    }

    static Result check(String filename, long size, byte[] firstBytes) {
        byte[] signature = SIGNATURES.get(extensionOf(filename));

        if (signature == null) return new Result(false, "File type not accepted. Upload a PDF, JPG or PNG.");
        if (size == 0) return new Result(false, "The file is empty.");
        if (size > MAX_BYTES) return new Result(false, "The file is larger than 5 MB.");
        if (firstBytes.length < signature.length || !Arrays.equals(Arrays.copyOf(firstBytes, signature.length), signature)) {
            return new Result(false, "The file contents do not match its extension.");
        }
        return new Result(true, "File type and size checks passed. This does not prove the document is genuine.");
    }

    /** Keeps only the name, since a browser or client can send a full path. */
    static String cleanFilename(String original) {
        String name = original == null ? "" : original.replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1).trim();
        if (name.isEmpty()) return "document";
        return name.length() > 255 ? name.substring(name.length() - 255) : name;
    }
}
