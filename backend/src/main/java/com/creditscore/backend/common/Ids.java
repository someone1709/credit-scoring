package com.creditscore.backend.common;

import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.function.Predicate;

public final class Ids {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

    private Ids() {}

    /** A short readable id, retried until it's unused. */
    public static String generate(String prefix, int length, Predicate<String> isTaken) {
        String id;
        do {
            StringBuilder builder = new StringBuilder(prefix);
            for (int i = 0; i < length; i++) {
                builder.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
            }
            id = builder.toString();
        } while (isTaken.test(id));
        return id;
    }

    /** 256 random bits as hex, for tokens handed to users. */
    public static String randomToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }
}
