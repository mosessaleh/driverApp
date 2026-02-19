import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useAuth } from '../src/context/AuthContext';
import { useRouter } from 'expo-router';
import { getDriverUpcoming } from '../src/services/api';
import { onRideOffer, offRideOffer } from '../src/services/socket';
import { useTranslation } from '../src/hooks/useTranslation';

export default function UpcomingScreen() {
  const { authState } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [nowTs, setNowTs] = useState(Date.now());

  useEffect(() => {
    loadUpcoming();

    const handleRideOffer = () => {
      router.replace('/dashboard');
    };
    onRideOffer(handleRideOffer);

    return () => {
      offRideOffer();
    };
  }, []);

  useEffect(() => {
    if (rides.length === 0) {
      return;
    }
    setNowTs(Date.now());
    const interval = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [rides.length]);

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
    } catch (error) {
      console.error('Error loading upcoming rides:', error);
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
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefreshData} />
        }
      >
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
                {!!ride.stopAddress && (
                  <Text style={styles.rideAddress}>{ride.stopAddress}</Text>
                )}
                <Text style={styles.rideAddress}>{ride.dropoffAddress}</Text>
              </View>
              <View style={styles.rideAmount}>
                <Text style={styles.amountValue}>{ride.price} DKK</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
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
  loadingText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: '#666',
  },
  noDataText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
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
  rideInfo: {
    flex: 1,
  },
  rideHeaderRow: {
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
});
