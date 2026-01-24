import { create } from 'zustand';

const DEBOUNCE_MS = 150;

interface BranchSearchState {
  /** Raw search term (updates immediately on input) */
  searchTerm: string;
  /** Debounced search term (updates after delay) */
  debouncedSearchTerm: string;
  /** Internal debounce timer ID */
  _debounceTimer: ReturnType<typeof setTimeout> | null;
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
  _debounceTimer: null,

  // Actions
  setSearchTerm: (term) => {
    const state = get();

    // Clear existing timer
    if (state._debounceTimer) {
      clearTimeout(state._debounceTimer);
    }

    // Update raw term immediately
    set({ searchTerm: term });

    // Set up debounced update
    const timer = setTimeout(() => {
      set({ debouncedSearchTerm: term, _debounceTimer: null });
    }, DEBOUNCE_MS);

    set({ _debounceTimer: timer });
  },

  reset: () => {
    const state = get();
    if (state._debounceTimer) {
      clearTimeout(state._debounceTimer);
    }
    set({
      searchTerm: '',
      debouncedSearchTerm: '',
      _debounceTimer: null,
    });
  },

  filterBranches: (branches) => {
    const { debouncedSearchTerm } = get();
    if (!debouncedSearchTerm) return branches;

    const term = debouncedSearchTerm.toLowerCase();
    return branches.filter((branch) => branch.toLowerCase().includes(term));
  },
}));
