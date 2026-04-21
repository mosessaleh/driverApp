const fs = require('fs');
const path = require('path');
const appJson = require('./app.json');

const loadLocalEnv = () => {
  const envFilePath = path.join(__dirname, '.env');

  if (!fs.existsSync(envFilePath)) {
    return;
  }

  const envLines = fs.readFileSync(envFilePath, 'utf8').split(/\r?\n/);

  for (const rawLine of envLines) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');

    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && process.env[key] == null) {
      process.env[key] = value;
    }
  }
};

loadLocalEnv();

module.exports = ({ config }) => {
  const baseConfig = appJson.expo || {};
  const googleServicesFileFromEnv = process.env.GOOGLE_SERVICES_JSON?.trim();
  const googleMapsApiKey =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  const isEasBuild = process.env.EAS_BUILD === '1' || process.env.CI === '1';

  const fallbackGoogleServicesFile =
    config?.android?.googleServicesFile || baseConfig.android?.googleServicesFile;

  let resolvedGoogleServicesFile = googleServicesFileFromEnv || fallbackGoogleServicesFile;

  if (resolvedGoogleServicesFile) {
    const absoluteGoogleServicesPath = path.isAbsolute(resolvedGoogleServicesFile)
      ? resolvedGoogleServicesFile
      : path.join(__dirname, resolvedGoogleServicesFile);

    if (!fs.existsSync(absoluteGoogleServicesPath)) {
      if (googleServicesFileFromEnv || !isEasBuild) {
        throw new Error(
          `google-services.json file was not found at: ${absoluteGoogleServicesPath}. ` +
            'Ensure GOOGLE_SERVICES_JSON is configured correctly for this build profile/environment.'
        );
      }

      console.warn(
        'android.googleServicesFile is not available in the EAS build context. ' +
          'Continuing without googleServicesFile. Configure GOOGLE_SERVICES_JSON as an EAS File variable to enable Firebase config on cloud builds.'
      );
      resolvedGoogleServicesFile = undefined;
    }
  } else if (isEasBuild) {
    console.warn(
      'GOOGLE_SERVICES_JSON is not set for this EAS build. ' +
        'Continuing without android.googleServicesFile. Configure it as an EAS File variable if Firebase is required.'
    );
  }

  if (!googleMapsApiKey) {
    if (!isEasBuild) {
      throw new Error(
        'Missing EXPO_PUBLIC_GOOGLE_MAPS_API_KEY environment variable. ' +
          'Define it in .env for local development and in EAS environment variables for cloud builds.'
      );
    }

    console.warn(
      'EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is not set for this EAS build. ' +
        'Continuing without embedding a Google Maps API key in native config.'
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
        ...(googleMapsApiKey ? { googleMapsApiKey } : {}),
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
          ...(googleMapsApiKey ? { apiKey: googleMapsApiKey } : {}),
        },
      },
      ...(resolvedGoogleServicesFile ? { googleServicesFile: resolvedGoogleServicesFile } : {}),
    },
  };
};

