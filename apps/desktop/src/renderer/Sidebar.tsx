import { useState } from 'react';
import './Sidebar.css';

type Terminal = {
  id: string;
  name: string;
  status: 'active' | 'idle' | 'completed';
};

type Branch = {
  id: string;
  name: string;
  repo: string;
  isExpanded: boolean;
  terminals: Terminal[];
  lastActive: string;
};

const dummyBranches: Branch[] = [
  {
    id: '1',
    name: 'feature/auth-improvements',
    repo: 'agent-base',
    isExpanded: true,
    lastActive: '2 min ago',
    terminals: [
      { id: 't1', name: 'Add OAuth2 flow', status: 'active' },
      { id: 't2', name: 'Fix token refresh', status: 'completed' },
      { id: 't3', name: 'Update session handling', status: 'idle' },
    ],
  },
  {
    id: '2',
    name: 'fix/memory-leak',
    repo: 'agent-base',
    isExpanded: true,
    lastActive: '15 min ago',
    terminals: [
      { id: 't4', name: 'Profile heap usage', status: 'completed' },
      { id: 't5', name: 'Cleanup event listeners', status: 'active' },
    ],
  },
  {
    id: '3',
    name: 'main',
    repo: 'agent-base',
    isExpanded: false,
    lastActive: '1 hour ago',
    terminals: [{ id: 't6', name: 'Deploy v2.1.0', status: 'completed' }],
  },
  {
    id: '4',
    name: 'feature/dashboard-redesign',
    repo: 'web-app',
    isExpanded: false,
    lastActive: '3 hours ago',
    terminals: [
      { id: 't7', name: 'New chart components', status: 'idle' },
      { id: 't8', name: 'Dark mode support', status: 'idle' },
      { id: 't9', name: 'Responsive layout', status: 'idle' },
    ],
  },
  {
    id: '5',
    name: 'hotfix/api-timeout',
    repo: 'backend-service',
    isExpanded: false,
    lastActive: 'Yesterday',
    terminals: [{ id: 't10', name: 'Increase timeout limits', status: 'completed' }],
  },
];

export default function Sidebar() {
  const [branches, setBranches] = useState<Branch[]>(dummyBranches);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleBranch = (branchId: string) => {
    setBranches(
      branches.map((branch) =>
        branch.id === branchId ? { ...branch, isExpanded: !branch.isExpanded } : branch
      )
    );
  };

  const getStatusIcon = (status: Terminal['status']) => {
    switch (status) {
      case 'active':
        return <span className="status-dot active" />;
      case 'completed':
        return <span className="status-dot completed" />;
      case 'idle':
        return <span className="status-dot idle" />;
    }
  };

  if (isCollapsed) {
    return (
      <button
        className="sidebar-expand-button"
        onClick={() => setIsCollapsed(false)}
        aria-label="Expand sidebar"
      >
        ☰
      </button>
    );
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">Branches</span>
        <button
          className="sidebar-collapse-button"
          onClick={() => setIsCollapsed(true)}
          aria-label="Collapse sidebar"
        >
          ✕
        </button>
      </div>

      <div className="sidebar-content">
        {branches.map((branch) => (
          <div key={branch.id} className="branch-group">
            <div className="branch-header" onClick={() => toggleBranch(branch.id)}>
              <span className={`branch-chevron ${branch.isExpanded ? 'expanded' : ''}`}>›</span>
              <span className="branch-icon">⎇</span>
              <div className="branch-info">
                <span className="branch-name">{branch.name}</span>
                <span className="branch-meta">
                  {branch.repo} · {branch.lastActive}
                </span>
              </div>
            </div>

            {branch.isExpanded && (
              <div className="terminal-list">
                {branch.terminals.map((terminal) => (
                  <div key={terminal.id} className="terminal-item">
                    {getStatusIcon(terminal.status)}
                    <span className="terminal-name">{terminal.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
