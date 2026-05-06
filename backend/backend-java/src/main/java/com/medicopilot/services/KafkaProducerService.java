package com.medicopilot.services;

import com.medicopilot.dto.MriIngestionEvent;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
public class KafkaProducerService {

    private static final String TOPIC = "mri_ingestion_topic";

    private final KafkaTemplate<String, MriIngestionEvent> kafkaTemplate;

    public KafkaProducerService(KafkaTemplate<String, MriIngestionEvent> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    public void sendMriIngestionEvent(String reportId, String patientId, String imagePath) {
        MriIngestionEvent event = MriIngestionEvent.builder()
                .reportId(reportId)
                .patientId(patientId)
                .imagePath(imagePath)
                .timestamp(Instant.now())
                .build();

        kafkaTemplate.send(TOPIC, reportId, event);
    }
}
