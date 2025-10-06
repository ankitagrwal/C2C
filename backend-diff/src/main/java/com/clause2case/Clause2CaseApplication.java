package com.clause2case;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@SpringBootApplication
@EnableConfigurationProperties
public class Clause2CaseApplication {

    public static void main(String[] args) {
        SpringApplication.run(Clause2CaseApplication.class, args);
        System.out.println("🚀 Clause2Case Backend is running on port 8080");
        System.out.println("📊 Health check: http://localhost:8080/api/health");
        System.out.println("🔐 Login endpoint: POST http://localhost:8080/api/auth/login");
    }
}
