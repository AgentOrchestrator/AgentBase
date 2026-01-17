/**
 * Linear Service
 *
 * Handles all GraphQL API calls to Linear.
 * Extracted from Canvas.tsx for better separation of concerns.
 */

import type { LinearIssue, LinearProject } from '../stores/ILinearStore';

const LINEAR_API_ENDPOINT = 'https://api.linear.app/graphql';

// =============================================================================
// Response Types
// =============================================================================

export type LinearTeam = {
  id: string;
  name: string;
};

export type LinearViewer = {
  id: string;
  organization?: {
    name: string;
  };
  teams: {
    nodes: LinearTeam[];
  };
};

export type FetchProjectsResponse =
  | {
      success: true;
      projects: LinearProject[];
    }
  | {
      success: false;
      error: string;
    };

export type FetchIssuesResponse =
  | {
      success: true;
      issues: LinearIssue[];
      workspaceName: string;
    }
  | {
      success: false;
      error: string;
    };

export type CreateTicketResponse =
  | {
      success: true;
      issue: {
        id: string;
        identifier: string;
        title: string;
        url: string;
      };
    }
  | {
      success: false;
      error: string;
    };

// =============================================================================
// Service Interface
// =============================================================================

export interface ILinearService {
  /**
   * Fetch all projects (first 100)
   */
  fetchProjects(apiKey: string): Promise<FetchProjectsResponse>;

  /**
   * Fetch issues with state filter (triage, backlog, unstarted, started)
   */
  fetchIssues(apiKey: string): Promise<FetchIssuesResponse>;

  /**
   * Create a new ticket
   * Two-phase: first queries teams, then creates issue
   */
  createTicket(apiKey: string, title: string, description?: string): Promise<CreateTicketResponse>;
}

// =============================================================================
// GraphQL Queries & Mutations
// =============================================================================

const FETCH_PROJECTS_QUERY = `
  query {
    projects(first: 100) {
      nodes {
        id
        name
      }
    }
  }
`;

const FETCH_ISSUES_QUERY = `
  query {
    viewer {
      organization {
        name
      }
    }
    issues(
      filter: { state: { type: { in: ["triage", "backlog", "unstarted", "started"] } } }
      first: 50
    ) {
      nodes {
        id
        title
        identifier
        description
        state {
          id
          name
          color
          type
        }
        priority
        assignee {
          name
          avatarUrl
        }
        project {
          id
          name
        }
        projectMilestone {
          id
          name
          project {
            id
            name
          }
        }
        createdAt
        updatedAt
      }
    }
  }
`;

const FETCH_VIEWER_TEAMS_QUERY = `
  query {
    viewer {
      id
      teams {
        nodes {
          id
          name
        }
      }
    }
  }
`;

const CREATE_ISSUE_MUTATION = `
  mutation($teamId: String!, $title: String!, $description: String) {
    issueCreate(
      input: {
        teamId: $teamId
        title: $title
        description: $description
      }
    ) {
      success
      issue {
        id
        identifier
        title
        url
      }
    }
  }
`;

// =============================================================================
// Helper Functions
// =============================================================================

async function graphqlRequest<T>(
  apiKey: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<{ data?: T; errors?: Array<{ message: string }> }> {
  const response = await fetch(LINEAR_API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: apiKey,
    },
    body: JSON.stringify({ query, variables }),
  });

  return response.json();
}

// =============================================================================
// Service Implementation
// =============================================================================

class LinearService implements ILinearService {
  /**
   * Fetch all projects (first 100)
   */
  async fetchProjects(apiKey: string): Promise<FetchProjectsResponse> {
    try {
      const result = await graphqlRequest<{
        projects: { nodes: LinearProject[] };
      }>(apiKey, FETCH_PROJECTS_QUERY);

      if (result.errors?.length) {
        return {
          success: false,
          error: result.errors[0].message,
        };
      }

      return {
        success: true,
        projects: result.data?.projects?.nodes || [],
      };
    } catch (error) {
      console.error('[LinearService] Error fetching projects:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Fetch issues with state filter
   */
  async fetchIssues(apiKey: string): Promise<FetchIssuesResponse> {
    try {
      const result = await graphqlRequest<{
        viewer?: { organization?: { name: string } };
        issues: { nodes: LinearIssue[] };
      }>(apiKey, FETCH_ISSUES_QUERY);

      if (result.errors?.length) {
        return {
          success: false,
          error: result.errors[0].message,
        };
      }

      const workspaceName = result.data?.viewer?.organization?.name ?? '';
      const issues = result.data?.issues?.nodes || [];

      return {
        success: true,
        issues,
        workspaceName,
      };
    } catch (error) {
      console.error('[LinearService] Error fetching issues:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create a new ticket
   * Two-phase: first queries teams, then creates issue
   */
  async createTicket(
    apiKey: string,
    title: string,
    description?: string
  ): Promise<CreateTicketResponse> {
    try {
      // Phase 1: Get teams to find a valid team ID
      const teamsResult = await graphqlRequest<{
        viewer: LinearViewer;
      }>(apiKey, FETCH_VIEWER_TEAMS_QUERY);

      if (teamsResult.errors?.length) {
        return {
          success: false,
          error: teamsResult.errors[0].message,
        };
      }

      const teams = teamsResult.data?.viewer?.teams?.nodes || [];
      if (teams.length === 0) {
        return {
          success: false,
          error: 'No teams found in Linear workspace',
        };
      }

      // Use the first team
      const teamId = teams[0].id;

      // Phase 2: Create the issue
      const createResult = await graphqlRequest<{
        issueCreate: {
          success: boolean;
          issue?: {
            id: string;
            identifier: string;
            title: string;
            url: string;
          };
        };
      }>(apiKey, CREATE_ISSUE_MUTATION, {
        teamId,
        title,
        description: description || null,
      });

      if (createResult.errors?.length) {
        return {
          success: false,
          error: createResult.errors[0].message,
        };
      }

      if (!createResult.data?.issueCreate?.success) {
        return {
          success: false,
          error: 'Failed to create issue',
        };
      }

      const issue = createResult.data.issueCreate.issue!;
      return {
        success: true,
        issue,
      };
    } catch (error) {
      console.error('[LinearService] Error creating ticket:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

export const linearService: ILinearService = new LinearService();
