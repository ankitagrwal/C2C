package com.clause2case.repository;

import com.clause2case.model.DocumentEmbedding;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DocumentEmbeddingRepository extends JpaRepository<DocumentEmbedding, String> {
    
    List<DocumentEmbedding> findByDocumentId(String documentId);
    
    @Query("SELECT de FROM DocumentEmbedding de WHERE de.documentId = :documentId ORDER BY de.chunkIndex")
    List<DocumentEmbedding> findByDocumentIdOrderByChunkIndex(String documentId);
    
    /**
     * Find similar embeddings using pgvector cosine distance operator (<=>)
     * Returns the top N most similar chunks to the query embedding
     * 
     * @param queryEmbedding The embedding vector as a string representation
     * @param limit Maximum number of results to return
     * @return List of similar document embeddings ordered by similarity
     */
    @Query(value = "SELECT * FROM document_embeddings " +
                   "ORDER BY embedding <=> CAST(:queryEmbedding AS vector) " +
                   "LIMIT :limit", 
           nativeQuery = true)
    List<DocumentEmbedding> findSimilarEmbeddings(
        @Param("queryEmbedding") String queryEmbedding,
        @Param("limit") int limit
    );
    
    /**
     * Find similar embeddings within a specific document
     * 
     * @param documentId The document ID to search within
     * @param queryEmbedding The embedding vector as a string representation
     * @param limit Maximum number of results to return
     * @return List of similar document embeddings from the specified document
     */
    @Query(value = "SELECT * FROM document_embeddings " +
                   "WHERE document_id = :documentId " +
                   "ORDER BY embedding <=> CAST(:queryEmbedding AS vector) " +
                   "LIMIT :limit", 
           nativeQuery = true)
    List<DocumentEmbedding> findSimilarEmbeddingsByDocument(
        @Param("documentId") String documentId,
        @Param("queryEmbedding") String queryEmbedding,
        @Param("limit") int limit
    );
    
    @Query("SELECT COUNT(de) FROM DocumentEmbedding de WHERE de.documentId = :documentId")
    long countByDocumentId(String documentId);
    
    void deleteByDocumentId(String documentId);
}
