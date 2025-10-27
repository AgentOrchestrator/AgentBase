'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Download,
  FileText,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Folder,
  FolderOpen
} from 'lucide-react';
import type { FileConfig, FileResult } from '@/lib/rules/types';

interface FileGeneratorProps {
  userId: string;
}

type FileType = 'cursorrules' | 'claude_md';
type Step = 'workspace' | 'project' | 'rules' | 'files' | 'generate';

interface Workspace {
  id: string;
  name: string;
  description?: string;
  role: string;
}

interface Project {
  id: string;
  name: string;
  description?: string;
  project_path?: string;
}

interface RulePreview {
  id: string;
  text: string;
  category: string;
  confidence: number;
}

interface FileSelection {
  type: FileType;
  selected: boolean;
  label: string;
  fileName: string;
  description: string;
  uploadedFile?: File;
}

export function FileGenerator({ userId }: FileGeneratorProps) {
  const [currentStep, setCurrentStep] = useState<Step>('workspace');

  // Step 1: Workspace selection
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);

  // Step 2: Project selection (optional)
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // Step 3: Rules preview
  const [rules, setRules] = useState<RulePreview[]>([]);
  const [rulesByCategory, setRulesByCategory] = useState<Record<string, RulePreview[]>>({});
  const [loadingRules, setLoadingRules] = useState(false);

  // Step 4: File type selection
  const [files, setFiles] = useState<Record<FileType, FileSelection>>({
    cursorrules: {
      type: 'cursorrules',
      selected: false,
      label: '.cursorrules',
      fileName: '.cursorrules',
      description: 'For Cursor AI editor',
    },
    claude_md: {
      type: 'claude_md',
      selected: false,
      label: 'CLAUDE.md',
      fileName: 'CLAUDE.md',
      description: 'For Claude Code',
    },
  });

  // Step 5: Generation
  const [generating, setGenerating] = useState(false);
  const [generatedFiles, setGeneratedFiles] = useState<Record<string, FileResult>>({});

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load workspaces on mount
  useEffect(() => {
    loadWorkspaces();
  }, []);

  const loadWorkspaces = async () => {
    setLoadingWorkspaces(true);
    setError(null);
    try {
      const response = await fetch('/api/workspaces');
      if (!response.ok) {
        throw new Error('Failed to fetch workspaces');
      }
      const data = await response.json();
      setWorkspaces(data.workspaces || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workspaces');
    } finally {
      setLoadingWorkspaces(false);
    }
  };

  const loadProjects = async (workspaceId: string) => {
    setLoadingProjects(true);
    setError(null);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/projects`);
      if (!response.ok) {
        throw new Error('Failed to fetch projects');
      }
      const data = await response.json();
      setProjects(data.projects || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setLoadingProjects(false);
    }
  };

  const loadRulesPreview = async (workspaceId: string, projectId?: string) => {
    setLoadingRules(true);
    setError(null);
    try {
      const url = new URL('/api/rules/preview', window.location.origin);
      url.searchParams.set('workspace_id', workspaceId);
      if (projectId) url.searchParams.set('project_id', projectId);

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error('Failed to fetch rules preview');
      }
      const data = await response.json();
      setRules(data.rules || []);
      setRulesByCategory(data.by_category || {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rules');
    } finally {
      setLoadingRules(false);
    }
  };

  const handleWorkspaceSelect = (workspace: Workspace) => {
    setSelectedWorkspace(workspace);
    setSelectedProject(null);
    setProjects([]);
    loadProjects(workspace.id);
  };

  const handleProjectSelect = (project: Project | null) => {
    setSelectedProject(project);
  };

  const handleNext = async () => {
    setError(null);

    if (currentStep === 'workspace') {
      if (!selectedWorkspace) {
        setError('Please select a workspace');
        return;
      }
      setCurrentStep('project');
    } else if (currentStep === 'project') {
      setCurrentStep('rules');
      await loadRulesPreview(selectedWorkspace!.id, selectedProject?.id);
    } else if (currentStep === 'rules') {
      setCurrentStep('files');
    } else if (currentStep === 'files') {
      const selectedCount = Object.values(files).filter(f => f.selected).length;
      if (selectedCount === 0) {
        setError('Please select at least one file type');
        return;
      }
      setCurrentStep('generate');
      await handleGenerate();
    }
  };

  const handleBack = () => {
    setError(null);
    if (currentStep === 'project') {
      setCurrentStep('workspace');
    } else if (currentStep === 'rules') {
      setCurrentStep('project');
    } else if (currentStep === 'files') {
      setCurrentStep('rules');
    } else if (currentStep === 'generate') {
      setCurrentStep('files');
    }
  };

  const handleFileToggle = (fileType: FileType) => {
    setFiles(prev => ({
      ...prev,
      [fileType]: {
        ...prev[fileType],
        selected: !prev[fileType].selected,
      },
    }));
  };

  const handleFileUpload = (fileType: FileType, file: File | null) => {
    setFiles(prev => ({
      ...prev,
      [fileType]: {
        ...prev[fileType],
        uploadedFile: file || undefined,
      },
    }));
  };

  const generateFile = async (fileType: FileType, merge: boolean = false) => {
    const fileSelection = files[fileType];
    if (merge && !fileSelection.uploadedFile) {
      merge = false;
    }

    let result: FileResult;

    if (merge && fileSelection.uploadedFile) {
      const formData = new FormData();
      formData.append('file', fileSelection.uploadedFile);
      formData.append('workspace_id', selectedWorkspace!.id);
      if (selectedProject) formData.append('project_id', selectedProject.id);
      formData.append('file_type', fileType);

      const response = await fetch('/api/rules/merge', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to merge file');
      }

      result = await response.json();
    } else {
      const config: FileConfig = {
        workspace_id: selectedWorkspace!.id,
        project_id: selectedProject?.id,
        file_type: fileType,
        preview_only: false,
      };

      const response = await fetch('/api/rules/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate file');
      }

      result = await response.json();
    }

    return result;
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setSuccess(null);
    setGeneratedFiles({});

    try {
      const selectedFiles = Object.values(files).filter(f => f.selected);
      const results: Record<string, FileResult> = {};

      for (const fileSelection of selectedFiles) {
        const result = await generateFile(
          fileSelection.type,
          !!fileSelection.uploadedFile
        );
        results[fileSelection.type] = result;
      }

      setGeneratedFiles(results);
      setSuccess(`Successfully generated ${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''}!`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = (fileType: FileType) => {
    const result = generatedFiles[fileType];
    if (!result) return;

    const fileSelection = files[fileType];
    const blob = new Blob([result.file_content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileSelection.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadAll = () => {
    Object.keys(generatedFiles).forEach(fileType => {
      handleDownload(fileType as FileType);
    });
  };

  const canProceed = () => {
    if (currentStep === 'workspace') return !!selectedWorkspace;
    if (currentStep === 'project') return true; // Project is optional
    if (currentStep === 'rules') return rules.length > 0;
    if (currentStep === 'files') return Object.values(files).some(f => f.selected);
    return false;
  };

  const stepTitles = {
    workspace: 'Select Workspace',
    project: 'Select Project (Optional)',
    rules: 'Preview Rules',
    files: 'Select File Types',
    generate: 'Generate & Download',
  };

  const steps: Step[] = ['workspace', 'project', 'rules', 'files', 'generate'];
  const currentStepIndex = steps.indexOf(currentStep);

  return (
    <div className="space-y-6">
      {/* Progress Indicator */}
      <div className="flex items-center justify-between mb-8">
        {steps.map((step, index) => (
          <div key={step} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  index <= currentStepIndex
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                }`}
              >
                {index + 1}
              </div>
              <span className="text-xs mt-2 text-center">{stepTitles[step]}</span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`h-0.5 flex-1 mx-2 ${
                  index < currentStepIndex ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Error/Success Messages */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-500 text-green-700 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Step Content */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">{stepTitles[currentStep]}</h2>
        </CardHeader>
        <CardContent>
          {/* Step 1: Workspace Selection */}
          {currentStep === 'workspace' && (
            <div className="space-y-4">
              {loadingWorkspaces ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : workspaces.length === 0 ? (
                <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                  <p>No workspaces found.</p>
                  <p className="text-sm mt-2">Create a workspace first to generate rule files.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {workspaces.map(workspace => (
                    <div
                      key={workspace.id}
                      onClick={() => handleWorkspaceSelect(workspace)}
                      className={`p-4 border rounded-lg cursor-pointer transition-all ${
                        selectedWorkspace?.id === workspace.id
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-blue-400'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {selectedWorkspace?.id === workspace.id ? (
                          <FolderOpen className="w-5 h-5 text-blue-600 mt-0.5" />
                        ) : (
                          <Folder className="w-5 h-5 text-gray-400 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <h3 className="font-medium">{workspace.name}</h3>
                          {workspace.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {workspace.description}
                            </p>
                          )}
                          <span className="text-xs text-gray-500 mt-2 inline-block">
                            Role: {workspace.role}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Project Selection */}
          {currentStep === 'project' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Select a project to generate project-specific rules, or skip to use workspace-wide rules.
              </p>

              {loadingProjects ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Skip/Workspace-wide option */}
                  <div
                    onClick={() => handleProjectSelect(null)}
                    className={`p-4 border rounded-lg cursor-pointer transition-all ${
                      selectedProject === null
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-blue-400'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Folder className="w-5 h-5 text-gray-400" />
                      <div>
                        <h3 className="font-medium">Workspace-wide rules</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Use all approved rules from this workspace
                        </p>
                      </div>
                    </div>
                  </div>

                  {projects.length > 0 && (
                    <>
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-6 mb-2">
                        Or select a specific project:
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {projects.map(project => (
                          <div
                            key={project.id}
                            onClick={() => handleProjectSelect(project)}
                            className={`p-4 border rounded-lg cursor-pointer transition-all ${
                              selectedProject?.id === project.id
                                ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                                : 'border-gray-200 dark:border-gray-700 hover:border-blue-400'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <FolderOpen className="w-5 h-5 text-blue-600 mt-0.5" />
                              <div className="flex-1">
                                <h3 className="font-medium">{project.name}</h3>
                                {project.description && (
                                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                    {project.description}
                                  </p>
                                )}
                                {project.project_path && (
                                  <p className="text-xs text-gray-500 mt-2 font-mono">
                                    {project.project_path}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Rules Preview */}
          {currentStep === 'rules' && (
            <div className="space-y-4">
              {loadingRules ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : rules.length === 0 ? (
                <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p className="font-medium">No approved rules found</p>
                  <p className="text-sm mt-2">
                    You need to extract and approve rules before generating files.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Found {rules.length} approved rule{rules.length !== 1 ? 's' : ''} in{' '}
                      {Object.keys(rulesByCategory).length} categor
                      {Object.keys(rulesByCategory).length !== 1 ? 'ies' : 'y'}
                    </p>
                  </div>

                  <div className="space-y-4 max-h-[400px] overflow-y-auto">
                    {Object.entries(rulesByCategory).map(([category, categoryRules]) => (
                      <div key={category} className="border rounded-lg p-4">
                        <h3 className="font-medium text-lg mb-3 capitalize">
                          {category.replace(/-/g, ' ')}
                        </h3>
                        <ul className="space-y-2">
                          {categoryRules.map(rule => (
                            <li key={rule.id} className="text-sm flex items-start gap-2">
                              <span className="text-blue-600 mt-1">•</span>
                              <span className="flex-1">{rule.text}</span>
                              <span className="text-xs text-gray-500">
                                {Math.round(rule.confidence * 100)}%
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4: File Type Selection */}
          {currentStep === 'files' && (
            <div className="space-y-6">
              {(Object.keys(files) as FileType[]).map(fileType => {
                const fileSelection = files[fileType];
                return (
                  <div key={fileType} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id={`file-${fileType}`}
                        checked={fileSelection.selected}
                        onCheckedChange={() => handleFileToggle(fileType)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <Label
                          htmlFor={`file-${fileType}`}
                          className="text-base font-medium cursor-pointer"
                        >
                          {fileSelection.label}
                        </Label>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {fileSelection.description}
                        </p>

                        {fileSelection.selected && (
                          <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                            <Label className="text-sm font-medium mb-2 block">
                              <Upload className="inline w-4 h-4 mr-1" />
                              Upload existing file to merge (optional)
                            </Label>
                            <Input
                              type="file"
                              accept=".txt,.md,.cursorrules"
                              onChange={(e) => handleFileUpload(fileType, e.target.files?.[0] || null)}
                              className="text-sm"
                            />
                            {fileSelection.uploadedFile && (
                              <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                                <CheckCircle2 className="inline w-3 h-3 mr-1" />
                                {fileSelection.uploadedFile.name} - will merge with LLM
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Step 5: Generate & Download */}
          {currentStep === 'generate' && (
            <div className="space-y-6">
              {generating ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">Generating your files...</p>
                </div>
              ) : Object.keys(generatedFiles).length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Generated Files</h3>
                    <Button onClick={handleDownloadAll} variant="outline">
                      <Download className="mr-2 h-4 w-4" />
                      Download All
                    </Button>
                  </div>

                  {(Object.keys(generatedFiles) as FileType[]).map(fileType => {
                    const result = generatedFiles[fileType];
                    const fileSelection = files[fileType];
                    return (
                      <div key={fileType} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-blue-500" />
                          <div>
                            <p className="font-medium">{fileSelection.fileName}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {result.rules_included} rules included
                            </p>
                          </div>
                        </div>
                        <Button
                          onClick={() => handleDownload(fileType)}
                          variant="outline"
                          size="sm"
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Download
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button
          onClick={handleBack}
          variant="outline"
          disabled={currentStep === 'workspace'}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        {currentStep !== 'generate' && (
          <Button
            onClick={handleNext}
            disabled={!canProceed() || (currentStep === 'rules' && rules.length === 0)}
          >
            {currentStep === 'files' ? 'Generate Files' : 'Next'}
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
