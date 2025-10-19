"use client";

import { useSidebar } from "./sidebar-provider";
import { useTheme } from "@/lib/theme-context";
import { ReactNode, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { CanvasPreviewProvider } from "@/lib/canvas-preview-context";

interface CanvasWrapperProps {
  children: ReactNode;
  previewMode?: boolean;
  onPreviewModeChange?: (mode: boolean) => void;
}

export function CanvasWrapper({ children, previewMode: externalPreviewMode, onPreviewModeChange }: CanvasWrapperProps) {
  const { isCollapsed } = useSidebar();
  const { theme } = useTheme();
  const [internalPreviewMode, setInternalPreviewMode] = useState(false);

  const previewMode = externalPreviewMode !== undefined ? externalPreviewMode : internalPreviewMode;
  const setPreviewMode = (mode: boolean) => {
    if (onPreviewModeChange) {
      onPreviewModeChange(mode);
    } else {
      setInternalPreviewMode(mode);
    }
  };

  return (
    <CanvasPreviewProvider>
      <div
        className={`fixed inset-0 transition-all duration-300 ease-in-out ${
          isCollapsed ? 'left-0' : 'left-64'
        } ${theme === 'light' ? 'canvas-light-bg' : ''}`}
        style={{
          backgroundColor: theme === 'light' ? '#F5F5F5' : undefined
        }}
      >
        {/* Preview Mode Toggle */}
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50">
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all shadow-sm ${
              previewMode
                ? 'bg-blue-500 text-white border-blue-600 hover:bg-blue-600'
                : 'bg-card text-foreground border-border hover:bg-sidebar-accent'
            }`}
            title={previewMode ? "Exit shared view preview" : "Preview what others see"}
          >
            {previewMode ? (
              <>
                <EyeOff className="h-4 w-4" />
                <span className="text-sm font-medium">Exit Preview</span>
              </>
            ) : (
              <>
                <Eye className="h-4 w-4" />
                <span className="text-sm font-medium">Preview Shared View</span>
              </>
            )}
          </button>
        </div>

        {/* Preview Mode Banner */}
        {previewMode && (
          <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-40">
            <div className="bg-blue-500 text-white px-6 py-3 rounded-lg shadow-lg border border-blue-600">
              <div className="flex items-center gap-3">
                <Eye className="h-5 w-5" />
                <div>
                  <p className="text-sm font-semibold">Preview Mode Active</p>
                  <p className="text-xs opacity-90">You're seeing what others see based on your sharing settings</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {children}
      </div>
    </CanvasPreviewProvider>
  );
}
