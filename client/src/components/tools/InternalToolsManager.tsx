import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  CheckCircle, 
  AlertCircle, 
  Activity, 
  ExternalLink, 
  Settings, 
  FileText, 
  Filter,
  Search,
  Shield,
  Navigation,
  FileCheck
} from "lucide-react";

// Internal custom systems //todo: integrate with actual system APIs
const internalSystems = [
  {
    id: 'pmap',
    name: 'PMAP',
    fullName: 'Policy Management and Assessment Platform',
    description: 'Comprehensive platform for managing policies, procedures, and compliance requirements across all customer environments',
    status: 'active',
    lastUsed: '2024-09-12T05:30:00Z',
    usageCount: 324,
    category: 'policy',
    endpoint: 'https://pmap.internal.company.com',
    version: '2.4.1',
    capabilities: [
      'Policy document management',
      'Compliance tracking', 
      'Risk assessment',
      'Audit trail generation'
    ],
    icon: Shield
  },
  {
    id: 'navigator',
    name: 'Navigator',
    fullName: 'System Navigation and Integration Hub',
    description: 'Centralized navigation system that provides unified access to all internal tools and customer-specific configurations',
    status: 'active',
    lastUsed: '2024-09-12T06:15:00Z',
    usageCount: 198,
    category: 'navigation',
    endpoint: 'https://navigator.internal.company.com',
    version: '3.1.0',
    capabilities: [
      'Unified system access',
      'Customer environment routing',
      'Permission management',
      'Activity monitoring'
    ],
    icon: Navigation
  },
  {
    id: 'validator',
    name: 'Validator',
    fullName: 'Document and Data Validation Engine',
    description: 'Advanced validation engine that ensures data integrity, format compliance, and business rule adherence across all systems',
    status: 'active',
    lastUsed: '2024-09-12T05:45:00Z',
    usageCount: 456,
    category: 'validation',
    endpoint: 'https://validator.internal.company.com',
    version: '1.8.2',
    capabilities: [
      'Document format validation',
      'Business rule checking',
      'Data integrity verification',
      'Compliance validation'
    ],
    icon: FileCheck
  }
];

const categories = ['All Categories', 'policy', 'navigation', 'validation'];
const statuses = ['All Statuses', 'active', 'maintenance', 'inactive'];

export default function InternalToolsManager() {
  const [tools, setTools] = useState(internalSystems);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [selectedStatus, setSelectedStatus] = useState('All Statuses');

  const filteredTools = tools.filter(tool => {
    const matchesSearch = tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         tool.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         tool.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All Categories' || tool.category === selectedCategory;
    const matchesStatus = selectedStatus === 'All Statuses' || tool.status === selectedStatus;
    
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'maintenance':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case 'inactive':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: { [key: string]: string } = {
      'active': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'maintenance': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      'inactive': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    };
    
    return (
      <Badge variant="secondary" className={colors[status]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  return (
    <div className="space-y-6" data-testid="internal-tools-manager">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Internal Tools</h1>
          <p className="text-muted-foreground">Access and manage internal custom systems: PMAP, Navigator, and Validator</p>
        </div>
        <Badge variant="secondary">
          {tools.filter(t => t.status === 'active').length} systems online
        </Badge>
      </div>

      {/* System Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Systems</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-active-systems">
              {tools.filter(t => t.status === 'active').length}
            </div>
            <p className="text-xs text-muted-foreground">internal systems online</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Operations</CardTitle>
            <Activity className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-operations">
              {tools.reduce((acc, tool) => acc + tool.usageCount, 0)}
            </div>
            <p className="text-xs text-muted-foreground">processed today</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Reliability</CardTitle>
            <AlertCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="stat-system-reliability">
              99.2%
            </div>
            <p className="text-xs text-muted-foreground">uptime this quarter</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Filter Systems</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search systems..."
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
          </div>
          
          <div className="flex items-center justify-between mt-4">
            <span className="text-sm text-muted-foreground">
              Showing {filteredTools.length} of {tools.length} systems
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('All Categories');
                setSelectedStatus('All Statuses');
              }}
              data-testid="button-clear-filters"
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Internal Systems List */}
      <Card>
        <CardHeader>
          <CardTitle>Internal Systems</CardTitle>
          <CardDescription>Access and monitor core internal systems: PMAP, Navigator, and Validator</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {filteredTools.map((tool) => {
              const IconComponent = tool.icon;
              return (
                <div key={tool.id} className="border rounded-lg p-6 hover-elevate">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start space-x-4 flex-1">
                      <div className="bg-primary/10 p-3 rounded-lg">
                        <IconComponent className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <Badge variant="outline" className="text-xs capitalize">
                            {tool.category}
                          </Badge>
                          {getStatusBadge(tool.status)}
                          <span className="text-xs text-muted-foreground">
                            v{tool.version}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {tool.usageCount} operations
                          </span>
                        </div>
                        <h3 className="font-semibold text-xl mb-1">{tool.name}</h3>
                        <p className="text-sm font-medium text-muted-foreground mb-1">{tool.fullName}</p>
                        <p className="text-sm text-muted-foreground mb-3">{tool.description}</p>
                        
                        <div className="mb-4">
                          <p className="text-xs font-medium text-muted-foreground mb-2">Key Capabilities:</p>
                          <div className="flex flex-wrap gap-1">
                            {tool.capabilities.map((capability, index) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {capability}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(tool.status)}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Button 
                        size="sm" 
                        onClick={() => {
                          console.log(`Accessing ${tool.name} at ${tool.endpoint}`);
                          // In a real implementation, this would open the system
                          alert(`Opening ${tool.fullName}\\nEndpoint: ${tool.endpoint}`);
                        }}
                        data-testid={`button-access-${tool.id}`}
                      >
                        <ExternalLink className="mr-2 h-3 w-3" />
                        Access {tool.name}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          console.log(`Configuring ${tool.name}`);
                          alert(`Configuration panel for ${tool.fullName} will be available in the next version.`);
                        }}
                        data-testid={`button-config-${tool.id}`}
                      >
                        <Settings className="mr-2 h-3 w-3" />
                        Configure
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          console.log(`Viewing logs for ${tool.name}`);
                          alert(`System logs for ${tool.fullName}:\\n\\n✓ All services operational\\n✓ Last health check: ${new Date(tool.lastUsed).toLocaleString()}\\n✓ No errors in the last 24 hours`);
                        }}
                        data-testid={`button-logs-${tool.id}`}
                      >
                        <FileText className="mr-2 h-3 w-3" />
                        System Logs
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Last used: {new Date(tool.lastUsed).toLocaleString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}