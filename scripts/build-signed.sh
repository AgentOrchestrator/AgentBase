#!/bin/bash
# Build and sign the desktop app locally with real Apple credentials
# This script sources .secrets and runs a signed production build

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Building Agent Base Desktop with Code Signing ===${NC}\n"

# Check if .secrets file exists
if [ ! -f .secrets ]; then
    echo -e "${RED}Error: .secrets file not found${NC}"
    echo "Please create .secrets file with your Apple signing credentials"
    exit 1
fi

# Load secrets from .secrets file
echo -e "${BLUE}Loading signing credentials from .secrets...${NC}"
export $(grep -v '^#' .secrets | grep -v '^$' | xargs)

# Verify required credentials
echo -e "${BLUE}Verifying credentials...${NC}"

if [ -z "$CSC_LINK" ]; then
    echo -e "${RED}Error: CSC_LINK not set in .secrets${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Code signing certificate found${NC}"

if [ -z "$CSC_KEY_PASSWORD" ]; then
    echo -e "${RED}Error: CSC_KEY_PASSWORD not set in .secrets${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Certificate password found${NC}"

# Check for notarization credentials (either API Key or Apple ID method)
HAS_API_KEY=false
HAS_APPLE_ID=false

if [ -n "$APPLE_API_KEY" ] && [ -n "$APPLE_API_ISSUER" ] && [ -n "$APPLE_API_KEY_ID" ]; then
    HAS_API_KEY=true
    echo -e "${GREEN}✓ Apple API Key credentials found${NC}"

    # Verify the .p8 file exists
    if [ ! -f "$APPLE_API_KEY" ]; then
        echo -e "${RED}Error: API Key file not found at: $APPLE_API_KEY${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ API Key file exists: $APPLE_API_KEY${NC}"
fi

if [ -n "$APPLE_ID" ] && [ -n "$APPLE_ID_PASSWORD" ] && [ -n "$APPLE_TEAM_ID" ]; then
    HAS_APPLE_ID=true
    echo -e "${GREEN}✓ Apple ID credentials found${NC}"
fi

if [ "$HAS_API_KEY" = false ] && [ "$HAS_APPLE_ID" = false ]; then
    echo -e "${YELLOW}Warning: No notarization credentials found${NC}"
    echo "The app will be signed but not notarized."
    echo "Users may see Gatekeeper warnings when opening the app."
    echo ""
    read -p "Continue without notarization? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    if [ "$HAS_API_KEY" = true ]; then
        echo -e "${GREEN}✓ Will notarize using App Store Connect API Key${NC}"
    else
        echo -e "${GREEN}✓ Will notarize using Apple ID${NC}"
    fi
fi

echo ""
echo -e "${BLUE}Starting build process...${NC}"
echo ""

# Build the desktop app
echo -e "${BLUE}Building desktop application...${NC}"
npm run dist --workspace=desktop

echo ""
echo -e "${GREEN}✓ Build completed successfully!${NC}"
echo ""

# Show build output
if [ -d "apps/desktop/release" ]; then
    echo -e "${BLUE}Build artifacts:${NC}"
    ls -lh apps/desktop/release/*.{dmg,zip} 2>/dev/null || echo "No DMG/ZIP files found"
    echo ""

    # Verify the code signature
    if [ -d "apps/desktop/release/mac"/*.app ]; then
        APP_PATH=$(find apps/desktop/release/mac -name "*.app" -type d | head -n 1)
        if [ -n "$APP_PATH" ]; then
            echo -e "${BLUE}Verifying code signature...${NC}"
            codesign -dv --verbose=4 "$APP_PATH" 2>&1 | grep -E "(Authority|Identifier|TeamIdentifier)" || true
            echo ""

            echo -e "${BLUE}Verifying Gatekeeper assessment...${NC}"
            spctl -a -vv "$APP_PATH" 2>&1 || true
            echo ""
        fi
    fi
fi

echo -e "${GREEN}Done! You can find the built app in apps/desktop/release/${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Test the app by opening the DMG"
echo "2. To verify notarization status:"
echo "   spctl -a -vv apps/desktop/release/mac/*.app"
echo "3. The app should show 'source=Notarized Developer ID' if notarization succeeded"
