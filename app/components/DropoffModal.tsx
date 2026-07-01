import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, TextInput, StyleSheet } from 'react-native';
import { useSettings } from '../../src/context/SettingsContext';
import { useTranslation } from '../../src/hooks/useTranslation';

type ActiveRide = {
  id: number;
  price: number;
  distanceKm: number;
  stopAddress?: string;
  pickupAddress?: string;
  dropoffAddress?: string;
  paymentMethod?: string;
};

type Props = {
  visible: boolean;
  activeRide: ActiveRide | null;
  currentLocation: { latitude: number; longitude: number } | null;
  isDropoffLoading: boolean;
  onNav: (origin: string, destination: string) => void;
  onDropoff: (meterPrice?: number) => void;
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
  const { t, getCurrentLanguage } = useTranslation();
  const lang = getCurrentLanguage();
  const styles = React.useMemo(() => getStyles(isDarkMode), [isDarkMode]);
  const [meterPrice, setMeterPrice] = useState('');
  const [priceError, setPriceError] = useState('');

  if (!visible || !activeRide) return null;

  const isMeter = activeRide.paymentMethod === 'meter';

  const validateAndDropoff = () => {
    if (isMeter) {
      const entered = parseFloat(meterPrice);
      if (!meterPrice || isNaN(entered) || entered <= 0) {
        setPriceError(lang === 'ar' ? 'الرجاء إدخال السعر' : lang === 'da' ? 'Indtast venligst prisen' : 'Please enter the price');
        return;
      }
      const estimated = activeRide?.price || 0;
      const min = estimated * 0.9;
      const max = estimated * 1.1;
      if (entered < min || entered > max) {
        setPriceError(lang === 'ar'
          ? `السعر يجب أن يكون بين ${Math.round(min)} و ${Math.round(max)} DKK`
          : lang === 'da'
            ? `Prisen skal være mellem ${Math.round(min)} og ${Math.round(max)} DKK`
            : `Price must be between ${Math.round(min)} and ${Math.round(max)} DKK`);
        return;
      }
      setPriceError('');
      onDropoff(entered);
    } else {
      onDropoff();
    }
  };

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
            {isMeter ? (
              <Text style={[styles.dropoffInfoValue, { color: '#f59e0b', fontSize: 14 }]}>Meter (Cash)</Text>
            ) : (
              <Text style={[styles.dropoffInfoValue, styles.dropoffInfoValueAccent]}>
                {activeRide.price} DKK
              </Text>
            )}
          </View>
          <View style={styles.dropoffInfoCard}>
            <Text style={styles.dropoffInfoLabel}>{t('distance')}</Text>
            <Text style={styles.dropoffInfoValue}>{activeRide.distanceKm} km</Text>
          </View>
        </View>

        {isMeter && (
          <View style={styles.meterPriceContainer}>
            <Text style={styles.meterPriceLabel}>
              {lang === 'ar' ? 'سعر العداد (إجباري)' : lang === 'da' ? 'Taxameter pris (påkrævet)' : 'Meter Price (required)'}
            </Text>
            <TextInput
              style={[styles.meterPriceInput, priceError ? { borderColor: '#ef4444' } : {}]}
              value={meterPrice}
              onChangeText={(t) => { setMeterPrice(t); setPriceError(''); }}
              keyboardType="numeric"
              placeholder="0.00"
              placeholderTextColor={isDarkMode ? '#666' : '#aaa'}
            />
            {priceError ? <Text style={styles.meterPriceError}>{priceError}</Text> : null}
          </View>
        )}

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
          <View style={styles.dropoffActionRow}>
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
          </View>
          <TouchableOpacity style={styles.dropoffButton} onLongPress={validateAndDropoff} delayLongPress={1500} disabled={isDropoffLoading}>
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
    color: isDarkMode ? '#60a5fa' : '#2563eb',
    fontWeight: '800',
  },
  dropoffAddressCard: {
    backgroundColor: isDarkMode ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.05)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(239,68,68,0.25)' : 'rgba(239,68,68,0.15)',
  },
  dropoffAddressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  dropoffDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    marginRight: 8,
  },
  dropoffAddressLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ef4444',
  },
  dropoffAddressValue: {
    fontSize: 15,
    fontWeight: '500',
    color: isDarkMode ? '#f1f5f9' : '#1e293b',
    lineHeight: 22,
    marginLeft: 16,
  },
  stopAddressCard: {
    backgroundColor: isDarkMode ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.05)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.15)',
  },
  stopAddressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  stopDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6366f1',
    marginRight: 8,
  },
  stopAddressLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6366f1',
  },
  stopAddressValue: {
    fontSize: 15,
    fontWeight: '500',
    color: isDarkMode ? '#f1f5f9' : '#1e293b',
    lineHeight: 22,
    marginLeft: 16,
  },
  meterPriceContainer: {
    backgroundColor: isDarkMode ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.05)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(245,158,11,0.3)' : 'rgba(245,158,11,0.2)',
  },
  meterPriceLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f59e0b',
    marginBottom: 8,
  },
  meterPriceInput: {
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 20,
    fontWeight: '700',
    color: isDarkMode ? '#fff' : '#222',
    borderWidth: 1.5,
    borderColor: isDarkMode ? 'rgba(245,158,11,0.5)' : 'rgba(245,158,11,0.4)',
    textAlign: 'center',
  },
  meterPriceError: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 6,
    textAlign: 'center',
  },
  dropoffButton: {
    backgroundColor: '#ef4444',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
  },
  dropoffButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  dropoffActions: {
    gap: 10,
  },
  dropoffActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dropoffNavButton: {
    flex: 1,
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#f1f5f9',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(148,163,184,0.15)' : '#e2e8f0',
    alignItems: 'center',
  },
  dropoffNavText: {
    color: isDarkMode ? '#e2e8f0' : '#0f172a',
    fontSize: 15,
    fontWeight: '700',
  },
});
