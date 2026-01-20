#!/bin/bash
#
# lint-no-silent-returns.sh
#
# Detects "return undefined" patterns that hide failures inside functions:
# - if (!x) return undefined;
# - return undefined;
#
# These patterns violate the project rule: "Never use defensive defaults.
# Let the code fail explicitly."
#
# ALLOWED:
# - `return null` (idiomatic for React conditional rendering)
# - Ternary at call site: `x ? fn(x) : undefined` (explicit caller handling)
# - Map.get(), Array.find(), etc. that naturally return undefined
#
# Usage:
#   ./scripts/lint-no-silent-returns.sh           # Check all staged files
#   ./scripts/lint-no-silent-returns.sh --all     # Check all source files

set -e

RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Pattern: explicit "return undefined" statement
# This catches both guard clauses and direct returns
PATTERN='return\s+undefined\s*;?\s*$'

# Get files to check
if [ "$1" = "--all" ]; then
  FILES=$(find apps packages -name "*.ts" -o -name "*.tsx" 2>/dev/null | grep -v node_modules | grep -v dist || true)
else
  # Check only staged files
  FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx)$' || true)
fi

if [ -z "$FILES" ]; then
  exit 0
fi

FOUND_ISSUES=0

for file in $FILES; do
  if [ -f "$file" ]; then
    # Check pattern
    MATCHES=$(grep -nE "$PATTERN" "$file" 2>/dev/null || true)

    if [ -n "$MATCHES" ]; then
      if [ $FOUND_ISSUES -eq 0 ]; then
        echo -e "${RED}Error: 'return undefined' patterns detected${NC}"
        echo -e "${YELLOW}These patterns hide failures instead of failing explicitly.${NC}"
        echo ""
      fi

      echo -e "${RED}$file${NC}"
      echo "$MATCHES" | while read -r line; do
        echo "  $line"
      done
      echo ""

      FOUND_ISSUES=1
    fi
  fi
done

if [ $FOUND_ISSUES -eq 1 ]; then
  echo -e "${YELLOW}Fix: Replace 'return undefined' with explicit error handling:${NC}"
  echo ""
  echo "  // Instead of:"
  echo "  if (!value) return undefined;"
  echo ""
  echo "  // Options:"
  echo "  1. Throw: if (!value) throw new Error('value required');"
  echo "  2. Require valid input: change signature to not accept null/undefined"
  echo "  3. Let data structures handle it: Map.get() returns undefined naturally"
  echo ""
  exit 1
fi

exit 0
