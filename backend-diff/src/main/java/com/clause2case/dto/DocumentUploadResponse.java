package com.clause2case.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class DocumentUploadResponse {
    private String id;
    private String filename;
    private String status;
    private Integer fileSize;
    private String message;
}
