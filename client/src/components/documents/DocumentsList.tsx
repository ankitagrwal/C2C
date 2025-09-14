import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
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
  Calendar
} from "lucide-react";
import type { Document, Customer } from "@shared/schema";

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

export default function DocumentsList() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All Statuses');
  const [selectedCustomer, setSelectedCustomer] = useState('All Customers');
  const { toast } = useToast();

  const { data: documents = [], isLoading, error, refetch } = useDocuments();
  const { data: customers = [] } = useCustomers();

  // Mutation for generating test cases
  const generateTestsMutation = useMutation({
    mutationFn: async (documentId: string) => {
      return apiRequest('POST', `/api/documents/${documentId}/generate-tests`, {});
    },
    onSuccess: () => {
      toast({
        title: "Test Generation Started",
        description: "AI is generating test cases from your document. This may take a few minutes."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/processing-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
    },
    onError: (error) => {
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Failed to start test generation",
        variant: "destructive"
      });
    }
  });

  // Mutation for deleting documents
  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      return apiRequest('DELETE', `/api/documents/${documentId}`, {});
    },
    onSuccess: () => {
      toast({
        title: "Document Deleted",
        description: "Document has been successfully deleted."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
    },
    onError: (error) => {
      toast({
        title: "Delete Failed", 
        description: error instanceof Error ? error.message : "Failed to delete document",
        variant: "destructive"
      });
    }
  });

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
    
    const colors: { [key: string]: string } = {
      'processing': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      'completed': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'failed': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      'uploaded': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
    };
    
    return (
      <Badge variant={variants[status] || 'secondary'} className={colors[status]}>
        {status || 'uploaded'}
      </Badge>
    );
  };

  const getCustomerName = (customerId: string | null) => {
    if (!customerId) return 'Unknown Customer';
    const customer = customers?.find(c => c.id === customerId);
    return customer?.name || 'Unknown Customer';
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         doc.docType?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         getCustomerName(doc.customerId).toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = selectedStatus === 'All Statuses' || (doc.status || 'uploaded') === selectedStatus;
    const matchesCustomer = selectedCustomer === 'All Customers' || doc.customerId === selectedCustomer;
    
    return matchesSearch && matchesStatus && matchesCustomer;
  });

  const statuses = ['All Statuses', 'uploaded', 'processing', 'completed', 'failed'];

  if (error) {
    return (
      <div className="space-y-6" data-testid="documents-list-error">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load documents. Please check your connection and try again.
          </AlertDescription>
        </Alert>
        <Button onClick={() => refetch()}>Try Again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="documents-list">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Documents</h1>
          <p className="text-muted-foreground">Manage uploaded documents and track processing status</p>
        </div>
        <Badge variant="secondary" data-testid="documents-count">
          {documents.length} document{documents.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Filter Documents</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-documents"
              />
            </div>
            
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

            <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
              <SelectTrigger data-testid="select-filter-customer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All Customers">All Customers</SelectItem>
                {customers?.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Documents List */}
      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="border rounded-lg p-4">
                  <div className="flex items-center space-x-4">
                    <Skeleton className="h-10 w-10" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : filteredDocuments.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Documents Found</h3>
            <p className="text-muted-foreground">
              {documents.length === 0 
                ? "Upload your first document to get started." 
                : "Try adjusting your filters to find the documents you're looking for."
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Documents ({filteredDocuments.length})</CardTitle>
            <CardDescription>View and manage your uploaded documents</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredDocuments.map((document) => (
                <div key={document.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      {getStatusIcon(document.status || 'uploaded')}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-medium truncate">{document.filename}</h4>
                          {getStatusBadge(document.status || 'uploaded')}
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                          <div className="flex items-center space-x-1">
                            <Building2 className="h-3 w-3" />
                            <span>{getCustomerName(document.customerId)}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-3 w-3" />
                            <span>{document.createdAt ? new Date(document.createdAt).toLocaleDateString() : 'Unknown'}</span>
                          </div>
                          {document.docType && (
                            <span className="text-xs bg-muted px-2 py-1 rounded">{document.docType}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {document.status === 'completed' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => generateTestsMutation.mutate(document.id)}
                          disabled={generateTestsMutation.isPending}
                          data-testid={`button-generate-tests-${document.id}`}
                        >
                          <PlayCircle className="h-4 w-4 mr-2" />
                          Generate Tests
                        </Button>
                      )}
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMutation.mutate(document.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-${document.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}