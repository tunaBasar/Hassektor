package com.medicopilot.exceptions;

public class AIProcessingTimeoutException extends RuntimeException {

    public AIProcessingTimeoutException(String message) {
        super(message);
    }
}
