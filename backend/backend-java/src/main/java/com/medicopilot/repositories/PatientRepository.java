package com.medicopilot.repositories;

import com.medicopilot.models.Patient;
import org.springframework.data.mongodb.repository.ReactiveMongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PatientRepository extends ReactiveMongoRepository<Patient, String> {
}
