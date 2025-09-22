import { useState, useEffect, useMemo } from 'react';
import { CheckCircle, AlertCircle, Search, Filter, User, Building2, FileText, Clock, CheckSquare, Square, ChevronDown, Send } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import type { TestCase, Customer } from '@shared/schema';

// Customer form validation schema
const CustomerFormSchema = z.object({
  name: z.string().min(2, 'Company name must be at least 2 characters'),
  industry: z.string().min(1, 'Industry is required'),
  solutionId: z.string().min(1, 'Solution ID is required for tracking'),
  // Additional form fields for customer contact info (not stored in Customer table)
  contactName: z.string().min(2, 'Contact name must be at least 2 characters'),
  contactEmail: z.string().email('Invalid email address'),
  contactPhone: z.string().optional(),
  companySize: z.enum(['small', 'medium', 'large', 'enterprise'], {
    required_error: 'Company size is required'
  }),
  requirements: z.string().optional(),
  notes: z.string().optional()
});

type CustomerFormData = z.infer<typeof CustomerFormSchema>;

interface ReviewSubmitStepProps {
  testCases: TestCase[];
  onComplete: () => void;
  initialCustomer?: Partial<Customer>;
  documentIds?: string[];
  industry?: string;
  aiGeneratedCount?: number;  // Count from step 2 (AI processing)
  manualCount?: number;       // Count from step 3 (manual CSV upload)
}

interface SubmitData {
  customerId: string;
  documentIds: string[];
  testCaseIds: string[];
  requirements?: string;
  notes?: string;
}

const ITEMS_PER_PAGE_OPTIONS = [50, 100, 200];

const TEST_CASE_CATEGORIES = [
  'Functional',
  'Compliance', 
  'Integration',
  'Performance',
  'Security',
  'Edge Case',
  'User Experience',
  'Manual'
];

const PRIORITY_LEVELS = ['low', 'medium', 'high'];

export default function ReviewSubmitStep({ 
  testCases, 
  onComplete, 
  initialCustomer, 
  documentIds = [],
  industry = 'General',
  aiGeneratedCount = 0,
  manualCount = 0
}: ReviewSubmitStepProps) {
  const [selectedTestCases, setSelectedTestCases] = useState<Set<string>>(new Set(testCases.map(tc => tc.id)));
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilters, setCategoryFilters] = useState<Set<string>>(new Set());
  const [priorityFilters, setPriorityFilters] = useState<Set<string>>(new Set());
  const [sourceFilters, setSourceFilters] = useState<Set<string>>(new Set());
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  // Removed solutionId availability checking - IDs are created externally
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Initialize form with customer data
  const form = useForm<CustomerFormData>({
    resolver: zodResolver(CustomerFormSchema),
    defaultValues: {
      name: initialCustomer?.name || '',
      industry: initialCustomer?.industry || industry,
      solutionId: initialCustomer?.solutionId || `SOL-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      contactName: '',
      contactEmail: '',
      contactPhone: '',
      companySize: 'medium',
      requirements: '',
      notes: ''
    }
  });

  // Common section headers pattern for robust parsing with flexible punctuation
  const sectionHeaderRegex = /^(steps?|test steps|test details|procedures?|preconditions?|expected results?|expected result|expected outcome|expected behavio[u]?r|results?|acceptance criteria|notes?|description)[\s:.-]*$/i;
  
  // Memoized parsing for performance
  const parsedTestCases = useMemo(() => {
    return testCases.map(testCase => {
      // For parsing content field (backwards compatibility)
      const lines = testCase.content.split('\n');
      
      // First check if we have the new steps array format
      let steps = '';
      if (testCase.steps && Array.isArray(testCase.steps) && testCase.steps.length > 0) {
        // Format steps array as numbered list
        steps = testCase.steps
          .map((step, index) => `${index + 1}. ${step}`)
          .join('\n');
      } else {
        // Fall back to parsing content field for backwards compatibility
        // Extract steps from content
        let stepsStart = -1;
        let stepsEnd = -1;
        
        // Find the "Steps:" section with flexible matching
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (/^(steps?|test steps|test details|procedures?)[\s:.-]*$/i.test(line)) {
            stepsStart = i + 1;
            break;
          }
        }
        
        if (stepsStart !== -1) {
          // Find the end of steps (next section header, not blank lines)
          for (let i = stepsStart; i < lines.length; i++) {
            const line = lines[i].trim();
            if (sectionHeaderRegex.test(line) && !/^(steps?|test steps|test details|procedures?)[\s:.-]*$/i.test(line)) {
              stepsEnd = i;
              break;
            }
          }
          
          if (stepsEnd === -1) stepsEnd = lines.length;
          
          // Skip leading blank lines after steps header
          let actualStart = stepsStart;
          while (actualStart < stepsEnd && !lines[actualStart].trim()) {
            actualStart++;
          }
          
          steps = lines.slice(actualStart, stepsEnd)
            .join('\n')
            .trim();
        }
      }
      
      // Extract description
      let description = '';
      if (testCase.title) {
        // Use title if available (new format)
        description = testCase.title;
      } else {
        // Fall back to parsing content for description (backwards compatibility)
        let descStart = -1;
        let descEnd = -1;
        
        // Find the "Description:" section (can be on same line or separate line)
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (/^description[\s:.-]/i.test(line)) {
            descStart = i;
            break;
          }
        }
        
        if (descStart !== -1) {
          // Find the end of description (next section)
          for (let i = descStart + 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (sectionHeaderRegex.test(line)) {
              descEnd = i;
              break;
            }
          }
          
          if (descEnd === -1) descEnd = lines.length;
          
          // Get description content (remove "Description:" label)
          const descLines = lines.slice(descStart, descEnd);
          if (descLines.length > 0) {
            descLines[0] = descLines[0].replace(/^description[\s:.-]*\s*/i, '');
          }
          
          description = descLines
            .filter(line => line.trim())
            .join(' ')
            .trim();
        } else {
          // If no description section, use the title (first line)
          description = lines[0] || '';
        }
      }
      
      return {
        ...testCase,
        parsedDescription: description,
        parsedSteps: steps || 'No steps defined'
      };
    });
  }, [testCases]);

  // Filter and search test cases (using parsed data)
  const filteredTestCases = useMemo(() => {
    let filtered = parsedTestCases;

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(tc => 
        tc.title.toLowerCase().includes(searchLower) ||
        tc.content.toLowerCase().includes(searchLower) ||
        tc.contextUsed?.toLowerCase().includes(searchLower)
      );
    }

    // Category filter
    if (categoryFilters.size > 0) {
      filtered = filtered.filter(tc => categoryFilters.has(tc.category || 'Manual'));
    }

    // Priority filter
    if (priorityFilters.size > 0) {
      filtered = filtered.filter(tc => priorityFilters.has(tc.priority || 'medium'));
    }

    // Source filter
    if (sourceFilters.size > 0) {
      filtered = filtered.filter(tc => sourceFilters.has(tc.source || 'generated'));
    }

    return filtered;
  }, [parsedTestCases, searchTerm, categoryFilters, priorityFilters, sourceFilters]);

  // Pagination
  const totalPages = Math.ceil(filteredTestCases.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTestCases = filteredTestCases.slice(startIndex, startIndex + itemsPerPage);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilters, priorityFilters, sourceFilters, itemsPerPage]);

  // Select all toggle
  const isAllSelected = paginatedTestCases.length > 0 && paginatedTestCases.every(tc => selectedTestCases.has(tc.id));
  const isSomeSelected = paginatedTestCases.some(tc => selectedTestCases.has(tc.id));

  const toggleSelectAll = () => {
    const newSelected = new Set(selectedTestCases);
    if (isAllSelected) {
      // Deselect all on current page
      paginatedTestCases.forEach(tc => newSelected.delete(tc.id));
    } else {
      // Select all on current page
      paginatedTestCases.forEach(tc => newSelected.add(tc.id));
    }
    setSelectedTestCases(newSelected);
  };

  const toggleTestCase = (testCaseId: string) => {
    const newSelected = new Set(selectedTestCases);
    if (newSelected.has(testCaseId)) {
      newSelected.delete(testCaseId);
    } else {
      newSelected.add(testCaseId);
    }
    setSelectedTestCases(newSelected);
  };

  // Removed customer lookup by solution ID - no checking needed

  // Removed solutionId debounced validation - no checking needed

  // Submit workflow mutation
  const submitMutation = useMutation({
    mutationFn: async (data: CustomerFormData) => {
      const selectedTestCaseIds = Array.from(selectedTestCases);
      
      if (selectedTestCaseIds.length === 0) {
        throw new Error('Please select at least one test case to submit');
      }

      if (documentIds.length === 0) {
        throw new Error('No document ID available for submission');
      }

      // Always create customer with provided data - no existing customer checking
      const customerPayload = {
        name: data.name,
        industry: data.industry,
        solutionId: data.solutionId || `SOL-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`
      };

      const response = await fetch('/api/test-cases/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        body: JSON.stringify({
          documentId: documentIds[0], // Use first document ID
          customer: customerPayload,
          selectedTestCaseIds
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = errorText || response.statusText;
        
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If not valid JSON, use text as is
        }
        
        throw new Error(errorMessage);
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Submission Successful',
        description: `Test case workflow submitted successfully. Customer ID: ${data.customerId}`,
      });
      
      // Navigate to reports page with submission data
      const reportParams = new URLSearchParams({
        customerId: data.customerId,
        documentId: data.documentId,
        testCasesCount: data.testCasesCount.toString()
      });
      setLocation(`/reports?${reportParams.toString()}`);
    },
    onError: (error: any) => {
      toast({
        title: 'Submission Failed',
        description: error?.message || 'Failed to submit workflow',
        variant: 'destructive',
      });
    }
  });

  const onSubmit = (data: CustomerFormData) => {
    // No validation needed for solutionId - always allow submission
    submitMutation.mutate(data);
  };

  // Statistics
  const selectedCount = selectedTestCases.size;
  // Note: aiGeneratedCount and manualCount now come from props (wizard state)

  const categoryStats = TEST_CASE_CATEGORIES.map(category => ({
    category,
    count: testCases.filter(tc => (tc.category || 'Manual') === category).length,
    selected: Array.from(selectedTestCases).filter(id => {
      const testCase = testCases.find(tc => tc.id === id);
      return testCase && (testCase.category || 'Manual') === category;
    }).length
  })).filter(stat => stat.count > 0);

  return (
    <div className="space-y-6" data-testid="review-submit-step">
      {/* Summary Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-chart-1" />
            <span>Test Case Summary</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 border rounded-lg">
              <div className="text-2xl font-bold text-chart-1">{testCases.length}</div>
              <div className="text-sm text-muted-foreground">Total Cases</div>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <div className="text-2xl font-bold text-chart-2">{aiGeneratedCount}</div>
              <div className="text-sm text-muted-foreground">AI Generated</div>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <div className="text-2xl font-bold text-chart-3">{manualCount}</div>
              <div className="text-sm text-muted-foreground">Manual Added</div>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <div className="text-2xl font-bold text-primary">{selectedCount}</div>
              <div className="text-sm text-muted-foreground">Selected</div>
            </div>
          </div>

          <div className="mt-4">
            <h4 className="font-medium mb-2">Category Distribution</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {categoryStats.map(({ category, count, selected }) => (
                <div key={category} className="flex justify-between text-sm">
                  <span>{category}:</span>
                  <span className="font-medium">{selected}/{count}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="w-5 h-5 text-chart-2" />
            <span>Filter Test Cases</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search test cases by title, content, or context..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-test-cases"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap gap-2">
            {/* Category Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" data-testid="button-filter-category">
                  Category 
                  {categoryFilters.size > 0 && (
                    <Badge variant="secondary" className="ml-2">{categoryFilters.size}</Badge>
                  )}
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                <DropdownMenuLabel>Filter by Category</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {TEST_CASE_CATEGORIES.map(category => (
                  <DropdownMenuCheckboxItem
                    key={category}
                    checked={categoryFilters.has(category)}
                    onCheckedChange={(checked) => {
                      const newFilters = new Set(categoryFilters);
                      if (checked) {
                        newFilters.add(category);
                      } else {
                        newFilters.delete(category);
                      }
                      setCategoryFilters(newFilters);
                    }}
                  >
                    {category}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Priority Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" data-testid="button-filter-priority">
                  Priority
                  {priorityFilters.size > 0 && (
                    <Badge variant="secondary" className="ml-2">{priorityFilters.size}</Badge>
                  )}
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Filter by Priority</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {PRIORITY_LEVELS.map(priority => (
                  <DropdownMenuCheckboxItem
                    key={priority}
                    checked={priorityFilters.has(priority)}
                    onCheckedChange={(checked) => {
                      const newFilters = new Set(priorityFilters);
                      if (checked) {
                        newFilters.add(priority);
                      } else {
                        newFilters.delete(priority);
                      }
                      setPriorityFilters(newFilters);
                    }}
                  >
                    {priority.charAt(0).toUpperCase() + priority.slice(1)}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Source Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" data-testid="button-filter-source">
                  Source
                  {sourceFilters.size > 0 && (
                    <Badge variant="secondary" className="ml-2">{sourceFilters.size}</Badge>
                  )}
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Filter by Source</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={sourceFilters.has('generated')}
                  onCheckedChange={(checked) => {
                    const newFilters = new Set(sourceFilters);
                    if (checked) {
                      newFilters.add('generated');
                    } else {
                      newFilters.delete('generated');
                    }
                    setSourceFilters(newFilters);
                  }}
                >
                  AI Generated
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={sourceFilters.has('manual')}
                  onCheckedChange={(checked) => {
                    const newFilters = new Set(sourceFilters);
                    if (checked) {
                      newFilters.add('manual');
                    } else {
                      newFilters.delete('manual');
                    }
                    setSourceFilters(newFilters);
                  }}
                >
                  Manual Added
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={sourceFilters.has('uploaded')}
                  onCheckedChange={(checked) => {
                    const newFilters = new Set(sourceFilters);
                    if (checked) {
                      newFilters.add('uploaded');
                    } else {
                      newFilters.delete('uploaded');
                    }
                    setSourceFilters(newFilters);
                  }}
                >
                  Uploaded
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Clear Filters */}
            {(categoryFilters.size > 0 || priorityFilters.size > 0 || sourceFilters.size > 0 || searchTerm) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchTerm('');
                  setCategoryFilters(new Set());
                  setPriorityFilters(new Set());
                  setSourceFilters(new Set());
                }}
                data-testid="button-clear-filters"
              >
                Clear All
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Test Cases Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              Test Cases ({filteredTestCases.length} total, {selectedCount} selected)
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Label htmlFor="items-per-page" className="text-sm">Show:</Label>
              <Select
                value={itemsPerPage.toString()}
                onValueChange={(value) => setItemsPerPage(parseInt(value))}
              >
                <SelectTrigger className="w-20" data-testid="select-items-per-page">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ITEMS_PER_PAGE_OPTIONS.map(count => (
                    <SelectItem key={count} value={count.toString()}>
                      {count}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="w-full overflow-x-auto">
          <Table data-testid="review-submit-table" className="w-full min-w-[1200px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={toggleSelectAll}
                    data-testid="checkbox-select-all"
                    className={isSomeSelected && !isAllSelected ? "data-[state=checked]:bg-primary/50" : ""}
                  />
                </TableHead>
                <TableHead className="min-w-[200px] max-w-[250px]">Title</TableHead>
                <TableHead className="w-[120px] text-center">Category</TableHead>
                <TableHead className="w-[100px] text-center">Priority</TableHead>
                <TableHead className="w-[100px] text-center">Source</TableHead>
                <TableHead className="min-w-[200px] max-w-[300px]">Description</TableHead>
                <TableHead className="min-w-[200px] max-w-[300px]">Test Steps</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedTestCases.length === 0 ? (
                <TableRow data-testid="table-row-empty">
                  <TableCell colSpan={7} className="h-32 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2 text-muted-foreground">
                      <FileText className="h-8 w-8" />
                      <p className="text-sm font-medium">No test cases available</p>
                      <p className="text-xs">Upload documents and generate AI test cases or add manual test cases to get started.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedTestCases.map((testCase) => (
                <TableRow key={testCase.id} data-testid={`table-row-${testCase.id}`}>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={selectedTestCases.has(testCase.id)}
                      onCheckedChange={() => toggleTestCase(testCase.id)}
                      data-testid={`checkbox-${testCase.id}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium min-w-[200px] max-w-[250px]">
                    <div className="break-words hyphens-auto" title={testCase.title}>
                      {testCase.title}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="text-xs whitespace-nowrap">
                      {testCase.category || 'Manual'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant={
                        testCase.priority === 'high' ? 'destructive' :
                        testCase.priority === 'medium' ? 'secondary' :
                        'outline'
                      }
                      className="text-xs whitespace-nowrap"
                    >
                      {(testCase.priority || 'medium').charAt(0).toUpperCase() + (testCase.priority || 'medium').slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge 
                      variant={testCase.source === 'generated' ? 'default' : 'secondary'}
                      className="text-xs whitespace-nowrap"
                    >
                      {testCase.source === 'generated' ? 'AI' : 
                       testCase.source === 'manual' ? 'Manual' : 'Uploaded'}
                    </Badge>
                  </TableCell>
                  <TableCell className="min-w-[200px] max-w-[300px] align-top" data-testid={`text-description-${testCase.id}`}>
                    <div className="text-sm text-muted-foreground break-words hyphens-auto leading-relaxed" title={testCase.parsedDescription}>
                      {testCase.parsedDescription}
                    </div>
                  </TableCell>
                  <TableCell className="min-w-[200px] max-w-[300px] align-top" data-testid={`text-steps-${testCase.id}`}>
                    <div className="text-sm text-muted-foreground break-words hyphens-auto leading-relaxed whitespace-pre-wrap" title={testCase.parsedSteps}>
                      {testCase.parsedSteps}
                    </div>
                  </TableCell>
                </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredTestCases.length)} of {filteredTestCases.length} test cases
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  data-testid="button-prev-page"
                >
                  Previous
                </Button>
                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const page = i + 1;
                    return (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        data-testid={`button-page-${page}`}
                      >
                        {page}
                      </Button>
                    );
                  })}
                  {totalPages > 5 && (
                    <>
                      {currentPage < totalPages - 2 && <span className="text-sm text-muted-foreground">...</span>}
                      <Button
                        variant={currentPage === totalPages ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(totalPages)}
                        data-testid={`button-page-${totalPages}`}
                      >
                        {totalPages}
                      </Button>
                    </>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  data-testid="button-next-page"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Customer Information Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Building2 className="w-5 h-5 text-chart-4" />
            <span>Customer Information</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="solutionId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Solution ID *</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="e.g., SOL-2024-001" 
                          data-testid="input-solution-id"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Name *</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-company-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="industry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Industry *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-industry">
                            <SelectValue placeholder="Select industry" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="General">General Business</SelectItem>
                          <SelectItem value="Finance">Financial Services</SelectItem>
                          <SelectItem value="Healthcare">Healthcare</SelectItem>
                          <SelectItem value="Ecommerce">E-commerce</SelectItem>
                          <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                          <SelectItem value="Technology">Technology</SelectItem>
                          <SelectItem value="Education">Education</SelectItem>
                          <SelectItem value="Government">Government</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="companySize"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Size *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-company-size">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="small">Small (1-50 employees)</SelectItem>
                          <SelectItem value="medium">Medium (51-200 employees)</SelectItem>
                          <SelectItem value="large">Large (201-1000 employees)</SelectItem>
                          <SelectItem value="enterprise">Enterprise (1000+ employees)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contactName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Name *</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-contact-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contactEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Email *</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" data-testid="input-contact-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contactPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Phone</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-contact-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>


              <FormField
                control={form.control}
                name="requirements"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Requirements</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="Specific requirements for this test case project..."
                        className="h-24"
                        data-testid="textarea-project-requirements"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Additional Notes</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="Any additional notes or special instructions..."
                        className="h-20"
                        data-testid="textarea-additional-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Validation Alerts */}
              {selectedCount === 0 && (
                <Alert className="border-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Please select at least one test case to submit the workflow.
                  </AlertDescription>
                </Alert>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={submitMutation.isPending || selectedCount === 0}
                data-testid="button-submit-workflow"
              >
                {submitMutation.isPending ? (
                  <>
                    <Clock className="w-4 h-4 mr-2 animate-spin" />
                    Submitting Workflow...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Submit Test Case Workflow ({selectedCount} test cases)
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}