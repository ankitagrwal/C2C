package com.clause2case.service;

import com.clause2case.exception.DocumentNotFoundException;
import com.clause2case.exception.DocumentProcessingException;
import com.clause2case.model.Document;
import com.clause2case.repository.DocumentRepository;
import lombok.RequiredArgsConstructor;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.util.Base64;
import java.util.List;
import java.util.ArrayList;

@Service
@RequiredArgsConstructor
public class DocumentService {
    
    private final DocumentRepository documentRepository;
    
    @Transactional
    public Document uploadDocument(MultipartFile file, String customerId, String docType) {
        try {
            String filename = file.getOriginalFilename();
            byte[] fileData = file.getBytes();
            String base64Data = Base64.getEncoder().encodeToString(fileData);
            
            // Extract text content based on file type
            String content = extractTextFromFile(file);
            
            Document document = new Document();
            document.setCustomerId(customerId);
            document.setFilename(filename);
            document.setContent(content);
            document.setFileData(base64Data);
            document.setDocType(docType);
            document.setStatus("uploaded");
            document.setFileSize((int) file.getSize());
            
            return documentRepository.save(document);
            
        } catch (Exception e) {
            throw new DocumentProcessingException("Failed to upload document: " + e.getMessage(), e);
        }
    }
    
    private String extractTextFromFile(MultipartFile file) {
        try {
            String filename = file.getOriginalFilename();
            if (filename == null) {
                throw new DocumentProcessingException("Filename is null");
            }
            
            String extension = filename.substring(filename.lastIndexOf(".") + 1).toLowerCase();
            
            switch (extension) {
                case "pdf":
                    return extractTextFromPDF(file.getInputStream());
                case "doc":
                case "docx":
                    return extractTextFromWord(file.getInputStream());
                case "txt":
                    return new String(file.getBytes());
                default:
                    throw new DocumentProcessingException("Unsupported file type: " + extension);
            }
        } catch (Exception e) {
            throw new DocumentProcessingException("Failed to extract text: " + e.getMessage(), e);
        }
    }
    
    private String extractTextFromPDF(InputStream inputStream) {
        try (PDDocument document = PDDocument.load(inputStream)) {
            PDFTextStripper stripper = new PDFTextStripper();
            return stripper.getText(document);
        } catch (Exception e) {
            throw new DocumentProcessingException("Failed to extract text from PDF", e);
        }
    }
    
    private String extractTextFromWord(InputStream inputStream) {
        try (XWPFDocument document = new XWPFDocument(inputStream);
             XWPFWordExtractor extractor = new XWPFWordExtractor(document)) {
            return extractor.getText();
        } catch (Exception e) {
            throw new DocumentProcessingException("Failed to extract text from Word document", e);
        }
    }
    
    /**
     * Chunk document content for RAG processing
     * @param content The document content to chunk
     * @param chunkSize Size of each chunk in characters
     * @param overlap Overlap between chunks
     * @return List of text chunks
     */
    public List<String> chunkDocument(String content, int chunkSize, int overlap) {
        List<String> chunks = new ArrayList<>();
        
        if (content == null || content.isEmpty()) {
            return chunks;
        }
        
        int start = 0;
        while (start < content.length()) {
            int end = Math.min(start + chunkSize, content.length());
            String chunk = content.substring(start, end);
            chunks.add(chunk);
            start += (chunkSize - overlap);
        }
        
        return chunks;
    }
    
    public List<Document> getAllDocuments() {
        return documentRepository.findAllOrderByCreatedAtDesc();
    }
    
    public Document getDocumentById(String id) {
        return documentRepository.findById(id)
            .orElseThrow(() -> new DocumentNotFoundException("Document not found with id: " + id));
    }
    
    public List<Document> getDocumentsByCustomerId(String customerId) {
        return documentRepository.findByCustomerId(customerId);
    }
    
    @Transactional
    public void deleteDocument(String id) {
        if (!documentRepository.existsById(id)) {
            throw new DocumentNotFoundException("Document not found with id: " + id);
        }
        documentRepository.deleteById(id);
    }
    
    @Transactional
    public Document updateDocumentStatus(String id, String status) {
        Document document = getDocumentById(id);
        document.setStatus(status);
        return documentRepository.save(document);
    }
}
