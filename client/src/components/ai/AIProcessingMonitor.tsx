import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertCircle, CheckCircle, Clock, XCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ProcessingJob {
  id: string;
  documentId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  jobType: string;
  progress: number;
  result?: any;
  createdAt: string;
  completedAt?: string;
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'completed':
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-600" />;
    case 'processing':
      return <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />;
    case 'pending':
      return <Clock className="h-4 w-4 text-yellow-600" />;
    default:
      return <AlertCircle className="h-4 w-4 text-gray-600" />;
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'completed':
      return <Badge variant="default" className="bg-green-600">Completed</Badge>;
    case 'failed':
      return <Badge variant="destructive">Failed</Badge>;
    case 'processing':
      return <Badge variant="secondary">Processing</Badge>;
    case 'pending':
      return <Badge variant="outline">Pending</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function JobErrorDialog({ job }: { job: ProcessingJob }) {
  if (job.status !== 'failed' || !job.result?.error) {
    return null;
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid={`button-view-error-${job.id}`}>
          <AlertCircle className="h-4 w-4 mr-2" />
          View Error
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Processing Job Error</DialogTitle>
          <DialogDescription>
            Error details for job {job.id}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-96">
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Error Message:</h4>
              <div className="bg-muted p-3 rounded-md">
                <code className="text-sm">{job.result.error}</code>
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-2">Job Details:</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>Job ID: {job.id}</div>
                <div>Document ID: {job.documentId}</div>
                <div>Job Type: {job.jobType}</div>
                <div>Created: {new Date(job.createdAt).toLocaleString()}</div>
                {job.completedAt && (
                  <div>Failed At: {new Date(job.completedAt).toLocaleString()}</div>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export default function AIProcessingMonitor() {
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: jobs, isLoading, error, refetch } = useQuery({
    queryKey: ['processing-jobs', refreshKey],
    queryFn: async () => {
      const response = await fetch('/api/processing-jobs');
      if (!response.ok) {
        throw new Error('Failed to fetch processing jobs');
      }
      return response.json();
    },
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    refetch();
  };

  const runningJobs = jobs?.filter((job: ProcessingJob) => 
    job.status === 'processing' || job.status === 'pending'
  )?.length || 0;

  const failedJobs = jobs?.filter((job: ProcessingJob) => 
    job.status === 'failed'
  )?.length || 0;

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="ml-3 text-muted-foreground">Loading processing jobs...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Failed to Load Jobs</h3>
              <p className="text-muted-foreground mb-4">
                {error instanceof Error ? error.message : 'Unknown error occurred'}
              </p>
              <Button onClick={handleRefresh} data-testid="button-retry-load">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI Processing Monitor</h1>
          <p className="text-muted-foreground">
            Monitor AI document processing jobs and diagnose errors
          </p>
        </div>
        <Button onClick={handleRefresh} variant="outline" data-testid="button-refresh-jobs">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-jobs">
              {jobs?.length || 0}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600" data-testid="stat-active-jobs">
              {runningJobs}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Jobs</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="stat-failed-jobs">
              {failedJobs}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Jobs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Processing Jobs</CardTitle>
          <CardDescription>
            Recent AI processing jobs and their statuses
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!jobs || jobs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No processing jobs found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job ID</TableHead>
                  <TableHead>Document ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job: ProcessingJob) => (
                  <TableRow key={job.id} data-testid={`row-job-${job.id}`}>
                    <TableCell className="font-mono text-xs">
                      {job.id.substring(0, 8)}...
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {job.documentId.substring(0, 8)}...
                    </TableCell>
                    <TableCell>{job.jobType}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(job.status)}
                        {getStatusBadge(job.status)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">{job.progress}%</span>
                    </TableCell>
                    <TableCell className="text-xs">
                      {new Date(job.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {job.status === 'failed' && (
                        <JobErrorDialog job={job} />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}