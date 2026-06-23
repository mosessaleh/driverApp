import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useSettings } from '../../src/context/SettingsContext';
import { useTranslation } from '../../src/hooks/useTranslation';

type ActiveRide = {
  id: number;
  price: number;
  distanceKm: number;
  stopAddress?: string;
  pickupAddress?: string;
  dropoffAddress?: string;
};

type Props = {
  visible: boolean;
  activeRide: ActiveRide | null;
  currentLocation: { latitude: number; longitude: number } | null;
  isDropoffLoading: boolean;
  onNav: (origin: string, destination: string) => void;
  onDropoff: () => void;
};

export default function DropoffModal({
  visible,
  activeRide,
  currentLocation,
  isDropoffLoading,
  onNav,
  onDropoff,
}: Props) {
  const { isDarkMode } = useSettings();
  const { t } = useTranslation();
  const styles = React.useMemo(() => getStyles(isDarkMode), [isDarkMode]);

  if (!visible || !activeRide) return null;

  return (
    <View style={styles.rideModalContainer}>
      <View style={styles.dropoffModalCard}>
        <View style={styles.dropoffHandle} />
        <View style={styles.dropoffHeaderRow}>
          <View style={styles.dropoffBadge}>
            <Text style={styles.dropoffBadgeText}>{t('dropoff')}</Text>
          </View>
          <View style={styles.dropoffIdPill}>
            <Text style={styles.dropoffIdText}>#{activeRide.id}</Text>
          </View>
        </View>
        <View style={styles.dropoffInfoRow}>
          <View style={styles.dropoffInfoCard}>
            <Text style={styles.dropoffInfoLabel}>{t('price')}</Text>
            <Text style={[styles.dropoffInfoValue, styles.dropoffInfoValueAccent]}>
              {activeRide.price} DKK
            </Text>
          </View>
          <View style={styles.dropoffInfoCard}>
            <Text style={styles.dropoffInfoLabel}>{t('distance')}</Text>
            <Text style={styles.dropoffInfoValue}>{activeRide.distanceKm} km</Text>
          </View>
        </View>
        {!!activeRide.stopAddress && (
          <View style={styles.stopAddressCard}>
            <View style={styles.stopAddressHeader}>
              <View style={styles.stopDot} />
              <Text style={styles.stopAddressLabel}>{t('stop')}</Text>
            </View>
            <Text style={styles.stopAddressValue} numberOfLines={2} ellipsizeMode="tail">
              {activeRide.stopAddress}
            </Text>
          </View>
        )}
        <View style={styles.dropoffAddressCard}>
          <View style={styles.dropoffAddressHeader}>
            <View style={styles.dropoffDot} />
            <Text style={styles.dropoffAddressLabel}>{t('dropoff')}</Text>
          </View>
          <Text style={styles.dropoffAddressValue} numberOfLines={2} ellipsizeMode="tail">
            {activeRide.dropoffAddress}
          </Text>
        </View>
        <View style={styles.dropoffActions}>
          <TouchableOpacity
            style={styles.dropoffNavButton}
            onPress={() => {
              const navOrigin = currentLocation
                ? `${currentLocation.latitude},${currentLocation.longitude}`
                : (activeRide.stopAddress || activeRide.pickupAddress || '');
              onNav(navOrigin, activeRide.dropoffAddress || '');
            }}
          >
            <Text style={styles.dropoffNavText}>{t('nav')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dropoffButton} onLongPress={onDropoff} delayLongPress={1500} disabled={isDropoffLoading}>
            {isDropoffLoading ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={[styles.dropoffButtonText, { marginLeft: 10 }]}>{t('dropoff_in_progress')}</Text>
              </View>
            ) : (
              <Text style={styles.dropoffButtonText}>{t('hold_to_dropoff')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const getStyles = (isDarkMode: boolean) => StyleSheet.create({
  rideModalContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
    zIndex: 3000,
  },
  dropoffModalCard: {
    backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 12,
  },
  dropoffHandle: {
    width: 36,
    height: 4,
    backgroundColor: isDarkMode ? '#475569' : '#cbd5e1',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  dropoffHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  dropoffBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dropoffBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  dropoffIdPill: {
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  dropoffIdText: {
    color: isDarkMode ? '#94a3b8' : '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  dropoffInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  dropoffInfoCard: {
    flex: 1,
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f8fafc',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(148,163,184,0.15)' : '#e2e8f0',
  },
  dropoffInfoLabel: {
    fontSize: 12,
    color: isDarkMode ? '#94a3b8' : '#64748b',
    fontWeight: '600',
    marginBottom: 4,
  },
  dropoffInfoValue: {
    fontSize: 17,
    fontWeight: '700',
    color: isDarkMode ? '#f1f5f9' : '#0f172a',
  },
  dropoffInfoValueAccent: {
    color: '#22c55e',
  },
  stopAddressCard: {
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f8fafc',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(148,163,184,0.15)' : '#e2e8f0',
  },
  stopAddressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  stopDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#f59e0b',
  },
  stopAddressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: isDarkMode ? '#94a3b8' : '#64748b',
  },
  stopAddressValue: {
    fontSize: 15,
    fontWeight: '600',
    color: isDarkMode ? '#f1f5f9' : '#0f172a',
    marginLeft: 18,
  },
  dropoffAddressCard: {
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f8fafc',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(148,163,184,0.15)' : '#e2e8f0',
  },
  dropoffAddressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  dropoffDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
  },
  dropoffAddressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: isDarkMode ? '#94a3b8' : '#64748b',
  },
  dropoffAddressValue: {
    fontSize: 15,
    fontWeight: '600',
    color: isDarkMode ? '#f1f5f9' : '#0f172a',
    marginLeft: 18,
  },
  dropoffActions: {
    gap: 12,
  },
  dropoffNavButton: {
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#f1f5f9',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(148,163,184,0.25)' : '#cbd5e1',
  },
  dropoffNavText: {
    color: isDarkMode ? '#f1f5f9' : '#0f172a',
    fontSize: 15,
    fontWeight: '600',
  },
  dropoffButton: {
    backgroundColor: '#ef4444',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  dropoffButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
