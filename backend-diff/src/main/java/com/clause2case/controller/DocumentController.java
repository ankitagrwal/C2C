package com.clause2case.controller;

import com.clause2case.dto.DocumentUploadResponse;
import com.clause2case.model.Document;
import com.clause2case.service.DocumentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/documents")
@RequiredArgsConstructor
public class DocumentController {
    
    private final DocumentService documentService;
    
    @PostMapping("/upload")
    public ResponseEntity<DocumentUploadResponse> uploadDocument(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "customerId", required = false) String customerId,
            @RequestParam(value = "docType", required = false) String docType) {
        
        Document document = documentService.uploadDocument(file, customerId, docType);
        
        DocumentUploadResponse response = new DocumentUploadResponse(
            document.getId(),
            document.getFilename(),
            document.getStatus(),
            document.getFileSize(),
            "Document uploaded successfully"
        );
        
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
    
    @GetMapping
    public ResponseEntity<List<Document>> getAllDocuments() {
        List<Document> documents = documentService.getAllDocuments();
        return ResponseEntity.ok(documents);
    }
    
    @GetMapping("/{id}")
    public ResponseEntity<Document> getDocumentById(@PathVariable String id) {
        Document document = documentService.getDocumentById(id);
        return ResponseEntity.ok(document);
    }
    
    @GetMapping("/customer/{customerId}")
    public ResponseEntity<List<Document>> getDocumentsByCustomer(@PathVariable String customerId) {
        List<Document> documents = documentService.getDocumentsByCustomerId(customerId);
        return ResponseEntity.ok(documents);
    }
    
    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> deleteDocument(@PathVariable String id) {
        documentService.deleteDocument(id);
        return ResponseEntity.ok(Map.of("message", "Document deleted successfully"));
    }
    
    @PatchMapping("/{id}/status")
    public ResponseEntity<Document> updateDocumentStatus(
            @PathVariable String id,
            @RequestBody Map<String, String> request) {
        
        String status = request.get("status");
        Document document = documentService.updateDocumentStatus(id, status);
        return ResponseEntity.ok(document);
    }
}
