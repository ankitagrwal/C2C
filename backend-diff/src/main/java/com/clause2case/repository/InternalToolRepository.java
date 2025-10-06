package com.clause2case.repository;

import com.clause2case.model.InternalTool;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface InternalToolRepository extends JpaRepository<InternalTool, String> {
    
    List<InternalTool> findByIsActiveTrue();
    
    Optional<InternalTool> findByName(String name);
    
    List<InternalTool> findByToolType(String toolType);
}
