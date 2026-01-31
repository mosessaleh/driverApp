// TrafikTaxa Driver App - Expanded Status Bar Component
// Detailed view showing comprehensive driver status information

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  ScrollView,
} from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useSettings } from '../context/SettingsContext';
import { useTranslation } from '../hooks/useTranslation';
import { colors, shadows, borderRadius, spacing, typography } from '../theme';
import { DriverStatus } from './StatusBar';

const { width, height } = Dimensions.get('window');

interface StatusBarExpandedProps {
  visible: boolean;
  onClose: () => void;
  status: DriverStatus;
  shiftElapsedTime: string;
  shiftStartTime: string | null;
  isSocketConnected: boolean;
  currentLocation: { latitude: number; longitude: number } | null;
  locationPermission: boolean;
  isTracking: boolean;
  totalRidesToday?: number;
  earningsToday?: number;
  rating?: number;
}

const statusConfig = {
  offline: {
    icon: 'power-off',
    iconFamily: 'FontAwesome5',
    color: colors.danger[500],
    labelKey: 'status_offline',
    descriptionKey: 'status_offline_desc',
  },
  online: {
    icon: 'radio-outline',
    iconFamily: 'Ionicons',
    color: colors.success[500],
    labelKey: 'status_online_available',
    descriptionKey: 'status_online_desc',
  },
  busy: {
    icon: 'pause-circle',
    iconFamily: 'FontAwesome5',
    color: colors.warning[500],
    labelKey: 'status_busy',
    descriptionKey: 'status_busy_desc',
  },
  banned: {
    icon: 'ban',
    iconFamily: 'FontAwesome5',
    color: colors.danger[700],
    labelKey: 'status_banned',
    descriptionKey: 'status_banned_desc',
  },
  on_ride: {
    icon: 'car',
    iconFamily: 'FontAwesome5',
    color: colors.info[500],
    labelKey: 'status_on_ride',
    descriptionKey: 'status_on_ride_desc',
  },
};

export const StatusBarExpanded: React.FC<StatusBarExpandedProps> = ({
  visible,
  onClose,
  status,
  shiftElapsedTime,
  shiftStartTime,
  isSocketConnected,
  currentLocation,
  locationPermission,
  isTracking,
  totalRidesToday = 0,
  earningsToday = 0,
  rating = 4.8,
}) => {
  const { isDarkMode } = useSettings();
  const { t } = useTranslation();
  const styles = getStyles(isDarkMode);

  const config = statusConfig[status];

  // Parse shift time
  const getShiftDetails = () => {
    const parts = shiftElapsedTime.split(':');
    if (parts.length === 3) {
      return {
        hours: parseInt(parts[0]),
        minutes: parseInt(parts[1]),
        seconds: parseInt(parts[2]),
      };
    }
    return { hours: 0, minutes: 0, seconds: 0 };
  };

  const shiftDetails = getShiftDetails();
  const totalMinutes = shiftDetails.hours * 60 + shiftDetails.minutes;
  const progressPercent = Math.min((shiftDetails.hours / 11) * 100, 100);
  const remainingMinutes = Math.max(11 * 60 - totalMinutes, 0);

  // Render icon
  const renderIcon = (size: number = 24) => {
    const iconColor = config.color;
    if (config.iconFamily === 'Ionicons') {
      return <Ionicons name={config.icon as any} size={size} color={iconColor} />;
    } else if (config.iconFamily === 'FontAwesome5') {
      return <FontAwesome5 name={config.icon as any} size={size - 2} color={iconColor} />;
    }
    return null;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={[styles.header, { backgroundColor: config.color }]}>
            <View style={styles.headerContent}>
              <View style={styles.iconWrapper}>
                {renderIcon(32)}
              </View>
              <View style={styles.headerText}>
                <Text style={styles.headerTitle}>{t(config.labelKey)}</Text>
                <Text style={styles.headerSubtitle}>{t(config.descriptionKey)}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Scrollable Content */}
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
          >
            {/* Shift Timer Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="time" size={20} color={colors.primary[500]} />
                <Text style={styles.cardTitle}>{t('shift_timer')}</Text>
              </View>

              <View style={styles.timerGrid}>
                <View style={styles.timerItem}>
                  <Text style={styles.timerValue}>{shiftDetails.hours}</Text>
                  <Text style={styles.timerLabel}>{t('hours')}</Text>
                </View>
                <Text style={styles.timerSeparator}>:</Text>
                <View style={styles.timerItem}>
                  <Text style={styles.timerValue}>{shiftDetails.minutes.toString().padStart(2, '0')}</Text>
                  <Text style={styles.timerLabel}>{t('minutes')}</Text>
                </View>
                <Text style={styles.timerSeparator}>:</Text>
                <View style={styles.timerItem}>
                  <Text style={styles.timerValue}>{shiftDetails.seconds.toString().padStart(2, '0')}</Text>
                  <Text style={styles.timerLabel}>{t('seconds')}</Text>
                </View>
              </View>

              {/* Progress Bar */}
              <View style={styles.progressContainer}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressLabel}>{t('shift_progress')}</Text>
                  <Text style={[styles.progressValue, progressPercent >= 80 && { color: colors.warning[500] }]}>
                    {Math.round(progressPercent)}%
                  </Text>
                </View>
                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${progressPercent}%`,
                        backgroundColor: progressPercent >= 80 ? colors.warning[500] : colors.success[500],
                      },
                    ]}
                  />
                </View>
                {remainingMinutes > 0 && (
                  <Text style={styles.remainingTime}>
                    {t('remaining')}: {Math.floor(remainingMinutes / 60)}h {remainingMinutes % 60}m
                  </Text>
                )}
              </View>

              {shiftStartTime && (
                <Text style={styles.startTime}>
                  {t('started_at')}: {new Date(shiftStartTime).toLocaleTimeString()}
                </Text>
              )}
            </View>

            {/* Stats Grid */}
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Ionicons name="car" size={24} color={colors.primary[500]} />
                <Text style={styles.statValue}>{totalRidesToday}</Text>
                <Text style={styles.statLabel}>{t('rides_today')}</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="cash" size={24} color={colors.success[500]} />
                <Text style={styles.statValue}>{earningsToday} DKK</Text>
                <Text style={styles.statLabel}>{t('earnings_today')}</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="star" size={24} color={colors.warning[500]} />
                <Text style={styles.statValue}>{rating.toFixed(1)}</Text>
                <Text style={styles.statLabel}>{t('rating')}</Text>
              </View>
            </View>

            {/* Connection Status */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons
                  name={isSocketConnected ? 'wifi' : 'cloud-offline-outline'}
                  size={20}
                  color={isSocketConnected ? colors.success[500] : colors.danger[500]}
                />
                <Text style={styles.cardTitle}>{t('connection_status')}</Text>
              </View>
              <View style={styles.connectionDetails}>
                <View style={styles.connectionItem}>
                  <View style={[styles.statusDot, { backgroundColor: isSocketConnected ? colors.success[500] : colors.danger[500] }]} />
                  <Text style={styles.connectionText}>
                    {isSocketConnected ? t('connected_to_server') : t('disconnected_from_server')}
                  </Text>
                </View>
                <View style={styles.connectionItem}>
                  <View style={[styles.statusDot, { backgroundColor: locationPermission ? colors.success[500] : colors.danger[500] }]} />
                  <Text style={styles.connectionText}>
                    {locationPermission ? t('location_permission_granted') : t('location_permission_denied')}
                  </Text>
                </View>
                <View style={styles.connectionItem}>
                  <View style={[styles.statusDot, { backgroundColor: isTracking ? colors.success[500] : colors.warning[500] }]} />
                  <Text style={styles.connectionText}>
                    {isTracking ? t('location_tracking_active') : t('location_tracking_inactive')}
                  </Text>
                </View>
              </View>
            </View>

            {/* Location Info */}
            {currentLocation && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="location" size={20} color={colors.info[500]} />
                  <Text style={styles.cardTitle}>{t('current_location')}</Text>
                </View>
                <Text style={styles.locationText}>
                  {t('latitude')}: {currentLocation.latitude.toFixed(6)}
                </Text>
                <Text style={styles.locationText}>
                  {t('longitude')}: {currentLocation.longitude.toFixed(6)}
                </Text>
              </View>
            )}
          </ScrollView>
        </View>

        {/* Close on backdrop press */}
        <TouchableOpacity style={styles.backdrop} onPress={onClose} />
      </View>
    </Modal>
  );
};

const getStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-start',
      alignItems: 'center',
      paddingTop: 60,
    },
    container: {
      width: width - 32, // Full width minus margins
      maxHeight: height * 0.75,
      backgroundColor: isDarkMode ? colors.dark.surface : colors.light.surface,
      borderRadius: borderRadius.xl,
      overflow: 'hidden',
      ...shadows['2xl'],
    },
    backdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: -1,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: spacing[5],
      paddingTop: spacing[6],
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    iconWrapper: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing[4],
    },
    headerText: {
      flex: 1,
    },
    headerTitle: {
      color: '#fff',
      fontSize: typography.sizes.xl,
      fontWeight: typography.weight.bold as any,
    },
    headerSubtitle: {
      color: 'rgba(255,255,255,0.8)',
      fontSize: typography.sizes.sm,
      marginTop: 2,
    },
    closeButton: {
      padding: spacing[2],
      backgroundColor: 'rgba(255,255,255,0.2)',
      borderRadius: borderRadius.lg,
    },
    scrollView: {
      maxHeight: height * 0.6,
    },
    scrollContent: {
      padding: spacing[4],
      paddingBottom: spacing[6],
    },
    card: {
      backgroundColor: isDarkMode ? colors.dark.surfaceVariant : colors.light.surfaceVariant,
      borderRadius: borderRadius.lg,
      padding: spacing[4],
      marginBottom: spacing[4],
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing[4],
      gap: spacing[2],
    },
    cardTitle: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weight.semibold as any,
      color: isDarkMode ? colors.dark.text : colors.light.text,
    },
    timerGrid: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing[4],
    },
    timerItem: {
      alignItems: 'center',
      minWidth: 70,
    },
    timerValue: {
      fontSize: typography.sizes['3xl'],
      fontWeight: typography.weight.bold as any,
      color: isDarkMode ? colors.dark.text : colors.light.text,
    },
    timerLabel: {
      fontSize: typography.sizes.xs,
      color: isDarkMode ? colors.dark.textSecondary : colors.light.textSecondary,
      marginTop: 4,
    },
    timerSeparator: {
      fontSize: typography.sizes['2xl'],
      fontWeight: typography.weight.bold as any,
      color: isDarkMode ? colors.dark.textSecondary : colors.light.textSecondary,
      marginHorizontal: spacing[2],
      marginTop: -10,
    },
    progressContainer: {
      marginTop: spacing[2],
    },
    progressHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing[2],
    },
    progressLabel: {
      fontSize: typography.sizes.sm,
      color: isDarkMode ? colors.dark.textSecondary : colors.light.textSecondary,
    },
    progressValue: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weight.bold as any,
      color: isDarkMode ? colors.dark.text : colors.light.text,
    },
    progressBarBg: {
      height: 8,
      backgroundColor: isDarkMode ? colors.dark.border : colors.light.border,
      borderRadius: 4,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      borderRadius: 4,
    },
    remainingTime: {
      fontSize: typography.sizes.sm,
      color: isDarkMode ? colors.dark.textSecondary : colors.light.textSecondary,
      textAlign: 'center',
      marginTop: spacing[2],
    },
    startTime: {
      fontSize: typography.sizes.sm,
      color: isDarkMode ? colors.dark.textSecondary : colors.light.textSecondary,
      textAlign: 'center',
      marginTop: spacing[3],
    },
    statsGrid: {
      flexDirection: 'row',
      gap: spacing[3],
      marginBottom: spacing[4],
    },
    statCard: {
      flex: 1,
      backgroundColor: isDarkMode ? colors.dark.surfaceVariant : colors.light.surfaceVariant,
      borderRadius: borderRadius.lg,
      padding: spacing[4],
      alignItems: 'center',
    },
    statValue: {
      fontSize: typography.sizes.lg,
      fontWeight: typography.weight.bold as any,
      color: isDarkMode ? colors.dark.text : colors.light.text,
      marginTop: spacing[2],
    },
    statLabel: {
      fontSize: typography.sizes.xs,
      color: isDarkMode ? colors.dark.textSecondary : colors.light.textSecondary,
      marginTop: 2,
    },
    connectionDetails: {
      gap: spacing[3],
    },
    connectionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
    },
    statusDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    connectionText: {
      fontSize: typography.sizes.sm,
      color: isDarkMode ? colors.dark.text : colors.light.text,
    },
    locationText: {
      fontSize: typography.sizes.sm,
      color: isDarkMode ? colors.dark.textSecondary : colors.light.textSecondary,
      marginBottom: spacing[1],
    },
  });

export default StatusBarExpanded;
