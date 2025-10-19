"use client";

import { createContext, useContext, useState, ReactNode } from 'react';

interface CanvasPreviewContextType {
  previewMode: boolean;
  setPreviewMode: (mode: boolean) => void;
}

const CanvasPreviewContext = createContext<CanvasPreviewContextType | undefined>(undefined);

export function CanvasPreviewProvider({ children }: { children: ReactNode }) {
  const [previewMode, setPreviewMode] = useState(false);

  return (
    <CanvasPreviewContext.Provider value={{ previewMode, setPreviewMode }}>
      {children}
    </CanvasPreviewContext.Provider>
  );
}

export function useCanvasPreview() {
  const context = useContext(CanvasPreviewContext);
  if (context === undefined) {
    throw new Error('useCanvasPreview must be used within a CanvasPreviewProvider');
  }
  return context;
}
