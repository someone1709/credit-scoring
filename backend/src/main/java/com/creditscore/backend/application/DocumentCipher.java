package com.creditscore.backend.application;

import com.creditscore.backend.config.AppProperties;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Component;

/**
 * Encrypts documents with AES-256-GCM, so a copy of the database doesn't expose anyone's bank statements.
 * The document id is bound in, so one person's encrypted file can't be swapped onto another's document.
 * Losing APP_DOCUMENT_KEY makes the stored files unreadable.
 */
@Component
class DocumentCipher {

    private static final int KEY_BYTES = 32;
    private static final int IV_BYTES = 12;
    private static final int TAG_BITS = 128;

    private final SecureRandom random = new SecureRandom();
    private final SecretKeySpec key;

    DocumentCipher(AppProperties properties) {
        byte[] decoded;
        try {
            decoded = Base64.getDecoder().decode(properties.documents().encryptionKey());
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("APP_DOCUMENT_KEY must be base64. Generate one with: openssl rand -base64 32");
        }
        if (decoded.length != KEY_BYTES) {
            throw new IllegalStateException("APP_DOCUMENT_KEY must be " + KEY_BYTES + " bytes. Generate one with: openssl rand -base64 32");
        }
        key = new SecretKeySpec(decoded, "AES");
    }

    byte[] encrypt(byte[] plain, String documentId) {
        try {
            byte[] iv = new byte[IV_BYTES];
            random.nextBytes(iv);
            byte[] sealed = cipher(Cipher.ENCRYPT_MODE, iv, documentId).doFinal(plain);
            return ByteBuffer.allocate(IV_BYTES + sealed.length).put(iv).put(sealed).array();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Could not encrypt the document", e);
        }
    }

    byte[] decrypt(byte[] stored, String documentId) {
        try {
            byte[] iv = Arrays.copyOf(stored, IV_BYTES);
            return cipher(Cipher.DECRYPT_MODE, iv, documentId).doFinal(stored, IV_BYTES, stored.length - IV_BYTES);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Could not decrypt the document", e);
        }
    }

    private Cipher cipher(int mode, byte[] iv, String documentId) throws GeneralSecurityException {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(mode, key, new GCMParameterSpec(TAG_BITS, iv));
        cipher.updateAAD(documentId.getBytes(StandardCharsets.UTF_8));
        return cipher;
    }
}
