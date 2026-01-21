const { notarize } = require('@electron/notarize');
const path = require('node:path');

/**
 * Notarize the macOS application with Apple
 * This runs after signing and before packaging
 */
exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;

  // Only notarize macOS builds
  if (electronPlatformName !== 'darwin') {
    return;
  }

  // Skip if no signing credentials (local development)
  if (!process.env.CSC_LINK) {
    console.log('Skipping notarization (no CSC_LINK found - local development mode)');
    return;
  }

  // Check for required notarization credentials
  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_ID_PASSWORD;
  const appleTeamId = process.env.APPLE_TEAM_ID;
  const appleApiKey = process.env.APPLE_API_KEY;
  const appleApiKeyId = process.env.APPLE_API_KEY_ID;
  const appleApiIssuer = process.env.APPLE_API_ISSUER;

  const hasAppleIdAuth = appleId && appleIdPassword && appleTeamId;
  const hasApiKeyAuth = appleApiKey && appleApiKeyId && appleApiIssuer;

  if (!hasAppleIdAuth && !hasApiKeyAuth) {
    console.warn('Skipping notarization: No valid Apple credentials found');
    console.warn('Set either:');
    console.warn('  - APPLE_ID, APPLE_ID_PASSWORD, APPLE_TEAM_ID (legacy method)');
    console.warn('  - APPLE_API_KEY, APPLE_API_KEY_ID, APPLE_API_ISSUER (recommended)');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  console.log(`Notarizing ${appPath}...`);

  try {
    // Build notarization config
    const notarizeConfig = {
      appPath,
    };

    // Use API Key method (preferred) - teamId not needed, issuer identifies the team
    if (hasApiKeyAuth) {
      console.log('Using App Store Connect API Key for notarization');
      notarizeConfig.appleApiKey = appleApiKey;
      notarizeConfig.appleApiKeyId = appleApiKeyId;
      notarizeConfig.appleApiIssuer = appleApiIssuer;
    }
    // Fall back to Apple ID method - requires teamId
    else {
      console.log('Using Apple ID for notarization (consider upgrading to API Key method)');
      notarizeConfig.appleId = appleId;
      notarizeConfig.appleIdPassword = appleIdPassword;
      notarizeConfig.teamId = appleTeamId;
    }

    await notarize(notarizeConfig);
    console.log('Notarization complete!');
  } catch (error) {
    // Check if this is a stapling error (happens when Apple hasn't finished processing)
    if (error.message?.includes('staple')) {
      console.warn('⚠️  Stapling failed - Apple may still be processing the notarization');
      console.warn('   The app was successfully submitted for notarization.');
      console.warn('   Stapling will happen automatically when users download the app.');
      console.warn('   Or you can manually staple later with:');
      console.warn(`   xcrun stapler staple "${appPath}"`);
      // Don't fail the build for stapling errors
      return;
    }

    console.error('Notarization failed:', error);
    throw error;
  }
};
