package com.medicopilot.services;

import com.medicopilot.exceptions.ResourceNotFoundException;
import com.medicopilot.models.Patient;
import com.medicopilot.models.Report;
import com.medicopilot.models.ReportStatus;
import com.medicopilot.repositories.PatientRepository;
import com.medicopilot.repositories.ReportRepository;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Service
public class MriReportService {

    private final ReportRepository reportRepository;
    private final PatientRepository patientRepository;
    private final KafkaProducerService kafkaProducerService;

    public MriReportService(ReportRepository reportRepository,
                            PatientRepository patientRepository,
                            KafkaProducerService kafkaProducerService) {
        this.reportRepository = reportRepository;
        this.patientRepository = patientRepository;
        this.kafkaProducerService = kafkaProducerService;
    }

    public Mono<Report> createDraftReport(String patientId, String doctorId, String originalFileName) {
        String mockImagePath = "/data/mri/" + originalFileName;

        return patientRepository.findById(patientId)
                .switchIfEmpty(patientRepository.save(
                        Patient.builder()
                                .id(patientId)
                                .fullName("Unknown Patient (Auto)")
                                .build()))
                .flatMap(patient -> {
                    Report report = Report.builder()
                            .patientId(patient.getId())
                            .doctorId(doctorId)
                            .imagePath(mockImagePath)
                            .status(ReportStatus.DRAFT)
                            .build();
                    return reportRepository.save(report);
                })
                .doOnSuccess(saved -> kafkaProducerService.sendMriIngestionEvent(
                        saved.getId(), saved.getPatientId(), saved.getImagePath()));
    }

    public Mono<Report> findById(String reportId) {
        return reportRepository.findById(reportId)
                .switchIfEmpty(Mono.error(new ResourceNotFoundException("Report not found with id: " + reportId)));
    }

    public Flux<Report> findByStatus(ReportStatus status) {
        return reportRepository.findByStatus(status);
    }

    public Mono<Report> updateReport(String reportId, String doctorFinalText, ReportStatus status) {
        return findById(reportId)
                .flatMap(report -> {
                    report.setDoctorFinalText(doctorFinalText);
                    report.setStatus(status);
                    return reportRepository.save(report);
                });
    }
}
