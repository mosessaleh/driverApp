import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useSettings } from '../../src/context/SettingsContext';
import { useTranslation } from '../../src/hooks/useTranslation';

type Props = {
  showMenu: boolean;
  menuMounted: boolean;
  menuAnim: Animated.Value;
  isRTL: boolean;
  activeRide: boolean;
  driverOnline: boolean;
  driverBusy: boolean;
  bannedUntil: Date | null;
  pendingScheduledCount: number;
  pendingUrgencyColor: string;
  onToggle: () => void;
  onClose: () => void;
  onProfile: () => void;
  onHistory: () => void;
  onShifts: () => void;
  onUpcoming: () => void;
  onAnalytics: () => void;
  onSettings: () => void;
  onSchedule: () => void;
  onToggleBusy: () => void;
  onEndShift: () => void;
};

export default function HamburgerMenu({
  showMenu,
  menuMounted,
  menuAnim,
  isRTL,
  activeRide,
  driverOnline,
  driverBusy,
  bannedUntil,
  pendingScheduledCount,
  pendingUrgencyColor,
  onToggle,
  onClose,
  onProfile,
  onHistory,
  onShifts,
  onUpcoming,
  onAnalytics,
  onSettings,
  onSchedule,
  onToggleBusy,
  onEndShift,
}: Props) {
  const { isDarkMode } = useSettings();
  const { t } = useTranslation();
  const styles = React.useMemo(() => getStyles(isDarkMode, isRTL), [isDarkMode, isRTL]);

  return (
    <>
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.menuButton, showMenu && styles.menuButtonActive]}
          activeOpacity={0.85}
          onPress={onToggle}
        >
          <View style={styles.hamburgerLine} />
          <View style={styles.hamburgerLine} />
          <View style={styles.hamburgerLine} />
          {pendingScheduledCount > 0 && (
            <View style={[styles.pendingBadgeOnMenuButton, { backgroundColor: pendingUrgencyColor }]}>
              <Text style={styles.pendingBadgeText}>{pendingScheduledCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {menuMounted && (
        <View style={styles.menuLayer} pointerEvents="box-none">
          <Animated.View style={[styles.menuBackdrop, { opacity: menuAnim }]}>
            <TouchableOpacity
              style={StyleSheet.absoluteFillObject}
              activeOpacity={1}
              onPress={onClose}
            />
          </Animated.View>
          <Animated.View
            style={[
              styles.menuOverlay,
              {
                opacity: menuAnim,
                transform: [
                  {
                    translateY: menuAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-8, 0],
                    }),
                  },
                  {
                    scale: menuAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.98, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            {!activeRide && (
              <MenuItem icon="👤" text={t('profile')} isRTL={isRTL} onPress={onProfile} styles={styles} />
            )}
            {!activeRide && (
              <MenuItem icon="📋" text={t('history')} isRTL={isRTL} onPress={onHistory} styles={styles} />
            )}
            {!activeRide && (
              <MenuItem icon="🕒" text={t('completed_shifts')} isRTL={isRTL} onPress={onShifts} styles={styles} />
            )}
            {!activeRide && (
              <TouchableOpacity style={styles.menuItem} activeOpacity={0.85} onPress={onUpcoming}>
                <View style={styles.menuItemIconWrap}>
                  <Text style={styles.menuItemIcon}>⏰</Text>
                </View>
                <Text style={styles.menuItemText}>{t('upcoming_bookings')}</Text>
                {pendingScheduledCount > 0 && (
                  <View style={[styles.pendingBadgeOnMenuItem, { backgroundColor: pendingUrgencyColor }]}>
                    <Text style={styles.pendingBadgeText}>{pendingScheduledCount}</Text>
                  </View>
                )}
                <Text style={styles.menuItemArrow}>{isRTL ? '‹' : '›'}</Text>
              </TouchableOpacity>
            )}
            {!activeRide && (
              <MenuItem icon="📊" text={t('analytics')} isRTL={isRTL} onPress={onAnalytics} styles={styles} />
            )}
            <MenuItem icon="⚙️" text={t('settings')} isRTL={isRTL} onPress={onSettings} styles={styles} />
            {!activeRide && (
              <MenuItem icon="🗓️" text={t('work_schedule')} isRTL={isRTL} onPress={onSchedule} styles={styles} />
            )}
            {!driverBusy && driverOnline && !bannedUntil && (
              <TouchableOpacity
                style={[styles.menuItem, styles.menuItemWarning]}
                activeOpacity={0.85}
                onPress={onToggleBusy}
              >
                <View style={styles.menuItemIconWrap}>
                  <Text style={styles.menuItemIcon}>⏸️</Text>
                </View>
                <Text style={styles.menuItemText}>{t('pause')}</Text>
                <Text style={styles.menuItemArrow}>{isRTL ? '‹' : '›'}</Text>
              </TouchableOpacity>
            )}
            {driverBusy && driverOnline && !bannedUntil && (
              <TouchableOpacity
                style={[styles.menuItem, styles.menuItemWarning]}
                activeOpacity={0.85}
                onPress={onToggleBusy}
              >
                <View style={styles.menuItemIconWrap}>
                  <Text style={styles.menuItemIcon}>▶️</Text>
                </View>
                <Text style={styles.menuItemText}>{t('end_pause')}</Text>
                <Text style={styles.menuItemArrow}>{isRTL ? '‹' : '›'}</Text>
              </TouchableOpacity>
            )}
            {!activeRide && (
              <TouchableOpacity
                style={[styles.menuItem, styles.menuItemDanger]}
                activeOpacity={0.85}
                onPress={onEndShift}
              >
                <View style={styles.menuItemIconWrap}>
                  <Text style={styles.menuItemIcon}>🏁</Text>
                </View>
                <Text style={styles.menuItemText}>{t('end_shift')}</Text>
                <Text style={styles.menuItemArrow}>{isRTL ? '‹' : '›'}</Text>
              </TouchableOpacity>
            )}
          </Animated.View>
        </View>
      )}
    </>
  );
}

type MenuItemProps = {
  icon: string;
  text: string;
  isRTL: boolean;
  styles: ReturnType<typeof getStyles>;
  onPress: () => void;
};

function MenuItem({ icon, text, isRTL, styles, onPress }: MenuItemProps) {
  return (
    <TouchableOpacity style={styles.menuItem} activeOpacity={0.85} onPress={onPress}>
      <View style={styles.menuItemIconWrap}>
        <Text style={styles.menuItemIcon}>{icon}</Text>
      </View>
      <Text style={styles.menuItemText}>{text}</Text>
      <Text style={styles.menuItemArrow}>{isRTL ? '‹' : '›'}</Text>
    </TouchableOpacity>
  );
}

const getStyles = (isDarkMode: boolean, isRTL: boolean) => StyleSheet.create({
  header: {
    position: 'absolute',
    top: 60,
    left: isRTL ? undefined : 20,
    right: isRTL ? 20 : undefined,
    zIndex: 1000,
  },
  menuButton: {
    width: 52,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: isDarkMode ? 'rgba(15,23,42,0.75)' : 'rgba(255,255,255,0.95)',
    borderRadius: 26,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(148,163,184,0.25)' : 'rgba(15,23,42,0.08)',
  },
  menuButtonActive: {
    backgroundColor: isDarkMode ? 'rgba(56,189,248,0.22)' : '#e0f2fe',
    borderColor: isDarkMode ? 'rgba(56,189,248,0.6)' : '#7dd3fc',
    shadowColor: '#38bdf8',
    shadowOpacity: 0.4,
  },
  pendingBadgeOnMenuButton: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fff',
  },
  hamburgerLine: {
    width: 22,
    height: 3,
    backgroundColor: isDarkMode ? '#e2e8f0' : '#0f172a',
    marginVertical: 2,
    borderRadius: 2,
  },
  menuLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1500,
  },
  menuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: isDarkMode ? 'rgba(2,6,23,0.45)' : 'rgba(15,23,42,0.18)',
  },
  menuOverlay: {
    position: 'absolute',
    top: 120,
    left: isRTL ? undefined : 16,
    right: isRTL ? 16 : undefined,
    backgroundColor: isDarkMode ? 'rgba(17,24,39,0.98)' : 'rgba(255,255,255,0.98)',
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 14,
    minWidth: 230,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(148,163,184,0.18)' : 'rgba(15,23,42,0.08)',
    zIndex: 1000,
    overflow: 'hidden',
    paddingVertical: 6,
  },
  menuItem: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 50,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: isDarkMode ? 'rgba(148,163,184,0.18)' : 'rgba(15,23,42,0.06)',
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.02)' : 'transparent',
  },
  menuItemWarning: {
    backgroundColor: isDarkMode ? 'rgba(255,193,7,0.16)' : '#fff8e1',
  },
  menuItemDanger: {
    backgroundColor: isDarkMode ? 'rgba(220,53,69,0.16)' : '#fff1f2',
  },
  menuItemIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#f1f5f9',
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(148,163,184,0.25)' : '#e2e8f0',
  },
  menuItemIcon: {
    fontSize: 16,
  },
  menuItemText: {
    flex: 1,
    fontSize: 15,
    color: isDarkMode ? '#f8fafc' : '#0f172a',
    fontWeight: '600',
    textAlign: isRTL ? 'right' : 'left',
  },
  menuItemArrow: {
    fontSize: 18,
    color: isDarkMode ? 'rgba(226,232,240,0.6)' : '#94a3b8',
    marginLeft: isRTL ? 0 : 4,
    marginRight: isRTL ? 4 : 0,
  },
  pendingBadgeOnMenuItem: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  pendingBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 12,
  },
});
