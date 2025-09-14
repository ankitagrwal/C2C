import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Building2,
  CheckCircle,
  Edit3,
  Eye,
  Sparkles,
  AlertCircle,
  FileText,
  Mail,
  Phone,
  MapPin
} from "lucide-react";

export interface ExtractedCompanyDetails {
  companyName: string | null;
  industry: string | null;
  contractType: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  confidence: 'high' | 'medium' | 'low';
}

interface AutoCustomerDetectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCustomerCreated: (customerId: string) => void;
  onDemoMode: () => void;
  extractedDetails: ExtractedCompanyDetails | null;
  fileName: string;
}

export default function AutoCustomerDetectionModal({
  isOpen,
  onClose,
  onCustomerCreated,
  onDemoMode,
  extractedDetails,
  fileName
}: AutoCustomerDetectionModalProps) {
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editedDetails, setEditedDetails] = useState(extractedDetails);
  const { toast } = useToast();

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedAction(null);
      setEditMode(false);
      setEditedDetails(extractedDetails);
    }
  }, [isOpen, extractedDetails]);

  const createCustomerMutation = useMutation({
    mutationFn: async (customerData: any) => {
      return apiRequest('POST', '/api/customers', customerData);
    },
    onSuccess: (customer: any) => {
      toast({
        title: "Customer Created",
        description: `${customer.name} has been successfully created and configured.`
      });
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      onCustomerCreated(customer.id);
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Creation Failed",
        description: error instanceof Error ? error.message : "Failed to create customer",
        variant: "destructive"
      });
    }
  });

  const handleAutoCreate = () => {
    if (!extractedDetails?.companyName) {
      toast({
        title: "Insufficient Information",
        description: "Company name is required to auto-create a customer.",
        variant: "destructive"
      });
      return;
    }

    const customerData = {
      name: extractedDetails.companyName,
      industry: extractedDetails.industry || 'Unknown',
      contactEmail: extractedDetails.contactEmail,
      contactPhone: extractedDetails.contactPhone,
      address: extractedDetails.address,
      isConfigured: true,
      // Auto-generated solution ID
      solutionId: `auto-${extractedDetails.companyName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`
    };

    createCustomerMutation.mutate(customerData);
  };

  const handleEditFirst = () => {
    setEditMode(true);
    setSelectedAction('edit');
  };

  const handleSaveAndCreate = () => {
    if (!editedDetails?.companyName?.trim()) {
      toast({
        title: "Validation Error",
        description: "Company name is required.",
        variant: "destructive"
      });
      return;
    }

    const customerData = {
      name: editedDetails.companyName.trim(),
      industry: editedDetails.industry?.trim() || 'Unknown',
      contactEmail: editedDetails.contactEmail?.trim() || null,
      contactPhone: editedDetails.contactPhone?.trim() || null,
      address: editedDetails.address?.trim() || null,
      isConfigured: true,
      solutionId: `edited-${editedDetails.companyName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`
    };

    createCustomerMutation.mutate(customerData);
  };

  const handleDemoMode = () => {
    onDemoMode();
    onClose();
  };

  const getConfidenceBadgeVariant = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'default';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'text-green-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-orange-600';
      default: return 'text-gray-600';
    }
  };

  if (!extractedDetails) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="modal-auto-customer-detection">
        <DialogHeader>
          <div className="flex items-center space-x-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <DialogTitle>Customer Not Found!</DialogTitle>
          </div>
          <DialogDescription>
            I detected company details from your document: <strong>{fileName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Extracted Information Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Detected Company Information</CardTitle>
                <Badge 
                  variant={getConfidenceBadgeVariant(extractedDetails.confidence)}
                  className={getConfidenceColor(extractedDetails.confidence)}
                >
                  {extractedDetails.confidence} confidence
                </Badge>
              </div>
              <CardDescription>
                Information extracted from the uploaded document
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Company Name */}
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-sm font-medium">Company</Label>
                  </div>
                  <p className="text-sm bg-muted p-2 rounded">
                    {extractedDetails.companyName || 'Not detected'}
                  </p>
                </div>

                {/* Industry */}
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-sm font-medium">Industry</Label>
                  </div>
                  <p className="text-sm bg-muted p-2 rounded">
                    {extractedDetails.industry || 'Not detected'}
                  </p>
                </div>

                {/* Contract Type */}
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-sm font-medium">Contract Type</Label>
                  </div>
                  <p className="text-sm bg-muted p-2 rounded">
                    {extractedDetails.contractType || 'Not detected'}
                  </p>
                </div>

                {/* Contact Email */}
                {extractedDetails.contactEmail && (
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <Label className="text-sm font-medium">Email</Label>
                    </div>
                    <p className="text-sm bg-muted p-2 rounded">
                      {extractedDetails.contactEmail}
                    </p>
                  </div>
                )}

                {/* Contact Phone */}
                {extractedDetails.contactPhone && (
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <Label className="text-sm font-medium">Phone</Label>
                    </div>
                    <p className="text-sm bg-muted p-2 rounded">
                      {extractedDetails.contactPhone}
                    </p>
                  </div>
                )}

                {/* Address */}
                {extractedDetails.address && (
                  <div className="space-y-1 md:col-span-2">
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <Label className="text-sm font-medium">Address</Label>
                    </div>
                    <p className="text-sm bg-muted p-2 rounded">
                      {extractedDetails.address}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Edit Mode Form */}
          {editMode && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Edit Company Information</CardTitle>
                <CardDescription>
                  Review and modify the detected information before creating the customer
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-company">Company Name *</Label>
                    <Input
                      id="edit-company"
                      value={editedDetails?.companyName || ''}
                      onChange={(e) => setEditedDetails(prev => prev ? {...prev, companyName: e.target.value} : null)}
                      placeholder="Enter company name"
                      data-testid="input-edit-company"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-industry">Industry</Label>
                    <Input
                      id="edit-industry"
                      value={editedDetails?.industry || ''}
                      onChange={(e) => setEditedDetails(prev => prev ? {...prev, industry: e.target.value} : null)}
                      placeholder="e.g., Technology, Healthcare"
                      data-testid="input-edit-industry"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-email">Contact Email</Label>
                    <Input
                      id="edit-email"
                      type="email"
                      value={editedDetails?.contactEmail || ''}
                      onChange={(e) => setEditedDetails(prev => prev ? {...prev, contactEmail: e.target.value} : null)}
                      placeholder="contact@company.com"
                      data-testid="input-edit-email"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-phone">Contact Phone</Label>
                    <Input
                      id="edit-phone"
                      value={editedDetails?.contactPhone || ''}
                      onChange={(e) => setEditedDetails(prev => prev ? {...prev, contactPhone: e.target.value} : null)}
                      placeholder="+1 (555) 123-4567"
                      data-testid="input-edit-phone"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="edit-address">Address</Label>
                    <Input
                      id="edit-address"
                      value={editedDetails?.address || ''}
                      onChange={(e) => setEditedDetails(prev => prev ? {...prev, address: e.target.value} : null)}
                      placeholder="Company address"
                      data-testid="input-edit-address"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Options */}
          {!editMode && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">What would you like me to do?</h3>
              
              <div className="grid gap-4">
                {/* Auto-create Option */}
                <Card 
                  className={`cursor-pointer transition-colors hover-elevate ${
                    selectedAction === 'auto' ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setSelectedAction('auto')}
                  data-testid="card-auto-create"
                >
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <div>
                        <h4 className="font-medium">Create customer entry and continue generating test cases</h4>
                        <p className="text-sm text-muted-foreground">
                          Automatically create the customer and proceed with test case generation
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Edit First Option */}
                <Card 
                  className={`cursor-pointer transition-colors hover-elevate ${
                    selectedAction === 'edit' ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setSelectedAction('edit')}
                  data-testid="card-edit-first"
                >
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <Edit3 className="h-5 w-5 text-blue-600" />
                      <div>
                        <h4 className="font-medium">Let you edit these details first</h4>
                        <p className="text-sm text-muted-foreground">
                          Review and modify the detected information before creating
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Demo Mode Option */}
                <Card 
                  className={`cursor-pointer transition-colors hover-elevate ${
                    selectedAction === 'demo' ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setSelectedAction('demo')}
                  data-testid="card-demo-mode"
                >
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <Eye className="h-5 w-5 text-purple-600" />
                      <div>
                        <h4 className="font-medium">Continue with demo (test cases for review only)</h4>
                        <p className="text-sm text-muted-foreground">
                          Generate test cases without creating a customer (demo mode)
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Confidence Warning */}
          {extractedDetails.confidence === 'low' && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Low confidence detection:</strong> The extracted information may be incomplete or inaccurate. 
                Consider reviewing the details before auto-creating a customer.
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={onClose}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            
            <div className="flex items-center space-x-3">
              {editMode ? (
                <>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setEditMode(false);
                      setSelectedAction(null);
                      setEditedDetails(extractedDetails);
                    }}
                    data-testid="button-back"
                  >
                    Back
                  </Button>
                  <Button 
                    onClick={handleSaveAndCreate}
                    disabled={createCustomerMutation.isPending}
                    data-testid="button-save-create"
                  >
                    {createCustomerMutation.isPending ? 'Creating...' : 'Save & Create Customer'}
                  </Button>
                </>
              ) : (
                <>
                  {selectedAction === 'auto' && (
                    <Button 
                      onClick={handleAutoCreate}
                      disabled={createCustomerMutation.isPending || !extractedDetails.companyName}
                      data-testid="button-auto-create"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      {createCustomerMutation.isPending ? 'Creating...' : 'Create Customer'}
                    </Button>
                  )}
                  
                  {selectedAction === 'edit' && (
                    <Button onClick={handleEditFirst} data-testid="button-edit-details">
                      <Edit3 className="h-4 w-4 mr-2" />
                      Edit Details
                    </Button>
                  )}
                  
                  {selectedAction === 'demo' && (
                    <Button onClick={handleDemoMode} variant="secondary" data-testid="button-demo-mode">
                      <Eye className="h-4 w-4 mr-2" />
                      Continue Demo
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}