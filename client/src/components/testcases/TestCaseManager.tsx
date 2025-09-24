import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  TestTube2, 
  FileText, 
  CheckCircle, 
  Clock, 
  PlayCircle,
  Edit,
  Trash2,
  Filter,
  Search,
  Plus,
  Eye
} from "lucide-react";

// Mock test cases data //todo: remove mock functionality
type TestCase = {
  id: string;
  title?: string;
  content: string;
  steps?: string[];
  expectedResult?: string;
  category: string;
  priority: string;
  severity: string;
  persona: string;
  source: string;
  confidenceScore: number | null;
  contextUsed: string | null;
  executionStatus: string;
  documentName: string;
  customerName: string;
  createdAt: string;
};


const categories = ['All Categories', 'Functional Tests', 'Compliance Tests', 'Edge Cases', 'Integration Tests'];
const statuses = ['All Statuses', 'ready', 'in_progress', 'complete'];
const sources = ['All Sources', 'generated', 'manual', 'uploaded'];

interface TestCaseDetailDialogProps {
  testCase: TestCase;
  onSave: (id: string, updates: any) => void;
}

function TestCaseDetailDialog({ testCase, onSave }: TestCaseDetailDialogProps) {
  const [content, setContent] = useState(testCase.content);
  const [category, setCategory] = useState(testCase.category);
  const [executionStatus, setExecutionStatus] = useState(testCase.executionStatus);

  const handleSave = () => {
    console.log('Saving test case:', testCase.id, { content, category, executionStatus });
    onSave(testCase.id, { content, category, executionStatus });
  };

  return (
    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Test Case Details</DialogTitle>
        <DialogDescription>
          Review and edit test case from {testCase.documentName}
        </DialogDescription>
      </DialogHeader>
      
      <div className="space-y-4">
        {testCase.title && (
          <div>
            <Label htmlFor="title">Test Case Title</Label>
            <div className="p-3 bg-muted/50 rounded-md text-sm font-medium" data-testid="text-title">
              {testCase.title}
            </div>
          </div>
        )}

        {testCase.steps && testCase.steps.length > 0 && (
          <div>
            <Label>Test Steps ({testCase.steps.length} steps)</Label>
            <div className="bg-muted/50 p-4 rounded-md space-y-2" data-testid="steps-container">
              <ol className="list-decimal list-inside space-y-2">
                {testCase.steps.map((step, index) => (
                  <li key={index} className="text-sm leading-relaxed" data-testid={`step-${index + 1}`}>
                    <span className="ml-2">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}

        {testCase.expectedResult && (
          <div>
            <Label>Expected Result</Label>
            <div className="bg-muted/50 p-3 rounded-md text-sm" data-testid="text-expected-result">
              {testCase.expectedResult}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>Priority</Label>
            <div className="p-2 bg-muted/50 rounded-md text-sm" data-testid="text-priority">
              <Badge 
                variant="outline"
                className="capitalize no-default-hover-elevate"
                style={{
                  backgroundColor: testCase.priority === 'high' 
                    ? '#dc2626' 
                    : testCase.priority === 'low'
                      ? '#6b7280'
                      : '#2563eb',
                  color: '#ffffff',
                  borderColor: testCase.priority === 'high' 
                    ? '#dc2626' 
                    : testCase.priority === 'low'
                      ? '#6b7280'
                      : '#2563eb'
                }}
              >
                {testCase.priority || 'medium'}
              </Badge>
            </div>
          </div>
          <div>
            <Label>Severity</Label>
            <div className="p-2 bg-muted/50 rounded-md text-sm" data-testid="text-severity">
              <Badge 
                variant="outline"
                className="capitalize no-default-hover-elevate"
                style={{
                  backgroundColor: testCase.severity?.toLowerCase() === 'high' 
                    ? '#dc2626' 
                    : testCase.severity?.toLowerCase() === 'low'
                      ? '#6b7280'
                      : '#2563eb',
                  color: '#ffffff',
                  borderColor: testCase.severity?.toLowerCase() === 'high' 
                    ? '#dc2626' 
                    : testCase.severity?.toLowerCase() === 'low'
                      ? '#6b7280'
                      : '#2563eb'
                }}
              >
                {testCase.severity || 'Medium'}
              </Badge>
            </div>
          </div>
          <div>
            <Label>Persona</Label>
            <div className="p-2 bg-muted/50 rounded-md text-sm" data-testid="text-persona">
              <Badge variant="outline" className="text-xs">
                {testCase.persona || 'Other'}
              </Badge>
            </div>
          </div>
        </div>

        <div>
          <Label htmlFor="content">Additional Content</Label>
          <Textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[100px]"
            data-testid="textarea-content"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger data-testid="select-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Functional Tests">Functional Tests</SelectItem>
                <SelectItem value="Compliance Tests">Compliance Tests</SelectItem>
                <SelectItem value="Edge Cases">Edge Cases</SelectItem>
                <SelectItem value="Integration Tests">Integration Tests</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="status">Execution Status</Label>
            <Select value={executionStatus} onValueChange={setExecutionStatus}>
              <SelectTrigger data-testid="select-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ready">Ready</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="complete">Complete</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {testCase.contextUsed && (
          <div>
            <Label>RAG Context Used</Label>
            <div className="bg-muted/50 p-3 rounded-md text-sm">
              {testCase.contextUsed}
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Source:</span>
            <Badge variant="outline" className="ml-2 capitalize">{testCase.source}</Badge>
          </div>
          <div>
            <span className="text-muted-foreground">Customer:</span>
            <span className="ml-2 font-medium">{testCase.customerName}</span>
          </div>
          {testCase.confidenceScore && (
            <div>
              <span className="text-muted-foreground">AI Confidence:</span>
              <span className="ml-2 font-medium">{Math.round(testCase.confidenceScore * 100)}%</span>
            </div>
          )}
        </div>
        
        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={() => console.log('Duplicate test case')}>Duplicate</Button>
          <Button onClick={handleSave} data-testid="button-save-testcase">Save Changes</Button>
        </div>
      </div>
    </DialogContent>
  );
}

export default function TestCaseManager() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [selectedStatus, setSelectedStatus] = useState('All Statuses');
  const [selectedSource, setSelectedSource] = useState('All Sources');
  const [selectedCustomer, setSelectedCustomer] = useState('All Customers');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Fetch test cases from API
  const { data: testCases = [], isLoading, error, refetch } = useQuery({
    queryKey: ['/api/test-cases'],
    queryFn: () => fetch('/api/test-cases', { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch test cases');
        return res.json();
      }),
    retry: 3,
    retryDelay: 1000
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', '/api/test-cases/import', data);
    },
    onSuccess: () => {
      toast({
        title: "Import Successful",
        description: "Test cases have been successfully imported."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/test-cases'] });
    },
    onError: (error) => {
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Failed to import test cases",
        variant: "destructive"
      });
    }
  });

  // Update test case mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest('PUT', `/api/test-cases/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/test-cases'] });
      toast({ title: "Test case updated successfully" });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update test case",
        variant: "destructive"
      });
    }
  });

  // Delete test case mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/test-cases/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/test-cases'] });
      toast({ title: "Test case deleted successfully" });
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: error instanceof Error ? error.message : "Failed to delete test case",
        variant: "destructive"
      });
    }
  });

  const handleSaveTestCase = (id: string, updates: any) => {
    updateMutation.mutate({ id, data: updates });
  };

  const handleDeleteTestCase = (id: string) => {
    if (confirm('Are you sure you want to delete this test case?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleStatusChange = (id: string, newStatus: string) => {
    updateMutation.mutate({ id, data: { executionStatus: newStatus } });
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!data.testCases || !Array.isArray(data.testCases)) {
        throw new Error('Invalid file format. Expected JSON with testCases array.');
      }

      importMutation.mutate(data);
    } catch (error) {
      toast({
        title: "Import Failed", 
        description: error instanceof Error ? error.message : "Failed to read file",
        variant: "destructive"
      });
    }
    
    // Clear the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleExport = async (format: 'json' | 'csv' = 'json') => {
    try {
      const response = await fetch(`/api/test-cases/export?format=${format}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Export failed');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `test-cases-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Export Successful",
        description: `Test cases exported as ${format.toUpperCase()} file.`
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to export test cases",
        variant: "destructive"
      });
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold">Test Cases</h1>
          <p className="text-muted-foreground">Loading test cases...</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-muted rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Show error state  
  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold">Test Cases</h1>
          <p className="text-muted-foreground">Failed to load test cases</p>
        </div>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground mb-4">
              {error instanceof Error ? error.message : 'An unexpected error occurred'}
            </p>
            <Button onClick={() => refetch()} variant="outline">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get unique customers for filter dropdown
  const customers = Array.from(new Set(testCases.map((tc: any) => tc.customerName).filter(Boolean))).sort();
  const customerOptions = ['All Customers', ...customers];

  const filteredTestCases = testCases.filter((tc: TestCase) => {
    const matchesSearch = tc.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (tc.documentName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (tc.customerName || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All Categories' || tc.category === selectedCategory;
    const matchesStatus = selectedStatus === 'All Statuses' || tc.executionStatus === selectedStatus;
    const matchesSource = selectedSource === 'All Sources' || tc.source === selectedSource;
    const matchesCustomer = selectedCustomer === 'All Customers' || tc.customerName === selectedCustomer;
    
    return matchesSearch && matchesCategory && matchesStatus && matchesSource && matchesCustomer;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready':
        return <Clock className="h-4 w-4 text-blue-600" />;
      case 'in_progress':
        return <PlayCircle className="h-4 w-4 text-yellow-600" />;
      case 'complete':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: { [key: string]: any } = {
      'ready': 'secondary',
      'in_progress': 'default',
      'complete': 'default'
    };
    
    const colors: { [key: string]: string } = {
      'ready': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'in_progress': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      'complete': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    };
    
    return (
      <Badge variant={variants[status]} className={colors[status]}>
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  const categoryStats = categories.slice(1).map(cat => ({
    category: cat,
    count: testCases.filter((tc: TestCase) => tc.category === cat).length
  }));

  return (
    <div className="space-y-6" data-testid="test-case-manager">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Test Cases</h1>
          <p className="text-muted-foreground">Review and manage AI-generated test cases</p>
        </div>
        <div className="flex space-x-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json"
            style={{ display: 'none' }}
          />
          <Button 
            variant="outline" 
            data-testid="button-import"
            onClick={handleImport}
            disabled={importMutation.isPending}
          >
            <Plus className="mr-2 h-4 w-4" />
            {importMutation.isPending ? 'Importing...' : 'Import Tests'}
          </Button>
          <Button 
            data-testid="button-export"
            onClick={() => handleExport('json')}
          >
            Export Suite
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {categoryStats.map((stat) => (
          <Card key={stat.category}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.category}</CardTitle>
              <TestTube2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid={`stat-${stat.category.toLowerCase().replace(' ', '-')}`}>
                {stat.count}
              </div>
              <p className="text-xs text-muted-foreground">test cases</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Filter Test Cases</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search test cases..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search"
              />
            </div>
            
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger data-testid="select-filter-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger data-testid="select-filter-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((status) => (
                  <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={selectedSource} onValueChange={setSelectedSource}>
              <SelectTrigger data-testid="select-filter-source">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sources.map((source) => (
                  <SelectItem key={source} value={source}>{source}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
              <SelectTrigger data-testid="select-filter-customer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {customerOptions.map((customer) => (
                  <SelectItem key={String(customer)} value={String(customer)}>{String(customer)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center justify-between mt-4">
            <span className="text-sm text-muted-foreground">
              Showing {filteredTestCases.length} of {testCases.length} test cases
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('All Categories');
                setSelectedStatus('All Statuses');
                setSelectedSource('All Sources');
                setSelectedCustomer('All Customers');
              }}
              data-testid="button-clear-filters"
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Test Cases List */}
      <Card>
        <CardHeader>
          <CardTitle>Test Cases</CardTitle>
          <CardDescription>Generated and manual test cases from uploaded documents</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-80">Test Case</TableHead>
                  <TableHead className="min-w-28">Category</TableHead>
                  <TableHead className="min-w-20">Priority</TableHead>
                  <TableHead className="min-w-20">Severity</TableHead>
                  <TableHead className="min-w-24">Persona</TableHead>
                  <TableHead className="min-w-32">Test Steps</TableHead>
                  <TableHead className="min-w-32">Customer</TableHead>
                  <TableHead className="min-w-40">Document</TableHead>
                  <TableHead className="min-w-20">Status</TableHead>
                  <TableHead className="min-w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
            <TableBody>
              {filteredTestCases.map((testCase: TestCase) => (
                <TableRow key={testCase.id} data-testid={`row-testcase-${testCase.id}`}>
                  <TableCell className="max-w-80">
                    <div className="space-y-1">
                      <p className="font-medium text-sm leading-tight">{testCase.content}</p>
                      <div className="flex items-center space-x-2 flex-wrap">
                        <Badge variant="secondary" className="text-xs capitalize">
                          {testCase.source}
                        </Badge>
                        {testCase.confidenceScore && (
                          <Badge variant="outline" className="text-xs">
                            {Math.round(testCase.confidenceScore * 100)}% confidence
                          </Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs capitalize whitespace-nowrap">
                      {testCase.category}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div 
                      className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap capitalize"
                      style={{
                        backgroundColor: testCase.priority === 'high' 
                          ? '#dc2626' 
                          : testCase.priority === 'low'
                            ? '#6b7280'
                            : '#2563eb',
                        color: '#ffffff',
                        borderColor: testCase.priority === 'high' 
                          ? '#dc2626' 
                          : testCase.priority === 'low'
                            ? '#6b7280'
                            : '#2563eb'
                      }}
                      data-priority={testCase.priority}
                      data-bgcolor={testCase.priority === 'high' 
                        ? '#dc2626' 
                        : testCase.priority === 'low'
                          ? '#6b7280'
                          : '#2563eb'}
                    >
                      {testCase.priority}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div 
                      className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap capitalize"
                      style={{
                        backgroundColor: testCase.severity?.toLowerCase() === 'high' 
                          ? '#dc2626' 
                          : testCase.severity?.toLowerCase() === 'low'
                            ? '#6b7280'
                            : '#2563eb',
                        color: '#ffffff',
                        borderColor: testCase.severity?.toLowerCase() === 'high' 
                          ? '#dc2626' 
                          : testCase.severity?.toLowerCase() === 'low'
                            ? '#6b7280'
                            : '#2563eb'
                      }}
                      data-severity={testCase.severity}
                      data-bgcolor={testCase.severity?.toLowerCase() === 'high' 
                        ? '#dc2626' 
                        : testCase.severity?.toLowerCase() === 'low'
                          ? '#6b7280'
                          : '#2563eb'}
                    >
                      {testCase.severity}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs whitespace-nowrap">
                      {testCase.persona || 'Other'}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-32">
                    <div className="text-xs text-muted-foreground" data-testid={`text-steps-${testCase.id}`}>
                      {testCase.steps && Array.isArray(testCase.steps) && testCase.steps.length > 0 
                        ? `${testCase.steps.length} steps: ${testCase.steps[0].substring(0, 30)}${testCase.steps[0].length > 30 ? '...' : ''}`
                        : 'No steps defined'
                      }
                    </div>
                  </TableCell>
                  <TableCell className="max-w-32">
                    <div className="text-sm truncate">{testCase.customerName}</div>
                  </TableCell>
                  <TableCell className="max-w-40">
                    <div className="text-sm text-muted-foreground truncate" title={testCase.documentName}>
                      {testCase.documentName}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={testCase.executionStatus === 'complete' ? 'default' : testCase.executionStatus === 'in_progress' ? 'secondary' : 'outline'} 
                      className="text-xs capitalize whitespace-nowrap"
                    >
                      {testCase.executionStatus.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Select
                        value={testCase.executionStatus}
                        onValueChange={(value) => handleStatusChange(testCase.id, value)}
                      >
                        <SelectTrigger className="w-32" data-testid={`select-status-${testCase.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ready">Ready</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="complete">Complete</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm" data-testid={`button-view-${testCase.id}`}>
                              <Eye className="h-3 w-3" />
                            </Button>
                          </DialogTrigger>
                          <TestCaseDetailDialog testCase={testCase} onSave={handleSaveTestCase} />
                        </Dialog>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteTestCase(testCase.id)}
                          data-testid={`button-delete-${testCase.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}