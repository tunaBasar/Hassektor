package com.medicopilot.services;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;
import com.medicopilot.dto.ReportNotificationEvent;
import com.medicopilot.handlers.NotificationWebSocketHandler;
import jakarta.annotation.PostConstruct;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.ReactiveRedisMessageListenerContainer;
import org.springframework.stereotype.Service;

@Service
public class RedisNotificationSubscriber {

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
        listenerContainer.receive(topic)
                .map(message -> message.getMessage())
                .doOnNext(this::handleMessage)
                .subscribe();
    }

    private void handleMessage(String rawMessage) {
        try {
            ReportNotificationEvent event = objectMapper.readValue(rawMessage, ReportNotificationEvent.class);
            String json = objectMapper.writeValueAsString(event);
            webSocketHandler.broadcast(json);
        } catch (JacksonException e) {
            webSocketHandler.broadcast(rawMessage);
        }
    }
}
