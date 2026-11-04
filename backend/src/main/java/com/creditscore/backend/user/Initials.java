package com.creditscore.backend.user;

import java.util.Arrays;
import java.util.Locale;
import java.util.stream.Collectors;

final class Initials {

    private Initials() {}

    static String of(String name) {
        return Arrays.stream(name.trim().split("\\s+"))
                .limit(2)
                .map(word -> word.substring(0, 1).toUpperCase(Locale.ROOT))
                .collect(Collectors.joining());
    }
}
