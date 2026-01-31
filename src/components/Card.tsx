import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  Animated,
} from 'react-native';
import { colors, spacing, borderRadius, shadows } from '../theme';

interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined' | 'flat';
  padding?: 'none' | 'small' | 'medium' | 'large';
  onPress?: () => void;
  style?: ViewStyle;
  isDarkMode?: boolean;
  animated?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  padding = 'medium',
  onPress,
  style,
  isDarkMode = false,
  animated = false,
}) => {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const neutralColors = isDarkMode ? colors.dark : colors.light;

  const handlePressIn = () => {
    if (animated) {
      Animated.spring(scaleAnim, {
        toValue: 0.98,
        useNativeDriver: true,
        friction: 8,
        tension: 100,
      }).start();
    }
  };

  const handlePressOut = () => {
    if (animated) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 8,
        tension: 100,
      }).start();
    }
  };

  const getVariantStyles = (): ViewStyle => {
    switch (variant) {
      case 'elevated':
        return {
          backgroundColor: neutralColors.surface,
          ...shadows.lg,
        };
      case 'outlined':
        return {
          backgroundColor: neutralColors.surface,
          borderWidth: 1,
          borderColor: neutralColors.border,
          ...shadows.none,
        };
      case 'flat':
        return {
          backgroundColor: neutralColors.surfaceVariant,
          ...shadows.none,
        };
      case 'default':
      default:
        return {
          backgroundColor: neutralColors.surface,
          ...shadows.base,
        };
    }
  };

  const getPaddingStyles = (): ViewStyle => {
    switch (padding) {
      case 'none':
        return { padding: 0 };
      case 'small':
        return { padding: spacing[3] };
      case 'large':
        return { padding: spacing[6] };
      case 'medium':
      default:
        return { padding: spacing[5] };
    }
  };

  const cardContent = (
    <View
      style={[
        styles.card,
        getVariantStyles(),
        getPaddingStyles(),
        style,
      ]}
    >
      {children}
    </View>
  );

  if (onPress) {
    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.9}
        >
          {cardContent}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return cardContent;
};

// Card Header Component
interface CardHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  isDarkMode?: boolean;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  title,
  subtitle,
  icon,
  action,
  isDarkMode = false,
}) => {
  const neutralColors = isDarkMode ? colors.dark : colors.light;

  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        {icon && <View style={styles.iconContainer}>{icon}</View>}
        <View>
          <Text
            style={[
              styles.title,
              { color: neutralColors.text },
            ]}
          >
            {title}
          </Text>
          {subtitle && (
            <Text
              style={[
                styles.subtitle,
                { color: neutralColors.textSecondary },
              ]}
            >
              {subtitle}
            </Text>
          )}
        </View>
      </View>
      {action && <View>{action}</View>}
    </View>
  );
};

// Card Footer Component
interface CardFooterProps {
  children: React.ReactNode;
  isDarkMode?: boolean;
}

export const CardFooter: React.FC<CardFooterProps> = ({
  children,
  isDarkMode = false,
}) => {
  const neutralColors = isDarkMode ? colors.dark : colors.light;

  return (
    <View
      style={[
        styles.footer,
        { borderTopColor: neutralColors.border },
      ]}
    >
      {children}
    </View>
  );
};

// Need to import Text for CardHeader
import { Text } from 'react-native';

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    marginRight: spacing[3],
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  footer: {
    marginTop: spacing[4],
    paddingTop: spacing[4],
    borderTopWidth: 1,
  },
});

export default Card;
