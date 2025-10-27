'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { FileText, ArrowDown } from 'lucide-react';

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DownloadModal({ isOpen, onClose }: DownloadModalProps) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [animated, setAnimated] = useState(false);
  const [backdropAnimated, setBackdropAnimated] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      // Force a re-render to start with hidden state, then animate
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimated(true);
          setBackdropAnimated(true);
        });
      });
    } else if (mounted) {
      setAnimated(false);
      setBackdropAnimated(false);
      // Wait for fade-out animation before unmounting
      const timer = setTimeout(() => {
        setMounted(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, mounted]);

  const handleDownload = async (fileType: 'cursorrules' | 'claude_md' | 'text' | 'all') => {
    setDownloading(fileType);
    try {
      // Fetch the file content
      const response = await fetch(`/api/rules/generate?file_type=${fileType}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to generate file');
      }

      const data = await response.json();
      
      // Create and download the file
      const blob = new Blob([data.file_content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      let filename = '';
      if (fileType === 'cursorrules') {
        filename = '.cursorrules';
      } else if (fileType === 'claude_md') {
        filename = 'CLAUDE.md';
      } else if (fileType === 'all') {
        filename = 'all-rules.txt';
      } else {
        filename = 'rules.txt';
      }
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      onClose();
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Failed to download file. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  if (!mounted) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed top-0 left-0 right-0 bottom-0 bg-black/50 z-50 transition-all duration-[1000ms] ease-out ${
          backdropAnimated ? 'opacity-100 blur-0' : 'opacity-0 blur-sm'
        }`}
        onClick={onClose}
        style={{ width: '100%', height: '100%' }}
      />
      
      {/* Modal */}
      <div
        className="fixed top-0 left-0 right-0 bottom-0 flex items-center justify-center z-50 pointer-events-none"
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}
      >
            <div
              className={`w-96 h-[424px] max-h-[calc(100vh-2rem)] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-3xl shadow-lg pointer-events-auto transition-all duration-[1000ms] ease-out ${
                animated ? 'opacity-100 blur-0' : 'opacity-0 blur-sm'
              }`}
              style={{ borderRadius: '24px' }}
            >
          <div className="p-6 h-full flex flex-col overflow-hidden">

            {/* Content */}
            <div className="flex-1 flex flex-col overflow-y-auto">
              <h3 className="text-xl font-semibold mb-4">Download Rules</h3>
              
              <div className="flex-1 flex flex-col justify-center space-y-3">
                <button
                  onClick={() => handleDownload('cursorrules')}
                  disabled={downloading !== null}
                  className="w-full p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-black dark:hover:border-white transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
                >
                  <Image
                    src="/assets/cursor_logo.png"
                    alt="Cursor"
                    width={32}
                    height={32}
                    className="rounded-sm"
                  />
                  <div className="font-medium">.cursorrules</div>
                </button>

                <button
                  onClick={() => handleDownload('claude_md')}
                  disabled={downloading !== null}
                  className="w-full p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-black dark:hover:border-white transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
                >
                  <Image
                    src="/assets/claude_code_logo.png"
                    alt="Claude Code"
                    width={32}
                    height={32}
                    className="rounded-sm"
                  />
                  <div className="font-medium">CLAUDE.md</div>
                </button>

                <button
                  onClick={() => handleDownload('text')}
                  disabled={downloading !== null}
                  className="w-full p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-black dark:hover:border-white transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
                >
                  <FileText className="h-8 w-8 text-black dark:text-gray-400" />
                  <div className="font-medium">Text File</div>
                </button>

                <button
                  onClick={() => handleDownload('all')}
                  disabled={downloading !== null}
                  className="w-full p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-black dark:hover:border-white transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
                >
                  <div className="flex items-center justify-center h-8 w-8 rounded-full border-2 border-black dark:border-gray-400">
                    <ArrowDown className="h-4 w-4 text-black dark:text-gray-400" />
                  </div>
                  <div className="font-medium">Download All</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

