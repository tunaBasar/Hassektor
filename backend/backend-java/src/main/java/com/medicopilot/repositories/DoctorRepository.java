package com.medicopilot.repositories;

import com.medicopilot.models.Doctor;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.data.mongodb.repository.ReactiveMongoRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Mono;

@Repository
public interface DoctorRepository extends ReactiveMongoRepository<Doctor, String> {

    @Query("{ 'username': ?0 }")
    Mono<Doctor> findByUsername(String username);
}
