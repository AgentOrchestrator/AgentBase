'use client';

import { useState } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChatHistorySelector } from './chat-history-selector';
import { PromptSelector } from './prompt-selector';
import { ExtractionProgress } from './extraction-progress';
import { rulesClient } from '@/lib/rules/rules-client';
import type { ExtractionResult } from '@/lib/rules/types';

type WizardStep = 1 | 2 | 3;
type ExtractionStatus = 'idle' | 'processing' | 'success' | 'error';

export function ExtractionWizard() {
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [selectedChatIds, setSelectedChatIds] = useState<string[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [extractionStatus, setExtractionStatus] = useState<ExtractionStatus>('idle');
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canProceedToStep2 = selectedChatIds.length > 0;
  const canProceedToStep3 = selectedPromptId !== null;

  const handleNext = () => {
    if (currentStep === 1 && !canProceedToStep2) {
      alert('Please select at least one conversation');
      return;
    }
    if (currentStep === 2 && !canProceedToStep3) {
      alert('Please choose an extraction prompt');
      return;
    }
    setCurrentStep((currentStep + 1) as WizardStep);
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as WizardStep);
    }
  };

  const handleExtract = async () => {
    if (!selectedPromptId || selectedChatIds.length === 0) {
      alert('Invalid configuration');
      return;
    }

    setExtractionStatus('processing');
    setExtractionProgress(10);
    setError(null);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setExtractionProgress((prev) => {
          if (prev >= 90) return prev;
          return prev + 10;
        });
      }, 500);

      const result = await rulesClient.extractRules({
        chat_history_ids: selectedChatIds,
        prompt_id: selectedPromptId,
      });

      clearInterval(progressInterval);
      setExtractionProgress(100);
      setExtractionResult(result);
      setExtractionStatus('success');
    } catch (err) {
      setExtractionStatus('error');
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      console.error('Extraction error:', err);
    }
  };

  const handleViewResults = () => {
    window.location.href = '/rules/pending';
  };

  const handleCancel = () => {
    if (confirm('Are you sure you want to cancel the extraction?')) {
      window.location.href = '/rules';
    }
  };

  const getStepTitle = (step: WizardStep): string => {
    switch (step) {
      case 1:
        return 'Select Conversations';
      case 2:
        return 'Choose Prompt';
      case 3:
        return 'Extract Rules';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Extract Rules from Chat Histories</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Analyze your conversations to automatically extract coding rules
        </p>
      </div>

      {/* Step indicator */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`
                      w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm
                      ${
                        currentStep === step
                          ? 'bg-blue-600 text-white'
                          : currentStep > step
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                      }
                    `}
                  >
                    {currentStep > step ? '✓' : step}
                  </div>
                  <p
                    className={`
                      text-xs mt-2 font-medium
                      ${
                        currentStep === step
                          ? 'text-blue-600 dark:text-blue-400'
                          : currentStep > step
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-gray-500 dark:text-gray-500'
                      }
                    `}
                  >
                    {getStepTitle(step as WizardStep)}
                  </p>
                </div>
                {step < 3 && (
                  <div
                    className={`
                      flex-1 h-0.5 mx-2
                      ${
                        currentStep > step
                          ? 'bg-green-600'
                          : 'bg-gray-200 dark:bg-gray-800'
                      }
                    `}
                  />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Step content */}
      <div className="min-h-[500px]">
        {currentStep === 1 && (
          <ChatHistorySelector
            selectedIds={selectedChatIds}
            onSelectionChange={setSelectedChatIds}
          />
        )}

        {currentStep === 2 && (
          <PromptSelector
            selectedPromptId={selectedPromptId}
            onPromptChange={setSelectedPromptId}
          />
        )}

        {currentStep === 3 && extractionStatus === 'idle' && (
          <Card>
            <CardHeader>
              <h3 className="text-xl font-semibold">Ready to Extract</h3>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900 rounded-lg">
                  <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-3">
                    Extraction Summary
                  </h4>
                  <div className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
                    <p>
                      <span className="font-semibold">Conversations selected:</span> {selectedChatIds.length}
                    </p>
                    <p>
                      <span className="font-semibold">Extraction prompt:</span> Selected
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <h4 className="text-sm font-semibold mb-2">What happens next?</h4>
                  <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    <li>• The AI will analyze your selected conversations</li>
                    <li>• Coding rules will be extracted based on the prompt</li>
                    <li>• All extracted rules will be marked as "pending review"</li>
                    <li>• You can approve, reject, or edit each rule</li>
                    <li>• This process may take 1-2 minutes</li>
                  </ul>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="default"
                    onClick={handleExtract}
                    className="flex-1"
                    size="lg"
                  >
                    Start Extraction
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 3 && extractionStatus !== 'idle' && (
          <ExtractionProgress
            status={extractionStatus}
            progress={extractionProgress}
            currentStep={
              extractionProgress < 30
                ? 'Preparing conversations...'
                : extractionProgress < 60
                ? 'Analyzing with AI...'
                : extractionProgress < 90
                ? 'Extracting rules...'
                : 'Finalizing...'
            }
            rulesExtracted={extractionResult?.rules_extracted || 0}
            error={error || undefined}
            onCancel={extractionStatus === 'processing' ? handleCancel : undefined}
            onViewResults={handleViewResults}
          />
        )}
      </div>

      {/* Navigation buttons */}
      {(currentStep < 3 || (currentStep === 3 && extractionStatus === 'idle')) && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between">
              <div>
                {currentStep > 1 && (
                  <Button variant="outline" onClick={handleBack}>
                    ← Back
                  </Button>
                )}
              </div>
              <div className="flex gap-3">
                <Button variant="ghost" onClick={handleCancel}>
                  Cancel
                </Button>
                {currentStep < 3 && (
                  <Button
                    variant="default"
                    onClick={handleNext}
                    disabled={
                      (currentStep === 1 && !canProceedToStep2) ||
                      (currentStep === 2 && !canProceedToStep3)
                    }
                  >
                    Next →
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
