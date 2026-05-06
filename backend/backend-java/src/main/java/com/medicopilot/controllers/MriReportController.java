package com.medicopilot.controllers;

import com.medicopilot.controllers.dto.ReportUpdateRequest;
import com.medicopilot.dto.ApiResponse;
import com.medicopilot.models.Patient;
import com.medicopilot.models.Report;
import com.medicopilot.models.ReportStatus;
import com.medicopilot.repositories.PatientRepository;
import com.medicopilot.services.MriReportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.codec.multipart.FilePart;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

import java.net.URLConnection;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "MRI Reports", description = "MRI report upload, listing, and approval endpoints")
public class MriReportController {

    private static final Logger log = LoggerFactory.getLogger(MriReportController.class);

    private final MriReportService mriReportService;
    private final PatientRepository patientRepository;

    public MriReportController(MriReportService mriReportService, PatientRepository patientRepository) {
        this.mriReportService = mriReportService;
        this.patientRepository = patientRepository;
    }

    @Operation(summary = "Upload MRI image", description = "Uploads an MRI image, creates a DRAFT report, and fires a Kafka event for AI processing")
    @PostMapping(value = "/mri/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Mono<ResponseEntity<ApiResponse<Report>>> uploadMri(
            @Parameter(description = "MRI image file", required = true,
                    content = @Content(mediaType = MediaType.APPLICATION_OCTET_STREAM_VALUE,
                            schema = @Schema(type = "string", format = "binary")))
            @RequestPart("file") FilePart file,
            @Parameter(description = "Patient ID to associate with this MRI scan (auto-generated if omitted)")
            @RequestPart(value = "patientId", required = false) String patientId,
            @Parameter(description = "Doctor ID performing the upload (from login)")
            @RequestPart(value = "doctorId", required = false) String doctorId) {

        String resolvedPatientId = (patientId != null && !patientId.isBlank())
                ? patientId.trim()
                : "P-" + UUID.randomUUID().toString().substring(0, 8);

        return mriReportService.createDraftReport(resolvedPatientId, doctorId, file)
                .map(report -> ResponseEntity
                        .status(HttpStatus.ACCEPTED)
                        .body(ApiResponse.ok("Görüntü başarıyla kuyruğa alındı.", report)));
    }

    @Operation(summary = "List reports", description = "Lists reports, optionally filtered by status (e.g. REVIEW_NEEDED)")
    @GetMapping("/reports")
    public Mono<ResponseEntity<ApiResponse<List<Report>>>> getReports(
            @RequestParam(value = "status", required = false) ReportStatus status) {

        return mriReportService.findByStatus(status)
                .collectList()
                .map(reports -> ResponseEntity.ok(ApiResponse.ok("Raporlar listelendi.", reports)));
    }

    @Operation(summary = "Get report by ID", description = "Retrieves a single report by its unique identifier")
    @GetMapping("/reports/{reportId}")
    public Mono<ResponseEntity<ApiResponse<Report>>> getReportById(@PathVariable String reportId) {

        return mriReportService.findById(reportId)
                .map(report -> ResponseEntity.ok(ApiResponse.ok("Rapor detayı getirildi.", report)));
    }

    @Operation(summary = "Update report", description = "Updates doctor's final text and changes report status (e.g. APPROVED)")
    @PutMapping("/reports/{reportId}")
    public Mono<ResponseEntity<ApiResponse<Report>>> updateReport(
            @PathVariable String reportId,
            @RequestBody ReportUpdateRequest request) {

        return mriReportService.updateReport(reportId, request.getDoctorFinalText(), request.getStatus())
                .map(updated -> ResponseEntity.ok(ApiResponse.ok("Rapor güncellendi.", updated)));
    }

    @Operation(summary = "List doctor's reports", description = "Lists reports belonging to a specific doctor, optionally filtered by status")
    @GetMapping("/reports/doctor/{doctorId}")
    public Mono<ResponseEntity<ApiResponse<List<Report>>>> getReportsByDoctor(
            @PathVariable String doctorId,
            @RequestParam(value = "status", required = false) ReportStatus status) {

        return mriReportService.findByDoctorId(doctorId, status)
                .collectList()
                .map(reports -> ResponseEntity.ok(ApiResponse.ok("Doktor raporları listelendi.", reports)));
    }

    @Operation(summary = "View MR image", description = "Serves the MRI image file associated with a report as a binary stream")
    @GetMapping("/mri/view/{reportId}")
    public Mono<ResponseEntity<Resource>> viewMriImage(@PathVariable String reportId) {

        return mriReportService.findById(reportId)
                .map(report -> {
                    // T15: Path traversal guard — validates path stays within base directory
                    Path filePath;
                    try {
                        filePath = mriReportService.resolveAndValidateImagePath(report.getImagePath());
                    } catch (SecurityException e) {
                        log.error("Path traversal attempt blocked for reportId={}: {}", reportId, e.getMessage());
                        return ResponseEntity.status(HttpStatus.FORBIDDEN).<Resource>build();
                    }

                    if (!Files.exists(filePath) || !Files.isReadable(filePath)) {
                        return ResponseEntity.notFound().<Resource>build();
                    }

                    Resource resource = new FileSystemResource(filePath);

                    // Detect content type from file name
                    String contentType = URLConnection.guessContentTypeFromName(filePath.getFileName().toString());
                    if (contentType == null) {
                        contentType = "application/octet-stream";
                    }

                    return ResponseEntity.ok()
                            .contentType(MediaType.parseMediaType(contentType))
                            .body(resource);
                });
    }

    @Operation(summary = "Get patient by ID", description = "Retrieves patient information by patient ID for report PDF generation. Returns normalized data with fallback defaults.")
    @GetMapping("/patients/{patientId}")
    public Mono<ResponseEntity<ApiResponse<Patient>>> getPatientById(@PathVariable String patientId) {
        return patientRepository.findById(patientId)
                .map(patient -> {
                    // T8: nationalId'yi API yanıtında şifresiz döndür (çöz)
                    if (patient.getNationalId() != null && !patient.getNationalId().isBlank()) {
                        try {
                            patient.setNationalId(mriReportService.decryptNationalId(patient.getNationalId()));
                        } catch (Exception e) {
                            log.warn("nationalId decrypt edilemedi (zaten düz metin olabilir): {}", e.getMessage());
                        }
                    }
                    // Normalize: eski dokümanlar sadece fullName'e sahip, firstName/lastName yok
                    normalizePatientFields(patient);
                    return ResponseEntity.ok(ApiResponse.ok("Hasta bilgileri getirildi.", patient));
                })
                .switchIfEmpty(Mono.defer(() -> {
                    log.info("Patient bulunamadi, fallback hasta donuluyor: patientId={}", patientId);
                    Patient fallback = Patient.builder()
                            .id(patientId)
                            .firstName("Bilinmiyor")
                            .lastName("Bilinmiyor")
                            .fullName("Bilinmiyor")
                            .nationalId("Belirtilmemis")
                            .build();
                    return Mono.just(ResponseEntity.ok(ApiResponse.ok("Fallback hasta bilgileri.", fallback)));
                }));
    }

    /**
     * Eski MongoDB dokümanlarıyla uyumluluk için hasta alanlarını normalize eder.
     * Eski dokümanlar sadece fullName'e sahipken, yeni şema firstName/lastName kullanır.
     * Null alanlar için varsayılan değerler atanır.
     */
    private void normalizePatientFields(Patient patient) {
        // Eski şema: sadece fullName varsa, firstName'e kopyala
        if (patient.getFirstName() == null && patient.getFullName() != null) {
            String full = patient.getFullName().trim();
            int spaceIdx = full.lastIndexOf(' ');
            if (spaceIdx > 0) {
                patient.setFirstName(full.substring(0, spaceIdx));
                patient.setLastName(full.substring(spaceIdx + 1));
            } else {
                patient.setFirstName(full);
            }
        }
        // fullName yoksa ve firstName varsa, fullName'i oluştur
        if (patient.getFullName() == null && patient.getFirstName() != null) {
            String fn = patient.getFirstName();
            String ln = (patient.getLastName() != null) ? " " + patient.getLastName() : "";
            patient.setFullName((fn + ln).trim());
        }
        // Null alanlar için varsayılan değerler
        if (patient.getFirstName() == null) patient.setFirstName("Bilinmiyor");
        if (patient.getLastName() == null) patient.setLastName("Bilinmiyor");
        if (patient.getFullName() == null) patient.setFullName("Bilinmiyor");
        if (patient.getNationalId() == null) patient.setNationalId("Belirtilmemis");
    }
}
