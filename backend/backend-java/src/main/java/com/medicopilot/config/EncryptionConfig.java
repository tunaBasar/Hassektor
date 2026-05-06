package com.medicopilot.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * Application-level AES-256-GCM şifreleme konfigürasyonu.
 * <p>
 * Patient.nationalId gibi hassas alanları MongoDB'ye yazmadan önce şifreler,
 * okurken çözer. KVKK (Kişisel Verilerin Korunması Kanunu) uyumu için zorunludur.
 * <p>
 * AES-GCM, hem gizlilik hem bütünlük (integrity) sağlar. Her şifreleme işlemi
 * benzersiz bir IV (Initialization Vector) üretir ve cipher text'in başına ekler.
 */
@Configuration
public class EncryptionConfig {

    private static final String ALGORITHM = "AES";
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int GCM_TAG_LENGTH = 128; // bits
    private static final int GCM_IV_LENGTH = 12;   // bytes (96 bits — NIST recommendation)

    private final SecretKeySpec secretKey;

    public EncryptionConfig(
            @Value("${app.encryption.secret-key:MediCopilot2026SecretKey32Bytes!}") String key) {
        // AES-256 requires exactly 32 bytes
        byte[] keyBytes = key.getBytes();
        if (keyBytes.length != 32) {
            // Pad or truncate to 32 bytes deterministically
            byte[] adjusted = new byte[32];
            System.arraycopy(keyBytes, 0, adjusted, 0, Math.min(keyBytes.length, 32));
            keyBytes = adjusted;
        }
        this.secretKey = new SecretKeySpec(keyBytes, ALGORITHM);
    }

    /**
     * Verilen düz metni AES-256-GCM ile şifreler.
     *
     * @param plainText şifrelenecek metin
     * @return Base64-encoded [IV + CipherText]
     */
    public String encrypt(String plainText) {
        if (plainText == null || plainText.isBlank()) {
            return plainText;
        }
        try {
            byte[] iv = new byte[GCM_IV_LENGTH];
            new SecureRandom().nextBytes(iv);

            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            GCMParameterSpec parameterSpec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);
            cipher.init(Cipher.ENCRYPT_MODE, secretKey, parameterSpec);

            byte[] encryptedBytes = cipher.doFinal(plainText.getBytes());

            // Prepend IV to cipher text: [IV (12 bytes) | CipherText]
            ByteBuffer byteBuffer = ByteBuffer.allocate(GCM_IV_LENGTH + encryptedBytes.length);
            byteBuffer.put(iv);
            byteBuffer.put(encryptedBytes);

            return Base64.getEncoder().encodeToString(byteBuffer.array());
        } catch (Exception e) {
            throw new RuntimeException("Şifreleme hatası: " + e.getMessage(), e);
        }
    }

    /**
     * Base64-encoded AES-256-GCM cipher text'i çözer.
     *
     * @param encryptedText Base64-encoded [IV + CipherText]
     * @return orijinal düz metin
     */
    public String decrypt(String encryptedText) {
        if (encryptedText == null || encryptedText.isBlank()) {
            return encryptedText;
        }
        try {
            byte[] decoded = Base64.getDecoder().decode(encryptedText);

            ByteBuffer byteBuffer = ByteBuffer.wrap(decoded);
            byte[] iv = new byte[GCM_IV_LENGTH];
            byteBuffer.get(iv);

            byte[] cipherText = new byte[byteBuffer.remaining()];
            byteBuffer.get(cipherText);

            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            GCMParameterSpec parameterSpec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);
            cipher.init(Cipher.DECRYPT_MODE, secretKey, parameterSpec);

            byte[] decryptedBytes = cipher.doFinal(cipherText);
            return new String(decryptedBytes);
        } catch (Exception e) {
            throw new RuntimeException("Şifre çözme hatası: " + e.getMessage(), e);
        }
    }
}
