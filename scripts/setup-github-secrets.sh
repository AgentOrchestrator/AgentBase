#!/bin/bash
# Set up GitHub repository secrets for desktop release workflow
# This script reads credentials from .secrets and uploads them to GitHub

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== Setting up GitHub Secrets for Desktop Release ===${NC}\n"

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}Error: GitHub CLI (gh) is not installed${NC}"
    echo "Install it with: brew install gh"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo -e "${RED}Error: Not authenticated with GitHub CLI${NC}"
    echo "Run: gh auth login"
    exit 1
fi

# Check if .secrets file exists
if [ ! -f .secrets ]; then
    echo -e "${RED}Error: .secrets file not found${NC}"
    echo "Please create .secrets file with your Apple signing credentials"
    exit 1
fi

echo -e "${BLUE}Loading credentials from .secrets...${NC}"
source .secrets

# Verify required credentials
MISSING=false

if [ -z "$CSC_LINK" ]; then
    echo -e "${RED}✗ CSC_LINK not set${NC}"
    MISSING=true
else
    echo -e "${GREEN}✓ CSC_LINK found${NC}"
fi

if [ -z "$CSC_KEY_PASSWORD" ]; then
    echo -e "${RED}✗ CSC_KEY_PASSWORD not set${NC}"
    MISSING=true
else
    echo -e "${GREEN}✓ CSC_KEY_PASSWORD found${NC}"
fi

if [ -z "$APPLE_API_KEY" ]; then
    echo -e "${RED}✗ APPLE_API_KEY not set${NC}"
    MISSING=true
elif [ ! -f "$APPLE_API_KEY" ]; then
    echo -e "${RED}✗ APPLE_API_KEY file not found: $APPLE_API_KEY${NC}"
    MISSING=true
else
    echo -e "${GREEN}✓ APPLE_API_KEY file found${NC}"
fi

if [ -z "$APPLE_API_ISSUER" ]; then
    echo -e "${RED}✗ APPLE_API_ISSUER not set${NC}"
    MISSING=true
else
    echo -e "${GREEN}✓ APPLE_API_ISSUER found${NC}"
fi

if [ -z "$APPLE_API_KEY_ID" ]; then
    echo -e "${RED}✗ APPLE_API_KEY_ID not set${NC}"
    MISSING=true
else
    echo -e "${GREEN}✓ APPLE_API_KEY_ID found${NC}"
fi

if [ "$MISSING" = true ]; then
    echo -e "\n${RED}Error: Missing required credentials${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}This will upload your Apple signing credentials to GitHub repository secrets.${NC}"
echo -e "${YELLOW}These secrets will be used by GitHub Actions to sign and notarize your app.${NC}"
echo ""
read -p "Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo -e "${BLUE}Setting GitHub secrets...${NC}"

# Set CSC_LINK (code signing certificate)
echo -e "${BLUE}Setting CSC_LINK...${NC}"
echo "$CSC_LINK" | gh secret set CSC_LINK
echo -e "${GREEN}✓ CSC_LINK set${NC}"

# Set CSC_KEY_PASSWORD
echo -e "${BLUE}Setting CSC_KEY_PASSWORD...${NC}"
echo "$CSC_KEY_PASSWORD" | gh secret set CSC_KEY_PASSWORD
echo -e "${GREEN}✓ CSC_KEY_PASSWORD set${NC}"

# Set APPLE_API_KEY_CONTENT (read from .p8 file)
echo -e "${BLUE}Setting APPLE_API_KEY_CONTENT...${NC}"
cat "$APPLE_API_KEY" | gh secret set APPLE_API_KEY_CONTENT
echo -e "${GREEN}✓ APPLE_API_KEY_CONTENT set${NC}"

# Set APPLE_API_ISSUER
echo -e "${BLUE}Setting APPLE_API_ISSUER...${NC}"
echo "$APPLE_API_ISSUER" | gh secret set APPLE_API_ISSUER
echo -e "${GREEN}✓ APPLE_API_ISSUER set${NC}"

# Set APPLE_API_KEY_ID
echo -e "${BLUE}Setting APPLE_API_KEY_ID...${NC}"
echo "$APPLE_API_KEY_ID" | gh secret set APPLE_API_KEY_ID
echo -e "${GREEN}✓ APPLE_API_KEY_ID set${NC}"

echo ""
echo -e "${GREEN}✓ All secrets have been set successfully!${NC}"
echo ""
echo -e "${BLUE}Verifying secrets (will show name and last updated time):${NC}"
gh secret list

echo ""
echo -e "${GREEN}Setup complete!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Test the workflow with: gh workflow run desktop-release.yml -f tag=v1.0.1-test"
echo "2. Check workflow status with: gh run list --workflow=desktop-release.yml"
echo "3. View logs with: gh run view --log"
