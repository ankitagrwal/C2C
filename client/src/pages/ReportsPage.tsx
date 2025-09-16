import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Download, FileText, BarChart3, PieChart, TrendingUp, Users } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell, LineChart, Line, AreaChart, Area } from 'recharts';
import { toast } from '@/hooks/use-toast';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// Types for report data
interface ReportData {
  customerId: string;
  customerName: string;
  industry: string;
  documentName: string;
  submissionDate: string;
  testCases: {
    total: number;
    selected: number;
    categories: Record<string, number>;
    priorities: Record<string, number>;
    sources: Record<string, number>;
    averageConfidence: number;
  };
  processingMetrics: {
    totalProcessingTime: number;
    aiGeneratedCount: number;
    manualCount: number;
    uploadedCount: number;
  };
}

// Chart colors
const COLORS = {
  primary: '#3b82f6',
  secondary: '#10b981',
  accent: '#f59e0b',
  destructive: '#ef4444',
  muted: '#6b7280',
  success: '#22c55e'
};

const CHART_COLORS = [COLORS.primary, COLORS.secondary, COLORS.accent, COLORS.destructive, COLORS.success, COLORS.muted];

export default function ReportsPage() {
  const [, setLocation] = useLocation();
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Get URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const submissionId = urlParams.get('submissionId');
  const customerId = urlParams.get('customerId');
  const documentId = urlParams.get('documentId');

  // Fetch report data based on submission parameters
  const { data: reportData, isLoading, error } = useQuery<ReportData>({
    queryKey: ['/api/reports/submission', submissionId || customerId || documentId],
    enabled: !!(submissionId || customerId || documentId),
  });

  // Mock data for demonstration if no real data is available
  const mockReportData: ReportData = {
    customerId: 'mock-customer-id',
    customerName: 'Acme Corporation',
    industry: 'Finance',
    documentName: 'Payment Processing Policy.pdf',
    submissionDate: new Date().toISOString(),
    testCases: {
      total: 25,
      selected: 20,
      categories: {
        'Functional': 8,
        'Compliance': 6,
        'Edge Cases': 4,
        'Integration': 2
      },
      priorities: {
        'High': 7,
        'Medium': 10,
        'Low': 3
      },
      sources: {
        'AI Generated': 15,
        'Manual': 3,
        'Uploaded': 2
      },
      averageConfidence: 0.87
    },
    processingMetrics: {
      totalProcessingTime: 45.2,
      aiGeneratedCount: 15,
      manualCount: 3,
      uploadedCount: 2
    }
  };

  const displayData = reportData || mockReportData;

  // Prepare chart data
  const categoryData = Object.entries(displayData.testCases.categories).map(([name, value]) => ({
    name,
    value,
    percentage: Math.round((value / displayData.testCases.total) * 100)
  }));

  const priorityData = Object.entries(displayData.testCases.priorities).map(([name, value]) => ({
    name,
    value,
    percentage: Math.round((value / displayData.testCases.total) * 100)
  }));

  const sourceData = Object.entries(displayData.testCases.sources).map(([name, value]) => ({
    name,
    value,
    percentage: Math.round((value / displayData.testCases.total) * 100)
  }));

  // Generate confidence trend data (mock for now)
  const confidenceTrendData = [
    { batch: 'Batch 1', confidence: 0.82 },
    { batch: 'Batch 2', confidence: 0.85 },
    { batch: 'Batch 3', confidence: 0.87 },
    { batch: 'Batch 4', confidence: 0.89 },
    { batch: 'Final', confidence: displayData.testCases.averageConfidence }
  ];

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {entry.value}
              {entry.payload.percentage && ` (${entry.payload.percentage}%)`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // PDF Generation
  const generatePDF = async () => {
    setIsGeneratingPDF(true);
    try {
      const reportElement = document.getElementById('report-content');
      if (!reportElement) {
        throw new Error('Report content not found');
      }

      // Create canvas from the report content
      const canvas = await html2canvas(reportElement, {
        scale: 2,
        height: reportElement.scrollHeight,
        width: reportElement.scrollWidth,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });

      // Create PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 295; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;

      let position = 0;

      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Add additional pages if needed
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      // Save the PDF
      const fileName = `Test_Case_Report_${displayData.customerName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);

      toast({
        title: 'PDF Generated Successfully',
        description: `Report downloaded as ${fileName}`,
      });
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({
        title: 'PDF Generation Failed',
        description: 'Unable to generate PDF report. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground">Loading report data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Report Not Available</h2>
        <p className="text-muted-foreground mb-4">Unable to load report data.</p>
        <Button onClick={() => setLocation('/documents')} data-testid="button-back-to-documents">
          Back to Documents
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-report-title">
            Test Case Generation Report
          </h1>
          <p className="text-muted-foreground">
            Comprehensive analysis of test case submission and processing
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={generatePDF}
            disabled={isGeneratingPDF}
            data-testid="button-download-pdf"
            className="flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>{isGeneratingPDF ? 'Generating...' : 'Download PDF'}</span>
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setLocation('/documents')}
            data-testid="button-new-submission"
          >
            New Submission
          </Button>
        </div>
      </div>

      {/* Report Content */}
      <div id="report-content" className="space-y-6">
        {/* Executive Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="w-5 h-5" />
              <span>Executive Summary</span>
            </CardTitle>
            <CardDescription>
              Overview of submission and processing results
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary" data-testid="text-customer-name">
                  {displayData.customerName}
                </div>
                <div className="text-sm text-muted-foreground">Customer</div>
                <Badge variant="secondary" className="mt-1">
                  {displayData.industry}
                </Badge>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary" data-testid="text-total-test-cases">
                  {displayData.testCases.selected}/{displayData.testCases.total}
                </div>
                <div className="text-sm text-muted-foreground">Test Cases Selected</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {Math.round((displayData.testCases.selected / displayData.testCases.total) * 100)}% Coverage
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary" data-testid="text-processing-time">
                  {displayData.processingMetrics.totalProcessingTime}s
                </div>
                <div className="text-sm text-muted-foreground">Processing Time</div>
                <div className="text-xs text-success mt-1">Efficient</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary" data-testid="text-confidence-score">
                  {Math.round(displayData.testCases.averageConfidence * 100)}%
                </div>
                <div className="text-sm text-muted-foreground">Avg Confidence</div>
                <div className="text-xs text-success mt-1">High Quality</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Test Case Categories */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <PieChart className="w-5 h-5" />
                <span>Test Case Categories</span>
              </CardTitle>
              <CardDescription>
                Distribution of test cases by category type
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <RechartsPieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percentage }: { name: string; percentage: number }) => `${name} (${percentage}%)`}
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                </RechartsPieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Priority Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="w-5 h-5" />
                <span>Priority Distribution</span>
              </CardTitle>
              <CardDescription>
                Test case breakdown by priority level
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={priorityData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" fill={COLORS.primary} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Source Analysis */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="w-5 h-5" />
                <span>Source Analysis</span>
              </CardTitle>
              <CardDescription>
                Test case generation sources breakdown
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={sourceData} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={80} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" fill={COLORS.secondary} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Confidence Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="w-5 h-5" />
                <span>AI Confidence Trend</span>
              </CardTitle>
              <CardDescription>
                Quality improvement during processing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={confidenceTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="batch" />
                  <YAxis domain={[0.7, 1]} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area 
                    type="monotone" 
                    dataKey="confidence" 
                    stroke={COLORS.accent} 
                    fill={COLORS.accent} 
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Document Details */}
        <Card>
          <CardHeader>
            <CardTitle>Submission Details</CardTitle>
            <CardDescription>
              Complete information about this test case submission
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Document Name</label>
                  <p className="text-sm" data-testid="text-document-name">{displayData.documentName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Submission Date</label>
                  <p className="text-sm" data-testid="text-submission-date">
                    {new Date(displayData.submissionDate).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Customer Industry</label>
                  <p className="text-sm" data-testid="text-customer-industry">{displayData.industry}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">AI Generated Test Cases</label>
                  <p className="text-sm" data-testid="text-ai-generated">{displayData.processingMetrics.aiGeneratedCount}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Manual Test Cases</label>
                  <p className="text-sm" data-testid="text-manual-cases">{displayData.processingMetrics.manualCount}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Uploaded Test Cases</label>
                  <p className="text-sm" data-testid="text-uploaded-cases">{displayData.processingMetrics.uploadedCount}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}