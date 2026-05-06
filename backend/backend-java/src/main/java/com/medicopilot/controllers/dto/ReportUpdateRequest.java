package com.medicopilot.controllers.dto;

import com.medicopilot.models.ReportStatus;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class ReportUpdateRequest {

    private String doctorFinalText;
    private ReportStatus status;
}
