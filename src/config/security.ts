export const isDevelopmentBuild = (): boolean => {
  return typeof __DEV__ !== 'undefined' && __DEV__;
};

export const devLog = (...args: any[]) => {
  if (isDevelopmentBuild()) {
    console.log(...args);
  }
};

export const devWarn = (...args: any[]) => {
  if (isDevelopmentBuild()) {
    console.warn(...args);
  }
};

