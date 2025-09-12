import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertCircle, CheckCircle, Settings, Plug, Plus, Edit } from "lucide-react";

// Mock internal tools data //todo: remove mock functionality
const mockInternalTools = [
  {
    id: 'salesforce-crm',
    name: 'Salesforce CRM',
    toolType: 'crm',
    apiEndpoint: 'https://mock-sf-api.com/v1',
    authType: 'oauth',
    isActive: true,
    status: 'connected',
    customersCount: 8,
    lastSync: '2024-09-10T10:00:00Z',
    configFields: {
      client_id: 'mock_sf_client_id',
      instance_url: 'https://company.salesforce.com'
    }
  },
  {
    id: 'sap-erp',
    name: 'SAP Enterprise',
    toolType: 'erp',
    apiEndpoint: 'https://mock-sap-api.com/v2',
    authType: 'api_key',
    isActive: true,
    status: 'connected',
    customersCount: 5,
    lastSync: '2024-09-10T11:15:00Z',
    configFields: {
      environment: 'production',
      region: 'us-east-1'
    }
  },
  {
    id: 'custom-portal',
    name: 'Internal HR Portal',
    toolType: 'custom',
    apiEndpoint: 'https://mock-hr-portal.com/api',
    authType: 'basic_auth',
    isActive: false,
    status: 'disconnected',
    customersCount: 2,
    lastSync: '2024-09-08T08:45:00Z',
    configFields: {
      username: 'admin_user',
      department_code: 'HR_001'
    }
  }
];

interface ConfigureToolDialogProps {
  tool: typeof mockInternalTools[0];
  onSave: (toolId: string, config: any) => void;
}

function ConfigureToolDialog({ tool, onSave }: ConfigureToolDialogProps) {
  const [config, setConfig] = useState(tool.configFields);

  const handleSave = () => {
    console.log(`Configuring tool ${tool.name}:`, config);
    onSave(tool.id, config);
  };

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Configure {tool.name}</DialogTitle>
        <DialogDescription>
          Update connection settings for {tool.toolType.toUpperCase()} integration
        </DialogDescription>
      </DialogHeader>
      
      <div className="space-y-4">
        <div>
          <Label htmlFor="endpoint">API Endpoint</Label>
          <Input
            id="endpoint"
            value={tool.apiEndpoint}
            readOnly
            className="bg-muted"
            data-testid="input-endpoint"
          />
        </div>
        
        <div>
          <Label htmlFor="auth-type">Authentication Type</Label>
          <Select value={tool.authType} disabled>
            <SelectTrigger data-testid="select-auth-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="oauth">OAuth 2.0</SelectItem>
              <SelectItem value="api_key">API Key</SelectItem>
              <SelectItem value="basic_auth">Basic Auth</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {Object.entries(config).map(([key, value]) => (
          <div key={key}>
            <Label htmlFor={key} className="capitalize">
              {key.replace('_', ' ')}
            </Label>
            <Input
              id={key}
              value={value as string}
              onChange={(e) => setConfig(prev => ({ ...prev, [key]: e.target.value }))}
              type={key.includes('password') || key.includes('secret') ? 'password' : 'text'}
              data-testid={`input-${key}`}
            />
          </div>
        ))}
        
        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={() => console.log('Test connection')}>Test Connection</Button>
          <Button onClick={handleSave} data-testid="button-save-config">Save Configuration</Button>
        </div>
      </div>
    </DialogContent>
  );
}

export default function InternalToolsManager() {
  const [tools, setTools] = useState(mockInternalTools);

  const handleConfigureTool = (toolId: string, config: any) => {
    console.log('Tool configured:', toolId, config);
    setTools(prev => prev.map(tool => 
      tool.id === toolId 
        ? { ...tool, configFields: config, status: 'connected', isActive: true }
        : tool
    ));
  };

  const toggleToolStatus = (toolId: string) => {
    setTools(prev => prev.map(tool => 
      tool.id === toolId 
        ? { ...tool, isActive: !tool.isActive, status: tool.isActive ? 'disconnected' : 'connected' }
        : tool
    ));
    console.log('Tool status toggled:', toolId);
  };

  const getStatusIcon = (status: string) => {
    return status === 'connected' 
      ? <CheckCircle className="h-4 w-4 text-green-600" />
      : <AlertCircle className="h-4 w-4 text-red-600" />;
  };

  const getStatusBadge = (tool: typeof mockInternalTools[0]) => {
    if (tool.status === 'connected' && tool.isActive) {
      return <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Connected</Badge>;
    }
    return <Badge variant="secondary">Disconnected</Badge>;
  };

  return (
    <div className="space-y-6" data-testid="internal-tools-manager">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Internal Tools</h1>
          <p className="text-muted-foreground">Configure integrations with CRM, ERP, and custom systems</p>
        </div>
        <Button variant="outline" data-testid="button-add-tool">
          <Plus className="mr-2 h-4 w-4" />
          Add Integration
        </Button>
      </div>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tools.map((tool) => (
          <Card key={tool.id} className="hover-elevate">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="bg-primary/10 p-2 rounded-lg">
                    <Plug className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{tool.name}</CardTitle>
                    <CardDescription className="uppercase text-xs font-medium">
                      {tool.toolType}
                    </CardDescription>
                  </div>
                </div>
                {getStatusIcon(tool.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                {getStatusBadge(tool)}
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Customers</span>
                <span className="font-medium" data-testid={`customer-count-${tool.id}`}>
                  {tool.customersCount}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Auth Type</span>
                <Badge variant="outline" className="text-xs">
                  {tool.authType.replace('_', ' ')}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Last Sync</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(tool.lastSync).toLocaleDateString()}
                </span>
              </div>
              
              <div className="flex space-x-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="flex-1" data-testid={`button-configure-${tool.id}`}>
                      <Settings className="mr-2 h-3 w-3" />
                      Configure
                    </Button>
                  </DialogTrigger>
                  <ConfigureToolDialog tool={tool} onSave={handleConfigureTool} />
                </Dialog>
                
                <Button
                  variant={tool.isActive ? "secondary" : "default"}
                  size="sm"
                  className="flex-1"
                  onClick={() => toggleToolStatus(tool.id)}
                  data-testid={`button-toggle-${tool.id}`}
                >
                  {tool.isActive ? 'Disconnect' : 'Connect'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Integration Summary</CardTitle>
          <CardDescription>Overview of all configured internal tools</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {tools.filter(t => t.isActive).length}
              </div>
              <p className="text-sm text-muted-foreground">Active Integrations</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {tools.reduce((sum, t) => sum + t.customersCount, 0)}
              </div>
              <p className="text-sm text-muted-foreground">Total Customers</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {tools.filter(t => t.status === 'connected').length}/{tools.length}
              </div>
              <p className="text-sm text-muted-foreground">Connection Health</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}