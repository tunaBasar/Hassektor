package com.medicopilot.services;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;
import com.medicopilot.dto.ReportNotificationEvent;
import com.medicopilot.handlers.NotificationWebSocketHandler;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.ReactiveRedisMessageListenerContainer;
import org.springframework.stereotype.Service;

@Service
public class RedisNotificationSubscriber {

    private static final Logger log = LoggerFactory.getLogger(RedisNotificationSubscriber.class);

    private final ReactiveRedisMessageListenerContainer listenerContainer;
    private final ChannelTopic topic;
    private final NotificationWebSocketHandler webSocketHandler;
    private final ObjectMapper objectMapper;

    public RedisNotificationSubscriber(ReactiveRedisMessageListenerContainer listenerContainer,
                                       ChannelTopic topic,
                                       NotificationWebSocketHandler webSocketHandler,
                                       ObjectMapper objectMapper) {
        this.listenerContainer = listenerContainer;
        this.topic = topic;
        this.webSocketHandler = webSocketHandler;
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    public void subscribe() {
        log.info("Redis Pub/Sub dinleniyor → kanal: {}", topic.getTopic());
        listenerContainer.receive(topic)
                .map(message -> message.getMessage())
                .doOnNext(this::handleMessage)
                .doOnError(err -> log.error("Redis dinleme hatası: {}", err.getMessage()))
                .subscribe();
    }

    private void handleMessage(String rawMessage) {
        log.info("Redis'ten mesaj alındı: {}", rawMessage);
        try {
            ReportNotificationEvent event = objectMapper.readValue(rawMessage, ReportNotificationEvent.class);
            String json = objectMapper.writeValueAsString(event);
            webSocketHandler.broadcast(json);
            log.info("WebSocket broadcast gönderildi → reportId={}, status={}", event.getReportId(), event.getStatus());
        } catch (JacksonException e) {
            log.warn("Redis mesajı parse edilemedi, ham olarak broadcast ediliyor: {}", e.getMessage());
            webSocketHandler.broadcast(rawMessage);
        }
    }
}
