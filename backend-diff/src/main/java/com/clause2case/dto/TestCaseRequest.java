package com.clause2case.dto;

import lombok.Data;
import java.util.List;

@Data
public class TestCaseRequest {
    private String title;
    private String content;
    private List<String> steps;
    private String expectedResult;
    private List<String> tags;
    private String category;
    private String priority;
    private String severity;
    private String persona;
}
