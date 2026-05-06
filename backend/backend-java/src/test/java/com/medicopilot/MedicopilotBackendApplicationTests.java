package com.medicopilot;

import com.medicopilot.repositories.PatientRepository;
import com.medicopilot.repositories.ReportRepository;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.data.redis.core.ReactiveRedisTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@SpringBootTest
class MedicopilotBackendApplicationTests {

	@MockitoBean
    private ReportRepository reportRepository;

    @MockitoBean
    private PatientRepository patientRepository;

    @MockitoBean
    private KafkaTemplate<String, Object> kafkaTemplate;

    @MockitoBean
    private ReactiveRedisTemplate<String, String> reactiveRedisTemplate;

    @Test
    void contextLoads() {
    }

}
