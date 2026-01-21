#!/bin/bash
# Test the desktop release workflow locally using act
# This simulates the GitHub Actions workflow for building and signing the desktop app

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Agent Base Desktop Release Workflow Test ===${NC}\n"

# Check if act is installed
if ! command -v act &> /dev/null; then
    echo -e "${RED}Error: 'act' is not installed${NC}"
    echo "Install it with: brew install act"
    exit 1
fi

# Check if .secrets file exists
if [ ! -f .secrets ]; then
    echo -e "${YELLOW}Warning: .secrets file not found${NC}"
    echo "Please create .secrets file with your Apple signing credentials"
    echo "See .secrets (should be created) for template"
    exit 1
fi

# Check if required secrets are set
echo -e "${BLUE}Checking secrets configuration...${NC}"
source .secrets

if [ -z "$GITHUB_TOKEN" ]; then
    echo -e "${RED}Error: GITHUB_TOKEN not set in .secrets${NC}"
    exit 1
fi

if [ -z "$CSC_LINK" ]; then
    echo -e "${YELLOW}Warning: CSC_LINK not set - will use ad-hoc signing${NC}"
    echo "For real code signing, set CSC_LINK and CSC_KEY_PASSWORD"
fi

# Parse command line arguments
WORKFLOW="desktop-release"
EVENT="workflow_dispatch"
TAG="${1:-v1.0.0-test}"
DRY_RUN=false
VERBOSE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --tag)
            TAG="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --verbose|-v)
            VERBOSE="--verbose"
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS] [TAG]"
            echo ""
            echo "Options:"
            echo "  --tag TAG        Release tag to test (default: v1.0.0-test)"
            echo "  --dry-run        Show what would be executed without running"
            echo "  --verbose, -v    Enable verbose output"
            echo "  --help, -h       Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                    # Test with default tag v1.0.0-test"
            echo "  $0 --tag v1.2.3       # Test with specific tag"
            echo "  $0 --dry-run          # Show what would run without executing"
            exit 0
            ;;
        *)
            TAG="$1"
            shift
            ;;
    esac
done

echo -e "${GREEN}Configuration:${NC}"
echo "  Workflow: $WORKFLOW"
echo "  Event: $EVENT"
echo "  Tag: $TAG"
echo "  Dry run: $DRY_RUN"
echo ""

# Build act command
ACT_CMD="act $EVENT"
ACT_CMD="$ACT_CMD --workflows .github/workflows/${WORKFLOW}.yml"
ACT_CMD="$ACT_CMD --input tag=$TAG"
ACT_CMD="$ACT_CMD $VERBOSE"

# Add platform specification (act can't run macOS natively, so we use ubuntu)
# Note: This means actual code signing won't work in act, but we can test the workflow logic
ACT_CMD="$ACT_CMD -P macos-latest=catthehacker/ubuntu:act-latest"

if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}Dry run - would execute:${NC}"
    echo "$ACT_CMD"
    echo ""
    echo -e "${YELLOW}Note: Act runs workflows in Docker containers.${NC}"
    echo "macOS-specific features (code signing, notarization) will be simulated."
    echo "For full testing with real code signing, use GitHub Actions or a real macOS environment."
    exit 0
fi

echo -e "${BLUE}Running act...${NC}"
echo -e "${YELLOW}Note: This runs in a Linux container, so actual macOS code signing won't work.${NC}"
echo -e "${YELLOW}The workflow will test build logic but skip notarization.${NC}\n"

# Run act
eval $ACT_CMD

# Check result
if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}✓ Workflow test completed successfully!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Check apps/desktop/release/ for build artifacts"
    echo "  2. For real code signing test, push to GitHub and trigger workflow_dispatch"
    echo "  3. Or run 'npm run dist --workspace=desktop' locally with proper env vars"
else
    echo -e "\n${RED}✗ Workflow test failed${NC}"
    exit 1
fi
