#!/bin/bash
#
# lint-no-silent-returns.sh
#
# Detects "silent return undefined" guard patterns that hide failures:
# - if (!x) return undefined;
# - if (x === null) return undefined;
#
# These patterns violate the project rule: "Never use defensive defaults.
# Let the code fail explicitly."
#
# ALLOWED (not flagged):
# - Ternary expressions: `return x ? value : undefined;`
# - `return null` (idiomatic for React conditional rendering)
#
# Usage:
#   ./scripts/lint-no-silent-returns.sh           # Check all staged files
#   ./scripts/lint-no-silent-returns.sh --all     # Check all source files

set -e

RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Pattern: if-statement guard followed by return undefined
# Matches: if (!x) return undefined;  |  if (x == null) return undefined;
# Does NOT match: return x ? y : undefined;  (ternary)
PATTERN='if\s*\([^)]+\)\s*return\s+undefined'

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
    # Use grep to find matches with line numbers
    MATCHES=$(grep -nE "$PATTERN" "$file" 2>/dev/null || true)

    if [ -n "$MATCHES" ]; then
      if [ $FOUND_ISSUES -eq 0 ]; then
        echo -e "${RED}Error: Silent 'if (...) return undefined' guard patterns detected${NC}"
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
  echo -e "${YELLOW}Fix: Replace silent guard returns with explicit handling:${NC}"
  echo ""
  echo "  // Instead of:"
  echo "  if (!value) return undefined;"
  echo ""
  echo "  // Do one of:"
  echo "  if (!value) throw new Error('value is required');"
  echo "  // or use a ternary (allowed):"
  echo "  return value ? doSomething(value) : undefined;"
  echo "  // or let TypeScript enforce handling at call site"
  echo ""
  exit 1
fi

exit 0
