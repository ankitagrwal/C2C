package com.clause2case.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.GenericGenerator;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.Map;

@Entity
@Table(name = "customers")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Customer {
    
    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    @Column(name = "id")
    private String id;
    
    @Column(name = "name", nullable = false)
    private String name;
    
    @Column(name = "solution_id", unique = true, nullable = false)
    private String solutionId;
    
    @Column(name = "industry")
    private String industry;
    
    @Column(name = "internal_tool_id")
    private String internalToolId;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "internal_tool_id", insertable = false, updatable = false)
    private InternalTool internalTool;
    
    @Column(name = "is_configured")
    private Boolean isConfigured = false;
    
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "tool_config", columnDefinition = "jsonb")
    private Map<String, Object> toolConfig;
    
    @Column(name = "last_sync")
    private LocalDateTime lastSync;
    
    @Column(name = "status")
    private String status = "active";
    
    @Column(name = "created_at")
    private LocalDateTime createdAt;
    
    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
