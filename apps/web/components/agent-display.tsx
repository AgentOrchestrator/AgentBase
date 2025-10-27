import React from 'react';
import Image from 'next/image';

interface AgentDisplayProps {
  agentType: string | null;
}

// Agent logos using actual PNG images from assets
const ClaudeCodeLogo = () => (
  <Image
    src="/assets/claude_code_logo.png"
    alt="Claude Code"
    width={16}
    height={16}
    className="rounded-sm"
  />
);

const CodexLogo = () => (
  <Image
    src="/assets/codex_logo.png"
    alt="Codex"
    width={16}
    height={16}
    className="rounded-sm"
  />
);

const CursorLogo = () => (
  <Image
    src="/assets/cursor_logo.png"
    alt="Cursor"
    width={16}
    height={16}
    className="rounded-sm"
  />
);

const WindsurfLogo = () => (
  <Image
    src="/assets/windsurf_logo.png"
    alt="Windsurf"
    width={16}
    height={16}
    className="rounded-sm"
  />
);

const FactoryLogo = () => (
  <Image
    src="/assets/factory_droid_logo.png"
    alt="Droid"
    width={16}
    height={16}
    className="rounded-sm"
  />
);

const OtherLogo = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M10 2C10.5523 2 11 2.44772 11 3V4.5C11 5.05228 10.5523 5.5 10 5.5C9.44772 5.5 9 5.05228 9 4.5V3C9 2.44772 9.44772 2 10 2Z"
      fill="currentColor"
    />
    <path
      d="M10 14.5C10.5523 14.5 11 14.9477 11 15.5V17C11 17.5523 10.5523 18 10 18C9.44772 18 9 17.5523 9 17V15.5C9 14.9477 9.44772 14.5 10 14.5Z"
      fill="currentColor"
    />
    <path
      d="M5.5 9C5.5 8.44772 5.05228 8 4.5 8H3C2.44772 8 2 8.44772 2 9C2 9.55228 2.44772 10 3 10H4.5C5.05228 10 5.5 9.55228 5.5 9Z"
      fill="currentColor"
    />
    <path
      d="M17 9C17 8.44772 16.5523 8 16 8H14.5C13.9477 8 13.5 8.44772 13.5 9C13.5 9.55228 13.9477 10 14.5 10H16C16.5523 10 17 9.55228 17 9Z"
      fill="currentColor"
    />
    <path
      d="M6.5 6.5C6.5 5.67157 7.17157 5 8 5C8.82843 5 9.5 5.67157 9.5 6.5C9.5 7.32843 8.82843 8 8 8C7.17157 8 6.5 7.32843 6.5 6.5Z"
      fill="currentColor"
    />
    <path
      d="M13.5 6.5C13.5 5.67157 12.8284 5 12 5C11.1716 5 10.5 5.67157 10.5 6.5C10.5 7.32843 11.1716 8 12 8C12.8284 8 13.5 7.32843 13.5 6.5Z"
      fill="currentColor"
    />
    <path
      d="M6.5 13.5C6.5 12.6716 7.17157 12 8 12C8.82843 12 9.5 12.6716 9.5 13.5C9.5 14.3284 8.82843 15 8 15C7.17157 15 6.5 14.3284 6.5 13.5Z"
      fill="currentColor"
    />
    <path
      d="M13.5 13.5C13.5 12.6716 12.8284 12 12 12C11.1716 12 10.5 12.6716 10.5 13.5C10.5 14.3284 11.1716 15 12 15C12.8284 15 13.5 14.3284 13.5 13.5Z"
      fill="currentColor"
    />
  </svg>
);

const getAgentInfo = (agentType: string | null) => {
  switch (agentType) {
    case 'claude_code':
      return {
        name: 'Claude Code',
        logo: <ClaudeCodeLogo />
      };
    case 'codex':
      return {
        name: 'Codex',
        logo: <CodexLogo />
      };
    case 'cursor':
      return {
        name: 'Cursor',
        logo: <CursorLogo />
      };
    case 'windsurf':
      return {
        name: 'Windsurf',
        logo: <WindsurfLogo />
      };
    case 'factory':
      return {
        name: 'Droid',
        logo: <FactoryLogo />
      };
    case 'other':
      return {
        name: 'Other',
        logo: <OtherLogo />
      };
    default:
      return {
        name: 'Unknown',
        logo: <OtherLogo />
      };
  }
};

export function AgentDisplay({ agentType }: AgentDisplayProps) {
  if (!agentType) {
    return null;
  }

  const agentInfo = getAgentInfo(agentType);

  return (
    <div className="flex items-center gap-2 mt-2">
      {agentInfo.logo}
      <span className="text-sm font-bold text-black">
        {agentInfo.name}
      </span>
    </div>
  );
}
