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
@Table(name = "internal_tools")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class InternalTool {
    
    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    @Column(name = "id")
    private String id;
    
    @Column(name = "name", nullable = false)
    private String name;
    
    @Column(name = "tool_type", nullable = false)
    private String toolType; // 'crm', 'erp', 'custom'
    
    @Column(name = "api_endpoint")
    private String apiEndpoint;
    
    @Column(name = "auth_type", nullable = false)
    private String authType; // 'api_key', 'oauth', 'basic_auth'
    
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "config_fields", columnDefinition = "jsonb")
    private Map<String, Object> configFields;
    
    @Column(name = "is_active")
    private Boolean isActive = true;
    
    @Column(name = "created_at")
    private LocalDateTime createdAt;
    
    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
