import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
const mockTestCases = [
  {
    id: '1',
    content: 'Verify that software license allows maximum 500 concurrent users as specified in Section 3.2',
    category: 'Functional Tests',
    source: 'generated',
    confidenceScore: 0.94,
    contextUsed: 'Software licensing terms and conditions for enterprise deployment. Maximum 500 concurrent users',
    executionStatus: 'ready',
    documentName: 'Software License Agreement 2024.pdf',
    customerName: 'TechCorp Inc',
    createdAt: '2024-09-10T10:30:00Z'
  },
  {
    id: '2',
    content: 'Test remote work policy compliance when employee requests more than 3 days per week',
    category: 'Compliance Tests',
    source: 'generated',
    confidenceScore: 0.87,
    contextUsed: 'Remote work policy allows up to 3 days per week working from home',
    executionStatus: 'in_progress',
    documentName: 'Employee Handbook Q3.md',
    customerName: 'TechCorp Inc',
    createdAt: '2024-09-10T11:15:00Z'
  },
  {
    id: '3',
    content: 'Validate HIPAA compliance when unauthorized healthcare provider attempts to access patient records',
    category: 'Compliance Tests',
    source: 'generated',
    confidenceScore: 0.96,
    contextUsed: 'Only authorized healthcare providers can access patient records under HIPAA guidelines',
    executionStatus: 'complete',
    documentName: 'HIPAA Compliance Manual.pdf',
    customerName: 'HealthCare Partners',
    createdAt: '2024-09-10T09:45:00Z'
  },
  {
    id: '4',
    content: 'Test edge case: What happens when license expires during active user session?',
    category: 'Edge Cases',
    source: 'manual',
    confidenceScore: null,
    contextUsed: null,
    executionStatus: 'ready',
    documentName: 'Software License Agreement 2024.pdf',
    customerName: 'TechCorp Inc',
    createdAt: '2024-09-10T14:20:00Z'
  },
  {
    id: '5',
    content: 'Verify API integration handles user authentication correctly with external HR systems',
    category: 'Integration Tests',
    source: 'generated',
    confidenceScore: 0.89,
    contextUsed: 'System integration with external HR portal for user authentication and authorization',
    executionStatus: 'ready',
    documentName: 'HR System Integration Guide.pdf',
    customerName: 'Education Institute',
    createdAt: '2024-09-10T12:00:00Z'
  }
];

const categories = ['All Categories', 'Functional Tests', 'Compliance Tests', 'Edge Cases', 'Integration Tests'];
const statuses = ['All Statuses', 'ready', 'in_progress', 'complete'];
const sources = ['All Sources', 'generated', 'manual', 'uploaded'];

interface TestCaseDetailDialogProps {
  testCase: typeof mockTestCases[0];
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
        <div>
          <Label htmlFor="content">Test Case Content</Label>
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
  const [testCases, setTestCases] = useState(mockTestCases);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [selectedStatus, setSelectedStatus] = useState('All Statuses');
  const [selectedSource, setSelectedSource] = useState('All Sources');

  const handleSaveTestCase = (id: string, updates: any) => {
    setTestCases(prev => prev.map(tc => 
      tc.id === id ? { ...tc, ...updates } : tc
    ));
    console.log('Test case saved:', id, updates);
  };

  const handleDeleteTestCase = (id: string) => {
    if (confirm('Are you sure you want to delete this test case?')) {
      setTestCases(prev => prev.filter(tc => tc.id !== id));
      console.log('Test case deleted:', id);
    }
  };

  const handleStatusChange = (id: string, newStatus: string) => {
    setTestCases(prev => prev.map(tc => 
      tc.id === id ? { ...tc, executionStatus: newStatus } : tc
    ));
    console.log('Test case status changed:', id, newStatus);
  };

  const filteredTestCases = testCases.filter(tc => {
    const matchesSearch = tc.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         tc.documentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         tc.customerName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All Categories' || tc.category === selectedCategory;
    const matchesStatus = selectedStatus === 'All Statuses' || tc.executionStatus === selectedStatus;
    const matchesSource = selectedSource === 'All Sources' || tc.source === selectedSource;
    
    return matchesSearch && matchesCategory && matchesStatus && matchesSource;
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
    count: testCases.filter(tc => tc.category === cat).length
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
          <Button variant="outline" data-testid="button-import">
            <Plus className="mr-2 h-4 w-4" />
            Import Tests
          </Button>
          <Button data-testid="button-export">
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
          <div className="space-y-4">
            {filteredTestCases.map((testCase) => (
              <div key={testCase.id} className="border rounded-lg p-4 hover-elevate">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <Badge variant="outline" className="text-xs">
                        {testCase.category}
                      </Badge>
                      {getStatusBadge(testCase.executionStatus)}
                      <Badge variant="secondary" className="text-xs capitalize">
                        {testCase.source}
                      </Badge>
                      {testCase.confidenceScore && (
                        <Badge variant="outline" className="text-xs">
                          {Math.round(testCase.confidenceScore * 100)}% confidence
                        </Badge>
                      )}
                    </div>
                    <p className="font-medium text-sm mb-2">{testCase.content}</p>
                    <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                      <span className="flex items-center space-x-1">
                        <FileText className="h-3 w-3" />
                        <span>{testCase.documentName}</span>
                      </span>
                      <span>{testCase.customerName}</span>
                      <span>{new Date(testCase.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(testCase.executionStatus)}
                    
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
                </div>
                
                {testCase.contextUsed && (
                  <div className="bg-muted/30 p-3 rounded-md">
                    <p className="text-xs text-muted-foreground mb-1">RAG Context:</p>
                    <p className="text-xs">{testCase.contextUsed}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}