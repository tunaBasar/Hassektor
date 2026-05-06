package com.medicopilot.repositories;

import com.medicopilot.models.Report;
import com.medicopilot.models.ReportStatus;
import org.springframework.data.mongodb.repository.ReactiveMongoRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;

@Repository
public interface ReportRepository extends ReactiveMongoRepository<Report, String> {

    Flux<Report> findByStatus(ReportStatus status);

    Flux<Report> findByDoctorId(String doctorId);

    Flux<Report> findByDoctorIdAndStatus(String doctorId, ReportStatus status);
}
