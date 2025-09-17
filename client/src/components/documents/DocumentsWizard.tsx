import { useState, useEffect } from "react";
import {
  Check,
  FileText,
  Bot,
  FileSpreadsheet,
  CheckCircle,
  Menu,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import type { Document, ProcessingJob, TestCase } from "@shared/schema";

// Import step components
import UploadStep from "./UploadStep";
import ProcessingStep from "./ProcessingStep";
import ManualCSVStep from "./ManualCSVStep";
import ReviewSubmitStep from "./ReviewSubmitStep";

// Wizard Step Types
export type WizardStep = "upload" | "processing" | "manual" | "review";

export interface WizardState {
  currentStep: WizardStep;
  uploadedDocuments: Document[];
  processingJobs: ProcessingJob[];
  manualTestCases: TestCase[];
  allTestCases: TestCase[];
  selectedTestCases: string[];
  aiGeneratedCount: number; // Count from step 2 (AI processing)
  manualCount: number; // Count from step 3 (manual CSV upload)
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
    id: "upload" as const,
    title: "Upload Documents",
    description: "Upload your business documents (5 files max, 20MB each)",
    icon: FileText,
    stepNumber: 1,
  },
  {
    id: "processing" as const,
    title: "AI Processing",
    description: "Generate test cases using AI analysis",
    icon: Bot,
    stepNumber: 2,
  },
  {
    id: "manual" as const,
    title: "Manual Addition",
    description: "Add custom test cases using CSV templates",
    icon: FileSpreadsheet,
    stepNumber: 3,
  },
  {
    id: "review" as const,
    title: "Review & Submit",
    description: "Review all test cases and submit for validation",
    icon: CheckCircle,
    stepNumber: 4,
  },
] as const;

export default function DocumentsWizard({
  onComplete,
  onCancel,
}: DocumentsWizardProps) {
  const { toast } = useToast();
  const [wizardState, setWizardState] = useState<WizardState>({
    currentStep: "upload",
    uploadedDocuments: [],
    processingJobs: [],
    manualTestCases: [],
    allTestCases: [],
    aiGeneratedCount: 0,
    manualCount: 0,
    selectedTestCases: [],
    customer: {},
  });

  const currentStepIndex = WIZARD_STEPS.findIndex(
    (step) => step.id === wizardState.currentStep,
  );
  const progressPercentage = (currentStepIndex / WIZARD_STEPS.length) * 100;

  // Load existing test cases scoped to current documents when component mounts
  useEffect(() => {
    if (wizardState.uploadedDocuments.length > 0) {
      const loadScopedTestCases = async () => {
        try {
          // Only load test cases for uploaded documents to prevent cross-tenant data exposure
          const documentIds = wizardState.uploadedDocuments.map(
            (doc) => doc.id,
          );
          const promises = documentIds.map((docId) =>
            fetch(`/api/test-cases?documentId=${docId}`).then((res) =>
              res.json(),
            ),
          );

          const results = await Promise.all(promises);
          const existingTestCases = results.flat();

          if (existingTestCases.length > 0) {
            console.log(
              "Found existing test cases for documents:",
              existingTestCases.length,
            );
            // Update wizard state with scoped existing test cases
            setWizardState((prev) => ({
              ...prev,
              allTestCases: existingTestCases,
              aiGeneratedCount: existingTestCases.filter(
                (tc: any) => tc.source === "generated",
              ).length,
              manualCount: existingTestCases.filter(
                (tc: any) => tc.source === "manual",
              ).length,
            }));
          }
        } catch (error) {
          console.error("Failed to load scoped test cases:", error);
        }
      };

      loadScopedTestCases();
    }
  }, [wizardState.uploadedDocuments]);

  const handleStepComplete = (stepData: Partial<WizardState>) => {
    setWizardState((prev) => ({ ...prev, ...stepData }));
  };

  const goToStep = (stepId: WizardStep) => {
    setWizardState((prev) => ({ ...prev, currentStep: stepId }));
  };

  const goToNextStep = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < WIZARD_STEPS.length) {
      const nextStepId = WIZARD_STEPS[nextIndex].id;
      // Only advance if we can navigate to the next step
      if (canNavigateToStep(nextStepId)) {
        setWizardState((prev) => ({ ...prev, currentStep: nextStepId }));
      }
    }
  };

  const goToPreviousStep = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setWizardState((prev) => ({
        ...prev,
        currentStep: WIZARD_STEPS[prevIndex].id,
      }));
    }
  };

  const getCurrentStepNumber = (): number => {
    return (
      WIZARD_STEPS.findIndex((step) => step.id === wizardState.currentStep) + 1
    );
  };

  const canNavigateToStep = (stepId: WizardStep): boolean => {
    const stepIndex = WIZARD_STEPS.findIndex((step) => step.id === stepId);

    switch (stepId) {
      case "upload":
        return true;
      case "processing":
        return wizardState.uploadedDocuments.length > 0;
      case "manual":
        // Can navigate to manual step if either documents are uploaded OR processing is completed/skipped
        return wizardState.uploadedDocuments.length > 0;
      case "review":
        // Can navigate to review only if we have test cases from either AI or manual sources
        return wizardState.allTestCases.length > 0;
      default:
        return stepIndex <= currentStepIndex;
    }
  };

  const getStepStatus = (stepId: WizardStep) => {
    const stepIndex = WIZARD_STEPS.findIndex((step) => step.id === stepId);

    if (stepIndex < currentStepIndex) {
      return "completed";
    } else if (stepIndex === currentStepIndex) {
      return "current";
    } else if (canNavigateToStep(stepId)) {
      return "available";
    } else {
      return "locked";
    }
  };

  const renderStepContent = () => {
    console.log(
      "Rendering step content for:",
      wizardState.currentStep,
      "All test cases:",
      wizardState.allTestCases.length,
    );
    switch (wizardState.currentStep) {
      case "upload":
        return (
          <UploadStep
            onComplete={(documents) => {
              handleStepComplete({
                uploadedDocuments: documents,
                currentStep: "processing",
              });
            }}
            initialDocuments={wizardState.uploadedDocuments}
            docType="Business Document"
            customerId={wizardState.customer.id || null}
          />
        );

      case "processing":
        return (
          <ProcessingStep
            documents={wizardState.uploadedDocuments}
            onComplete={(testCases, jobs) => {
              handleStepComplete({
                processingJobs: jobs,
                allTestCases: [...wizardState.manualTestCases, ...testCases],
                aiGeneratedCount: testCases.length, // Track AI generated count
                currentStep: "manual",
              });
            }}
            onSkip={() => {
              // Skip AI processing - go directly to manual step with empty AI results
              handleStepComplete({
                processingJobs: [],
                allTestCases: [...wizardState.manualTestCases],
                aiGeneratedCount: 0,
                currentStep: "manual",
              });
            }}
            initialJobs={wizardState.processingJobs}
            targetMin={80}
            targetMax={120}
            industry={wizardState.customer.industry}
          />
        );

      case "manual":
        return (
          <ManualCSVStep
            onComplete={(testCases) => {
              // Treat testCases as the authoritative manual test case list (no duplication)
              const manualIds = new Set(testCases.map((tc) => tc.id));
              const processingTestCases = wizardState.allTestCases.filter(
                (tc) => tc.source !== "manual" && !manualIds.has(tc.id),
              );
              const newAllTestCases = [...processingTestCases, ...testCases];

              handleStepComplete({
                manualTestCases: testCases, // Use authoritative list from ManualCSVStep
                allTestCases: newAllTestCases,
                manualCount: testCases.length, // Track manual count from authoritative list
                currentStep: "review",
              });
            }}
            onSkip={() => {
              // Skip manual upload - only proceed to review if we have test cases
              if (wizardState.allTestCases.length > 0) {
                handleStepComplete({
                  manualTestCases: [],
                  allTestCases: wizardState.allTestCases,
                  manualCount: 0,
                  currentStep: "review",
                });
              } else {
                toast({
                  title: "No Test Cases Available",
                  description:
                    "Please generate AI test cases or upload manual test cases before proceeding to review.",
                  variant: "destructive",
                });
              }
            }}
            initialTestCases={wizardState.manualTestCases}
            industry={wizardState.customer.industry || "General"}
            documentId={wizardState.uploadedDocuments[0]?.id}
          />
        );

      case "review":
        return (
          <ReviewSubmitStep
            testCases={wizardState.allTestCases}
            onComplete={() => {
              onComplete(wizardState);
            }}
            initialCustomer={wizardState.customer}
            documentIds={wizardState.uploadedDocuments.map((doc) => doc.id)}
            industry={wizardState.customer.industry || "General"}
            aiGeneratedCount={wizardState.aiGeneratedCount}
            manualCount={wizardState.manualCount}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Wizard Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="px-6 py-8">
          <div className="text-center space-y-4">
            <h1
              className="text-3xl font-semibold"
              data-testid="text-wizard-title"
            >
              AI Test Case Generation Wizard
            </h1>
            <p className="text-muted-foreground text-lg">
              Transform your business documents into comprehensive test cases in
              4 simple steps
            </p>
            {/* Overall Progress Bar */}
            <div className="max-w-md mx-auto space-y-2 mt-6">
              <div className="flex justify-between text-sm">
                <span className="font-medium">Progress</span>
                <span className="text-primary font-medium">
                  {Math.round(progressPercentage)}% Complete
                </span>
              </div>
              <Progress
                value={progressPercentage}
                className="h-2"
                data-testid="progress-wizard"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex min-h-[calc(100vh-140px)]">
        {/* Desktop Sidebar - Hidden on Mobile */}
        <div className="hidden md:block w-72 lg:w-80 bg-card border-r border-border flex-shrink-0">
          <div className="p-6 space-y-2">
            {WIZARD_STEPS.map((step, index) => {
              const stepStatus = getStepStatus(step.id);
              const Icon = step.icon;

              return (
                <button
                  key={step.id}
                  onClick={() =>
                    canNavigateToStep(step.id) && goToStep(step.id)
                  }
                  disabled={!canNavigateToStep(step.id)}
                  className={`w-full text-left p-5 rounded-lg transition-all duration-200 relative group ${
                    stepStatus === "current"
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 ring-2 ring-primary/20 scale-[1.02]"
                      : stepStatus === "completed"
                        ? "bg-chart-2/10 text-chart-2 hover-elevate border-l-4 border-chart-2"
                        : stepStatus === "available"
                          ? "hover-elevate border border-border hover:border-primary/30"
                          : "opacity-50 cursor-not-allowed"
                  }`}
                  data-testid={`button-step-${step.id}`}
                >
                  <div className="flex items-start space-x-4">
                    <div
                      className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-lg transition-all ${
                        stepStatus === "completed"
                          ? "bg-chart-2 text-background ring-2 ring-chart-2/30"
                          : stepStatus === "current"
                            ? "bg-primary-foreground text-primary ring-2 ring-primary-foreground/30"
                            : "bg-background text-muted-foreground border-2 border-border group-hover:border-primary/30"
                      }`}
                    >
                      {stepStatus === "completed" ? (
                        <Check className="w-5 h-5" />
                      ) : (
                        step.stepNumber
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <Icon className="w-5 h-5 flex-shrink-0" />
                        <span className="font-semibold text-base">
                          {step.title}
                        </span>
                      </div>
                      <p
                        className={`text-sm leading-relaxed ${
                          stepStatus === "current" ? "opacity-90" : "opacity-75"
                        }`}
                      >
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
        <div className="flex-1 bg-background">
          {/* Mobile Navigation */}
          <div className="md:hidden p-4 border-b">
            <div className="flex items-center justify-between mb-4">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Menu className="w-4 h-4 mr-2" />
                    Navigation
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-80">
                  <div className="p-4 space-y-2 mt-4">
                    <h3 className="font-semibold text-lg mb-4">Wizard Steps</h3>
                    {WIZARD_STEPS.map((step, index) => {
                      const stepStatus = getStepStatus(step.id);
                      const Icon = step.icon;

                      return (
                        <SheetClose asChild key={step.id}>
                          <button
                            onClick={() =>
                              canNavigateToStep(step.id) && goToStep(step.id)
                            }
                            disabled={!canNavigateToStep(step.id)}
                            className={`w-full text-left p-4 rounded-lg transition-all relative ${
                              stepStatus === "current"
                                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                                : stepStatus === "completed"
                                  ? "bg-chart-2/10 text-chart-2 border-l-4 border-chart-2"
                                  : stepStatus === "available"
                                    ? "border border-border"
                                    : "opacity-50 cursor-not-allowed"
                            }`}
                            data-testid={`button-step-mobile-${step.id}`}
                          >
                            <div className="flex items-start space-x-3">
                              <div
                                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                                  stepStatus === "completed"
                                    ? "bg-chart-2 text-background"
                                    : stepStatus === "current"
                                      ? "bg-primary-foreground text-primary"
                                      : "bg-background text-muted-foreground border border-border"
                                }`}
                              >
                                {stepStatus === "completed" ? (
                                  <Check className="w-4 h-4" />
                                ) : (
                                  step.stepNumber
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center space-x-2 mb-1">
                                  <Icon className="w-4 h-4 flex-shrink-0" />
                                  <span className="font-medium">
                                    {step.title}
                                  </span>
                                </div>
                                <p className="text-xs opacity-75 leading-relaxed">
                                  {step.description}
                                </p>
                              </div>
                            </div>
                          </button>
                        </SheetClose>
                      );
                    })}
                  </div>
                </SheetContent>
              </Sheet>

              <div className="text-sm font-medium text-primary">
                Step {getCurrentStepNumber()} of {WIZARD_STEPS.length}
              </div>
            </div>

            {/* Mobile Step Indicator */}
            <div className="flex items-center space-x-1 overflow-x-auto pb-2">
              {WIZARD_STEPS.map((step, index) => {
                const stepStatus = getStepStatus(step.id);
                const Icon = step.icon;
                return (
                  <div
                    key={step.id}
                    className="flex items-center flex-shrink-0"
                  >
                    <div
                      className={`flex flex-col items-center space-y-1 px-2 py-2 rounded-lg min-w-0 ${
                        stepStatus === "current" ? "bg-primary/10" : ""
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs transition-all ${
                          stepStatus === "completed"
                            ? "bg-chart-2 text-background"
                            : stepStatus === "current"
                              ? "bg-primary text-primary-foreground"
                              : stepStatus === "available"
                                ? "border border-border text-muted-foreground"
                                : "border border-border text-muted-foreground/50"
                        }`}
                      >
                        {stepStatus === "completed" ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <Icon className="w-3 h-3" />
                        )}
                      </div>
                      <span
                        className={`text-xs font-medium text-center truncate max-w-16 ${
                          stepStatus === "current"
                            ? "text-primary"
                            : stepStatus === "completed"
                              ? "text-chart-2"
                              : "text-muted-foreground"
                        }`}
                      >
                        {step.title}
                      </span>
                    </div>
                    {index < WIZARD_STEPS.length - 1 && (
                      <div
                        className={`w-3 h-0.5 mx-1 flex-shrink-0 ${
                          index < currentStepIndex ? "bg-chart-2" : "bg-border"
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-4 md:p-8">{renderStepContent()}</div>
        </div>
      </div>
    </div>
  );
}
