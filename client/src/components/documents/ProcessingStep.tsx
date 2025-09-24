import { useState, useEffect, useCallback } from 'react';
import { Bot, Clock, CheckCircle, AlertCircle, RefreshCw, FileText, Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { Document, ProcessingJob, TestCase } from '@shared/schema';

interface ProcessingStepProps {
  documents: Document[];
  onComplete: (testCases: TestCase[], jobs: ProcessingJob[]) => void;
  onSkip?: () => void; // New prop to handle skipping AI processing
  initialJobs?: ProcessingJob[];
  targetMin?: number;
  targetMax?: number;
  industry?: string;
}

interface JobStatus {
  job: ProcessingJob;
  testCases: TestCase[];
  error?: string;
}

export default function ProcessingStep({ 
  documents,
  onComplete,
  onSkip,
  initialJobs = [],
  targetMin = 80,
  targetMax = 120,
  industry
}: ProcessingStepProps) {
  const [processingJobs, setProcessingJobs] = useState<ProcessingJob[]>(initialJobs);
  const [jobStatuses, setJobStatuses] = useState<{ [jobId: string]: JobStatus }>({});
  const [allTestCases, setAllTestCases] = useState<TestCase[]>([]);
  const [isPolling, setIsPolling] = useState(false);
  // Force aiProvider to always be 'gemini' (no other options available)
  const [aiProvider, setAiProvider] = useState<'gemini'>('gemini');
  const [showSettings, setShowSettings] = useState(false);
  const { toast } = useToast();

  // Start batch processing mutation
  const startProcessingMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/documents/process-batch', {
        documentIds: documents.map(doc => doc.id),
        targetMin,
        targetMax,
        industry,
        aiProvider: 'gemini', // Force to gemini only
        aiModel: 'gemini-2.5-flash'
      });
      return response.json();
    },
    onSuccess: (data) => {
      setProcessingJobs(data.jobs);
      setIsPolling(true);
      toast({
        title: 'Processing Started',
        description: `AI analysis initiated for ${data.totalJobs} documents`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Processing Failed',
        description: error?.message || 'Failed to start processing',
        variant: 'destructive',
      });
    }
  });

  // Individual job status query - pure queryFn that only returns data
  const jobStatusQuery = useQuery({
    queryKey: ['/api/jobs', 'batch-status', processingJobs.map(job => job.id).sort()],
    queryFn: async (): Promise<{ [jobId: string]: JobStatus }> => {
      if (processingJobs.length === 0) return {};

      const statusPromises = processingJobs.map(async (job): Promise<{ [jobId: string]: JobStatus }> => {
        try {
          const response = await apiRequest('GET', `/api/jobs/${job.id}`);
          const updatedJob = await response.json();
          
          // Get test cases for this job if completed
          let testCases: TestCase[] = [];
          if (updatedJob.status === 'completed') {
            try {
              const testCasesResponse = await apiRequest('GET', `/api/test-cases?documentId=${job.documentId}`);
              const testCasesData = await testCasesResponse.json();
              testCases = testCasesData || [];
            } catch (testCaseError) {
              console.warn('Failed to fetch test cases for job:', job.id, testCaseError);
            }
          }

          return {
            [job.id]: {
              job: updatedJob,
              testCases,
              error: undefined
            }
          };
        } catch (error) {
          return {
            [job.id]: {
              job,
              testCases: [],
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          };
        }
      });

      const statusResults = await Promise.all(statusPromises);
      const mergedStatuses: { [jobId: string]: JobStatus } = statusResults.reduce(
        (acc: { [jobId: string]: JobStatus }, result: { [jobId: string]: JobStatus }) => ({ ...acc, ...result }), 
        {} as { [jobId: string]: JobStatus }
      );
      
      return mergedStatuses;
    },
    enabled: isPolling && processingJobs.length > 0,
    refetchInterval: isPolling ? 2000 : false, // Poll every 2 seconds
    refetchOnWindowFocus: false,
  });

  const { refetch: refetchJobStatuses } = jobStatusQuery;

  // Handle side effects when query data changes
  useEffect(() => {
    const queryData = jobStatusQuery.data;
    // Guard the entire effect body instead of early return
    if (queryData && Object.keys(queryData).length > 0) {
      // Update job statuses
      setJobStatuses(queryData);
      
      // Update processing jobs with latest status
      setProcessingJobs(prev => prev.map(job => {
        const status = queryData[job.id];
        return status ? status.job : job;
      }));

      // Aggregate all test cases
      const allTestCases = Object.values(queryData).flatMap(status => status.testCases);
      setAllTestCases(allTestCases);

      // Check if all jobs are completed
      const completedJobs = Object.values(queryData).filter(status => 
        status.job.status === 'completed' || status.job.status === 'failed'
      );

      if (completedJobs.length === processingJobs.length && processingJobs.length > 0) {
        setIsPolling(false);
        const successfulJobs = completedJobs.filter(status => status.job.status === 'completed');
        const totalTestCases = successfulJobs.flatMap(status => status.testCases).length;
        const updatedJobs = processingJobs.map(job => {
          const status = queryData[job.id];
          return status ? status.job : job;
        });
        
        if (successfulJobs.length > 0) {
          toast({
            title: 'Processing Complete',
            description: `Successfully generated ${totalTestCases} test cases from ${successfulJobs.length} documents`,
          });
          onComplete(allTestCases, updatedJobs);
        } else {
          toast({
            title: 'Processing Failed',
            description: 'All processing jobs failed. Please try again.',
            variant: 'destructive',
          });
        }
      }
    }
  }, [jobStatusQuery.data, processingJobs.length, onComplete]); // Fixed: No early return, proper guard block

  // Calculate overall progress
  const calculateOverallProgress = useCallback(() => {
    if (processingJobs.length === 0) return 0;
    
    const totalProgress = processingJobs.reduce((sum, job) => {
      const status = jobStatuses[job.id];
      if (status?.job.status === 'completed') return sum + 100;
      if (status?.job.status === 'failed') return sum + 0;
      return sum + (status?.job.progress || 0);
    }, 0);

    return Math.round(totalProgress / processingJobs.length);
  }, [processingJobs, jobStatuses]);

  const overallProgress = calculateOverallProgress();
  const completedJobs = processingJobs.filter(job => {
    const status = jobStatuses[job.id];
    return status?.job.status === 'completed';
  });
  const failedJobs = processingJobs.filter(job => {
    const status = jobStatuses[job.id];
    return status?.job.status === 'failed';
  });

  // Only enable polling for existing jobs (no auto-start)
  useEffect(() => {
    if (processingJobs.length > 0) {
      // Enable polling for existing jobs (resume scenario)
      const hasIncompleteJobs = processingJobs.some(job => 
        job.status !== 'completed' && job.status !== 'failed'
      );
      if (hasIncompleteJobs) {
        setIsPolling(true);
      }
    }
  }, [processingJobs.length]);

  const hasStarted = processingJobs.length > 0 || startProcessingMutation.isPending;
  const isProcessing = isPolling || startProcessingMutation.isPending;
  const isCompleted = completedJobs.length === processingJobs.length && processingJobs.length > 0;
  const hasFailures = failedJobs.length > 0;

  return (
    <div className="space-y-6">
      {/* Processing Status Overview */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              {isProcessing ? (
                <Bot className="w-5 h-5 text-chart-3 animate-pulse" />
              ) : isCompleted ? (
                <CheckCircle className="w-5 h-5 text-chart-2" />
              ) : (
                <Clock className="w-5 h-5 text-muted-foreground" />
              )}
              <span>AI Test Case Generation</span>
            </CardTitle>
            {!hasStarted && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowSettings(!showSettings)}
                data-testid="button-ai-settings"
              >
                <Settings className="w-4 h-4 mr-1" />
                Settings
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* AI Provider Settings */}
          {!hasStarted && showSettings && (
            <Card className="bg-muted/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">AI Provider Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ai-provider" className="text-sm font-medium">
                    AI Provider
                  </Label>
                  <Select value={aiProvider} onValueChange={(value: 'gemini') => setAiProvider(value)}>
                    <SelectTrigger data-testid="select-ai-provider">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gemini">
                        <div className="flex flex-col">
                          <span>Google Gemini 2.5 Flash</span>
                          <span className="text-xs text-muted-foreground">Latest high-speed model with excellent reasoning</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Using Google Gemini 2.5 Flash for fast and reliable test case generation with automatic customer metadata extraction.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
          
          {!hasStarted ? (
            <div className="text-center py-8">
              <Bot className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">Ready to Process</h3>
              <p className="text-muted-foreground mb-4">
                Click below to start AI analysis of your {documents.length} document{documents.length !== 1 ? 's' : ''}
              </p>
              <div className="flex justify-center space-x-4">
                <Button 
                  onClick={() => startProcessingMutation.mutate()}
                  disabled={startProcessingMutation.isPending}
                  data-testid="button-start-processing"
                >
                  {startProcessingMutation.isPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Bot className="w-4 h-4 mr-2" />
                      Start AI Processing
                    </>
                  )}
                </Button>
                
                {onSkip && (
                  <Button 
                    variant="outline"
                    onClick={onSkip}
                    disabled={startProcessingMutation.isPending}
                    data-testid="button-skip-processing"
                  >
                    Skip AI Processing
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Overall Progress - Hidden as requested */}
              {/* 
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Overall Progress</span>
                  <span className="text-sm text-muted-foreground">
                    {overallProgress}% Complete
                  </span>
                </div>
                <Progress 
                  value={overallProgress} 
                  className="h-3"
                  data-testid="progress-overall"
                />
              </div>
              */}

              {/* Status Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-chart-3">
                    {processingJobs.length}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Jobs</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-chart-2">
                    {completedJobs.length}
                  </div>
                  <div className="text-sm text-muted-foreground">Completed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {allTestCases.length}
                  </div>
                  <div className="text-sm text-muted-foreground">Test Cases Generated</div>
                </div>
              </div>

              {/* Target Range Info */}
              {isProcessing && (
                <Alert>
                  <Bot className="h-4 w-4" />
                  <AlertDescription>
                    AI is targeting {targetMin}-{targetMax} test cases per document
                    {industry && ` with ${industry} industry focus`}.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Individual Job Status */}
      {processingJobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Document Processing Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {processingJobs.map((job) => {
              const document = documents.find(doc => doc.id === job.documentId);
              const status = jobStatuses[job.id];
              const jobProgress = status?.job.progress || 0;
              const jobStatus = status?.job.status || job.status;
              const testCasesCount = status?.testCases.length || 0;
              const errorMessage = status?.error;

              return (
                <div 
                  key={job.id}
                  className="border rounded-lg p-4 space-y-3"
                  data-testid={`job-item-${document?.filename}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      <div>
                        <h4 className="font-medium text-sm">
                          {document?.filename || 'Unknown Document'}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {document?.docType || 'Document'}
                        </p>
                      </div>
                    </div>
                    
                    <Badge 
                      variant={
                        jobStatus === 'completed' ? 'default' :
                        jobStatus === 'failed' ? 'destructive' :
                        jobStatus === 'processing' ? 'secondary' :
                        'outline'
                      }
                      data-testid={`badge-job-status-${document?.filename}`}
                    >
                      {jobStatus === 'completed' && <CheckCircle className="w-3 h-3 mr-1" />}
                      {jobStatus === 'failed' && <AlertCircle className="w-3 h-3 mr-1" />}
                      {jobStatus === 'processing' && <RefreshCw className="w-3 h-3 mr-1 animate-spin" />}
                      
                      {jobStatus === 'completed' ? 'Completed' :
                       jobStatus === 'failed' ? 'Failed' :
                       jobStatus === 'processing' ? 'Processing' :
                       'Pending'}
                    </Badge>
                  </div>

                  {/* Individual job progress bars hidden as requested */}
                  {/* 
                  {jobStatus === 'processing' && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>Progress</span>
                        <span>{jobProgress}%</span>
                      </div>
                      <Progress 
                        value={jobProgress} 
                        className="h-2"
                        data-testid={`progress-job-${document?.filename}`}
                      />
                    </div>
                  )}
                  */}

                  {jobStatus === 'completed' && (
                    <div className="text-sm">
                      <span className="text-chart-2 font-medium">
                        ✓ Generated {testCasesCount} test cases
                      </span>
                    </div>
                  )}

                  {errorMessage && (
                    <div className="text-sm text-destructive">
                      <AlertCircle className="w-4 h-4 inline mr-1" />
                      {errorMessage}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      {hasStarted && (
        <div className="flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            {isProcessing ? 'Processing in progress...' :
             isCompleted ? 'All documents processed successfully' :
             'Processing completed with issues'}
          </div>
          
          <div className="space-x-2">
            {isProcessing && (
              <Button 
                variant="outline" 
                onClick={() => refetchJobStatuses()}
                disabled={startProcessingMutation.isPending}
                data-testid="button-refresh-status"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Status
              </Button>
            )}
            
            {!isProcessing && !isCompleted && (
              <Button 
                onClick={() => startProcessingMutation.mutate()}
                disabled={startProcessingMutation.isPending}
                data-testid="button-retry-processing"
              >
                <Bot className="w-4 h-4 mr-2" />
                Retry Processing
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}