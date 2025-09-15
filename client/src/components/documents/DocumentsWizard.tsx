import { useState } from 'react';
import { Check, FileText, Bot, FileSpreadsheet, CheckCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import type { Document, ProcessingJob, TestCase } from '@shared/schema';

// Wizard Step Types
export type WizardStep = 'upload' | 'processing' | 'manual' | 'review';

export interface WizardState {
  currentStep: WizardStep;
  uploadedDocuments: Document[];
  processingJobs: ProcessingJob[];
  manualTestCases: TestCase[];
  allTestCases: TestCase[];
  selectedTestCases: string[];
  customer: {
    id?: string;
    name?: string;
    industry?: string;
    solutionId?: string;
  };
}

interface DocumentsWizardProps {
  onComplete: (data: WizardState) => void;
  onCancel: () => void;
}

const WIZARD_STEPS = [
  {
    id: 'upload' as const,
    title: 'Upload Documents',
    description: 'Upload your business documents (5 files max, 20MB each)',
    icon: FileText,
    stepNumber: 1
  },
  {
    id: 'processing' as const,
    title: 'AI Processing',
    description: 'Generate 80-120 test cases using AI analysis',
    icon: Bot,
    stepNumber: 2
  },
  {
    id: 'manual' as const,
    title: 'Manual Addition',
    description: 'Add custom test cases using CSV templates',
    icon: FileSpreadsheet,
    stepNumber: 3
  },
  {
    id: 'review' as const,
    title: 'Review & Submit',
    description: 'Review all test cases and submit for validation',
    icon: CheckCircle,
    stepNumber: 4
  }
] as const;

export default function DocumentsWizard({ onComplete, onCancel }: DocumentsWizardProps) {
  const [wizardState, setWizardState] = useState<WizardState>({
    currentStep: 'upload',
    uploadedDocuments: [],
    processingJobs: [],
    manualTestCases: [],
    allTestCases: [],
    selectedTestCases: [],
    customer: {}
  });

  const currentStepIndex = WIZARD_STEPS.findIndex(step => step.id === wizardState.currentStep);
  const progressPercentage = ((currentStepIndex + 1) / WIZARD_STEPS.length) * 100;

  const handleStepComplete = (stepData: Partial<WizardState>) => {
    setWizardState(prev => ({ ...prev, ...stepData }));
  };

  const goToStep = (stepId: WizardStep) => {
    setWizardState(prev => ({ ...prev, currentStep: stepId }));
  };

  const goToNextStep = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < WIZARD_STEPS.length) {
      const nextStepId = WIZARD_STEPS[nextIndex].id;
      // Only advance if we can navigate to the next step
      if (canNavigateToStep(nextStepId)) {
        setWizardState(prev => ({ ...prev, currentStep: nextStepId }));
      }
    }
  };

  const goToPreviousStep = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setWizardState(prev => ({ ...prev, currentStep: WIZARD_STEPS[prevIndex].id }));
    }
  };

  const canNavigateToStep = (stepId: WizardStep): boolean => {
    const stepIndex = WIZARD_STEPS.findIndex(step => step.id === stepId);
    
    switch (stepId) {
      case 'upload':
        return true;
      case 'processing':
        return wizardState.uploadedDocuments.length > 0;
      case 'manual':
        return wizardState.processingJobs.some(job => job.status === 'completed');
      case 'review':
        return wizardState.allTestCases.length > 0;
      default:
        return stepIndex <= currentStepIndex;
    }
  };

  const getStepStatus = (stepId: WizardStep) => {
    const stepIndex = WIZARD_STEPS.findIndex(step => step.id === stepId);
    
    if (stepIndex < currentStepIndex) {
      return 'completed';
    } else if (stepIndex === currentStepIndex) {
      return 'current';
    } else if (canNavigateToStep(stepId)) {
      return 'available';
    } else {
      return 'locked';
    }
  };

  const renderStepContent = () => {
    switch (wizardState.currentStep) {
      case 'upload':
        return (
          <div className="space-y-6">
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                <FileText className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Upload Your Documents</h3>
              <p className="text-muted-foreground mb-6">
                Upload up to 5 business documents (PDF, DOC, DOCX, TXT) - 20MB max per file
              </p>
            </div>
            
            {/* TODO: UploadStep component will go here */}
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Upload component will be implemented in next step
              </p>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={onCancel} data-testid="button-cancel">
                Cancel
              </Button>
              <Button 
                onClick={goToNextStep} 
                disabled={!canNavigateToStep('processing')}
                data-testid="button-next-upload"
              >
                Start Processing
              </Button>
            </div>
          </div>
        );
      
      case 'processing':
        return (
          <div className="space-y-6">
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-chart-3/10 flex items-center justify-center">
                <Bot className="w-8 h-8 text-chart-3 animate-pulse" />
              </div>
              <h3 className="text-xl font-semibold mb-2">AI Test Case Generation</h3>
              <p className="text-muted-foreground mb-6">
                Our AI is analyzing your documents and generating 80-120 comprehensive test cases
              </p>
            </div>

            {/* TODO: ProcessingStep component will go here */}
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  Processing component will be implemented in next step
                </p>
                <Progress value={0} className="w-full" />
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={goToPreviousStep} data-testid="button-back-processing">
                Back
              </Button>
              <Button 
                variant="outline" 
                onClick={() => canNavigateToStep('manual') && goToStep('manual')}
                disabled={!canNavigateToStep('manual')}
                data-testid="button-skip-to-manual"
              >
                Skip to Manual Addition
              </Button>
            </div>
          </div>
        );

      case 'manual':
        return (
          <div className="space-y-6">
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-chart-2/10 flex items-center justify-center">
                <FileSpreadsheet className="w-8 h-8 text-chart-2" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Add Manual Test Cases</h3>
              <p className="text-muted-foreground mb-6">
                Download our CSV template and add your own custom test cases
              </p>
            </div>

            {/* TODO: ManualCSVStep component will go here */}
            <div className="space-y-4">
              <div className="text-center p-8 border rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Manual CSV component will be implemented in next step
                </p>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={goToPreviousStep} data-testid="button-back-manual">
                Back
              </Button>
              <Button 
                onClick={goToNextStep} 
                disabled={!canNavigateToStep('review')}
                data-testid="button-next-manual"
              >
                Continue to Review
              </Button>
            </div>
          </div>
        );

      case 'review':
        return (
          <div className="space-y-6">
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Review & Submit</h3>
              <p className="text-muted-foreground mb-6">
                Review all generated and manual test cases, then submit for validation
              </p>
            </div>

            {/* TODO: ReviewSubmitStep component will go here */}
            <div className="space-y-4">
              <div className="text-center p-8 border rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Review and submit component will be implemented in next step
                </p>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={goToPreviousStep} data-testid="button-back-review">
                Back
              </Button>
              <Button onClick={() => onComplete(wizardState)} data-testid="button-submit">
                Submit Test Cases
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Wizard Header */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-semibold" data-testid="text-wizard-title">
          AI Test Case Generation Wizard
        </h1>
        <p className="text-muted-foreground">
          Transform your business documents into comprehensive test cases in 4 simple steps
        </p>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Progress</span>
          <span>{Math.round(progressPercentage)}% Complete</span>
        </div>
        <Progress value={progressPercentage} className="h-2" data-testid="progress-wizard" />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="grid grid-cols-1 lg:grid-cols-4 min-h-[600px]">
            {/* Step Navigation Sidebar */}
            <div className="bg-muted/30 p-6 border-r">
              <div className="space-y-1">
                {WIZARD_STEPS.map((step, index) => {
                  const stepStatus = getStepStatus(step.id);
                  const Icon = step.icon;
                  
                  return (
                    <button
                      key={step.id}
                      onClick={() => canNavigateToStep(step.id) && goToStep(step.id)}
                      disabled={!canNavigateToStep(step.id)}
                      className={`w-full text-left p-4 rounded-lg transition-all ${
                        stepStatus === 'current' 
                          ? 'bg-primary text-primary-foreground' 
                          : stepStatus === 'completed'
                          ? 'bg-chart-2/10 text-chart-2 hover-elevate'
                          : stepStatus === 'available'
                          ? 'hover-elevate'
                          : 'opacity-50 cursor-not-allowed'
                      }`}
                      data-testid={`button-step-${step.id}`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                          stepStatus === 'completed' ? 'bg-chart-2 text-background' :
                          stepStatus === 'current' ? 'bg-primary-foreground text-primary' :
                          'bg-background text-muted-foreground'
                        }`}>
                          {stepStatus === 'completed' ? <Check className="w-4 h-4" /> : step.stepNumber}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <Icon className="w-4 h-4 flex-shrink-0" />
                            <span className="font-medium truncate">{step.title}</span>
                          </div>
                          <p className="text-xs opacity-75 leading-relaxed">
                            {step.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step Content */}
            <div className="lg:col-span-3 p-6">
              {renderStepContent()}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}