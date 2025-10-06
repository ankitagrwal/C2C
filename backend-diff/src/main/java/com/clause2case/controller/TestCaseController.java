package com.clause2case.controller;

import com.clause2case.dto.TestCaseRequest;
import com.clause2case.model.TestCase;
import com.clause2case.service.TestCaseService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/test-cases")
@RequiredArgsConstructor
public class TestCaseController {
    
    private final TestCaseService testCaseService;
    
    @GetMapping("/document/{documentId}")
    public ResponseEntity<List<TestCase>> getTestCasesByDocument(@PathVariable String documentId) {
        List<TestCase> testCases = testCaseService.getTestCasesByDocumentId(documentId);
        return ResponseEntity.ok(testCases);
    }
    
    @GetMapping("/customer/{customerId}")
    public ResponseEntity<List<TestCase>> getTestCasesByCustomer(@PathVariable String customerId) {
        List<TestCase> testCases = testCaseService.getTestCasesByCustomerId(customerId);
        return ResponseEntity.ok(testCases);
    }
    
    @GetMapping("/{id}")
    public ResponseEntity<TestCase> getTestCaseById(@PathVariable String id) {
        TestCase testCase = testCaseService.getTestCaseById(id);
        return ResponseEntity.ok(testCase);
    }
    
    @PutMapping("/{id}")
    public ResponseEntity<TestCase> updateTestCase(
            @PathVariable String id,
            @RequestBody TestCaseRequest request) {
        
        TestCase updates = new TestCase();
        updates.setTitle(request.getTitle());
        updates.setContent(request.getContent());
        updates.setSteps(request.getSteps());
        updates.setExpectedResult(request.getExpectedResult());
        updates.setTags(request.getTags());
        updates.setCategory(request.getCategory());
        updates.setPriority(request.getPriority());
        updates.setSeverity(request.getSeverity());
        updates.setPersona(request.getPersona());
        
        TestCase testCase = testCaseService.updateTestCase(id, updates);
        return ResponseEntity.ok(testCase);
    }
    
    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> deleteTestCase(@PathVariable String id) {
        testCaseService.deleteTestCase(id);
        return ResponseEntity.ok(Map.of("message", "Test case deleted successfully"));
    }
}
