package com.medicopilot.services;

import com.medicopilot.models.Gender;
import com.medicopilot.models.Patient;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Upload sırasında otomatik oluşturulan hasta kayıtlarına
 * gerçekçi mock bilgiler atayan servis.
 * <p>
 * Bu servis, MRI yüklemesi sırasında patientId ile eşleşen bir hasta
 * bulunamadığında devreye girer ve tam dolu bir Patient entity'si üretir.
 * PDF raporlarında hasta bilgileri tablosunun boş kalmaması için zorunludur.
 */
@Service
public class MockPatientDataService {

    private static final List<String> FIRST_NAMES_MALE = List.of(
            "Ahmet", "Mehmet", "Mustafa", "Ali", "Hasan",
            "Ibrahim", "Yusuf", "Emre", "Burak", "Murat",
            "Omer", "Kemal", "Serkan", "Tolga", "Baris"
    );

    private static final List<String> FIRST_NAMES_FEMALE = List.of(
            "Fatma", "Ayse", "Zeynep", "Elif", "Merve",
            "Esra", "Selin", "Deniz", "Ebru", "Canan",
            "Derya", "Gul", "Sevgi", "Hatice", "Melek"
    );

    private static final List<String> LAST_NAMES = List.of(
            "Yilmaz", "Kaya", "Demir", "Celik", "Sahin",
            "Ozturk", "Arslan", "Dogan", "Kilic", "Aslan",
            "Ozdemir", "Yildiz", "Aydin", "Ozcan", "Erdogan"
    );

    /**
     * Verilen patientId ile tam dolu bir mock Patient entity'si oluşturur.
     * Tüm alanlar (firstName, lastName, fullName, nationalId, dateOfBirth, gender) doldurulur.
     */
    public Patient generateMockPatient(String patientId) {
        ThreadLocalRandom rng = ThreadLocalRandom.current();

        // Cinsiyet belirle
        Gender gender = rng.nextBoolean() ? Gender.MALE : Gender.FEMALE;

        // İsim seç
        List<String> firstNamePool = (gender == Gender.MALE) ? FIRST_NAMES_MALE : FIRST_NAMES_FEMALE;
        String firstName = firstNamePool.get(rng.nextInt(firstNamePool.size()));
        String lastName = LAST_NAMES.get(rng.nextInt(LAST_NAMES.size()));

        // TC Kimlik No (11 haneli mock — gerçek algoritma uygulanmaz)
        String nationalId = generateMockNationalId(rng);

        // Doğum tarihi: 18-85 yaş arası
        int age = rng.nextInt(18, 86);
        LocalDate dob = LocalDate.now().minusYears(age).minusDays(rng.nextInt(0, 365));

        return Patient.builder()
                .id(patientId)
                .firstName(firstName)
                .lastName(lastName)
                .fullName(firstName + " " + lastName)
                .nationalId(nationalId)
                .dateOfBirth(dob)
                .gender(gender)
                .build();
    }

    /**
     * 11 haneli rastgele TC Kimlik No üretir (demo amaçlı).
     * İlk hane 0 olamaz.
     */
    private String generateMockNationalId(ThreadLocalRandom rng) {
        StringBuilder sb = new StringBuilder(11);
        sb.append(rng.nextInt(1, 10)); // İlk hane 1-9
        for (int i = 1; i < 11; i++) {
            sb.append(rng.nextInt(0, 10));
        }
        return sb.toString();
    }
}
