import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  FileText,
  TestTube2,
  Users,
  Zap,
  TrendingUp,
  CheckCircle,
  Clock,
  AlertCircle,
  Building2
} from "lucide-react";

// Mock data for dashboard metrics //todo: remove mock functionality
const mockMetrics = {
  totalDocuments: 47,
  totalTestCases: 1284,
  activeCustomers: 12,
  processingJobs: 3,
  completionRate: 92,
  recentActivity: [
    {
      id: 1,
      type: 'document_processed',
      title: 'Software License Agreement 2024.pdf',
      customer: 'TechCorp Inc',
      timestamp: '2 minutes ago',
      status: 'completed'
    },
    {
      id: 2,
      type: 'test_cases_generated',
      title: '18 test cases generated',
      customer: 'FinanceGroup LLC',
      timestamp: '15 minutes ago',
      status: 'completed'
    },
    {
      id: 3,
      type: 'customer_configured',
      title: 'Healthcare Partners configured',
      customer: 'Healthcare Partners',
      timestamp: '1 hour ago',
      status: 'completed'
    }
  ],
  testCategoryBreakdown: [
    { category: 'Functional Tests', count: 487, percentage: 38 },
    { category: 'Compliance Tests', count: 359, percentage: 28 },
    { category: 'Integration Tests', count: 244, percentage: 19 },
    { category: 'Edge Cases', count: 194, percentage: 15 }
  ]
};

export default function DashboardOverview() {
  return (
    <div className="space-y-6" data-testid="dashboard-overview">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Dashboard</h1>
          <p className="text-muted-foreground">AI Test Case Generation Platform Overview</p>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="metric-documents">{mockMetrics.totalDocuments}</div>
            <p className="text-xs text-muted-foreground">
              <TrendingUp className="inline h-3 w-3 mr-1" />
              +12% from last month
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Test Cases Generated</CardTitle>
            <TestTube2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="metric-testcases">{mockMetrics.totalTestCases.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              <TrendingUp className="inline h-3 w-3 mr-1" />
              +24% from last month
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="metric-customers">{mockMetrics.activeCustomers}</div>
            <p className="text-xs text-muted-foreground">
              <TrendingUp className="inline h-3 w-3 mr-1" />
              +3 new this month
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processing Jobs</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="metric-processing">{mockMetrics.processingJobs}</div>
            <p className="text-xs text-muted-foreground">
              <Clock className="inline h-3 w-3 mr-1" />
              Currently active
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity & Test Case Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest platform operations and processing</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockMetrics.recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between border-b pb-3 last:border-b-0">
                  <div className="flex items-center space-x-3">
                    <div className="bg-primary/10 p-2 rounded-full">
                      <CheckCircle className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{activity.title}</p>
                      <p className="text-xs text-muted-foreground">{activity.customer}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="secondary" className="text-xs">
                      {activity.status}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">{activity.timestamp}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Test Case Categories */}
        <Card>
          <CardHeader>
            <CardTitle>Test Case Categories</CardTitle>
            <CardDescription>Distribution of generated test cases by type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockMetrics.testCategoryBreakdown.map((category) => (
                <div key={category.category} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{category.category}</span>
                    <span className="text-sm text-muted-foreground">{category.count} tests</span>
                  </div>
                  <Progress value={category.percentage} className="h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
          <CardDescription>Current platform health and performance metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="bg-green-100 dark:bg-green-900/20 p-4 rounded-lg mb-2">
                <CheckCircle className="h-8 w-8 text-green-600 mx-auto" />
              </div>
              <h3 className="font-medium">AI Processing</h3>
              <p className="text-sm text-muted-foreground">All systems operational</p>
            </div>
            
            <div className="text-center">
              <div className="bg-blue-100 dark:bg-blue-900/20 p-4 rounded-lg mb-2">
                <Zap className="h-8 w-8 text-blue-600 mx-auto" />
              </div>
              <h3 className="font-medium">RAG Pipeline</h3>
              <p className="text-sm text-muted-foreground">Processing normally</p>
            </div>
            
            <div className="text-center">
              <div className="bg-yellow-100 dark:bg-yellow-900/20 p-4 rounded-lg mb-2">
                <AlertCircle className="h-8 w-8 text-yellow-600 mx-auto" />
              </div>
              <h3 className="font-medium">Completion Rate</h3>
              <p className="text-sm text-muted-foreground">{mockMetrics.completionRate}% success rate</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}