# Code Signing and Release Workflow

This document explains how to set up and test the desktop app release workflow with Apple code signing and notarization.

## Overview

The desktop release workflow ([.github/workflows/desktop-release.yml](.github/workflows/desktop-release.yml)) builds and signs the Agent Base desktop application for macOS (with support for Windows and Linux planned).

**Key features:**
- Automatic code signing with Apple Developer certificates
- Notarization with Apple for Gatekeeper approval
- Release artifact upload to GitHub releases
- Local testing with `act`

## Prerequisites

### For Real Code Signing (Maintainers Only)

1. **Apple Developer Account**
   - Enrolled in Apple Developer Program ($99/year)
   - Access to App Store Connect

2. **Developer ID Application Certificate**
   - Used for signing apps distributed outside the Mac App Store
   - Created in Apple Developer portal

3. **App Store Connect API Key**
   - Recommended for automated notarization
   - Created in App Store Connect > Users and Access > Keys

## Setting Up Code Signing

### Step 1: Export Your Certificate

1. Open **Keychain Access** on macOS
2. Find your "Developer ID Application" certificate
3. Right-click → Export "Developer ID Application: Your Name"
4. Save as `.p12` file with a strong password
5. Convert to base64:
   ```bash
   base64 -i YourCertificate.p12 | pbcopy
   ```

### Step 2: Create App Store Connect API Key

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Navigate to Users and Access > Keys
3. Click the "+" button to create a new API key
4. Give it a name (e.g., "Agent Base Notarization")
5. Select "Developer" access
6. Download the `.p8` key file (you can only download it once!)
7. Note the **Key ID** and **Issuer ID**

### Step 3: Configure Secrets for GitHub Actions

**Automated Setup (Recommended):**

Run the automated script to upload all secrets from your `.secrets` file:

```bash
./scripts/setup-github-secrets-auto.sh
```

This will set up the following secrets in your GitHub repository:
- `CSC_LINK` - Base64 encoded .p12 certificate
- `CSC_KEY_PASSWORD` - Certificate password
- `APPLE_API_KEY_CONTENT` - Contents of the .p8 API key file
- `APPLE_API_KEY_ID` - Key ID from App Store Connect
- `APPLE_API_ISSUER` - Issuer ID from App Store Connect

**Manual Setup:**

Alternatively, add these secrets manually (Settings > Secrets and variables > Actions):

```bash
# Required for code signing
CSC_LINK=<base64 encoded .p12 certificate>
CSC_KEY_PASSWORD=<password for .p12 file>

# Required for notarization (API Key method)
APPLE_API_KEY_CONTENT=<contents of .p8 file>
APPLE_API_KEY_ID=<Key ID from App Store Connect>
APPLE_API_ISSUER=<Issuer ID from App Store Connect>

# Required for release uploads (automatically provided)
GITHUB_TOKEN=<automatically provided by GitHub Actions>
```

### Step 4: Configure Secrets for Local Testing

Create a `.secrets` file in the project root (already gitignored):

```bash
# Copy the template
cp .secrets .secrets

# Edit and fill in your credentials
# GITHUB_TOKEN - create at https://github.com/settings/tokens (repo scope)
# CSC_LINK - base64 encoded certificate
# CSC_KEY_PASSWORD - certificate password
# APPLE_API_KEY - path to .p8 file or contents
# APPLE_API_KEY_ID - from App Store Connect
# APPLE_API_ISSUER - from App Store Connect
```

## Testing the Release Workflow

### Option 1: Local Testing with act (Limited)

**Note:** `act` runs workflows in Linux Docker containers, so actual macOS code signing won't work. This is useful for testing workflow logic only.

```bash
# Install act
brew install act

# Run the test script
./scripts/test-release-workflow.sh

# Or with specific tag
./scripts/test-release-workflow.sh --tag v1.2.3

# See what would run without executing
./scripts/test-release-workflow.sh --dry-run

# Verbose output
./scripts/test-release-workflow.sh --verbose
```

**Limitations of act:**
- Can't run actual macOS builds (uses Linux container)
- Code signing and notarization will be skipped
- Good for testing workflow logic and environment setup
- Not suitable for testing actual signing/notarization

### Option 2: Local Build with Real Signing

Build locally on macOS with your credentials:

```bash
# Set environment variables (from .secrets)
export CSC_LINK="<base64 cert>"
export CSC_KEY_PASSWORD="<password>"
export APPLE_API_KEY="<path to .p8>"
export APPLE_API_KEY_ID="<key id>"
export APPLE_API_ISSUER="<issuer id>"

# Build and sign
npm run dist --workspace=desktop

# Check the signed app
codesign -dv --verbose=4 apps/desktop/release/mac/Agent\ Base.app
spctl -a -vv apps/desktop/release/mac/Agent\ Base.app
```

### Option 3: GitHub Actions (Full Testing)

Trigger the workflow manually on GitHub:

1. Go to Actions tab in your repository
2. Select "Desktop Release" workflow
3. Click "Run workflow"
4. Enter a tag (e.g., `v1.0.0-test`)
5. Click "Run workflow"

This will:
- Build on real macOS runner
- Sign with your certificates
- Notarize with Apple
- Upload artifacts to release

## Workflow Behavior

### Development Mode (No Signing)

If `CSC_LINK` is not set, the build will:
- Use ad-hoc signing (`-` identity)
- Skip notarization
- Build successfully but app won't pass Gatekeeper

### Release Mode (With Signing)

When `CSC_LINK` is set, the build will:
- Sign with Developer ID certificate
- Apply hardened runtime
- Include entitlements for required capabilities
- Notarize with Apple (takes 5-10 minutes)
- Create distributable DMG and ZIP

## Verifying Signed Apps

### Check Code Signature

```bash
# Display signature info
codesign -dv --verbose=4 "Agent Base.app"

# Verify signature
codesign --verify --deep --strict --verbose=2 "Agent Base.app"
```

### Check Notarization

```bash
# Check notarization ticket
spctl -a -vv "Agent Base.app"

# Should output: "source=Notarized Developer ID"
```

### Check Gatekeeper

```bash
# Test Gatekeeper assessment
spctl --assess --verbose=4 "Agent Base.app"
```

## Troubleshooting

### "No identity found" error

- Ensure `CSC_LINK` contains valid base64 certificate data
- Verify `CSC_KEY_PASSWORD` is correct
- Check certificate is "Developer ID Application" type

### Notarization fails

- Verify API Key credentials are correct
- Check `.p8` file is accessible
- Ensure app is properly signed before notarization
- Check Apple's notarization logs for specific errors

### "App is damaged" message on users' machines

- App likely not notarized
- Check notarization status with `spctl -a -vv`
- May need to re-notarize with correct credentials

### Act tests fail

- Remember act uses Linux containers, not real macOS
- Check workflow syntax errors
- Verify secrets file format
- Use `--verbose` flag for detailed output

## Files Reference

- [.github/workflows/desktop-release.yml](.github/workflows/desktop-release.yml) - Main release workflow
- [apps/desktop/electron-builder.config.js](apps/desktop/electron-builder.config.js) - Electron Builder config
- [apps/desktop/build-resources/entitlements.mac.plist](apps/desktop/build-resources/entitlements.mac.plist) - macOS entitlements
- [apps/desktop/scripts/notarize.js](apps/desktop/scripts/notarize.js) - Notarization script
- [scripts/test-release-workflow.sh](scripts/test-release-workflow.sh) - Local testing script
- `.secrets` - Local secrets (gitignored, for maintainers)
- [.actrc](.actrc) - Act configuration

## Security Notes

- **Never commit** `.secrets` file or actual credentials
- Use App Store Connect API Keys (not Apple ID passwords) for CI/CD
- Rotate credentials if accidentally exposed
- Keep `.p12` certificate files secure and backed up
- Use strong passwords for certificate export

## Resources

- [Electron Builder Code Signing](https://www.electron.build/code-signing)
- [Apple Notarization Guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [Act Documentation](https://github.com/nektos/act)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
