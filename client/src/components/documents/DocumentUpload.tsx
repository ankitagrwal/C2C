import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Upload, 
  FileText, 
  X, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  Building2,
  Zap 
} from "lucide-react";
import type { SelectCustomer } from "@shared/schema";

// Hook to fetch customers from API
function useCustomers() {
  return useQuery<SelectCustomer[]>({
    queryKey: ['/api/customers'],
    select: (data) => data?.filter(customer => customer.isConfigured) || []
  });
}

const documentTypes = [
  'Contract',
  'Handbook',
  'Tax Filing',
  'Policy Document',
  'Compliance Manual',
  'Technical Specification',
  'Other'
];

interface UploadedFile {
  id: string;
  file: File;
  customerId: string;
  docType: string;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  error?: string;
}

export default function DocumentUpload() {
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedDocType, setSelectedDocType] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);

  const { data: configuredCustomers, isLoading: isLoadingCustomers, error: customerError } = useCustomers();

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  }, [selectedCustomer, selectedDocType]);

  const handleFiles = (files: File[]) => {
    if (!selectedCustomer || !selectedDocType) {
      alert('Please select a customer and document type first.');
      return;
    }

    const newFiles: UploadedFile[] = files.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      customerId: selectedCustomer,
      docType: selectedDocType,
      status: 'uploading',
      progress: 0
    }));

    setUploadedFiles(prev => [...prev, ...newFiles]);
    
    // Simulate upload and processing
    newFiles.forEach(uploadedFile => {
      simulateFileProcessing(uploadedFile.id);
    });
  };

  const simulateFileProcessing = (fileId: string) => {
    console.log('Processing file:', fileId);
    
    // Simulate upload progress
    const uploadInterval = setInterval(() => {
      setUploadedFiles(prev => prev.map(file => {
        if (file.id === fileId && file.status === 'uploading') {
          const newProgress = Math.min(file.progress + 10, 100);
          return {
            ...file,
            progress: newProgress,
            status: newProgress === 100 ? 'processing' : 'uploading'
          };
        }
        return file;
      }));
    }, 200);

    // Complete processing after upload
    setTimeout(() => {
      clearInterval(uploadInterval);
      setUploadedFiles(prev => prev.map(file => 
        file.id === fileId 
          ? { ...file, status: 'completed', progress: 100 }
          : file
      ));
    }, 3000);
  };

  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(file => file.id !== fileId));
    console.log('File removed:', fileId);
  };

  const getStatusIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case 'uploading':
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
    }
  };

  const getStatusText = (status: UploadedFile['status']) => {
    switch (status) {
      case 'uploading':
        return 'Uploading...';
      case 'processing':
        return 'Processing with AI...';
      case 'completed':
        return 'Ready for test generation';
      case 'error':
        return 'Upload failed';
    }
  };

  const selectedCustomerData = selectedCustomer ? 
    configuredCustomers?.find(c => c.id === selectedCustomer) : null;

  return (
    <div className="space-y-6" data-testid="document-upload">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Document Upload</h1>
          <p className="text-muted-foreground">Upload documents for AI-powered test case generation</p>
        </div>
        <Badge variant="secondary">
          {configuredCustomers.length} customers configured
        </Badge>
      </div>

      {/* Customer & Document Type Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Building2 className="h-5 w-5" />
              <span>Select Customer</span>
            </CardTitle>
            <CardDescription>Choose the customer this document belongs to</CardDescription>
          </CardHeader>
          <CardContent>
            {customerError && (
              <Alert className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Failed to load customers. Please check your connection and try again.
                </AlertDescription>
              </Alert>
            )}
            
            {isLoadingCustomers ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : (
              <>
                <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                  <SelectTrigger data-testid="select-customer">
                    <SelectValue placeholder="Select a configured customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {configuredCustomers?.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        <div>
                          <div className="font-medium">{customer.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {customer.solutionId} • {customer.industry}
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {!configuredCustomers?.length && !isLoadingCustomers && (
                  <Alert className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      No configured customers found. Please add customers through the customer management system.
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}
            
            {selectedCustomerData && (
              <div className="mt-3 p-3 bg-muted/50 rounded-md">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{selectedCustomerData.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {selectedCustomerData.industry}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Solution ID: {selectedCustomerData.solutionId}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Document Type</span>
            </CardTitle>
            <CardDescription>Specify the type of document being uploaded</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedDocType} onValueChange={setSelectedDocType}>
              <SelectTrigger data-testid="select-doctype">
                <SelectValue placeholder="Select document type" />
              </SelectTrigger>
              <SelectContent>
                {documentTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Upload className="h-5 w-5" />
            <span>Upload Documents</span>
          </CardTitle>
          <CardDescription>Drag and drop files or click to browse. Supports PDF, DOC, DOCX, TXT</CardDescription>
        </CardHeader>
        <CardContent>
          {!selectedCustomer || !selectedDocType ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please select a customer and document type before uploading files.
              </AlertDescription>
            </Alert>
          ) : (
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive 
                  ? 'border-primary bg-primary/5' 
                  : 'border-muted-foreground/25 hover:border-muted-foreground/50'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              data-testid="upload-dropzone"
            >
              <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <div className="space-y-2">
                <p className="text-lg font-medium">Drop files here or click to browse</p>
                <p className="text-sm text-muted-foreground">
                  Supports PDF, DOC, DOCX, and TXT files up to 10MB each
                </p>
              </div>
              <Input
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt"
                onChange={(e) => e.target.files && handleFiles(Array.from(e.target.files))}
                className="hidden"
                id="file-upload"
                data-testid="input-file-upload"
              />
              <Label htmlFor="file-upload" className="cursor-pointer">
                <Button type="button" className="mt-4">
                  Browse Files
                </Button>
              </Label>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Uploaded Files */}
      {uploadedFiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Uploaded Files</CardTitle>
            <CardDescription>Track the progress of your document uploads and processing</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {uploadedFiles.map((file) => {
                const customer = configuredCustomers.find(c => c.id === file.customerId);
                return (
                  <div key={file.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{file.file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {customer?.name} • {file.docType} • {(file.file.size / 1024 / 1024).toFixed(2)}MB
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(file.status)}
                          <span className="text-sm">{getStatusText(file.status)}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(file.id)}
                          data-testid={`button-remove-${file.id}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {file.status === 'uploading' && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>Uploading...</span>
                          <span>{file.progress}%</span>
                        </div>
                        <Progress value={file.progress} className="h-2" />
                      </div>
                    )}
                    
                    {file.status === 'processing' && (
                      <div className="flex items-center space-x-2 text-sm">
                        <Zap className="h-4 w-4 text-blue-600" />
                        <span>Processing with AI for test case generation...</span>
                      </div>
                    )}
                    
                    {file.status === 'completed' && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 text-sm text-green-600">
                          <CheckCircle className="h-4 w-4" />
                          <span>Ready for test case generation</span>
                        </div>
                        <Button size="sm" data-testid={`button-generate-tests-${file.id}`}>
                          <Zap className="mr-2 h-3 w-3" />
                          Generate Tests
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}