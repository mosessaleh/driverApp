import React from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  Animated,
  Dimensions,
} from 'react-native';
import { colors, typography, spacing } from '../theme';

const { width, height } = Dimensions.get('window');

interface LoadingProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
  text?: string;
  fullScreen?: boolean;
  isDarkMode?: boolean;
  overlay?: boolean;
}

export const Loading: React.FC<LoadingProps> = ({
  size = 'medium',
  color,
  text,
  fullScreen = false,
  isDarkMode = false,
  overlay = false,
}) => {
  const neutralColors = isDarkMode ? colors.dark : colors.light;
  const spinValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const getSize = () => {
    switch (size) {
      case 'small':
        return 20;
      case 'large':
        return 50;
      case 'medium':
      default:
        return 35;
    }
  };

  const spinnerColor = color || colors.primary[500];

  const content = (
    <View style={styles.container}>
      <View style={[styles.spinnerContainer, { width: getSize() * 2, height: getSize() * 2 }]}>
        <ActivityIndicator
          size={size === 'small' ? 'small' : 'large'}
          color={spinnerColor}
        />
      </View>
      {text && (
        <Text
          style={[
            styles.text,
            { color: neutralColors.textSecondary },
            size === 'large' && styles.largeText,
          ]}
        >
          {text}
        </Text>
      )}
    </View>
  );

  if (fullScreen) {
    return (
      <View
        style={[
          styles.fullScreen,
          {
            backgroundColor: overlay
              ? 'rgba(0, 0, 0, 0.5)'
              : neutralColors.background,
          },
        ]}
      >
        {content}
      </View>
    );
  }

  return content;
};

// Skeleton Loading Component
interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  isDarkMode?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 8,
  isDarkMode = false,
}) => {
  const opacity = React.useRef(new Animated.Value(0.3)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={{
        width: width as any,
        height,
        borderRadius,
        backgroundColor: isDarkMode ? '#333' : '#e0e0e0',
        opacity,
      }}
    />
  );
};

// Card Skeleton
interface CardSkeletonProps {
  isDarkMode?: boolean;
}

export const CardSkeleton: React.FC<CardSkeletonProps> = ({ isDarkMode = false }) => {
  return (
    <View style={styles.cardSkeleton}>
      <View style={styles.cardSkeletonHeader}>
        <Skeleton width={50} height={50} borderRadius={25} isDarkMode={isDarkMode} />
        <View style={styles.cardSkeletonText}>
          <Skeleton width="70%" height={16} isDarkMode={isDarkMode} />
          <Skeleton width="40%" height={12} isDarkMode={isDarkMode} />
        </View>
      </View>
      <Skeleton width="100%" height={80} isDarkMode={isDarkMode} />
    </View>
  );
};

// List Skeleton
interface ListSkeletonProps {
  count?: number;
  isDarkMode?: boolean;
}

export const ListSkeleton: React.FC<ListSkeletonProps> = ({
  count = 3,
  isDarkMode = false,
}) => {
  return (
    <View>
      {Array.from({ length: count }).map((_, index) => (
        <CardSkeleton key={index} isDarkMode={isDarkMode} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinnerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    marginTop: spacing[3],
    fontSize: typography.sizes.base,
    fontWeight: '500',
  },
  largeText: {
    fontSize: typography.sizes.lg,
    marginTop: spacing[4],
  },
  fullScreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width,
    height,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  cardSkeleton: {
    backgroundColor: colors.light.surface,
    borderRadius: 16,
    padding: spacing[4],
    marginBottom: spacing[4],
    ...{
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
  },
  cardSkeletonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  cardSkeletonText: {
    flex: 1,
    marginLeft: spacing[3],
    gap: spacing[2],
  },
});

export default Loading;
