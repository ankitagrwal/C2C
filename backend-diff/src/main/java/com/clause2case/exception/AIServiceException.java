package com.clause2case.exception;

public class AIServiceException extends RuntimeException {
    public AIServiceException(String message) {
        super(message);
    }
    
    public AIServiceException(String message, Throwable cause) {
        super(message, cause);
    }
}
