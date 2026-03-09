const fs = require('fs');
const path = require('path');
const appJson = require('./app.json');

module.exports = ({ config }) => {
  const baseConfig = appJson.expo || {};
  const googleServicesFileFromEnv = process.env.GOOGLE_SERVICES_JSON?.trim();
  const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
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

  if (!googleMapsApiKey) {
    throw new Error(
      'Missing EXPO_PUBLIC_GOOGLE_MAPS_API_KEY environment variable. ' +
      'Define it in .env for local development and in EAS environment variables for cloud builds.'
    );
  }

  return {
    ...baseConfig,
    ...config,
    ios: {
      ...(baseConfig.ios || {}),
      ...(config?.ios || {}),
      config: {
        ...((baseConfig.ios && baseConfig.ios.config) || {}),
        ...((config?.ios && config.ios.config) || {}),
        googleMapsApiKey,
      },
    },
    android: {
      ...(baseConfig.android || {}),
      ...(config?.android || {}),
      config: {
        ...((baseConfig.android && baseConfig.android.config) || {}),
        ...((config?.android && config.android.config) || {}),
        googleMaps: {
          ...(((baseConfig.android && baseConfig.android.config && baseConfig.android.config.googleMaps) || {})),
          ...(((config?.android && config.android.config && config.android.config.googleMaps) || {})),
          apiKey: googleMapsApiKey,
        },
      },
      googleServicesFile: resolvedGoogleServicesFile,
    },
  };
};

