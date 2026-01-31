import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows } from '../theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'outline';
  size?: 'small' | 'medium' | 'large';
  fullWidth?: boolean;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  style?: any;
  textStyle?: any;
  isDarkMode?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  fullWidth = false,
  loading = false,
  disabled = false,
  icon,
  iconPosition = 'left',
  style,
  textStyle,
  isDarkMode = false,
}) => {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
      friction: 8,
      tension: 100,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 8,
      tension: 100,
    }).start();
  };

  const getVariantStyles = () => {
    const neutralColors = isDarkMode ? colors.dark : colors.light;
    
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: colors.primary[500],
          borderColor: colors.primary[500],
          textColor: '#ffffff',
        };
      case 'secondary':
        return {
          backgroundColor: 'transparent',
          borderColor: colors.primary[500],
          textColor: colors.primary[500],
        };
      case 'danger':
        return {
          backgroundColor: colors.danger[500],
          borderColor: colors.danger[500],
          textColor: '#ffffff',
        };
      case 'success':
        return {
          backgroundColor: colors.success[500],
          borderColor: colors.success[500],
          textColor: '#ffffff',
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          borderColor: 'transparent',
          textColor: colors.primary[500],
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderColor: neutralColors.border,
          textColor: neutralColors.text,
        };
      default:
        return {
          backgroundColor: colors.primary[500],
          borderColor: colors.primary[500],
          textColor: '#ffffff',
        };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          paddingVertical: spacing[2],
          paddingHorizontal: spacing[4],
          fontSize: typography.sizes.sm,
        };
      case 'large':
        return {
          paddingVertical: spacing[5],
          paddingHorizontal: spacing[8],
          fontSize: typography.sizes.lg,
        };
      case 'medium':
      default:
        return {
          paddingVertical: spacing[4],
          paddingHorizontal: spacing[6],
          fontSize: typography.sizes.base,
        };
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();
  const hasBorder = variant === 'secondary' || variant === 'outline';

  return (
    <Animated.View
      style={[
        { transform: [{ scale: scaleAnim }] },
        fullWidth && { width: '100%' },
      ]}
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        activeOpacity={0.8}
        style={[
          styles.button,
          {
            backgroundColor: variantStyles.backgroundColor,
            borderColor: variantStyles.borderColor,
            borderWidth: hasBorder ? 2 : 0,
            paddingVertical: sizeStyles.paddingVertical,
            paddingHorizontal: sizeStyles.paddingHorizontal,
            opacity: disabled ? 0.5 : 1,
          },
          variant !== 'ghost' && variant !== 'outline' && shadows.md,
          fullWidth && { width: '100%' },
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={variantStyles.textColor} size="small" />
        ) : (
          <View style={styles.content}>
            {icon && iconPosition === 'left' && (
              <Ionicons
                name={icon}
                size={sizeStyles.fontSize + 4}
                color={variantStyles.textColor}
                style={{ marginRight: spacing[2] }}
              />
            )}
            <Text
              style={[
                styles.text,
                {
                  color: variantStyles.textColor,
                  fontSize: sizeStyles.fontSize,
                },
                textStyle,
              ]}
            >
              {title}
            </Text>
            {icon && iconPosition === 'right' && (
              <Ionicons
                name={icon}
                size={sizeStyles.fontSize + 4}
                color={variantStyles.textColor}
                style={{ marginLeft: spacing[2] }}
              />
            )}
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: typography.weight.semibold as any,
    textAlign: 'center',
  },
});

export default Button;
