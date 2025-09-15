import { useState, useRef } from 'react';
import { FileSpreadsheet, Download, Upload, AlertCircle, CheckCircle, X, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import type { TestCase } from '@shared/schema';

interface ManualCSVStepProps {
  onComplete: (testCases: TestCase[]) => void;
  initialTestCases?: TestCase[];
  industry?: string;
  documentId?: string;
}

interface UploadResult {
  created: number;
  errors: string[];
  testCases: TestCase[];
}

interface CSVTemplate {
  id: string;
  name: string;
  description: string;
  industry: string;
  filename: string;
}

const CSV_TEMPLATES: CSVTemplate[] = [
  {
    id: 'general',
    name: 'General Business',
    description: 'Universal test cases for any business application',
    industry: 'General',
    filename: 'test-cases-template-general.csv'
  },
  {
    id: 'finance',
    name: 'Financial Services',
    description: 'Banking, payments, and financial compliance tests',
    industry: 'Finance',
    filename: 'test-cases-template-finance.csv'
  },
  {
    id: 'healthcare',
    name: 'Healthcare',
    description: 'HIPAA compliance and medical workflow tests',
    industry: 'Healthcare',
    filename: 'test-cases-template-healthcare.csv'
  },
  {
    id: 'ecommerce',
    name: 'E-commerce',
    description: 'Shopping cart, payments, and inventory tests',
    industry: 'Ecommerce',
    filename: 'test-cases-template-ecommerce.csv'
  },
  {
    id: 'manufacturing',
    name: 'Manufacturing',
    description: 'Supply chain, quality control, and production tests',
    industry: 'Manufacturing',
    filename: 'test-cases-template-manufacturing.csv'
  }
];

export default function ManualCSVStep({ 
  onComplete, 
  initialTestCases = [], 
  industry = 'General',
  documentId
}: ManualCSVStepProps) {
  const [uploadedTestCases, setUploadedTestCases] = useState<TestCase[]>(initialTestCases);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [csvPreview, setCsvPreview] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Download CSV template
  const downloadTemplate = async (templateIndustry: string = industry) => {
    try {
      const response = await fetch(`/api/test-cases/template.csv?industry=${encodeURIComponent(templateIndustry)}`, {
        credentials: 'include',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
        },
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `test-cases-template-${templateIndustry.toLowerCase()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Template Downloaded',
        description: `Downloaded ${templateIndustry} CSV template successfully`,
      });
    } catch (error) {
      toast({
        title: 'Download Failed',
        description: error instanceof Error ? error.message : 'Failed to download template',
        variant: 'destructive',
      });
    }
  };

  // Upload CSV mutation
  const uploadCSVMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      if (documentId) {
        formData.append('documentId', documentId);
      }

      const response = await fetch('/api/test-cases/upload-csv', {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || response.statusText);
      }

      return response.json();
    },
    onSuccess: (data: UploadResult) => {
      setUploadResult(data);
      
      // Fix: Use functional state updater to ensure onComplete gets fresh state
      setUploadedTestCases(prev => {
        const next = [...prev, ...data.testCases];
        onComplete(next); // Call with fresh state
        return next;
      });
      
      toast({
        title: 'CSV Upload Successful',
        description: `Successfully added ${data.created} test case${data.created !== 1 ? 's' : ''}`,
      });

      // Clear file selection
      setSelectedFile(null);
      setCsvPreview('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    onError: (error: any) => {
      const errorMessage = error?.message || 'Failed to upload CSV file';
      toast({
        title: 'Upload Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: 'Invalid File Type',
        description: 'Please select a CSV file (.csv)',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File Too Large',
        description: 'CSV file must be under 5MB',
        variant: 'destructive',
      });
      return;
    }

    setSelectedFile(file);

    // Read file content for preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const lines = content.split(/\r?\n/);
      const previewLines = lines.slice(0, 10); // Show first 10 lines
      setCsvPreview(previewLines.join('\n'));
    };
    reader.readAsText(file);
  };

  const handleUpload = () => {
    if (!selectedFile) {
      toast({
        title: 'No File Selected',
        description: 'Please select a CSV file to upload',
        variant: 'destructive',
      });
      return;
    }

    uploadCSVMutation.mutate(selectedFile);
  };

  const clearFile = () => {
    setSelectedFile(null);
    setCsvPreview('');
    setUploadResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeTestCase = (testCaseId: string) => {
    const updatedTestCases = uploadedTestCases.filter(tc => tc.id !== testCaseId);
    setUploadedTestCases(updatedTestCases);
    onComplete(updatedTestCases);
  };

  return (
    <div className="space-y-6">
      {/* Template Download Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileSpreadsheet className="w-5 h-5 text-chart-3" />
            <span>Download CSV Templates</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Choose an industry-specific template to get started with predefined test cases that you can customize.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {CSV_TEMPLATES.map((template) => (
              <Card 
                key={template.id}
                className={`cursor-pointer transition-colors hover-elevate ${
                  template.industry === industry ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => downloadTemplate(template.industry)}
                data-testid={`template-card-${template.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-sm">{template.name}</h4>
                    {template.industry === industry && (
                      <Badge variant="default" className="text-xs">Recommended</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    {template.description}
                  </p>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadTemplate(template.industry);
                    }}
                    data-testid={`button-download-${template.id}`}
                  >
                    <Download className="w-3 h-3 mr-2" />
                    Download
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* CSV Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Upload className="w-5 h-5 text-chart-2" />
            <span>Upload Your CSV File</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="csv-file">Select CSV File</Label>
            <div className="flex items-center space-x-2">
              <input
                ref={fileInputRef}
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
                data-testid="input-csv-file"
              />
              <Button 
                variant="outline" 
                onClick={() => fileInputRef.current?.click()}
                data-testid="button-select-csv"
              >
                <FileText className="w-4 h-4 mr-2" />
                {selectedFile ? 'Change File' : 'Choose File'}
              </Button>
              {selectedFile && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">
                    {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={clearFile}
                    data-testid="button-clear-csv"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* CSV Preview */}
          {csvPreview && (
            <div className="space-y-2">
              <Label>File Preview (First 10 lines)</Label>
              <Textarea
                value={csvPreview}
                readOnly
                className="font-mono text-xs h-32 resize-none"
                data-testid="textarea-csv-preview"
              />
            </div>
          )}

          {/* Upload Button */}
          {selectedFile && (
            <Button 
              onClick={handleUpload}
              disabled={uploadCSVMutation.isPending}
              className="w-full"
              data-testid="button-upload-csv"
            >
              {uploadCSVMutation.isPending ? (
                <>
                  <Upload className="w-4 h-4 mr-2 animate-pulse" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload CSV
                </>
              )}
            </Button>
          )}

          {/* Upload Results */}
          {uploadResult && (
            <Alert className={uploadResult.errors.length > 0 ? 'border-destructive' : 'border-green-500'}>
              {uploadResult.errors.length > 0 ? (
                <AlertCircle className="h-4 w-4" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              <AlertDescription>
                <div className="space-y-2">
                  <p>
                    <strong>Upload Complete:</strong> {uploadResult.created} test case{uploadResult.created !== 1 ? 's' : ''} added successfully
                  </p>
                  {uploadResult.errors.length > 0 && (
                    <div>
                      <p className="font-medium text-destructive">Errors encountered:</p>
                      <ul className="text-sm list-disc list-inside space-y-1 text-muted-foreground">
                        {uploadResult.errors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* CSV Format Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">CSV Format Requirements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div>
              <h4 className="font-medium mb-2">Required Columns:</h4>
              <ul className="space-y-1 list-disc list-inside text-muted-foreground">
                <li><code className="bg-muted px-1 rounded">title</code> - Test case name (required)</li>
                <li><code className="bg-muted px-1 rounded">description</code> - What the test case does (required)</li>
                <li><code className="bg-muted px-1 rounded">category</code> - Test category (Functional, Compliance, etc.)</li>
                <li><code className="bg-muted px-1 rounded">priority</code> - Priority level (low, medium, high)</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Optional Columns:</h4>
              <ul className="space-y-1 list-disc list-inside text-muted-foreground">
                <li><code className="bg-muted px-1 rounded">preconditions</code> - Setup requirements</li>
                <li><code className="bg-muted px-1 rounded">steps</code> - Test execution steps</li>
                <li><code className="bg-muted px-1 rounded">expected_result</code> - Expected outcome</li>
                <li><code className="bg-muted px-1 rounded">source</code> - Will be set to 'manual'</li>
              </ul>
            </div>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Use quotes around text that contains commas, line breaks, or special characters.
                Maximum file size: 5MB.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>

      {/* Uploaded Test Cases Summary */}
      {uploadedTestCases.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Manual Test Cases ({uploadedTestCases.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {uploadedTestCases.map((testCase) => (
                <div 
                  key={testCase.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                  data-testid={`test-case-${testCase.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <h5 className="font-medium text-sm truncate">{testCase.title}</h5>
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {testCase.category || 'Manual'}
                      </Badge>
                      <Badge 
                        variant={
                          testCase.priority === 'high' ? 'destructive' :
                          testCase.priority === 'medium' ? 'secondary' : 
                          'outline'
                        }
                        className="text-xs"
                      >
                        {testCase.priority || 'medium'}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeTestCase(testCase.id)}
                    data-testid={`button-remove-${testCase.id}`}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}