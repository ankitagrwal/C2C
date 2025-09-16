import { useState } from 'react';
import { Check, FileText, Bot, FileSpreadsheet, CheckCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import type { Document, ProcessingJob, TestCase } from '@shared/schema';

// Import step components
import UploadStep from './UploadStep';
import ProcessingStep from './ProcessingStep';
import ManualCSVStep from './ManualCSVStep';
import ReviewSubmitStep from './ReviewSubmitStep';

// Wizard Step Types
export type WizardStep = 'upload' | 'processing' | 'manual' | 'review';

export interface WizardState {
  currentStep: WizardStep;
  uploadedDocuments: Document[];
  processingJobs: ProcessingJob[];
  manualTestCases: TestCase[];
  allTestCases: TestCase[];
  selectedTestCases: string[];
  aiGeneratedCount: number;  // Count from step 2 (AI processing)
  manualCount: number;       // Count from step 3 (manual CSV upload)
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
  const { toast } = useToast();
  const [wizardState, setWizardState] = useState<WizardState>({
    currentStep: 'upload',
    uploadedDocuments: [],
    processingJobs: [],
    manualTestCases: [],
    allTestCases: [],
    aiGeneratedCount: 0,
    manualCount: 0,
    selectedTestCases: [],
    customer: {}
  });

  const currentStepIndex = WIZARD_STEPS.findIndex(step => step.id === wizardState.currentStep);
  const progressPercentage = (currentStepIndex / WIZARD_STEPS.length) * 100;

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
        // Can navigate to manual step if either documents are uploaded OR processing is completed/skipped
        return wizardState.uploadedDocuments.length > 0;
      case 'review':
        // Can navigate to review only if we have test cases from either AI or manual sources
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
          <UploadStep 
            onComplete={(documents) => {
              handleStepComplete({ 
                uploadedDocuments: documents,
                currentStep: 'processing'
              });
            }}
            initialDocuments={wizardState.uploadedDocuments}
            docType="Business Document"
            customerId={wizardState.customer.id || null}
          />
        );
      
      case 'processing':
        return (
          <ProcessingStep 
            documents={wizardState.uploadedDocuments}
            onComplete={(testCases, jobs) => {
              handleStepComplete({
                processingJobs: jobs,
                allTestCases: [...wizardState.manualTestCases, ...testCases],
                aiGeneratedCount: testCases.length,  // Track AI generated count
                currentStep: 'manual'
              });
            }}
            onSkip={() => {
              // Skip AI processing - go directly to manual step with empty AI results
              handleStepComplete({
                processingJobs: [],
                allTestCases: [...wizardState.manualTestCases],
                aiGeneratedCount: 0,
                currentStep: 'manual'
              });
            }}
            initialJobs={wizardState.processingJobs}
            targetMin={80}
            targetMax={120}
            industry={wizardState.customer.industry}
          />
        );

      case 'manual':
        return (
          <ManualCSVStep 
            onComplete={(testCases) => {
              // Treat testCases as the authoritative manual test case list (no duplication)
              const manualIds = new Set(testCases.map(tc => tc.id));
              const processingTestCases = wizardState.allTestCases.filter(tc => 
                tc.source !== 'manual' && !manualIds.has(tc.id)
              );
              const newAllTestCases = [...processingTestCases, ...testCases];
              
              handleStepComplete({
                manualTestCases: testCases,  // Use authoritative list from ManualCSVStep
                allTestCases: newAllTestCases,
                manualCount: testCases.length,  // Track manual count from authoritative list
                currentStep: 'review'
              });
            }}
            onSkip={() => {
              // Skip manual upload - check if we have any test cases before proceeding to review
              const manualIds = new Set(wizardState.manualTestCases.map(tc => tc.id));
              const processingTestCases = wizardState.allTestCases.filter(tc => 
                tc.source !== 'manual' && !manualIds.has(tc.id)
              );
              const newAllTestCases = [...processingTestCases, ...wizardState.manualTestCases];
              
              // Only proceed to review if we have test cases
              if (newAllTestCases.length > 0) {
                handleStepComplete({
                  allTestCases: newAllTestCases,
                  currentStep: 'review'
                });
              } else {
                // Show message and stay on manual step
                toast({
                  title: 'No Test Cases Available',
                  description: 'Please either generate AI test cases or upload manual test cases before proceeding to review.',
                  variant: 'destructive',
                });
              }
            }}
            initialTestCases={wizardState.manualTestCases}
            industry={wizardState.customer.industry || 'General'}
            documentId={wizardState.uploadedDocuments[0]?.id}
          />
        );

      case 'review':
        return (
          <ReviewSubmitStep 
            testCases={wizardState.allTestCases}
            onComplete={() => {
              onComplete(wizardState);
            }}
            initialCustomer={wizardState.customer}
            documentIds={wizardState.uploadedDocuments.map(doc => doc.id)}
            industry={wizardState.customer.industry || 'General'}
            aiGeneratedCount={wizardState.aiGeneratedCount}
            manualCount={wizardState.manualCount}
          />
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

      {/* Enhanced Progress Indicators */}
      <div className="space-y-4">
        {/* Overall Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">Progress</span>
            <span className="text-primary font-medium">{Math.round(progressPercentage)}% Complete</span>
          </div>
          <Progress value={progressPercentage} className="h-3" data-testid="progress-wizard" />
        </div>

        {/* Step Progress Indicators */}
        <div className="flex items-center justify-center space-x-4">
          {WIZARD_STEPS.map((step, index) => {
            const stepStatus = getStepStatus(step.id);
            const Icon = step.icon;
            
            return (
              <div key={step.id} className="flex items-center">
                <div className={`flex flex-col items-center space-y-2 ${
                  stepStatus === 'current' ? 'transform scale-110' : ''
                }`}>
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all ${
                    stepStatus === 'completed' 
                      ? 'bg-chart-2 text-background border-chart-2' 
                      : stepStatus === 'current'
                      ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/25'
                      : stepStatus === 'available'
                      ? 'border-primary/30 text-muted-foreground hover:border-primary/50'
                      : 'border-border text-muted-foreground/50'
                  }`}>
                    {stepStatus === 'completed' ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </div>
                  <span className={`text-xs text-center font-medium ${
                    stepStatus === 'current' ? 'text-primary' :
                    stepStatus === 'completed' ? 'text-chart-2' :
                    'text-muted-foreground'
                  }`}>
                    {step.title}
                  </span>
                </div>
                {index < WIZARD_STEPS.length - 1 && (
                  <div className={`w-16 h-0.5 mx-4 ${
                    index < currentStepIndex ? 'bg-chart-2' : 'bg-border'
                  }`} />
                )}
              </div>
            );
          })}
        </div>
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
                      className={`w-full text-left p-4 rounded-lg transition-all relative ${
                        stepStatus === 'current' 
                          ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25 ring-2 ring-primary/20' 
                          : stepStatus === 'completed'
                          ? 'bg-chart-2/10 text-chart-2 hover-elevate border-l-4 border-chart-2'
                          : stepStatus === 'available'
                          ? 'hover-elevate border border-border'
                          : 'opacity-50 cursor-not-allowed'
                      }`}
                      data-testid={`button-step-${step.id}`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ${
                          stepStatus === 'completed' ? 'bg-chart-2 text-background ring-2 ring-chart-2/30' :
                          stepStatus === 'current' ? 'bg-primary-foreground text-primary ring-2 ring-primary-foreground/30' :
                          'bg-background text-muted-foreground border border-border'
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