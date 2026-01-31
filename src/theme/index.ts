// TrafikTaxa Driver App - Unified Design System
// Professional Theme for 10/10 UI/UX

export const colors = {
  // Primary Brand Colors
  primary: {
    50: '#e6f2ff',
    100: '#b3d9ff',
    200: '#80bfff',
    300: '#4da6ff',
    400: '#1a8cff',
    500: '#007bff', // Main primary
    600: '#0066cc',
    700: '#0052a3',
    800: '#003d7a',
    900: '#002952',
  },
  
  // Success/Online Colors
  success: {
    50: '#d4edda',
    100: '#c3e6cb',
    200: '#a8d5b3',
    300: '#8bc49a',
    400: '#6eb381',
    500: '#28a745', // Main success
    600: '#23913d',
    700: '#1e7d34',
    800: '#19692b',
    900: '#145522',
  },
  
  // Danger/Offline Colors
  danger: {
    50: '#f8d7da',
    100: '#f5c6cb',
    200: '#f1b0b7',
    300: '#ed9aa3',
    400: '#e9848f',
    500: '#dc3545', // Main danger
    600: '#c82333',
    700: '#bd2130',
    800: '#a71d2a',
    900: '#921b24',
  },
  
  // Warning/Busy Colors
  warning: {
    50: '#fff3cd',
    100: '#ffeaa7',
    200: '#ffe082',
    300: '#ffd65c',
    400: '#ffcc36',
    500: '#ffc107', // Main warning
    600: '#e6ad06',
    700: '#cc9a05',
    800: '#b38704',
    900: '#997403',
  },
  
  // Info Colors
  info: {
    50: '#d1ecf1',
    100: '#bee5eb',
    200: '#a8dce5',
    300: '#92d3df',
    400: '#7ccad9',
    500: '#17a2b8', // Main info
    600: '#148a9c',
    700: '#117280',
    800: '#0e5a64',
    900: '#0b4248',
  },
  
  // Neutral Colors - Light Mode
  light: {
    background: '#f8f9fa',
    surface: '#ffffff',
    surfaceVariant: '#f1f3f4',
    border: '#e1e4e8',
    borderLight: '#f0f0f0',
    text: '#1a1a2e',
    textSecondary: '#6c757d',
    textTertiary: '#adb5bd',
    disabled: '#dee2e6',
  },
  
  // Neutral Colors - Dark Mode
  dark: {
    background: '#0f0f0f',
    surface: '#1a1a1a',
    surfaceVariant: '#252525',
    border: '#333333',
    borderLight: '#2a2a2a',
    text: '#ffffff',
    textSecondary: '#a0a0a0',
    textTertiary: '#666666',
    disabled: '#404040',
  },
  
  // Special Colors
  gold: '#ffd700',
  silver: '#c0c0c0',
  bronze: '#cd7f32',
};

// Typography System
export const typography = {
  fontFamily: {
    regular: 'System',
    medium: 'System',
    bold: 'System',
  },
  
  sizes: {
    xs: 10,
    sm: 12,
    base: 14,
    md: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
  
  lineHeight: {
    none: 1,
    tight: 1.25,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
  },
  
  weight: {
    light: '300',
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },
};

// Spacing System
export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  9: 36,
  10: 40,
  11: 44,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
  24: 96,
};

// Border Radius System
export const borderRadius = {
  none: 0,
  sm: 4,
  base: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  full: 9999,
};

// Shadows System
export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  base: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 12,
  },
  '2xl': {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 18,
  },
};

// Helper function to get colors based on theme
export const getThemeColors = (isDarkMode: boolean) => ({
  ...colors,
  neutral: isDarkMode ? colors.dark : colors.light,
});

// Animation Configurations
export const animations = {
  // Durations in milliseconds
  duration: {
    fast: 150,
    normal: 300,
    slow: 500,
    slower: 700,
  },
  
  // Easing functions
  easing: {
    linear: 'linear',
    ease: 'ease',
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out',
    spring: 'spring',
  },
  
  // Scale values
  scale: {
    sm: 0.95,
    base: 1,
    lg: 1.05,
    xl: 1.1,
  },
};

// Common Component Styles
export const componentStyles = {
  button: {
    primary: {
      backgroundColor: colors.primary[500],
      borderRadius: borderRadius.lg,
      paddingVertical: spacing[4],
      paddingHorizontal: spacing[6],
      ...shadows.md,
    },
    secondary: {
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderColor: colors.primary[500],
      borderRadius: borderRadius.lg,
      paddingVertical: spacing[3],
      paddingHorizontal: spacing[6],
    },
    danger: {
      backgroundColor: colors.danger[500],
      borderRadius: borderRadius.lg,
      paddingVertical: spacing[4],
      paddingHorizontal: spacing[6],
      ...shadows.md,
    },
    success: {
      backgroundColor: colors.success[500],
      borderRadius: borderRadius.lg,
      paddingVertical: spacing[4],
      paddingHorizontal: spacing[6],
      ...shadows.md,
    },
    ghost: {
      backgroundColor: 'transparent',
      borderRadius: borderRadius.lg,
      paddingVertical: spacing[4],
      paddingHorizontal: spacing[6],
    },
  },
  
  card: {
    default: {
      backgroundColor: colors.light.surface,
      borderRadius: borderRadius.xl,
      padding: spacing[5],
      ...shadows.base,
    },
    elevated: {
      backgroundColor: colors.light.surface,
      borderRadius: borderRadius.xl,
      padding: spacing[5],
      ...shadows.lg,
    },
    outlined: {
      backgroundColor: colors.light.surface,
      borderRadius: borderRadius.xl,
      padding: spacing[5],
      borderWidth: 1,
      borderColor: colors.light.border,
    },
  },
  
  input: {
    default: {
      height: 56,
      borderWidth: 1.5,
      borderColor: colors.light.border,
      borderRadius: borderRadius.lg,
      paddingHorizontal: spacing[4],
      fontSize: typography.sizes.md,
      backgroundColor: colors.light.surface,
    },
    focused: {
      borderColor: colors.primary[500],
      ...shadows.sm,
    },
    error: {
      borderColor: colors.danger[500],
    },
  },
};

// Status Colors Helper
export const getStatusColors = (status: string) => {
  switch (status.toLowerCase()) {
    case 'online':
    case 'available':
    case 'completed':
    case 'active':
      return colors.success[500];
    case 'busy':
    case 'pending':
    case 'dispatched':
      return colors.warning[500];
    case 'offline':
    case 'cancelled':
    case 'banned':
      return colors.danger[500];
    case 'picked_up':
    case 'ongoing':
      return colors.info[500];
    default:
      return colors.light.textSecondary;
  }
};

export default {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  animations,
  componentStyles,
  getThemeColors,
  getStatusColors,
};
