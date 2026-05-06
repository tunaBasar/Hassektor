package com.medicopilot.controllers;

import com.medicopilot.controllers.dto.ReportUpdateRequest;
import com.medicopilot.dto.ApiResponse;
import com.medicopilot.models.Report;
import com.medicopilot.models.ReportStatus;
import com.medicopilot.services.MriReportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.codec.multipart.FilePart;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

import java.util.List;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "MRI Reports", description = "MRI report upload, listing, and approval endpoints")
public class MriReportController {

    private final MriReportService mriReportService;

    public MriReportController(MriReportService mriReportService) {
        this.mriReportService = mriReportService;
    }

    @Operation(summary = "Upload MRI image", description = "Uploads an MRI image, creates a DRAFT report, and fires a Kafka event for AI processing")
    @PostMapping(value = "/mri/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Mono<ResponseEntity<ApiResponse<Report>>> uploadMri(
            @Parameter(description = "MRI image file", required = true,
                    content = @Content(mediaType = MediaType.APPLICATION_OCTET_STREAM_VALUE,
                            schema = @Schema(type = "string", format = "binary")))
            @RequestPart("file") FilePart file,
            @Parameter(description = "Patient ID to associate with this MRI scan", required = true)
            @RequestPart("patientId") String patientId,
            @Parameter(description = "Doctor ID performing the upload (from login)")
            @RequestPart(value = "doctorId", required = false) String doctorId) {

        return mriReportService.createDraftReport(patientId, doctorId, file.filename())
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
}
