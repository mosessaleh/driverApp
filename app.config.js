const fs = require('fs');
const path = require('path');
const appJson = require('./app.json');

module.exports = ({ config }) => {
  const baseConfig = appJson.expo || {};
  const googleServicesFileFromEnv = process.env.GOOGLE_SERVICES_JSON?.trim();
  const isEasBuild = process.env.EAS_BUILD === '1' || process.env.CI === '1';

  if (isEasBuild && !googleServicesFileFromEnv) {
    throw new Error(
      'Missing GOOGLE_SERVICES_JSON file environment variable for EAS Build. ' +
      'Create it as a File variable in EAS and assign it to the active build profile environment.'
    );
  }

  const fallbackGoogleServicesFile =
    config?.android?.googleServicesFile || baseConfig.android?.googleServicesFile;

  const resolvedGoogleServicesFile =
    googleServicesFileFromEnv || (!isEasBuild ? fallbackGoogleServicesFile : undefined);

  if (resolvedGoogleServicesFile) {
    const absoluteGoogleServicesPath = path.isAbsolute(resolvedGoogleServicesFile)
      ? resolvedGoogleServicesFile
      : path.join(__dirname, resolvedGoogleServicesFile);

    if (!fs.existsSync(absoluteGoogleServicesPath)) {
      throw new Error(
        `google-services.json file was not found at: ${absoluteGoogleServicesPath}. ` +
          'Ensure GOOGLE_SERVICES_JSON is configured correctly for this build profile/environment.'
      );
    }
  }

  return {
    ...baseConfig,
    ...config,
    android: {
      ...(baseConfig.android || {}),
      ...(config?.android || {}),
      googleServicesFile: resolvedGoogleServicesFile,
    },
  };
};

