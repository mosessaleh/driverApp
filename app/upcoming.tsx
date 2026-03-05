import { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useAuth } from '../src/context/AuthContext';
import { useRouter } from 'expo-router';
import { getDriverUpcoming, normalizeScheduledPendingOffers } from '../src/services/api';
import {
  onScheduledUpcomingOffersUpdate,
  offScheduledUpcomingOffersUpdate,
  acceptRide,
  rejectRide,
} from '../src/services/socket';
import { useTranslation } from '../src/hooks/useTranslation';
import type { ScheduledPendingOffer } from '../src/types';

const OFFER_TIMEOUT_MS = 3 * 60 * 1000;
const OFFER_TIMEOUT_STAGE3_MS = 10 * 60 * 1000;

const getPendingOfferRemainingMs = (offer: ScheduledPendingOffer, nowMs: number) => {
  const byExpiry = Number.isFinite(offer?.expiresAtMs) ? Number(offer.expiresAtMs) - nowMs : 0;
  const fallback = Number(offer?.timeLeftMs || 0);
  return Math.max(0, Number.isFinite(byExpiry) && byExpiry > 0 ? byExpiry : fallback);
};

const getPendingOfferTimeoutMs = (offer: ScheduledPendingOffer) => {
  const stage = Number((offer as any)?.stage || 1);
  if (stage === 3) return OFFER_TIMEOUT_STAGE3_MS;
  return OFFER_TIMEOUT_MS;
};

const getScheduledUrgencyColor = (remainingMs: number, totalMs: number) => {
  const safeTotal = Math.max(1, Number(totalMs || OFFER_TIMEOUT_MS));
  const progress = Math.max(0, Math.min(1, remainingMs / safeTotal));
  const start = { r: 59, g: 130, b: 246 }; // blue
  const end = { r: 239, g: 68, b: 68 }; // red
  const r = Math.round(end.r + (start.r - end.r) * progress);
  const g = Math.round(end.g + (start.g - end.g) * progress);
  const b = Math.round(end.b + (start.b - end.b) * progress);
  return `rgb(${r}, ${g}, ${b})`;
};

export default function UpcomingScreen() {
  const { authState } = useAuth();
  const router = useRouter();
  const { t, getCurrentLanguage } = useTranslation();

  const [rides, setRides] = useState<any[]>([]);
  const [pendingOffers, setPendingOffers] = useState<ScheduledPendingOffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [nowTs, setNowTs] = useState(Date.now());

  useEffect(() => {
    loadUpcoming();

    const handleScheduledUpcomingOffersUpdate = (payload: any) => {
      const normalizedRaw = normalizeScheduledPendingOffers(payload?.pendingOffers) as any[];
      const normalizedPending: ScheduledPendingOffer[] = normalizedRaw.filter(
        (offer) => offer && Number.isFinite(Number(offer.rideId))
      );
      setPendingOffers(normalizedPending);
    };

    onScheduledUpcomingOffersUpdate(handleScheduledUpcomingOffersUpdate);

    return () => {
      offScheduledUpcomingOffersUpdate();
    };
  }, []);

  useEffect(() => {
    if (rides.length === 0 && pendingOffers.length === 0) {
      return;
    }
    setNowTs(Date.now());
    const interval = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [rides.length, pendingOffers.length]);

  const loadUpcoming = async (retryCount = 0) => {
    if (!authState.token) return;
    setLoading(true);
    try {
      const response = await getDriverUpcoming(authState.token);
      if (response.ok && response.rides) {
        setRides(response.rides);
      } else {
        setRides([]);
      }

      const normalizedRaw = normalizeScheduledPendingOffers(response?.pendingOffers) as any[];
      const normalizedPending: ScheduledPendingOffer[] = normalizedRaw.filter(
        (offer) => offer && Number.isFinite(Number(offer.rideId))
      );
      setPendingOffers(normalizedPending);
    } catch (error) {
      console.error('Error loading upcoming rides/offers:', error);
      if (retryCount < 2) {
        const delay = Math.pow(2, retryCount) * 1000;
        setTimeout(() => loadUpcoming(retryCount + 1), delay);
      }
    } finally {
      setLoading(false);
    }
  };

  const onRefreshData = async () => {
    setRefreshing(true);
    await loadUpcoming();
    setRefreshing(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const locale = getCurrentLanguage() === 'ar' ? 'ar' : getCurrentLanguage() === 'da' ? 'da-DK' : 'en-GB';
    return date.toLocaleDateString(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const locale = getCurrentLanguage() === 'ar' ? 'ar' : getCurrentLanguage() === 'da' ? 'da-DK' : 'en-GB';
    return date.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCountdown = (totalSeconds: number) => {
    const safeSeconds = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const getCountdownSeconds = (dateString: string) => {
    const time = new Date(dateString).getTime();
    if (Number.isNaN(time)) return 0;
    return Math.max(0, Math.ceil((time - nowTs) / 1000));
  };

  const pendingOffersWithMeta = useMemo(() => {
    return pendingOffers.map((offer) => {
      const remainingMs = getPendingOfferRemainingMs(offer, nowTs);
      const remainingSec = Math.ceil(remainingMs / 1000);
      const offerTimeoutMs = getPendingOfferTimeoutMs(offer);
      return {
        offer,
        remainingMs,
        remainingSec,
        offerTimeoutMs,
        urgencyColor: getScheduledUrgencyColor(remainingMs, offerTimeoutMs),
      };
    });
  }, [pendingOffers, nowTs]);

  const goBack = () => {
    router.back();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={goBack}>
          <Text style={styles.backButtonText}>❮</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('upcoming_bookings')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.ridesContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefreshData} />}
      >
        {pendingOffersWithMeta.length > 0 && (
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>{t('scheduled_ride_title')} • Pending offers</Text>
            {pendingOffersWithMeta.map(({ offer, remainingSec, urgencyColor }) => (
              <View key={`pending-${offer.rideId}`} style={[styles.offerCard, { borderLeftColor: urgencyColor }]}> 
                <View style={styles.offerHeaderRow}>
                  <Text style={styles.rideId}>#{offer.rideId}</Text>
                  <View style={[styles.pendingCountBadge, { backgroundColor: urgencyColor }]}>
                    <Text style={styles.pendingCountBadgeText}>{formatCountdown(remainingSec)}</Text>
                  </View>
                </View>

                {offer?.pickupTime ? (
                  <Text style={styles.rideDate}>
                    {formatDate(offer.pickupTime)} • {formatTime(offer.pickupTime)}
                  </Text>
                ) : null}

                <Text style={styles.rideAddress}>{offer?.rideData?.pickupAddress || '-'}</Text>
                {!!offer?.rideData?.stopAddress && (
                  <Text style={styles.rideAddress}>{offer.rideData.stopAddress}</Text>
                )}
                <Text style={styles.rideAddress}>{offer?.rideData?.dropoffAddress || '-'}</Text>

                <View style={styles.offerFooterRow}>
                  <Text style={styles.amountValue}>{Number(offer?.rideData?.price || 0)} DKK</Text>
                  <View style={styles.offerActionsRow}>
                    <TouchableOpacity
                      style={[styles.offerActionBtn, styles.acceptBtn]}
                      onPress={() => {
                        acceptRide(offer.rideId);
                        setPendingOffers((prev) => prev.filter((x) => x.rideId !== offer.rideId));
                      }}
                    >
                      <Text style={styles.offerActionText}>{t('yes')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.offerActionBtn, styles.rejectBtn]}
                      onPress={() => {
                        rejectRide(offer.rideId);
                        setPendingOffers((prev) => prev.filter((x) => x.rideId !== offer.rideId));
                      }}
                    >
                      <Text style={styles.offerActionText}>{t('no')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>{t('upcoming_bookings')}</Text>
          {loading && rides.length === 0 ? (
            <Text style={styles.loadingText}>{t('upcoming_loading')}</Text>
          ) : rides.length === 0 ? (
            <Text style={styles.noDataText}>{t('upcoming_no_rides')}</Text>
          ) : (
            rides.map((ride) => (
              <TouchableOpacity
                key={ride.id}
                style={styles.rideCard}
                onPress={() => router.push(`/ride-details?id=${ride.id}`)}
              >
                <View style={styles.rideInfo}>
                  <View style={styles.rideHeaderRow}>
                    <Text style={styles.rideId}>#{ride.id}</Text>
                    <View style={styles.scheduledBadge}>
                      <Text style={styles.scheduledBadgeText}>{t('scheduled_ride_title')}</Text>
                    </View>
                  </View>
                  <Text style={styles.rideDate}>
                    {formatDate(ride.pickupTime)} • {formatTime(ride.pickupTime)}
                  </Text>
                  <Text style={styles.rideCountdown}>
                    {t('scheduled_countdown_label')}: {formatCountdown(getCountdownSeconds(ride.pickupTime))}
                  </Text>
                  <Text style={styles.rideAddress}>{ride.pickupAddress}</Text>
                  {!!ride.stopAddress && <Text style={styles.rideAddress}>{ride.stopAddress}</Text>}
                  <Text style={styles.rideAddress}>{ride.dropoffAddress}</Text>
                </View>
                <View style={styles.rideAmount}>
                  <Text style={styles.amountValue}>{ride.price} DKK</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerSpacer: {
    width: 40,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  backButtonText: {
    fontSize: 18,
    color: '#007bff',
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  ridesContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionBlock: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 10,
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 30,
    fontSize: 16,
    color: '#666',
  },
  noDataText: {
    textAlign: 'center',
    marginTop: 10,
    fontSize: 15,
    color: '#666',
  },
  rideCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  offerCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 5,
  },
  rideInfo: {
    flex: 1,
  },
  rideHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  offerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  rideId: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  scheduledBadge: {
    backgroundColor: '#fef3c7',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  scheduledBadgeText: {
    color: '#92400e',
    fontSize: 11,
    fontWeight: '700',
  },
  pendingCountBadge: {
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  pendingCountBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  rideDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  rideCountdown: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f766e',
    marginBottom: 8,
  },
  rideAddress: {
    fontSize: 14,
    color: '#333',
    marginBottom: 2,
  },
  rideAmount: {
    alignItems: 'flex-end',
  },
  amountValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#28a745',
  },
  offerFooterRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  offerActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  offerActionBtn: {
    minWidth: 62,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptBtn: {
    backgroundColor: '#16a34a',
  },
  rejectBtn: {
    backgroundColor: '#dc2626',
  },
  offerActionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
