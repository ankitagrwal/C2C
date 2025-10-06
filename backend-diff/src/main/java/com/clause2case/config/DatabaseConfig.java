package com.clause2case.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.transaction.annotation.EnableTransactionManagement;

import jakarta.annotation.PostConstruct;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.transaction.annotation.Transactional;

@Configuration
@EnableJpaRepositories(basePackages = "com.clause2case.repository")
@EnableTransactionManagement
public class DatabaseConfig {
    
    @PersistenceContext
    private EntityManager entityManager;
    
    /**
     * Initialize pgvector extension if not already enabled
     * This ensures vector similarity search capabilities are available
     */
    @PostConstruct
    @Transactional
    public void initializeDatabase() {
        try {
            // Enable pgvector extension if not already enabled
            entityManager.createNativeQuery("CREATE EXTENSION IF NOT EXISTS vector").executeUpdate();
            System.out.println("✅ pgvector extension is enabled");
        } catch (Exception e) {
            System.err.println("⚠️  Could not enable pgvector extension: " + e.getMessage());
            System.err.println("   Make sure pgvector is installed on your PostgreSQL database");
        }
    }
}
