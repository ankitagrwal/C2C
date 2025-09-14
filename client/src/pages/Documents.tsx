import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Upload, 
  FileText, 
  Search, 
  Filter, 
  MoreVertical,
  Download,
  Trash2,
  PlayCircle,
  CheckCircle,
  AlertCircle,
  Clock,
  Eye,
  Building2,
  Calendar,
  X,
  Loader2,
  Zap 
} from "lucide-react";
import type { Document, Customer } from "@shared/schema";
import AutoCustomerDetectionModal, { ExtractedCompanyDetails } from "@/components/documents/AutoCustomerDetectionModal";

// Hook to fetch documents from API
function useDocuments() {
  return useQuery<Document[]>({
    queryKey: ['/api/documents'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook to fetch customers for display names
function useCustomers() {
  return useQuery<Customer[]>({
    queryKey: ['/api/customers'],
    staleTime: 10 * 60 * 1000, // 10 minutes
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

export default function Documents() {
  // Search and filtering state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All Statuses');
  const [selectedCustomer, setSelectedCustomer] = useState('All Customers');
  
  // Upload state
  const [uploadSelectedCustomer, setUploadSelectedCustomer] = useState('');
  const [uploadSelectedDocType, setUploadSelectedDocType] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  
  // Auto-customer detection state
  const [showDetectionModal, setShowDetectionModal] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [extractedDetails, setExtractedDetails] = useState<ExtractedCompanyDetails | null>(null);
  
  const { toast } = useToast();

  const { data: documents = [], isLoading, error, refetch } = useDocuments();
  const { data: customers = [], isLoading: isLoadingCustomers } = useCustomers();
  
  const configuredCustomers = customers.filter(customer => customer.isConfigured);

  // File upload mutation
  const uploadMutation = useMutation({
    mutationFn: async ({ file, customerId, docType }: { file: File; customerId: string; docType: string }) => {
      const formData = new FormData();
      formData.append('document', file);
      formData.append('customerId', customerId);
      formData.append('title', docType);
      formData.append('docType', docType);
      
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Upload failed: ${response.status} - ${text}`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
    }
  });

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFiles = async (files: File[]) => {
    // If no customer selected but document type is selected, trigger auto-detection
    if (!uploadSelectedCustomer && uploadSelectedDocType) {
      const file = files[0]; // Process first file for detection
      if (file) {
        // Start document analysis for auto-customer detection
        await analyzeDocumentForCustomer(file);
      }
      return;
    }

    if (!uploadSelectedCustomer || !uploadSelectedDocType) {
      toast({
        title: "Selection Required",
        description: "Please select a customer and document type first.",
        variant: "destructive"
      });
      return;
    }

    const newFiles: UploadedFile[] = files.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      customerId: uploadSelectedCustomer,
      docType: uploadSelectedDocType,
      status: 'uploading',
      progress: 0
    }));

    setUploadedFiles(prev => [...prev, ...newFiles]);
    
    newFiles.forEach(uploadedFile => {
      uploadFile(uploadedFile);
    });
  };

  const analyzeDocumentForCustomer = async (file: File) => {
    try {
      toast({
        title: "Analyzing Document",
        description: "Extracting company information from your document..."
      });

      // Read file content (for simplicity, we'll send the file name and basic info)
      // In a real implementation, you'd extract text from the file
      const formData = new FormData();
      formData.append('document', file);
      
      const response = await fetch('/api/documents/analyze-company', {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to analyze document');
      }

      const details: ExtractedCompanyDetails = await response.json();
      
      setPendingFile(file);
      setExtractedDetails(details);
      setShowDetectionModal(true);

    } catch (error) {
      console.error('Document analysis failed:', error);
      toast({
        title: "Analysis Failed",
        description: "Could not extract company information. Please select a customer manually.",
        variant: "destructive"
      });
    }
  };

  const handleCustomerCreated = (customerId: string) => {
    setUploadSelectedCustomer(customerId);
    setShowDetectionModal(false);
    
    // Now upload the pending file
    if (pendingFile && uploadSelectedDocType) {
      const newFile: UploadedFile = {
        id: Math.random().toString(36).substr(2, 9),
        file: pendingFile,
        customerId: customerId,
        docType: uploadSelectedDocType,
        status: 'uploading',
        progress: 0
      };

      setUploadedFiles(prev => [...prev, newFile]);
      uploadFile(newFile);
    }
    
    // Reset pending state
    setPendingFile(null);
    setExtractedDetails(null);
  };

  const handleDemoMode = () => {
    toast({
      title: "Demo Mode Activated",
      description: "Document will be processed for test case generation without creating a customer.",
      variant: "default"
    });
    
    // Process file in demo mode (without customer association)
    if (pendingFile && uploadSelectedDocType) {
      const newFile: UploadedFile = {
        id: Math.random().toString(36).substr(2, 9),
        file: pendingFile,
        customerId: 'demo', // Special demo customer ID
        docType: uploadSelectedDocType,
        status: 'uploading',
        progress: 0
      };

      setUploadedFiles(prev => [...prev, newFile]);
      uploadFile(newFile);
    }
    
    // Reset state
    setShowDetectionModal(false);
    setPendingFile(null);
    setExtractedDetails(null);
  };

  const uploadFile = async (uploadedFile: UploadedFile) => {
    try {
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress = Math.min(progress + 5, 90);
        setUploadedFiles(prev => prev.map(file => 
          file.id === uploadedFile.id 
            ? { ...file, progress, status: 'uploading' }
            : file
        ));
      }, 100);

      const result = await uploadMutation.mutateAsync({
        file: uploadedFile.file,
        customerId: uploadedFile.customerId,
        docType: uploadedFile.docType
      });

      clearInterval(progressInterval);
      
      setUploadedFiles(prev => prev.map(file => 
        file.id === uploadedFile.id 
          ? { ...file, status: 'completed', progress: 100 }
          : file
      ));

      toast({
        title: "Upload Successful",
        description: `${uploadedFile.file.name} has been uploaded and is ready for processing.`
      });

    } catch (error) {
      setUploadedFiles(prev => prev.map(file => 
        file.id === uploadedFile.id 
          ? { ...file, status: 'error', progress: 0, error: error instanceof Error ? error.message : 'Upload failed' }
          : file
      ));

      toast({
        title: "Upload Failed",
        description: `Failed to upload ${uploadedFile.file.name}. ${error instanceof Error ? error.message : 'Please try again.'}`,
        variant: "destructive"
      });
    }
  };

  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(file => file.id !== fileId));
  };

  // Status icons and badges
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processing':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <FileText className="h-4 w-4 text-blue-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: { [key: string]: any } = {
      'processing': 'default',
      'completed': 'default', 
      'failed': 'destructive',
      'uploaded': 'secondary'
    };
    
    return variants[status] || 'secondary';
  };

  const getUploadStatusIcon = (status: string) => {
    switch (status) {
      case 'uploading':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />;
      case 'processing':
        return <Zap className="h-4 w-4 text-yellow-600" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getUploadStatusText = (status: string) => {
    switch (status) {
      case 'uploading': return 'Uploading';
      case 'processing': return 'Processing';
      case 'completed': return 'Completed';
      case 'error': return 'Failed';
      default: return 'Ready';
    }
  };

  // Filter documents based on search and filters
  const filteredDocuments = documents.filter(doc => {
    const customer = customers.find(c => c.id === doc.customerId);
    const matchesSearch = doc.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         customer?.name?.toLowerCase().includes(searchQuery.toLowerCase() || '');
    const matchesStatus = selectedStatus === 'All Statuses' || doc.status === selectedStatus.toLowerCase();
    const matchesCustomer = selectedCustomer === 'All Customers' || customer?.name === selectedCustomer;
    
    return matchesSearch && matchesStatus && matchesCustomer;
  });

  // Get unique statuses and customer names for filters
  const availableStatuses = ['All Statuses', ...Array.from(new Set(documents.map(doc => doc.status || 'unknown').filter(Boolean)))];
  const availableCustomerNames = ['All Customers', ...Array.from(new Set(
    documents.map(doc => customers.find(c => c.id === doc.customerId)?.name).filter(Boolean)
  ))];

  return (
    <div className="space-y-6" data-testid="documents-page">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold">Documents</h1>
        <p className="text-muted-foreground">Upload documents and track processing status</p>
      </div>

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Documents</CardTitle>
          <CardDescription>
            Upload business documents to generate comprehensive test cases. Supported formats: PDF, DOC, DOCX, and TXT files up to 10MB each.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Customer and Document Type Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="upload-customer">Customer</Label>
                {isLoadingCustomers ? (
                  <Skeleton className="h-10" />
                ) : (
                  <Select
                    value={uploadSelectedCustomer}
                    onValueChange={setUploadSelectedCustomer}
                    data-testid="select-upload-customer"
                  >
                    <SelectTrigger id="upload-customer">
                      <SelectValue placeholder="Select a customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {configuredCustomers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          <div className="flex items-center space-x-2">
                            <Building2 className="h-4 w-4" />
                            <span>{customer.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="upload-doctype">Document Type</Label>
                <Select
                  value={uploadSelectedDocType}
                  onValueChange={setUploadSelectedDocType}
                  data-testid="select-upload-doctype"
                >
                  <SelectTrigger id="upload-doctype">
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
              </div>
            </div>

            {/* Upload Area */}
            {!uploadSelectedDocType ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Please select a document type before uploading files. {!uploadSelectedCustomer && uploadSelectedDocType && "Customer selection is optional - I can detect and create one automatically!"}
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
                    Supports <Badge variant="outline">PDF</Badge> <Badge variant="outline">DOC</Badge> <Badge variant="outline">DOCX</Badge> <Badge variant="outline">TXT</Badge> files up to 10MB each
                  </p>
                  {!uploadSelectedCustomer && uploadSelectedDocType && (
                    <p className="text-xs text-blue-600 mt-2 flex items-center">
                      <Zap className="h-3 w-3 mr-1" />
                      Smart feature: I can analyze your document and automatically detect company information!
                    </p>
                  )}
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
                  <Button type="button" className="mt-4" data-testid="button-browse-files">
                    Browse Files
                  </Button>
                </Label>
              </div>
            )}

            {/* Upload Progress */}
            {uploadedFiles.length > 0 && (
              <div className="space-y-4">
                <h4 className="font-medium">Upload Progress</h4>
                {uploadedFiles.map((file) => {
                  const customer = configuredCustomers?.find(c => c.id === file.customerId);
                  return (
                    <div key={file.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{file.file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {customer?.name || 'Unknown'} • {file.docType} • {(file.file.size / 1024 / 1024).toFixed(2)}MB
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center space-x-2">
                            {getUploadStatusIcon(file.status)}
                            <span className="text-sm">{getUploadStatusText(file.status)}</span>
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
                      
                      {file.error && (
                        <div className="mt-2">
                          <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{file.error}</AlertDescription>
                          </Alert>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Document List Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Document Library</CardTitle>
              <CardDescription>Manage uploaded documents and track processing status</CardDescription>
            </div>
            <Badge variant="secondary" data-testid="documents-count">
              {documents.length} document{documents.length !== 1 ? 's' : ''}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-documents"
                />
              </div>
              <div className="flex gap-2">
                <Select value={selectedStatus} onValueChange={setSelectedStatus} data-testid="select-filter-status">
                  <SelectTrigger className="w-[140px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableStatuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={selectedCustomer} onValueChange={setSelectedCustomer} data-testid="select-filter-customer">
                  <SelectTrigger className="w-[140px]">
                    <Building2 className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCustomerNames.map((customerName) => (
                      <SelectItem key={customerName} value={customerName || 'Unknown'}>
                        {customerName || 'Unknown'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Loading State */}
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Skeleton className="h-10 w-10" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-[200px]" />
                        <Skeleton className="h-3 w-[150px]" />
                      </div>
                    </div>
                    <Skeleton className="h-8 w-[100px]" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Failed to load documents. Please try again.
                </AlertDescription>
              </Alert>
            ) : filteredDocuments.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">
                  {documents.length === 0 ? 'No Documents Found' : 'No Matching Documents'}
                </h3>
                <p className="text-muted-foreground max-w-sm mx-auto">
                  {documents.length === 0 
                    ? 'Upload your first document to get started with test case generation.'
                    : 'Try adjusting your search or filter criteria to find documents.'
                  }
                </p>
              </div>
            ) : (
              /* Document Grid */
              <div className="grid gap-4">
                {filteredDocuments.map((document) => {
                  const customer = customers.find(c => c.id === document.customerId);
                  return (
                    <div key={document.id} className="border rounded-lg p-4 hover-elevate" data-testid={`document-${document.id}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3 flex-1">
                          {getStatusIcon(document.status || 'unknown')}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <h4 className="font-medium truncate" data-testid={`document-title-${document.id}`}>
                                {document.filename}
                              </h4>
                              <Badge variant={getStatusBadge(document.status || 'unknown')} data-testid={`document-status-${document.id}`}>
                                {document.status || 'unknown'}
                              </Badge>
                            </div>
                            <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-1">
                              <span className="flex items-center space-x-1">
                                <Building2 className="h-3 w-3" />
                                <span>{customer?.name || 'Unknown Customer'}</span>
                              </span>
                              <span className="flex items-center space-x-1">
                                <Calendar className="h-3 w-3" />
                                <span>{document.createdAt ? new Date(document.createdAt).toLocaleDateString() : 'Unknown date'}</span>
                              </span>
                              {document.docType && (
                                <span className="flex items-center space-x-1">
                                  <FileText className="h-3 w-3" />
                                  <span>{document.docType}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Button variant="outline" size="sm" data-testid={`button-view-${document.id}`}>
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          <Button variant="outline" size="sm" data-testid={`button-download-${document.id}`}>
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="default" 
                            size="sm"
                            disabled={document.status !== 'completed'}
                            data-testid={`button-generate-tests-${document.id}`}
                          >
                            <PlayCircle className="h-4 w-4 mr-1" />
                            Generate Tests
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Auto-Customer Detection Modal */}
      <AutoCustomerDetectionModal
        isOpen={showDetectionModal}
        onClose={() => {
          setShowDetectionModal(false);
          setPendingFile(null);
          setExtractedDetails(null);
        }}
        onCustomerCreated={handleCustomerCreated}
        onDemoMode={handleDemoMode}
        extractedDetails={extractedDetails}
        fileName={pendingFile?.name || ''}
      />
    </div>
  );
}