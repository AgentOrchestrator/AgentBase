'use client';

import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ExtractionProgressProps {
  status: 'idle' | 'processing' | 'success' | 'error';
  progress?: number; // 0-100
  currentStep?: string;
  rulesExtracted?: number;
  error?: string;
  onCancel?: () => void;
  onViewResults?: () => void;
}

export function ExtractionProgress({
  status,
  progress = 0,
  currentStep = '',
  rulesExtracted = 0,
  error,
  onCancel,
  onViewResults,
}: ExtractionProgressProps) {
  if (status === 'idle') {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <h3 className="text-xl font-semibold">
          {status === 'processing' && 'Extracting Rules...'}
          {status === 'success' && '✓ Extraction Complete!'}
          {status === 'error' && '✗ Extraction Failed'}
        </h3>
      </CardHeader>
      <CardContent>
        {status === 'processing' && (
          <div className="space-y-6">
            {/* Progress bar */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600 dark:text-gray-400">Progress</span>
                <span className="font-semibold">{progress}%</span>
              </div>
              <div className="w-full h-3 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Status message */}
            {currentStep && (
              <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
                <p className="text-sm text-blue-900 dark:text-blue-100">{currentStep}</p>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Rules Found</p>
                <p className="text-2xl font-bold">{rulesExtracted}</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Status</p>
                <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">Analyzing...</p>
              </div>
            </div>

            {/* Cancel button */}
            {onCancel && (
              <div className="flex justify-end">
                <Button variant="outline" onClick={onCancel}>
                  Cancel Extraction
                </Button>
              </div>
            )}
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-6">
            {/* Success icon */}
            <div className="flex flex-col items-center py-6">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-950 rounded-full flex items-center justify-center mb-4">
                <svg
                  className="w-8 h-8 text-green-600 dark:text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h4 className="text-lg font-semibold mb-2">Extraction Successful!</h4>
              <p className="text-gray-600 dark:text-gray-400 text-center">
                {rulesExtracted} {rulesExtracted === 1 ? 'rule' : 'rules'} extracted and ready for review
              </p>
            </div>

            {/* Results summary */}
            <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-900 rounded-lg">
              <h5 className="text-sm font-semibold text-green-900 dark:text-green-100 mb-2">
                What's Next?
              </h5>
              <ul className="text-sm text-green-800 dark:text-green-200 space-y-1">
                <li>• Review the extracted rules in the Pending Rules section</li>
                <li>• Approve rules you want to keep</li>
                <li>• Reject or edit rules that need changes</li>
                <li>• Generate rule files once you've approved rules</li>
              </ul>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button variant="default" onClick={onViewResults} className="flex-1">
                Review Pending Rules
              </Button>
              <Button variant="outline" onClick={() => (window.location.href = '/rules')}>
                Back to Dashboard
              </Button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-6">
            {/* Error icon */}
            <div className="flex flex-col items-center py-6">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-950 rounded-full flex items-center justify-center mb-4">
                <svg
                  className="w-8 h-8 text-red-600 dark:text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <h4 className="text-lg font-semibold mb-2">Extraction Failed</h4>
              <p className="text-gray-600 dark:text-gray-400 text-center">
                {error || 'An error occurred during extraction'}
              </p>
            </div>

            {/* Error details */}
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-lg">
                <h5 className="text-sm font-semibold text-red-900 dark:text-red-100 mb-2">
                  Error Details
                </h5>
                <p className="text-sm text-red-800 dark:text-red-200 font-mono">{error}</p>
              </div>
            )}

            {/* Troubleshooting */}
            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <h5 className="text-sm font-semibold mb-2">Troubleshooting</h5>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>• Check if the memory service is running</li>
                <li>• Verify your chat histories contain valid conversations</li>
                <li>• Try selecting fewer conversations</li>
                <li>• Contact support if the issue persists</li>
              </ul>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button variant="default" onClick={() => (window.location.href = '/rules/extract')} className="flex-1">
                Try Again
              </Button>
              <Button variant="outline" onClick={() => (window.location.href = '/rules')}>
                Back to Dashboard
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
