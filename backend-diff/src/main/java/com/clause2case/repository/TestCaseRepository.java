package com.clause2case.repository;

import com.clause2case.model.TestCase;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TestCaseRepository extends JpaRepository<TestCase, String> {
    
    List<TestCase> findByDocumentId(String documentId);
    
    List<TestCase> findByCustomerId(String customerId);
    
    List<TestCase> findByCategory(String category);
    
    List<TestCase> findByPriority(String priority);
    
    List<TestCase> findBySeverity(String severity);
    
    List<TestCase> findBySource(String source);
    
    @Query("SELECT tc FROM TestCase tc WHERE tc.documentId = :documentId AND tc.category = :category")
    List<TestCase> findByDocumentIdAndCategory(String documentId, String category);
    
    @Query("SELECT tc FROM TestCase tc WHERE tc.documentId = :documentId ORDER BY tc.createdAt DESC")
    List<TestCase> findByDocumentIdOrderByCreatedAtDesc(String documentId);
    
    @Query("SELECT tc FROM TestCase tc WHERE tc.customerId = :customerId ORDER BY tc.createdAt DESC")
    List<TestCase> findByCustomerIdOrderByCreatedAtDesc(String customerId);
    
    @Query("SELECT COUNT(tc) FROM TestCase tc WHERE tc.documentId = :documentId")
    long countByDocumentId(String documentId);
}
