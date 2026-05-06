package com.medicopilot.handlers;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.socket.WebSocketHandler;
import org.springframework.web.reactive.socket.WebSocketSession;
import reactor.core.publisher.Mono;
import reactor.core.publisher.Sinks;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class NotificationWebSocketHandler implements WebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(NotificationWebSocketHandler.class);

    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    private final Sinks.Many<String> sink = Sinks.many().multicast().onBackpressureBuffer();

    @Override
    public Mono<Void> handle(WebSocketSession session) {
        sessions.put(session.getId(), session);
        log.info("WebSocket bağlandı: sessionId={} | aktif session={}", session.getId(), sessions.size());

        Mono<Void> output = session.send(
                sink.asFlux().map(session::textMessage)
        );

        Mono<Void> input = session.receive()
                .doFinally(signal -> {
                    sessions.remove(session.getId());
                    log.info("WebSocket ayrıldı: sessionId={} | kalan session={}", session.getId(), sessions.size());
                })
                .then();

        return Mono.zip(input, output).then();
    }

    public void broadcast(String message) {
        int sessionCount = sessions.size();
        Sinks.EmitResult result = sink.tryEmitNext(message);
        if (result.isFailure()) {
            log.error("WebSocket broadcast BAŞARISIZ: result={}, sessions={}, message={}", result, sessionCount, message);
        } else {
            log.info("WebSocket broadcast OK → {} aktif session'a gönderildi", sessionCount);
        }
    }
}
