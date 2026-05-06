package com.medicopilot.handlers;

import org.springframework.stereotype.Component;
import org.springframework.web.reactive.socket.WebSocketHandler;
import org.springframework.web.reactive.socket.WebSocketSession;
import reactor.core.publisher.Mono;
import reactor.core.publisher.Sinks;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class NotificationWebSocketHandler implements WebSocketHandler {

    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    private final Sinks.Many<String> sink = Sinks.many().multicast().onBackpressureBuffer();

    @Override
    public Mono<Void> handle(WebSocketSession session) {
        sessions.put(session.getId(), session);

        Mono<Void> output = session.send(
                sink.asFlux().map(session::textMessage)
        );

        Mono<Void> input = session.receive()
                .doFinally(signal -> sessions.remove(session.getId()))
                .then();

        return Mono.zip(input, output).then();
    }

    public void broadcast(String message) {
        sink.tryEmitNext(message);
    }
}
