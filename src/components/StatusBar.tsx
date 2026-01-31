// TrafikTaxa Driver App - Enhanced Status Bar Component
// Modern, animated status bar with rich information display

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { useSettings } from '../context/SettingsContext';
import { useTranslation } from '../hooks/useTranslation';
import { colors, shadows, borderRadius, spacing, typography } from '../theme';

const { width } = Dimensions.get('window');

// Types
export type DriverStatus = 'offline' | 'online' | 'busy' | 'banned' | 'on_ride';

interface StatusBarProps {
  status: DriverStatus;
  shiftElapsedTime: string;
  isSocketConnected: boolean;
  banCountdown?: number;
  unreadMessages?: number;
  onPress?: () => void;
  expanded?: boolean;
}

// Status Configuration
const statusConfig = {
  offline: {
    icon: 'power-off',
    iconFamily: 'FontAwesome5',
    color: colors.danger[500],
    gradient: ['#dc3545', '#c82333'],
    labelKey: 'status_offline',
    pulse: false,
  },
  online: {
    icon: 'radio-outline',
    iconFamily: 'Ionicons',
    color: colors.success[500],
    gradient: ['#28a745', '#23913d'],
    labelKey: 'status_online_available',
    pulse: true,
  },
  busy: {
    icon: 'pause-circle',
    iconFamily: 'FontAwesome5',
    color: colors.warning[500],
    gradient: ['#ffc107', '#e6ad06'],
    labelKey: 'status_busy',
    pulse: false,
  },
  banned: {
    icon: 'ban',
    iconFamily: 'FontAwesome5',
    color: colors.danger[700],
    gradient: ['#bd2130', '#a71d2a'],
    labelKey: 'status_banned',
    pulse: false,
  },
  on_ride: {
    icon: 'car',
    iconFamily: 'FontAwesome5',
    color: colors.info[500],
    gradient: ['#17a2b8', '#148a9c'],
    labelKey: 'status_on_ride',
    pulse: true,
  },
};

export const StatusBar: React.FC<StatusBarProps> = ({
  status,
  shiftElapsedTime,
  isSocketConnected,
  banCountdown = 0,
  unreadMessages = 0,
  onPress,
  expanded = false,
}) => {
  const { isDarkMode } = useSettings();
  const { t } = useTranslation();
  const styles = getStyles(isDarkMode);

  // Animation refs
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const connectionPulseAnim = useRef(new Animated.Value(1)).current;
  const translateYAnim = useRef(new Animated.Value(0)).current;

  // Pulse animation for active status
  useEffect(() => {
    const config = statusConfig[status];
    if (config.pulse) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [status]);

  // Connection pulse animation
  useEffect(() => {
    if (isSocketConnected) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(connectionPulseAnim, {
            toValue: 1.5,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(connectionPulseAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      connectionPulseAnim.setValue(1);
    }
  }, [isSocketConnected]);

  // Slide animation on mount
  useEffect(() => {
    translateYAnim.setValue(-50);
    Animated.spring(translateYAnim, {
      toValue: 0,
      useNativeDriver: true,
      friction: 8,
    }).start();
  }, []);

  const config = statusConfig[status];
  const isRTL = false; // You can get this from context if needed

  // Format shift time
  const formatShiftTime = (time: string) => {
    const parts = time.split(':');
    if (parts.length === 3) {
      const hours = parseInt(parts[0]);
      const minutes = parseInt(parts[1]);
      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      }
      return `${minutes}m`;
    }
    return time;
  };

  // Get shift progress (for 11-hour warning)
  const getShiftProgress = () => {
    const parts = shiftElapsedTime.split(':');
    if (parts.length === 3) {
      const hours = parseInt(parts[0]);
      const progress = Math.min((hours / 11) * 100, 100);
      return progress;
    }
    return 0;
  };

  const shiftProgress = getShiftProgress();
  const showWarning = shiftProgress >= 80; // Warning at 80% (8.8 hours)

  // Render icon based on icon family
  const renderIcon = () => {
    const iconSize = 14;
    const iconColor = '#fff';

    if (config.iconFamily === 'Ionicons') {
      return <Ionicons name={config.icon as any} size={iconSize} color={iconColor} />;
    } else if (config.iconFamily === 'FontAwesome5') {
      return <FontAwesome5 name={config.icon as any} size={iconSize - 2} color={iconColor} />;
    } else if (config.iconFamily === 'MaterialIcons') {
      return <MaterialIcons name={config.icon as any} size={iconSize} color={iconColor} />;
    }
    return null;
  };

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY: translateYAnim }] },
      ]}
    >
      <TouchableOpacity
        style={[styles.content, { backgroundColor: config.color }]}
        onPress={onPress}
        activeOpacity={0.9}
      >
        {/* Left Section - Status Icon & Label */}
        <View style={[styles.section, styles.leftSection]}>
          <Animated.View
            style={[
              styles.iconContainer,
              { transform: [{ scale: config.pulse ? pulseAnim : 1 }] },
            ]}
          >
            {renderIcon()}
          </Animated.View>
          <View style={styles.statusTextContainer}>
            <Text style={styles.statusLabel} numberOfLines={1}>
              {t(config.labelKey)}
            </Text>
            {status === 'banned' && banCountdown > 0 && (
              <Text style={styles.banTimer}>
                {Math.floor(banCountdown / 60)}:{(banCountdown % 60).toString().padStart(2, '0')}
              </Text>
            )}
          </View>
        </View>

        {/* Center Section - Shift Time */}
        <View style={[styles.section, styles.centerSection]}>
          <View style={styles.shiftContainer}>
            <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.8)" />
            <Text style={styles.shiftTime}>{formatShiftTime(shiftElapsedTime)}</Text>
          </View>
          {/* Shift Progress Bar */}
          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBar,
                {
                  width: `${shiftProgress}%`,
                  backgroundColor: showWarning ? colors.warning[400] : 'rgba(255,255,255,0.5)',
                },
              ]}
            />
          </View>
        </View>

        {/* Right Section - Connection & Notifications */}
        <View style={[styles.section, styles.rightSection]}>
          {/* Unread Messages Badge */}
          {unreadMessages > 0 && (
            <View style={styles.badgeContainer}>
              <Ionicons name="chatbubble" size={16} color="#fff" />
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </Text>
              </View>
            </View>
          )}

          {/* Connection Indicator */}
          <View style={styles.connectionContainer}>
            <Animated.View
              style={[
                styles.connectionDot,
                {
                  backgroundColor: isSocketConnected ? colors.success[300] : colors.danger[300],
                  transform: [{ scale: isSocketConnected ? connectionPulseAnim : 1 }],
                },
              ]}
            />
            <Text style={styles.connectionText}>
              {isSocketConnected ? t('connected') : t('disconnected')}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Warning Banner for 11-hour shift */}
      {showWarning && status !== 'offline' && (
        <View style={styles.warningBanner}>
          <Ionicons name="warning" size={14} color={colors.warning[700]} />
          <Text style={styles.warningText}>
            {t('shift_warning_message')}
          </Text>
        </View>
      )}
    </Animated.View>
  );
};

const getStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 1000,
      ...shadows.lg,
    },
    content: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing[3], // 12px
      paddingVertical: spacing[1], // 4px
      paddingTop: 2, // 2px top padding
      height: 40, // Fixed height
    },
    section: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    leftSection: {
      flex: 1.2,
    },
    centerSection: {
      flex: 1,
      alignItems: 'center',
    },
    rightSection: {
      flex: 1,
      justifyContent: 'flex-end',
      gap: 8,
    },
    iconContainer: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing[2],
    },
    statusTextContainer: {
      flex: 1,
    },
    statusLabel: {
      color: '#fff',
      fontSize: typography.sizes.sm,
      fontWeight: typography.weight.bold as any,
      textShadowColor: 'rgba(0,0,0,0.2)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    banTimer: {
      color: 'rgba(255,255,255,0.8)',
      fontSize: typography.sizes.xs,
      marginTop: 2,
    },
    shiftContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    shiftTime: {
      color: '#fff',
      fontSize: typography.sizes.sm,
      fontWeight: typography.weight.bold as any,
      textShadowColor: 'rgba(0,0,0,0.2)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    progressBarContainer: {
      width: 50,
      height: 2,
      backgroundColor: 'rgba(255,255,255,0.2)',
      borderRadius: 1,
      marginTop: 2,
      overflow: 'hidden',
    },
    progressBar: {
      height: '100%',
      borderRadius: 2,
    },
    connectionContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(255,255,255,0.15)',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 10,
    },
    connectionDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    connectionText: {
      color: 'rgba(255,255,255,0.9)',
      fontSize: typography.sizes.xs,
      fontWeight: typography.weight.medium as any,
    },
    badgeContainer: {
      position: 'relative',
    },
    badge: {
      position: 'absolute',
      top: -6,
      right: -6,
      backgroundColor: colors.danger[500],
      borderRadius: 10,
      minWidth: 18,
      height: 18,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: isDarkMode ? colors.dark.surface : colors.light.surface,
    },
    badgeText: {
      color: '#fff',
      fontSize: 10,
      fontWeight: 'bold',
      paddingHorizontal: 4,
    },
    warningBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.warning[100],
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[2],
      gap: 6,
    },
    warningText: {
      color: colors.warning[700],
      fontSize: typography.sizes.xs,
      fontWeight: typography.weight.medium as any,
    },
  });

export default StatusBar;
