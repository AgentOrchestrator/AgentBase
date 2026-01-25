import { create } from 'zustand';

const DEBOUNCE_MS = 150;

// Closure variable to store debounce timer (not in Zustand state to avoid
// unnecessary re-renders and issues with devtools/persist middleware)
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

interface BranchSearchState {
  /** Raw search term (updates immediately on input) */
  searchTerm: string;
  /** Debounced search term (updates after delay) */
  debouncedSearchTerm: string;
}

interface BranchSearchActions {
  /** Set search term and trigger debounced update */
  setSearchTerm: (term: string) => void;
  /** Clear search state (call when dropdown closes) */
  reset: () => void;
  /** Filter branches based on debounced search term */
  filterBranches: (branches: string[]) => string[];
}

export type BranchSearchStore = BranchSearchState & BranchSearchActions;

export const useBranchSearch = create<BranchSearchStore>((set, get) => ({
  // Initial state
  searchTerm: '',
  debouncedSearchTerm: '',

  // Actions
  setSearchTerm: (term) => {
    // Clear existing timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    // Update raw term immediately
    set({ searchTerm: term });

    // Set up debounced update
    debounceTimer = setTimeout(() => {
      set({ debouncedSearchTerm: term });
      debounceTimer = null;
    }, DEBOUNCE_MS);
  },

  reset: () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    set({
      searchTerm: '',
      debouncedSearchTerm: '',
    });
  },

  filterBranches: (branches) => {
    const { debouncedSearchTerm } = get();
    if (!debouncedSearchTerm) return branches;

    const term = debouncedSearchTerm.toLowerCase();
    return branches.filter((branch) => branch.toLowerCase().includes(term));
  },
}));
