package com.medicopilot.controllers;

import com.medicopilot.controllers.dto.LoginRequest;
import com.medicopilot.dto.ApiResponse;
import com.medicopilot.exceptions.ValidationException;
import com.medicopilot.models.Doctor;
import com.medicopilot.repositories.DoctorRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "Authentication", description = "Lightweight doctor authentication for MVP")
public class AuthController {

    private final DoctorRepository doctorRepository;

    public AuthController(DoctorRepository doctorRepository) {
        this.doctorRepository = doctorRepository;
    }

    @Operation(summary = "Doctor login", description = "Authenticates a doctor by username and plain-text password (MVP only)")
    @PostMapping("/login")
    @SuppressWarnings("rawtypes")
    public Mono<ResponseEntity<ApiResponse>> login(@RequestBody LoginRequest request) {
        if (request.getUsername() == null || request.getUsername().isBlank()) {
            throw new ValidationException("Kullanıcı adı boş olamaz.");
        }
        if (request.getPassword() == null || request.getPassword().isBlank()) {
            throw new ValidationException("Şifre boş olamaz.");
        }

        return doctorRepository.findByUsername(request.getUsername())
                .filter(doctor -> request.getPassword() != null
                        && request.getPassword().equals(String.valueOf(doctor.getPassword())))
                .<ResponseEntity<ApiResponse>>map(doctor ->
                        ResponseEntity.ok(ApiResponse.ok("Login successful", doctor)))
                .switchIfEmpty(Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(ApiResponse.error("Invalid credentials", "UNAUTHORIZED"))));
    }
}
