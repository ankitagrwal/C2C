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
  industry = 'General'
}: ReviewSubmitStepProps) {
  const [selectedTestCases, setSelectedTestCases] = useState<Set<string>>(new Set(testCases.map(tc => tc.id)));
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilters, setCategoryFilters] = useState<Set<string>>(new Set());
  const [priorityFilters, setPriorityFilters] = useState<Set<string>>(new Set());
  const [sourceFilters, setSourceFilters] = useState<Set<string>>(new Set());
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();

  // Initialize form with customer data
  const form = useForm<CustomerFormData>({
    resolver: zodResolver(CustomerFormSchema),
    defaultValues: {
      name: initialCustomer?.name || '',
      industry: initialCustomer?.industry || industry,
      solutionId: initialCustomer?.solutionId || '',
      contactName: '',
      contactEmail: '',
      contactPhone: '',
      companySize: 'medium',
      requirements: '',
      notes: ''
    }
  });

  // Filter and search test cases
  const filteredTestCases = useMemo(() => {
    let filtered = testCases;

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
  }, [testCases, searchTerm, categoryFilters, priorityFilters, sourceFilters]);

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

  // Submit workflow mutation
  const submitMutation = useMutation({
    mutationFn: async (data: CustomerFormData) => {
      const selectedTestCaseIds = Array.from(selectedTestCases);
      
      if (selectedTestCaseIds.length === 0) {
        throw new Error('Please select at least one test case to submit');
      }

      const submitData: SubmitData = {
        customerId: '', // Will be created by backend
        documentIds,
        testCaseIds: selectedTestCaseIds,
        requirements: data.requirements,
        notes: data.notes
      };

      const response = await fetch('/api/documents/submit-workflow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        body: JSON.stringify({
          customer: data,
          submission: submitData
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || response.statusText);
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Submission Successful',
        description: `Test case workflow submitted successfully. Customer ID: ${data.customerId}`,
      });
      onComplete();
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
    submitMutation.mutate(data);
  };

  // Statistics
  const selectedCount = selectedTestCases.size;
  const aiGeneratedCount = testCases.filter(tc => tc.source === 'generated').length;
  const manualCount = testCases.filter(tc => tc.source === 'manual' || tc.source === 'uploaded').length;

  const categoryStats = TEST_CASE_CATEGORIES.map(category => ({
    category,
    count: testCases.filter(tc => (tc.category || 'Manual') === category).length,
    selected: Array.from(selectedTestCases).filter(id => {
      const testCase = testCases.find(tc => tc.id === id);
      return testCase && (testCase.category || 'Manual') === category;
    }).length
  })).filter(stat => stat.count > 0);

  return (
    <div className="space-y-6">
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={toggleSelectAll}
                    data-testid="checkbox-select-all"
                    className={isSomeSelected && !isAllSelected ? "data-[state=checked]:bg-primary/50" : ""}
                  />
                </TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedTestCases.map((testCase) => (
                <TableRow key={testCase.id} data-testid={`table-row-${testCase.id}`}>
                  <TableCell>
                    <Checkbox
                      checked={selectedTestCases.has(testCase.id)}
                      onCheckedChange={() => toggleTestCase(testCase.id)}
                      data-testid={`checkbox-${testCase.id}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium max-w-xs">
                    <div className="truncate" title={testCase.title}>
                      {testCase.title}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {testCase.category || 'Manual'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        testCase.priority === 'high' ? 'destructive' :
                        testCase.priority === 'medium' ? 'secondary' :
                        'outline'
                      }
                      className="text-xs"
                    >
                      {(testCase.priority || 'medium').charAt(0).toUpperCase() + (testCase.priority || 'medium').slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={testCase.source === 'generated' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {testCase.source === 'generated' ? 'AI' : 
                       testCase.source === 'manual' ? 'Manual' : 'Uploaded'}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-md">
                    <div className="truncate text-sm text-muted-foreground" title={testCase.content}>
                      {testCase.content}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

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
                  name="solutionId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Solution ID *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., SOL-2024-001" data-testid="input-solution-id" />
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