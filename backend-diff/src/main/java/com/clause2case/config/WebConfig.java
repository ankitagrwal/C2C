package com.clause2case.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;
import org.springframework.boot.web.client.RestTemplateBuilder;

import java.time.Duration;

@Configuration
public class WebConfig {
    
    /**
     * RestTemplate for making HTTP requests to AI APIs (Gemini, OpenAI)
     * Configured with appropriate timeouts for long-running AI operations
     */
    @Bean
    public RestTemplate restTemplate(RestTemplateBuilder builder) {
        return builder
                .setConnectTimeout(Duration.ofSeconds(10))
                .setReadTimeout(Duration.ofSeconds(120)) // AI requests can take time
                .build();
    }
}
