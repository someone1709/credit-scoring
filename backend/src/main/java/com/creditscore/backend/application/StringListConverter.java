package com.creditscore.backend.application;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.util.Arrays;
import java.util.List;

/** Stores a short list of lines in one text column. */
@Converter
public class StringListConverter implements AttributeConverter<List<String>, String> {

    private static final String SEPARATOR = "\n";

    @Override
    public String convertToDatabaseColumn(List<String> lines) {
        return lines == null ? "" : String.join(SEPARATOR, lines);
    }

    @Override
    public List<String> convertToEntityAttribute(String stored) {
        return stored == null || stored.isEmpty() ? List.of() : Arrays.asList(stored.split(SEPARATOR));
    }
}
