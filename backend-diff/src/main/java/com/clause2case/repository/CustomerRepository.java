package com.clause2case.repository;

import com.clause2case.model.Customer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CustomerRepository extends JpaRepository<Customer, String> {
    
    Optional<Customer> findBySolutionId(String solutionId);
    
    boolean existsBySolutionId(String solutionId);
    
    List<Customer> findByInternalToolId(String internalToolId);
    
    List<Customer> findByStatus(String status);
    
    List<Customer> findByIndustry(String industry);
}
