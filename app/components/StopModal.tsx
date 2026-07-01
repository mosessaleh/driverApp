import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import * as Linking from 'expo-linking';
import { useSettings } from '../../src/context/SettingsContext';
import { useTranslation } from '../../src/hooks/useTranslation';

type ActiveRide = {
  id: number;
  price: number;
  distanceKm: number;
  stopAddress?: string;
  pickupAddress?: string;
  dropoffAddress?: string;
  riderPhone?: string;
  vehicleTypeName?: string;
};

type Props = {
  visible: boolean;
  activeRide: ActiveRide | null;
  currentLocation: { latitude: number; longitude: number } | null;
  isContinueLoading: boolean;
  unreadMessagesCount: number;
  onNav: (origin: string, destination: string) => void;
  onContinueTrip: () => void;
  onChat: () => void;
};

export default function StopModal({
  visible,
  activeRide,
  currentLocation,
  isContinueLoading,
  unreadMessagesCount,
  onNav,
  onContinueTrip,
  onChat,
}: Props) {
  const { isDarkMode } = useSettings();
  const { t } = useTranslation();
  const styles = React.useMemo(() => getStyles(isDarkMode), [isDarkMode]);

  if (!visible || !activeRide) return null;

  return (
    <View style={styles.rideModalContainer}>
      <View style={styles.pickupModalCard}>
        <View style={styles.pickupHandle} />
        <View style={styles.pickupHeaderRow}>
          <View style={styles.pickupBadge}>
            <Text style={styles.pickupBadgeText}>{t('stop')}</Text>
          </View>
          <View style={styles.pickupHeaderMeta}>
            <View style={styles.pickupIdPill}>
              <Text style={styles.pickupIdText}>#{activeRide.id}</Text>
            </View>
            {activeRide.riderPhone && (
              <TouchableOpacity
                style={styles.callIconInModal}
                onPress={() => Linking.openURL(`tel:${activeRide.riderPhone}`)}
              >
                <Text style={styles.callIconText}>📞</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        <View style={styles.pickupInfoRow}>
          <View style={styles.pickupInfoCard}>
            <Text style={styles.pickupInfoLabel}>{t('price')}</Text>
            {activeRide.paymentMethod === 'meter' ? (
              <Text style={[styles.pickupInfoValue, { color: '#f59e0b', fontSize: 14 }]}>Meter (Cash)</Text>
            ) : (
              <Text style={[styles.pickupInfoValue, styles.pickupInfoValueAccent]}>{activeRide.price} DKK</Text>
            )}
          </View>
          <View style={styles.pickupInfoCard}>
            <Text style={styles.pickupInfoLabel}>{t('distance')}</Text>
            <Text style={styles.pickupInfoValue}>{activeRide.distanceKm} km</Text>
          </View>
        </View>
        <View style={styles.stopAddressCard}>
          <View style={styles.stopAddressHeader}>
            <View style={styles.stopDot} />
            <Text style={styles.stopAddressLabel}>{t('stop')}</Text>
          </View>
          <Text style={styles.stopAddressValue} numberOfLines={2} ellipsizeMode="tail">
            {activeRide.stopAddress}
          </Text>
        </View>
        {activeRide.vehicleTypeName ? (
          <View style={styles.rideTypeBadge}>
            <Text style={styles.rideTypeBadgeText}>{activeRide.vehicleTypeName}</Text>
          </View>
        ) : null}
        <View style={styles.pickupActions}>
          <View style={styles.pickupActionRow}>
            <TouchableOpacity
              style={[styles.pickupNavButton, styles.pickupActionButton]}
              onPress={() => onNav(`${currentLocation?.latitude},${currentLocation?.longitude}`, activeRide.stopAddress || '')}
            >
              <Text style={styles.pickupNavText} numberOfLines={1} ellipsizeMode="tail">
                {activeRide.stopAddress || t('nav')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pickupChatButton, styles.pickupActionButton]}
              onPress={onChat}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.pickupChatButtonText}>💬 {t('chat')}</Text>
                {unreadMessagesCount > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>{unreadMessagesCount}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.pickupButton} onLongPress={onContinueTrip} delayLongPress={1500} disabled={isContinueLoading}>
            {isContinueLoading ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={[styles.pickupButtonText, { marginLeft: 10 }]}>{t('continuing_trip')}</Text>
              </View>
            ) : (
              <Text style={styles.pickupButtonText}>{t('hold_to_continue_trip')}</Text>
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
  pickupModalCard: {
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
  pickupHandle: {
    width: 36,
    height: 4,
    backgroundColor: isDarkMode ? '#475569' : '#cbd5e1',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  pickupHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  pickupBadge: {
    backgroundColor: '#f59e0b',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pickupBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  pickupHeaderMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pickupIdPill: {
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pickupIdText: {
    color: isDarkMode ? '#94a3b8' : '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  callIconInModal: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  callIconText: {
    fontSize: 16,
  },
  pickupInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  pickupInfoCard: {
    flex: 1,
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f8fafc',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(148,163,184,0.15)' : '#e2e8f0',
  },
  pickupInfoLabel: {
    fontSize: 12,
    color: isDarkMode ? '#94a3b8' : '#64748b',
    fontWeight: '600',
    marginBottom: 4,
  },
  pickupInfoValue: {
    fontSize: 17,
    fontWeight: '700',
    color: isDarkMode ? '#f1f5f9' : '#0f172a',
  },
  pickupInfoValueAccent: {
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
  rideTypeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: isDarkMode ? 'rgba(56,189,248,0.15)' : '#e0f2fe',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
  },
  rideTypeBadgeText: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '600',
  },
  pickupActions: {
    marginTop: 4,
  },
  pickupActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  pickupActionButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  pickupNavButton: {
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#f1f5f9',
    borderColor: isDarkMode ? 'rgba(148,163,184,0.25)' : '#cbd5e1',
  },
  pickupNavText: {
    color: isDarkMode ? '#f1f5f9' : '#0f172a',
    fontSize: 14,
    fontWeight: '600',
  },
  pickupChatButton: {
    backgroundColor: isDarkMode ? 'rgba(56,189,248,0.15)' : '#e0f2fe',
    borderColor: isDarkMode ? 'rgba(56,189,248,0.3)' : '#7dd3fc',
  },
  pickupChatButtonText: {
    color: isDarkMode ? '#7dd3fc' : '#0369a1',
    fontSize: 14,
    fontWeight: '600',
  },
  unreadBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
    paddingHorizontal: 4,
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  pickupButton: {
    backgroundColor: '#38bdf8',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  pickupButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
