package com.clause2case.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.GenericGenerator;

import java.time.LocalDateTime;

@Entity
@Table(name = "documents")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Document {
    
    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    @Column(name = "id")
    private String id;
    
    @Column(name = "customer_id")
    private String customerId;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", insertable = false, updatable = false)
    private Customer customer;
    
    @Column(name = "filename", nullable = false)
    private String filename;
    
    @Column(name = "content", columnDefinition = "TEXT")
    private String content;
    
    @Column(name = "file_data", columnDefinition = "TEXT")
    private String fileData; // Base64 encoded file data
    
    @Column(name = "doc_type")
    private String docType;
    
    @Column(name = "status")
    private String status = "uploaded";
    
    @Column(name = "file_size")
    private Integer fileSize;
    
    @Column(name = "created_at")
    private LocalDateTime createdAt;
    
    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
