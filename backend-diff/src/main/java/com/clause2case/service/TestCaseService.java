package com.clause2case.service;

import com.clause2case.exception.DocumentNotFoundException;
import com.clause2case.model.TestCase;
import com.clause2case.repository.TestCaseRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class TestCaseService {
    
    private final TestCaseRepository testCaseRepository;
    
    @Transactional
    public TestCase createTestCase(TestCase testCase) {
        return testCaseRepository.save(testCase);
    }
    
    @Transactional
    public List<TestCase> createTestCases(List<TestCase> testCases) {
        return testCaseRepository.saveAll(testCases);
    }
    
    public List<TestCase> getTestCasesByDocumentId(String documentId) {
        return testCaseRepository.findByDocumentIdOrderByCreatedAtDesc(documentId);
    }
    
    public List<TestCase> getTestCasesByCustomerId(String customerId) {
        return testCaseRepository.findByCustomerIdOrderByCreatedAtDesc(customerId);
    }
    
    public TestCase getTestCaseById(String id) {
        return testCaseRepository.findById(id)
            .orElseThrow(() -> new DocumentNotFoundException("Test case not found with id: " + id));
    }
    
    @Transactional
    public TestCase updateTestCase(String id, TestCase updates) {
        TestCase testCase = getTestCaseById(id);
        
        if (updates.getTitle() != null) {
            testCase.setTitle(updates.getTitle());
        }
        if (updates.getContent() != null) {
            testCase.setContent(updates.getContent());
        }
        if (updates.getSteps() != null) {
            testCase.setSteps(updates.getSteps());
        }
        if (updates.getExpectedResult() != null) {
            testCase.setExpectedResult(updates.getExpectedResult());
        }
        if (updates.getTags() != null) {
            testCase.setTags(updates.getTags());
        }
        if (updates.getCategory() != null) {
            testCase.setCategory(updates.getCategory());
        }
        if (updates.getPriority() != null) {
            testCase.setPriority(updates.getPriority());
        }
        if (updates.getSeverity() != null) {
            testCase.setSeverity(updates.getSeverity());
        }
        if (updates.getPersona() != null) {
            testCase.setPersona(updates.getPersona());
        }
        
        return testCaseRepository.save(testCase);
    }
    
    @Transactional
    public void deleteTestCase(String id) {
        if (!testCaseRepository.existsById(id)) {
            throw new DocumentNotFoundException("Test case not found with id: " + id);
        }
        testCaseRepository.deleteById(id);
    }
    
    public long countTestCasesByDocument(String documentId) {
        return testCaseRepository.countByDocumentId(documentId);
    }
}
