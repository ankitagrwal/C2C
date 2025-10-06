package com.clause2case.repository;

import com.clause2case.model.Document;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DocumentRepository extends JpaRepository<Document, String> {
    
    List<Document> findByCustomerId(String customerId);
    
    List<Document> findByStatus(String status);
    
    List<Document> findByDocType(String docType);
    
    @Query("SELECT d FROM Document d WHERE d.customerId = :customerId AND d.status = :status")
    List<Document> findByCustomerIdAndStatus(String customerId, String status);
    
    @Query("SELECT d FROM Document d ORDER BY d.createdAt DESC")
    List<Document> findAllOrderByCreatedAtDesc();
}
