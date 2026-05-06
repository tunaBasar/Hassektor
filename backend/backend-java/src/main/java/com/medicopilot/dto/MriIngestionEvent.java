package com.medicopilot.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MriIngestionEvent {

    private String reportId;
    private String patientId;
    private String imagePath;
    private Instant timestamp;
}
