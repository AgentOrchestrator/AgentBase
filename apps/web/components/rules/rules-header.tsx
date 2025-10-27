'use client';

import { useState } from 'react';
import { ArrowDown } from 'lucide-react';
import { DownloadModal } from './download-modal';

export function RulesHeader() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Shared Memory</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Manage coding rules extracted from your team's chat histories
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center h-8 w-8 rounded-full border-2 border-black hover:border-gray-400 group transition-colors"
        >
          <ArrowDown className="h-4 w-4 text-black group-hover:text-gray-400 transition-colors" />
        </button>
      </div>

      <DownloadModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}

