package com.clause2case.repository;

import com.clause2case.model.ProcessingJob;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProcessingJobRepository extends JpaRepository<ProcessingJob, String> {
    
    List<ProcessingJob> findByDocumentId(String documentId);
    
    List<ProcessingJob> findByStatus(String status);
    
    List<ProcessingJob> findByJobType(String jobType);
    
    @Query("SELECT pj FROM ProcessingJob pj WHERE pj.documentId = :documentId AND pj.status = :status")
    List<ProcessingJob> findByDocumentIdAndStatus(String documentId, String status);
    
    @Query("SELECT pj FROM ProcessingJob pj WHERE pj.documentId = :documentId ORDER BY pj.createdAt DESC")
    List<ProcessingJob> findByDocumentIdOrderByCreatedAtDesc(String documentId);
    
    Optional<ProcessingJob> findFirstByDocumentIdOrderByCreatedAtDesc(String documentId);
}
