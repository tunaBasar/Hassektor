package com.medicopilot.services;

import com.medicopilot.config.EncryptionConfig;
import com.medicopilot.exceptions.ResourceNotFoundException;
import com.medicopilot.models.Patient;
import com.medicopilot.models.Report;
import com.medicopilot.models.ReportStatus;
import com.medicopilot.repositories.PatientRepository;
import com.medicopilot.repositories.ReportRepository;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.codec.multipart.FilePart;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

@Service
public class MriReportService {

    private static final Logger log = LoggerFactory.getLogger(MriReportService.class);

    private final ReportRepository reportRepository;
    private final PatientRepository patientRepository;
    private final KafkaProducerService kafkaProducerService;
    private final EncryptionConfig encryptionConfig;
    private final MockPatientDataService mockPatientDataService;

    @Value("${app.mri-storage-path:./uploads/mri}")
    private String mriStoragePath;

    private Path storageDir;

    public MriReportService(ReportRepository reportRepository,
            PatientRepository patientRepository,
            KafkaProducerService kafkaProducerService,
            EncryptionConfig encryptionConfig,
            MockPatientDataService mockPatientDataService) {
        this.reportRepository = reportRepository;
        this.patientRepository = patientRepository;
        this.kafkaProducerService = kafkaProducerService;
        this.encryptionConfig = encryptionConfig;
        this.mockPatientDataService = mockPatientDataService;
    }

    @PostConstruct
    void initStorageDir() throws IOException {
        storageDir = Path.of(mriStoragePath).toAbsolutePath().normalize();
        Files.createDirectories(storageDir);
        log.info("MRI depolama dizini hazır: {}", storageDir);
    }

    public Mono<Report> createDraftReport(String patientId, String doctorId, FilePart filePart) {
        // T14: UUID prefix to prevent naming collisions
        String originalFileName = filePart.filename();
        String safeFileName = UUID.randomUUID().toString() + "_" + originalFileName;
        Path targetPath = storageDir.resolve(safeFileName).normalize();
        String absoluteImagePath = targetPath.toString();

        return filePart.transferTo(targetPath)
                .then(patientRepository.findById(patientId)
                        .switchIfEmpty(Mono.defer(() -> {
                            // Hasta DB'de yoksa → MockPatientDataService ile tam dolu hasta oluştur
                            Patient mockPatient = mockPatientDataService.generateMockPatient(patientId);
                            log.info("Yeni mock hasta oluşturuluyor: id={}, ad={} {}",
                                    patientId, mockPatient.getFirstName(), mockPatient.getLastName());
                            return patientRepository.save(mockPatient);
                        })))
                .flatMap(patient -> {
                    Report report = Report.builder()
                            .patientId(patient.getId())
                            .doctorId(doctorId)
                            .imagePath(absoluteImagePath)
                            .status(ReportStatus.DRAFT)
                            .build();
                    return reportRepository.save(report);
                })
                .doOnSuccess(saved -> {
                    log.info("Rapor oluşturuldu: {} → dosya: {}", saved.getId(), absoluteImagePath);
                    kafkaProducerService.sendMriIngestionEvent(
                            saved.getId(), saved.getPatientId(), saved.getImagePath());
                });
    }

    public Mono<Report> findById(String reportId) {
        return reportRepository.findById(reportId)
                .switchIfEmpty(Mono.error(new ResourceNotFoundException("Report not found with id: " + reportId)));
    }

    public Flux<Report> findByStatus(ReportStatus status) {
        if (status == null) {
            return reportRepository.findAll();
        }
        return reportRepository.findByStatus(status);
    }

    public Flux<Report> findByDoctorId(String doctorId, ReportStatus status) {
        if (status == null) {
            return reportRepository.findByDoctorId(doctorId);
        }
        return reportRepository.findByDoctorIdAndStatus(doctorId, status);
    }

    public Mono<Report> updateReport(String reportId, String doctorFinalText, ReportStatus status) {
        return findById(reportId)
                .flatMap(report -> {
                    report.setDoctorFinalText(doctorFinalText);
                    report.setStatus(status);
                    return reportRepository.save(report);
                });
    }

    /**
     * T8: Patient nationalId'sini AES-256-GCM ile şifreler.
     */
    public String encryptNationalId(String nationalId) {
        return encryptionConfig.encrypt(nationalId);
    }

    /**
     * T8: Şifreli nationalId'yi çözer.
     */
    public String decryptNationalId(String encryptedNationalId) {
        return encryptionConfig.decrypt(encryptedNationalId);
    }

    /**
     * T15: Path traversal koruması.
     * Verilen dosya yolunun izin verilen base directory içinde olduğunu doğrular.
     */
    public Path resolveAndValidateImagePath(String imagePath) {
        Path filePath = Path.of(imagePath).toAbsolutePath().normalize();

        // Guard: dosya yolu base directory dışına çıkmamalı
        if (!filePath.startsWith(storageDir)) {
            throw new SecurityException("Path traversal detected: " + imagePath);
        }

        return filePath;
    }
}
