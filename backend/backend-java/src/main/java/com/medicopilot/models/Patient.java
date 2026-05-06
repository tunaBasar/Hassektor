package com.medicopilot.models;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.time.LocalDate;

/**
 * Patient (Hasta) Entity - ARCHITECTURE.md §4.5 uyumlu.
 * <p>
 * nationalId alanı AES-256-GCM ile application-level şifrelenmiş olarak saklanır (T8).
 * Şifreleme/çözme işlemi service katmanında (MriReportService) gerçekleştirilir.
 * <p>
 * fullName alanı eski MongoDB dokümanlarıyla geriye dönük uyumluluk için korunmuştur.
 * Yeni kayıtlarda firstName/lastName kullanılır.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "patients")
public class Patient {

    @Id
    private String id;

    @Indexed
    private String nationalId;

    private String firstName;

    private String lastName;

    /**
     * Eski MongoDB şemasıyla geriye dönük uyumluluk.
     * Eski dokümanlar sadece fullName alanına sahipti.
     * Bu alan yeni kayıtlarda da firstName + lastName birleşimi olarak set edilir.
     */
    private String fullName;

    private LocalDate dateOfBirth;

    private Gender gender;

    @CreatedDate
    private Instant createdAt;
}
